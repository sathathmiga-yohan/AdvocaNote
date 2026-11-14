
from pwdlib import PasswordHash
from datetime import datetime, timedelta, timezone

import jwt

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.session import LoginSession


password_hash = PasswordHash.recommended()


def hash_password(password: str):
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str):
    return password_hash.verify(
        password,
        hashed_password
    )


def create_access_token(user_id: int, session_id: int):

    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        "iat": now,
        "exp": now + timedelta(
            minutes=settings.JWT_ACCESS_MINUTES
        )
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm="HS256"
    )


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db)
):

    error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired session",
        headers={"WWW-Authenticate": "Bearer"}
    )

    if credentials is None:
        raise error

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
            options={"require": ["sub", "sid", "exp"]}
        )

        user_id = int(payload["sub"])
        session_id = int(payload["sid"])

    except (jwt.PyJWTError, ValueError, TypeError):
        raise error

    session = db.get(LoginSession, session_id)

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if (
        session is None
        or session.user_id != user_id
        or session.revoked_at is not None
        or session.expires_at <= now
    ):
        raise error

    user = db.get(User, user_id)

    # Allow active registered lawyers.
    # Email verification is not required for the current
    # automatic-login registration flow.
    if (
        user is None
        or not user.is_active
    ):
        raise error

    return user
