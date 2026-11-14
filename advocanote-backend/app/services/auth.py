
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.auth import Register, Login
from app.auth.security import hash_password, verify_password, create_access_token


import hashlib
import secrets

from datetime import datetime, timedelta, timezone

from app.config import settings
from app.models.session import LoginSession


def register_user(db: Session, data: Register):

    existing_user = db.scalar(
        select(User).where(
            User.email == data.email
        )
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    new_user = User(
        full_name=data.full_name,
        email=data.email,
        password_hash=hash_password(data.password),
        role="lawyer",
        is_email_verified=False,
        is_active=True
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    return new_user


def login_user(db: Session, data: Login):

    email = str(data.email).lower()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    if (
        user is None
        or user.password_hash is None
        or not verify_password(
            data.password,
            user.password_hash
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Email verification pending irundhaalum
    # correct password use panni login pannalaam.
    # is_email_verified status unchanged.

    return create_login_session(db, user)


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hash_token(token: str):
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def create_login_session(db: Session, user: User):

    now = utc_now()

    refresh_token = secrets.token_urlsafe(48)

    session = LoginSession(
        user_id=user.id,
        token_hash=hash_token(refresh_token),
        expires_at=now + timedelta(
            days=settings.JWT_REFRESH_DAYS
        ),
        created_at=now
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    access_token = create_access_token(
        user.id,
        session.id
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "role": user.role
    }


def refresh_user_session(db: Session, refresh_token: str):

    token_hash = hash_token(refresh_token)

    session = db.scalar(
        select(LoginSession)
        .where(LoginSession.token_hash == token_hash)
        .with_for_update()
    )

    now = utc_now()

    if (
        session is None
        or session.revoked_at is not None
        or session.expires_at <= now
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token"
        )

    user = db.get(User, session.user_id)

    if (
        user is None
        or not user.is_active
    ):
        raise HTTPException(
            status_code=401,
            detail="Account is not available"
        )

    # Email verification pending irundhaalum
    # valid session refresh aagum.

    new_refresh_token = secrets.token_urlsafe(48)

    session.token_hash = hash_token(new_refresh_token)

    db.commit()

    access_token = create_access_token(
        user.id,
        session.id
    )

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "role": user.role
    }


def logout_user(db: Session, refresh_token: str):

    token_hash = hash_token(refresh_token)

    session = db.scalar(
        select(LoginSession)
        .where(LoginSession.token_hash == token_hash)
        .with_for_update()
    )

    if session and session.revoked_at is None:
        session.revoked_at = utc_now()
        db.commit()

    return {
        "message": "Logged out successfully"
    }
