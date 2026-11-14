
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime,
    ForeignKey, Integer, String, Text, Time
)

from app.database import Base
from app.models.user import User


USER_FK = f"{User.__tablename__}.id"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)

    lawyer_id = Column(
        Integer, ForeignKey(USER_FK),
        nullable=False, index=True
    )

    case_id = Column(
        Integer,
        ForeignKey("cases.id"),
        nullable=False
    )

    diary_entry_id = Column(
        Integer,
        ForeignKey("diary_entries.id"),
        nullable=True
    )

    title = Column(String(255), nullable=False)
    deadline = Column(Date, nullable=True)

    priority = Column(
        String(15),
        default="Medium",
        nullable=False
    )

    status = Column(
        String(20),
        default="Pending",
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
