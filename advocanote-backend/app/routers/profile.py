
from fastapi import APIRouter, Depends,  File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse

from app.auth.onboarding_guard import (
    require_onboarding_complete,
)

from app.database import get_db
from app.models.user import User

from app.schemas.profile import (
    LawyerProfileResponse,
    LawyerProfileUpdate,
)

from app.services.profile_service import (
    get_lawyer_profile,
    update_lawyer_profile,
)
from app.services.profile_photo_service import (
    MAX_FILE_BYTES,
    get_photo_path,
    save_profile_photo,
    remove_profile_photo,
)



router = APIRouter(
    prefix="/profile",
    tags=["Lawyer Profile"],
)


@router.get(
    "/me",
    response_model=LawyerProfileResponse,
)
def read_my_profile(
    user: User = Depends(require_onboarding_complete),
):
    return get_lawyer_profile(user)

# ======================================
# UPLOAD PROFILE PHOTO
# ======================================

@router.post("/photo")
async def upload_my_profile_photo(
    photo: UploadFile = File(...),
    user: User = Depends(require_onboarding_complete),
):
    if photo.content_type not in (
        "image/jpeg",
        "image/png",
        "image/webp",
    ):
        raise HTTPException(
            status_code=415,
            detail="Please upload a JPG, PNG or WEBP image.",
        )

    content = await photo.read(MAX_FILE_BYTES + 1)
    await photo.close()

    save_profile_photo(user.id, content)

    return {
        "message": "Profile photo uploaded successfully."
    }


# ======================================
# GET PROFILE PHOTO
# ======================================

@router.get("/photo")
def get_my_profile_photo(
    user: User = Depends(require_onboarding_complete),
):
    path = get_photo_path(user.id)

    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Profile photo not found.",
        )

    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "private, no-store",
        },
    )


# ======================================
# REMOVE PROFILE PHOTO
# ======================================

@router.delete("/photo")
def delete_my_profile_photo(
    user: User = Depends(require_onboarding_complete),
):
    remove_profile_photo(user.id)

    return {
        "message": "Profile photo removed successfully."
    }


@router.put(
    "/me",
    response_model=LawyerProfileResponse,
)
@router.patch(
    "/me",
    response_model=LawyerProfileResponse,
)
def edit_my_profile(
    data: LawyerProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_onboarding_complete),
):
    return update_lawyer_profile(
        db=db,
        user=user,
        data=data,
    )
