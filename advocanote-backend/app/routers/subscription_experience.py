import asyncio
import logging
from datetime import datetime, timezone, timedelta
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
from app.database import get_db, SessionLocal
from app.models.subscription_plan import SubscriptionPlan
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
from admin_notifications_api import (
    create_admin_notification_once,
)

logger = logging.getLogger(__name__)


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

    plans = db.scalars(
        select(SubscriptionPlan)
        .where(
            SubscriptionPlan.is_active.is_(True)
        )
        .order_by(
            SubscriptionPlan.price.asc(),
            SubscriptionPlan.id.asc(),
        )
    ).all()

    result = []

    for plan in plans:

        # Keep old keys for existing frontend.
        # New plans get their own unique key.

        plan_key = PLAN_BY_ID.get(
            plan.id,
            f"plan_{plan.id}",
        )

        result.append({
            "key": plan_key,
            "plan_id": plan.id,
            "name": plan.name,
            "description": plan.description,
            "price": str(plan.price),
            "currency": plan.currency,
            "billing_interval": (
                plan.billing_interval
            ),
            "daily_action_limit": (
                plan.daily_action_limit
            ),
            "is_unlimited": (
                plan.daily_action_limit is None
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

   
    # ==========================================
    # CURRENT SUBSCRIPTION PLAN
    # ==========================================

    current_plan = (
        db.get(
            SubscriptionPlan,
            subscription.plan_id,
        )
        if subscription else None
    )

    current_plan_key = (
        PLAN_BY_ID.get(
            current_plan.id,
            f"plan_{current_plan.id}",
        )
        if current_plan else None
    )

    # ==========================================
    # DAILY USAGE DETAILS
    # ==========================================

    daily_limit = None
    actions_used = 0
    remaining = None
    unlimited = False

    # ==========================================
    # FREE TRIAL - ALWAYS UNLIMITED
    # ==========================================

    if valid and subscription.status == "trialing":
        unlimited = True

    # ==========================================
    # ANY ACTIVE PAID SUBSCRIPTION
    # ==========================================

    elif (
        valid
        and subscription.status == "active"
        and current_plan is not None
    ):

        # Read the actual limit from database.
        # None = Unlimited
        # 3 = 3 entries per day
        # 5 = 5 entries per day
        # Works for all admin-created plans.

        daily_limit = current_plan.daily_action_limit

        unlimited = daily_limit is None

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

    # ==========================================
    # DISPLAY PLAN NAME
    # ==========================================

    if (
        valid
        and subscription.status == "trialing"
    ):
        display_plan = "Free Trial"

    else:
        display_plan = (
            current_plan.name
            if current_plan else None
        )

    # ==========================================
    # SUBSCRIPTION ACCESS RESPONSE
    # ==========================================

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

    plan_key: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
    )

    plan_id: int | None = Field(
        default=None,
        gt=0,
    )



# ==========================================
# EXISTING PAID USER PLAN CHANGE
# ==========================================
# Uses Stripe's hosted confirmation.
# Database plan is NOT changed here.
# Verified Stripe payment/webhook updates it.

# ==========================================
# DYNAMIC PAID SUBSCRIPTION PLAN CHANGE
# ==========================================

def create_plan_change_portal(
    db: Session,
    user: User,
    subscription: Subscription,
    target_plan: SubscriptionPlan,
):

    # ======================================
    # VERIFY EXISTING STRIPE SUBSCRIPTION
    # ======================================

    if (
        not subscription.stripe_subscription_id
        or not subscription.stripe_customer_id
    ):
        raise HTTPException(
            status_code=409,
            detail="Stripe subscription not found",
        )

    current_plan = db.get(
        SubscriptionPlan,
        subscription.plan_id,
    )

    if current_plan is None:
        raise HTTPException(
            status_code=404,
            detail="Current subscription plan not found",
        )

    if current_plan.id == target_plan.id:
        raise HTTPException(
            status_code=409,
            detail="You already have this plan",
        )

    if not target_plan.is_active:
        raise HTTPException(
            status_code=409,
            detail="Selected plan is not active",
        )

    if not target_plan.stripe_price_id:
        raise HTTPException(
            status_code=409,
            detail="Selected plan is not connected to Stripe",
        )

    if current_plan.currency != target_plan.currency:
        raise HTTPException(
            status_code=409,
            detail="Plan currencies do not match",
        )

    # ======================================
    # CHECK SUPPORTED IMMEDIATE UPGRADES
    # ======================================
    #
    # Works with ANY database plan.
    #
    # Monthly -> Higher-priced monthly
    # Monthly -> Yearly
    #
    # Downgrades / Yearly -> Monthly require
    # a separate scheduled change workflow.
    # ======================================

    monthly_upgrade = (
        current_plan.billing_interval == "month"
        and target_plan.billing_interval == "month"
        and target_plan.price > current_plan.price
    )

    monthly_to_yearly = (
        current_plan.billing_interval == "month"
        and target_plan.billing_interval == "year"
    )

    if not (
        monthly_upgrade
        or monthly_to_yearly
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "This change cannot be applied "
                "as an immediate upgrade. "
                "Use a scheduled plan change "
                "for downgrades or other changes."
            ),
        )

    # ======================================
    # VERIFY STRIPE STATE
    # ======================================

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
            or customer != subscription.stripe_customer_id
            or metadata.get("user_id") != str(user.id)
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

        # ==================================
        # VERIFY CURRENT STRIPE PRICE
        # ==================================

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
            or item.get("quantity") != 1
        ):
            raise HTTPException(
                status_code=409,
                detail="Stripe plan mismatch",
            )

        # ==================================
        # OPEN STRIPE CONFIRMATION PORTAL
        # ==================================

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
                            "price": target_plan.stripe_price_id,
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
                "Confirm the plan change "
                "and payment in Stripe"
            ),
        }

    except stripe.error.StripeError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to open Stripe plan change. "
                "Check Billing Portal configuration."
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


    plan_key = (
        data.plan_key or ""
    ).strip().lower()

    if data.plan_id is not None:
        selected_plan_id = data.plan_id

    elif plan_key in PLAN_SETTINGS:
        selected_plan_id = (
            PLAN_SETTINGS[plan_key]["id"]
        )

    elif (
        plan_key.startswith("plan_")
        and plan_key[5:].isdigit()
    ):
        selected_plan_id = int(
            plan_key[5:]
        )

    else:
        raise HTTPException(
            status_code=422,
            detail="Invalid subscription plan",
        )

    target_plan = db.get(
        SubscriptionPlan,
        selected_plan_id,
    )

    if (
        target_plan is None
        or not target_plan.is_active
    ):
        raise HTTPException(
            status_code=404,
            detail="Active subscription plan not found",
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

# ==========================================
# ADMIN - AUTOMATIC TRIAL EXPIRY NOTIFICATIONS
# ==========================================

def check_trial_expiry_notifications():

    now = utc_now()
    warning_limit = now + timedelta(days=2)

    with SessionLocal() as db:

        records = db.execute(
            select(Subscription, User)
            .join(
                User,
                Subscription.user_id == User.id,
            )
            .where(
                Subscription.trial_ends_at.is_not(None),
                Subscription.status.in_(
                    ["trialing", "expired"]
                ),
                Subscription.trial_ends_at <= warning_limit,
                User.role == "lawyer",
            )
        ).all()

        for subscription, lawyer in records:

            try:
                expiry = subscription.trial_ends_at

                if expiry.tzinfo is not None:
                    expiry = expiry.astimezone(
                        timezone.utc
                    ).replace(tzinfo=None)

                lawyer_name = (
                    lawyer.full_name
                    or f"Lawyer #{lawyer.id}"
                )

                # ==================================
                # TRIAL EXPIRED
                # ==================================

                if expiry <= now:

                    notification_type = "expired"
                    notification_title = "Free Trial Expired"

                    message = (
                        f"{lawyer_name}'s free trial "
                        "has expired."
                    )

                    trial_status = "Expired"

                # ==================================
                # TRIAL EXPIRING WITHIN 2 DAYS
                # ==================================

                elif subscription.status == "trialing":

                    notification_type = "trial"
                    notification_title = "Trial Expiring Soon"

                    message = (
                        f"{lawyer_name}'s free trial "
                        "will expire within 2 days."
                    )

                    trial_status = "Expiring Soon"

                else:
                    continue

                # ==================================
                # SAVE ADMIN NOTIFICATION ONCE
                # ==================================

                create_admin_notification_once(
                    type=notification_type,
                    title=notification_title,
                    message=message,
                    details={
                        "lawyer_id": lawyer.id,
                        "lawyer_name": lawyer_name,
                        "email": lawyer.email,
                        "plan": "Free Trial",
                        "trial_status": trial_status,
                        "trial_end_date": (
                            expiry.isoformat() + "Z"
                        ),
                        "subscription_id": subscription.id,
                        "activity": notification_title,
                    },
                    unique_detail_key="subscription_id",
                )

            except Exception:
                logger.exception(
                    "Trial notification failed "
                    "for subscription_id=%s",
                    subscription.id,
                )


# ==========================================
# ADMIN - PAID SUBSCRIPTION EXPIRED
# ==========================================

def check_paid_subscription_expiry_notifications():

    now = utc_now()

    with SessionLocal() as db:

        records = db.execute(
            select(Subscription, User)
            .join(
                User,
                Subscription.user_id == User.id
            )
            .where(
                Subscription.current_period_end <= now,
                Subscription.stripe_subscription_id.is_not(None),
                Subscription.status.in_([
                    "active",
                    "past_due",
                    "unpaid",
                    "canceled",
                    "paused",
                    "incomplete_expired",
                ]),
                User.role == "lawyer",
            )
        ).all()

        for subscription, lawyer in records:

            try:
                # Verify current status from Stripe
                stripe_sub = stripe.Subscription.retrieve(
                    subscription.stripe_subscription_id
                ).to_dict()

                stripe_status = stripe_sub.get("status")

                # Do not report an active subscription
                # as expired if renewal is still valid.
                if stripe_status not in (
                    "canceled",
                    "unpaid",
                    "past_due",
                    "paused",
                    "incomplete_expired",
                ):
                    continue

                stripe_customer = stripe_sub.get("customer")

                if isinstance(stripe_customer, dict):
                    stripe_customer = stripe_customer.get("id")

                if (
                    stripe_customer != subscription.stripe_customer_id
                    or (stripe_sub.get("metadata") or {}).get("user_id")
                    != str(subscription.user_id)
                ):
                    continue

                lawyer_name = (
                    lawyer.full_name
                    or f"Lawyer #{lawyer.id}"
                )

                plan = db.get(
                    SubscriptionPlan,
                    subscription.plan_id
                )

                plan_name = (
                    plan.name if plan
                    else "Paid Subscription"
                )

                period_end = subscription.current_period_end

                # Unique per subscription billing period
                period_key = (
                    f"{subscription.id}:"
                    f"{period_end.isoformat()}"
                )

                create_admin_notification_once(
                    type="expired",
                    title="Subscription Expired",
                    message=(
                        f"{lawyer_name}'s {plan_name} "
                        "subscription has expired."
                    ),
                    details={
                        "lawyer_id": lawyer.id,
                        "lawyer_name": lawyer_name,
                        "email": lawyer.email,
                        "plan": plan_name,
                        "subscription_status": "Expired",
                        "period_end": period_end.isoformat(),
                        "subscription_id": subscription.id,
                        "period_key": period_key,
                        "activity": "Subscription Expired",
                    },
                    unique_detail_key="period_key",
                )

            except Exception:
                logger.exception(
                    "Paid subscription expiry check failed "
                    "for subscription_id=%s",
                    subscription.id,
                )

# ==========================================
# AUTOMATIC NOTIFICATION SCHEDULER
# ==========================================

async def trial_notification_scheduler():

    while True:

        try:
            # Check free trial expiry
            await asyncio.to_thread(
                check_trial_expiry_notifications
            )

            # Check paid subscription expiry
            await asyncio.to_thread(
                check_paid_subscription_expiry_notifications
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Subscription notification scheduler failed"
            )

        # Check every 1 hour
        await asyncio.sleep(3600)
