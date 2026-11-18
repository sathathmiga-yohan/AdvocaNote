
import { useEffect, useRef, useState } from "react";
import StructuredLegalNotes from "./StructuredLegalNotes";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

export default function DiarySavedAIAndVoice({ entry }) {
  const entryId = entry?.id;
  const ai = entry?.aiAnalysis || null;

  const [recording, setRecording] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [error, setError] = useState("");

  const audioUrlRef = useRef("");
  const audioRequestRef = useRef(null);

  // =====================================
  // LOAD SAVED RECORDING INFORMATION
  // =====================================

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    audioRequestRef.current?.abort();

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }

    audioUrlRef.current = "";

    setAudioUrl("");
    setRecording(null);
    setLoadingAudio(false);
    setError("");

    if (!entryId) {
      return () => controller.abort();
    }

    const token = sessionStorage.getItem(
      "advocanote_access_token"
    );

    if (!token) {
      setError("Please log in again.");
      return () => controller.abort();
    }

    const loadRecording = async () => {
      try {
        const response = await fetch(
          `${API_URL}/voice-ai/recordings/${entryId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );

        // Normal text diary has no recording.
        if (response.status === 404) {
          return;
        }

        if (!response.ok) {
          throw new Error(
            "Could not load the saved recording."
          );
        }

        const data = await response.json();

        if (active && data.audio_saved) {
          setRecording(data);
        }
      } catch (err) {
        if (active && err.name !== "AbortError") {
          setError(
            err.message ||
            "Could not load recording details."
          );
        }
      }
    };

    loadRecording();

    return () => {
      active = false;

      controller.abort();
      audioRequestRef.current?.abort();

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = "";
      }
    };
  }, [entryId]);

  // =====================================
  // LOAD ORIGINAL AUDIO SECURELY
  // =====================================

  const loadAudio = async () => {
    if (!entryId || loadingAudio || audioUrl) {
      return;
    }

    const token = sessionStorage.getItem(
      "advocanote_access_token"
    );

    if (!token) {
      setError("Please log in again.");
      return;
    }

    const controller = new AbortController();
    audioRequestRef.current = controller;

    setLoadingAudio(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/voice-ai/recordings/${entryId}/audio`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error(
          "The original audio could not be loaded."
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }

      audioUrlRef.current = url;
      setAudioUrl(url);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(
          err.message || "Audio playback failed."
        );
      }
    } finally {
      if (audioRequestRef.current === controller) {
        audioRequestRef.current = null;
        setLoadingAudio(false);
      }
    }
  };

  // =====================================
  // SAVED AI NOTES
  // =====================================

  const notes = Array.isArray(ai?.notes)
    ? ai.notes
    : [];

  const highlights = Array.isArray(
    ai?.criticalHighlights
  )
    ? ai.criticalHighlights
    : [];

  // No recording and no AI analysis:
  // display nothing extra.

  if (!entryId || (!ai && !recording && !error)) {
    return null;
  }

  return (
    <section
      style={{
        border: "1px solid #e6e1d7",
        borderRadius: 12,
        padding: 16,
        background: "#fffdf9",
        marginTop: 16,
        color: "#004535",
      }}
    >
      {/* ORIGINAL VOICE RECORDING */}

      {recording && (
        <div>
          <strong>Original Voice Recording</strong>

          <p
            style={{
              fontSize: 13,
              margin: "8px 0",
            }}
          >
            Saved original voice recording.
          </p>

          {!audioUrl ? (
            <button
              type="button"
              onClick={loadAudio}
              disabled={loadingAudio}
            >
              {loadingAudio
                ? "Loading audio..."
                : "Play Original Recording"}
            </button>
          ) : (
            <audio
              src={audioUrl}
              controls
              preload="metadata"
              style={{
                width: "100%",
                maxWidth: 480,
              }}
            />
          )}

          {recording.source_transcript && (
            <details style={{ marginTop: 12 }}>
              <summary>Original Voice Transcript</summary>

              <p
                style={{
                  whiteSpace: "pre-wrap",
                  color: "#243b35",
                }}
              >
                {recording.source_transcript}
              </p>
            </details>
          )}
        </div>
      )}

      {/* OPTIONAL SAVED AI ANALYSIS */}

      {ai && (
        <div
          style={{
            marginTop: recording ? 20 : 0,
          }}
        >
          <strong>AI Analysed Legal Notes</strong>

          {notes.length > 0 ? (
            <StructuredLegalNotes notes={notes} />
          ) : (
            <p>No AI notes were extracted.</p>
          )}

          {highlights.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong>Critical Highlights</strong>

              {highlights.map((item, index) => (
                <p
                  key={index}
                  style={{
                    margin: "6px 0",
                    color: "#243b35",
                  }}
                >
                  • {item}
                </p>
              ))}
            </div>
          )}

          {ai.analysisIncomplete && (
            <small>
              Some details need verification against
              the original proceedings text.
            </small>
          )}
        </div>
      )}

      {error && (
        <p role="alert" style={{ color: "#a12b26" }}>
          {error}
        </p>
      )}
    </section>
  );
}
