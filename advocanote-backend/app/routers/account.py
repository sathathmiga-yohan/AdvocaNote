
import hashlib
import logging
import re
import secrets
import stripe
from app.config import settings

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)

from sqlalchemy import (
    delete,
    func,
    select,
    update,
)

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google.auth.exceptions import GoogleAuthError

from app.config import settings
from app.database import get_db

from app.auth.security import (
    get_current_user,
    hash_password,
    verify_password,
)

from app.models.user import User
from app.models.session import LoginSession
from app.models.subscription import Subscription
from app.models.account_deletion import AccountDeletion
from app.models.account_recovery_token import AccountRecoveryToken

from app.services.email import send_email


# ==========================================
# ROUTER
# ==========================================

router = APIRouter(
    prefix="/account",
    tags=["Account Management"],
)

logger = logging.getLogger(__name__)


# ==========================================
# HELPERS
# ==========================================

def utc_now():
    return datetime.now(timezone.utc).replace(
        tzinfo=None
    )


def hash_recovery_token(token: str):
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def normalize_email(email: str):
    email = email.strip().lower()

    if (
        len(email) > 254
        or not re.fullmatch(
            r"[^@\s]+@[^@\s]+\.[^@\s]+",
            email,
        )
    ):
        raise HTTPException(
            status_code=400,
            detail="Enter a valid email address.",
        )

    return email


def validate_new_password(password: str):
    if (
        len(password) < 12
        or not any(c.isalpha() for c in password)
        or not any(c.isdigit() for c in password)
        or not any(not c.isalnum() for c in password)
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Password must contain at least "
                "12 characters, including letters, "
                "numbers and symbols."
            ),
        )


def revoke_all_sessions(db: Session, user_id: int):
    db.execute(
        update(LoginSession)
        .where(
            LoginSession.user_id == user_id,
            LoginSession.revoked_at.is_(None),
        )
        .values(revoked_at=utc_now())
    )


def invalidate_recovery_tokens(
    db: Session,
    user_id: int,
):
    db.execute(
        update(AccountRecoveryToken)
        .where(
            AccountRecoveryToken.user_id == user_id,
            AccountRecoveryToken.used_at.is_(None),
        )
        .values(used_at=utc_now())
    )


def get_closed_account_record(
    db: Session,
    user_id: int,
    lock: bool = False,
):
    statement = select(AccountDeletion).where(
        AccountDeletion.original_user_id == user_id,
        AccountDeletion.status == "pending_purge",
    )

    if lock:
        statement = statement.with_for_update()

    return db.scalar(statement)


# ==========================================
# REQUEST SCHEMAS
# ==========================================

class DeleteAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirmation: str
    password: str | None = None


class RecoveryEmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(
        min_length=3,
        max_length=254,
    )


class RecoveryCompleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(
        min_length=30,
        max_length=300,
    )

    choice: Literal["restore", "fresh"]

    old_password: str = Field(
        default="",
        max_length=1024,
    )

    google_credential: str = Field(
        default="",
        max_length=8192,
    )

    full_name: str = Field(
        default="",
        max_length=150,
    )

    new_password: str = Field(
        default="",
        max_length=1024,
    )


# ==========================================
# 1. CLOSE MY ACCOUNT
# ==========================================

