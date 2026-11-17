
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.reminder import Reminder
from app.models.hearing import Hearing
from app.models.task import Task
from app.models.case import Case
from app.models.calendar_custom_event import CalendarCustomEvent
from app.routers.diary import lawyer_only


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)

SL_TIMEZONE = timezone(
    timedelta(hours=5, minutes=30)
)

NotificationType = Literal[
    "all",
    "core",
    "hearing",
    "task",
    "event",
]


def get_today():
    return datetime.now(
        SL_TIMEZONE
    ).date()


def get_utc_now():
    return datetime.now(
        timezone.utc
    ).replace(tzinfo=None)


def normalize_status(value):
    if hasattr(value, "value"):
        value = value.value

    return str(value or "").strip().lower()


def get_reminder_type(reminder):
    return str(
        reminder.reminder_type or ""
    ).strip().lower()


def event_reminder_title(event):
    title = f"{event.kind}: {event.title}"

    if event.event_time:
        title += (
            " · "
            + event.event_time.strftime("%H:%M")
        )

    return title[:255]


def reconcile_custom_event_reminders(
    db: Session,
    user: User,
):
    today = get_today()

    events = db.scalars(
        select(CalendarCustomEvent)
        .where(
            CalendarCustomEvent.lawyer_id == user.id,
            CalendarCustomEvent.event_date >= today,
        )
    ).all()

    existing_reminders = db.scalars(
        select(Reminder)
        .where(
            Reminder.user_id == user.id,
            Reminder.custom_event_id.is_not(None),
        )
        .order_by(Reminder.id.asc())
    ).all()

    event_map = {
        event.id: event
        for event in events
    }

    reminder_map = {}
    changed = False

    for reminder in existing_reminders:
        event_id = reminder.custom_event_id

        if (
            event_id not in event_map
            or event_id in reminder_map
        ):
            db.delete(reminder)
            changed = True
            continue

        reminder_map[event_id] = reminder

    for event in events:
        reminder_date = (
            event.event_date - timedelta(days=1)
        )

        title = event_reminder_title(event)

        reminder = reminder_map.get(event.id)

        if reminder is None:
            db.add(
                Reminder(
                    user_id=user.id,
                    custom_event_id=event.id,
                    reminder_type="Event",
                    title=title,
                    reminder_date=reminder_date,
                    is_read=False,
                )
            )

            changed = True
            continue

        date_changed = (
            reminder.reminder_date != reminder_date
        )

        title_changed = (
            reminder.title != title
        )

        if date_changed or title_changed:
            reminder.reminder_date = reminder_date
            reminder.title = title
            reminder.is_read = False
            reminder.read_at = None
            changed = True

        if get_reminder_type(reminder) != "event":
            reminder.reminder_type = "Event"
            changed = True

    if changed:
        db.commit()


def is_valid_notification(
    db: Session,
    user: User,
    reminder: Reminder,
    today,
    notification_type: NotificationType = "all",
):
    if reminder.user_id != user.id:
        return False

    if reminder.reminder_date > today:
        return False

    reminder_type = get_reminder_type(
        reminder
    )

    if notification_type == "core":
        if reminder_type not in {
            "hearing",
            "task",
        }:
            return False

    elif (
        notification_type != "all"
        and reminder_type != notification_type
    ):
        return False

    if reminder_type == "hearing":
        if not user.hearing_reminders:
            return False

        if not reminder.hearing_id:
            return False

        hearing = db.get(
            Hearing,
            reminder.hearing_id,
        )

        if hearing is None:
            return False

        case = db.get(
            Case,
            hearing.case_id,
        )

        if (
            case is None
            or case.lawyer_id != user.id
        ):
            return False

        if normalize_status(
            hearing.status
        ) != "scheduled":
            return False

        hearing_date = hearing.hearing_date

        if isinstance(
            hearing_date,
            datetime
        ):
            hearing_date = hearing_date.date()

        if (
            hearing_date is None
            or hearing_date < today
        ):
            return False

        return True

    if reminder_type == "task":
        if not user.task_reminders:
            return False

        if not reminder.task_id:
            return False

        task = db.get(
            Task,
            reminder.task_id,
        )

        if task is None:
            return False

        if task.lawyer_id != user.id:
            return False

        if normalize_status(
            task.status
        ) != "pending":
            return False

        if task.deadline is None:
            return False

        return True

    if reminder_type == "event":
        if not reminder.custom_event_id:
            return False

        event = db.get(
            CalendarCustomEvent,
            reminder.custom_event_id,
        )

        if event is None:
            return False

        if event.lawyer_id != user.id:
            return False

        if event.event_date < today:
            return False

        return True

    return False


