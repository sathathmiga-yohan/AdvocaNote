from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from app.routers import stripe_webhooks as wh


@pytest.mark.parametrize("user_id", [22, 45])
def test_scheduled_yearly_sync(monkeypatch, user_id):
    invoice_id = f"in_test_{user_id}"
    sub_id = f"sub_test_{user_id}"
    customer_id = f"cus_test_{user_id}"
    item_id = f"si_test_{user_id}"

    start = int(
        (datetime.now(timezone.utc) + timedelta(days=30)).timestamp()
    )
    end = start + 365 * 86400
    old_end = wh.utc_datetime(start)

    subscription = SimpleNamespace(
        id=user_id + 100,
        user_id=user_id,
        plan_id=4,
        status="active",
        stripe_customer_id=customer_id,
        stripe_subscription_id=sub_id,
        current_period_start=old_end - timedelta(days=30),
        current_period_end=old_end,
        cancel_at_period_end=False,
    )

    old_plan = SimpleNamespace(
        id=4, billing_interval="month", price=1490
    )
    new_plan = SimpleNamespace(
        id=3, billing_interval="year",
        price=14900, currency="LKR"
    )
    item = {"id": item_id}

    invoice = {
        "id": invoice_id,
        "billing_reason": "subscription_cycle",
        "status": "paid",
        "paid_out_of_band": False,
        "currency": "lkr",
        "amount_paid": 1490000,
        "customer": customer_id,
        "parent": {
            "subscription_details": {"subscription": sub_id}
        },
        "lines": {
            "data": [{
                "parent": {
                    "type": "subscription_item_details",
                    "subscription_item_details": {
                        "proration": False,
                        "subscription": sub_id,
                        "subscription_item": item_id,
                    },
                },
                "period": {"start": start, "end": end},
            }]
        },
    }

    stripe_sub = {
        "customer": customer_id,
        "metadata": {
            "user_id": str(user_id),
            "plan_id": "3",
        },
        "status": "active",
        "latest_invoice": invoice_id,
        "cancel_at_period_end": False,
    }

    db = MagicMock()
    db.scalar.side_effect = [subscription, None]
    db.get.return_value = old_plan

    monkeypatch.setattr(
        wh.stripe.Invoice,
        "retrieve",
        lambda *_: SimpleNamespace(to_dict=lambda: invoice),
    )
    monkeypatch.setattr(
        wh.stripe.Subscription,
        "retrieve",
        lambda *_: SimpleNamespace(to_dict=lambda: stripe_sub),
    )
    monkeypatch.setattr(
        wh,
        "get_plan_from_stripe_subscription",
        lambda *_: (new_plan, item),
    )

    wh.handle_invoice_paid({"id": invoice_id}, db)

    payment = db.add.call_args.args[0]

    assert subscription.plan_id == 3
    assert subscription.status == "active"
    assert subscription.current_period_end == wh.utc_datetime(end)

    assert payment.user_id == user_id
    assert payment.plan_id == 3
    assert payment.amount == 14900
    assert payment.status == "paid"
    assert payment.stripe_invoice_id == invoice_id

    db.commit.assert_called_once()
