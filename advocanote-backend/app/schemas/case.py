
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


# MY CASES - CREATE NEW CASE

class CaseCreate(BaseModel):
    case_number: str = Field(
        min_length=1, max_length=100
    )

    case_title: str = Field(
        default="Untitled Case",
        max_length=200
    )

    case_type: str = Field(
        min_length=1, max_length=100
    )
    
    other_case_type: str | None = Field(
        default=None, max_length=100
    )

    case_stage: str | None = Field(
        default=None, max_length=100
    )

    status: Literal[
        "Active",
        "Pending",
        "Closed"
    ] = "Active"

    court_type: str = Field(
        min_length=1, max_length=100
    )

    court_name: str = Field(
        min_length=2, max_length=150
    )

    location: str = Field(
        min_length=2, max_length=150
    )
