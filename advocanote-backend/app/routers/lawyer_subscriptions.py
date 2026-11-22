import stripe
import os

from datetime import datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status
)

from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.security import get_current_user
from app.models.user import User
from app.models.subscription_plan import SubscriptionPlan
from app.models.subscription import Subscription
from app.schemas.subscription import PlanResponse


from app.services.subscription_trial import (
    PLAN_SETTINGS,
    get_display_plan_name,
    start_free_trial_if_eligible,
)

from app.config import settings
from app.models.payment import Payment


stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(
    prefix="/subscriptions",
    tags=["Lawyer Subscriptions"]
)


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)



def require_lawyer(
    user: User = Depends(get_current_user),
):
    if (
        user.role != "lawyer"
        or not user.is_active
    ):
        raise HTTPException(
            status_code=403,
            detail="Active lawyer account required",
        )

    return user



class StartTrialRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan_id: int = Field(gt=0)




class SubscriptionStatusResponse(BaseModel):

    plan_id: int | None
    plan_name: str | None
    status: str

    trial_ends_at: datetime | None
    current_period_end: datetime | None

    cancel_at_period_end: bool = False

    # Billing details
    price: str | None = None
    currency: str | None = None
    billing_cycle: str | None = None
    can_cancel: bool = False

    # =====================================
    # DAILY USAGE RESTRICTIONS
    # =====================================

    # None = Unlimited or no active plan
    # 3 = Basic plan daily action limit

    daily_action_limit: int | None = None

    # True only for an eligible unlimited plan
    is_unlimited: bool = False

def subscription_response(
    db: Session,
    subscription: Subscription | None,
):

    # =====================================
    # NO SUBSCRIPTION
    # =====================================

    if subscription is None:
        return {
            "plan_id": None,
            "plan_name": None,
            "status": "not_subscribed",
            "trial_ends_at": None,
            "current_period_end": None,
            "cancel_at_period_end": False,
            "price": None,
            "currency": None,
            "billing_cycle": None,
            "can_cancel": False,
            "daily_action_limit": None,
            "is_unlimited": False,
        }

    # =====================================
    # GET CURRENT PLAN FROM DATABASE
    # =====================================

    plan = db.get(
        SubscriptionPlan,
        subscription.plan_id,
    )

    # =====================================
    # CHECK SUBSCRIPTION EXPIRY
    # =====================================

    effective_status = subscription.status
    now = utc_now()

    if subscription.status == "trialing":
        if (
            subscription.trial_ends_at is None
            or subscription.trial_ends_at <= now
        ):
            effective_status = "expired"

    elif subscription.status == "active":
        if (
            subscription.current_period_end is None
            or subscription.current_period_end <= now
        ):
            effective_status = "expired"

    # =====================================
    # DYNAMIC DAILY DIARY ENTRY LIMIT
    # =====================================

    daily_action_limit = None
    is_unlimited = False

    if effective_status == "trialing":
        # Free Trial is always unlimited.

        is_unlimited = True

    elif effective_status == "active" and plan:
        # Any admin-created paid plan:
        #
        # None = Unlimited
        # 3    = 3 entries per day
        # 5    = 5 entries per day
        # 10   = 10 entries per day

        daily_action_limit = (
            plan.daily_action_limit
        )

        is_unlimited = (
            daily_action_limit is None
        )

    # =====================================
    # DISPLAY CURRENT PLAN
    # =====================================

    if effective_status == "trialing":
        display_plan_name = "Free Trial"
    else:
        display_plan_name = (
            get_display_plan_name(plan)
        )

    # =====================================
    # STRIPE CANCELLATION ACCESS
    # =====================================

    can_cancel = bool(
        subscription.stripe_subscription_id
        and subscription.stripe_customer_id
        and effective_status == "active"
        and not subscription.cancel_at_period_end
    )

    # =====================================
    # SUBSCRIPTION RESPONSE
    # =====================================

    return {
        "plan_id": subscription.plan_id,

        "plan_name": display_plan_name,

        "status": effective_status,

        "trial_ends_at": (
            subscription.trial_ends_at
        ),

        "current_period_end": (
            subscription.current_period_end
        ),

        "cancel_at_period_end": bool(
            subscription.cancel_at_period_end
        ),

        "price": (
            str(plan.price)
            if plan else None
        ),

        "currency": (
            plan.currency
            if plan else None
        ),

        "billing_cycle": (
            plan.billing_interval
            if plan else None
        ),

        "can_cancel": can_cancel,

        "daily_action_limit": (
            daily_action_limit
        ),

        "is_unlimited": is_unlimited,
    }

# =====================================
# AVAILABLE PLANS
# =====================================

