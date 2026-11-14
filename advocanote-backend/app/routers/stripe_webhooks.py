
import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from decimal import Decimal
from app.models.user import User
from app.config import settings
from app.database import get_db
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.models.subscription_plan import SubscriptionPlan


logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(
    prefix="/webhooks",
    tags=["Stripe Webhooks"],
)


# =====================================================
# HELPER FUNCTIONS
# =====================================================

def utc_datetime(timestamp):
    return datetime.fromtimestamp(
        timestamp,
        tz=timezone.utc
    ).replace(tzinfo=None)


def stripe_id(value):
    if isinstance(value, dict):
        return value.get("id")

    return value


# =====================================================
# CHECKOUT PAYMENT SUCCESS
# =====================================================

def handle_checkout_completed(checkout, db: Session):

    session_id = checkout.get("id")

    if checkout.get("mode") != "subscription":
        return

    # Payment complete ஆகியிருக்கிறதா?
    if checkout.get("payment_status") != "paid":
        logger.info(
            "Checkout payment not yet paid: %s",
            session_id,
        )
        return

    # Database Payment கண்டுபிடி
    payment = db.scalar(
        select(Payment).where(
            Payment.stripe_checkout_session_id == session_id
        )
    )

    if payment is None:
        metadata = checkout.get("metadata") or {}

        if (
            metadata.get("user_id")
            and metadata.get("plan_id")
        ):
            raise RuntimeError(
                "AdvocaNote payment record missing. "
                "Webhook needs retry."
            )

        logger.info(
            "Ignoring unrelated Checkout: %s",
            session_id,
        )
        return

    # Duplicate Processing தவிர்க்க
    if payment.status == "paid":
        return

    metadata = checkout.get("metadata") or {}

    if (
        checkout.get("client_reference_id")
        != str(payment.user_id)
        or metadata.get("user_id")
        != str(payment.user_id)
        or metadata.get("plan_id")
        != str(payment.plan_id)
    ):
        raise ValueError(
            "Checkout metadata mismatch"
        )

    # Subscription Plan
    plan = db.get(
        SubscriptionPlan,
        payment.plan_id
    )

    if plan is None or not plan.stripe_price_id:
        raise ValueError(
            "Invalid subscription plan"
        )

    stripe_subscription_id = stripe_id(
        checkout.get("subscription")
    )

    customer_id = stripe_id(
        checkout.get("customer")
    )

    if not stripe_subscription_id or not customer_id:
        raise ValueError(
            "Missing Stripe subscription or customer"
        )

    # Stripe Subscription Verify
    stripe_subscription = stripe.Subscription.retrieve(
        stripe_subscription_id
    ).to_dict()

    subscription_metadata = (
        stripe_subscription.get("metadata") or {}
    )

    if (
        stripe_id(
            stripe_subscription.get("customer")
        ) != customer_id
        or subscription_metadata.get("user_id")
        != str(payment.user_id)
        or subscription_metadata.get("plan_id")
        != str(payment.plan_id)
    ):
        raise ValueError(
            "Stripe subscription metadata mismatch"
        )

    items = (
        stripe_subscription
        .get("items", {})
        .get("data", [])
    )

    matching_items = [
        item
        for item in items
        if stripe_id(
            item.get("price", {}).get("id")
        ) == plan.stripe_price_id
    ]

    if len(matching_items) != 1:
        raise ValueError(
            "Stripe subscription price mismatch"
        )

    # Subscription Active?
    if stripe_subscription.get("status") != "active":
        logger.info(
            "Stripe subscription is not active yet"
        )
        return

    item = matching_items[0]

    period_start = item.get(
        "current_period_start"
    )

    period_end = item.get(
        "current_period_end"
    )

    if not period_start or not period_end:
        raise ValueError(
            "Missing Stripe billing period"
        )

    if utc_datetime(period_end) <= datetime.utcnow():
        logger.info(
            "Stripe billing period has ended"
        )
        return

    # Existing Lawyer Subscription
    subscription = db.scalar(
        select(Subscription).where(
            Subscription.user_id == payment.user_id
        )
    )

    if subscription is None:

        subscription = Subscription(
            user_id=payment.user_id,
            plan_id=payment.plan_id,
            status="pending",
        )

        db.add(subscription)
        db.flush()

    # =================================================
    # UPDATE SUBSCRIPTION
    # =================================================

    subscription.plan_id = payment.plan_id

    subscription.status = "active"

    subscription.stripe_customer_id = customer_id

    subscription.stripe_subscription_id = (
        stripe_subscription_id
    )

    subscription.current_period_start = (
        utc_datetime(period_start)
    )

    subscription.current_period_end = (
        utc_datetime(period_end)
    )

    subscription.started_at = (
        subscription.started_at
        or utc_datetime(period_start)
    )

    subscription.trial_ends_at = None

    subscription.cancel_at_period_end = bool(
        stripe_subscription.get(
            "cancel_at_period_end",
            False
        )
    )

    # =================================================
    # UPDATE PAYMENT
    # =================================================

    payment.subscription_id = subscription.id

    payment.status = "paid"

    payment.paid_at = datetime.utcnow()

    payment.stripe_invoice_id = stripe_id(
        stripe_subscription.get("latest_invoice")
    )

    db.commit()

    logger.info(
        "AdvocaNote subscription activated for user_id=%s",
        payment.user_id,
    )


