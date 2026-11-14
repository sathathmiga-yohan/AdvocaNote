
import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from app.routers import stripe_webhooks as wh


@pytest.mark.parametrize("user_id", [2, 14, 25, 1000])
def test_auto_yearly_sync_for_all_users(monkeypatch, user_id):
    invoice_id = f"in_fake_{user_id}"
    start = int((datetime.now(timezone.utc) + timedelta(days=1)).timestamp())
    end = start + 365 * 24 * 60 * 60

    subscription = SimpleNamespace(
        id=user_id + 100, user_id=user_id, plan_id=4,
        status="active", current_period_start=None,
        current_period_end=None, cancel_at_period_end=False,
    )

    old_plan = SimpleNamespace(
        id=4, billing_interval="month", price=Decimal("1490")
    )
    new_plan = SimpleNamespace(
        id=3, billing_interval="year", price=Decimal("14900")
    )

    invoice = {
        "id": invoice_id,
        "amount_paid": 1490000,
        "billing_reason": "subscription_update",
    }

    info = {
        "subscription": subscription,
        "old_plan": old_plan,
        "new_plan": new_plan,
        "invoice": invoice,
        "stripe_subscription": {
            "id": f"sub_fake_{user_id}",
            "cancel_at_period_end": False,
        },
        "stripe_item": {
            "current_period_start": start,
            "current_period_end": end,
        },
    }

    db = MagicMock()
    db.scalar.return_value = None

    monkeypatch.setattr(
        wh, "verify_paid_upgrade_invoice",
        lambda inv, session: info,
    )
    monkeypatch.setattr(
        wh.stripe.Subscription, "modify",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        wh.stripe.Webhook, "construct_event",
        lambda **kwargs: {
            "type": "invoice.paid",
            "data": {
                "object": SimpleNamespace(to_dict=lambda: invoice)
            },
        },
    )

    class Request:
        headers = {"stripe-signature": "mock-signature"}

        async def body(self):
            return b"mocked-event"

    result = asyncio.run(wh.stripe_webhook(Request(), db))

    assert result == {"received": True}
    assert subscription.plan_id == 3
    assert subscription.status == "active"

    db.add.assert_called_once()
    payment = db.add.call_args.args[0]

    assert payment.user_id == user_id
    assert payment.plan_id == 3
    assert payment.amount == Decimal("14900")
    assert payment.status == "paid"
    assert payment.stripe_invoice_id == invoice_id

    db.commit.assert_called_once()

    # Same invoice again should not create a duplicate
    db.scalar.return_value = payment
    info["old_plan"] = new_plan

    result = asyncio.run(wh.stripe_webhook(Request(), db))

    assert result == {"received": True}
    assert db.add.call_count == 1
    assert db.commit.call_count == 1
