
from datetime import date, timedelta

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.user import User

from app.models.diary import (
    Court,
    Case,
    Hearing,
    Reminder,
)

from app.routers.diary import lawyer_only

from app.auth.subscription_guard import (
    require_feature,
)

# ==========================================
# SUBSCRIPTION DAILY USAGE
# ==========================================

from app.services.subscription_usage import (
    consume_daily_action,
)


# ==========================================
# HEARINGS ROUTER
# ==========================================

router = APIRouter(
    prefix="/hearings",
    tags=["Hearings"],
)


# ==========================================
# GET ALL HEARINGS
# ==========================================
# Viewing hearings is free.
# No daily action is consumed.
# ==========================================

@router.get("")
def hearings(
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):

    rows = db.execute(
        select(Hearing, Case, Court)
        .join(
            Case,
            Hearing.case_id == Case.id,
        )
        .join(
            Court,
            Hearing.court_id == Court.id,
        )
        .where(
            Case.lawyer_id == user.id
        )
        .order_by(
            Hearing.hearing_date
        )
    ).all()

    return [
        {
            "id": hearing.id,
            "case_number": case.case_number,
            "court": court.court_name,
            "location": court.location,
            "hearing_date": (
                hearing.hearing_date.isoformat()
            ),
            "status": hearing.status,
            "case_id": hearing.case_id,
            "diary_entry_id": (
                hearing.diary_entry_id
            ),
            "reschedule_reason": (
                hearing.reschedule_reason
            ),
            "rescheduled_from_id": (
                hearing.rescheduled_from_id
            ),
            "purpose": hearing.purpose,
        }
        for hearing, case, court in rows
    ]


# ==========================================
# POSTPONE / RESCHEDULE HEARING
# ==========================================
# Successful reschedule = 1 action
# ==========================================

class HearingReschedule(BaseModel):

    new_date: date

    reason: str = Field(
        min_length=3,
        max_length=500,
    )


@router.patch(
    "/{hearing_id}/reschedule",
    dependencies=[
        Depends(require_feature("hearings"))
    ],
)
def reschedule_hearing(
    hearing_id: int,
    data: HearingReschedule,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):

    # ======================================
    # VERIFY HEARING OWNERSHIP
    # ======================================

    result = db.execute(
        select(Hearing, Case)
        .join(
            Case,
            Hearing.case_id == Case.id,
        )
        .where(
            Hearing.id == hearing_id,
            Case.lawyer_id == user.id,
        )
    ).first()

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Hearing not found",
        )

    old, case = result

    reason = data.reason.strip()

    # ======================================
    # VALIDATE REASON
    # ======================================

    if len(reason) < 3:
        raise HTTPException(
            status_code=422,
            detail="Reason is required",
        )

    # ======================================
    # CHECK HEARING STATUS
    # ======================================

    if old.status != "Scheduled":
        raise HTTPException(
            status_code=409,
            detail=(
                "Only a Scheduled hearing "
                "can be postponed"
            ),
        )

    # ======================================
    # VALIDATE NEW HEARING DATE
    # ======================================

    if data.new_date <= old.hearing_date:
        raise HTTPException(
            status_code=422,
            detail=(
                "New hearing date must be "
                "after the old hearing date"
            ),
        )

    # ======================================
    # PREVENT DUPLICATE HEARINGS
    # ======================================

    duplicate = db.scalar(
        select(Hearing.id).where(
            Hearing.case_id == old.case_id,
            Hearing.hearing_date == data.new_date,
            Hearing.status == "Scheduled",
        )
    )

    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "A Scheduled hearing already "
                "exists on that new date"
            ),
        )

    # ======================================
    # SUBSCRIPTION + RESCHEDULE
    # ======================================

    try:

        # ==================================
        # CONSUME ONE DAILY ACTION
        # ==================================
        #
        # Basic:
        # Maximum 3 actions per day.
        #
        # Free Trial / Premium / Annual:
        # Unlimited.
        #
        # If limit reached:
        # HTTP 429 will be returned.
        #
        # No commit occurs here.
        # Failed operations roll back.

        consume_daily_action(
            db=db,
            user_id=user.id,
        )

        # ==================================
        # PRESERVE ORIGINAL HEARING
        # ==================================

        old.status = "Postponed"
        old.reschedule_reason = reason

        # ==================================
        # DELETE OLD HEARING REMINDERS
        # ==================================

        db.execute(
            delete(Reminder).where(
                Reminder.hearing_id == old.id,
                Reminder.user_id == user.id,
            )
        )

        # ==================================
        # CREATE NEW HEARING
        # ==================================

        new_hearing = Hearing(
            case_id=old.case_id,
            court_id=old.court_id,
            diary_entry_id=None,
            hearing_date=data.new_date,
            hearing_time=old.hearing_time,
            status="Scheduled",
            rescheduled_from_id=old.id,
            purpose=old.purpose,
        )

        db.add(new_hearing)
        db.flush()

        # ==================================
        # CREATE NEW HEARING REMINDER
        # ==================================

        db.add(
            Reminder(
                user_id=user.id,
                hearing_id=new_hearing.id,
                reminder_type="Hearing",
                title=(
                    f"Hearing: {case.case_number}"
                ),
                reminder_date=(
                    data.new_date
                    - timedelta(days=1)
                ),
            )
        )

        old_id = old.id
        old_date = old.hearing_date

        # ==================================
        # COMMIT HEARING + DAILY USAGE
        # ==================================

        db.commit()

        return {
            "message": (
                "Hearing rescheduled successfully"
            ),
            "old_hearing_id": old_id,
            "old_hearing_date": (
                old_date.isoformat()
            ),
            "old_status": "Postponed",
            "new_hearing_id": new_hearing.id,
            "new_hearing_date": (
                data.new_date.isoformat()
            ),
            "new_status": "Scheduled",
            "reason": reason,
        }

    except Exception:

        # ==================================
        # ROLLBACK ON FAILURE
        # ==================================
        #
        # Hearing changes and usage
        # increment are rolled back.

        db.rollback()
        raise