# =====================================================
# INVOICE SUBSCRIPTION ID
# =====================================================

def get_invoice_subscription_id(invoice):

    parent = invoice.get("parent") or {}

    details = (
        parent.get("subscription_details") or {}
    )

    return stripe_id(
        invoice.get("subscription")
        or details.get("subscription")
    )
    

# ==========================================
# VERIFY SUCCESSFUL UPGRADE PAYMENT
# ==========================================

def verify_paid_upgrade_invoice(invoice_id, db: Session):

    # 1. Get invoice directly from Stripe
    invoice = stripe.Invoice.retrieve(
        invoice_id
    ).to_dict()

    # Only handle subscription plan changes
    if invoice.get("billing_reason") != "subscription_update":
        raise ValueError("Not a plan-change invoice")

    # Verify successful payment
    if (
        invoice.get("status") != "paid"
        or invoice.get("paid_out_of_band")
    ):
        raise ValueError(
            "Upgrade invoice is not verified paid"
        )

    # 2. Get Stripe subscription ID
    stripe_sub_id = get_invoice_subscription_id(
        invoice
    )

    if not stripe_sub_id:
        raise ValueError(
            "Missing Stripe subscription ID"
        )

    # 3. Find subscription in MySQL
    subscription = db.scalar(
        select(Subscription).where(
            Subscription.stripe_subscription_id
            == stripe_sub_id
        )
    )

    if subscription is None:
        raise ValueError(
            "AdvocaNote subscription not found"
        )

    # 4. Retrieve current Stripe subscription
    stripe_sub = stripe.Subscription.retrieve(
        stripe_sub_id
    ).to_dict()

    # 5. Verify Stripe customer
    if (
        stripe_id(stripe_sub.get("customer"))
        != subscription.stripe_customer_id
        or stripe_id(invoice.get("customer"))
        != subscription.stripe_customer_id
    ):
        raise ValueError(
            "Stripe customer mismatch"
        )

    # 6. Verify lawyer
    metadata = stripe_sub.get("metadata") or {}

    if metadata.get("user_id") != str(
        subscription.user_id
    ):
        raise ValueError(
            "Lawyer mismatch"
        )

    # 7. Find the new plan using Stripe Price ID
    new_plan, item = (
        get_plan_from_stripe_subscription(
            stripe_sub,
            db,
        )
    )

    # 8. Find existing plan
    old_plan = db.get(
        SubscriptionPlan,
        subscription.plan_id,
    )

    if old_plan is None:
        raise ValueError(
            "Current plan not found"
        )

    # Verify metadata during plan transition
    if metadata.get("plan_id") not in (
        str(old_plan.id),
        str(new_plan.id),
    ):
        raise ValueError(
            "Plan metadata mismatch"
        )

    # 9. Verify that Stripe applied the change
    if (
        stripe_sub.get("status") != "active"
        or stripe_sub.get("pending_update")
        or stripe_id(stripe_sub.get("latest_invoice"))
        != invoice_id
    ):
        raise ValueError(
            "Upgrade not fully applied in Stripe"
        )

    # 10. Verify currency
    if (
        new_plan.currency.upper()
        != (invoice.get("currency") or "").upper()
    ):
        raise ValueError(
            "Currency mismatch"
        )

    # 11. Validate paid amount
    amount_paid = invoice.get("amount_paid")

    if (
        not isinstance(amount_paid, int)
        or amount_paid < 0
    ):
        raise ValueError(
            "Invalid invoice amount"
        )

    # Return verified information
    return {
        "subscription": subscription,
        "old_plan": old_plan,
        "new_plan": new_plan,
        "stripe_subscription": stripe_sub,
        "stripe_item": item,
        "invoice": invoice,
    }



