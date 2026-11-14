
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime,
    ForeignKey, Integer, String, Text, Time
)

from app.database import Base
from app.models.user import User


USER_FK = f"{User.__tablename__}.id"


class Hearing(Base):
    __tablename__ = "hearings"

    id = Column(Integer, primary_key=True, index=True)

    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=False
    )

    court_id = Column(
        Integer,
        ForeignKey("courts.id"),
        nullable=False
    )

    # Nullable because a rescheduled hearing
    # can be created without a diary entry.
    diary_entry_id = Column(
        Integer,
        ForeignKey("diary_entries.id"),
        nullable=True
    )

    hearing_date = Column(
        Date, nullable=False, index=True
    )

    hearing_time = Column(
        Time, nullable=True
    )

    # Scheduled / Completed / Postponed
    status = Column(
        String(30),
        default="Scheduled",
        nullable=False
    )

    # Reason for postponing the original hearing
    reschedule_reason = Column(
        Text,
        nullable=True
    )

    # Links a new hearing to the previous hearing
    # so the original date is preserved.
    rescheduled_from_id = Column(
        Integer,
        ForeignKey("hearings.id"),
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    
    purpose = Column(String(255), nullable=True)
