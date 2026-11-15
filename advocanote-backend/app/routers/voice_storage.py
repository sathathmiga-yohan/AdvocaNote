
import json
import uuid

from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from fastapi.responses import FileResponse

from sqlalchemy.orm import Session

from app.auth.security import get_current_user
from app.auth.subscription_guard import require_feature

from app.database import get_db

from app.models.diary import DiaryEntry
from app.models.user import User

from app.models.voice_attachment import (
    DiaryVoiceAttachment,
)


router = APIRouter(
    prefix="/voice-ai",
    tags=["Voice AI Storage"],
    dependencies=[
        Depends(require_feature("diary"))
    ],
)


# =====================================
# PRIVATE AUDIO STORAGE
# =====================================

BACKEND_DIR = Path(
    __file__
).resolve().parents[2]

PRIVATE_DIR = (
    BACKEND_DIR /
    "private_voice_recordings"
)

MAX_BYTES = 20 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".wav",
    ".mp3",
    ".m4a",
    ".mp4",
    ".webm",
    ".ogg",
    ".flac",
}


# =====================================
# VERIFY DIARY OWNERSHIP
# =====================================

def get_owned_entry(
    db: Session,
    entry_id: int,
    user_id: int,
):
    entry = (
        db.query(DiaryEntry)
        .filter(
            DiaryEntry.id == entry_id,
            DiaryEntry.lawyer_id == user_id,
        )
        .first()
    )

    if entry is None:
        raise HTTPException(
            status_code=404,
            detail="Diary entry not found.",
        )

    return entry


# =====================================
# VALIDATE JSON LIST
# =====================================

def validate_json_list(
    raw: str,
    field_name: str,
    objects: bool = False,
):
    if len(raw) > 100_000:
        raise HTTPException(
            status_code=413,
            detail=f"{field_name} is too large.",
        )

    try:
        value = json.loads(raw)

    except (ValueError, TypeError):
        raise HTTPException(
            status_code=422,
            detail=f"{field_name} must be valid JSON.",
        )

    if not isinstance(value, list):
        raise HTTPException(
            status_code=422,
            detail=f"{field_name} must be a JSON array.",
        )

    if objects:
        valid = all(
            isinstance(item, dict)
            and isinstance(
                item.get("point"), str
            )
            and isinstance(
                item.get("category", ""), str
            )
            for item in value
        )

    else:
        valid = all(
            isinstance(item, str)
            for item in value
        )

    if not valid:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {field_name} items.",
        )

    return json.dumps(
        value,
        ensure_ascii=False,
    )


# =====================================
# GET OWNED RECORDING
# =====================================

def get_owned_recording(
    db: Session,
    entry_id: int,
    user_id: int,
):
    get_owned_entry(
        db,
        entry_id,
        user_id,
    )

    record = (
        db.query(DiaryVoiceAttachment)
        .filter(
            DiaryVoiceAttachment.diary_entry_id
            == entry_id,

            DiaryVoiceAttachment.lawyer_id
            == user_id,
        )
        .first()
    )

    if record is None:
        raise HTTPException(
            status_code=404,
            detail="No voice recording for this diary.",
        )

    return record


# =====================================
# SAVE ORIGINAL VOICE RECORDING
# =====================================

