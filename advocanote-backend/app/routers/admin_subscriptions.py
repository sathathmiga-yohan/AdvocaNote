
from decimal import Decimal

import stripe

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.auth.admin_guard import require_admin

from app.models.subscription_plan import SubscriptionPlan
from app.models.subscription import Subscription
from app.schemas.subscription import (
    PlanCreate,
    PlanUpdate,
    PlanResponse,
)


# =====================================
# STRIPE CONFIGURATION
# =====================================

stripe.api_key = settings.STRIPE_SECRET_KEY


router = APIRouter(
    prefix="/admin/subscriptions",
    tags=["Admin Subscriptions"],
    dependencies=[Depends(require_admin)],
)


# =====================================
# CREATE SUBSCRIPTION PLAN
# =====================================

@router.post(
    "/plans",
    response_model=PlanResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_plan(
    data: PlanCreate,
    db: Session = Depends(get_db),
):

    values = data.model_dump()

    requested_active = values.pop("is_active")

    # STEP 1: Save inactive plan in MySQL

    plan = SubscriptionPlan(
        **values,
        is_active=False,
    )

    db.add(plan)
    db.commit()
    db.refresh(plan)

    # STEP 2: Create Stripe Product and Price

    try:
        amount = int(
            plan.price * Decimal("100")
        )

        stripe_price = stripe.Price.create(
            currency=plan.currency.lower(),
            unit_amount=amount,
            recurring={
                "interval": plan.billing_interval,
            },
            product_data={
                "name": f"AdvocaNote {plan.name}",
            },
            metadata={
                "advocanote_plan_id": str(plan.id),
            },
            idempotency_key=(
                f"advocanote-plan-{plan.id}-v1"
            ),
        )

    except stripe.error.StripeError:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Stripe plan creation failed",
                "plan_id": plan.id,
                "status": "inactive",
            },
        )

    # STEP 3: Save Stripe IDs in MySQL

    plan.stripe_product_id = stripe_price.product
    plan.stripe_price_id = stripe_price.id
    plan.is_active = requested_active

    try:
        db.commit()
        db.refresh(plan)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=503,
            detail={
                "message": "Stripe created the price, but database sync failed",
                "plan_id": plan.id,
                "action": "Reconciliation required",
            },
        )

    return plan


# =====================================
# GET ALL SUBSCRIPTION PLANS
# =====================================

@router.get(
    "/plans",
    response_model=list[PlanResponse],
)
def get_all_plans(
    db: Session = Depends(get_db),
):

    plans = db.scalars(
        select(SubscriptionPlan)
        .order_by(SubscriptionPlan.id.desc())
    ).all()

    return plans


# =====================================
# UPDATE SUBSCRIPTION PLAN
# =====================================

@router.patch(
    "/plans/{plan_id}",
    response_model=PlanResponse,
)
def update_plan(
    plan_id: int,
    data: PlanUpdate,
    db: Session = Depends(get_db),
):

    plan = db.get(SubscriptionPlan, plan_id)

    if plan is None:
        raise HTTPException(
            status_code=404,
            detail="Subscription plan not found",
        )

    updates = data.model_dump(
        exclude_unset=True
    )

    non_nullable = {
        "name",
        "price",
        "billing_interval",
        "features",
        "trial_days",
        "is_active",
    }

    for key in non_nullable:
        if key in updates and updates[key] is None:
            raise HTTPException(
                status_code=422,
                detail=f"{key} cannot be null",
            )

    # Existing Stripe Prices cannot be repriced.

    if plan.stripe_price_id and (
        "price" in updates
        or "billing_interval" in updates
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "A new Stripe Price is required "
                "before changing billing terms"
            ),
        )


    # Protect plans with existing subscribers
    has_subscribers = db.scalar(
        select(Subscription.id)
        .where(
            Subscription.plan_id == plan_id,
            Subscription.status.in_(
                ["active", "trialing", "past_due"]
            ),
        )
        .limit(1)
    ) is not None

    if has_subscribers:

        if (
            "features" in updates
            and updates["features"] != plan.features
        ):
            raise HTTPException(
                status_code=409,
                detail="Cannot change features while subscribers exist",
            )

        if (
            plan.is_active
            and updates.get("is_active") is False
        ):
            raise HTTPException(
                status_code=409,
                detail="Cannot deactivate a plan with subscribers",
            )


    for key, value in updates.items():
        setattr(plan, key, value)

    db.commit()
    db.refresh(plan)

    return plan

# =====================================
# UPDATE DAILY ACTION LIMIT
# =====================================

# None = Unlimited
# 3 = Three actions per day
# Applies across all app features


class PlanDailyLimitUpdate(BaseModel):
    model_config = ConfigDict(
        extra="forbid"
    )

    daily_action_limit: int | None = Field(
        ...,
        ge=1,
        description=(
            "Maximum new diary entries per day, "
            "or null for unlimited diary entries"
        ),
    )



