
# routes/subscription_billing.py

import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

# Change these imports to match your project
from app.database import get_db
from app.models.subscription import Subscription
from app.auth.security import get_current_user

router = APIRouter(
    prefix="/subscriptions",
    tags=["Subscription Billing"]
)


def find_subscription(db, user_id):
    return (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id)
        .order_by(Subscription.id.desc())
        .first()
    )


def to_response(sub):
    if sub is None:
        return {"subscription": None}

    return {
        "subscription": {
            "plan_name": sub.plan_name,
            "status": sub.status,
            "price_lkr": sub.price_lkr,
            "billing_cycle": sub.billing_cycle,
            "current_period_end": (
                sub.current_period_end.isoformat()
                if sub.current_period_end
                else None
            ),
            "cancel_at_period_end": (
                sub.cancel_at_period_end
            ),
        }
    }


@router.get("/me")
def get_my_subscription(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    sub = find_subscription(db, user.id)
    return to_response(sub)


@router.post("/cancel")
def cancel_my_subscription(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    sub = find_subscription(db, user.id)

    if not sub:
        raise HTTPException(
            status_code=404,
            detail="No subscription found."
        )

    if sub.cancel_at_period_end:
        return to_response(sub)

    if sub.status not in ("active", "trialing"):
        raise HTTPException(
            status_code=400,
            detail="Subscription cannot be cancelled."
        )

    if not sub.provider_subscription_id:
        raise HTTPException(
            status_code=409,
            detail="Payment subscription ID is missing."
        )

    # Example: Stripe payment gateway
    # Replace this section for another provider.

    if sub.payment_provider != "stripe":
        raise HTTPException(
            status_code=501,
            detail="Cancellation is not configured "
                   "for this payment provider."
        )

    secret_key = os.getenv("STRIPE_SECRET_KEY")

    if not secret_key:
        raise HTTPException(
            status_code=503,
            detail="Payment gateway is not configured."
        )

    import stripe
    stripe.api_key = secret_key

    try:
        updated = stripe.Subscription.modify(
            sub.provider_subscription_id,
            cancel_at_period_end=True
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not cancel renewal. "
                   "Please try again."
        ) from exc

    if not updated.cancel_at_period_end:
        raise HTTPException(
            status_code=502,
            detail="Cancellation was not confirmed "
                   "by the payment provider."
        )

    sub.cancel_at_period_end = True
    db.commit()
    db.refresh(sub)

    return to_response(sub)
