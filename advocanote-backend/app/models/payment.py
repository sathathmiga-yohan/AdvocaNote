
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Numeric,
    func,
    text,
)

from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Payment(Base):

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False
    )

    subscription_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(
            "subscriptions.id",
            ondelete="RESTRICT"
        ),
        nullable=True
    )

    plan_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "subscription_plans.id",
            ondelete="RESTRICT"
        ),
        nullable=False
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        server_default=text("'LKR'")
    )

    provider: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'stripe'")
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'pending'")
    )

    stripe_checkout_session_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True
    )

    stripe_payment_intent_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True
    )

    stripe_invoice_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )

    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

class SubscriptionUpgrade(Base):
    __tablename__ = "subscription_upgrades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subscription_id: Mapped[int] = mapped_column(
        ForeignKey("subscriptions.id"), nullable=False, index=True
    )
    target_plan_id: Mapped[int] = mapped_column(
        ForeignKey("subscription_plans.id"), nullable=False
    )
    source_stripe_subscription_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    source_period_end: Mapped[int] = mapped_column(BigInteger, nullable=False)
    attempt_key: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(
        String(255), unique=True
    )
    replacement_stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(255), unique=True
    )
    expires_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