@router.get(
    "/plans",
    response_model=list[PlanResponse]
)
def get_available_plans(
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer)
):

    plans = db.scalars(
        select(SubscriptionPlan)
        .where(SubscriptionPlan.is_active.is_(True))
        .order_by(SubscriptionPlan.price.asc())
    ).all()

    return [
        PlanResponse.model_validate(plan).model_copy(
            update={"name": get_display_plan_name(plan)}
        )
        for plan in plans
    ]

# =====================================
# START FREE TRIAL
# =====================================

@router.post(
    "/trial",
    response_model=SubscriptionStatusResponse,
    status_code=status.HTTP_201_CREATED,
)
def start_trial(
    data: StartTrialRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer),
):

    if data.plan_id != PLAN_SETTINGS["basic"]["id"]:
        raise HTTPException(
            status_code=422,
            detail="Free Trial must use the Basic plan",
        )

    created = start_free_trial_if_eligible(
        user.id
    )

    if not created:
        raise HTTPException(
            status_code=409,
            detail=(
                "Free Trial already started "
                "or subscription already exists"
            ),
        )

    db.expire_all()

    subscription = db.scalar(
        select(Subscription).where(
            Subscription.user_id == user.id
        )
    )

    if subscription is None:
        raise HTTPException(
            status_code=500,
            detail="Unable to load Free Trial",
        )

    return subscription_response(
        db,
        subscription,
    )

# =====================================
# MY SUBSCRIPTION
# =====================================

@router.get(
    "/me",
    response_model=SubscriptionStatusResponse
)
def get_my_subscription(
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer)
):

    subscription = db.scalar(
        select(Subscription)
        .where(Subscription.user_id == user.id)
    )

    return subscription_response(db, subscription)


# =====================================
# STRIPE CHECKOUT
# =====================================

class CheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan_id: int = Field(gt=0)


