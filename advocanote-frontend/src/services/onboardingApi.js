
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

async function onboardingRequest(path, options = {}) {
  const token = localStorage.getItem(
    "advocanote_access_token"
  );

  if (!token) {
    throw new Error("Please log in again.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Onboarding request failed (${response.status})`
    );
  }

  return data;
}

// GET CURRENT LAWYER ONBOARDING STATUS
export function getMyOnboarding() {
  return onboardingRequest("/onboarding/me");
}

// SAVE PROFESSIONAL DETAILS
export function completeMyOnboarding(details) {
  return onboardingRequest("/onboarding/complete", {
    method: "PUT",
    body: JSON.stringify(details),
  });
}

// SKIP FIRST-TIME SETUP
export function skipMyOnboarding() {
  return onboardingRequest("/onboarding/skip", {
    method: "POST",
  });
}