def handle_invoice_paid(invoice, db: Session):

    invoice_id = invoice.get("id")

    if not invoice_id:
        raise ValueError("Missing Stripe invoice ID")

    # Verify actual paid invoice
    paid_invoice = stripe.Invoice.retrieve(
        invoice_id
    ).to_dict()

    if paid_invoice.get("billing_reason") != "subscription_cycle":
        return

    if (
        paid_invoice.get("status") != "paid"
        or paid_invoice.get("paid_out_of_band")
    ):
        return

    sub_id = get_invoice_subscription_id(paid_invoice)

    if not sub_id:
        raise ValueError("Renewal invoice missing subscription ID")

    # Lock MySQL subscription
    subscription = db.scalar(
        select(Subscription)
        .where(
            Subscription.stripe_subscription_id == sub_id
        )
        .with_for_update()
    )

    if subscription is None:
        logger.warning("Unknown subscription: %s", sub_id)
        return

    # Verify Stripe customer
    stripe_sub = stripe.Subscription.retrieve(
        sub_id
    ).to_dict()

    customer_id = stripe_id(
        stripe_sub.get("customer")
    )

    if (
        customer_id != subscription.stripe_customer_id
        or customer_id != stripe_id(
            paid_invoice.get("customer")
        )
    ):
        raise ValueError("Stripe customer mismatch")

    metadata = stripe_sub.get("metadata") or {}

    if metadata.get("user_id") != str(subscription.user_id):
        raise ValueError("Subscription user mismatch")

    # Find current Stripe plan
    new_plan, item = get_plan_from_stripe_subscription(
        stripe_sub,
        db,
    )

    old_plan = db.get(
        SubscriptionPlan,
        subscription.plan_id,
    )

    if old_plan is None:
        raise ValueError("Current plan not found")

    if metadata.get("plan_id") != str(new_plan.id):
        raise ValueError("Stripe plan metadata mismatch")

    if stripe_sub.get("status") != "active":
        return

    # Ignore older invoices
    if stripe_id(stripe_sub.get("latest_invoice")) != invoice_id:
        logger.info("Ignoring old invoice: %s", invoice_id)
        return

    # Verify payment amount and currency
    currency = (
        paid_invoice.get("currency") or ""
    ).upper()

    amount_minor = paid_invoice.get("amount_paid")

    if (
        currency != "LKR"
        or currency != new_plan.currency.upper()
        or not isinstance(amount_minor, int)
        or amount_minor < 0
    ):
        raise ValueError(
            "Invalid paid invoice amount or currency"
        )

    # Get paid renewal period
    item_id = stripe_id(item.get("id"))

    invoice_lines = (
        (paid_invoice.get("lines") or {})
        .get("data") or []
    )

    periods = []

    for line in invoice_lines:

        parent = line.get("parent") or {}

        if parent.get("type") != "subscription_item_details":
            continue

        details = parent.get("subscription_item_details") or {}

        if details.get("proration"):
            continue

        if stripe_id(details.get("subscription")) != sub_id:
            continue

        if stripe_id(details.get("subscription_item")) != item_id:
            continue

        period = line.get("period") or {}

        if period.get("start") and period.get("end"):
            periods.append(period)

    if len(periods) != 1:
        raise ValueError(
            "Expected one renewal invoice period"
        )

    new_start = utc_datetime(periods[0]["start"])
    new_end = utc_datetime(periods[0]["end"])

    if (
        new_end <= new_start
        or new_end <= datetime.utcnow()
    ):
        raise ValueError("Invalid billing period")

    
    # Validate scheduled plan change
    is_plan_change = new_plan.id != old_plan.id

    if is_plan_change:
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

        if (
            not (monthly_downgrade or interval_change)
            or subscription.current_period_end is None
            or new_start < subscription.current_period_end
        ):
            raise ValueError(
                "Unexpected plan change at renewal"
            )


    # Do not process the same paid period again
    if (
        subscription.current_period_end is not None
        and new_end <= subscription.current_period_end
    ):
        logger.info(
            "Renewal period already handled: %s",
            invoice_id,
        )
        return

    # Check existing invoice payment
    payment = db.scalar(
        select(Payment)
        .where(
            Payment.stripe_invoice_id == invoice_id
        )
        .with_for_update()
    )

    amount = Decimal(amount_minor) / Decimal("100")

    if payment is None:

        payment = Payment(
            user_id=subscription.user_id,
            subscription_id=subscription.id,
            plan_id=new_plan.id,
            amount=amount,
            currency=currency,
            provider="stripe",
            status="paid",
            stripe_invoice_id=invoice_id,
            paid_at=datetime.utcnow(),
        )

        db.add(payment)

    else:

        if (
            payment.user_id != subscription.user_id
            or payment.subscription_id != subscription.id
            or payment.plan_id != new_plan.id
            or payment.provider != "stripe"
        ):
            raise ValueError(
                "Invoice payment ownership mismatch"
            )

        if payment.status == "paid":
            raise ValueError(
                "Paid invoice exists without period sync"
            )

        payment.status = "paid"
        payment.amount = amount
        payment.currency = currency

        payment.paid_at = (
            payment.paid_at or datetime.utcnow()
        )

    # Update MySQL after successful renewal
    subscription.plan_id = new_plan.id
    subscription.status = "active"

    subscription.current_period_start = new_start
    subscription.current_period_end = new_end

    subscription.cancel_at_period_end = bool(
        stripe_sub.get("cancel_at_period_end", False)
    )

    # Save payment and subscription together
    db.commit()

    logger.info(
        "Renewal paid: user_id=%s plan_id=%s invoice=%s",
        subscription.user_id,
        new_plan.id,
        invoice_id,
    )

