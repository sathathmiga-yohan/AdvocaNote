
import gc
import logging
import tempfile

from pathlib import Path
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from faster_whisper import WhisperModel
from pydantic import BaseModel, Field

from app.auth.security import get_current_user
from app.auth.subscription_guard import require_feature
from app.models.user import User
from app.services.legal_ai import analyze_legal_transcript


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/voice-ai",
    tags=["Voice AI"],
)

# Tamil: existing specialised model
# English: multilingual Whisper model
WHISPER_MODELS = {
    "ta": "mohankumars26/whisper-tamil-medium-ct2",
    "en": "base",
}

ALLOWED_EXTENSIONS = {
    ".wav", ".mp3", ".m4a", ".mp4",
    ".webm", ".ogg", ".flac",
}

MAX_AUDIO_SIZE = 20 * 1024 * 1024
MAX_TRANSCRIPT_LENGTH = 20000


# =====================================
# LAWYER ACCESS
# =====================================

def lawyer_only(
    user: User = Depends(get_current_user),
):
    if not user.is_active or user.role != "lawyer":
        raise HTTPException(
            status_code=403,
            detail="Lawyer access required",
        )
    return user


# =====================================
# TAMIL + ENGLISH WHISPER
# =====================================

def transcribe_audio(
    audio_path: Path,
    language: Literal["ta", "en"] = "ta",
) -> str:
    model = WhisperModel(
        WHISPER_MODELS[language],
        device="cpu",
        compute_type="int8",
    )

    try:
        segments, _ = model.transcribe(
            str(audio_path),
            language=language,
            task="transcribe",
            beam_size=1,
            vad_filter=True,
            condition_on_previous_text=False,
        )

        return " ".join(
            segment.text.strip()
            for segment in segments
            if segment.text
        ).strip()

    finally:
        del model
        gc.collect()


# =====================================
# AUDIO FILE VALIDATION
# =====================================

def convert_uploaded_audio(
    file: UploadFile,
    language: Literal["ta", "en"] = "ta",
) -> str:

    extension = Path(
        file.filename or ""
    ).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail="Unsupported audio format",
        )

    temp_path = None

    try:
        total_size = 0

        with tempfile.NamedTemporaryFile(
            suffix=extension,
            delete=False,
        ) as temp:

            temp_path = Path(temp.name)

            while True:
                chunk = file.file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_AUDIO_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Audio file exceeds 20 MB",
                    )

                temp.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=422,
                detail="Empty audio file",
            )

        transcript = transcribe_audio(
            temp_path,
            language=language,
        )

        if not transcript:
            raise HTTPException(
                status_code=422,
                detail="No speech detected",
            )

        if len(transcript) > MAX_TRANSCRIPT_LENGTH:
            raise HTTPException(
                status_code=413,
                detail="Transcript exceeds 20,000 characters",
            )

        return transcript

    except HTTPException:
        raise

    except Exception as error:
        logger.exception("Voice transcription failed")

        raise HTTPException(
            status_code=500,
            detail=(
                "Voice transcription failed. "
                "Check backend logs."
            ),
        ) from error

    finally:
        file.file.close()

        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


# =====================================
# QWEN AI SERVICE
# =====================================

def analyze_text_service(
    transcript: str,
    language: Literal[
        "auto", "ta", "en"
    ] = "auto",
) -> dict:

    if not transcript.strip():
        raise HTTPException(
            status_code=422,
            detail="Transcript is empty",
        )

    if len(transcript) > MAX_TRANSCRIPT_LENGTH:
        raise HTTPException(
            status_code=413,
            detail="Transcript exceeds 20,000 characters",
        )

    try:
        return analyze_legal_transcript(
            transcript,
            language=language,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error

    except Exception as error:
        logger.exception("AI text analysis failed")

        raise HTTPException(
            status_code=500,
            detail=(
                "AI analysis failed. "
                "Check backend logs."
            ),
        ) from error


# =====================================
# REQUEST SCHEMA
# =====================================

class TextAnalysisRequest(BaseModel):
    text: str = Field(
        min_length=1,
        max_length=MAX_TRANSCRIPT_LENGTH,
    )

    language: Literal[
        "auto", "ta", "en"
    ] = "auto"


# =====================================
# API 1 - VOICE TO TEXT
# =====================================

@router.post(
    "/transcribe",
    dependencies=[
        Depends(require_feature("diary"))
    ],
)
def transcribe_voice(
    file: UploadFile = File(...),
    language: Literal[
        "ta", "en"
    ] = Form("ta"),
    user: User = Depends(lawyer_only),
):
    transcript = convert_uploaded_audio(
        file,
        language=language,
    )

    return {
        "transcript": transcript,
    }


# =====================================
# API 2 - TEXT TO AI NOTES
# =====================================

@router.post(
    "/analyze-text",
    dependencies=[
        Depends(require_feature("diary"))
    ],
)
def analyze_text(
    payload: TextAnalysisRequest,
    user: User = Depends(lawyer_only),
):
    return analyze_text_service(
        payload.text.strip(),
        language=payload.language,
    )


# =====================================
# OLD API - KEEP COMPATIBILITY
# =====================================

@router.post(
    "/analyze",
    dependencies=[
        Depends(require_feature("diary"))
    ],
)
def analyze_voice(
    file: UploadFile = File(...),
    language: Literal[
        "ta", "en"
    ] = Form("ta"),
    user: User = Depends(lawyer_only),
):
    transcript = convert_uploaded_audio(
        file,
        language=language,
    )

    result = analyze_text_service(
        transcript,
        language="auto",
    )

    return {
        "message": "Voice analysis completed",
        "transcript": transcript,
        **result,
    }