# ==========================================
# MARK HEARING AS COMPLETED
# ==========================================
# Successful completion = 1 action
# ==========================================

@router.patch(
    "/{hearing_id}/complete",
    dependencies=[
        Depends(require_feature("hearings"))
    ],
)
def complete_hearing(
    hearing_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):

    # ======================================
    # VERIFY HEARING OWNERSHIP
    # ======================================

    result = db.execute(
        select(Hearing, Case)
        .join(
            Case,
            Hearing.case_id == Case.id,
        )
        .where(
            Hearing.id == hearing_id,
            Case.lawyer_id == user.id,
        )
    ).first()

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Hearing not found",
        )

    hearing, case = result

    # ======================================
    # CHECK HEARING STATUS
    # ======================================

    if hearing.status != "Scheduled":
        raise HTTPException(
            status_code=409,
            detail=(
                "Only scheduled hearings "
                "can be completed"
            ),
        )

    # ======================================
    # PREVENT FUTURE COMPLETION
    # ======================================

    if hearing.hearing_date > date.today():
        raise HTTPException(
            status_code=422,
            detail=(
                "Future hearings cannot "
                "be completed"
            ),
        )

    # ======================================
    # SUBSCRIPTION + COMPLETE HEARING
    # ======================================

    try:

        # ==================================
        # CONSUME ONE DAILY ACTION
        # ==================================

        consume_daily_action(
            db=db,
            user_id=user.id,
        )

        # ==================================
        # UPDATE HEARING STATUS
        # ==================================

        hearing.status = "Completed"

        # ==================================
        # DELETE HEARING REMINDERS
        # ==================================

        db.execute(
            delete(Reminder).where(
                Reminder.hearing_id == hearing.id,
                Reminder.user_id == user.id,
            )
        )

        # ==================================
        # COMMIT HEARING + DAILY USAGE
        # ==================================

        db.commit()

        return {
            "message": (
                "Hearing marked as completed"
            ),
            "hearing_id": hearing.id,
            "status": "Completed",
        }

    except Exception:

        # Do not count failed actions.

        db.rollback()
        raise