def handle_subscription_deleted(event_sub, db: Session):

    sub_id = stripe_id(event_sub.get("id"))

    if not sub_id:
        raise ValueError("Missing subscription ID")

    stripe_sub = stripe.Subscription.retrieve(
        sub_id
    ).to_dict()

    if stripe_sub.get("status") != "canceled":
        return

    subscription = db.scalar(
        select(Subscription)
        .where(
            Subscription.stripe_subscription_id == sub_id
        )
        .with_for_update()
    )

    if subscription is None:
        logger.info("Unknown canceled subscription")
        return

    if (
        stripe_id(stripe_sub.get("customer"))
        != subscription.stripe_customer_id
    ):
        raise ValueError("Customer mismatch")

    metadata = stripe_sub.get("metadata") or {}

    if (
        metadata.get("user_id") != str(subscription.user_id)
        or metadata.get("plan_id") != str(subscription.plan_id)
    ):
        raise ValueError("Subscription metadata mismatch")

    subscription.status = "canceled"
    subscription.cancel_at_period_end = False

    db.commit()

    logger.info(
        "Subscription canceled: user_id=%s",
        subscription.user_id,
    )    
    

# =====================================================
# STRIPE WEBHOOK API
# =====================================================


# ==========================================
# RENEWAL / DOWNGRADE PAYMENT FAILED
# ==========================================

