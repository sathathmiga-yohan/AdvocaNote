
import hashlib
import hmac
import secrets
import smtplib

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.models.verification import Verification
from app.auth.security import verify_password
from app.schemas.auth import VerifyRegistrationOTP
from app.services.auth import REGISTRATION_OTP_PENDING
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

    if not user or not user.is_active or user.onboarding_status == REGISTRATION_OTP_PENDING:
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

# Keep the attempt counter in the existing 64-character verification field.
# The prefix distinguishes OTPs from SHA-256 hashes of legacy email links.
_OTP_PREFIX = "otp:"
_OTP_ATTEMPTS = 5


def _registration_hash(user_id: int, created_at: datetime, code: str, attempts: int):
    digest = hmac.new(
        settings.JWT_SECRET_KEY.encode(),
        f"registration-otp:{user_id}:{created_at.isoformat()}:{code}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{_OTP_PREFIX}{attempts}:{digest[:58]}"


def _registration_verifications(user_id: int):
    return (
        select(Verification)
        .where(Verification.user_id == user_id, Verification.token_hash.startswith(_OTP_PREFIX))
        .order_by(Verification.id.desc())
        .with_for_update()
    )


def send_registration_otp(db: Session, user_id: int):
    user = db.get(User, user_id, with_for_update=True, populate_existing=True)
    if user is None or not user.is_active or user.onboarding_status != REGISTRATION_OTP_PENDING:
        raise HTTPException(status_code=409, detail="Registration is no longer pending. Please sign in.")

    now = utc_now().replace(microsecond=0)
    recent = db.scalars(
        _registration_verifications(user_id).where(Verification.created_at > now - timedelta(days=1))
    ).all()
    latest = recent[0] if recent else None
    verification_pending = (
        latest is not None
        and latest.expires_at > now
        and not latest.token_hash.startswith(f"{_OTP_PREFIX}{_OTP_ATTEMPTS}:")
    )
    if len(recent) >= 5:
        return {
            "verification_pending": verification_pending,
            "code_sent": False,
            "message": "Daily code limit reached. Try again after 24 hours.",
        }
    if latest is not None and latest.created_at > now - timedelta(minutes=2):
        return {
            "verification_pending": verification_pending,
            "code_sent": False,
            "message": "Wait two minutes between code requests.",
        }

    code = f"{secrets.randbelow(1_000_000):06d}"
    verification = Verification(
        user_id=user_id,
        token_hash=_registration_hash(user_id, now, code, 0),
        created_at=now,
        expires_at=now + timedelta(minutes=10),
    )
    recipient = user.email
    db.add(verification)
    db.flush()
    verification_id = verification.id
    db.commit()

    try:
        send_email(
            recipient,
            "Your AdvocaNote verification code",
            f"Your AdvocaNote verification code is {code}. It expires in 10 minutes. "
            "If you did not register for AdvocaNote, ignore this message.",
        )
    except (smtplib.SMTPException, OSError):
        # Retain this request for rate limiting, but prevent use of its code.
        failed = db.get(Verification, verification_id, with_for_update=True)
        if failed is not None:
            failed.expires_at = now
            db.commit()
        return {
            "verification_pending": False,
            "code_sent": False,
            "message": "Email could not be sent. Wait two minutes, then request a new code.",
        }

    return {
        "verification_pending": True,
        "code_sent": True,
        "message": "A verification code was sent to your email.",
    }


def verify_registration_otp(db: Session, data: VerifyRegistrationOTP):
    invalid = HTTPException(status_code=400, detail="Invalid or expired verification code.")
    user = db.scalar(
        select(User).where(User.email == str(data.email).lower()).with_for_update()
    )
    if (
        user is None or user.role != "lawyer" or not user.is_active
        or user.onboarding_status != REGISTRATION_OTP_PENDING
        or not user.password_hash or not verify_password(data.password, user.password_hash)
    ):
        raise invalid

    verification = db.scalar(_registration_verifications(user.id).limit(1))
    if verification is None or verification.expires_at <= utc_now():
        raise invalid
    _, stored_attempts, stored_digest = verification.token_hash.split(":", 2)
    attempts = int(stored_attempts)
    if attempts >= _OTP_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect codes. Request a new code.")
    digest = _registration_hash(user.id, verification.created_at, data.code, attempts)
    if not hmac.compare_digest(verification.token_hash, digest):
        verification.token_hash = f"{_OTP_PREFIX}{attempts + 1}:{stored_digest}"
        db.commit()
        raise invalid

    user.is_email_verified = True
    user.onboarding_status = "pending"
    db.execute(delete(Verification).where(Verification.user_id == user.id))
    # The caller issues the session in the same transaction.
    return user
