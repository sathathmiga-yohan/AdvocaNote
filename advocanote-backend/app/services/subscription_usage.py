
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
        return value.replace(
            tzinfo=timezone.utc
        )

    return value.astimezone(timezone.utc)


# ==========================================
# CHECK VALID SUBSCRIPTION
# ==========================================

def get_valid_subscription(
    db: Session,
    user_id: int,
):

    subscription = db.scalar(
        select(Subscription)
        .where(Subscription.user_id == user_id)
        .with_for_update()
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
# CONSUME ONE DAILY DIARY ENTRY
# ==========================================

def consume_daily_action(
    db: Session,
    user_id: int,
):

    # Lock lawyer row to prevent
    # simultaneous requests from exceeding
    # the daily entry limit.

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

    if (
        user.role != "lawyer"
        or not user.is_active
    ):
        raise HTTPException(
            status_code=403,
            detail="Active lawyer account required",
        )

    # ======================================
    # VERIFY SUBSCRIPTION
    # ======================================

    subscription = get_valid_subscription(
        db=db,
        user_id=user_id,
    )

    # ======================================
    # GET CURRENT PLAN FROM DATABASE
    # ======================================

    plan = db.get(
        SubscriptionPlan,
        subscription.plan_id,
    )

    if plan is None:
        raise HTTPException(
            status_code=403,
            detail="Subscription plan not found",
        )

    # ======================================
    # FREE TRIAL - UNLIMITED
    # ======================================

    if subscription.status == "trialing":
        return {
            "unlimited": True,
            "daily_limit": None,
            "remaining": None,
        }

    # ======================================
    # DYNAMIC DAILY ENTRY LIMIT
    # ======================================

    # Read the limit from the selected plan.
    #
    # 3    = 3 entries per day
    # 5    = 5 entries per day
    # 10   = 10 entries per day
    # None = Unlimited
    #
    # Works for all admin-created plans.

    limit = plan.daily_action_limit

    # ======================================
    # UNLIMITED PAID PLAN
    # ======================================

    if limit is None:
        return {
            "unlimited": True,
            "daily_limit": None,
            "remaining": None,
        }

    if limit < 1:
        raise HTTPException(
            status_code=403,
            detail="Invalid daily entry limit",
        )

    # ======================================
    # GET TODAY'S USAGE
    # ======================================

    today = get_usage_date()

    usage = db.scalar(
        select(SubscriptionDailyUsage)
        .where(
            SubscriptionDailyUsage.user_id
            == user_id,

            SubscriptionDailyUsage.usage_date
            == today,
        )
        .with_for_update()
        .execution_options(
            populate_existing=True
        )
    )

    used = (
        usage.actions_used
        if usage else 0
    )

    # ======================================
    # DAILY LIMIT REACHED
    # ======================================

    if used >= limit:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "DAILY_ACTION_LIMIT_REACHED",
                "message": (
                    f"You have reached your daily "
                    f"limit of {limit} diary entries. "
                    "Choose an available upgrade "
                    "plan or continue tomorrow."
                ),
                "plan_id": plan.id,
                "plan_name": plan.name,
                "daily_limit": limit,
                "actions_used": used,
                "remaining": 0,
            },
        )

    # ======================================
    # RECORD ONE NEW DIARY ENTRY
    # ======================================

    if usage is None:
        usage = SubscriptionDailyUsage(
            user_id=user_id,
            usage_date=today,
            actions_used=1,
        )

        db.add(usage)

    else:
        usage.actions_used += 1

    # ======================================
    # SAVE WITH DIARY TRANSACTION
    # ======================================

    # Do not commit here.
    #
    # The diary creation endpoint must
    # commit the entry and usage together.
    #
    # If diary creation fails,
    # both changes must roll back.

    db.flush()

    # ======================================
    # RETURN UPDATED USAGE
    # ======================================

    return {
        "unlimited": False,
        "plan_id": plan.id,
        "plan_name": plan.name,
        "daily_limit": limit,
        "actions_used": used + 1,
        "remaining": (
            limit - (used + 1)
        ),
    }
