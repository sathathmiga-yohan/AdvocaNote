
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
)

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc).replace(
        tzinfo=None
    )


class AccountRecoveryToken(Base):
    __tablename__ = "account_recovery_tokens"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # Only the SHA-256 hash is stored.
    # Never store the actual email token.
    token_hash = Column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    expires_at = Column(
        DateTime,
        nullable=False,
    )

    used_at = Column(
        DateTime,
        nullable=True,
    )
