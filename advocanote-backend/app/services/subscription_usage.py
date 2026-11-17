
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.subscription import Subscription
from app.models.subscription_plan import SubscriptionPlan
from app.models.subscription_daily_usage import (
    SubscriptionDailyUsage,
)


# ==========================================
# SRI LANKA TIMEZONE
# ==========================================

SRI_LANKA_TZ = ZoneInfo("Asia/Colombo")


def get_usage_date():
    return datetime.now(
        timezone.utc
    ).astimezone(SRI_LANKA_TZ).date()


def as_utc(value):
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


# ==========================================
# CHECK VALID SUBSCRIPTION
# ==========================================

def get_valid_subscription(db, user_id):

    subscription = db.scalar(
        select(Subscription).where(
            Subscription.user_id == user_id
        )
    )

    if subscription is None:
        raise HTTPException(
            status_code=403,
            detail="Subscription required",
        )

    if subscription.status == "trialing":
        expiry = subscription.trial_ends_at

    elif subscription.status == "active":
        expiry = subscription.current_period_end

    else:
        raise HTTPException(
            status_code=403,
            detail="Subscription inactive",
        )

    expiry = as_utc(expiry)

    if (
        expiry is None
        or expiry <= datetime.now(timezone.utc)
    ):
        raise HTTPException(
            status_code=403,
            detail="Subscription expired",
        )

    return subscription


# ==========================================
# USE ONE DAILY ACTION
# ==========================================

def consume_daily_action(
    db: Session,
    user_id: int,
):

    # Lock lawyer row so simultaneous requests
    # cannot exceed the daily action limit.

    user = db.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update()
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="Lawyer not found",
        )

    subscription = get_valid_subscription(
        db,
        user_id,
    )

    plan = db.get(
        SubscriptionPlan,
        subscription.plan_id,
    )

    if plan is None:
        raise HTTPException(
            status_code=403,
            detail="Subscription plan not found",
        )

    # Free trial = Unlimited
    if subscription.status == "trialing":
        return {
            "unlimited": True,
            "remaining": None,
        }

    limit = plan.daily_action_limit

    # Premium / Annual = Unlimited
    if limit is None:
        return {
            "unlimited": True,
            "remaining": None,
        }

    if limit < 1:
        raise HTTPException(
            status_code=403,
            detail="Invalid daily action limit",
        )

    today = get_usage_date()
    usage = db.scalar(
        select(SubscriptionDailyUsage)
        .where(
            SubscriptionDailyUsage.user_id == user_id,
            SubscriptionDailyUsage.usage_date == today,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )

    used = usage.actions_used if usage else 0

    # =====================================
    # DAILY LIMIT REACHED
    # =====================================

    if used >= limit:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "DAILY_ACTION_LIMIT_REACHED",
                "message": (
                    "You have reached your daily "
                    "action limit. Upgrade to "
                    "Premium or Annual for "
                    "unlimited access."
                ),
                "daily_limit": limit,
                "remaining": 0,
            },
        )

    # =====================================
    # RECORD ONE ACTION
    # =====================================

    if usage is None:
        usage = SubscriptionDailyUsage(
            user_id=user_id,
            usage_date=today,
            actions_used=1,
        )

        db.add(usage)

    else:
        usage.actions_used += 1

    # Do not commit here.
    # The calling endpoint must commit this
    # with the successful app operation.
    # Failed operations must roll back.

    db.flush()

    return {
        "unlimited": False,
        "daily_limit": limit,
        "actions_used": used + 1,
        "remaining": limit - (used + 1),
    }
