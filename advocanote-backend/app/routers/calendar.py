from datetime import date, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from pydantic import BaseModel, ConfigDict, Field

from app.database import get_db
from app.models.user import User
from app.models.case import Case
from app.models.court import Court
from app.models.diary import DiaryEntry
from app.models.hearing import Hearing
from app.models.task import Task
from app.models.reminder import Reminder
from app.routers.diary import lawyer_only
from app.models.calendar_custom_event import CalendarCustomEvent

router = APIRouter(
    prefix="/calendar",
    tags=["Calendar"],
)


@router.get("/events")
def get_calendar_events(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    if end_date < start_date:
        raise HTTPException(
            status_code=422,
            detail="End date must be after start date",
        )

    if end_date - start_date > timedelta(days=62):
        raise HTTPException(
            status_code=422,
            detail="Maximum date range is 62 days",
        )

    events = []

    # 1. HEARINGS
    hearing_rows = db.execute(
        select(Hearing, Case, Court)
        .join(Case, Hearing.case_id == Case.id)
        .join(Court, Hearing.court_id == Court.id)
        .where(
            Case.lawyer_id == user.id,
            Hearing.hearing_date >= start_date,
            Hearing.hearing_date <= end_date,
        )
    ).all()

    for hearing, case, court in hearing_rows:
        postponed = hearing.status == "Postponed"

        events.append({
            "id": f"hearing-{hearing.id}",
            "record_id": hearing.id,
            "type": "postponed" if postponed else "hearing",
            "date": hearing.hearing_date.isoformat(),
            "title": case.case_number,
            "description": hearing.purpose or "Court hearing",
            "case_id": case.id,
            "case_number": case.case_number,
            "case_title": case.case_title,
            "court": court.court_name,
            "location": court.location,
            "status": hearing.status,
        })

    # 2. DIARY ENTRIES
    diary_rows = db.execute(
        select(DiaryEntry, Case)
        .join(Case, DiaryEntry.case_id == Case.id)
        .where(
            DiaryEntry.lawyer_id == user.id,
            Case.lawyer_id == user.id,
            DiaryEntry.entry_date >= start_date,
            DiaryEntry.entry_date <= end_date,
        )
    ).all()

    for entry, case in diary_rows:
        events.append({
            "id": f"diary-{entry.id}",
            "record_id": entry.id,
            "type": "diary",
            "date": entry.entry_date.isoformat(),
            "title": case.case_number,
            "description": entry.step_type or "Diary Entry",
            "notes": entry.step_notes or "",
            "case_id": case.id,
            "case_number": case.case_number,
            "case_title": case.case_title,
            "status": "Recorded",
        })

    # 3. TASK DEADLINES
    task_rows = db.execute(
        select(Task, Case)
        .join(Case, Task.case_id == Case.id)
        .where(
            Task.lawyer_id == user.id,
            Case.lawyer_id == user.id,
            Task.deadline.is_not(None),
            Task.deadline >= start_date,
            Task.deadline <= end_date,
        )
    ).all()

    for task, case in task_rows:
        events.append({
            "id": f"task-{task.id}",
            "record_id": task.id,
            "type": "task",
            "date": task.deadline.isoformat(),
            "title": task.title,
            "description": f"Case {case.case_number}",
            "case_id": case.id,
            "case_number": case.case_number,
            "case_title": case.case_title,
            "status": task.status,
            "priority": task.priority,
        })

    # 4. REMINDERS
    reminders = db.scalars(
        select(Reminder)
        .where(
            Reminder.user_id == user.id,
            Reminder.reminder_date >= start_date,
            Reminder.reminder_date <= end_date,
        )
    ).all()

    for reminder in reminders:
        events.append({
            "id": f"reminder-{reminder.id}",
            "record_id": reminder.id,
            "type": "reminder",
            "date": reminder.reminder_date.isoformat(),
            "title": reminder.title,
            "description": reminder.reminder_type,
            "status": "Sent" if reminder.is_sent else "Pending",
            "hearing_id": reminder.hearing_id,
            "task_id": reminder.task_id,
        })


    # =====================================
    # 5. CUSTOM CALENDAR EVENTS
    # =====================================

    custom_events = db.scalars(
        select(CalendarCustomEvent)
        .where(
            CalendarCustomEvent.lawyer_id == user.id,
            CalendarCustomEvent.event_date >= start_date,
            CalendarCustomEvent.event_date <= end_date,
        )
    ).all()

    for event in custom_events:
        events.append({
            "id": f"custom-{event.id}",
            "record_id": event.id,
            "type": "custom",
            "date": event.event_date.isoformat(),
            "time": (
                event.event_time.isoformat(
                    timespec="minutes"
                )
                if event.event_time
                else None
            ),
            "title": event.title,
            "description": event.notes or event.kind,
            "kind": event.kind,
            "notes": event.notes,
        })


    events.sort(
        key=lambda event: (
            event["date"],
            event["type"],
            event["id"],
        )
    )

    return {"events": events}


# ==========================================
# CUSTOM CALENDAR EVENT MANAGEMENT
# ==========================================

class CustomEventCreate(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True
    )

    title: str = Field(
        min_length=1,
        max_length=120,
    )

    event_date: date
    event_time: time | None = None

    kind: str = Field(
        default="Meeting",
        min_length=1,
        max_length=32,
    )

    notes: str = Field(
        default="",
        max_length=5000,
    )


class CustomEventUpdate(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True
    )

    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
    )

    event_date: date | None = None
    event_time: time | None = None

    kind: str | None = Field(
        default=None,
        min_length=1,
        max_length=32,
    )

    notes: str | None = Field(
        default=None,
        max_length=5000,
    )


