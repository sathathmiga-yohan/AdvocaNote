
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class ApprovedTask(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    deadline: date | None = None
