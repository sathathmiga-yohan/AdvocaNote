
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)

from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Subscription(Base):

    __tablename__ = "subscriptions"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            name="uq_subscriptions_user_id"
        ),
    )

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

    plan_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "subscription_plans.id",
            ondelete="RESTRICT"
        ),
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'pending'")
    )

    trial_ends_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    current_period_start: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    cancel_at_period_end: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("0")
    )

    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )
