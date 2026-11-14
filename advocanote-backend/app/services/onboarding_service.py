
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.user import User

from app.schemas.onboarding import (
    OnboardingProfile,
    OnboardingResponse,
    NotificationPreferences,
)


def get_onboarding_state(
    user: User,
) -> OnboardingResponse:

    profile = OnboardingProfile(
        phone=user.phone_number,
        location=user.city,
        bar_number=user.bar_number,
        practice_areas=user.practice_areas or [],
        preferred_language=user.preferred_language,
        notification_preferences=NotificationPreferences(
            hearing_reminders=user.hearing_reminders,
            task_reminders=user.task_reminders,
            email_notifications=user.email_notifications,
        ),
    )

    return OnboardingResponse(
        onboarding_status=user.onboarding_status,
        should_show_onboarding=(
            user.onboarding_status == "pending"
        ),
        profile=profile,
    )


def complete_onboarding(
    db: Session,
    user: User,
    data: OnboardingCompleteRequest,
) -> OnboardingResponse:

    preferences = data.notification_preferences

    try:
        # Only a pending onboarding can be completed.
        # This also protects against simultaneous requests.
        db.execute(
            update(User)
            .where(
                User.id == user.id,
                User.onboarding_status == "pending",
            )
            .values(
                phone_number=data.phone or None,
                city=data.location or None,
                bar_number=data.bar_number or None,
                practice_areas=data.practice_areas,
                preferred_language=data.preferred_language,
                hearing_reminders=preferences.hearing_reminders,
                task_reminders=preferences.task_reminders,
                email_notifications=preferences.email_notifications,
                onboarding_status="completed",
            )
        )

        db.commit()
        db.refresh(user)

        return get_onboarding_state(user)

    except Exception:
        db.rollback()
        raise


def skip_onboarding(
    db: Session,
    user: User,
) -> OnboardingResponse:

    try:
        db.execute(
            update(User)
            .where(
                User.id == user.id,
                User.onboarding_status == "pending",
            )
            .values(
                onboarding_status="skipped",
            )
        )

        db.commit()
        db.refresh(user)

        return get_onboarding_state(user)

    except Exception:
        db.rollback()
        raise
