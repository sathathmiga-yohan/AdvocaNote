
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

async function profileRequest(path, options = {}) {
  const token = sessionStorage.getItem(
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
    const detail = data?.detail;

    throw new Error(
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((item) => item.msg).join(", ")
          : `Profile request failed (${response.status})`
    );
  }

  return data;
}

// GET LOGGED-IN LAWYER PROFILE
export function getMyProfile() {
  return profileRequest("/profile/me");
}

// UPDATE LOGGED-IN LAWYER PROFILE
export function updateMyProfile(details) {
  return profileRequest("/profile/me", {
    method: "PUT",
    body: JSON.stringify(details),
  });
}


// GET AUTHENTICATED USER PHOTO
export async function getMyProfilePhoto() {
  const token = sessionStorage.getItem(
    "advocanote_access_token"
  );

  if (!token) {
    throw new Error("Please log in again.");
  }

  const response = await fetch(
    `${API_BASE}/profile/photo`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Unable to load photo (${response.status})`
    );
  }

  return response.blob();
}


// UPLOAD PHOTO
export async function uploadMyProfilePhoto(file) {
  const token = sessionStorage.getItem(
    "advocanote_access_token"
  );

  if (!token) {
    throw new Error("Please log in again.");
  }

  const formData = new FormData();
  formData.append("photo", file);

  const response = await fetch(
    `${API_BASE}/profile/photo`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Photo upload failed."
    );
  }

  return data;
}


// REMOVE PHOTO
export function removeMyProfilePhoto() {
  return profileRequest("/profile/photo", {
    method: "DELETE",
  });
}
