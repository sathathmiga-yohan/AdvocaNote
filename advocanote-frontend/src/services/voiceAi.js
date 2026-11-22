
const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

export async function analyzeVoiceFile(file) {
  if (!file) {
    throw new Error("Please select a voice recording.");
  }

  const token = localStorage.getItem(
    "advocanote_access_token"
  );

  if (!token) {
    throw new Error("Please log in again.");
  }

  const formData = new FormData();
  formData.append("file", file);

  let response;

  try {
    response = await fetch(
      `${API_URL}/voice-ai/analyze`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );
  } catch {
    throw new Error(
      "Cannot connect to the Voice AI server."
    );
  }

  const data = await response.json().catch(
    () => ({})
  );

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Voice analysis failed."
    );
  }

  return {
    transcript: data.transcript || "",
    notes: data.notes || [],
    criticalHighlights:
      data.critical_highlights || [],
    suggestedTasks:
      data.suggested_tasks || [],
    requiresApproval:
      data.requires_approval === true,
  };
}