@router.patch("/plans/{plan_id}/daily-limit")
def update_plan_daily_limit(
    plan_id: int,
    data: PlanDailyLimitUpdate,
    db: Session = Depends(get_db),
):

    plan = db.get(
        SubscriptionPlan,
        plan_id,
    )

    if plan is None:
        raise HTTPException(
            status_code=404,
            detail="Subscription plan not found",
        )

    # Configure usage limit without
    # modifying Stripe price or billing.
    #
    # Changes also affect existing
    # subscribers on this plan once
    # usage enforcement is enabled.

    plan.daily_action_limit = (
        data.daily_action_limit
    )

    try:
        db.commit()
        db.refresh(plan)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=503,
            detail="Could not update plan daily action limit",
        )

    return {
        "plan_id": plan.id,
        "plan_name": plan.name,
        "daily_action_limit": (
            plan.daily_action_limit
        ),
        "usage_policy": (
            "unlimited"
            if plan.daily_action_limit is None
            else "limited"
        ),
    }


# =====================================
# LINK EXISTING STRIPE PRICE SCHEMA
# =====================================

class LinkStripePriceRequest(BaseModel):

    model_config = ConfigDict(
        extra="forbid"
    )

    price_id: str = Field(
        min_length=8,
        max_length=255,
        pattern=r"^price_[A-Za-z0-9_]+$",
    )

    @field_validator(
        "price_id",
        mode="before",
    )
    @classmethod
    def clean_price_id(cls, value):

        if isinstance(value, str):
            return value.strip()

        return value


# =====================================
# LINK EXISTING STRIPE PRICE
# =====================================

@router.post(
    "/plans/{plan_id}/link-stripe"
)
def link_existing_stripe_price(
    plan_id: int,
    data: LinkStripePriceRequest,
    db: Session = Depends(get_db),
):

    # STEP 1: Find plan in MySQL

    plan = db.get(
        SubscriptionPlan,
        plan_id,
    )

    if plan is None:
        raise HTTPException(
            status_code=404,
            detail="Subscription plan not found",
        )

    # STEP 2: Check existing Stripe link

    if plan.stripe_price_id is not None:

        if plan.stripe_price_id == data.price_id:
            return {
                "message": "Plan already linked",
                "plan_id": plan.id,
                "stripe_product_id": plan.stripe_product_id,
                "stripe_price_id": plan.stripe_price_id,
            }

        raise HTTPException(
            status_code=409,
            detail="Plan already linked to another Stripe Price",
        )

    # STEP 3: Retrieve Price from Stripe

    try:
        stripe_price = stripe.Price.retrieve(
            data.price_id
        )

    except stripe.error.InvalidRequestError:
        raise HTTPException(
            status_code=400,
            detail="Invalid Stripe Price ID",
        )

    except stripe.error.StripeError:
        raise HTTPException(
            status_code=502,
            detail="Stripe Price verification failed",
        )

    # STEP 4: Read Stripe Price details

    recurring = stripe_price.get("recurring")

    expected_amount = int(
        plan.price * Decimal("100")
    )

    stripe_interval = (
        recurring.get("interval")
        if recurring else None
    )

    stripe_interval_count = (
        recurring.get("interval_count")
        if recurring else None
    )

    stripe_usage_type = (
        recurring.get("usage_type")
        if recurring else None
    )

    # STEP 5: Compare Stripe with MySQL

    checks = {
        "active": (
            stripe_price.get("active"),
            True,
        ),
        "type": (
            stripe_price.get("type"),
            "recurring",
        ),
        "currency": (
            stripe_price.get("currency", "").upper(),
            plan.currency.upper(),
        ),
        "amount": (
            stripe_price.get("unit_amount"),
            expected_amount,
        ),
        "billing_interval": (
            stripe_interval,
            plan.billing_interval,
        ),
        "interval_count": (
            stripe_interval_count,
            1,
        ),
        "usage_type": (
            stripe_usage_type,
            "licensed",
        ),
        "billing_scheme": (
            stripe_price.get("billing_scheme"),
            "per_unit",
        ),
    }

    mismatches = {}

    for field, (actual, expected) in checks.items():

        if actual != expected:
            mismatches[field] = {
                "stripe_value": actual,
                "database_expected": expected,
            }

    # STEP 6: Report exact validation problem

    if mismatches:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Stripe Price validation failed",
                "mismatched_fields": mismatches,
            },
        )

    # STEP 7: Verify Stripe Product ID

    product = stripe_price.get("product")

    product_id = (
        product
        if isinstance(product, str)
        else product.get("id") if product else None
    )

    if not product_id:
        raise HTTPException(
            status_code=422,
            detail="Stripe Product ID missing",
        )

    if (
        plan.stripe_product_id
        and plan.stripe_product_id != product_id
    ):
        raise HTTPException(
            status_code=409,
            detail="Stripe Product ID does not match",
        )

    # STEP 8: Save Stripe IDs

    plan.stripe_product_id = product_id
    plan.stripe_price_id = stripe_price.id

    try:
        db.commit()
        db.refresh(plan)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Stripe Price already linked to another plan",
        )

    return {
        "message": "Stripe Plan linked successfully",
        "plan_id": plan.id,
        "stripe_product_id": plan.stripe_product_id,
        "stripe_price_id": plan.stripe_price_id,
    }
    
    
