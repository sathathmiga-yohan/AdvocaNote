
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime,
    ForeignKey, Integer, String, Text, Time
)

from app.database import Base
from app.models.user import User


USER_FK = f"{User.__tablename__}.id"


class Court(Base):
    __tablename__ = "courts"

    id = Column(Integer, primary_key=True, index=True)
    court_name = Column(String(150), nullable=False)
    location = Column(String(150), nullable=False)
    court_type = Column(String(100), nullable=True)
    created_by = Column(
        Integer, ForeignKey(USER_FK), nullable=False
    )
    created_at = Column(
        DateTime, default=datetime.utcnow, nullable=False
    )
