
from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    Time,
    Text,
    ForeignKey,
)

from app.database import Base


class CalendarCustomEvent(Base):
    __tablename__ = "calendar_custom_events"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    lawyer_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    title = Column(
        String(120),
        nullable=False,
    )

    event_date = Column(
        Date,
        nullable=False,
        index=True,
    )

    event_time = Column(
        Time,
        nullable=True,
    )

    kind = Column(
        String(32),
        nullable=False,
        default="Meeting",
    )

    notes = Column(
        Text,
        nullable=False,
        default="",
    )
