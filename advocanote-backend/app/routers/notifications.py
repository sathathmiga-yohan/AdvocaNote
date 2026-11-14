
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db

from app.models.user import User
from app.models.reminder import Reminder
from app.models.hearing import Hearing
from app.models.task import Task
from app.models.case import Case

from app.routers.diary import lawyer_only


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)

# Sri Lanka local date
SL_TIMEZONE = timezone(
    timedelta(hours=5, minutes=30)
)


@router.get("")
def get_my_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    today = datetime.now(
        SL_TIMEZONE
    ).date()

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

    notifications = []

    for reminder in reminders:
        reminder_type = (
            reminder.reminder_type or ""
        ).lower()

        # HEARING NOTIFICATIONS
        if reminder_type == "hearing":
            if not user.hearing_reminders:
                continue

            hearing = db.get(
                Hearing,
                reminder.hearing_id,
            ) if reminder.hearing_id else None

            if hearing is None:
                continue

            case = db.get(
                Case,
                hearing.case_id,
            )

            if (
                case is None
                or case.lawyer_id != user.id
                or hearing.status != "Scheduled"
                or hearing.hearing_date < today
            ):
                continue

        # TASK NOTIFICATIONS
        elif reminder_type == "task":
            if not user.task_reminders:
                continue

            task = db.get(
                Task,
                reminder.task_id,
            ) if reminder.task_id else None

            if (
                task is None
                or task.lawyer_id != user.id
                or task.status != "Pending"
                or task.deadline is None
            ):
                continue

        else:
            continue

        notifications.append({
            "id": reminder.id,
            "type": reminder_type,
            "title": reminder.title,
            "reminder_date": (
                reminder.reminder_date.isoformat()
            ),
            "hearing_id": reminder.hearing_id,
            "task_id": reminder.task_id,
        })

    return {
        "count": len(notifications),
        "notifications": notifications,
    }
