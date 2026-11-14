
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Integer,
    String,
    JSON,
    func,
    text
)

from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    full_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(254),
        unique=True,
        index=True,
        nullable=False
    )

    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    google_sub: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True
    )

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'lawyer'")
    )

    is_email_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("0")
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("1")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )
    
    
    # =====================================
    # FIRST-TIME LAWYER ONBOARDING
    # =====================================

    onboarding_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'pending'")
    )

    # =====================================
    # LAWYER PROFESSIONAL DETAILS
    # =====================================

    phone_number: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True
    )

    city: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    bar_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    practice_areas: Mapped[list[str] | None] = mapped_column(
        JSON,
        nullable=True
    )

    preferred_language: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'English'")
    )

    # =====================================
    # NOTIFICATION PREFERENCES
    # =====================================

    hearing_reminders: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("1")
    )

    task_reminders: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("1")
    )

    email_notifications: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("1")
    )
    
    professional_title: Mapped[str | None] = mapped_column(
    String(80),
    nullable=True,
    )

    law_firm: Mapped[str | None] = mapped_column(
    String(150),
    nullable=True,
    )