def handle_invoice_payment_failed(
    event_invoice,
    db: Session,
):

    invoice_id = event_invoice.get("id")

    if not invoice_id:
        raise ValueError("Missing Stripe invoice ID")

    # Verify invoice with Stripe
    invoice = stripe.Invoice.retrieve(
        invoice_id
    ).to_dict()

    # Renewal invoice only
    if invoice.get("billing_reason") != "subscription_cycle":
        return

    if invoice.get("status") != "open":
        return

    sub_id = get_invoice_subscription_id(invoice)

    if not sub_id:
        raise ValueError("Missing subscription ID")

    # Lock MySQL subscription
    subscription = db.scalar(
        select(Subscription)
        .where(
            Subscription.stripe_subscription_id == sub_id
        )
        .with_for_update()
    )

    if subscription is None:
        logger.warning(
            "Unknown subscription for invoice %s",
            invoice_id,
        )
        return

    stripe_sub = stripe.Subscription.retrieve(
        sub_id
    ).to_dict()

    customer_id = stripe_id(
        stripe_sub.get("customer")
    )

    if (
        customer_id != subscription.stripe_customer_id
        or customer_id != stripe_id(
            invoice.get("customer")
        )
    ):
        raise ValueError("Stripe customer mismatch")

    metadata = stripe_sub.get("metadata") or {}

    if metadata.get("user_id") != str(subscription.user_id):
        raise ValueError("Subscription user mismatch")

    # Verify current invoice
    if (
        stripe_id(stripe_sub.get("latest_invoice"))
        != invoice_id
    ):
        return

    # Find actual plan from Stripe Price ID
    new_plan, item = get_plan_from_stripe_subscription(
        stripe_sub,
        db,
    )

    old_plan = db.get(
        SubscriptionPlan,
        subscription.plan_id,
    )

    if old_plan is None:
        raise ValueError("Previous plan not found")

    if metadata.get("plan_id") != str(new_plan.id):
        raise ValueError("Plan metadata mismatch")

    
    # Allow scheduled monthly downgrade or billing interval change
    if new_plan.id != old_plan.id:

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
            raise ValueError(
                "Unexpected plan transition"
            )


    # Validate amount
    currency = (
        invoice.get("currency") or ""
    ).upper()

    amount_due = invoice.get("amount_due")

    if (
        currency != "LKR"
        or currency != new_plan.currency.upper()
        or not isinstance(amount_due, int)
        or amount_due < 0
    ):
        raise ValueError(
            "Invalid invoice amount or currency"
        )

    amount = Decimal(amount_due) / Decimal("100")

    # Existing payment check
    payment = db.scalar(
        select(Payment)
        .where(
            Payment.stripe_invoice_id == invoice_id
        )
        .with_for_update()
    )

    if payment is None:

        payment = Payment(
            user_id=subscription.user_id,
            subscription_id=subscription.id,
            plan_id=new_plan.id,
            amount=amount,
            currency=currency,
            provider="stripe",
            status="failed",
            stripe_invoice_id=invoice_id,
        )

        db.add(payment)

    else:

        if (
            payment.user_id != subscription.user_id
            or payment.subscription_id != subscription.id
            or payment.plan_id != new_plan.id
            or payment.provider != "stripe"
        ):
            raise ValueError(
                "Invoice ownership mismatch"
            )

        # Never overwrite successful payments
        if payment.status == "paid":
            return

        payment.status = "failed"
        payment.amount = amount
        payment.currency = currency

    # Do not activate the new plan.
    # Do not extend the paid billing period.
    db.commit()

    logger.info(
        "Renewal payment failed: user_id=%s invoice=%s",
        subscription.user_id,
        invoice_id,
    )

# =====================================================
# STRIPE SUBSCRIPTION STATUS UPDATE
# =====================================================

def handle_subscription_updated(event_sub, db: Session):

    sub_id = stripe_id(event_sub.get("id"))

    if not sub_id:
        raise ValueError("Missing Stripe subscription ID")

    # Get latest subscription directly from Stripe
    stripe_sub = stripe.Subscription.retrieve(
        sub_id
    ).to_dict()

    # Find existing AdvocaNote subscription
    subscription = db.scalar(
        select(Subscription)
        .where(
            Subscription.stripe_subscription_id == sub_id
        )
        .with_for_update()
    )

    if subscription is None:
        logger.info(
            "Unknown subscription update: %s",
            sub_id,
        )
        return

    # Verify Stripe customer
    customer_id = stripe_id(
        stripe_sub.get("customer")
    )

    if customer_id != subscription.stripe_customer_id:
        raise ValueError("Stripe customer mismatch")

   
    # ==========================================
    # VERIFY LAWYER AND CURRENT STRIPE PLAN
    # ==========================================

    metadata = stripe_sub.get("metadata") or {}

    if metadata.get("user_id") != str(subscription.user_id):
        raise ValueError("Subscription user mismatch")

    # Find plan using actual Stripe Price ID
    stripe_plan, stripe_item = (
        get_plan_from_stripe_subscription(
            stripe_sub,
            db,
        )
    )

    # Accept old or new plan during transition
    if metadata.get("plan_id") not in (
        str(subscription.plan_id),
        str(stripe_plan.id),
    ):
        raise ValueError("Subscription plan metadata mismatch")

    # Do not activate new plan before payment verification
    if stripe_plan.id != subscription.plan_id:
        logger.info(
            "Plan change detected for user_id=%s. "
            "Waiting for payment verification.",
            subscription.user_id,
        )

    # Stripe subscription status
    stripe_status = stripe_sub.get("status")

    # Sync scheduled cancellation
    subscription.cancel_at_period_end = bool(
        stripe_sub.get(
            "cancel_at_period_end",
            False
        )
    )

    # Subscription fully canceled
    if stripe_status == "canceled":

        subscription.status = "canceled"
        subscription.cancel_at_period_end = False

    # Subscription no longer payable/usable
    elif stripe_status in (
        "unpaid",
        "paused",
        "incomplete_expired"
    ):

        subscription.status = stripe_status
        
    
    elif stripe_status == "past_due":

        # Preserve access for an already-paid period.
        # Do not extend access without a paid invoice.
        if (
            subscription.current_period_end is None
            or subscription.current_period_end <= datetime.utcnow()
        ):
            subscription.status = "past_due"



    # IMPORTANT:
    # Do not extend subscription dates here.
    # Successful invoice.paid handles paid renewals.

    db.commit()

    logger.info(
        "Subscription state synced: user_id=%s status=%s",
        subscription.user_id,
        stripe_status,
    )


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):

    payload = await request.body()

    signature = request.headers.get(
        "stripe-signature"
    )

    if not signature:
        raise HTTPException(
            status_code=400,
            detail="Missing Stripe signature",
        )

    # =================================================
    # VERIFY STRIPE SIGNATURE
    # =================================================

    try:

        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=signature,
            secret=settings.STRIPE_WEBHOOK_SECRET,
        )

    except ValueError:

        raise HTTPException(
            status_code=400,
            detail="Invalid webhook payload",
        )

    except stripe.error.SignatureVerificationError:

        raise HTTPException(
            status_code=400,
            detail="Invalid Stripe signature",
        )

    event_type = event["type"]

    logger.info(
        "Stripe event received: %s",
        event_type,
    )

    # =================================================
    # FIRST CHECKOUT PAYMENT
    # =================================================

    if event_type == "checkout.session.completed":

        try:

            handle_checkout_completed(
                event["data"]["object"].to_dict(),
                db,
            )

        except Exception:

            db.rollback()

            logger.exception(
                "Stripe checkout processing failed"
            )

            raise HTTPException(
                status_code=500,
                detail="Webhook processing failed",
            )

    # =================================================
    # MONTHLY / YEARLY RENEWAL
    # =================================================

    
    elif event_type == "invoice.paid":

        try:
            invoice = event["data"]["object"].to_dict()

            billing_reason = invoice.get("billing_reason")

            # Monthly / Annual renewal payment
            if billing_reason == "subscription_cycle":
                handle_invoice_paid(
                    invoice,
                    db,
                )

            # Monthly to Pro upgrade payment
            elif billing_reason == "subscription_update":
                handle_paid_plan_upgrade(
                    invoice["id"],
                    db,
                )


        except Exception:

            db.rollback()

            logger.exception(
                "Stripe renewal processing failed"
            )

            raise HTTPException(
                status_code=500,
                detail="Renewal processing failed",
            )

    elif event_type == "customer.subscription.deleted":

        try:
            handle_subscription_deleted(
                event["data"]["object"].to_dict(),
                db,
            )

        except Exception:
            db.rollback()
            logger.exception(
                "Subscription cancellation failed"
            )

            raise HTTPException(
                status_code=500,
                detail="Cancellation processing failed",
            )


    # MONTHLY PAYMENT FAILED
    elif event_type == "invoice.payment_failed":

        try:
            handle_invoice_payment_failed(
                event["data"]["object"].to_dict(),
                db,
            )

        except Exception:
            db.rollback()

            logger.exception(
                "Renewal payment failure processing failed"
            )

            raise HTTPException(
                status_code=500,
                detail="Payment failure processing failed",
            )


    # ==============================================
    # SUBSCRIPTION UPDATED
    # ==============================================

    elif event_type == "customer.subscription.updated":

        try:
            handle_subscription_updated(
                event["data"]["object"].to_dict(),
                db,
            )

        except Exception:
            db.rollback()

            logger.exception(
                "Subscription update processing failed"
            )

            raise HTTPException(
                status_code=500,
                detail="Subscription update processing failed",
            )

    return {"received": True}


