
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field
from app.schemas.task import ApprovedTask
from app.schemas.case import CaseCreate


class AISuggestionDraft(BaseModel):
    title: str = Field(
        min_length=3,
        max_length=255
    )

    status: Literal[
        "pending",
        "approved",
        "rejected"
    ] = "pending"

    deadline: date | None = None

    priority: Literal[
        "Low",
        "Medium",
        "High"
    ] = "Medium"


class DiaryEntryCreate(BaseModel):
    entry_date: date

    case_number: str = Field(
        min_length=1,
        max_length=100
    )

    case_title: str = Field(
        default="Untitled Case",
        max_length=200
    )

    case_type: str | None = Field(
        default=None,
        max_length=100
    )

    other_case_type: str | None = Field(
        default=None,
        max_length=100
    )

    court_name: str = Field(
        min_length=2,
        max_length=150
    )

    location: str = Field(
        min_length=2,
        max_length=150
    )

    previous_date: date | None = None

    step_type: Literal[
        "Evidence",
        "Submissions",
        "Settlement",
        "Other"
    ] = "Other"

    step_notes: str = Field(min_length=3)

    point_notes: str | None = None

    input_method: Literal[
        "manual",
        "voice"
    ] = "manual"

    next_date: date | None = None

    next_hearing_purpose: str | None = None

    # Existing approved tasks
    approved_task: ApprovedTask | None = None

    approved_tasks: list[ApprovedTask] = Field(
        default_factory=list
    )

    # AI-generated suggestions only
    ai_suggestions: list[AISuggestionDraft] = Field(
        default_factory=list
    )
