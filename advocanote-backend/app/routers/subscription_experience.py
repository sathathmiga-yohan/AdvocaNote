
from datetime import datetime, timezone

import stripe

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db

from app.models.user import User
from app.models.subscription import Subscription
from app.models.subscription_daily_usage import (
    SubscriptionDailyUsage,
)

from app.auth.security import get_current_user

from app.services.subscription_trial import (
    PLAN_SETTINGS,
    PLAN_BY_ID,
    get_official_plan,
    start_free_trial_if_eligible,
)

from app.services.subscription_usage import (
    get_usage_date,
)

from app.routers.lawyer_subscriptions import (
    CheckoutRequest,
    create_checkout,
)


router = APIRouter(
    prefix="/subscriptions",
    tags=["Subscription Experience"],
)

stripe.api_key = settings.STRIPE_SECRET_KEY


# ==========================================
# HELPERS
# ==========================================

def utc_now():
    return datetime.now(
        timezone.utc
    ).replace(tzinfo=None)


def require_lawyer(
    user: User = Depends(get_current_user),
):
    if user.role != "lawyer" or not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Active lawyer account required",
        )

    return user


def get_subscription(
    db: Session,
    user_id: int,
):
    return db.scalar(
        select(Subscription).where(
            Subscription.user_id == user_id
        )
    )


def active_access(subscription):

    if subscription is None:
        return False

    if subscription.status == "trialing":
        expiry = subscription.trial_ends_at

    elif subscription.status == "active":
        expiry = subscription.current_period_end

    else:
        return False

    return bool(
        expiry is not None
        and expiry > utc_now()
    )


def plan_options(db: Session):

    result = []

    for key in (
        "basic",
        "premium",
        "annual",
    ):
        config = PLAN_SETTINGS[key]

        plan = get_official_plan(
            db,
            key,
        )

        result.append({
            "key": key,
            "plan_id": plan.id,
            "name": config["name"],
            "price": str(config["price"]),
            "currency": "LKR",
            "billing_interval": (
                config["interval"]
            ),
            "daily_action_limit": (
                config["daily_limit"]
            ),
            "is_unlimited": (
                config["daily_limit"] is None
            ),
            "all_features": True,
            "stripe_ready": bool(
                plan.stripe_price_id
            ),
        })

    return result


# ==========================================
# AVAILABLE PAID PLANS
# ==========================================

@router.get("/options")
def subscription_options(
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer),
):
    return plan_options(db)


# ==========================================
# MY SUBSCRIPTION + DAILY USAGE
# ==========================================
# Called when lawyer dashboard loads.
# Creates first free trial automatically.
# ==========================================

@router.get("/access")
def subscription_access(
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer),
):

    # Safe to call on every dashboard load.
    # Existing subscriptions are not replaced.

    start_free_trial_if_eligible(user.id)

    db.expire_all()

    subscription = get_subscription(
        db,
        user.id,
    )

    valid = active_access(subscription)

    if subscription is None:
        current_status = "not_subscribed"

    elif valid:
        current_status = subscription.status

    elif subscription.status in (
        "active",
        "trialing",
    ):
        current_status = "expired"

    else:
        current_status = subscription.status

    current_plan_key = None
    daily_limit = None
    actions_used = 0
    remaining = None
    unlimited = False

    if subscription is not None:
        current_plan_key = PLAN_BY_ID.get(
            subscription.plan_id
        )

    if valid and subscription.status == "trialing":
        unlimited = True

    elif valid and subscription.status == "active":

        config = (
            PLAN_SETTINGS.get(current_plan_key)
        )

        if config:
            daily_limit = config["daily_limit"]

            unlimited = (
                daily_limit is None
            )

            if daily_limit is not None:

                usage = db.scalar(
                    select(SubscriptionDailyUsage)
                    .where(
                        SubscriptionDailyUsage.user_id
                        == user.id,

                        SubscriptionDailyUsage.usage_date
                        == get_usage_date(),
                    )
                )

                actions_used = (
                    usage.actions_used
                    if usage else 0
                )

                remaining = max(
                    0,
                    daily_limit - actions_used,
                )

    if valid and subscription.status == "trialing":
        display_plan = "Free Trial"
    elif current_plan_key:
        display_plan = (
            PLAN_SETTINGS[current_plan_key]["name"]
        )
    else:
        display_plan = None

    return {
        "status": current_status,
        "has_access": valid,
        "plan_id": (
            subscription.plan_id
            if subscription else None
        ),
        "plan_key": current_plan_key,
        "plan_name": display_plan,
        "is_unlimited": unlimited,
        "daily_action_limit": daily_limit,
        "actions_used_today": actions_used,
        "remaining_today": remaining,
        "trial_ends_at": (
            subscription.trial_ends_at
            if subscription else None
        ),
        "current_period_end": (
            subscription.current_period_end
            if subscription else None
        ),
        "can_change_plan": bool(
            valid
            and subscription
            and subscription.status == "active"
            and subscription.stripe_subscription_id
            and subscription.stripe_customer_id
        ),
        "plans": plan_options(db),
    }


# ==========================================
# SELECT PAID PLAN
# ==========================================

class SelectPlanRequest(BaseModel):
    plan_key: str = Field(
        min_length=1,
        max_length=20,
    )


# ==========================================
# EXISTING PAID USER PLAN CHANGE
# ==========================================
# Uses Stripe's hosted confirmation.
# Database plan is NOT changed here.
# Verified Stripe payment/webhook updates it.
# ==========================================