@router.post("/checkout")
def create_checkout(
    data: CheckoutRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer)
):

    # =====================================
    # 1. FIND SELECTED PLAN
    # =====================================

    plan = db.get(
        SubscriptionPlan,
        data.plan_id
    )

    if plan is None or not plan.is_active:
        raise HTTPException(
            status_code=404,
            detail="Active plan not found"
        )

    if not plan.stripe_price_id:
        raise HTTPException(
            status_code=409,
            detail="Plan is not connected to Stripe"
        )

    # =====================================
    # 2. CHECK EXISTING SUBSCRIPTION
    # =====================================

    existing = db.scalar(
        select(Subscription).where(
            Subscription.user_id == user.id
        )
    )

    if existing:

        # Allow local Free Trial users to buy
        # a paid plan before the trial expires.
        # Do not create a second Stripe subscription
        # if one already exists.

        local_free_trial = (
            existing.status == "trialing"
            and existing.trial_ends_at is not None
            and existing.stripe_subscription_id is None
            and existing.stripe_customer_id is None
        )

        if not local_free_trial:
            expired_subscription = (
                existing.status in ("active", "expired")
                and existing.current_period_end is not None
                and existing.current_period_end <= utc_now()
            )
            if existing.status != "canceled" and not expired_subscription:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Existing subscription "
                        "must be managed first"
                    ),
                )

            # Verify previously canceled
            # Stripe subscription.

            if (
                not existing.stripe_subscription_id
                or not existing.stripe_customer_id
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Previous subscription "
                        "requires verification"
                    ),
                )

            try:
                old_stripe_sub = (
                    stripe.Subscription.retrieve(
                        existing.stripe_subscription_id
                    ).to_dict()
                )

            except stripe.error.StripeError as exc:
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "Unable to verify "
                        "previous subscription"
                    ),
                ) from exc

            old_customer = old_stripe_sub.get(
                "customer"
            )

            if isinstance(old_customer, dict):
                old_customer = old_customer.get("id")

            metadata = (
                old_stripe_sub.get("metadata") or {}
            )
            previous_items = (
                (old_stripe_sub.get("items") or {}).get("data") or []
            )
            previous_price_id = None
            if len(previous_items) == 1:
                previous_price = previous_items[0].get("price")
                previous_price_id = (
                    previous_price.get("id")
                    if isinstance(previous_price, dict)
                    else previous_price
                )
            previous_plan = db.scalar(
                select(SubscriptionPlan).where(
                    SubscriptionPlan.stripe_price_id == previous_price_id
                )
            ) if previous_price_id else None

            if (
                old_stripe_sub.get("status")
                != "canceled"
                or old_customer
                != existing.stripe_customer_id
                or metadata.get("user_id") not in (None, str(user.id))
                or previous_plan is None
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Previous Stripe subscription "
                        "is not fully canceled"
                    ),
                )

            if expired_subscription:
                existing.status = "canceled"
                existing.cancel_at_period_end = False
                db.commit()

        # Payment must be verified before
        # activating the selected paid plan.

    # =====================================
    # 3. REUSE UNFINISHED CHECKOUT
    # =====================================

    pending = db.scalars(
        select(Payment)
        .where(
            Payment.user_id == user.id,
            Payment.status == "pending",
            Payment.stripe_checkout_session_id.is_not(None)
        )
        .order_by(Payment.id.desc())
    ).all()

    try:

        for payment in pending:

            old_session = (
                stripe.checkout.Session.retrieve(
                    payment.stripe_checkout_session_id
                )
            )

            if old_session.status == "complete":
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Previous checkout completed. "
                        "Payment verification is pending."
                    )
                )

            if old_session.status == "open":

                # Verify checkout ownership.

                if (
                    old_session.client_reference_id
                    != str(user.id)
                ):
                    raise HTTPException(
                        status_code=403,
                        detail="Checkout ownership mismatch"
                    )

                # Reuse Checkout for the same plan.

                if payment.plan_id == plan.id:
                    return {
                        "checkout_url": old_session.url,
                        "session_id": old_session.id
                    }

                # Expire Checkout for a different plan.

                stripe.checkout.Session.expire(
                    old_session.id
                )

        # =====================================
        # 4. PREPARE STRIPE CUSTOMER
        # =====================================

        customer_data = {
            "customer_email": user.email
        }

        if existing and existing.stripe_customer_id:
            customer_data = {
                "customer": existing.stripe_customer_id
            }

        # =====================================
        # 5. STRIPE TEST CLOCK
        # =====================================

        test_email = os.getenv(
            "ADVOCANOTE_TEST_LAWYER_EMAIL", ""
        ).strip().lower()

        test_customer_id = os.getenv(
            "ADVOCANOTE_TEST_CUSTOMER_ID", ""
        ).strip()

        test_clock_id = os.getenv(
            "ADVOCANOTE_TEST_CLOCK_ID", ""
        ).strip()

        if (
            test_email
            and user.email.strip().lower() == test_email
        ):

            if not settings.STRIPE_SECRET_KEY.startswith(
                "sk_test_"
            ):
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "Test Clock requires "
                        "Stripe Test Mode"
                    )
                )

            if not test_customer_id or not test_clock_id:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Test Clock configuration "
                        "is incomplete"
                    )
                )

            if (
                existing
                and existing.stripe_customer_id
                and existing.stripe_customer_id
                != test_customer_id
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Lawyer already has "
                        "another Stripe customer"
                    )
                )

            customer = stripe.Customer.retrieve(
                test_customer_id
            ).to_dict()

            if (
                customer.get("deleted")
                or customer.get("livemode") is not False
                or customer.get("test_clock") != test_clock_id
            ):
                raise HTTPException(
                    status_code=409,
                    detail="Invalid Test Clock customer"
                )

            customer_email = (
                customer.get("email") or ""
            ).strip().lower()

            if (
                customer_email
                and customer_email != test_email
            ):
                raise HTTPException(
                    status_code=409,
                    detail="Test Customer email mismatch"
                )

            customer_data = {
                "customer": test_customer_id
            }

        # =====================================
        # 6. CREATE STRIPE CHECKOUT
        # =====================================

        base_url = settings.FRONTEND_URL.rstrip("/")

        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[
                {
                    "price": plan.stripe_price_id,
                    "quantity": 1
                }
            ],
            client_reference_id=str(user.id),
            customer_update={
                "address": "auto"
            } if "customer" in customer_data else None,
            metadata={
                "user_id": str(user.id),
                "plan_id": str(plan.id)
            },
            subscription_data={
                "metadata": {
                    "user_id": str(user.id),
                    "plan_id": str(plan.id)
                }
            },
            success_url=(
                f"{base_url}/subscription/success"
                "?session_id={CHECKOUT_SESSION_ID}"
            ),
            cancel_url=(
                f"{base_url}/subscription/cancel"
            ),
            **customer_data
        )

    except stripe.error.StripeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to create Stripe Checkout"
        ) from exc

    # =====================================
    # 7. SAVE PENDING PAYMENT
    # =====================================

    payment = Payment(
        user_id=user.id,
        subscription_id=(
            existing.id if existing else None
        ),
        plan_id=plan.id,
        amount=plan.price,
        currency=plan.currency,
        provider="stripe",
        status="pending",
        stripe_checkout_session_id=session.id
    )

    db.add(payment)

    try:
        db.commit()

    except Exception:
        db.rollback()

        try:
            stripe.checkout.Session.expire(
                session.id
            )

        except stripe.error.StripeError:
            pass

        raise HTTPException(
            status_code=503,
            detail=(
                "Checkout record could not be saved"
            )
        )

    # =====================================
    # 8. RETURN CHECKOUT DETAILS
    # =====================================

    return {
        "checkout_url": session.url,
        "session_id": session.id
    }

# =====================================
# LAWYER PAYMENT HISTORY
# =====================================

