
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class NotificationPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hearing_reminders: bool = True
    task_reminders: bool = True
    email_notifications: bool = True


class OnboardingProfile(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    phone: str | None = Field(
        default=None,
        max_length=30,
    )

    location: str | None = Field(
        default=None,
        max_length=100,
    )

    bar_number: str | None = Field(
        default=None,
        max_length=100,
    )

    practice_areas: list[str] = Field(
        default_factory=list,
        max_length=15,
    )

    preferred_language: Literal[
        "English",
        "Tamil",
        "Sinhala",
    ] = "English"

    notification_preferences: NotificationPreferences = Field(
        default_factory=NotificationPreferences
    )

    @field_validator("practice_areas")
    @classmethod
    def validate_practice_areas(cls, value):
        cleaned = []

        for area in value:
            if not isinstance(area, str):
                raise ValueError(
                    "Each practice area must be text."
                )

            area = area.strip()

            if not area or len(area) > 60:
                raise ValueError(
                    "Invalid practice area."
                )

            if area not in cleaned:
                cleaned.append(area)

        return cleaned


class OnboardingResponse(BaseModel):
    onboarding_status: Literal[
        "pending",
        "completed",
        "skipped",
    ]

    should_show_onboarding: bool

    profile: OnboardingProfile


class OnboardingCompleteRequest(OnboardingProfile):
    phone: str = Field(
        min_length=7,
        max_length=30,
    )

    location: str = Field(
        min_length=2,
        max_length=100,
    )

    bar_number: str = Field(
        min_length=1,
        max_length=100,
    )

    practice_areas: list[str] = Field(
        min_length=1,
        max_length=15,
    )

    preferred_language: Literal[
        "English",
        "Tamil",
        "Sinhala",
    ]

    notification_preferences: NotificationPreferences