def create_plan_change_portal(
    db: Session,
    user: User,
    subscription: Subscription,
    target_plan,
):

    if (
        not subscription.stripe_subscription_id
        or not subscription.stripe_customer_id
    ):
        raise HTTPException(
            status_code=409,
            detail="Stripe subscription not found",
        )

    current_plan_key = PLAN_BY_ID.get(
        subscription.plan_id
    )

    if current_plan_key is None:
        raise HTTPException(
            status_code=409,
            detail="Current plan is not supported",
        )

    current_plan = get_official_plan(
        db,
        current_plan_key,
    )

    # This flow supports upgrades from
    # Basic to Premium / Annual, and
    # Premium to Annual.
    #
    # Annual downgrades are handled separately
    # after the already-paid period.

    allowed_changes = {
        "basic": {"premium", "annual"},
        "premium": {"annual"},
        "annual": set(),
    }

    target_key = PLAN_BY_ID[target_plan.id]

    if target_key not in allowed_changes[
        current_plan_key
    ]:
        raise HTTPException(
            status_code=409,
            detail=(
                "This plan change is not available "
                "as an immediate upgrade"
            ),
        )

    try:
        stripe_sub = (
            stripe.Subscription.retrieve(
                subscription.stripe_subscription_id
            ).to_dict()
        )

        customer = stripe_sub.get("customer")

        if isinstance(customer, dict):
            customer = customer.get("id")

        metadata = (
            stripe_sub.get("metadata") or {}
        )

        if (
            stripe_sub.get("status") != "active"
            or customer
            != subscription.stripe_customer_id
            or metadata.get("user_id")
            != str(user.id)
            or metadata.get("plan_id")
            != str(current_plan.id)
            or stripe_sub.get("pending_update")
            or stripe_sub.get("schedule")
            or stripe_sub.get("cancel_at_period_end")
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Stripe subscription cannot "
                    "be changed right now"
                ),
            )

        items = (
            (stripe_sub.get("items") or {})
            .get("data") or []
        )

        if len(items) != 1:
            raise HTTPException(
                status_code=409,
                detail="Invalid Stripe subscription items",
            )

        item = items[0]

        price = item.get("price")

        current_price_id = (
            price.get("id")
            if isinstance(price, dict)
            else price
        )

        if (
            not item.get("id")
            or current_price_id
            != current_plan.stripe_price_id
        ):
            raise HTTPException(
                status_code=409,
                detail="Stripe plan mismatch",
            )

        base_url = settings.FRONTEND_URL.rstrip("/")

        portal = stripe.billing_portal.Session.create(
            customer=subscription.stripe_customer_id,
            return_url=base_url,
            flow_data={
                "type": "subscription_update_confirm",
                "subscription_update_confirm": {
                    "subscription": (
                        subscription.stripe_subscription_id
                    ),
                    "items": [
                        {
                            "id": item["id"],
                            "price": (
                                target_plan.stripe_price_id
                            ),
                            "quantity": 1,
                        }
                    ],
                },
                "after_completion": {
                    "type": "redirect",
                    "redirect": {
                        "return_url": base_url,
                    },
                },
            },
        )

        return {
            "redirect_url": portal.url,
            "flow": "stripe_plan_change",
            "message": (
                "Confirm the plan change and "
                "payment in Stripe"
            ),
        }

    except stripe.error.StripeError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to open Stripe plan change. "
                "Check Billing Portal plan-switching "
                "configuration."
            ),
        ) from exc


# ==========================================
# CHECKOUT / UPGRADE
# ==========================================

@router.post("/select")
def select_subscription_plan(
    data: SelectPlanRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer),
):

    plan_key = data.plan_key.strip().lower()

    if plan_key not in PLAN_SETTINGS:
        raise HTTPException(
            status_code=422,
            detail="Invalid subscription plan",
        )

    target_plan = get_official_plan(
        db,
        plan_key,
    )

    if not target_plan.stripe_price_id:
        raise HTTPException(
            status_code=409,
            detail=(
                "This plan is not yet "
                "connected to Stripe"
            ),
        )

    subscription = get_subscription(
        db,
        user.id,
    )

    # ==================================
    # EXISTING ACTIVE ACCESS
    # ==================================

    if active_access(subscription):

        if subscription.status == "trialing":
            raise HTTPException(
                status_code=409,
                detail=(
                    "Your free trial is still active. "
                    "Choose a paid plan when it ends."
                ),
            )

        if subscription.status == "active":

            if subscription.plan_id == target_plan.id:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "You already have this plan"
                    ),
                )

            # Paid Basic -> Premium / Annual
            # Paid Premium -> Annual

            return create_plan_change_portal(
                db=db,
                user=user,
                subscription=subscription,
                target_plan=target_plan,
            )

    # ==================================
    # NEW PAYMENT AFTER TRIAL EXPIRY
    # ==================================

    # Reuse your EXISTING secure Stripe
    # Checkout implementation.
    #
    # It already validates expired local
    # trials and writes a pending Payment.
    #
    # Never activate paid access here.

    checkout = create_checkout(
        data=CheckoutRequest(
            plan_id=target_plan.id
        ),
        db=db,
        user=user,
    )

    return {
        "redirect_url": checkout["checkout_url"],
        "session_id": checkout["session_id"],
        "flow": "stripe_checkout",
    }
