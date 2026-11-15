
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.account_deletion import AccountDeletion
from app.database import get_db
from app.models.user import User
from app.auth.admin_guard import require_admin


# =====================================
# ADMIN LAWYER MANAGEMENT
# =====================================

router = APIRouter(
    prefix="/admin/lawyers",
    tags=["Admin Lawyer Management"],
    dependencies=[Depends(require_admin)],
)


# =====================================
# REQUEST SCHEMA
# =====================================

class LawyerStatusUpdate(BaseModel):

    model_config = ConfigDict(extra="forbid")

    is_active: bool

    reason: str = Field(
        default="",
        max_length=500,
    )


# =====================================
# SUSPEND / REACTIVATE LAWYER
# =====================================

@router.patch("/{lawyer_id}/status")
def update_lawyer_status(
    lawyer_id: int,
    data: LawyerStatusUpdate,
    db: Session = Depends(get_db),
):

    # Find the lawyer account

    lawyer = db.scalar(
        select(User)
        .where(
            User.id == lawyer_id,
            User.role == "lawyer",
        )
        .with_for_update()
    )

    if lawyer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lawyer account not found",
        )
    # =====================================
    # PREVENT CLOSED ACCOUNT REACTIVATION
    # =====================================

    closed_account = db.scalar(
        select(AccountDeletion.id).where(
            AccountDeletion.original_user_id == lawyer_id,
            AccountDeletion.status == "pending_purge",
        )
    )

    if closed_account is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This lawyer closed their account. "
                "Account recovery must be completed by "
                "the account owner."
            ),
        )
    # Suspension requires a reason

    if not data.is_active and not data.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Suspension reason is required",
        )

    # Check existing status

    if lawyer.is_active == data.is_active:
        return {
            "id": lawyer.id,
            "is_active": lawyer.is_active,
            "message": "Account already has this status",
        }

    # Update account status

    lawyer.is_active = data.is_active

    try:
        db.commit()
        db.refresh(lawyer)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not update lawyer account",
        )

    return {
        "id": lawyer.id,
        "is_active": lawyer.is_active,
        "message": (
            "Lawyer account reactivated successfully"
            if lawyer.is_active
            else "Lawyer account suspended successfully"
        ),
    }