def get_visible_reminders(
    db: Session,
    user: User,
    notification_type: NotificationType = "all",
):
    reconcile_custom_event_reminders(
        db,
        user,
    )

    today = get_today()

    reminders = db.scalars(
        select(Reminder)
        .where(
            Reminder.user_id == user.id,
            Reminder.reminder_date <= today,
        )
        .order_by(
            Reminder.reminder_date.desc(),
            Reminder.id.desc(),
        )
    ).all()

    return [
        reminder
        for reminder in reminders
        if is_valid_notification(
            db,
            user,
            reminder,
            today,
            notification_type,
        )
    ]


def serialize_notification(reminder):
    return {
        "id": reminder.id,
        "type": get_reminder_type(
            reminder
        ),
        "title": reminder.title,
        "reminder_date": (
            reminder.reminder_date.isoformat()
        ),
        "hearing_id": reminder.hearing_id,
        "task_id": reminder.task_id,
        "custom_event_id": (
            reminder.custom_event_id
        ),
        "is_read": bool(reminder.is_read),
        "read_at": (
            reminder.read_at.isoformat() + "Z"
            if reminder.read_at
            else None
        ),
    }


@router.get("")
def get_my_notifications(
    notification_type: NotificationType = Query(
        "all",
        alias="type",
    ),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    reminders = get_visible_reminders(
        db,
        user,
        notification_type,
    )

    unread_count = sum(
        1
        for reminder in reminders
        if not reminder.is_read
    )

    if unread_only:
        displayed_reminders = [
            reminder
            for reminder in reminders
            if not reminder.is_read
        ]
    else:
        displayed_reminders = reminders

    notifications = [
        serialize_notification(reminder)
        for reminder in displayed_reminders
    ]

    return {
        "count": len(notifications),
        "unread_count": unread_count,
        "notifications": notifications,
    }


@router.patch("/read-all")
def mark_all_notifications_as_read(
    notification_type: NotificationType = Query(
        "all",
        alias="type",
    ),
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    reminders = get_visible_reminders(
        db,
        user,
        notification_type,
    )

    now = get_utc_now()
    updated_count = 0

    for reminder in reminders:
        if reminder.is_read:
            continue

        reminder.is_read = True
        reminder.read_at = now
        updated_count += 1

    db.commit()

    return {
        "success": True,
        "message": "All notifications marked as read",
        "updated_count": updated_count,
        "unread_count": 0,
    }


@router.patch("/{notification_id}/read")
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    reminder = db.scalar(
        select(Reminder).where(
            Reminder.id == notification_id,
            Reminder.user_id == user.id,
        )
    )

    if (
        reminder is None
        or not is_valid_notification(
            db,
            user,
            reminder,
            get_today(),
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    if not reminder.is_read:
        reminder.is_read = True
        reminder.read_at = get_utc_now()

        db.commit()
        db.refresh(reminder)

    return {
        "success": True,
        "message": "Notification marked as read",
        "notification": serialize_notification(
            reminder
        ),
    }


@router.patch("/{notification_id}/unread")
def mark_notification_as_unread(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    reminder = db.scalar(
        select(Reminder).where(
            Reminder.id == notification_id,
            Reminder.user_id == user.id,
        )
    )

    if (
        reminder is None
        or not is_valid_notification(
            db,
            user,
            reminder,
            get_today(),
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    if reminder.is_read:
        reminder.is_read = False
        reminder.read_at = None

        db.commit()
        db.refresh(reminder)

    return {
        "success": True,
        "message": "Notification marked as unread",
        "notification": serialize_notification(
            reminder
        ),
    }
