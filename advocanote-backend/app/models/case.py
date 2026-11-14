
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime,
    ForeignKey, Integer, String, Text, Time
)

from app.database import Base
from app.models.user import User


USER_FK = f"{User.__tablename__}.id"


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)

    lawyer_id = Column(
        Integer, ForeignKey(USER_FK),
        nullable=False, index=True
    )

    court_id = Column(
        Integer, ForeignKey("courts.id"),
        nullable=False
    )

    case_number = Column(
        String(100), nullable=False
    )

    case_title = Column(
        String(200),
        nullable=False,
        default="Untitled Case"
    )

    # Case type - Civil, Criminal, Family, etc.
    case_type = Column(
        String(100), nullable=True
    )

    # Current stage of the case
    case_stage = Column(
        String(100), nullable=True
    )

    status = Column(
        String(30),
        default="Active",
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
