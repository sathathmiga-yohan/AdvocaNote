
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

    # Existing database stores naive UTC datetimes.
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    else:
        expiry = expiry.astimezone(timezone.utc)

    return expiry > now


# ==========================================
# CHECK PLAN FEATURES
# ==========================================

def plan_has_feature(plan, feature_name):

    if plan is None:
        return False

    features = plan.features or []

    # JSON list:
    # ["hearings", "tasks", "diary"]
    if isinstance(features, list):
        return feature_name in features

    # JSON object:
    # {"hearings": true, "tasks": true}
    if isinstance(features, dict):
        return features.get(feature_name) is True

    return False


# ==========================================
# LAWYER FEATURE PERMISSION
# ==========================================

def require_feature(feature_name: str):

    def check_feature_access(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):

        if user.role != "lawyer":
            raise HTTPException(
                status_code=403,
                detail="Lawyer access required",
            )

        # Fetch newest subscription records first.
        subscriptions = db.scalars(
            select(Subscription)
            .where(Subscription.user_id == user.id)
            .order_by(Subscription.id.desc())
        ).all()

        if not subscriptions:
            raise HTTPException(
                status_code=403,
                detail="Subscription required",
            )

        now = datetime.now(timezone.utc)

        # Pick the newest currently valid subscription.
        subscription = next(
            (
                item
                for item in subscriptions
                if is_subscription_valid(item, now)
            ),
            None,
        )

        if subscription is None:
            raise HTTPException(
                status_code=403,
                detail="Subscription inactive or expired",
            )

        plan = db.get(
            SubscriptionPlan,
            subscription.plan_id,
        )
        
        print("========== FEATURE ACCESS DEBUG ==========")
        print("Requested feature:", feature_name)
        print("Subscription ID:", subscription.id)
        print("Subscription status:", subscription.status)
        print("Subscription plan ID:", subscription.plan_id)
        print("Plan exists:", plan is not None)
        print("Plan features:", plan.features if plan else None)
        print("==========================================")


        if not plan_has_feature(plan, feature_name):
            raise HTTPException(
                status_code=403,
                detail="Feature not included in your plan",
            )

        return subscription
    
    return check_feature_access

   