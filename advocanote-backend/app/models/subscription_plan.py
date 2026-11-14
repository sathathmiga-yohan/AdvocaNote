
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Integer,
    String,
    Numeric,
    JSON,
    ForeignKey,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    description: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    )

    price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        server_default=text("'LKR'")
    )

    billing_interval: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    features: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list
    )

    trial_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0")
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("1")
    )

    stripe_product_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    stripe_price_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )
