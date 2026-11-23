
import logging

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal

from app.models.user import User
from app.models.subscription import Subscription
from app.models.subscription_plan import SubscriptionPlan

from admin_notifications_api import (
    notify_free_trial_started,
)


logger = logging.getLogger(__name__)


# ==========================================
# ADVOCANOTE OFFICIAL PLANS
# ==========================================

PLAN_SETTINGS = {
    "basic": {
        "id": 4,
        "name": "Monthly Subscription",
        "price": Decimal("2490.00"),
        "interval": "month",
        "daily_limit": 3,
    },
    "premium": {
        "id": 5,
        "name": "Premium Monthly Subscription",
        "price": Decimal("5100.00"),
        "interval": "month",
        "daily_limit": None,
    },
    "annual": {
        "id": 3,
        "name": "Annual Subscription",
        "price": Decimal("24900.00"),
        "interval": "year",
        "daily_limit": None,
    },
}

PLAN_BY_ID = {
    details["id"]: key
    for key, details in PLAN_SETTINGS.items()
}


# Original Test Mode prices still used by existing subscriptions and
# Checkout sessions opened before the catalog price change.
LEGACY_STRIPE_PLAN_PRICES = {
    "price_1UaTQURot5yvtQUpTkvQylUV": (PLAN_SETTINGS["basic"]["id"], Decimal("1490.00")),
    "price_1UabdZRot5yvtQUpjSkAW6fP": (PLAN_SETTINGS["premium"]["id"], Decimal("3290.00")),
    "price_1UaKFsRot5yvtQUpFcM1GPWO": (PLAN_SETTINGS["annual"]["id"], Decimal("14900.00")),
}


def stripe_price_matches_plan(price_id, plan):
    legacy = LEGACY_STRIPE_PLAN_PRICES.get(price_id)
    return bool(price_id) and (
        price_id == plan.stripe_price_id or (legacy is not None and legacy[0] == plan.id)
    )


def get_display_plan_name(plan: SubscriptionPlan | None):
    return plan.name if plan is not None else None


# ==========================================
# VERIFY EXISTING DATABASE PLANS
# ==========================================

def get_official_plan(
    db: Session,
    plan_key: str,
) -> SubscriptionPlan:

    config = PLAN_SETTINGS.get(plan_key)

    if config is None:
        raise ValueError(
            "Unknown subscription plan"
        )

    plan = db.get(
        SubscriptionPlan,
        config["id"],
    )

    # Paid price and usage limit changes do not affect free trial eligibility.
    if (
        plan is None
        or not plan.is_active
        or plan.currency.upper() != "LKR"
        or plan.billing_interval != config["interval"]
    ):
        raise RuntimeError(
            f"{config['name']} plan is not "
            "configured correctly"
        )

    return plan


# ==========================================
# START FREE TRIAL ONLY ONCE
# ==========================================

def start_free_trial_if_eligible(
    user_id: int,
) -> bool:

    with SessionLocal() as db:

        try:
            # Lock user to prevent duplicate
            # trial creation during concurrent login.

            user = db.scalar(
                select(User)
                .where(User.id == user_id)
                .with_for_update()
            )

            if user is None:
                return False

            # Start the free trial for an
            # active lawyer on first login.

            if (
                user.role != "lawyer"
                or not user.is_active
            ):
                return False

            # Never restart a used trial.
            # Never replace a paid subscription.

            existing = db.scalar(
                select(Subscription.id)
                .where(
                    Subscription.user_id == user.id
                )
            )

            if existing is not None:
                return False

            # Basic plan is linked to free trial.
            # Trial has unlimited actions.

            basic_plan = get_official_plan(
                db,
                "basic",
            )

            now = datetime.now(
                timezone.utc
            ).replace(tzinfo=None)

            trial_end = now + timedelta(days=30)

            subscription = Subscription(
                user_id=user.id,
                plan_id=basic_plan.id,
                status="trialing",
                trial_ends_at=trial_end,
                started_at=now,
                current_period_start=now,
                current_period_end=trial_end,
                cancel_at_period_end=False,
                stripe_customer_id=None,
                stripe_subscription_id=None,
            )

            db.add(subscription)

            # Save trial to MySQL first.
            db.commit()

            # ======================================
            # ADMIN NOTIFICATION - FREE TRIAL STARTED
            # ======================================

            try:
                db.refresh(subscription)

                notify_free_trial_started(
                    user=user,
                    subscription=subscription,
                )

                logger.info(
                    "Free trial notification created "
                    "for lawyer_id=%s",
                    user_id,
                )

            except Exception:
                # Notification failure must not
                # affect successful free trial.

                logger.exception(
                    "Failed to create free trial "
                    "notification for lawyer_id=%s",
                    user_id,
                )

            return True

        except Exception:
            db.rollback()
            raise
