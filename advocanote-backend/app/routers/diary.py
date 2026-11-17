
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, delete
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.auth.security import get_current_user
from app.database import get_db
from app.models.user import User

from app.models.diary import (
    Court,
    Case,
    DiaryEntry,
    Hearing,
    Task,
    Reminder,
    AISuggestion,
)

from app.schemas.diary import DiaryEntryCreate, CaseCreate
from app.auth.subscription_guard import require_feature
from app.services.subscription_usage import consume_daily_action


router = APIRouter(
    prefix="/diary",
    tags=["Legal Diary"],
)


def lawyer_only(
    user: User = Depends(get_current_user),
):
    if not user.is_active or user.role != "lawyer":
        raise HTTPException(
            status_code=403,
            detail="Lawyer access required",
        )
    return user


def serialize_entry(db: Session, entry: DiaryEntry):
    case = db.get(Case, entry.case_id)
    court = db.get(Court, entry.court_id)

    return {
        "id": entry.id,
        "entryDate": entry.entry_date.isoformat(),
        "caseNo": case.case_number,
        "caseTitle": case.case_title,
        "court": court.court_name,
        "location": court.location,
        "previousDate": (
            entry.previous_date.isoformat()
            if entry.previous_date else None
        ),
        "nextDate": (
            entry.next_date.isoformat()
            if entry.next_date else None
        ),
        "stepType": entry.step_type,
        "note": entry.step_notes,
        "pointNotes": entry.point_notes,
    }


# ==========================================
# MY LEGAL DIARY OVERVIEW
# Viewing does not count as an action.
# ==========================================

