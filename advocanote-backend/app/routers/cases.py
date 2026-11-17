
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db

from app.models.user import User

from app.models.diary import (
    Court,
    Case,
    DiaryEntry,
    Hearing,
    Task,
)

from app.schemas.diary import CaseCreate
from app.routers.diary import lawyer_only

from app.auth.subscription_guard import require_feature
from app.auth.security import get_current_user

# ==========================================
# SUBSCRIPTION DAILY USAGE
# ==========================================

from app.services.subscription_usage import (
    consume_daily_action,
)


# ==========================================
# MY CASES ROUTER
# ==========================================

router = APIRouter(
    prefix="/cases",
    tags=["My Cases"],
)


# ==========================================
# LAWYER READ ONLY
# ==========================================

def lawyer_read_only(
    user: User = Depends(get_current_user),
):

    if user.role != "lawyer":
        raise HTTPException(
            status_code=403,
            detail="Lawyer access required",
        )

    return user


# ==========================================
# GET ALL CASES
# ==========================================
# Viewing cases does not count
# as a daily subscription action.
# ==========================================

@router.get("")
def my_cases(
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_read_only),
):

    result = []

    cases = db.scalars(
        select(Case)
        .where(Case.lawyer_id == user.id)
        .order_by(Case.id.desc())
    ).all()

    for case in cases:

        court = db.get(
            Court,
            case.court_id,
        )

        result.append({
            "id": case.id,
            "case_number": case.case_number,
            "case_title": case.case_title,
            "case_type": case.case_type,
            "case_stage": case.case_stage,
            "created_at": case.created_at.isoformat(),
            "court_name": (
                court.court_name if court else None
            ),
            "location": (
                court.location if court else None
            ),
            "status": case.status,
        })

    return result


# ==========================================
# CHANGE CASE STATUS
# ==========================================
# Successful status change = 1 action
# ==========================================

class CaseStatusUpdate(BaseModel):

    status: Literal["Closed"]


@router.patch(
    "/{case_id}/status",
    dependencies=[
        Depends(require_feature("cases"))
    ],
)
def update_case_status(
    case_id: int,
    data: CaseStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):

    # ======================================
    # FIND LAWYER CASE
    # ======================================

    case = db.scalar(
        select(Case).where(
            Case.id == case_id,
            Case.lawyer_id == user.id,
        )
    )

    if case is None:
        raise HTTPException(
            status_code=404,
            detail="Case not found",
        )

    # No action if already closed.

    if case.status == data.status:
        return {
            "id": case.id,
            "status": case.status,
            "message": "Case is already closed",
        }

    # ======================================
    # SUBSCRIPTION + UPDATE CASE
    # ======================================

    try:

        # Basic: count one action.
        # Premium/Annual/Trial: unlimited.
        # Raises 429 if daily limit reached.

        consume_daily_action(
            db=db,
            user_id=user.id,
        )

        case.status = data.status

        # Save the case change and usage count
        # in the same database transaction.

        db.commit()
        db.refresh(case)

    except Exception:
        db.rollback()
        raise

    return {
        "id": case.id,
        "status": case.status,
        "message": "Case marked as closed successfully",
    }


# ==========================================
# CREATE CASE
# ==========================================
# Successfully creating a case = 1 action
# ==========================================

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(require_feature("cases"))
    ],
)
def create_case(
    data: CaseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):

    # ======================================
    # VALIDATE CASE DETAILS
    # ======================================

    case_number = data.case_number.strip()
    case_type = data.case_type.strip()
    court_name = data.court_name.strip()
    location = data.location.strip()

    if not all([
        case_number,
        case_type,
        court_name,
        location,
    ]):
        raise HTTPException(
            status_code=422,
            detail="Please complete all required fields",
        )

    # ======================================
    # CHECK DUPLICATE CASE NUMBER
    # ======================================

    existing_case = db.scalar(
        select(Case).where(
            Case.lawyer_id == user.id,
            func.lower(Case.case_number)
            == case_number.lower(),
        )
    )

    if existing_case:
        raise HTTPException(
            status_code=409,
            detail="This case number already exists",
        )

    # ======================================
    # CREATE CASE WITH SUBSCRIPTION CHECK
    # ======================================

    try:

        # Basic lawyer:
        # Maximum 3 successful actions/day.
        #
        # Valid trial, Premium, Annual:
        # Unlimited actions.
        #
        # If limit reached, raises 429.

        consume_daily_action(
            db=db,
            user_id=user.id,
        )

        # ==================================
        # FIND EXISTING COURT
        # ==================================

        court = db.scalar(
            select(Court).where(
                func.lower(Court.court_name)
                == court_name.lower(),
                func.lower(Court.location)
                == location.lower(),
            )
        )

        # ==================================
        # CREATE COURT IF NOT EXISTS
        # ==================================

        if court is None:

            court = Court(
                court_name=court_name,
                location=location,
                court_type=data.court_type.strip(),
                created_by=user.id,
            )

            db.add(court)
            db.flush()

        # ==================================
        # CREATE NEW CASE
        # ==================================

        new_case = Case(
            lawyer_id=user.id,
            court_id=court.id,
            case_number=case_number,
            case_title=(
                data.case_title.strip()
                or "Untitled Case"
            ),
            case_type=case_type,
            case_stage=(
                data.case_stage.strip()
                if data.case_stage
                else None
            ),
            status=data.status,
        )

        db.add(new_case)

        # ==================================
        # SAVE CASE + DAILY USAGE
        # ==================================

        db.commit()
        db.refresh(new_case)

        return {
            "message": "Case created successfully",
            "id": new_case.id,
            "case_number": new_case.case_number,
            "case_type": new_case.case_type,
            "case_stage": new_case.case_stage,
            "status": new_case.status,
        }

    except Exception:

        # If case creation fails before commit,
        # the usage increment is rolled back too.

        db.rollback()
        raise


# ==========================================
# DELETE CASE - ONLY EMPTY CASES
# ==========================================
# Successful deletion = 1 action
# ==========================================

@router.delete(
    "/{case_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[
        Depends(require_feature("cases"))
    ],
)
def delete_empty_case(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):

    # ======================================
    # FIND LAWYER CASE
    # ======================================

    case = db.scalar(
        select(Case).where(
            Case.id == case_id,
            Case.lawyer_id == user.id,
        )
    )

    if case is None:
        raise HTTPException(
            status_code=404,
            detail="Case not found",
        )

    # ======================================
    # PREVENT DELETION OF LEGAL RECORDS
    # ======================================

    has_entries = db.scalar(
        select(DiaryEntry.id)
        .where(DiaryEntry.case_id == case.id)
        .limit(1)
    ) is not None

    has_hearings = db.scalar(
        select(Hearing.id)
        .where(Hearing.case_id == case.id)
        .limit(1)
    ) is not None

    has_tasks = db.scalar(
        select(Task.id)
        .where(Task.case_id == case.id)
        .limit(1)
    ) is not None

    if (
        has_entries
        or has_hearings
        or has_tasks
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "This case has saved diary history, "
                "hearings or tasks. "
                "It cannot be permanently deleted."
            ),
        )

    # ======================================
    # DELETE CASE WITH SUBSCRIPTION CHECK
    # ======================================

    try:

        # Count one action only when
        # deletion is permitted.

        consume_daily_action(
            db=db,
            user_id=user.id,
        )

        db.delete(case)

        # Save deletion and usage together.

        db.commit()

    except Exception:

        db.rollback()
        raise
