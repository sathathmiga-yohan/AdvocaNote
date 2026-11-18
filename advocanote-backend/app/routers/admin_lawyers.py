
import logging

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

from admin_notifications_api import (
    notify_lawyer_status_changed,
)


logger = logging.getLogger(__name__)


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

    # =====================================
    # FIND LAWYER ACCOUNT
    # =====================================

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

    # =====================================
    # SUSPENSION REQUIRES A REASON
    # =====================================

    if not data.is_active and not data.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Suspension reason is required",
        )

    # =====================================
    # CHECK EXISTING STATUS
    # =====================================

    if lawyer.is_active == data.is_active:
        return {
            "id": lawyer.id,
            "is_active": lawyer.is_active,
            "message": "Account already has this status",
        }

    # =====================================
    # SAVE PREVIOUS STATUS
    # =====================================

    previous_is_active = bool(
        lawyer.is_active
    )

    # =====================================
    # UPDATE LAWYER ACCOUNT STATUS
    # =====================================

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

    # =====================================
    # ADMIN NOTIFICATION
    # SUSPENDED / REACTIVATED
    # =====================================

    try:
        notify_lawyer_status_changed(
            lawyer=lawyer,
            previous_is_active=previous_is_active,
        )

        logger.info(
            "Admin lawyer status notification "
            "created: lawyer_id=%s active=%s",
            lawyer.id,
            lawyer.is_active,
        )

    except Exception:
        logger.exception(
            "Failed to create lawyer status "
            "notification for lawyer_id=%s",
            lawyer.id,
        )

    # =====================================
    # RESPONSE
    # =====================================

    return {
        "id": lawyer.id,
        "is_active": lawyer.is_active,
        "message": (
            "Lawyer account reactivated successfully"
            if lawyer.is_active
            else "Lawyer account suspended successfully"
        ),
    }
