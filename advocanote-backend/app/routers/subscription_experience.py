import asyncio
import logging
from uuid import UUID
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
from app.models.payment import SubscriptionUpgrade
from app.models.subscription_daily_usage import (
    SubscriptionDailyUsage,
)
from app.routers.stripe_webhooks import (
    get_plan_from_stripe_subscription,
    process_checkout_upgrade,
    reconcile_paid_plan_upgrade,
)
from app.auth.security import get_current_user

from app.services.subscription_trial import (
    PLAN_SETTINGS,
    PLAN_BY_ID,
    get_display_plan_name,
    get_official_plan,
    start_free_trial_if_eligible,
)

from app.services.subscription_usage import (
    get_usage_date,
)

from app.routers.lawyer_subscriptions import (
    CheckoutRequest,
    create_billing_management_session,
    create_checkout,
    preview_full_price_upgrade,
    require_official_plan_id,
    synchronize_current_stripe_plan,
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
            SubscriptionPlan.is_active.is_(True),
            SubscriptionPlan.id.in_(PLAN_BY_ID),
        )
        .order_by(
            SubscriptionPlan.price.asc(),
            SubscriptionPlan.id.asc(),
        )
    ).all()

    result = []

    for plan in plans:

        result.append({
            "key": PLAN_BY_ID[plan.id],
            "plan_id": plan.id,
            "name": get_display_plan_name(plan),
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
        display_plan = get_display_plan_name(current_plan)

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

    upgrade_attempt_id: UUID | None = None


# ==========================================
# EXISTING PAID USER PLAN CHANGE
# ==========================================
# The plan changes only after Stripe confirms payment.

# ==========================================
# DYNAMIC PAID SUBSCRIPTION PLAN CHANGE
# ==========================================

def open_upgrade_checkout(db, subscription, stripe_sub, item, target_plan, attempt_id):
    active_upgrade = db.scalar(
        select(SubscriptionUpgrade)
        .where(
            SubscriptionUpgrade.subscription_id == subscription.id,
            SubscriptionUpgrade.status.in_(("checkout", "retiring")),
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if active_upgrade and active_upgrade.status == "retiring":
        raise HTTPException(status_code=409, detail="The previous upgrade is still being finalized")

    now = int(datetime.now(timezone.utc).timestamp())
    if active_upgrade and active_upgrade.stripe_checkout_session_id:
        checkout = stripe.checkout.Session.retrieve(active_upgrade.stripe_checkout_session_id)
        if checkout.status == "open" and active_upgrade.target_plan_id == target_plan.id:
            return {"redirect_url": checkout.url, "flow": "stripe_checkout"}
        if checkout.status != "expired" or checkout.payment_status != "unpaid":
            raise HTTPException(status_code=409, detail="Complete or let the previous upgrade Checkout expire")
        active_upgrade.status = "expired"
        db.flush()

    if active_upgrade and active_upgrade.status == "checkout" and not active_upgrade.stripe_checkout_session_id:
        if active_upgrade.target_plan_id != target_plan.id:
            raise HTTPException(status_code=409, detail="Retry your previous upgrade plan first")
        attempt = active_upgrade
        if attempt.expires_at <= now:
            # No link was returned. A timed-out Stripe request cannot be used
            # to pay after the persisted session expiry.
            attempt.status = "expired"
            db.flush()
            attempt = None
    else:
        attempt = None

    if attempt is None:
        expires_at = now + 45 * 60
        period_end = item.get("current_period_end") or 0
        # Leave time to retire the source after Checkout closes to new payments.
        if period_end <= expires_at + 30 * 60:
            raise HTTPException(status_code=409, detail="Try again after your current renewal finishes")
        preview_full_price_upgrade(subscription, item, target_plan)
        if stripe.Invoice.list(customer=subscription.stripe_customer_id, status="open", limit=1).data:
            raise HTTPException(status_code=409, detail="Resolve your open Stripe invoice before upgrading")

        other_subscriptions = stripe.Subscription.list(
            customer=subscription.stripe_customer_id, status="all", limit=100
        ).auto_paging_iter()
        if any(
            other.id != stripe_sub["id"] and other.status not in ("canceled", "incomplete_expired")
            for other in other_subscriptions
        ):
            raise HTTPException(status_code=409, detail="Another Stripe subscription already exists for this customer")

        attempt = db.scalar(
            select(SubscriptionUpgrade).where(
                SubscriptionUpgrade.source_stripe_subscription_id == stripe_sub["id"]
            ).with_for_update()
        )
        if attempt is None:
            attempt = SubscriptionUpgrade(
                subscription_id=subscription.id,
                source_stripe_subscription_id=stripe_sub["id"],
            )
            db.add(attempt)
        elif attempt.status != "expired":
            raise HTTPException(status_code=409, detail="An upgrade is already in progress")
        elif attempt.attempt_key == str(attempt_id):
            raise HTTPException(status_code=409, detail="Refresh the upgrade preview to open a new Checkout")

        attempt.target_plan_id = target_plan.id
        attempt.source_period_end = period_end
        attempt.attempt_key = str(attempt_id)
        attempt.stripe_checkout_session_id = None
        attempt.expires_at = expires_at
        attempt.status = "checkout"
        # Persist the idempotency key and immutable request values before
        # calling Stripe. Another attempt must reuse them after a timeout.
        db.commit()
        subscription = db.scalar(
            select(Subscription)
            .where(Subscription.id == subscription.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        db.refresh(attempt)
        if attempt.stripe_checkout_session_id:
            checkout = stripe.checkout.Session.retrieve(attempt.stripe_checkout_session_id)
            if checkout.status == "open":
                return {"redirect_url": checkout.url, "flow": "stripe_checkout"}
            raise HTTPException(status_code=409, detail="This upgrade Checkout is no longer open")

    if (
        subscription.stripe_subscription_id != attempt.source_stripe_subscription_id
        or attempt.target_plan_id != target_plan.id
        or attempt.status != "checkout"
    ):
        raise HTTPException(status_code=409, detail="Your subscription changed before Checkout opened")

    metadata = {
        "advocanote_upgrade": attempt.attempt_key,
        "user_id": str(subscription.user_id),
        "plan_id": str(target_plan.id),
    }
    base_url = settings.FRONTEND_URL.rstrip("/")
    checkout = stripe.checkout.Session.create(
        customer=subscription.stripe_customer_id,
        mode="subscription",
        allowed_payment_method_types=["card"],
        client_reference_id=str(subscription.user_id),
        line_items=[{"price": target_plan.stripe_price_id, "quantity": 1}],
        metadata=metadata,
        subscription_data={"metadata": metadata},
        expires_at=attempt.expires_at,
        success_url=f"{base_url}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{base_url}/subscription/cancel",
        idempotency_key=f"advocanote-upgrade-checkout:{attempt.attempt_key}",
    )
    attempt.stripe_checkout_session_id = checkout.id
    db.commit()
    return {"redirect_url": checkout.url, "flow": "stripe_checkout"}


def upgrade_paid_subscription(
    db: Session,
    user: User,
    subscription: Subscription,
    target_plan: SubscriptionPlan,
    attempt_id: UUID,
):

    # Serialize paid upgrades for the same subscription across requests.
    subscription = db.scalar(
        select(Subscription)
        .where(Subscription.id == subscription.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not active_access(subscription) or subscription.status != "active":
        raise HTTPException(status_code=409, detail="No eligible active paid subscription")

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

    # ======================================
    # VERIFY STRIPE STATE
    # ======================================

    try:
        stripe_sub = (
            stripe.Subscription.retrieve(
                subscription.stripe_subscription_id
            ).to_dict()
        )

        base_url = settings.FRONTEND_URL.rstrip("/")
        upgrade_return_url = (
            f"{base_url}/subscription"
            f"?upgrade_return=1&target_plan_id={target_plan.id}"
        )
        current_plan, item, plan_changed = synchronize_current_stripe_plan(
            stripe_sub, subscription, db
        )
        if plan_changed and current_plan.id == target_plan.id:
            return {
                "redirect_url": upgrade_return_url,
                "flow": "upgrade_already_verified",
                "message": "The paid upgrade has been verified and synchronized.",
            }

        if plan_changed:
            raise HTTPException(
                status_code=409,
                detail="Your Stripe plan was synchronized. Refresh and review the upgrade again.",
            )

        if current_plan.id == target_plan.id:
            raise HTTPException(
                status_code=409,
                detail="You already have this plan",
            )

        if current_plan.currency != target_plan.currency:
            raise HTTPException(
                status_code=409,
                detail="Plan currencies do not match",
            )

        monthly_upgrade = (
            current_plan.billing_interval == "month"
            and target_plan.billing_interval == "month"
            and target_plan.price > current_plan.price
        )
        monthly_to_yearly = (
            current_plan.billing_interval == "month"
            and target_plan.billing_interval == "year"
        )
        if not (monthly_upgrade or monthly_to_yearly):
            raise HTTPException(
                status_code=409,
                detail=(
                    "This change cannot be applied as an immediate upgrade. "
                    "Use a scheduled plan change for downgrades or other changes."
                ),
            )

        # A scheduled cancellation must be explicitly removed in Stripe
        # before creating an upgrade flow.
        if stripe_sub.get("cancel_at_period_end"):
            portal = create_billing_management_session(
                customer_id=subscription.stripe_customer_id,
                return_url=f"{base_url}/subscription",
            )
            return {
                "redirect_url": portal.url,
                "flow": "resume_before_upgrade",
                "message": (
                    "Your subscription is scheduled to cancel. "
                    "Review its renewal settings in Stripe, then "
                    "return to choose the upgrade again."
                ),
            }

        if stripe_sub.get("pending_update") or stripe_sub.get("schedule"):
            raise HTTPException(
                status_code=409,
                detail="Stripe subscription has a pending change",
            )

        if stripe_sub.get("collection_method") != "charge_automatically":
            raise HTTPException(status_code=409, detail="Automatic payment collection is required")

        return open_upgrade_checkout(db, subscription, stripe_sub, item, target_plan, attempt_id)

    except stripe.error.StripeError as exc:
        logger.exception(
            "STRIPE PLAN CHANGE FAILED: %s",
            exc,
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to verify the Stripe upgrade. "
                "Check your subscription before retrying."
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

    require_official_plan_id(selected_plan_id)
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

            # Local Free Trial users can
            # proceed to Stripe Checkout.
            # Stripe-managed trials must not
            # create a duplicate subscription.

            if (
                subscription.stripe_subscription_id
                or subscription.stripe_customer_id
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Existing Stripe trial must "
                        "be managed before changing plans"
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

            if data.upgrade_attempt_id is None:
                raise HTTPException(status_code=400, detail="Confirm the full-price upgrade first")

            return upgrade_paid_subscription(
                db=db,
                user=user,
                subscription=subscription,
                target_plan=target_plan,
                attempt_id=data.upgrade_attempt_id,
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
# SYNC VERIFIED PAID PLAN UPGRADE
# ==========================================

@router.post("/sync-paid-upgrade")
def sync_paid_upgrade(
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer),
):
    subscription = get_subscription(db, user.id)

    if (
        subscription is None
        or not subscription.stripe_subscription_id
        or not subscription.stripe_customer_id
    ):
        raise HTTPException(
            status_code=409,
            detail="No Stripe subscription found",
        )

    try:
        stripe_sub = stripe.Subscription.retrieve(
            subscription.stripe_subscription_id
        ).to_dict()

        customer = stripe_sub.get("customer")

        if isinstance(customer, dict):
            customer = customer.get("id")

        metadata = stripe_sub.get("metadata") or {}

        if (
            customer != subscription.stripe_customer_id
            or metadata.get("user_id") not in (None, str(user.id))
        ):
            raise HTTPException(
                status_code=409,
                detail="Stripe subscription mismatch",
            )

        stripe_plan, _ = (
            get_plan_from_stripe_subscription(
                stripe_sub,
                db,
            )
        )

        if stripe_plan.id == subscription.plan_id:
            return {
                "updated": False,
                "plan_id": subscription.plan_id,
                "message": "Plans already match",
            }

        reconciled = reconcile_paid_plan_upgrade(
            stripe_sub,
            db,
        )

        db.refresh(subscription)
        if subscription.plan_id != stripe_plan.id:
            return {
                "updated": False,
                "plan_id": subscription.plan_id,
                "message": "Upgrade payment has not been verified",
            }

        return {
            "updated": reconciled,
            "plan_id": subscription.plan_id,
            "message": (
                "Paid upgrade synced successfully"
                if reconciled
                else "Plans already match"
            ),
        }

    except HTTPException:
        raise

    except stripe.error.StripeError:
        db.rollback()
        logger.exception(
            "Stripe upgrade sync request failed"
        )
        raise HTTPException(
            status_code=502,
            detail="Unable to verify Stripe upgrade",
        )

    except Exception:
        db.rollback()
        logger.exception(
            "Paid upgrade sync failed for user_id=%s",
            user.id,
        )
        raise HTTPException(
            status_code=409,
            detail=(
                "Paid upgrade could not be synced. "
                "Check backend logs."
            ),
        )
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

def reconcile_checkout_upgrades():
    with SessionLocal() as db:
        ids = db.scalars(
            select(SubscriptionUpgrade.id).where(
                SubscriptionUpgrade.status.in_(("checkout", "retiring")),
                SubscriptionUpgrade.stripe_checkout_session_id.is_not(None),
            )
        ).all()

    for upgrade_id in ids:
        with SessionLocal() as db:
            try:
                process_checkout_upgrade(db.get(SubscriptionUpgrade, upgrade_id), db)
            except Exception:
                logger.exception("Could not reconcile Checkout upgrade %s", upgrade_id)


async def checkout_upgrade_scheduler():
    while True:
        try:
            await asyncio.to_thread(reconcile_checkout_upgrades)
        except Exception:
            logger.exception("Checkout upgrade reconciliation failed")
        await asyncio.sleep(60)


async def trial_notification_scheduler():
    recovery = asyncio.create_task(checkout_upgrade_scheduler())
    try:
        await subscription_notification_loop()
    finally:
        recovery.cancel()
        try:
            await recovery
        except asyncio.CancelledError:
            pass


async def subscription_notification_loop():

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
