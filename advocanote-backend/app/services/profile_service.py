
from sqlalchemy.orm import Session

from app.models.user import User

from app.schemas.onboarding import NotificationPreferences

from app.schemas.profile import (
    LawyerProfileFields,
    LawyerProfileResponse,
    LawyerProfileUpdate,
)


def get_lawyer_profile(
    user: User,
) -> LawyerProfileResponse:

    profile = LawyerProfileFields(
        phone=user.phone_number,
        location=user.city,
        bar_number=user.bar_number,
        practice_areas=user.practice_areas or [],
        preferred_language=user.preferred_language or "English",
        professional_title=user.professional_title,
        law_firm=user.law_firm,
        notification_preferences=NotificationPreferences(
            hearing_reminders=user.hearing_reminders,
            task_reminders=user.task_reminders,
            email_notifications=user.email_notifications,
        ),
    )

    return LawyerProfileResponse(
        full_name=user.full_name,
        email=user.email,
        onboarding_status=user.onboarding_status,
        profile=profile,
    )


def update_lawyer_profile(
    db: Session,
    user: User,
    data: LawyerProfileUpdate,
) -> LawyerProfileResponse:

    changes = data.model_dump(exclude_unset=True)

    field_mapping = {
        "full_name": "full_name",
        "phone": "phone_number",
        "location": "city",
        "bar_number": "bar_number",
        "practice_areas": "practice_areas",
        "preferred_language": "preferred_language",
        "professional_title": "professional_title",
        "law_firm": "law_firm",
    }

    try:
        for request_field, model_field in field_mapping.items():
            if request_field in changes:
                value = changes[request_field]

                if (
                    request_field in ("professional_title", "law_firm")
                    and not value
                ):
                    value = None

                setattr(user, model_field, value)

        if "notification_preferences" in changes:
            preferences = data.notification_preferences

            if preferences is not None:
                user.hearing_reminders = preferences.hearing_reminders
                user.task_reminders = preferences.task_reminders
                user.email_notifications = preferences.email_notifications

        db.add(user)
        db.commit()
        db.refresh(user)

        return get_lawyer_profile(user)

    except Exception:
        db.rollback()
        raise
