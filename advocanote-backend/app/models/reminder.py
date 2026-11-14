
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime,
    ForeignKey, Integer, String, Text, Time
)

from app.database import Base
from app.models.user import User


USER_FK = f"{User.__tablename__}.id"


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer, ForeignKey(USER_FK),
        nullable=False, index=True
    )

    hearing_id = Column(
        Integer,
        ForeignKey("hearings.id"),
        nullable=True
    )

    task_id = Column(
        Integer,
        ForeignKey("tasks.id"),
        nullable=True
    )

    reminder_type = Column(
        String(20), nullable=False
    )

    title = Column(
        String(255), nullable=False
    )

    reminder_date = Column(
        Date, nullable=False
    )

    is_sent = Column(
        Boolean,
        default=False,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
