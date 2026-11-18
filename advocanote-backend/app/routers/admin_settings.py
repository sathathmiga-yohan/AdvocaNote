
import re

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User

from app.auth.security import (
    get_current_user,
    hash_password,
    verify_password,
)


# =====================================
# ADMIN SETTINGS ROUTER
# =====================================

router = APIRouter(
    prefix="/admin/settings",
    tags=["Admin Settings"],
)


# =====================================
# ADMIN ACCESS CHECK
# =====================================

def require_admin(
    current_user: User = Depends(get_current_user),
):
    if str(current_user.role).lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user


# =====================================
# REQUEST SCHEMAS
# =====================================

class AdminProfileUpdate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=150,
    )

    email: str = Field(
        min_length=3,
        max_length=254,
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        value = value.strip()

        if not value:
            raise ValueError(
                "Admin name is required"
            )

        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        value = value.strip().lower()

        if not re.fullmatch(
            r"[^@\s]+@[^@\s]+\.[^@\s]+",
            value,
        ):
            raise ValueError(
                "Enter a valid email address"
            )

        return value


class ChangeAdminPassword(BaseModel):
    current_password: str

    new_password: str = Field(
        min_length=8,
        max_length=128,
    )


# =====================================
# GET ADMIN PROFILE
# =====================================

@router.get("/profile")
def get_admin_profile(
    current_user: User = Depends(require_admin),
):
    return {
        "id": current_user.id,
        "name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
    }


# =====================================
# UPDATE ADMIN PROFILE
# =====================================

@router.patch("/profile")
def update_admin_profile(
    data: AdminProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):

    existing_user = db.scalar(
        select(User).where(
            func.lower(User.email) == data.email,
            User.id != current_user.id,
        )
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Email address already in use",
        )

    current_user.full_name = data.name
    current_user.email = data.email

    try:
        db.commit()
        db.refresh(current_user)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Email address already in use",
        )

    return {
        "message": "Admin profile updated successfully",
        "profile": {
            "id": current_user.id,
            "name": current_user.full_name,
            "email": current_user.email,
            "role": current_user.role,
        },
    }


# =====================================
# CHANGE ADMIN PASSWORD
# =====================================

@router.post("/password")
def change_admin_password(
    data: ChangeAdminPassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):

    # Check whether account has a password
    if not current_user.password_hash:
        raise HTTPException(
            status_code=400,
            detail=(
                "This account does not have "
                "a password configured"
            ),
        )

    # Verify current password
    if not verify_password(
        data.current_password,
        current_user.password_hash,
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect",
        )

    # Prevent reusing current password
    if data.current_password == data.new_password:
        raise HTTPException(
            status_code=400,
            detail=(
                "New password must be different "
                "from current password"
            ),
        )

    # Hash new password securely
    current_user.password_hash = hash_password(
        data.new_password
    )

    db.commit()

    return {
        "message": "Password updated successfully"
    }