@router.get("/overview")
def overview(
    entry_date: date,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    entries = db.scalars(
        select(DiaryEntry)
        .where(
            DiaryEntry.lawyer_id == user.id,
            DiaryEntry.entry_date == entry_date,
        )
        .order_by(DiaryEntry.id.desc())
    ).all()

    today = date.today()

    upcoming_hearings = db.scalar(
        select(func.count(Hearing.id))
        .join(Case, Hearing.case_id == Case.id)
        .where(
            Case.lawyer_id == user.id,
            Hearing.hearing_date >= today,
            Hearing.status == "Scheduled",
        )
    ) or 0

    pending_tasks = db.scalar(
        select(func.count(Task.id))
        .where(
            Task.lawyer_id == user.id,
            Task.status == "Pending",
        )
    ) or 0

    courts_attended = db.scalar(
        select(
            func.count(
                func.distinct(DiaryEntry.court_id)
            )
        )
        .where(
            DiaryEntry.lawyer_id == user.id,
            DiaryEntry.entry_date == entry_date,
        )
    ) or 0

    reminders = db.scalars(
        select(Reminder)
        .where(
            Reminder.user_id == user.id,
            Reminder.reminder_date >= (
                today - timedelta(days=1)
            ),
            Reminder.reminder_date <= (
                today + timedelta(days=30)
            ),
        )
        .order_by(Reminder.reminder_date)
        .limit(20)
    ).all()

    return {
        "entries": [
            serialize_entry(db, x)
            for x in entries
        ],
        "stats": {
            "entries_today": len(entries),
            "upcoming_hearings": upcoming_hearings,
            "pending_tasks": pending_tasks,
            "courts_attended": courts_attended,
        },
        "notifications": [
            {
                "id": r.id,
                "title": r.title,
                "date": r.reminder_date.isoformat(),
            }
            for r in reminders
        ],
    }


# ==========================================
# CREATE DIARY ENTRY
# One successful save = one daily action.
# ==========================================

@router.post(
    "/entries",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_feature("diary"))],
)
def create_entry(
    data: DiaryEntryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    case_no = data.case_number.strip()
    court_name = data.court_name.strip()
    location = data.location.strip()

    selected_case_type = (
        data.case_type or ""
    ).strip()

    case_type = (
        (data.other_case_type or "").strip()
        if selected_case_type == "Other"
        else selected_case_type
    )

    if (
        not case_no
        or not court_name
        or not location
        or not data.step_notes.strip()
    ):
        raise HTTPException(
            status_code=422,
            detail="Please complete all required fields",
        )

    try:
        # Basic: count one action.
        # Trial / Premium / Annual: unlimited.
        # If save fails, the count rolls back.

        consume_daily_action(
            db=db,
            user_id=user.id,
        )

        court = db.scalar(
            select(Court).where(
                func.lower(Court.court_name)
                == court_name.lower(),
                func.lower(Court.location)
                == location.lower(),
            )
        )

        if court is None:
            court = Court(
                court_name=court_name,
                location=location,
                created_by=user.id,
            )

            db.add(court)
            db.flush()

        # Find the lawyer's existing case.

        case = db.scalar(
            select(Case).where(
                Case.lawyer_id == user.id,
                func.lower(Case.case_number)
                == case_no.lower(),
            )
        )

        # Create a new case only if necessary.

        if case is None:
            if not case_type:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Please select a Case Type "
                        "for the new case"
                    ),
                )

            case = Case(
                lawyer_id=user.id,
                court_id=court.id,
                case_number=case_no,
                case_title=(
                    data.case_title.strip()
                    or "Untitled Case"
                ),
                case_type=case_type,
            )

            db.add(case)
            db.flush()

        # Existing case must use its original court.

        if case.court_id != court.id:
            raise HTTPException(
                status_code=409,
                detail=(
                    "The selected case belongs "
                    "to a different court"
                ),
            )

        entry = DiaryEntry(
            lawyer_id=user.id,
            case_id=case.id,
            court_id=court.id,
            entry_date=data.entry_date,
            previous_date=data.previous_date,
            step_type=data.step_type,
            step_notes=data.step_notes.strip(),
            point_notes=(
                data.point_notes.strip()
                if data.point_notes
                else None
            ),
            input_method=data.input_method,
            next_date=data.next_date,
        )

        db.add(entry)
        db.flush()

        # =====================================
        # HEARING COMPLETED LOGIC
        # =====================================
        # Next Date provided + proceedings recorded:
        # Old Scheduled -> Completed.
        #
        # Do not auto-complete if no Next Date.
        # Do not auto-complete a future hearing.
        # Do not change Postponed hearings.

        hearing_added = False

        if data.next_date:
            if data.next_date <= data.entry_date:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Next hearing date must be "
                        "after the diary date"
                    ),
                )

            if data.entry_date <= date.today():
                held_hearings = db.scalars(
                    select(Hearing).where(
                        Hearing.case_id == case.id,
                        Hearing.hearing_date == data.entry_date,
                        Hearing.status == "Scheduled",
                    )
                ).all()

                # Previous Date fallback.

                if (
                    not held_hearings
                    and data.previous_date
                ):
                    held_hearings = db.scalars(
                        select(Hearing).where(
                            Hearing.case_id == case.id,
                            Hearing.hearing_date
                            == data.previous_date,
                            Hearing.status == "Scheduled",
                        )
                    ).all()

                for held in held_hearings:
                    held.status = "Completed"

                    db.execute(
                        delete(Reminder).where(
                            Reminder.hearing_id == held.id,
                            Reminder.user_id == user.id,
                        )
                    )

            # Check existing next scheduled hearing.

            existing_next = db.scalar(
                select(Hearing).where(
                    Hearing.case_id == case.id,
                    Hearing.hearing_date == data.next_date,
                    Hearing.status == "Scheduled",
                )
            )

            if existing_next is None:
                hearing = Hearing(
                    case_id=case.id,
                    court_id=court.id,
                    diary_entry_id=entry.id,
                    hearing_date=data.next_date,
                    status="Scheduled",
                    purpose=(
                        data.next_hearing_purpose.strip()[:255]
                        if data.next_hearing_purpose
                        else None
                    ),
                )

                db.add(hearing)
                db.flush()

                db.add(
                    Reminder(
                        user_id=user.id,
                        hearing_id=hearing.id,
                        reminder_type="Hearing",
                        title=f"Hearing: {case_no}",
                        reminder_date=max(
                            data.next_date
                            - timedelta(days=1),
                            data.entry_date,
                        ),
                    )
                )

                hearing_added = True


        # =====================================
        # SAVE APPROVED MANUAL TASKS
        # =====================================

        approved_items = (
            data.approved_tasks
            if data.approved_tasks
            else (
                [data.approved_task]
                if data.approved_task
                else []
            )
        )

        task_count = 0
        seen_tasks = set()

        for approved in approved_items:
            title = approved.title.strip()

            unique_key = (
                title.casefold(),
                approved.deadline,
            )

            if unique_key in seen_tasks:
                continue

            seen_tasks.add(unique_key)

            task = Task(
                lawyer_id=user.id,
                case_id=case.id,
                diary_entry_id=entry.id,
                title=title,
                deadline=approved.deadline,
            )

            db.add(task)
            db.flush()

            if task.deadline:
                db.add(
                    Reminder(
                        user_id=user.id,
                        task_id=task.id,
                        reminder_type="Task",
                        title=f"Task due: {task.title}",
                        reminder_date=max(
                            task.deadline - timedelta(days=1),
                            data.entry_date,
                        ),
                    )
                )

            task_count += 1

        # =====================================
        # SAVE AI SUGGESTIONS SEPARATELY
        # =====================================

        seen_suggestions = set()
        ai_suggestions_saved = 0

        for suggestion in data.ai_suggestions:
            title = suggestion.title.strip()

            if not title:
                continue

            suggestion_key = title.casefold()

            if suggestion_key in seen_suggestions:
                continue

            seen_suggestions.add(suggestion_key)

            review_status = suggestion.status.capitalize()

            db.add(
                AISuggestion(
                    diary_entry_id=entry.id,
                    suggestion_type="Task",
                    suggested_value=title,
                    status=review_status,
                )
            )

            ai_suggestions_saved += 1

            # Pending / Rejected:
            # Save suggestion only, not a task.

            if review_status != "Approved":
                continue

            # Approved AI suggestion:
            # Create a real task.

            task_key = (
                suggestion_key,
                suggestion.deadline,
            )

            if task_key in seen_tasks:
                continue

            seen_tasks.add(task_key)

            task = Task(
                lawyer_id=user.id,
                case_id=case.id,
                diary_entry_id=entry.id,
                title=title,
                deadline=suggestion.deadline,
                priority=suggestion.priority,
                status="Pending",
            )

            db.add(task)
            db.flush()

            if task.deadline:
                db.add(
                    Reminder(
                        user_id=user.id,
                        task_id=task.id,
                        reminder_type="Task",
                        title=f"Task due: {task.title}",
                        reminder_date=max(
                            task.deadline - timedelta(days=1),
                            data.entry_date,
                        ),
                    )
                )

            task_count += 1

        task_added = task_count > 0


        # =====================================
        # SAVE DIARY AND DAILY ACTION TOGETHER
        # =====================================

        db.commit()

        return {
            "message": "Diary Entry Saved Successfully!",
            "entry_id": entry.id,
            "entry_date": entry.entry_date.isoformat(),
            "case_number": case_no,
            "hearing_added": hearing_added,
            "task_added": task_added,
            "tasks_added": task_count,
            "ai_suggestions_saved": ai_suggestions_saved,
        }

    except Exception:
        db.rollback()
        raise


