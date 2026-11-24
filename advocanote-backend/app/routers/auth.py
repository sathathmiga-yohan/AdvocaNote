
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User

from app.schemas.auth import (
    Register,
    UserResponse,
    VerifyEmail,
    VerifyRegistrationOTP,
    RegistrationPendingResponse,
    ResendVerification,
    Login, 
    LoginResponse,
    RefreshRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    GoogleLoginRequest
)


from app.services.auth import (
    register_user,
    login_user,
    refresh_user_session,
    logout_user,
    create_login_session,
    REGISTRATION_OTP_PENDING,
)
from app.services.google import google_login
from app.services.reset import (
    request_password_reset,
    reset_user_password
)

from app.services.verification import (
    send_verification_email,
    verify_email_token,
    send_registration_otp,
    verify_registration_otp,
)

from app.auth.security import get_current_user

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.post(
    "/register",
    response_model=LoginResponse | RegistrationPendingResponse,
    status_code=status.HTTP_201_CREATED
)
def register(
    data: Register,
    db: Session = Depends(get_db)
):

    user = register_user(db, data)

    if user.onboarding_status == REGISTRATION_OTP_PENDING:
        return send_registration_otp(db, user.id)
    return create_login_session(db, user)


@router.post("/verify-registration", response_model=LoginResponse)
def verify_registration(
    data: VerifyRegistrationOTP,
    db: Session = Depends(get_db),
):
    user = verify_registration_otp(db, data)
    return create_login_session(db, user)


@router.post("/verify-email")
def verify_email(
    data: VerifyEmail,
    db: Session = Depends(get_db)
):

    return verify_email_token(db, data.token)


@router.post("/resend-verification")
def resend_verification(
    data: ResendVerification,
    db: Session = Depends(get_db)
):

    user = db.scalar(
        select(User).where(
            User.email == str(data.email).lower()
        )
    )

    if (
        user and user.is_active and not user.is_email_verified
        and user.onboarding_status != REGISTRATION_OTP_PENDING
    ):
        try:
            send_verification_email(db, user)
        except HTTPException:
            pass

    return {
        "message": (
            "If this account requires verification, "
            "a verification email will be sent."
        )
    }


@router.post(
    "/login",
    response_model=LoginResponse
)
def login(
    data: Login,
    db: Session = Depends(get_db)
):
    return login_user(db, data)


@router.get(
    "/me",
    response_model=UserResponse
)
def get_me(
    current_user: User = Depends(get_current_user)
):
    return current_user


@router.post(
    "/refresh",
    response_model=LoginResponse
)
def refresh(
    data: RefreshRequest,
    db: Session = Depends(get_db)
):
    return refresh_user_session(
        db,
        data.refresh_token
    )


@router.post("/logout")
def logout(
    data: RefreshRequest,
    db: Session = Depends(get_db)
):
    return logout_user(
        db,
        data.refresh_token
    )


@router.post("/forgot-password")
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):

    return request_password_reset(
        db,
        data.email
    )


@router.post("/reset-password")
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db)
):

    return reset_user_password(
        db,
        data.token,
        data.new_password
    )


@router.post(
    "/google",
    response_model=LoginResponse
)
def login_with_google(
    data: GoogleLoginRequest,
    db: Session = Depends(get_db)
):

    return google_login(
        db,
        data.credential
    )
