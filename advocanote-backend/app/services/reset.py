
import hashlib
import logging
import secrets

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.config import settings
from app.models.user import User
from app.models.reset import PasswordReset
from app.models.session import LoginSession
from app.services.email import send_email


logger = logging.getLogger(__name__)


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hash_reset_token(token: str):
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def request_password_reset(db: Session, email: str):

    message = {
        "message": (
            "If the email is registered, "
            "a password reset link has been sent."
        )
    }

    user = db.scalar(
        select(User).where(
            User.email == str(email).lower()
        )
    )

    if user is None or not user.is_active:
        return message

    now = utc_now()

    # Invalidate previous unused reset links
    db.execute(
        update(PasswordReset)
        .where(
            PasswordReset.user_id == user.id,
            PasswordReset.used_at.is_(None)
        )
        .values(used_at=now)
    )

    # Generate a secure random token
    token = secrets.token_urlsafe(32)

    reset_record = PasswordReset(
        user_id=user.id,
        token_hash=hash_reset_token(token),
        expires_at=now + timedelta(minutes=15),
        created_at=now
    )

    db.add(reset_record)
    db.commit()

    # React reset password page URL
    reset_link = (
        f"{str(settings.FRONTEND_URL).rstrip('/')}"
        f"/reset-password?token={token}"
    )

    subject = "Reset your AdvocaNote password"

    body = (
        f"Hello {user.full_name},\n\n"
        "We received a request to reset your password.\n\n"
        "Open this link to create a new password:\n"
        f"{reset_link}\n\n"
        "This link expires in 15 minutes.\n"
        "If you did not request this, ignore this email.\n\n"
        "AdvocaNote Team"
    )

    try:
        send_email(user.email, subject, body)
    except Exception:
        logger.exception("Password reset email failed")

    return message


def reset_user_password(
    db: Session,
    token: str,
    new_password: str
):

    now = utc_now()

    reset_record = db.scalar(
        select(PasswordReset)
        .where(
            PasswordReset.token_hash == hash_reset_token(token)
        )
        .with_for_update()
    )

    error = HTTPException(
        status_code=400,
        detail="Invalid or expired reset link"
    )

    if (
        reset_record is None
        or reset_record.used_at is not None
        or reset_record.expires_at <= now
    ):
        raise error

    user = db.get(User, reset_record.user_id)

    if user is None or not user.is_active:
        raise error

    # Save the new hashed password
    user.password_hash = hash_password(new_password)

    # Invalidate every reset link for this user
    db.execute(
        update(PasswordReset)
        .where(
            PasswordReset.user_id == user.id,
            PasswordReset.used_at.is_(None)
        )
        .values(used_at=now)
    )

    # Log out all existing sessions
    db.execute(
        update(LoginSession)
        .where(
            LoginSession.user_id == user.id,
            LoginSession.revoked_at.is_(None)
        )
        .values(revoked_at=now)
    )

    db.commit()

    return {
        "message": "Password reset successfully"
    }