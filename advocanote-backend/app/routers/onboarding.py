
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy.orm import Session

from app.auth.security import get_current_user
from app.database import get_db
from app.models.user import User

from app.schemas.onboarding import (
    OnboardingProfile,
    OnboardingResponse,
    OnboardingCompleteRequest,
)

from app.services.onboarding_service import (
    get_onboarding_state,
    complete_onboarding,
    skip_onboarding,
)


router = APIRouter(
    prefix="/onboarding",
    tags=["Lawyer Onboarding"],
)


# =====================================
# AUTHENTICATED LAWYERS ONLY
# =====================================

def current_lawyer(
    user: User = Depends(get_current_user),
) -> User:

    if not user.is_active or user.role != "lawyer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Lawyer access required",
        )

    return user


# =====================================
# GET ONBOARDING DETAILS
# =====================================

@router.get(
    "/me",
    response_model=OnboardingResponse,
)
def get_my_onboarding(
    user: User = Depends(current_lawyer),
):
    return get_onboarding_state(user)


# =====================================
# COMPLETE ONBOARDING
# =====================================

@router.put(
    "/complete",
    response_model=OnboardingResponse,
)
def finish_my_onboarding(
    data: OnboardingCompleteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(current_lawyer),
):
    return complete_onboarding(
        db=db,
        user=user,
        data=data,
    )