# ==========================================
# GET CASE DIARY HISTORY
# Free read operation.
# ==========================================

@router.get("/case/{case_id}/history")
def case_history(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    case = db.scalar(
        select(Case).where(
            Case.id == case_id,
            Case.lawyer_id == user.id,
        )
    )

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found",
        )

    entries = db.scalars(
        select(DiaryEntry)
        .where(
            DiaryEntry.case_id == case.id,
            DiaryEntry.lawyer_id == user.id,
        )
        .order_by(
            DiaryEntry.entry_date.desc(),
            DiaryEntry.id.desc(),
        )
    ).all()

    return [
        serialize_entry(db, entry)
        for entry in entries
    ]


# ==========================================
# GET SINGLE DIARY ENTRY DETAILS
# Free read operation.
# ==========================================

@router.get("/entries/{entry_id}")
def get_diary_entry_details(
    entry_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    result = db.execute(
        select(DiaryEntry, Case)
        .join(
            Case,
            DiaryEntry.case_id == Case.id,
        )
        .where(
            DiaryEntry.id == entry_id,
            DiaryEntry.lawyer_id == user.id,
            Case.lawyer_id == user.id,
        )
    ).first()

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Diary entry not found",
        )

    entry, case = result

    entry_ids = db.scalars(
        select(DiaryEntry.id)
        .where(
            DiaryEntry.case_id == case.id,
            DiaryEntry.lawyer_id == user.id,
        )
        .order_by(
            DiaryEntry.entry_date.asc(),
            DiaryEntry.id.asc(),
        )
    ).all()

    position = entry_ids.index(entry.id) + 1

    return {
        "entry": {
            **serialize_entry(db, entry),
            "caseId": case.id,
            "caseStatus": case.status,
            "inputMethod": entry.input_method,
        },
        "entryPosition": position,
        "totalEntries": len(entry_ids),
    }


# ==========================================
# UPDATE DIARY ENTRY
# One successful update = one action.
# ==========================================

class DiaryEntryUpdate(BaseModel):
    previous_date: date | None = None
    next_date: date | None = None
    step_type: str
    step_notes: str
    point_notes: str | None = None