@router.delete("/me")
def close_my_account(
    data: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    # Lawyers only
    if current_user.role != "lawyer":
        raise HTTPException(
            status_code=403,
            detail=(
                "Only lawyer accounts can "
                "use this action."
            ),
        )

    # Explicit confirmation
    if data.confirmation != "DELETE":
        raise HTTPException(
            status_code=400,
            detail="Type DELETE to confirm.",
        )

    # Verify existing account password
    if current_user.password_hash is not None:
        if (
            not data.password
            or not verify_password(
                data.password,
                current_user.password_hash,
            )
        ):
            raise HTTPException(
                status_code=401,
                detail="Incorrect account password.",
            )

    # Lock the lawyer account
    user = db.scalar(
        select(User)
        .where(User.id == current_user.id)
        .with_for_update()
    )

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is not active.",
        )

    # --------------------------------------
    # CHECK ACTIVE STRIPE SUBSCRIPTIONS
    # --------------------------------------

    subscription = db.scalar(
        select(Subscription).where(
            Subscription.user_id == user.id
        )
    )

    closed_statuses = {
        "canceled",
        "cancelled",
        "expired",
        "incomplete_expired",
    }

    if (
        subscription is not None
        and subscription.stripe_subscription_id
    ):
        # Verify real cancellation status from Stripe.
        if not settings.STRIPE_SECRET_KEY:
            raise HTTPException(
                status_code=503,
                detail="Stripe is not configured.",
            )

        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:
            stripe_subscription = stripe.Subscription.retrieve(
                subscription.stripe_subscription_id
            ).to_dict()
        except Exception:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Unable to verify subscription cancellation "
                    "with Stripe. Please try again."
                ),
            )

        stripe_status = str(
            stripe_subscription.get("status") or ""
        ).lower()

        cancellation_scheduled = (
            stripe_subscription.get("cancel_at_period_end")
            is True
        )

        if (
            stripe_status not in closed_statuses
            and not cancellation_scheduled
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Your Stripe subscription is still "
                    "set to renew. Please cancel the "
                    "subscription before closing your account."
                ),
            )

        # Stripe has confirmed cancellation
        # or cancellation at the end of this period.
        subscription.status = stripe_status
        subscription.cancel_at_period_end = (
            cancellation_scheduled
        )

    # --------------------------------------
    # RECORD ACCOUNT CLOSURE
    # --------------------------------------

    existing = db.scalar(
        select(AccountDeletion)
        .where(
            AccountDeletion.original_user_id
            == user.id
        )
        .with_for_update()
    )

    if existing is None:
        db.add(
            AccountDeletion(
                original_user_id=user.id,
                status="pending_purge",
                requested_at=utc_now(),
            )
        )

    else:
        existing.status = "pending_purge"
        existing.requested_at = utc_now()

    # Disable account
    user.is_active = False

    # Revoke all login sessions
    revoke_all_sessions(db, user.id)

    # Invalidate previous recovery links
    invalidate_recovery_tokens(db, user.id)

    db.commit()

    return {
        "message": (
            "Account closed successfully. "
            "Your previous records are retained "
            "for possible account recovery."
        ),
        "status": "closed",
    }


# ==========================================
# 2. ADMIN - ACCOUNT CLOSURE RECORDS
# ==========================================

@router.get("/admin/deletions")
def get_account_deletions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )

    records = db.scalars(
        select(AccountDeletion)
        .order_by(
            AccountDeletion.requested_at.desc()
        )
    ).all()

    return {
        "deletions": [
            {
                "id": item.id,
                "user_id": item.original_user_id,
                "status": item.status,
                "requested_at": item.requested_at,
            }
            for item in records
        ]
    }


# ==========================================
# 3. VERIFY PREVIOUS ACCOUNT IDENTITY
# ==========================================

def verify_recovery_identity(
    user: User,
    data: RecoveryCompleteRequest,
):
    # --------------------------------------
    # GOOGLE ACCOUNT VERIFICATION
    # --------------------------------------

    if data.google_credential:

        if not user.google_sub:
            raise HTTPException(
                status_code=401,
                detail="Previous account verification failed.",
            )

        client_id = getattr(
            settings,
            "GOOGLE_CLIENT_ID",
            None,
        )

        if not client_id:
            raise HTTPException(
                status_code=503,
                detail="Google login is not configured.",
            )

        try:
            google_data = (
                id_token.verify_oauth2_token(
                    data.google_credential,
                    google_requests.Request(),
                    client_id,
                )
            )

        except ValueError:
            raise HTTPException(
                status_code=401,
                detail="Invalid Google identity.",
            )

        except GoogleAuthError:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Google verification is temporarily "
                    "unavailable."
                ),
            )

        google_sub = str(
            google_data.get("sub") or ""
        )

        google_email = str(
            google_data.get("email") or ""
        ).strip().lower()

        email_verified = (
            str(
                google_data.get(
                    "email_verified",
                    False,
                )
            ).lower() == "true"
        )

        if (
            not email_verified
            or google_sub != str(user.google_sub)
            or google_email != str(
                user.email
            ).strip().lower()
        ):
            raise HTTPException(
                status_code=401,
                detail="Google account does not match.",
            )

        return "google"

    # --------------------------------------
    # PASSWORD ACCOUNT VERIFICATION
    # --------------------------------------

    if (
        user.password_hash
        and data.old_password
        and verify_password(
            data.old_password,
            user.password_hash,
        )
    ):
        return "password"

    raise HTTPException(
        status_code=401,
        detail="Previous account verification failed.",
    )


# ==========================================
# 4. REQUEST ACCOUNT RECOVERY EMAIL
# ==========================================

