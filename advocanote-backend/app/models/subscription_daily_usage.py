
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
    func,
    text,
)

from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)

from app.database import Base


# ==========================================
# SUBSCRIPTION DAILY USAGE MODEL
# ==========================================

class SubscriptionDailyUsage(Base):

    __tablename__ = "subscription_daily_usage"

    __table_args__ = (

        UniqueConstraint(
            "user_id",
            "usage_date",
            name="uq_subscription_daily_usage_user_day",
        ),

        CheckConstraint(
            "actions_used >= 0",
            name="ck_subscription_daily_usage_nonnegative",
        ),
    )

    # =====================================
    # PRIMARY KEY
    # =====================================

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    # =====================================
    # LAWYER ID
    # =====================================

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # =====================================
    # USAGE DATE
    # =====================================

    usage_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    # =====================================
    # DAILY ACTION COUNTER
    # =====================================

    actions_used: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )

    # =====================================
    # CREATED DATE
    # =====================================

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    # =====================================
    # UPDATED DATE
    # =====================================

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