@router.get("/payments")
def get_my_payments(
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer)
):

    payments = db.scalars(
        select(Payment)
        .where(Payment.user_id == user.id)
        .order_by(
            Payment.created_at.desc(),
            Payment.id.desc()
        )
    ).all()

    return [
        {
            "id": payment.id,
            "plan_id": payment.plan_id,
            "amount": str(payment.amount),
            "currency": payment.currency,
            "status": payment.status,
            "created_at": payment.created_at,
            "paid_at": payment.paid_at,
        }
        for payment in payments
    ]

# =====================================
# LAWYER - MANAGE SUBSCRIPTION
# =====================================

@router.post("/manage")
def manage_subscription(
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer),
):

    subscription = db.scalar(
        select(Subscription).where(
            Subscription.user_id == user.id
        )
    )

    if (
        subscription is None
        or not subscription.stripe_customer_id
        or not subscription.stripe_subscription_id
    ):
        raise HTTPException(
            status_code=404,
            detail="No Stripe subscription found",
        )

    try:
        portal = stripe.billing_portal.Session.create(
            customer=subscription.stripe_customer_id,
            return_url=settings.FRONTEND_URL.rstrip("/"),
        )

    except stripe.error.StripeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to open Stripe Billing Portal",
        ) from exc

    return {
        "portal_url": portal.url
    }


# =====================================
# CHECK STRIPE CHECKOUT PAYMENT STATUS
# =====================================

@router.get("/checkout/status")
def get_checkout_payment_status(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer),
):

    # Only the logged-in lawyer's payment
    payment = db.scalar(
        select(Payment).where(
            Payment.stripe_checkout_session_id == session_id,
            Payment.user_id == user.id,
        )
    )

    if payment is None:
        raise HTTPException(
            status_code=404,
            detail="Checkout payment not found",
        )

    # Existing completed payment
    if payment.status == "paid":
        subscription = db.scalar(
            select(Subscription).where(
                Subscription.user_id == user.id
            )
        )

        return {
            "payment_status": "paid",
            "subscription_status": (
                subscription.status
                if subscription else "pending"
            ),
        }

    # Verify payment directly with Stripe
    try:
        checkout = stripe.checkout.Session.retrieve(
            session_id
        ).to_dict()

    except stripe.error.StripeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to verify Stripe Checkout",
        ) from exc

    metadata = checkout.get("metadata") or {}

    if (
        checkout.get("mode") != "subscription"
        or checkout.get("client_reference_id") != str(user.id)
        or metadata.get("user_id") != str(user.id)
        or metadata.get("plan_id") != str(payment.plan_id)
    ):
        raise HTTPException(
            status_code=403,
            detail="Checkout ownership mismatch",
        )

    # Payment not completed yet
    if (
        checkout.get("status") != "complete"
        or checkout.get("payment_status") != "paid"
    ):
        return {
            "payment_status": "pending",
            "subscription_status": "pending",
        }

    # Recover a successful Checkout using the
    # existing verified webhook processing logic.
    from app.routers.stripe_webhooks import (
        handle_checkout_completed,
    )

    try:
        handle_checkout_completed(checkout, db)

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Payment processing pending retry",
        ) from exc

    db.refresh(payment)

    subscription = db.scalar(
        select(Subscription).where(
            Subscription.user_id == user.id
        )
    )

    return {
        "payment_status": payment.status,
        "subscription_status": (
            subscription.status
            if subscription else "pending"
        ),
    }


# ==========================================
# CLEANUP UNFINISHED STRIPE CHECKOUTS
# ==========================================

@router.post("/payments/cleanup")
def cleanup_pending_checkouts(
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer),
):

    subscription = db.scalar(
        select(Subscription).where(
            Subscription.user_id == user.id
        )
    )

    has_active_subscription = bool(
        subscription
        and subscription.status == "active"
        and subscription.stripe_subscription_id
    )

    pending_payments = db.scalars(
        select(Payment).where(
            Payment.user_id == user.id,
            Payment.status == "pending",
            Payment.stripe_checkout_session_id.is_not(None),
        )
    ).all()

    expired_count = 0
    open_count = 0
    verification_pending = 0

    try:
        for payment in pending_payments:

            checkout = (
                stripe.checkout.Session.retrieve(
                    payment.stripe_checkout_session_id
                ).to_dict()
            )

            metadata = checkout.get("metadata") or {}

            # Never process another lawyer's checkout.
            if (
                checkout.get("client_reference_id") != str(user.id)
                or metadata.get("user_id") != str(user.id)
                or metadata.get("plan_id") != str(payment.plan_id)
            ):
                raise HTTPException(
                    status_code=409,
                    detail="Checkout ownership mismatch",
                )

            checkout_status = checkout.get("status")

            # Already expired in Stripe
            if checkout_status == "expired":
                payment.status = "expired"
                expired_count += 1
                continue

            # Completed checkout may need payment recovery.
            # Never mark it expired.
            if checkout_status == "complete":
                verification_pending += 1
                continue

            # Open checkout
            if checkout_status == "open":

                # If another paid subscription is active,
                # close this unused checkout.
                if has_active_subscription:

                    stripe.checkout.Session.expire(
                        payment.stripe_checkout_session_id
                    )

                    payment.status = "expired"
                    expired_count += 1

                else:
                    # Lawyer can still resume this checkout.
                    open_count += 1

    except stripe.error.StripeError as exc:
        db.rollback()

        raise HTTPException(
            status_code=502,
            detail="Unable to verify pending Stripe Checkout",
        ) from exc

    except HTTPException:
        db.rollback()
        raise

    try:
        db.commit()

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=503,
            detail="Checkout cleanup could not be saved",
        ) from exc

    return {
        "message": "Checkout cleanup completed",
        "expired": expired_count,
        "still_open": open_count,
        "verification_pending": verification_pending,
    }
    

# ==========================================
# CHECK SUBSCRIPTION PLAN CHANGE
# ==========================================

@router.post("/change-plan/check")
def check_plan_change(
    data: CheckoutRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer),
):

    # 1. Current subscription
    subscription = db.scalar(
        select(Subscription).where(
            Subscription.user_id == user.id
        )
    )

    if (
        subscription is None
        or subscription.status != "active"
        or not subscription.stripe_subscription_id
        or not subscription.stripe_customer_id
        or subscription.current_period_end is None
        or subscription.current_period_end <= utc_now()
    ):
        raise HTTPException(
            status_code=409,
            detail="No eligible active paid subscription",
        )

    # 2. Current plan
    current_plan = db.get(
        SubscriptionPlan,
        subscription.plan_id
    )

    if current_plan is None:
        raise HTTPException(
            status_code=404,
            detail="Current plan not found",
        )

    # 3. Target plan
    new_plan = db.get(
        SubscriptionPlan,
        data.plan_id
    )

    if (
        new_plan is None
        or not new_plan.is_active
        or not new_plan.stripe_price_id
    ):
        raise HTTPException(
            status_code=404,
            detail="Target plan not available",
        )

    # 4. Same plan not allowed
    if current_plan.id == new_plan.id:
        raise HTTPException(
            status_code=409,
            detail="You are already using this plan",
        )

    # 5. Currency validation
    if current_plan.currency != new_plan.currency:
        raise HTTPException(
            status_code=409,
            detail="Currency mismatch",
        )

    # 6. Cancellation already scheduled
    if subscription.cancel_at_period_end:
        raise HTTPException(
            status_code=409,
            detail="Subscription cancellation is scheduled",
        )

    return {
        "can_change": True,
        "current_plan": {
            "id": current_plan.id,
            "name": current_plan.name,
            "price": str(current_plan.price),
            "billing_interval": current_plan.billing_interval,
        },
        "new_plan": {
            "id": new_plan.id,
            "name": new_plan.name,
            "price": str(new_plan.price),
            "billing_interval": new_plan.billing_interval,
        },
        "billing_interval_changed": (
            current_plan.billing_interval
            != new_plan.billing_interval
        ),
        "message": (
            "Plan change is eligible for further verification. "
            "No payment or subscription has been changed."
        ),
    }


# ==========================================
# PREVIEW SUBSCRIPTION PLAN CHANGE
# ==========================================

def synchronize_current_stripe_plan(stripe_sub, subscription, db):
    from app.routers.stripe_webhooks import (
        get_plan_from_stripe_subscription,
        reconcile_paid_plan_upgrade,
        stripe_id,
    )

    if (
        stripe_id(stripe_sub.get("id")) != subscription.stripe_subscription_id
        or stripe_id(stripe_sub.get("customer")) != subscription.stripe_customer_id
        or (stripe_sub.get("metadata") or {}).get("user_id")
        not in (None, str(subscription.user_id))
        or stripe_sub.get("status") != "active"
    ):
        raise HTTPException(
            status_code=409, detail="Stripe subscription is not synchronized"
        )

    try:
        stripe_plan, item = get_plan_from_stripe_subscription(stripe_sub, db)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    if not item.get("id") or item.get("quantity") != 1:
        raise HTTPException(
            status_code=409, detail="Invalid Stripe subscription item"
        )

    if stripe_plan.id == subscription.plan_id:
        return stripe_plan, item, False

    reconcile_paid_plan_upgrade(stripe_sub, db)
    db.refresh(subscription)
    if subscription.plan_id != stripe_plan.id:
        if stripe_sub.get("schedule"):
            raise HTTPException(
                status_code=409,
                detail="A scheduled Stripe plan change is awaiting a matching paid invoice.",
            )

        raise HTTPException(
            status_code=409,
            detail="Stripe shows a different plan without a matching verified payment. Contact support to reconcile this subscription.",
        )

    return stripe_plan, item, True