# ==========================================
# FIND PLAN FROM STRIPE SUBSCRIPTION PRICE
# ==========================================

def get_plan_from_stripe_subscription(
    stripe_sub,
    db: Session,
):

    items = (
        (stripe_sub.get("items") or {})
        .get("data") or []
    )

    if len(items) != 1:
        raise ValueError(
            "Expected exactly one subscription item"
        )

    item = items[0]

    price_id = stripe_id(
        item.get("price")
    )

    if not price_id:
        raise ValueError(
            "Missing Stripe Price ID"
        )

    plan = db.scalar(
        select(SubscriptionPlan).where(
            SubscriptionPlan.stripe_price_id == price_id
        )
    )

    if plan is None:
        raise ValueError(
            "Stripe Price does not match any AdvocaNote Plan"
        )

    return plan, item



# ==========================================
# ACTIVATE PAID MONTHLY PLAN UPGRADE
# ==========================================

def handle_paid_plan_upgrade(invoice_id, db: Session):

    # Verify the actual paid Stripe invoice
    info = verify_paid_upgrade_invoice(
        invoice_id, db
    )

    subscription = info["subscription"]
    old_plan = info["old_plan"]
    new_plan = info["new_plan"]
    invoice = info["invoice"]
    stripe_sub = info["stripe_subscription"]
    item = info["stripe_item"]

    # Check whether invoice was already processed
    existing_payment = db.scalar(
        select(Payment).where(
            Payment.stripe_invoice_id == invoice_id
        )
    )

    if old_plan.id == new_plan.id:
        if (
            existing_payment
            and existing_payment.status == "paid"
        ):
            return

        raise ValueError(
            "No new plan change to activate"
        )

    # Support monthly upgrades and Monthly to Yearly
    if not (
        (
            old_plan.billing_interval == "month"
            and new_plan.billing_interval == "month"
            and new_plan.price > old_plan.price
        )
        or (
            old_plan.billing_interval == "month"
            and new_plan.billing_interval == "year"
        )
    ):
        raise ValueError(
            "Unsupported immediate plan change"
        )

    if existing_payment is not None:
        raise ValueError(
            "Invoice payment already exists; reconciliation needed"
        )

    # Verify billing period
    period_start = item.get("current_period_start")
    period_end = item.get("current_period_end")

    if (
        not period_start
        or not period_end
        or period_end <= period_start
        or utc_datetime(period_end) <= datetime.utcnow()
    ):
        raise ValueError("Invalid Stripe billing period")

    # Amount actually paid, in LKR
    amount = (
        Decimal(invoice["amount_paid"])
        / Decimal("100")
    )

    # Keep Stripe metadata synchronized
    stripe.Subscription.modify(
        stripe_sub["id"],
        metadata={
            "user_id": str(subscription.user_id),
            "plan_id": str(new_plan.id),
        },
    )

    # Update MySQL subscription
    subscription.plan_id = new_plan.id
    subscription.status = "active"
    subscription.current_period_start = (
        utc_datetime(period_start)
    )
    subscription.current_period_end = (
        utc_datetime(period_end)
    )
    subscription.cancel_at_period_end = bool(
        stripe_sub.get("cancel_at_period_end", False)
    )

    # Save upgrade payment history
    payment = Payment(
        user_id=subscription.user_id,
        subscription_id=subscription.id,
        plan_id=new_plan.id,
        amount=amount,
        currency="LKR",
        provider="stripe",
        status="paid",
        stripe_invoice_id=invoice_id,
        paid_at=datetime.utcnow(),
    )

    db.add(payment)
    db.commit()

    logger.info(
        "Paid plan upgrade completed: user_id=%s plan_id=%s",
        subscription.user_id,
        new_plan.id,
    )
