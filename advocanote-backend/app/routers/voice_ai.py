
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

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal

from app.auth.security import get_current_user
from app.auth.subscription_guard import require_feature

from app.models.user import User
from app.models.subscription_plan import SubscriptionPlan
from app.models.subscription_daily_usage import (
    SubscriptionDailyUsage,
)

from app.services.subscription_usage import (
    consume_daily_action,
    get_valid_subscription,
    get_usage_date,
)

from app.services.legal_ai import analyze_legal_transcript


# =====================================
# LOGGING
# =====================================

logger = logging.getLogger(__name__)


# =====================================
# VOICE AI ROUTER
# =====================================

router = APIRouter(
    prefix="/voice-ai",
    tags=["Voice AI"],
)


# =====================================
# WHISPER MODELS
# =====================================

# Tamil: existing specialised model
# English: multilingual Whisper model

WHISPER_MODELS = {
    "ta": "mohankumars26/whisper-tamil-medium-ct2",
    "en": "base",
}


# =====================================
# AUDIO CONFIGURATION
# =====================================

ALLOWED_EXTENSIONS = {
    ".wav",
    ".mp3",
    ".m4a",
    ".mp4",
    ".webm",
    ".ogg",
    ".flac",
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
# DAILY LIMIT ERROR
# =====================================

def daily_limit_error(limit: int):

    return HTTPException(
        status_code=429,
        detail={
            "code": "DAILY_ACTION_LIMIT_REACHED",
            "message": (
                "You have reached your daily "
                "action limit. Upgrade to "
                "Premium or Annual for "
                "unlimited access."
            ),
            "daily_limit": limit,
            "remaining": 0,
        },
    )


# =====================================
# CHECK AI QUOTA BEFORE CPU PROCESSING
# =====================================

def check_ai_action_available(
    user_id: int,
):

    # Separate short database session.
    #
    # This check finishes before Whisper
    # or Qwen starts CPU processing.
    #
    # The final action is still checked
    # again when usage is committed.

    with SessionLocal() as check_db:

        subscription = get_valid_subscription(
            check_db,
            user_id,
        )

        # Valid free trial = unlimited.

        if subscription.status == "trialing":
            return

        plan = check_db.get(
            SubscriptionPlan,
            subscription.plan_id,
        )

        if plan is None:
            raise HTTPException(
                status_code=403,
                detail="Subscription plan not found",
            )

        limit = plan.daily_action_limit

        # Premium / Annual = unlimited.

        if limit is None:
            return

        if limit < 1:
            raise HTTPException(
                status_code=403,
                detail="Invalid daily action limit",
            )

        today = get_usage_date()

        actions_used = check_db.scalar(
            select(
                SubscriptionDailyUsage.actions_used
            ).where(
                SubscriptionDailyUsage.user_id
                == user_id,

                SubscriptionDailyUsage.usage_date
                == today,
            )
        )

        used = actions_used or 0

        if used >= limit:
            raise daily_limit_error(limit)


# =====================================
# RECORD SUCCESSFUL AI ACTION
# =====================================

def record_successful_ai_action(
    db: Session,
    user_id: int,
):

    try:

        # Final subscription and quota check.
        #
        # Basic: increment by 1.
        # Premium / Annual / Trial:
        # unlimited, no increment.
        #
        # This raises 429 if the daily
        # limit has been reached.

        consume_daily_action(
            db=db,
            user_id=user_id,
        )

        # Commit the daily usage count
        # only after AI processing succeeds.

        db.commit()

    except Exception:

        db.rollback()
        raise


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

                chunk = file.file.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_AUDIO_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            "Audio file exceeds 20 MB"
                        ),
                    )

                temp.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=422,
                detail="Empty audio file",
            )

        # ==================================
        # RUN WHISPER
        # ==================================

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
                detail=(
                    "Transcript exceeds "
                    "20,000 characters"
                ),
            )

        return transcript

    except HTTPException:
        raise

    except Exception as error:

        logger.exception(
            "Voice transcription failed"
        )

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
            temp_path.unlink(
                missing_ok=True
            )


# =====================================
# QWEN AI SERVICE
# =====================================

def analyze_text_service(
    transcript: str,
    language: Literal[
        "auto",
        "ta",
        "en",
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
            detail=(
                "Transcript exceeds "
                "20,000 characters"
            ),
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

        logger.exception(
            "AI text analysis failed"
        )

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
        "auto",
        "ta",
        "en",
    ] = "auto"


# =====================================
# API 1 - VOICE TO TEXT
# =====================================
# Successful transcription = 1 action.
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
        "ta",
        "en",
    ] = Form("ta"),
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):

    # ==================================
    # CHECK BEFORE WHISPER PROCESSING
    # ==================================

    check_ai_action_available(
        user_id=user.id,
    )

    # ==================================
    # TRANSCRIBE AUDIO
    # ==================================

    transcript = convert_uploaded_audio(
        file,
        language=language,
    )

    # ==================================
    # COUNT SUCCESSFUL ACTION
    # ==================================

    record_successful_ai_action(
        db=db,
        user_id=user.id,
    )

    return {
        "transcript": transcript,
    }


# =====================================
# API 2 - TEXT TO AI NOTES
# =====================================
# Successful AI analysis = 1 action.
# =====================================

@router.post(
    "/analyze-text",
    dependencies=[
        Depends(require_feature("diary"))
    ],
)
def analyze_text(
    payload: TextAnalysisRequest,
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):

    # ==================================
    # CHECK BEFORE QWEN PROCESSING
    # ==================================

    check_ai_action_available(
        user_id=user.id,
    )

    # ==================================
    # RUN AI ANALYSIS
    # ==================================

    result = analyze_text_service(
        payload.text.strip(),
        language=payload.language,
    )

    # ==================================
    # COUNT SUCCESSFUL ACTION
    # ==================================

    record_successful_ai_action(
        db=db,
        user_id=user.id,
    )

    return result


# =====================================
# OLD API - KEEP COMPATIBILITY
# =====================================
# Combined Whisper + Qwen = 1 action.
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
        "ta",
        "en",
    ] = Form("ta"),
    db: Session = Depends(get_db),
    user: User = Depends(lawyer_only),
):

    # ==================================
    # CHECK DAILY LIMIT FIRST
    # ==================================

    check_ai_action_available(
        user_id=user.id,
    )

    # ==================================
    # STEP 1 - WHISPER TRANSCRIPTION
    # ==================================

    transcript = convert_uploaded_audio(
        file,
        language=language,
    )

    # ==================================
    # STEP 2 - QWEN AI ANALYSIS
    # ==================================

    result = analyze_text_service(
        transcript,
        language="auto",
    )

    # ==================================
    # COUNT ONE COMBINED ACTION
    # ==================================

    record_successful_ai_action(
        db=db,
        user_id=user.id,
    )

    return {
        "message": "Voice analysis completed",
        "transcript": transcript,
        **result,
    }
