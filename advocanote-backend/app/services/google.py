from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from functools import partial
from time import perf_counter

from google.oauth2 import id_token
import requests as http_requests
import cachecontrol
from google.auth.transport import requests as google_requests
from google.auth.exceptions import GoogleAuthError, TransportError

from app.config import settings
from app.models.user import User
from app.services.auth import create_login_session, require_registration_verified


# Reuse and cache Google's public verification certificates
_google_session = cachecontrol.CacheControl(
    http_requests.Session()
)

_google_request = google_requests.Request(
    session=_google_session
)


def google_login(db: Session, credential: str):

    start_time = perf_counter()
    print("[Google] Verification started", flush=True)

    # 1. Verify Google ID token
    try:
        google_data = id_token.verify_oauth2_token(
            credential,
            partial(_google_request, timeout=10),
            settings.GOOGLE_CLIENT_ID
        )

    except TransportError as exc:
        print(
            f"[Google] Transport Error: {exc}",
            flush=True
        )

        raise HTTPException(
            status_code=503,
            detail="Google verification unavailable"
        )

    except (ValueError, GoogleAuthError) as exc:
        print(
            f"[Google] Verification Failed: "
            f"{type(exc).__name__}: {exc}",
            flush=True
        )

        raise HTTPException(
            status_code=401,
            detail="Invalid Google token"
        )

    # Verification time
    print(
        f"[Google] Verification took "
        f"{perf_counter() - start_time:.2f} seconds",
        flush=True
    )

    # 2. Get Google account details
    google_sub = google_data.get("sub")
    email = google_data.get("email")

    if not google_sub or not email:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google account"
        )

    if google_data.get("email_verified") is not True:
        raise HTTPException(
            status_code=403,
            detail="Google email not verified"
        )

    email = email.strip().lower()

    # 3. Check existing Google user
    user = db.scalar(
        select(User).where(
            User.google_sub == google_sub
        )
    )

    if user:
        if not user.is_active:
            raise HTTPException(
                status_code=403,
                detail="Account disabled"
            )

        return create_login_session(db, user)

    # 4. Check existing email/password account
    existing_user = db.scalar(
        select(User).where(
            User.email == email
        )
    )

    if existing_user:

        if not existing_user.is_active:
            raise HTTPException(
                status_code=403,
                detail="Account disabled"
            )

        require_registration_verified(existing_user)

        # Do not replace another linked Google account
        if existing_user.google_sub is not None:
            raise HTTPException(
                status_code=409,
                detail="Account is already linked to another Google account"
            )

        # Google must be authoritative for the email
        email_domain = email.rsplit("@", 1)[-1]
        hosted_domain = str(
            google_data.get("hd") or ""
        ).lower()

        google_is_authoritative = (
            email_domain == "gmail.com"
            or (
                bool(hosted_domain)
                and hosted_domain == email_domain
            )
        )

        if not google_is_authoritative:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Account already exists. "
                    "Please use your existing login method."
                )
            )

        # Link verified Google identity to existing account
        existing_user.google_sub = google_sub
        existing_user.is_email_verified = True

        try:
            db.commit()
            db.refresh(existing_user)

        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Google account could not be linked"
            )

        # Login with existing lawyer account
        return create_login_session(db, existing_user)

    # 5. Create new lawyer account
    full_name = (
        str(google_data.get("name") or "Google Lawyer")
        .strip()[:150]
    ) or "Google Lawyer"

    user = User(
        full_name=full_name,
        email=email,
        google_sub=google_sub,
        password_hash=None,
        role="lawyer",
        is_email_verified=True,
        is_active=True
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Account already exists"
        )

    # 6. Create login session and tokens
    return create_login_session(db, user)