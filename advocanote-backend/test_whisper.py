
import sys
from pathlib import Path
from time import perf_counter
from faster_whisper import WhisperModel

if len(sys.argv) < 2:
    print("Usage: python test_whisper.py tamil_test.m4a")
    sys.exit(1)

audio_path = Path(sys.argv[1])

if not audio_path.is_file():
    print("Audio file not found:", audio_path)
    sys.exit(1)

print("Loading Whisper model...")

model = WhisperModel(
    "mohankumars26/whisper-tamil-medium-ct2",
    device="cpu",
    compute_type="int8"
)

print("Converting voice to text...")

start = perf_counter()

segments, info = model.transcribe(
    str(audio_path),
    language="ta",
    task="transcribe",
    beam_size=1,
    vad_filter=True,
    condition_on_previous_text=False
)

text = " ".join(
    segment.text.strip()
    for segment in segments
).strip()

print("\nDetected Language:", info.language)
print("\nOriginal Transcript:")
print(text if text else "No speech detected.")

print(
    "\nProcessing time:",
    round(perf_counter() - start, 2),
    "seconds"
)