@router.post("/recovery/request")
def request_account_recovery(
    data: RecoveryEmailRequest,
    db: Session = Depends(get_db),
):

    email = normalize_email(data.email)

    # Same response for known/unknown emails.
    generic_response = {
        "message": (
            "If this email belongs to a closed "
            "AdvocaNote account, a recovery "
            "link will be sent."
        )
    }

    # --------------------------------------
    # FIND CLOSED ACCOUNT
    # --------------------------------------

    user = db.scalar(
        select(User)
        .where(
            func.lower(User.email) == email,
            User.role == "lawyer",
        )
        .with_for_update()
    )

    if user is None or user.is_active:
        return generic_response

    deletion_record = get_closed_account_record(
        db,
        user.id,
    )

    if deletion_record is None:
        return generic_response

    now = utc_now()

    # --------------------------------------
    # EMAIL RATE LIMITING
    # --------------------------------------

    last_token = db.scalar(
        select(AccountRecoveryToken)
        .where(
            AccountRecoveryToken.user_id == user.id
        )
        .order_by(
            AccountRecoveryToken.created_at.desc()
        )
        .limit(1)
    )

    # Minimum 2 minutes between requests
    if (
        last_token is not None
        and last_token.created_at
        > now - timedelta(minutes=2)
    ):
        return generic_response

    # Maximum 5 recovery emails in 24 hours
    daily_requests = db.scalar(
        select(func.count(AccountRecoveryToken.id))
        .where(
            AccountRecoveryToken.user_id == user.id,
            AccountRecoveryToken.created_at
            >= now - timedelta(hours=24),
        )
    ) or 0

    if daily_requests >= 5:
        return generic_response

    # --------------------------------------
    # GENERATE SECURE TOKEN
    # --------------------------------------

    token = secrets.token_urlsafe(32)

    token_hash = hash_recovery_token(token)

    # Older recovery links become invalid.
    invalidate_recovery_tokens(
        db,
        user.id,
    )

    recovery = AccountRecoveryToken(
        user_id=user.id,
        token_hash=token_hash,
        created_at=now,
        expires_at=(
            now + timedelta(minutes=30)
        ),
    )

    db.add(recovery)

    recipient_email = user.email

    # Save the token before sending email.
    db.commit()

    # --------------------------------------
    # SEND REAL RECOVERY EMAIL
    # --------------------------------------

    recovery_link = (
        f"{settings.FRONTEND_URL.rstrip('/')}"
        f"/rejoin-account?token={token}"
    )

    subject = (
        "AdvocaNote - Account Recovery"
    )

    body = f"""
Hello,

We received a request to access your
previously closed AdvocaNote account.

Open the secure recovery link below:

{recovery_link}

After opening the link, you can choose:

1. Restore My Data
   Restore your previous account,
   cases, diary entries, tasks and hearings.

2. Start Fresh
   Create a new account without bringing
   back previous records.

For security, you must also verify
your previous account identity.

This link expires in 30 minutes.

If you did not request this,
you can safely ignore this email.

AdvocaNote Team
"""

    try:
        send_email(
            recipient_email,
            subject,
            body,
        )

    except Exception:
        # Do not expose account existence.
        # Invalidate token if email delivery fails.
        logger.error(
            "Account recovery email delivery failed "
            "for user ID %s",
            user.id,
        )

        db.execute(
            update(AccountRecoveryToken)
            .where(
                AccountRecoveryToken.token_hash
                == token_hash,
                AccountRecoveryToken.used_at.is_(None),
            )
            .values(used_at=utc_now())
        )

        db.commit()

    return generic_response


# ==========================================
# 5. COMPLETE ACCOUNT RECOVERY
# ==========================================

