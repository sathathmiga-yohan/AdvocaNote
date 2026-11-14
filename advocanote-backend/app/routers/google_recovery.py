
import hashlib
import time
from datetime import datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
)

from google.auth.transport.requests import (
    Request as GoogleRequest,
)
from google.oauth2 import id_token

from pydantic import BaseModel, EmailStr, Field
from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.security import hash_password
from app.models.user import User
from app.models.session import LoginSession
from app.models.auth_token import AuthToken
from app.rate_limit import limiter


# Get UTC time locally.
# No need to import utcnow from user.py.
def utcnow():
    return datetime.now(timezone.utc).replace(
        tzinfo=None
    )


# Read Google Client ID from .env.
class GoogleRecoverySettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    GOOGLE_CLIENT_ID: str = ""


settings = GoogleRecoverySettings()

router = APIRouter(tags=["Password Recovery"])


class GoogleResetIn(BaseModel):
    email: EmailStr
    credential: str = Field(min_length=20)
    new_password: str = Field(
        min_length=8,
        max_length=128,
    )


@router.post("/auth/google-reset-password")
@limiter.limit("3/minute")
def google_reset_password(
    request: Request,
    body: GoogleResetIn,
    db: Session = Depends(get_db),
):
    # 1. Check Google configuration.
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google recovery is not configured.",
        )

    # 2. Verify Google's signed credential.
    try:
        google_user = id_token.verify_oauth2_token(
            body.credential,
            GoogleRequest(),
            settings.GOOGLE_CLIENT_ID,
        )

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Google verification failed.",
        )

    google_email = str(
        google_user.get("email", "")
    ).lower()

    form_email = str(body.email).lower()

    # 3. Verify email ownership.
    if (
        not google_user.get("email_verified")
        or not google_user.get("sub")
        or google_email != form_email
    ):
        raise HTTPException(
            status_code=403,
            detail="Unable to verify account ownership.",
        )

    # 4. Check credential age.
    issued_at = int(
        google_user.get("iat", 0)
    )

    current_time = int(time.time())

    if (
        issued_at < current_time - 300
        or issued_at > current_time + 60
    ):
        raise HTTPException(
            status_code=403,
            detail="Google verification expired. Try again.",
        )

    # 5. Find existing lawyer account.
    user = (
        db.query(User)
        .filter(
            func.lower(User.email) == form_email
        )
        .first()
    )

    if (
        user is None
        or not user.is_active
        or not user.is_verified
    ):
        raise HTTPException(
            status_code=403,
            detail="Google recovery is unavailable for this account.",
        )

    # 6. Check linked Google identity.
    linked_google_id = getattr(
        user,
        "google_sub",
        None,
    )

    if not linked_google_id:
        linked_google_id = getattr(
            user,
            "google_id",
            None,
        )

    if linked_google_id:
        if linked_google_id != google_user["sub"]:
            raise HTTPException(
                status_code=403,
                detail="Google recovery is unavailable for this account.",
            )

    else:
        # Only accept Google-authoritative
        # email identities when not linked.
        workspace_domain = str(
            google_user.get("hd", "")
        ).lower()

        authoritative = (
            google_email.endswith("@gmail.com")
            or (
                bool(workspace_domain)
                and google_email.endswith(
                    "@" + workspace_domain
                )
            )
        )

        if not authoritative:
            raise HTTPException(
                status_code=403,
                detail="Google recovery is unavailable for this account.",
            )

    # 7. Prevent credential reuse.
    credential_hash = hashlib.sha256(
        body.credential.encode("utf-8")
    ).hexdigest()

    already_used = (
        db.query(AuthToken)
        .filter(
            AuthToken.token_hash == credential_hash
        )
        .first()
    )

    if already_used:
        raise HTTPException(
            status_code=403,
            detail="Verification already used. Try again.",
        )

    now = utcnow()

    used_credential = AuthToken(
        user_id=user.id,
        purpose="google_password_reset_used",
        token_hash=credential_hash,
        expires_at=now + timedelta(hours=1),
        used_at=now,
    )

    db.add(used_credential)

    # 8. Hash and update password.
    user.password_hash = hash_password(
        body.new_password
    )

    # 9. Invalidate existing JWT tokens.
    user.token_version = (
        user.token_version or 0
    ) + 1

    # 10. Revoke existing refresh sessions.
    db.query(LoginSession).filter(
        LoginSession.user_id == user.id,
        LoginSession.revoked_at.is_(None),
    ).update(
        {
            LoginSession.revoked_at: now
        },
        synchronize_session=False,
    )

    # 11. Invalidate existing reset tokens.
    db.query(AuthToken).filter(
        AuthToken.user_id == user.id,
        AuthToken.purpose == "reset",
        AuthToken.used_at.is_(None),
    ).update(
        {
            AuthToken.used_at: now
        },
        synchronize_session=False,
    )

    db.commit()

    return {
        "message": "Password reset successfully."
    }
