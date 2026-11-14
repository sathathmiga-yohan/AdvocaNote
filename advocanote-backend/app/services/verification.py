
import hashlib
import secrets
import smtplib

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.models.verification import Verification
from app.services.email import send_email


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def send_verification_email(db: Session, user: User):

    if user.is_email_verified or not user.is_active:
        return

    now = utc_now()

    last_token = db.scalar(
        select(Verification)
        .where(Verification.user_id == user.id)
        .order_by(Verification.id.desc())
        .limit(1)
    )

    # Avoid sending again within 2 minutes
    if last_token:
        if last_token.expires_at > now + timedelta(minutes=28):
            return

    token = secrets.token_urlsafe(32)

    token_hash = hashlib.sha256(
        token.encode()
    ).hexdigest()

    verification = Verification(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=now + timedelta(minutes=30),
        created_at=now
    )

    db.add(verification)
    db.commit()

    link = (
        f"{settings.FRONTEND_URL.rstrip('/')}"
        f"/verify-email?token={token}"
    )

    subject = "Verify Your AdvocaNote Account"

    body = f"""
Welcome to AdvocaNote!

Please verify your email using the link below:

{link}

This link expires in 30 minutes.

If you did not create this account, ignore this email.
"""

    try:
        send_email(user.email, subject, body)

    except (smtplib.SMTPException, OSError):
        db.execute(
            delete(Verification).where(
                Verification.token_hash == token_hash
            )
        )
        db.commit()

        raise HTTPException(
            status_code=503,
            detail="Email could not be sent. Please request a new verification email."
        )


def verify_email_token(db: Session, token: str):

    token_hash = hashlib.sha256(
        token.encode()
    ).hexdigest()

    verification = db.scalar(
        select(Verification)
        .where(Verification.token_hash == token_hash)
        .with_for_update()
    )

    if not verification:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired verification link"
        )

    if verification.expires_at <= utc_now():
        db.delete(verification)
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Invalid or expired verification link"
        )

    user = db.get(User, verification.user_id)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=400,
            detail="Invalid verification link"
        )

    user.is_email_verified = True

    db.execute(
        delete(Verification).where(
            Verification.user_id == user.id
        )
    )

    db.commit()

    return {
        "message": "Email verified successfully"
    }
