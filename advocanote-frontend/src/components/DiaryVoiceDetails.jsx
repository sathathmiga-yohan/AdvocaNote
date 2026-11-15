
import { useEffect, useState } from "react";

import {
  Headphones,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import StructuredLegalNotes from "./StructuredLegalNotes";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const panel = {
  border: "1px solid #e6dfce",
  borderRadius: 12,
  background: "#fffdf8",
  padding: "15px 18px",
  marginBottom: 16,
};

function NoteList({ items }) {
  return (
    <StructuredLegalNotes
      notes={items}
    />
  );
}

export default function DiaryVoiceDetails({
  entryId,
}) {
  const [voice, setVoice] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioLoading, setAudioLoading] =
    useState(false);
  const [error, setError] = useState("");

  // ====================================
  // LOAD SAVED VOICE + TRANSCRIPT
  // ====================================

  useEffect(() => {
    if (!entryId) return;

    const controller = new AbortController();
    let temporaryUrl = null;

    setVoice(null);
    setAudioUrl("");
    setError("");
    setAudioLoading(true);

    async function load() {
      try {
        const token = sessionStorage.getItem(
          "advocanote_access_token"
        );

        if (!token) {
          throw new Error(
            "Login session expired."
          );
        }

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const endpoint =
          `${API_URL}/voice-ai/recordings/` +
          encodeURIComponent(entryId);

        // First load recording information.
        const detailsResponse = await fetch(
          endpoint,
          {
            headers,
            cache: "no-store",
            signal: controller.signal,
          }
        );

        // 404 is normal for manual diary entries.
        if (detailsResponse.status === 404) {
          return;
        }

        if (!detailsResponse.ok) {
          throw new Error(
            detailsResponse.status === 401 ||
              detailsResponse.status === 403
              ? "Voice recording access denied. Check your login or subscription."
              : `Couldn't load recording details (HTTP ${detailsResponse.status}).`
          );
        }

        const data =
          await detailsResponse.json();

        if (controller.signal.aborted) {
          return;
        }

        setVoice(data);

        // Protected audio requires Bearer token.
        // Fetch Blob before using <audio>.
        const audioResponse = await fetch(
          `${endpoint}/audio`,
          {
            headers,
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!audioResponse.ok) {
          throw new Error(
            audioResponse.status === 404
              ? "The saved original audio file is missing."
              : `Couldn't load audio (HTTP ${audioResponse.status}).`
          );
        }

        const audioBlob =
          await audioResponse.blob();

        if (controller.signal.aborted) {
          return;
        }

        if (!audioBlob.size) {
          throw new Error(
            "Saved audio is empty."
          );
        }

        temporaryUrl =
          URL.createObjectURL(audioBlob);

        setAudioUrl(temporaryUrl);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(
            reason.message ||
              "Failed to load saved recording."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setAudioLoading(false);
        }
      }
    }

    load();

    return () => {
      controller.abort();

      if (temporaryUrl) {
        URL.revokeObjectURL(temporaryUrl);
      }
    };
  }, [entryId]);

  // Don't show voice UI for manual diaries.
  if (!voice && !error) {
    return null;
  }

  const notes = Array.isArray(
    voice?.notes
  )
    ? voice.notes
    : [];

  const highlights = Array.isArray(
    voice?.highlights
  )
    ? voice.highlights
    : [];

  const approvedNotes = Array.isArray(
    voice?.approved_notes
  )
    ? voice.approved_notes
    : [];

  return (
    <section
      className="ded-card"
      aria-label="Saved voice recording"
    >
      <h2 className="ded-card-title">
        <Headphones size={22} />
        Original Voice Recording
      </h2>

      {voice && (
        <>
          <p
            style={{
              fontSize: 12,
              color: "#64746b",
              margin: "0 0 12px",
            }}
          >
            <ShieldCheck
              size={15}
              style={{
                verticalAlign: "middle",
                marginRight: 5,
              }}
            />
            Private recording — authentication
            required for playback.
          </p>

          {/* ORIGINAL AUDIO PLAYER */}

          {audioUrl ? (
            <audio
              controls
              preload="metadata"
              src={audioUrl}
              aria-label="Play original voice recording"
              style={{
                width: "100%",
                marginBottom: 15,
              }}
            />
          ) : audioLoading ? (
            <p>Loading saved audio...</p>
          ) : null}

          {/* REVIEWED TRANSCRIPT */}

          {!!voice.reviewed_transcript && (
            <div style={panel}>
              <h3
                style={{
                  fontSize: 14,
                  color: "#164c39",
                  margin: "0 0 8px",
                }}
              >
                Reviewed Voice Transcript
              </h3>

              <p
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {voice.reviewed_transcript}
              </p>
            </div>
          )}

          {/* ORIGINAL WHISPER TRANSCRIPT */}

          {!!voice.source_transcript && (
            <details
              style={{
                marginBottom: 18,
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                View original Whisper transcript
                (unedited)
              </summary>

              <p
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.7,
                }}
              >
                {voice.source_transcript}
              </p>
            </details>
          )}

          {/* LAWYER APPROVED NOTES */}

          {approvedNotes.length > 0 && (
            <div style={panel}>
              <h3
                style={{
                  fontSize: 14,
                  color: "#164c39",
                  margin: "0 0 10px",
                }}
              >
                Lawyer-Approved Legal Notes
              </h3>

              <NoteList items={approvedNotes} />
            </div>
          )}

          {/* AI SUGGESTED LEGAL NOTES */}

          {notes.length > 0 && (
            <div style={panel}>
              <h3
                style={{
                  fontSize: 14,
                  color: "#164c39",
                  margin: "0 0 10px",
                }}
              >
                <Sparkles
                  size={16}
                  style={{
                    verticalAlign: "middle",
                    marginRight: 6,
                  }}
                />
                AI Suggested Legal Notes —
                Review Required
              </h3>

              <NoteList items={notes} />
            </div>
          )}

          {/* CRITICAL HIGHLIGHTS */}

          {highlights.length > 0 && (
            <div
              style={{
                borderLeft:
                  "3px solid #ba9e5e",
                paddingLeft: 13,
              }}
            >
              <h3
                style={{
                  fontSize: 14,
                  color: "#164c39",
                  margin: "0 0 9px",
                }}
              >
                AI-Flagged Critical Highlights
              </h3>

              {highlights.map(
                (text, index) => (
                  <p
                    key={index}
                    style={{
                      lineHeight: 1.6,
                      margin: "6px 0",
                    }}
                  >
                    • {text}
                  </p>
                )
              )}
            </div>
          )}
        </>
      )}

      {error && (
        <p
          className="ded-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  );
}
