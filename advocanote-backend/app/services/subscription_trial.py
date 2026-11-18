
import calendar
import logging

from datetime import datetime, timezone
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
        "name": "Basic",
        "price": Decimal("1490.00"),
        "interval": "month",
        "daily_limit": 3,
    },
    "premium": {
        "id": 5,
        "name": "Premium",
        "price": Decimal("3290.00"),
        "interval": "month",
        "daily_limit": None,
    },
    "annual": {
        "id": 3,
        "name": "Annual",
        "price": Decimal("14900.00"),
        "interval": "year",
        "daily_limit": None,
    },
}

PLAN_BY_ID = {
    details["id"]: key
    for key, details in PLAN_SETTINGS.items()
}


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

    if (
        plan is None
        or not plan.is_active
        or plan.currency.upper() != "LKR"
        or plan.price != config["price"]
        or plan.billing_interval != config["interval"]
        or plan.daily_action_limit != config["daily_limit"]
    ):
        raise RuntimeError(
            f"{config['name']} plan is not "
            "configured correctly"
        )

    return plan


# ==========================================
# ADD EXACTLY ONE CALENDAR MONTH
# ==========================================

def add_one_calendar_month(
    start: datetime,
) -> datetime:

    year = start.year
    month = start.month + 1

    if month > 12:
        month = 1
        year += 1

    last_day = calendar.monthrange(
        year,
        month,
    )[1]

    return start.replace(
        year=year,
        month=month,
        day=min(start.day, last_day),
    )


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

            trial_end = add_one_calendar_month(
                now
            )

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
