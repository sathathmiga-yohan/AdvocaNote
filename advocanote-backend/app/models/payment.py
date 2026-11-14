
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
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
