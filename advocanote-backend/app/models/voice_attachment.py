
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)

from app.database import Base


class DiaryVoiceAttachment(Base):
    __tablename__ = "diary_voice_attachments"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    diary_entry_id = Column(
        Integer,
        ForeignKey(
            "diary_entries.id",
            ondelete="CASCADE",
        ),
        unique=True,
        nullable=False,
        index=True,
    )

    lawyer_id = Column(
        Integer,
        nullable=False,
        index=True,
    )

    file_key = Column(
        String(100),
        nullable=False,
    )

    original_filename = Column(
        String(255),
        nullable=False,
    )

    mime_type = Column(
        String(120),
        nullable=False,
    )

    size_bytes = Column(
        Integer,
        nullable=False,
    )

    source_transcript = Column(
        Text,
        nullable=False,
    )

    reviewed_transcript = Column(
        Text,
        nullable=False,
    )

    ai_notes_json = Column(
        Text,
        nullable=False,
        default="[]",
    )

    highlights_json = Column(
        Text,
        nullable=False,
        default="[]",
    )

    approved_notes_json = Column(
        Text,
        nullable=False,
        default="[]",
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