@router.post("/change-plan/preview")
def preview_plan_change(
    data: CheckoutRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer),
):
    subscription = db.scalar(
        select(Subscription).where(Subscription.user_id == user.id)
    )

    if (
        subscription is None
        or not subscription.stripe_subscription_id
        or not subscription.stripe_customer_id
    ):
        raise HTTPException(
            status_code=409, detail="No eligible active paid subscription"
        )

    try:
        stripe_sub = stripe.Subscription.retrieve(
            subscription.stripe_subscription_id
        ).to_dict()
        current_plan, item, plan_changed = synchronize_current_stripe_plan(
            stripe_sub, subscription, db
        )

        if plan_changed and current_plan.id == data.plan_id:
            return {
                "can_change": False,
                "already_current": True,
                "message": "Your paid plan was verified and synchronized.",
            }

        check_plan_change(data, db, user)
        new_plan = db.get(SubscriptionPlan, data.plan_id)

        if (
            stripe_sub.get("pending_update")
            or stripe_sub.get("schedule")
            or stripe_sub.get("cancel_at_period_end")
        ):
            raise HTTPException(
                status_code=409, detail="Subscription has a pending change"
            )

        preview = stripe.Invoice.create_preview(
            customer=subscription.stripe_customer_id,
            subscription=subscription.stripe_subscription_id,
            subscription_details={
                "items": [
                    {
                        "id": item["id"],
                        "price": new_plan.stripe_price_id,
                        "quantity": 1,
                    }
                ],
                "proration_behavior": "always_invoice",
            },
        ).to_dict()

    
    except stripe.error.StripeError as exc:

        print(
            "STRIPE PREVIEW ERROR:",
            str(exc),
            flush=True,
        )

        print(
            "ERROR CODE:",
            getattr(exc, "code", None),
            flush=True,
        )

        print(
            "ERROR PARAM:",
            getattr(exc, "param", None),
            flush=True,
        )

        raise HTTPException(
            status_code=502,
            detail="Unable to preview Stripe billing",
        ) from exc


    currency = (preview.get("currency") or "").upper()

    if currency != new_plan.currency.upper():
        raise HTTPException(
            status_code=409,
            detail="Preview currency mismatch",
        )

    from decimal import Decimal

    def to_lkr(minor_units):
        return str(
            Decimal(minor_units) / Decimal("100")
        )

    # Estimated net proration before considering
    # other invoice items and applicable taxes.
    proration_minor = 0

    for line in (
        (preview.get("lines") or {}).get("data") or []
    ):
        parent = line.get("parent") or {}
        details = parent.get(
            "subscription_item_details"
        ) or {}

        if details.get("proration") or line.get("proration"):
            proration_minor += line.get("amount") or 0

    return {
        "can_change": True,
        "current_plan": current_plan.name,
        "new_plan": new_plan.name,
        "currency": currency,
        "estimated_net_proration": to_lkr(
            proration_minor
        ),
        "estimated_invoice_total": to_lkr(
            preview.get("total") or 0
        ),
        "message": (
            "Preview only. Invoice total may include "
            "other charges or renewal amounts. "
            "No payment or plan change has occurred."
        ),
    }


# ==========================================
# MONTHLY TO PRO - UPGRADE PAYMENT
# ==========================================

class UpgradePlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan_id: int = Field(gt=0)
    confirm: bool = False


@router.post("/change-plan/upgrade")
def upgrade_subscription(
    data: UpgradePlanRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer),
):

    # Explicit payment confirmation required
    if not data.confirm:
        raise HTTPException(
            status_code=400,
            detail="Confirm the upgrade payment first",
        )

    # Sandbox testing only
    if not settings.STRIPE_SECRET_KEY.startswith("sk_test_"):
        raise HTTPException(
            status_code=403,
            detail="Upgrade testing requires Stripe Test Mode",
        )

    # Reuse our existing plan eligibility check
    check_plan_change(
        CheckoutRequest(plan_id=data.plan_id),
        db,
        user,
    )

    subscription = db.scalar(
        select(Subscription).where(
            Subscription.user_id == user.id
        )
    )

    old_plan = db.get(
        SubscriptionPlan,
        subscription.plan_id,
    )

    new_plan = db.get(
        SubscriptionPlan,
        data.plan_id,
    )

    # Support higher-priced monthly upgrades only
    if (
        old_plan.billing_interval != "month"
        or new_plan.billing_interval != "month"
        or new_plan.price <= old_plan.price
    ):
        raise HTTPException(
            status_code=400,
            detail="Only monthly upgrades are supported",
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
            or metadata.get("user_id") != str(user.id)
            or metadata.get("plan_id") != str(old_plan.id)
            or stripe_sub.get("status") != "active"
        ):
            raise HTTPException(
                status_code=409,
                detail="Stripe subscription mismatch",
            )

        if (
            stripe_sub.get("pending_update")
            or stripe_sub.get("schedule")
            or stripe_sub.get("cancel_at_period_end")
        ):
            raise HTTPException(
                status_code=409,
                detail="Another subscription change is pending",
            )

        if stripe_sub.get("collection_method") != "charge_automatically":
            raise HTTPException(
                status_code=409,
                detail="Automatic payment collection is required",
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

        price = item.get("price") or {}
        price_id = (
            price.get("id")
            if isinstance(price, dict)
            else price
        )

        if (
            not item.get("id")
            or price_id != old_plan.stripe_price_id
            or item.get("quantity") != 1
        ):
            raise HTTPException(
                status_code=409,
                detail="Current Stripe plan mismatch",
            )

        # This creates an upgrade invoice and
        # attempts collection in Stripe Test Mode.
        # If payment fails, keep the plan change pending.
        updated = stripe.Subscription.modify(
            subscription.stripe_subscription_id,
            items=[
                {
                    "id": item["id"],
                    "price": new_plan.stripe_price_id,
                    "quantity": 1,
                }
            ],
            payment_behavior="pending_if_incomplete",
            proration_behavior="always_invoice",
        ).to_dict()

    except stripe.error.StripeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Stripe upgrade request failed",
        ) from exc

    invoice = updated.get("latest_invoice")
    invoice_id = (
        invoice.get("id")
        if isinstance(invoice, dict)
        else invoice
    )

    return {
        "message": "Stripe upgrade request submitted",
        "old_plan": old_plan.name,
        "requested_plan": new_plan.name,
        "stripe_status": updated.get("status"),
        "payment_pending": bool(
            updated.get("pending_update")
        ),
        "invoice_id": invoice_id,
        "note": (
            "Refresh subscription and payment history "
            "after webhook processing. Do not assume "
            "the upgrade is active yet."
        ),
    }
    
    