@router.put(
    "/entries/{entry_id}",
    dependencies=[Depends(require_feature("diary"))],
)
def update_diary_entry(
    entry_id: int,
    data: DiaryEntryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    entry = db.scalar(
        select(DiaryEntry).where(
            DiaryEntry.id == entry_id,
            DiaryEntry.lawyer_id == user.id,
        )
    )

    if entry is None:
        raise HTTPException(
            status_code=404,
            detail="Diary entry not found",
        )

    if (
        not data.step_notes.strip()
        or not data.step_type.strip()
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                "Step and court proceedings "
                "are required"
            ),
        )

    try:
        # Reserve one daily action.
        # Roll back if update fails.

        consume_daily_action(
            db=db,
            user_id=user.id,
        )

        original_next_date = entry.next_date

        entry.previous_date = data.previous_date
        entry.next_date = data.next_date
        entry.step_type = data.step_type.strip()
        entry.step_notes = data.step_notes.strip()

        entry.point_notes = (
            data.point_notes.strip()
            if data.point_notes
            else None
        )

        linked_hearings = db.scalars(
            select(Hearing).where(
                Hearing.diary_entry_id == entry.id
            )
        ).all()

        # Protect completed and postponed hearing history.

        if data.next_date != original_next_date:
            if any(
                h.status != "Scheduled"
                for h in linked_hearings
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Completed or postponed hearing "
                        "history cannot be changed."
                    ),
                )

        if data.next_date is None:
            for hearing in linked_hearings:
                db.execute(
                    delete(Reminder).where(
                        Reminder.hearing_id == hearing.id
                    )
                )

                db.delete(hearing)

        else:
            if not linked_hearings:
                hearing = Hearing(
                    case_id=entry.case_id,
                    court_id=entry.court_id,
                    diary_entry_id=entry.id,
                    hearing_date=data.next_date,
                )

                db.add(hearing)
                db.flush()

                linked_hearings = [hearing]

            case = db.get(Case, entry.case_id)

            for hearing in linked_hearings:
                if hearing.status != "Scheduled":
                    continue

                hearing.hearing_date = data.next_date

                reminder_date = max(
                    data.next_date - timedelta(days=1),
                    entry.entry_date,
                )

                linked_reminders = db.scalars(
                    select(Reminder).where(
                        Reminder.hearing_id == hearing.id,
                        Reminder.user_id == user.id,
                    )
                ).all()

                if linked_reminders:
                    for reminder in linked_reminders:
                        reminder.reminder_date = reminder_date
                        if data.next_date != original_next_date:
                            reminder.is_read = False
                            reminder.read_at = None
                else:
                    db.add(
                        Reminder(
                            user_id=user.id,
                            hearing_id=hearing.id,
                            reminder_type="Hearing",
                            title=(
                                f"Hearing: {case.case_number}"
                            ),
                            reminder_date=reminder_date,
                        )
                    )

        # Save update and usage together.
        db.commit()

        return {
            "message": "Diary entry updated successfully",
            "entry": serialize_entry(db, entry),
        }

    except Exception:
        db.rollback()
        raise


# ==========================================
# DELETE DIARY ENTRY
# One successful deletion = one action.
# ==========================================

@router.delete(
    "/entries/{entry_id}",
    dependencies=[Depends(require_feature("diary"))],
)
def delete_diary_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    entry = db.scalar(
        select(DiaryEntry).where(
            DiaryEntry.id == entry_id,
            DiaryEntry.lawyer_id == user.id,
        )
    )

    if entry is None:
        raise HTTPException(
            status_code=404,
            detail="Diary entry not found",
        )

    try:
        # Protect completed and postponed hearing history.

        protected_hearing = db.scalar(
            select(Hearing.id).where(
                Hearing.diary_entry_id == entry.id,
                Hearing.status.in_(["Completed", "Postponed"]),
            ).limit(1)
        )

        if protected_hearing is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This diary entry has completed or "
                    "postponed hearing history and "
                    "cannot be permanently deleted."
                ),
            )

        hearing_ids = db.scalars(
            select(Hearing.id).where(
                Hearing.diary_entry_id == entry.id
            )
        ).all()

        task_ids = db.scalars(
            select(Task.id).where(
                Task.diary_entry_id == entry.id,
                Task.lawyer_id == user.id,
            )
        ).all()

        # Protect hearing reschedule history.

        if hearing_ids:
            chain = db.scalar(
                select(Hearing.id).where(
                    Hearing.rescheduled_from_id.in_(
                        hearing_ids
                    )
                )
            )

            if chain is not None:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "This entry has rescheduled "
                        "hearing history. Keep the entry "
                        "to preserve that history."
                    ),
                )

        # All validations passed.
        # Reserve the daily action before deleting.

        consume_daily_action(
            db=db,
            user_id=user.id,
        )

        if hearing_ids:
            db.execute(
                delete(Reminder).where(
                    Reminder.hearing_id.in_(hearing_ids)
                )
            )

        if task_ids:
            db.execute(
                delete(Reminder).where(
                    Reminder.task_id.in_(task_ids)
                )
            )

        db.execute(
            delete(AISuggestion).where(
                AISuggestion.diary_entry_id == entry.id
            )
        )

        db.execute(
            delete(Hearing).where(
                Hearing.diary_entry_id == entry.id
            )
        )

        db.execute(
            delete(Task).where(
                Task.diary_entry_id == entry.id,
                Task.lawyer_id == user.id,
            )
        )

        db.delete(entry)

        # Save deletion and usage together.
        db.commit()

        return {
            "message": "Diary entry deleted successfully",
        }

    except Exception:
        db.rollback()
        raise