@router.post("/recovery/complete")
def complete_account_recovery(
    data: RecoveryCompleteRequest,
    db: Session = Depends(get_db),
):

    token_hash = hash_recovery_token(
        data.token.strip()
    )

    # --------------------------------------
    # FIND AND LOCK RECOVERY TOKEN
    # --------------------------------------

    recovery = db.scalar(
        select(AccountRecoveryToken)
        .where(
            AccountRecoveryToken.token_hash
            == token_hash
        )
        .with_for_update()
    )

    if (
        recovery is None
        or recovery.used_at is not None
        or recovery.expires_at <= utc_now()
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid, expired or already "
                "used recovery link."
            ),
        )

    # --------------------------------------
    # FIND ORIGINAL LAWYER
    # --------------------------------------

    user = db.scalar(
        select(User)
        .where(
            User.id == recovery.user_id,
            User.role == "lawyer",
        )
        .with_for_update()
    )

    if user is None or user.is_active:
        raise HTTPException(
            status_code=400,
            detail="Account recovery is unavailable.",
        )

    deletion_record = get_closed_account_record(
        db,
        user.id,
        lock=True,
    )

    if deletion_record is None:
        raise HTTPException(
            status_code=400,
            detail="Account recovery is unavailable.",
        )

    # --------------------------------------
    # VERIFY ORIGINAL ACCOUNT OWNERSHIP
    # --------------------------------------

    try:
        verified_method = (
            verify_recovery_identity(
                user,
                data,
            )
        )

    except HTTPException as error:
        # Do not consume the token when Google's
        # verification service is unavailable.
        if error.status_code == 503:
            raise

        # A failed ownership check consumes
        # this link to prevent repeated guesses.
        recovery.used_at = utc_now()
        db.commit()

        raise HTTPException(
            status_code=401,
            detail=(
                "Previous account verification "
                "failed. Request a new recovery link."
            ),
        )

    # ======================================
    # OPTION 1 - RESTORE PREVIOUS DATA
    # ======================================

    if data.choice == "restore":

        # Reactivate the ORIGINAL account.
        # Same user ID means old records stay linked.
        user.is_active = True
        user.is_email_verified = True

        # Update closure audit
        deletion_record.status = "restored"

        # Existing sessions remain revoked.
        revoke_all_sessions(db, user.id)

        # Consume all recovery links.
        invalidate_recovery_tokens(
            db,
            user.id,
        )

        db.commit()

        return {
            "status": "restored",
            "user_id": user.id,
            "message": (
                "Your previous AdvocaNote "
                "account has been restored. "
                "Your existing records remain "
                "linked to your account. "
                "Please sign in again."
            ),
        }

    # ======================================
    # OPTION 2 - START FRESH ACCOUNT
    # ======================================

    new_name = data.full_name.strip()

    if not 2 <= len(new_name) <= 150:
        raise HTTPException(
            status_code=400,
            detail=(
                "Enter your full name "
                "(2 to 150 characters)."
            ),
        )

    new_password = data.new_password

    # Password-verified users must provide
    # a new password for their new account.
    if (
        verified_method == "password"
        and not new_password
    ):
        raise HTTPException(
            status_code=400,
            detail="Enter a new account password.",
        )

    if new_password:
        validate_new_password(new_password)

    old_email = user.email
    old_google_sub = user.google_sub

    # --------------------------------------
    # PRESERVE PREVIOUS LEGAL RECORDS
    # --------------------------------------

    try:
        # The old user stays disabled.
        # Its original ID is never changed.
        user.is_active = False

        # Release the original email for the
        # new user's account.
        user.email = (
            f"closed-{user.id}-"
            f"{secrets.token_hex(12)}"
            "@closed.invalid"
        )

        # Only transfer Google's identity when
        # the original Google identity was verified.
        user.google_sub = None

        # Original cases, diary entries, tasks,
        # hearings, payments and attachments
        # are NOT deleted or moved.
        db.flush()

        # ----------------------------------
        # CREATE A COMPLETELY NEW USER
        # ----------------------------------

        new_user = User(
            full_name=new_name,
            email=old_email,
            password_hash=(
                hash_password(new_password)
                if new_password
                else None
            ),
            google_sub=(
                old_google_sub
                if verified_method == "google"
                else None
            ),
            role="lawyer",
            is_email_verified=True,
            is_active=True,
        )

        db.add(new_user)
        db.flush()

        # Old login sessions remain revoked.
        revoke_all_sessions(db, user.id)

        # Old recovery links cannot be reused.
        invalidate_recovery_tokens(
            db,
            user.id,
        )

        # Old account remains Closed in admin.
        # New account appears Active.
        deletion_record.status = "pending_purge"

        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Could not create a fresh account. "
                "Please try again."
            ),
        )

    except Exception:
        db.rollback()
        logger.exception(
            "Fresh account recovery transaction failed"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not complete account recovery."
            ),
        )

    return {
        "status": "fresh",
        "user_id": new_user.id,
        "message": (
            "Your new AdvocaNote account "
            "has been created successfully. "
            "Your previous records remain "
            "separate from this account. "
            "Please sign in."
        ),
    }