# ==========================================
# SCHEDULE MONTHLY PLAN DOWNGRADE
# ==========================================

class DowngradePlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan_id: int = Field(gt=0)
    confirm: bool = False


@router.post("/change-plan/downgrade")
def schedule_plan_downgrade(
    data: DowngradePlanRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer),
):

    # Lawyer must confirm
    if not data.confirm:
        raise HTTPException(
            status_code=400,
            detail="Confirm the downgrade first",
        )

    # Sandbox only
    if not settings.STRIPE_SECRET_KEY.startswith("sk_test_"):
        raise HTTPException(
            status_code=403,
            detail="Downgrade testing requires Stripe Test Mode",
        )

    # Existing eligibility check
    check_plan_change(
        CheckoutRequest(plan_id=data.plan_id),
        db,
        user,
    )

    subscription = db.scalar(
        select(Subscription).where(
            Subscription.user_id == user.id
        )
    )

    old_plan = db.get(
        SubscriptionPlan,
        subscription.plan_id,
    )

    new_plan = db.get(
        SubscriptionPlan,
        data.plan_id,
    )

    
    # Allow a lower-priced monthly downgrade,
    # or a switch between monthly and yearly billing.

    monthly_downgrade = (
        old_plan.billing_interval == "month"
        and new_plan.billing_interval == "month"
        and new_plan.price < old_plan.price
    )

    interval_change = (
        old_plan.billing_interval in ("month", "year")
        and new_plan.billing_interval in ("month", "year")
        and old_plan.billing_interval != new_plan.billing_interval
    )

    if not (monthly_downgrade or interval_change):
        raise HTTPException(
            status_code=400,
            detail="Unsupported plan change",
        )


    schedule_id = None

    try:
        stripe_sub = stripe.Subscription.retrieve(
            subscription.stripe_subscription_id
        ).to_dict()

        customer = stripe_sub.get("customer")
        if isinstance(customer, dict):
            customer = customer.get("id")

        metadata = stripe_sub.get("metadata") or {}

        if (
            stripe_sub.get("status") != "active"
            or customer != subscription.stripe_customer_id
            or metadata.get("user_id") != str(user.id)
            or metadata.get("plan_id") != str(old_plan.id)
        ):
            raise HTTPException(
                status_code=409,
                detail="Stripe subscription mismatch",
            )

        if (
            stripe_sub.get("schedule")
            or stripe_sub.get("pending_update")
            or stripe_sub.get("cancel_at_period_end")
        ):
            raise HTTPException(
                status_code=409,
                detail="Another subscription change is pending",
            )

        items = (
            (stripe_sub.get("items") or {})
            .get("data") or []
        )

        if len(items) != 1:
            raise HTTPException(
                status_code=409,
                detail="Invalid subscription items",
            )

        item = items[0]
        price = item.get("price") or {}

        current_price_id = (
            price.get("id")
            if isinstance(price, dict)
            else price
        )

        period_end = item.get("current_period_end")

        if (
            current_price_id != old_plan.stripe_price_id
            or item.get("quantity") != 1
            or not period_end
            or period_end <= int(
                datetime.now(timezone.utc).timestamp()
            )
        ):
            raise HTTPException(
                status_code=409,
                detail="Current billing period mismatch",
            )

        # Step 1: Create schedule from existing subscription
        schedule = stripe.SubscriptionSchedule.create(
            from_subscription=subscription.stripe_subscription_id
        ).to_dict()

        schedule_id = schedule["id"]

        current_phase = schedule.get("current_phase") or {}
        phase_start = current_phase.get("start_date")

        if not phase_start:
            raise ValueError("Missing schedule phase start")

        # Step 2: Keep Pro until current period end
        # Step 3: Switch to Monthly next period
        stripe.SubscriptionSchedule.modify(
            schedule_id,
            end_behavior="release",
            proration_behavior="none",
            phases=[
                {
                    "start_date": phase_start,
                    "end_date": period_end,
                    "items": [
                        {
                            "price": old_plan.stripe_price_id,
                            "quantity": 1,
                        }
                    ],
                },
                
{
    "start_date": period_end,

    "billing_cycle_anchor": (
        "phase_start"
        if interval_change
        else "automatic"
    ),

    "proration_behavior": "none",

    "duration": {
        "interval": new_plan.billing_interval,
        "interval_count": 1,
    },

                    "items": [
                        {
                            "price": new_plan.stripe_price_id,
                            "quantity": 1,
                        }
                    ],
                    "metadata": {
                        "user_id": str(user.id),
                        "plan_id": str(new_plan.id),
                    },
                },
            ],
        )

    except (stripe.error.StripeError, ValueError) as exc:

        print("========== DOWNGRADE ERROR ==========")
        print(type(exc).__name__, str(exc))

        # Undo a partially created schedule
        if schedule_id:
            try:
                stripe.SubscriptionSchedule.release(
                    schedule_id
                )
            except stripe.error.StripeError:
                pass

        raise HTTPException(
            status_code=502,
            detail="Unable to schedule downgrade. Verify Stripe state.",
        ) from exc

    return {
        "message": "Downgrade scheduled in Stripe",
        "current_plan": old_plan.name,
        "next_plan": new_plan.name,
        "effective_at": datetime.fromtimestamp(
            period_end,
            tz=timezone.utc,
        ).isoformat(),
        "schedule_id": schedule_id,
        "note": (
            "Current Pro plan remains active until period end. "
            "Database synchronization must be completed separately."
        ),
    }


