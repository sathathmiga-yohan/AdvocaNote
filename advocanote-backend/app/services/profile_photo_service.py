
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError


PHOTO_DIR = (
    Path(__file__).resolve().parents[2]
    / "private_uploads"
    / "profile_photos"
)

MAX_FILE_BYTES = 3 * 1024 * 1024


def get_photo_path(user_id: int) -> Path:
    return PHOTO_DIR / f"user_{user_id}.jpg"


def save_profile_photo(user_id: int, content: bytes):
    if not content or len(content) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Photo must be smaller than 3 MB.",
        )

    try:
        with Image.open(BytesIO(content)) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"}:
                raise HTTPException(
                    status_code=415,
                    detail="Only JPG, PNG and WEBP are supported.",
                )

            if source.width * source.height > 16000000:
                raise HTTPException(
                    status_code=413,
                    detail="Image dimensions are too large.",
                )

            image = ImageOps.exif_transpose(source)
            image.thumbnail((600, 600))

            image = image.convert("RGBA")

            background = Image.new(
                "RGB",
                image.size,
                (255, 255, 255),
            )

            background.paste(
                image,
                mask=image.getchannel("A"),
            )

            output = BytesIO()
            background.save(
                output,
                format="JPEG",
                quality=85,
            )

    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Invalid image file.",
        )

    PHOTO_DIR.mkdir(parents=True, exist_ok=True)

    destination = get_photo_path(user_id)
    temporary = destination.with_suffix(".tmp")

    temporary.write_bytes(output.getvalue())
    temporary.replace(destination)


def remove_profile_photo(user_id: int):
    get_photo_path(user_id).unlink(missing_ok=True)
