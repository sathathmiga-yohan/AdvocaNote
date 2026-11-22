
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
from app.models.payment import Payment, SubscriptionUpgrade
from app.models.subscription import Subscription
from app.models.subscription_plan import SubscriptionPlan
from admin_notifications_api import (
    create_admin_notification,
    create_admin_notification_once,
)

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

def lock_checkout_upgrade(db, upgrade):
    # Use this lock order in checkout creation, webhook, and recovery.
    subscription = db.scalar(
        select(Subscription)
        .where(Subscription.id == upgrade.subscription_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    upgrade = db.scalar(
        select(SubscriptionUpgrade)
        .where(SubscriptionUpgrade.id == upgrade.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return subscription, upgrade


def retire_checkout_source(upgrade, db):
    subscription, upgrade = lock_checkout_upgrade(db, upgrade)
    if upgrade.status != "retiring":
        return

    if subscription.stripe_subscription_id != upgrade.replacement_stripe_subscription_id:
        raise ValueError("Upgrade replacement does not match the active subscription")

    source_id = upgrade.source_stripe_subscription_id
    source = stripe.Subscription.retrieve(source_id).to_dict()
    if stripe_id(source.get("customer")) != subscription.stripe_customer_id:
        raise ValueError("Upgrade source customer mismatch")

    if source.get("status") != "canceled":
        if source.get("cancel_at_period_end") and not subscription.cancel_at_period_end:
            # A cancellation scheduled through Manage Billing during Checkout
            # still applies after the paid replacement.
            replacement = stripe.Subscription.modify(
                upgrade.replacement_stripe_subscription_id, cancel_at_period_end=True
            )
            if not replacement.cancel_at_period_end:
                raise ValueError("Stripe did not preserve scheduled cancellation")
            subscription.cancel_at_period_end = True

        # No final invoice, unpaid time credit, or refund on the superseded plan.
        if stripe.Subscription.cancel(source_id, invoice_now=False, prorate=False).status != "canceled":
            raise ValueError("Stripe did not retire the old subscription")

    upgrade.status = "complete"
    db.commit()


def process_checkout_upgrade(upgrade, db):
    subscription, upgrade = lock_checkout_upgrade(db, upgrade)
    if upgrade.status in ("complete", "expired"):
        return upgrade.status

    if upgrade.status == "checkout":
        if not upgrade.stripe_checkout_session_id:
            return upgrade.status
        session_id = upgrade.stripe_checkout_session_id
        checkout = stripe.checkout.Session.retrieve(session_id).to_dict()
        expected_metadata = {
            "advocanote_upgrade": upgrade.attempt_key,
            "user_id": str(subscription.user_id),
            "plan_id": str(upgrade.target_plan_id),
        }
        if (
            checkout.get("mode") != "subscription"
            or stripe_id(checkout.get("customer")) != subscription.stripe_customer_id
            or checkout.get("client_reference_id") != str(subscription.user_id)
            or checkout.get("metadata") != expected_metadata
        ):
            raise ValueError("Upgrade Checkout ownership mismatch")

        if checkout.get("status") == "expired" and checkout.get("payment_status") == "unpaid":
            upgrade.status = "expired"
            db.commit()
            return upgrade.status

        if checkout.get("status") != "complete" or checkout.get("payment_status") != "paid":
            return upgrade.status

        source_id = upgrade.source_stripe_subscription_id
        if subscription.stripe_subscription_id != source_id:
            raise ValueError("Subscription changed during upgrade Checkout")

        replacement_id = stripe_id(checkout.get("subscription"))
        invoice_id = stripe_id(checkout.get("invoice"))
        if not replacement_id or replacement_id == source_id or not invoice_id:
            raise ValueError("Upgrade Checkout did not return a replacement and invoice")

        replacement = stripe.Subscription.retrieve(replacement_id).to_dict()
        plan = db.get(SubscriptionPlan, upgrade.target_plan_id)
        stripe_plan, item = get_plan_from_stripe_subscription(replacement, db)
        invoice = stripe.Invoice.retrieve(invoice_id).to_dict()
        paid_at = (invoice.get("status_transitions") or {}).get("paid_at")
        period_start = item.get("current_period_start")
        period_end = item.get("current_period_end")
        invoice_lines = (invoice.get("lines") or {}).get("data") or []
        invoice_period = (invoice_lines[0].get("period") or {}) if invoice_lines else {}
        if (
            stripe_plan.id != plan.id
            or replacement.get("status") != "active"
            or replacement.get("collection_method") != "charge_automatically"
            or stripe_id(replacement.get("customer")) != subscription.stripe_customer_id
            or replacement.get("metadata") != expected_metadata
            or get_invoice_subscription_id(invoice) != replacement_id
            or stripe_id(invoice.get("customer")) != subscription.stripe_customer_id
            or invoice.get("billing_reason") != "subscription_create"
            or invoice.get("status") != "paid"
            or invoice.get("paid_out_of_band")
            or not is_full_price_upgrade_invoice(invoice, plan)
            or invoice.get("amount_paid") != invoice.get("amount_due")
            or checkout.get("amount_total") != invoice.get("amount_paid")
            or checkout.get("currency", "").upper() != plan.currency.upper()
            or item.get("quantity") != 1
            or not paid_at
            or not period_start
            or period_start != replacement.get("billing_cycle_anchor")
            or not period_end
            or not period_start < period_end
            or invoice_period.get("start") != period_start
            or invoice_period.get("end") != period_end
            or abs(paid_at - period_start) > 5
        ):
            raise ValueError("Upgrade Checkout invoice or billing period did not verify")

        if paid_at >= upgrade.source_period_end:
            logger.error("Upgrade %s settled after the previous renewal boundary", upgrade.id)

        db.add(Payment(
            user_id=subscription.user_id,
            subscription_id=subscription.id,
            plan_id=plan.id,
            amount=Decimal(invoice["amount_paid"]) / Decimal("100"),
            currency=plan.currency.upper(),
            provider="stripe",
            status="paid",
            stripe_checkout_session_id=session_id,
            stripe_invoice_id=invoice_id,
            paid_at=utc_datetime(paid_at),
        ))
        subscription.plan_id = plan.id
        subscription.status = "active"
        subscription.stripe_subscription_id = replacement_id
        subscription.current_period_start = utc_datetime(period_start)
        subscription.current_period_end = utc_datetime(period_end)
        subscription.cancel_at_period_end = bool(replacement.get("cancel_at_period_end"))
        upgrade.replacement_stripe_subscription_id = replacement_id
        upgrade.status = "retiring"
        # Local access and the recovery marker are committed together. A lost
        # cancellation response can be retried using the recorded source ID.
        db.commit()

    retire_checkout_source(upgrade, db)
    return upgrade.status


def handle_checkout_completed(checkout, db: Session):

    session_id = checkout.get("id")
    attempt_key = (checkout.get("metadata") or {}).get("advocanote_upgrade")
    if attempt_key:
        upgrade = db.scalar(
            select(SubscriptionUpgrade).where(
                SubscriptionUpgrade.attempt_key == attempt_key,
                SubscriptionUpgrade.stripe_checkout_session_id == session_id,
            )
        )
        if upgrade is None:
            raise ValueError("Upgrade Checkout has no matching attempt")
        process_checkout_upgrade(upgrade, db)
        return

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
        ).with_for_update()
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

    # =========================================
    # ADMIN NOTIFICATIONS - SUCCESSFUL CHECKOUT
    # =========================================

    try:
        lawyer = db.get(User, payment.user_id)

        lawyer_name = (
            getattr(lawyer, "full_name", None)
            or f"Lawyer #{payment.user_id}"
        )

        plan_name = (
            getattr(plan, "name", None)
            or f"Plan #{plan.id}"
        )

        details = {
            "lawyer_id": payment.user_id,
            "lawyer_name": lawyer_name,
            "email": (
                getattr(lawyer, "email", None) or "—"
            ),
            "plan": plan_name,
            "amount": str(payment.amount),
            "currency": (
                payment.currency or "LKR"
            ),
            "payment_status": "Paid",
            "activity": "New Subscription",
        }

        notifications = [
            {
                "type": "subscription",
                "title": "New Subscription",
                "message": (
                    f"{lawyer_name} has subscribed "
                    f"to the {plan_name} plan."
                ),
                "details": details,
            },
            {
                "type": "payment",
                "title": "Payment Successful",
                "message": (
                    f"Subscription payment received "
                    f"from {lawyer_name}."
                ),
                "details": details,
            },
        ]

        for notification in notifications:
            try:
                create_admin_notification(
                    **notification
                )
            except Exception:
                logger.exception(
                    "Failed to create admin notification: %s",
                    notification["type"],
                )

    except Exception:
        logger.exception(
            "Admin notification preparation failed "
            "for checkout %s",
            session_id,
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


def invoice_line_matches_subscription_price(
    line,
    subscription_id,
    subscription_item_id,
    price_id,
):
    parent = line.get("parent") or {}
    details = parent.get("subscription_item_details") or {}
    pricing = line.get("pricing") or {}
    price_details = pricing.get("price_details") or {}

    line_subscription_id = (
        stripe_id(line.get("subscription"))
        or stripe_id(details.get("subscription"))
    )
    line_item_id = (
        stripe_id(line.get("subscription_item"))
        or stripe_id(details.get("subscription_item"))
    )
    line_price_id = (
        stripe_id(line.get("price"))
        or stripe_id(price_details.get("price"))
    )

    return (
        line_subscription_id == subscription_id
        and line_item_id == subscription_item_id
        and line_price_id == price_id
        and isinstance(line.get("amount"), int)
        and line["amount"] > 0
    )

# ==========================================
# VERIFY SUCCESSFUL UPGRADE PAYMENT
# ==========================================

def is_full_price_upgrade_invoice(invoice, plan):
    expected = int(plan.price * 100)
    lines = (invoice.get("lines") or {}).get("data") or []
    if len(lines) != 1:
        return False

    line = lines[0]
    details = (line.get("parent") or {}).get("subscription_item_details") or {}
    pricing = (line.get("pricing") or {}).get("price_details") or {}
    return (
        expected > 0
        and invoice.get("total") == expected
        and invoice.get("amount_due") == expected
        and (invoice.get("currency") or "").upper() == plan.currency.upper()
        and line.get("amount") == expected
        and not line.get("proration")
        and not details.get("proration")
        and (stripe_id(line.get("price")) or stripe_id(pricing.get("price"))) == plan.stripe_price_id
    )


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

    amount_paid = invoice.get("amount_paid")
    amount_due = invoice.get("amount_due")
    if (
        not isinstance(amount_paid, int)
        or amount_paid <= 0
        or not isinstance(amount_due, int)
        or amount_due <= 0
    ):
        raise ValueError(
            "Upgrade requires a positive Stripe payment"
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
        ).with_for_update()
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

    if metadata.get("user_id") not in (
        None,
        str(subscription.user_id),
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

    # 9. Verify that Stripe applied the change
    if (
        stripe_sub.get("status") != "active"
        or stripe_sub.get("pending_update")
    ):
        raise ValueError(
            "Upgrade not fully applied in Stripe"
        )

    if not is_full_price_upgrade_invoice(invoice, new_plan) or amount_paid != amount_due:
        raise ValueError("Upgrade invoice does not show a full-price payment")

    line = invoice["lines"]["data"][0]
    period = line.get("period") or {}
    period_start = period.get("start")
    period_end = period.get("end")
    if (
        not invoice_line_matches_subscription_price(
            line, stripe_sub_id, stripe_id(item.get("id")), new_plan.stripe_price_id
        )
        or not period_start
        or period_start != stripe_sub.get("billing_cycle_anchor")
        or not period_end
        or period_end <= period_start
        or not item.get("current_period_end")
        or period_end > item["current_period_end"]
    ):
        raise ValueError("Paid upgrade invoice does not match the new billing cycle")

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

    if metadata.get("user_id") not in (
        None,
        str(subscription.user_id),
    ):
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

        if new_plan.id != old_plan.id and not invoice_line_matches_subscription_price(
            line, sub_id, item_id, new_plan.stripe_price_id
        ):
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
        if amount_minor <= 0 or stripe_sub.get("pending_update"):
            raise ValueError("Plan change requires a verified renewal payment")

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

    # ==========================================
    # ADMIN NOTIFICATION - SUBSCRIPTION RENEWED
    # ==========================================

    try:
        lawyer = db.get(
            User,
            subscription.user_id
        )

        lawyer_name = (
            getattr(lawyer, "full_name", None)
            or f"Lawyer #{subscription.user_id}"
        )

        plan_name = (
            getattr(new_plan, "name", None)
            or f"Plan #{new_plan.id}"
        )

        notification_title = (
            "Subscription Renewed with Plan Change"
            if is_plan_change
            else "Subscription Renewed"
        )

        create_admin_notification(
            type="subscription",
            title=notification_title,
            message=(
                f"{lawyer_name}'s subscription "
                f"has been successfully renewed "
                f"on the {plan_name} plan."
            ),
            details={
                "lawyer_id": subscription.user_id,
                "lawyer_name": lawyer_name,
                "email": (
                    getattr(lawyer, "email", None)
                    or "—"
                ),
                "plan": plan_name,
                "amount": str(amount),
                "currency": currency,
                "payment_status": "Paid",
                "billing": new_plan.billing_interval,
                "invoice_id": invoice_id,
                "activity": "Subscription Renewal",
            },
        )

    except Exception:
        logger.exception(
            "Failed to create renewal notification "
            "for invoice %s",
            invoice_id,
        )

    logger.info(
        "Renewal paid: user_id=%s plan_id=%s invoice=%s",
        subscription.user_id,
        new_plan.id,
        invoice_id,
    )


def handle_subscription_deleted(event_sub, db: Session):
    """Sync verified Stripe cancellation and notify the admin once."""
    import json
    from admin_notifications_api import get_connection

    sub_id = stripe_id(event_sub.get("id"))

    if not sub_id:
        raise ValueError("Missing subscription ID")

    stripe_sub = stripe.Subscription.retrieve(sub_id).to_dict()

    if stripe_sub.get("status") != "canceled":
        return

    subscription = db.scalar(
        select(Subscription)
        .where(Subscription.stripe_subscription_id == sub_id)
        .with_for_update()
    )

    if subscription is None:
        logger.info("Unknown canceled subscription: %s", sub_id)
        return

    if (
        stripe_id(stripe_sub.get("customer"))
        != subscription.stripe_customer_id
    ):
        raise ValueError("Customer mismatch")

    metadata = stripe_sub.get("metadata") or {}

    if metadata.get("user_id") not in (
        None,
        str(subscription.user_id),
    ):
        raise ValueError("Subscription metadata mismatch")

    # ==========================================
    # UPDATE SUBSCRIPTION
    # ==========================================

    subscription.status = "canceled"
    subscription.cancel_at_period_end = False

    db.commit()

    # ==========================================
    # ADMIN NOTIFICATION - SUBSCRIPTION CANCELLED
    # ==========================================

    try:
        lawyer = db.get(User, subscription.user_id)
        plan = db.get(
            SubscriptionPlan,
            subscription.plan_id
        )

        lawyer_name = (
            getattr(lawyer, "full_name", None)
            or f"Lawyer #{subscription.user_id}"
        )

        plan_name = (
            getattr(plan, "name", None)
            or f"Plan #{subscription.plan_id}"
        )

        details = {
            "lawyer_id": subscription.user_id,
            "lawyer_name": lawyer_name,
            "email": getattr(lawyer, "email", None) or "—",
            "plan": plan_name,
            "subscription_status": "Cancelled",
            "stripe_subscription_id": sub_id,
            "activity": "Subscription Cancelled",
        }

        # ======================================
        # PREVENT DUPLICATE NOTIFICATIONS
        # ======================================

        notification_db = get_connection()

        try:
            notification_db.execute("BEGIN IMMEDIATE")

            rows = notification_db.execute(
                """
                SELECT details
                FROM admin_notifications
                WHERE type = ? AND title = ?
                """,
                (
                    "subscription",
                    "Subscription Cancelled",
                ),
            ).fetchall()

            already_sent = False

            for row in rows:
                try:
                    existing_details = json.loads(
                        row["details"] or "{}"
                    )
                except (ValueError, TypeError):
                    continue

                if (
                    existing_details.get(
                        "stripe_subscription_id"
                    ) == sub_id
                ):
                    already_sent = True
                    break

            # ==================================
            # SAVE REAL ADMIN NOTIFICATION
            # ==================================

            if not already_sent:
                notification_db.execute(
                    """
                    INSERT INTO admin_notifications
                    (
                        type,
                        title,
                        message,
                        details,
                        is_read,
                        created_at
                    )
                    VALUES (?, ?, ?, ?, 0, ?)
                    """,
                    (
                        "subscription",
                        "Subscription Cancelled",
                        (
                            f"{lawyer_name}'s {plan_name} "
                            "subscription has been cancelled."
                        ),
                        json.dumps(details),
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )

            notification_db.commit()

        except Exception:
            notification_db.rollback()
            raise

        finally:
            notification_db.close()

    except Exception:
        logger.exception(
            "Admin cancellation notification failed "
            "for subscription %s",
            sub_id,
        )

    logger.info(
        "Subscription canceled: user_id=%s",
        subscription.user_id,
    )

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

    if invoice.get("status") != "open":
        return

    billing_reason = invoice.get("billing_reason")
    if billing_reason == "subscription_create":
        handle_initial_checkout_payment_failed(invoice, db)
        return

    if billing_reason == "subscription_update":
        handle_upgrade_payment_failed(invoice, db)
        return

    if billing_reason != "subscription_cycle":
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

    if metadata.get("user_id") not in (
        None,
        str(subscription.user_id),
    ):
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
    # Prevent duplicate notifications for same invoice
    was_already_failed = (
        payment is not None
        and payment.status == "failed"
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

    # ==========================================
    # ADMIN NOTIFICATION - PAYMENT FAILED
    # ==========================================

    if not was_already_failed:
        try:
            lawyer = db.get(
                User,
                subscription.user_id
            )

            lawyer_name = (
                getattr(lawyer, "full_name", None)
                or f"Lawyer #{subscription.user_id}"
            )

            plan_name = (
                getattr(new_plan, "name", None)
                or f"Plan #{new_plan.id}"
            )

            create_admin_notification(
                type="failed",
                title="Payment Failed",
                message=(
                    f"Subscription renewal payment "
                    f"failed for {lawyer_name}."
                ),
                details={
                    "lawyer_id": subscription.user_id,
                    "lawyer_name": lawyer_name,
                    "email": (
                        getattr(lawyer, "email", None)
                        or "—"
                    ),
                    "plan": plan_name,
                    "amount": str(amount),
                    "currency": currency,
                    "payment_status": "Failed",
                    "invoice_id": invoice_id,
                    "activity": "Renewal Payment Failed",
                },
            )

        except Exception:
            logger.exception(
                "Failed to create payment failure "
                "notification for invoice %s",
                invoice_id,
            )

    logger.info(
        "Renewal payment failed: user_id=%s invoice=%s",
        subscription.user_id,
        invoice_id,
    )


def handle_upgrade_payment_failed(invoice, db: Session):
    invoice_id = invoice.get("id")
    sub_id = get_invoice_subscription_id(invoice)

    if not invoice_id or not sub_id:
        raise ValueError("Upgrade failure invoice is incomplete")

    subscription = db.scalar(
        select(Subscription)
        .where(Subscription.stripe_subscription_id == sub_id)
        .with_for_update()
    )
    if subscription is None:
        logger.info("Unknown failed upgrade invoice: %s", invoice_id)
        return

    recorded_payment = db.scalar(
        select(Payment).where(Payment.stripe_invoice_id == invoice_id)
    )
    if recorded_payment is not None and recorded_payment.status == "paid":
        if recorded_payment.subscription_id != subscription.id:
            raise ValueError("Failed upgrade payment ownership mismatch")
        return

    stripe_sub = stripe.Subscription.retrieve(sub_id).to_dict()
    customer_id = stripe_id(stripe_sub.get("customer"))
    if (
        customer_id != subscription.stripe_customer_id
        or customer_id != stripe_id(invoice.get("customer"))
    ):
        raise ValueError("Failed upgrade customer mismatch")

    metadata = stripe_sub.get("metadata") or {}
    if metadata.get("user_id") not in (
        None,
        str(subscription.user_id),
    ):
        raise ValueError("Failed upgrade user mismatch")

    stripe_items = (
        (stripe_sub.get("items") or {}).get("data") or []
    )
    if len(stripe_items) != 1:
        raise ValueError("Invalid Stripe subscription items")
    item_id = stripe_id(stripe_items[0].get("id"))
    if not item_id:
        raise ValueError("Missing Stripe subscription item")

    invoice_lines = (
        (invoice.get("lines") or {}).get("data") or []
    )
    candidate_plans = {}
    for line in invoice_lines:
        parent = line.get("parent") or {}
        details = parent.get("subscription_item_details") or {}
        pricing = line.get("pricing") or {}
        price_details = pricing.get("price_details") or {}
        if (
            stripe_id(line.get("subscription"))
            or stripe_id(details.get("subscription"))
        ) != sub_id:
            continue
        if (
            stripe_id(line.get("subscription_item"))
            or stripe_id(details.get("subscription_item"))
        ) != item_id:
            continue
        if not isinstance(line.get("amount"), int) or line["amount"] <= 0:
            continue

        price_id = (
            stripe_id(line.get("price"))
            or stripe_id(price_details.get("price"))
        )
        if not price_id:
            continue
        plan = db.scalar(
            select(SubscriptionPlan).where(
                SubscriptionPlan.stripe_price_id == price_id
            )
        )
        if plan is not None and plan.id != subscription.plan_id:
            candidate_plans[plan.id] = plan

    if len(candidate_plans) != 1:
        raise ValueError("Unable to identify failed upgrade plan")

    new_plan = next(iter(candidate_plans.values()))
    currency = (invoice.get("currency") or "").upper()
    amount_due = invoice.get("amount_due")
    if (
        currency != new_plan.currency.upper()
        or not isinstance(amount_due, int)
        or amount_due < 0
    ):
        raise ValueError("Invalid failed upgrade amount or currency")

    payment = db.scalar(
        select(Payment)
        .where(Payment.stripe_invoice_id == invoice_id)
        .with_for_update()
    )
    if payment is not None:
        if (
            payment.user_id != subscription.user_id
            or payment.subscription_id not in (None, subscription.id)
            or payment.plan_id != new_plan.id
            or payment.provider != "stripe"
        ):
            raise ValueError("Failed upgrade payment ownership mismatch")
        if payment.status == "paid":
            return
        if payment.status == "failed":
            return
    else:
        payment = Payment(
            user_id=subscription.user_id,
            subscription_id=subscription.id,
            plan_id=new_plan.id,
            amount=Decimal(amount_due) / Decimal("100"),
            currency=currency,
            provider="stripe",
            status="failed",
            stripe_invoice_id=invoice_id,
        )
        db.add(payment)

    payment.subscription_id = subscription.id
    payment.plan_id = new_plan.id
    payment.amount = Decimal(amount_due) / Decimal("100")
    payment.currency = currency
    payment.status = "failed"
    db.commit()

    logger.info(
        "Upgrade payment failed; current plan retained: "
        "user_id=%s invoice=%s",
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

    if metadata.get("user_id") not in (
        None,
        str(subscription.user_id),
    ):
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


# ==========================================
# ADMIN - FIRST CHECKOUT PAYMENT FAILED
# ==========================================

def handle_initial_checkout_payment_failed(
    event_invoice,
    db: Session,
):
    invoice_id = event_invoice.get("id")

    if not invoice_id:
        return

    invoice = stripe.Invoice.retrieve(
        invoice_id
    ).to_dict()

    # Initial subscription invoice only
    if invoice.get("billing_reason") != "subscription_create":
        return

    if invoice.get("status") != "open":
        return

    sub_id = get_invoice_subscription_id(invoice)

    if not sub_id:
        return

    stripe_sub = stripe.Subscription.retrieve(
        sub_id
    ).to_dict()

    metadata = stripe_sub.get("metadata") or {}

    user_id = metadata.get("user_id")
    plan_id = metadata.get("plan_id")

    if not user_id or not plan_id:
        return

    if not user_id.isdigit() or not plan_id.isdigit():
        return

    customer_id = stripe_id(stripe_sub.get("customer"))

    if customer_id != stripe_id(invoice.get("customer")):
        return

    # Verify this invoice belongs to an AdvocaNote checkout
    sessions = stripe.checkout.Session.list(
        subscription=sub_id,
        limit=20,
    )

    payment = None

    for session in sessions.data:
        session_id = session.get("id")
        session_metadata = session.get("metadata") or {}

        if (
            session.get("mode") != "subscription"
            or session.get("client_reference_id") != user_id
            or session_metadata.get("user_id") != user_id
            or session_metadata.get("plan_id") != plan_id
            or stripe_id(session.get("subscription")) != sub_id
        ):
            continue

        candidate = db.scalar(
            select(Payment).where(
                Payment.stripe_checkout_session_id == session_id
            ).with_for_update()
        )

        if (
            candidate is not None
            and str(candidate.user_id) == user_id
            and str(candidate.plan_id) == plan_id
        ):
            payment = candidate
            break

    if payment is None or payment.status == "paid":
        return

    lawyer = db.get(User, int(user_id))
    plan = db.get(SubscriptionPlan, int(plan_id))

    if lawyer is None or plan is None:
        return

    invoice_payment = db.scalar(
        select(Payment)
        .where(Payment.stripe_invoice_id == invoice_id)
        .with_for_update()
    )
    if invoice_payment is not None and invoice_payment.id != payment.id:
        raise ValueError("Initial invoice payment ownership mismatch")

    amount_due = invoice.get("amount_due")

    amount = (
        str(Decimal(amount_due) / Decimal("100"))
        if isinstance(amount_due, int)
        else "—"
    )

    payment.stripe_invoice_id = invoice_id
    payment.status = "failed"
    if isinstance(amount_due, int) and amount_due >= 0:
        payment.amount = Decimal(amount_due) / Decimal("100")
    payment.currency = (
        invoice.get("currency") or plan.currency
    ).upper()
    db.commit()

    try:
        create_admin_notification_once(
            type="failed",
            title="Initial Payment Failed",
            message=(
                f"Initial subscription payment failed "
                f"for {lawyer.full_name}."
            ),
            details={
                "lawyer_id": lawyer.id,
                "lawyer_name": lawyer.full_name,
                "email": lawyer.email,
                "plan": plan.name,
                "amount": amount,
                "currency": (
                    invoice.get("currency") or "LKR"
                ).upper(),
                "payment_status": "Failed",
                "invoice_id": invoice_id,
                "activity": "Initial Payment Failed",
            },
            unique_detail_key="invoice_id",
        )

    except Exception:
        logger.exception(
            "Initial payment failure notification failed: %s",
            invoice_id,
        )


def handle_initial_checkout_invoice_paid(invoice, db: Session):
    invoice_id = invoice.get("id")
    if not invoice_id:
        raise ValueError("Missing initial invoice ID")

    paid_invoice = stripe.Invoice.retrieve(invoice_id).to_dict()
    if (
        paid_invoice.get("billing_reason") != "subscription_create"
        or paid_invoice.get("status") != "paid"
        or paid_invoice.get("paid_out_of_band")
    ):
        return

    sub_id = get_invoice_subscription_id(paid_invoice)
    if not sub_id:
        raise ValueError("Initial paid invoice has no subscription")

    stripe_sub = stripe.Subscription.retrieve(sub_id).to_dict()
    metadata = stripe_sub.get("metadata") or {}
    attempt_key = metadata.get("advocanote_upgrade")
    if attempt_key:
        upgrade = db.scalar(
            select(SubscriptionUpgrade).where(SubscriptionUpgrade.attempt_key == attempt_key)
        )
        if upgrade is None:
            raise ValueError("Upgrade invoice has no matching attempt")
        process_checkout_upgrade(upgrade, db)
        return

    user_id = metadata.get("user_id")
    plan_id = metadata.get("plan_id")
    if (
        stripe_sub.get("status") != "active"
        or not user_id
        or not plan_id
        or stripe_id(stripe_sub.get("customer"))
        != stripe_id(paid_invoice.get("customer"))
    ):
        return

    sessions = stripe.checkout.Session.list(
        subscription=sub_id,
        limit=20,
    )
    for session in sessions.data:
        session_id = stripe_id(session.get("id"))
        session_metadata = session.get("metadata") or {}
        if (
            session.get("mode") != "subscription"
            or session.get("client_reference_id") != user_id
            or session_metadata.get("user_id") != user_id
            or session_metadata.get("plan_id") != plan_id
            or stripe_id(session.get("subscription")) != sub_id
        ):
            continue

        payment = db.scalar(
            select(Payment).where(
                Payment.stripe_checkout_session_id == session_id,
                Payment.user_id == int(user_id),
                Payment.plan_id == int(plan_id),
            )
        )
        if payment is None:
            continue

        completed_session = stripe.checkout.Session.retrieve(
            session_id
        ).to_dict()
        handle_checkout_completed(completed_session, db)
        return

    logger.info(
        "No AdvocaNote checkout found for initial invoice %s",
        invoice_id,
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

    if event_type in (
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.expired",
    ):

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

            elif billing_reason == "subscription_create":
                handle_initial_checkout_invoice_paid(
                    invoice,
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

    existing_payment = db.scalar(
        select(Payment)
        .where(Payment.stripe_invoice_id == invoice_id)
    )

    # A paid invoice is the idempotency key. The subscription and payment
    # are committed together, so an existing paid row means this event has
    # already been applied.
    if existing_payment is not None and existing_payment.status == "paid":
        return

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

    existing_payment = db.scalar(
        select(Payment)
        .where(Payment.stripe_invoice_id == invoice_id)
        .with_for_update()
    )
    if existing_payment is not None and existing_payment.status == "paid":
        return

    if old_plan.id == new_plan.id:
        raise ValueError("No new plan change to activate")

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

    if existing_payment is not None and (
        existing_payment.user_id != subscription.user_id
        or existing_payment.subscription_id not in (
            None,
            subscription.id,
        )
        or existing_payment.plan_id != new_plan.id
        or existing_payment.provider != "stripe"
    ):
        raise ValueError(
            "Invoice payment ownership mismatch"
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

    amount = Decimal(invoice["amount_paid"]) / Decimal("100")

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
    if existing_payment is None:
        payment = Payment(
            user_id=subscription.user_id,
            subscription_id=subscription.id,
            plan_id=new_plan.id,
            amount=amount,
            currency=new_plan.currency.upper(),
            provider="stripe",
            status="paid",
            stripe_invoice_id=invoice_id,
            paid_at=datetime.utcnow(),
        )
        db.add(payment)
    else:
        existing_payment.subscription_id = subscription.id
        existing_payment.plan_id = new_plan.id
        existing_payment.amount = amount
        existing_payment.currency = new_plan.currency.upper()
        existing_payment.status = "paid"
        existing_payment.paid_at = (
            existing_payment.paid_at or datetime.utcnow()
        )

    db.commit()

    try:
        stripe.Subscription.modify(
            stripe_sub["id"],
            metadata={
                "user_id": str(subscription.user_id),
                "plan_id": str(new_plan.id),
            },
        )
    except stripe.error.StripeError:
        logger.exception(
            "Failed to synchronize Stripe plan metadata for invoice %s",
            invoice_id,
        )

    # ==========================================
    # ADMIN NOTIFICATION - PLAN UPGRADE / CHANGE
    # ==========================================

    try:
        lawyer = db.get(
            User,
            subscription.user_id
        )

        lawyer_name = (
            getattr(lawyer, "full_name", None)
            or f"Lawyer #{subscription.user_id}"
        )

        old_plan_name = (
            getattr(old_plan, "name", None)
            or f"Plan #{old_plan.id}"
        )

        new_plan_name = (
            getattr(new_plan, "name", None)
            or f"Plan #{new_plan.id}"
        )

        is_upgrade = (
            old_plan.billing_interval == "month"
            and new_plan.billing_interval == "month"
            and new_plan.price > old_plan.price
        )

        notification_title = (
            "Plan Upgraded"
            if is_upgrade
            else "Plan Changed"
        )

        create_admin_notification_once(
            type="subscription",
            title=notification_title,
            message=(
                f"{lawyer_name} has changed "
                f"their subscription from "
                f"{old_plan_name} to {new_plan_name}."
            ),
            details={
                "lawyer_id": subscription.user_id,
                "lawyer_name": lawyer_name,
                "email": (
                    getattr(lawyer, "email", None)
                    or "—"
                ),
                "old_plan": old_plan_name,
                "new_plan": new_plan_name,
                "amount": str(amount),
                "currency": new_plan.currency.upper(),
                "billing": new_plan.billing_interval,
                "payment_status": "Paid",
                "invoice_id": invoice_id,
                "activity": notification_title,
            },
            unique_detail_key="invoice_id",
        )

    except Exception:
        logger.exception(
            "Failed to create plan change notification "
            "for invoice %s",
            invoice_id,
        )

    logger.info(
        "Paid plan upgrade completed: user_id=%s plan_id=%s",
        subscription.user_id,
        new_plan.id,
    )


def reconcile_paid_plan_upgrade(stripe_sub, db: Session):
    sub_id = stripe_id(stripe_sub.get("id"))
    if not sub_id:
        raise ValueError("Missing Stripe subscription ID")

    subscription = db.scalar(
        select(Subscription)
        .where(Subscription.stripe_subscription_id == sub_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if subscription is None:
        raise ValueError("AdvocaNote subscription not found")

    customer_id = stripe_id(stripe_sub.get("customer"))
    metadata = stripe_sub.get("metadata") or {}
    if (
        customer_id != subscription.stripe_customer_id
        or metadata.get("user_id") not in (
            None,
            str(subscription.user_id),
        )
    ):
        raise ValueError("Stripe subscription ownership mismatch")

    stripe_plan, _ = get_plan_from_stripe_subscription(
        stripe_sub,
        db,
    )
    if stripe_plan.id == subscription.plan_id:
        return False

    invoices = stripe.Invoice.list(
        subscription=sub_id,
        limit=100,
    )
    latest_invoice_id = stripe_id(stripe_sub.get("latest_invoice"))
    for candidate in invoices.data:
        invoice = candidate.to_dict()
        invoice_id = invoice.get("id")
        reason = invoice.get("billing_reason")
        if (
            not invoice_id
            or invoice.get("status") != "paid"
            or invoice.get("paid_out_of_band")
            or (invoice.get("amount_paid") or 0) <= 0
        ):
            continue

        try:
            if reason == "subscription_update":
                handle_paid_plan_upgrade(invoice_id, db)
            elif reason == "subscription_cycle" and invoice_id == latest_invoice_id:
                handle_invoice_paid(invoice, db)
            else:
                continue
        except ValueError:
            db.rollback()
            subscription = db.scalar(
                select(Subscription)
                .where(Subscription.stripe_subscription_id == sub_id)
                .with_for_update()
            )
            continue

        db.refresh(subscription)
        if subscription.plan_id == stripe_plan.id:
            return True

    return False
