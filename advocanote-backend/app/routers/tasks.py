
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.user import User
from app.models.diary import Case, Task, Reminder
from app.routers.diary import lawyer_only
from app.auth.subscription_guard import require_feature

router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"],
)


# CASE TASKS API

class CaseTaskCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )
    deadline: date | None = None
    priority: Literal[
        "Low", "Medium", "High"
    ] = "Medium"


class CaseTaskPatch(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )
    deadline: date | None = None
    priority: Literal[
        "Low", "Medium", "High"
    ] | None = None
    status: Literal[
        "Pending", "Completed"
    ] | None = None


def task_json(task: Task):
    return {
        "id": task.id,
        "case_id": task.case_id,
        "title": task.title,
        "deadline": (
            task.deadline.isoformat()
            if task.deadline else None
        ),
        "priority": task.priority or "Medium",
        "status": task.status or "Pending",
    }


def owned_case(
    case_id: int,
    db: Session,
    user: User,
):
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

    return case


def owned_task(
    task_id: int,
    db: Session,
    user: User,
):
    task = db.scalar(
        select(Task).where(
            Task.id == task_id,
            Task.lawyer_id == user.id,
        )
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    return task


# =====================================
# CREATE / UPDATE TASK REMINDER
# =====================================

def sync_task_reminder(
    db: Session,
    task: Task,
):
    # Remove outdated task reminder.
    db.execute(
        delete(Reminder).where(
            Reminder.task_id == task.id,
            Reminder.user_id == task.lawyer_id,
            Reminder.reminder_type == "Task",
        )
    )

    # Completed tasks do not need reminders.
    if task.status != "Pending":
        return

    # Tasks without deadlines do not need reminders.
    if task.deadline is None:
        return

    # Do not schedule reminders for past deadlines.
    if task.deadline < date.today():
        return

    # Remind one day before the deadline.
    reminder_date = max(
        date.today(),
        task.deadline - timedelta(days=1),
    )

    db.add(
        Reminder(
            user_id=task.lawyer_id,
            task_id=task.id,
            reminder_type="Task",
            title=f"Task Deadline: {task.title}",
            reminder_date=reminder_date,
        )
    )

# READ ALL LAWYER TASKS

@router.get("")
def get_all_tasks(
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    tasks = db.scalars(
        select(Task)
        .where(Task.lawyer_id == user.id)
        .order_by(Task.id.desc())
    ).all()

    return [
        task_json(task)
        for task in tasks
    ]


# READ CASE TASKS

@router.get("/case/{case_id}")
def case_tasks(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    owned_case(case_id, db, user)

    tasks = db.scalars(
        select(Task)
        .where(
            Task.case_id == case_id,
            Task.lawyer_id == user.id,
        )
        .order_by(Task.id.desc())
    ).all()

    return [
        task_json(task)
        for task in tasks
    ]


# CREATE MANUAL TASK


@router.post(
    "/case/{case_id}",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_feature("tasks"))],
)

def create_case_task(
    case_id: int,
    data: CaseTaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    owned_case(case_id, db, user)

    title = data.title.strip()

    if not title:
        raise HTTPException(
            status_code=422,
            detail="Task title is required",
        )

    task = Task(
        lawyer_id=user.id,
        case_id=case_id,
        diary_entry_id=None,
        title=title,
        deadline=data.deadline,
        priority=data.priority,
        status="Pending",
    )

    db.add(task)
    db.flush()

    sync_task_reminder(db, task)

    db.commit()
    db.refresh(task)

    return task_json(task)


# UPDATE TASK


@router.patch(
    "/{task_id}",
    dependencies=[Depends(require_feature("tasks"))],
)

def update_case_task(
    task_id: int,
    data: CaseTaskPatch,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    task = owned_task(task_id, db, user)

    fields = data.model_fields_set

    if "title" in fields:
        title = (data.title or "").strip()

        if not title:
            raise HTTPException(
                status_code=422,
                detail="Task title is required",
            )

        task.title = title

    if "deadline" in fields:
        task.deadline = data.deadline

    if "priority" in fields:
        if data.priority is None:
            raise HTTPException(
                status_code=422,
                detail="Priority is required",
            )

        task.priority = data.priority

    if "status" in fields:
        if data.status is None:
            raise HTTPException(
                status_code=422,
                detail="Status is required",
            )

        task.status = data.status
    
    if fields & {"title", "deadline", "status"}:
        sync_task_reminder(db, task)
     
    db.commit()
    db.refresh(task)

    return task_json(task)


# DELETE TASK


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_feature("tasks"))],
)

def delete_case_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):
    task = owned_task(task_id, db, user)

    db.execute(
        delete(Reminder).where(
            Reminder.task_id == task.id,
            Reminder.user_id == user.id,
        )
    )

    db.delete(task)
    db.commit()