# ==========================================
# GET AI TASK SUGGESTIONS
# ==========================================
# Read only - no daily action consumed.
# Only the logged-in lawyer's records.
# ==========================================

@router.get("/ai-suggestions")
def get_ai_suggestions(
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):

    rows = db.execute(
        select(
            AISuggestion,
            DiaryEntry,
            Case.case_number,
        )
        .join(
            DiaryEntry,
            AISuggestion.diary_entry_id == DiaryEntry.id,
        )
        .join(
            Case,
            DiaryEntry.case_id == Case.id,
        )
        .where(
            DiaryEntry.lawyer_id == user.id,
            Case.lawyer_id == user.id,
            AISuggestion.suggestion_type == "Task",
        )
        .order_by(AISuggestion.id.desc())
    ).all()

    return [
        {
            "id": suggestion.id,
            "entry_id": entry.id,
            "case_number": case_number,
            "entry_date": entry.entry_date.isoformat(),
            "title": suggestion.suggested_value,
            "type": suggestion.suggestion_type,
            "source": (
                "voice"
                if str(
                    entry.input_method or ""
                ).strip().lower()
                in {
                    "voice",
                    "audio",
                    "voice recording",
                }
                else "manual"
            ),
            "status": suggestion.status,
        }
        for suggestion, entry, case_number in rows
    ]


# ==========================================
# AI SUGGESTION REVIEW
# Approve / Reject = one action.
# ==========================================

class AISuggestionReview(BaseModel):
    status: Literal["Approved", "Rejected"]
    title: str | None = Field(
        default=None,
        max_length=500,
    )


@router.patch(
    "/ai-suggestions/{suggestion_id}",
    dependencies=[Depends(require_feature("diary"))],
)
def review_ai_suggestion(
    suggestion_id: int,
    data: AISuggestionReview,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    suggestion = db.scalar(
        select(AISuggestion)
        .join(
            DiaryEntry,
            AISuggestion.diary_entry_id == DiaryEntry.id,
        )
        .where(
            AISuggestion.id == suggestion_id,
            DiaryEntry.lawyer_id == user.id,
        )
    )

    if suggestion is None:
        raise HTTPException(
            status_code=404,
            detail="AI suggestion not found",
        )

    if (suggestion.status or "").lower() != "pending":
        raise HTTPException(
            status_code=409,
            detail="This suggestion has already been reviewed",
        )

    entry = db.get(
        DiaryEntry,
        suggestion.diary_entry_id,
    )

    title = (
        data.title
        or suggestion.suggested_value
        or ""
    ).strip()

    if data.status == "Approved":
        if suggestion.suggestion_type != "Task":
            raise HTTPException(
                status_code=422,
                detail="Only task suggestions can be approved",
            )

        if len(title) < 3:
            raise HTTPException(
                status_code=422,
                detail="Enter a valid task title",
            )

    try:
        # Approve or reject = one daily action.

        consume_daily_action(
            db=db,
            user_id=user.id,
        )

        if data.status == "Approved":
            task = Task(
                lawyer_id=user.id,
                case_id=entry.case_id,
                diary_entry_id=entry.id,
                title=title,
                deadline=None,
            )

            db.add(task)
            suggestion.suggested_value = title

        suggestion.status = data.status

        # Save review and usage together.
        db.commit()

    except Exception:
        db.rollback()
        raise

    return {
        "id": suggestion.id,
        "title": suggestion.suggested_value,
        "status": suggestion.status,
    }