@router.post(
    "/recordings/{entry_id}"
)
async def save_voice_recording(
    entry_id: int,

    audio: UploadFile = File(...),

    source_transcript: str = Form(...),

    reviewed_transcript: str = Form(...),

    notes_json: str = Form("[]"),

    highlights_json: str = Form("[]"),

    approved_notes_json: str = Form("[]"),

    db: Session = Depends(get_db),

    user: User = Depends(
        get_current_user
    ),
):
    # Verify this lawyer owns the diary.
    entry = get_owned_entry(
        db,
        entry_id,
        user.id,
    )

    if (
        not source_transcript.strip()
        or not reviewed_transcript.strip()
    ):
        raise HTTPException(
            status_code=422,
            detail="Transcript cannot be empty.",
        )

    if (
        len(source_transcript) > 200_000
        or len(reviewed_transcript) > 200_000
    ):
        raise HTTPException(
            status_code=413,
            detail="Transcript is too large.",
        )

    # Validate AI notes before saving.
    notes = validate_json_list(
        notes_json,
        "notes_json",
        objects=True,
    )

    highlights = validate_json_list(
        highlights_json,
        "highlights_json",
    )

    approved_notes = validate_json_list(
        approved_notes_json,
        "approved_notes_json",
        objects=True,
    )

    # Validate audio extension.
    original_name = Path(
        audio.filename or ""
    ).name

    extension = Path(
        original_name
    ).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Unsupported audio extension.",
        )

    # Private directory per lawyer.
    directory = (
        PRIVATE_DIR /
        str(user.id)
    )

    directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    # Random filename prevents collisions.
    file_key = (
        uuid.uuid4().hex + extension
    )

    file_path = directory / file_key

    total = 0

    try:
        # Stream file to disk with size limit.
        with file_path.open("xb") as destination:

            while True:
                chunk = await audio.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                total += len(chunk)

                if total > MAX_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="Audio exceeds 20 MB.",
                    )

                destination.write(chunk)

        if total == 0:
            raise HTTPException(
                status_code=422,
                detail="Audio file is empty.",
            )

        # One recording attached to each diary.
        record = (
            db.query(DiaryVoiceAttachment)
            .filter(
                DiaryVoiceAttachment.diary_entry_id
                == entry.id,

                DiaryVoiceAttachment.lawyer_id
                == user.id,
            )
            .first()
        )

        previous_key = (
            record.file_key
            if record
            else None
        )

        if record is None:
            record = DiaryVoiceAttachment(
                diary_entry_id=entry.id,
                lawyer_id=user.id,
            )

            db.add(record)

        # Audio metadata.
        record.file_key = file_key

        record.original_filename = (
            original_name[:255]
        )

        record.mime_type = (
            audio.content_type
            or "application/octet-stream"
        )[:120]

        record.size_bytes = total

        # Preserve both transcripts.
        record.source_transcript = (
            source_transcript
        )

        record.reviewed_transcript = (
            reviewed_transcript
        )

        # Save AI suggestions and approved notes.
        record.ai_notes_json = notes

        record.highlights_json = highlights

        record.approved_notes_json = (
            approved_notes
        )

        entry.input_method = "voice"

        db.commit()

        # Only delete an old audio file
        # after the replacement is saved.
        if (
            previous_key
            and previous_key != file_key
        ):
            old_path = directory / previous_key

            old_path.unlink(
                missing_ok=True
            )

    except Exception:
        db.rollback()

        file_path.unlink(
            missing_ok=True
        )

        raise

    finally:
        await audio.close()

    return {
        "diary_entry_id": entry_id,
        "audio_saved": True,
        "size_bytes": total,
        "audio_endpoint": (
            f"/voice-ai/recordings/"
            f"{entry_id}/audio"
        ),
    }


# =====================================
# GET SAVED TRANSCRIPT AND NOTES
# =====================================

@router.get(
    "/recordings/{entry_id}"
)
def get_voice_recording(
    entry_id: int,

    db: Session = Depends(get_db),

    user: User = Depends(
        get_current_user
    ),
):
    record = get_owned_recording(
        db,
        entry_id,
        user.id,
    )

    return {
        "diary_entry_id": entry_id,

        "source_transcript":
            record.source_transcript,

        "reviewed_transcript":
            record.reviewed_transcript,

        "notes": json.loads(
            record.ai_notes_json
        ),

        "highlights": json.loads(
            record.highlights_json
        ),

        "approved_notes": json.loads(
            record.approved_notes_json
        ),

        "audio_saved": True,

        "audio_endpoint": (
            f"/voice-ai/recordings/"
            f"{entry_id}/audio"
        ),
    }


# =====================================
# PLAY OR DOWNLOAD ORIGINAL AUDIO
# =====================================

@router.get(
    "/recordings/{entry_id}/audio"
)
def get_voice_audio(
    entry_id: int,

    db: Session = Depends(get_db),

    user: User = Depends(
        get_current_user
    ),
):
    record = get_owned_recording(
        db,
        entry_id,
        user.id,
    )

    path = (
        PRIVATE_DIR /
        str(user.id) /
        record.file_key
    )

    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Stored audio is missing.",
        )

    return FileResponse(
        str(path),

        media_type=record.mime_type,

        headers={
            "Cache-Control":
                "private, no-store",
        },
    )
