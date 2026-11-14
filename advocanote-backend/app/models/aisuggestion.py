
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime,
    ForeignKey, Integer, String, Text, Time
)

from app.database import Base
from app.models.user import User


USER_FK = f"{User.__tablename__}.id"


class AISuggestion(Base):
    __tablename__ = "ai_suggestions"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    diary_entry_id = Column(
        Integer,
        ForeignKey("diary_entries.id"),
        nullable=True
    )

    suggestion_type = Column(
        String(30), nullable=False
    )

    suggested_value = Column(
        Text, nullable=False
    )

    status = Column(
        String(20), nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
