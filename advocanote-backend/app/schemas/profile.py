
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.schemas.onboarding import (
    OnboardingProfile,
    NotificationPreferences,
)


class LawyerProfileFields(OnboardingProfile):
    professional_title: str | None = Field(
        default=None,
        max_length=80,
    )

    law_firm: str | None = Field(
        default=None,
        max_length=150,
    )


class LawyerProfileResponse(BaseModel):
    full_name: str
    email: str
    onboarding_status: str
    profile: LawyerProfileFields


class LawyerProfileUpdate(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    full_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    phone: str | None = Field(
        default=None,
        min_length=7,
        max_length=30,
    )

    location: str | None = Field(
        default=None,
        min_length=2,
        max_length=100,
    )

    bar_number: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    practice_areas: list[str] | None = Field(
        default=None,
        min_length=1,
        max_length=15,
    )

    preferred_language: Literal[
        "English",
        "Tamil",
        "Sinhala",
    ] | None = None

    professional_title: str | None = Field(
        default=None,
        max_length=80,
    )

    law_firm: str | None = Field(
        default=None,
        max_length=150,
    )

    notification_preferences: NotificationPreferences | None = None

    @field_validator("practice_areas")
    @classmethod
    def validate_practice_areas(cls, value):
        if value is None:
            return value

        result = []

        for item in value:
            item = item.strip()

            if not item or len(item) > 60:
                raise ValueError("Invalid practice area.")

            if item not in result:
                result.append(item)

        return result

    @model_validator(mode="after")
    def validate_required_updates(self):
        required = (
            "full_name",
            "phone",
            "location",
            "bar_number",
            "practice_areas",
            "preferred_language",
        )

        for field_name in required:
            if (
                field_name in self.model_fields_set
                and getattr(self, field_name) is None
            ):
                raise ValueError(
                    f"{field_name} cannot be null."
                )

        return self