# =====================================
# ADMIN SUBSCRIPTIONS OVERVIEW
# =====================================

from app.models.user import User
from app.models.subscription import Subscription
from app.models.payment import Payment


@router.get("/overview")
def get_admin_subscriptions_overview(
    db: Session = Depends(get_db),
):
    # 1. Get registered lawyers
    lawyers = db.scalars(
        select(User)
        .where(User.role == "lawyer")
        .order_by(User.id.desc())
    ).all()

    # 2. Get subscription plans
    plans = db.scalars(
        select(SubscriptionPlan)
        .order_by(SubscriptionPlan.id.desc())
    ).all()

    # 3. Get lawyer subscriptions
    subscriptions = db.scalars(
        select(Subscription)
    ).all()

    # 4. Get payment history
    payments = db.scalars(
        select(Payment)
        .order_by(Payment.id.desc())
    ).all()

    plan_by_id = {
        plan.id: plan for plan in plans
    }

    subscription_by_user = {
        item.user_id: item
        for item in subscriptions
    }

    lawyer_by_id = {
        lawyer.id: lawyer
        for lawyer in lawyers
    }

    # =================================
    # LAWYER DETAILS
    # =================================

    lawyer_rows = []

    for lawyer in lawyers:
        sub = subscription_by_user.get(
            lawyer.id
        )

        plan = (
            plan_by_id.get(sub.plan_id)
            if sub else None
        )

        full_name = (
            getattr(lawyer, "full_name", None)
            or getattr(lawyer, "name", None)
            or " ".join(filter(None, [
                getattr(lawyer, "first_name", None),
                getattr(lawyer, "last_name", None),
            ]))
            or "Lawyer"
        )

        lawyer_rows.append({
            "id": lawyer.id,
            "full_name": full_name,
            "email": lawyer.email,
            "created_at": getattr(lawyer, "created_at", None),
            "is_verified": getattr(lawyer, "is_email_verified", False),
            "is_active": getattr(lawyer, "is_active", None),

                "bar_number": lawyer.bar_number,
                "phone_number": lawyer.phone_number,
                "city": lawyer.city,
                "law_firm": lawyer.law_firm,
                "professional_title": lawyer.professional_title,

            "subscription": (
                {
                    "id": sub.id,
                    "plan_id": sub.plan_id,
                    "plan_name": (
                        plan.name if plan else None
                    ),
                    "status": sub.status,
                    "current_period_end":
                        sub.current_period_end,
                    "cancel_at_period_end":
                        sub.cancel_at_period_end,
                }
                if sub else None
            ),
        })

    # =================================
    # PLAN DETAILS
    # =================================

    # =================================
    # PLAN DETAILS
    # =================================

    plan_rows = [
        {
            "id": plan.id,
            "name": plan.name,
            "description": getattr(
                plan, "description", None
            ),
            "price": str(plan.price),
            "currency": plan.currency,
            "billing_interval": (
                plan.billing_interval
            ),
            "features": plan.features,
            "trial_days": plan.trial_days,

            # Daily usage restriction
            # None means unlimited usage

            "daily_action_limit": (
                plan.daily_action_limit
            ),

            "is_active": bool(plan.is_active),
        }
        for plan in plans
    ]


    # =================================
    # PAYMENT HISTORY
    # =================================

    payment_rows = []

    for payment in payments:
        lawyer = lawyer_by_id.get(
            payment.user_id
        )

        plan = plan_by_id.get(
            payment.plan_id
        )

        payment_rows.append({
            "id": payment.id,
            "user_id": payment.user_id,
            "lawyer_email": (
                lawyer.email if lawyer else None
            ),
            "plan_id": payment.plan_id,
            "plan_name": (
                plan.name if plan else None
            ),
            "amount": str(payment.amount),
            "currency": payment.currency,
            "status": payment.status,
            "created_at": payment.created_at,
            "paid_at": payment.paid_at,
        })

    # =================================
    # ADMIN OVERVIEW RESPONSE
    # =================================

    return {
        "lawyers": lawyer_rows,
        "plans": plan_rows,
        "payments": payment_rows,
        "payments_enabled": True,
    }
