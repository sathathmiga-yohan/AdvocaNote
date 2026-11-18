
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime,
    ForeignKey, Integer, String, Text, Time
)

from app.database import Base
from app.models.user import User


USER_FK = f"{User.__tablename__}.id"


class DiaryEntry(Base):
    __tablename__ = "diary_entries"

    id = Column(Integer, primary_key=True, index=True)
    lawyer_id = Column(
        Integer, ForeignKey(USER_FK),
        nullable=False, index=True
    )
    case_id = Column(
        Integer, ForeignKey("cases.id"), nullable=False
    )
    court_id = Column(
        Integer, ForeignKey("courts.id"), nullable=False
    )

    # Important for date-wise diary entries
    entry_date = Column(Date, nullable=False, index=True)

    previous_date = Column(Date, nullable=True)
    step_type = Column(
        String(40), default="Other", nullable=False
    )

    # Original proceedings - never overwritten by AI
    step_notes = Column(Text, nullable=False)

    # Optional point-wise version
    point_notes = Column(Text, nullable=True)

    input_method = Column(
        String(10), default="manual", nullable=False
    )
    next_date = Column(Date, nullable=True)

    created_at = Column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
class DiaryAIAnalysis(Base):
    __tablename__ = "diary_ai_analyses"

    diary_entry_id = Column(
        Integer,
        ForeignKey("diary_entries.id", ondelete="CASCADE"),
        primary_key=True,
    )

    notes_json = Column(Text, nullable=False)
    highlights_json = Column(Text, nullable=False)

    output_language = Column(
        String(2),
        nullable=False,
        default="ta",
    )

    analysis_incomplete = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

# Existing imports continue to work.

from app.models.court import Court
from app.models.case import Case
from app.models.hearing import Hearing
from app.models.task import Task
from app.models.reminder import Reminder
from app.models.aisuggestion import AISuggestion