def custom_event_json(event):
    return {
        "id": f"custom-{event.id}",
        "record_id": event.id,
        "type": "custom",
        "date": event.event_date.isoformat(),
        "time": (
            event.event_time.isoformat(
                timespec="minutes"
            )
            if event.event_time
            else None
        ),
        "title": event.title,
        "kind": event.kind,
        "notes": event.notes,
        "description": event.notes or event.kind,
    }


def owned_custom_event(
    event_id: int,
    db: Session,
    user: User,
):
    event = db.scalar(
        select(CalendarCustomEvent).where(
            CalendarCustomEvent.id == event_id,
            CalendarCustomEvent.lawyer_id == user.id,
        )
    )

    if event is None:
        raise HTTPException(
            status_code=404,
            detail="Calendar event not found.",
        )

    return event


# =====================================
# ADD CUSTOM EVENT
# =====================================

@router.post("/events", status_code=201)
def create_custom_event(
    data: CustomEventCreate,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    event = CalendarCustomEvent(
        lawyer_id=user.id,
        title=data.title,
        event_date=data.event_date,
        event_time=data.event_time,
        kind=data.kind,
        notes=data.notes,
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return custom_event_json(event)


# =====================================
# UPDATE CUSTOM EVENT
# =====================================

@router.patch("/events/{event_id}")
def update_custom_event(
    event_id: int,
    data: CustomEventUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    event = owned_custom_event(
        event_id, db, user
    )

    changes = data.model_dump(
        exclude_unset=True
    )

    for field in (
        "title",
        "event_date",
        "kind",
        "notes",
    ):
        if field in changes and changes[field] is None:
            raise HTTPException(
                status_code=422,
                detail=f"{field} cannot be null.",
            )

    for field, value in changes.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)

    return custom_event_json(event)


# =====================================
# DELETE CUSTOM EVENT
# =====================================

@router.delete(
    "/events/{event_id}",
    status_code=204,
)
def delete_custom_event(
    event_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    event = owned_custom_event(
        event_id, db, user
    )

    db.delete(event)
    db.commit()
