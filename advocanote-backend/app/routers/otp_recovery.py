
import hashlib
import hmac
import logging
import re
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import reset as svc

logger = logging.getLogger(__name__)


class OTPSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    OTP_SECRET_KEY: str = ""


otp_settings = OTPSettings()

router = APIRouter(
    prefix="/auth/forgot-password",
    tags=["OTP Password Recovery"],
)


class EmailRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
    )


class ResetOTPRequest(BaseModel):
    reset_token: str = Field(min_length=20)
    new_password: str = Field(
        min_length=8,
        max_length=128,
    )

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value):
        if not (
            re.search(r"[A-Za-z]", value)
            and re.search(r"\d", value)
            and re.search(r"[^A-Za-z0-9\s]", value)
        ):
            raise ValueError(
                "Password requires a letter, number and symbol."
            )

        if any(ord(char) < 32 for char in value):
            raise ValueError(
                "Password contains invalid characters."
            )

        return value


GENERIC_RESPONSE = {
    "message": (
        "If this email is registered, "
        "a verification code has been sent."
    )
}


def require_otp_secret():
    if len(otp_settings.OTP_SECRET_KEY) < 32:
        raise HTTPException(
            status_code=503,
            detail="OTP recovery is not configured.",
        )


def hash_otp(record_id, user_id, otp):
    message = (
        f"advocanote-otp:{record_id}:{user_id}:{otp}"
    ).encode("utf-8")

    return hmac.new(
        otp_settings.OTP_SECRET_KEY.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()


# -----------------------------------------
# STEP 1 - SEND 6 DIGIT OTP
# -----------------------------------------

@router.post("/request-otp")
def request_otp(
    data: EmailRequest,
    db: Session = Depends(get_db),
):
    require_otp_secret()

    email = str(data.email).strip().lower()
    now = svc.utc_now()

    user = db.scalar(
        select(svc.User)
        .where(svc.User.email == email)
        .with_for_update()
    )

    if user is None or not user.is_active:
        db.rollback()
        return GENERIC_RESPONSE

    # Maximum 3 requests per hour per account.
    recent_count = db.scalar(
        select(func.count(svc.PasswordReset.id))
        .where(
            svc.PasswordReset.user_id == user.id,
            svc.PasswordReset.created_at
            >= now - timedelta(hours=1),
        )
    )

    if recent_count >= 3:
        db.rollback()
        return GENERIC_RESPONSE

    # At least 60 seconds between requests.
    last_request = db.scalar(
        select(svc.PasswordReset)
        .where(
            svc.PasswordReset.user_id == user.id
        )
        .order_by(
            svc.PasswordReset.created_at.desc(),
            svc.PasswordReset.id.desc(),
        )
        .limit(1)
    )

    if (
        last_request is not None
        and last_request.created_at is not None
        and last_request.created_at
        > now - timedelta(seconds=60)
    ):
        db.rollback()
        return GENERIC_RESPONSE

    # Invalidate earlier unused recovery tokens.
    db.execute(
        update(svc.PasswordReset)
        .where(
            svc.PasswordReset.user_id == user.id,
            svc.PasswordReset.used_at.is_(None),
        )
        .values(used_at=now)
    )

    otp = f"{secrets.randbelow(1000000):06d}"

    # First create a unique record.
    # Then bind the OTP hash to that record ID.
    record = svc.PasswordReset(
        user_id=user.id,
        token_hash=secrets.token_hex(32),
        expires_at=now + timedelta(minutes=10),
        created_at=now,
    )

    db.add(record)
    db.flush()

    record.token_hash = hash_otp(
        record.id,
        user.id,
        otp,
    )

    db.commit()

    subject = "AdvocaNote Password Reset OTP"

    body = (
        f"Hello {user.full_name},\n\n"
        "Your AdvocaNote password reset code is:\n\n"
        f"{otp}\n\n"
        "This code expires in 10 minutes.\n"
        "If you did not request this code, "
        "please ignore this email.\n\n"
        "AdvocaNote Team"
    )

    try:
        svc.send_email(
            user.email,
            subject,
            body,
        )
    except Exception:
        logger.exception("OTP email delivery failed")

        # Do not leave an undelivered OTP active.
        db.execute(
            update(svc.PasswordReset)
            .where(
                svc.PasswordReset.id == record.id,
                svc.PasswordReset.used_at.is_(None),
            )
            .values(used_at=svc.utc_now())
        )
        db.commit()

    return GENERIC_RESPONSE


# -----------------------------------------
# STEP 2 - VERIFY OTP
# -----------------------------------------

@router.post("/verify-otp")
def verify_otp(
    data: VerifyOTPRequest,
    db: Session = Depends(get_db),
):
    require_otp_secret()

    email = str(data.email).strip().lower()
    now = svc.utc_now()

    error = HTTPException(
        status_code=400,
        detail="Invalid or expired OTP. Request a new code.",
    )

    user = db.scalar(
        select(svc.User)
        .where(svc.User.email == email)
        .with_for_update()
    )

    if user is None or not user.is_active:
        db.rollback()
        raise error

    record = db.scalar(
        select(svc.PasswordReset)
        .where(
            svc.PasswordReset.user_id == user.id,
            svc.PasswordReset.used_at.is_(None),
        )
        .order_by(svc.PasswordReset.id.desc())
        .limit(1)
        .with_for_update()
    )

    if (
        record is None
        or record.expires_at <= now
    ):
        db.rollback()
        raise error

    expected_hash = hash_otp(
        record.id,
        user.id,
        data.otp,
    )

    if not hmac.compare_digest(
        record.token_hash,
        expected_hash,
    ):
        # No attempts column in your existing table.
        # For security, one incorrect attempt
        # invalidates this OTP.
        record.used_at = now
        db.commit()
        raise error

    # OTP verified.
    # Replace its hash with a secure,
    # short-lived reset token hash.
    reset_token = secrets.token_urlsafe(32)

    record.token_hash = svc.hash_reset_token(
        reset_token
    )

    record.expires_at = (
        now + timedelta(minutes=5)
    )

    db.commit()

    return {
        "message": "OTP verified successfully.",
        "reset_token": reset_token,
    }


# -----------------------------------------
# STEP 3 - RESET PASSWORD
# -----------------------------------------

@router.post("/reset-otp")
def reset_with_otp(
    data: ResetOTPRequest,
    db: Session = Depends(get_db),
):
    # Reuse your EXISTING secure reset function.
    # It hashes the password, invalidates
    # recovery tokens, and revokes sessions.
    try:
        return svc.reset_user_password(
            db,
            data.reset_token,
            data.new_password,
        )
    except HTTPException as error:
        if error.status_code == 400:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Verification expired. "
                    "Please request a new code."
                ),
            ) from error

        raise