# =====================================
# CANCEL SUBSCRIPTION AT PERIOD END
# =====================================

@router.post("/cancel")
def cancel_my_subscription(
    db: Session = Depends(get_db),
    user: User = Depends(require_lawyer),
):
    subscription = db.scalar(
        select(Subscription).where(
            Subscription.user_id == user.id
        )
    )

    if subscription is None:
        raise HTTPException(
            status_code=404,
            detail="No subscription found"
        )

    if subscription.cancel_at_period_end:
        return subscription_response(db, subscription)

    if (
        subscription.status not in ("active", "trialing")
        or not subscription.stripe_subscription_id
        or not subscription.stripe_customer_id
    ):
        raise HTTPException(
            status_code=409,
            detail="No eligible Stripe subscription"
        )

    plan = db.get(
        SubscriptionPlan,
        subscription.plan_id
    )

    if plan is None:
        raise HTTPException(
            status_code=409,
            detail="Subscription plan not found"
        )

    try:
        stripe_sub = stripe.Subscription.retrieve(
            subscription.stripe_subscription_id
        ).to_dict()

        customer = stripe_sub.get("customer")

        if isinstance(customer, dict):
            customer = customer.get("id")

        metadata = stripe_sub.get("metadata") or {}

        # Verify ownership before cancelling
        if (
            customer != subscription.stripe_customer_id
            or metadata.get("user_id") != str(user.id)
            or metadata.get("plan_id")
            != str(subscription.plan_id)
        ):
            raise HTTPException(
                status_code=409,
                detail="Stripe subscription mismatch"
            )

        if stripe_sub.get("status") not in (
            "active",
            "trialing",
        ):
            raise HTTPException(
                status_code=409,
                detail="Subscription is not active in Stripe"
            )

        # Prevent conflicts with pending plan changes
        if (
            stripe_sub.get("schedule")
            or stripe_sub.get("pending_update")
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "A subscription change is pending. "
                    "Please manage that change first."
                )
            )

        if not stripe_sub.get("cancel_at_period_end"):
            updated = stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                cancel_at_period_end=True
            ).to_dict()

            if not updated.get("cancel_at_period_end"):
                raise HTTPException(
                    status_code=502,
                    detail="Stripe did not confirm cancellation"
                )

    except stripe.error.StripeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to schedule cancellation in Stripe"
        ) from exc

    # Stripe has confirmed cancellation scheduling.
    # Keep paid status active until period end.
    subscription.cancel_at_period_end = True

    try:
        db.commit()
        db.refresh(subscription)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail=(
                "Stripe cancellation was scheduled, "
                "but database synchronization failed."
            )
        ) from exc

    return subscription_response(db, subscription)


    
    

