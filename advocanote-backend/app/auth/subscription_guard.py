
from datetime import datetime, timezone

from fastapi import Depends, HTTPException

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.security import get_current_user

from app.models.user import User
from app.models.subscription import Subscription
from app.models.subscription_plan import SubscriptionPlan


# ==========================================
# CHECK SUBSCRIPTION EXPIRY
# ==========================================

def is_subscription_valid(subscription, now):

    if subscription.status == "trialing":
        expiry = subscription.trial_ends_at

    elif subscription.status == "active":
        expiry = subscription.current_period_end

    else:
        return False

    if expiry is None:
        return False

    # Existing database stores UTC
    # datetimes without timezone information.

    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    else:
        expiry = expiry.astimezone(timezone.utc)

    return expiry > now


# ==========================================
# CHECK PLAN FEATURES
# ==========================================

def plan_has_feature(plan, feature_name):

    # All subscription plans provide
    # access to all application features.
    #
    # Basic, Premium, Annual and Trial
    # have the same available features.
    #
    # Daily usage restrictions are
    # checked separately.

    return plan is not None


# ==========================================
# LAWYER FEATURE PERMISSION
# ==========================================

def require_feature(feature_name: str):

    def check_feature_access(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):

        # ==================================
        # VERIFY LAWYER
        # ==================================

        if user.role != "lawyer" or not user.is_active:
            raise HTTPException(
                status_code=403,
                detail="Active lawyer account required",
            )

        # ==================================
        # GET LAWYER SUBSCRIPTION
        # ==================================

        subscription = db.scalar(
            select(Subscription)
            .where(
                Subscription.user_id == user.id
            )
        )

        if subscription is None:
            raise HTTPException(
                status_code=403,
                detail="Subscription required",
            )

        # ==================================
        # VERIFY SUBSCRIPTION EXPIRY
        # ==================================

        now = datetime.now(timezone.utc)

        if not is_subscription_valid(
            subscription,
            now
        ):
            raise HTTPException(
                status_code=403,
                detail="Subscription inactive or expired",
            )

        # ==================================
        # GET SUBSCRIPTION PLAN
        # ==================================

        plan = db.get(
            SubscriptionPlan,
            subscription.plan_id,
        )

        if plan is None:
            raise HTTPException(
                status_code=403,
                detail="Subscription plan not found",
            )

        # ==================================
        # ALL FEATURES AVAILABLE
        # ==================================

        if not plan_has_feature(
            plan,
            feature_name
        ):
            raise HTTPException(
                status_code=403,
                detail="Feature access denied",
            )

        # ==================================
        # RETURN VALID SUBSCRIPTION
        # ==================================

        # Keep returning Subscription
        # to preserve existing dependencies.

        return subscription

    return check_feature_access
