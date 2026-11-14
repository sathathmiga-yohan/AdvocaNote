
const API_URL = "http://127.0.0.1:8000";

async function diaryRequest(path, options = {}) {
  const token = sessionStorage.getItem(
    "advocanote_access_token"
  );

  if (!token) {
    throw new Error("Please log in again.");
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Cannot connect to FastAPI server.");
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof result.detail === "string"
        ? result.detail
        : "Unable to process the request.";

    throw new Error(message);
  }

  return result;
}

export function getLawyerCases() {
  return diaryRequest("/cases");
}

export function getDiaryOverview(date) {
  return diaryRequest(
    `/diary/overview?entry_date=${encodeURIComponent(date)}`
  );
}

export function createDiaryEntry(payload) {
  return diaryRequest("/diary/entries", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getHearings() {
  return diaryRequest("/hearings");
}

export function updateDiaryEntry(entryId, payload) {
  return diaryRequest(
    `/diary/entries/${encodeURIComponent(entryId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export function deleteDiaryEntry(entryId) {
  return diaryRequest(
    `/diary/entries/${encodeURIComponent(entryId)}`,
    {
      method: "DELETE",
    }
  );
}

// NEW: Get selected Diary Entry full details
export function getDiaryEntryDetails(entryId) {
  return diaryRequest(
    `/diary/entries/${encodeURIComponent(entryId)}`
  );
}

// NEW: Get all Diary Entries for one Case
export function getCaseDiaryHistory(caseId) {
  return diaryRequest(
    `/diary/case/${encodeURIComponent(caseId)}/history`
  );
}
