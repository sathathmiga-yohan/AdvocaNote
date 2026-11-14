
from fastapi import Depends, HTTPException
from app.auth.security import get_current_user
from app.models.user import User


def require_onboarding_complete(
    user: User = Depends(get_current_user),
):
    if not user.is_active or user.role != "lawyer":
        raise HTTPException(
            status_code=403,
            detail="Lawyer access required",
        )

    if user.onboarding_status not in ("completed", "skipped"):
        raise HTTPException(
            status_code=403,
            detail="Complete your profile before using AdvocaNote.",
        )

    return user
