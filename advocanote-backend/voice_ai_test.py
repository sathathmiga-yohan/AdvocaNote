
import gc
import json
import sys

from pathlib import Path
from time import perf_counter

from faster_whisper import WhisperModel

from app.services.legal_ai import (
    analyze_legal_transcript
)


# =====================================
# ADVOCANOTE - VOICE TO AI TEST
# =====================================

WHISPER_MODEL = (
    "mohankumars26/"
    "whisper-tamil-medium-ct2"
)


def transcribe_audio(audio_path):

    print("\nLoading Faster-Whisper...")

    model = WhisperModel(
        WHISPER_MODEL,
        device="cpu",
        compute_type="int8"
    )

    print("Converting voice to text...")

    segments, info = model.transcribe(
        str(audio_path),
        language="ta",
        task="transcribe",
        beam_size=1,
        vad_filter=True,
        condition_on_previous_text=False
    )

    transcript = " ".join(
        segment.text.strip()
        for segment in segments
    ).strip()

    # Release Whisper model before
    # starting Qwen analysis.
    del segments
    del model
    gc.collect()

    return transcript


def main():

    if len(sys.argv) < 2:
        print(
            "Usage: python voice_ai_test.py "
            "tamil_test.wav"
        )
        return

    audio_path = Path(sys.argv[1])

    if not audio_path.is_file():
        print("Audio file not found.")
        return

    start = perf_counter()

    # STEP 1 - SPEECH TO TEXT

    transcript = transcribe_audio(
        audio_path
    )

    if not transcript:
        print("No speech detected.")
        return

    print("\n========== TRANSCRIPT ==========")
    print(transcript)

    # STEP 2 - AI ANALYSIS

    print("\nAnalysing with Qwen AI...")

    result = analyze_legal_transcript(
        transcript
    )

    print("\n========== AI LEGAL NOTES ==========")

    for index, note in enumerate(
        result["notes"],
        start=1
    ):
        print(
            f"{index}. [{note['category']}] "
            f"{note['point']}"
        )

    print("\n========== CRITICAL HIGHLIGHTS ==========")

    for highlight in result[
        "critical_highlights"
    ]:
        print("-", highlight)

    print("\n========== SUGGESTED TASKS ==========")

    for index, task in enumerate(
        result["suggested_tasks"],
        start=1
    ):
        print(f"{index}. {task}")

    print(
        "\nProcessing time:",
        round(perf_counter() - start, 2),
        "seconds"
    )

    print("\nVoice AI test completed.")


if __name__ == "__main__":

    try:
        main()

    except Exception as error:
        print(
            "Voice AI Error:",
            error
        )
