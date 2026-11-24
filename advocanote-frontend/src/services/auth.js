

const API_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD
    ? "https://advocanote-production.up.railway.app"
    : "http://127.0.0.1:8000")
).replace(/\/$/, "");

// 1. LOGIN API
export async function loginUser(email, password) {
  let response;

  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });
  } catch {
    throw new Error(
      "Cannot connect to backend. Check FastAPI server."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Login failed. Please check your details."
    );
  }

  return data;
}

// 2. CHECK LOGGED-IN USER
export async function getCurrentUser() {
  const token = localStorage.getItem(
    "advocanote_access_token"
  );

  if (!token) {
    throw new Error("Not logged in");
  }

  const response = await fetch(`${API_URL}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = new Error("Session invalid or expired");

    error.status = response.status;
    throw error;
  }

  return await response.json();
}

// 3. REGISTER API
export async function registerUser(fullName, email, password) {
  const url = `${API_URL}/auth/register`;
  let response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: password,
      }),
    });
  } catch (error) {
    console.error("REGISTER NETWORK ERROR:", error);

    throw new Error(
      "Cannot connect to backend. Check FastAPI server or CORS.",
      { cause: error }
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Registration failed. Check your name, email, and password."
    );
  }

  console.log("Registration successful");

  return data;
}

// 4. VERIFY EMAIL
export function verifyEmail(token) {
  return submitEmailVerification("/auth/verify-email", { token });
}

export function verifyRegistrationOtp(email, password, code) {
  return submitEmailVerification("/auth/verify-registration", { email, password, code });
}

async function submitEmailVerification(path, payload) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Cannot connect to backend. Check FastAPI server."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Email verification failed."
    );
  }

  return data;
}

// 5. EXISTING FORGOT PASSWORD API
// Kept for compatibility with your previous reset flow.
export async function forgotPassword(email) {
  let response;

  try {
    response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
      }),
    });
  } catch {
    throw new Error(
      "Cannot connect to backend. Check FastAPI server."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Unable to send password reset link."
    );
  }

  return data;
}

// 6. EXISTING RESET PASSWORD API
// Kept so your old reset route is not broken.
export async function resetPassword(token, newPassword) {
  let response;

  try {
    response = await fetch(
      `${API_URL}/auth/reset-password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          new_password: newPassword,
        }),
      }
    );
  } catch {
    throw new Error("Cannot connect to backend.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Password reset failed."
    );
  }

  return data;
}

// 7. NEW GOOGLE-VERIFIED PASSWORD RESET
// Backend must verify the Google credential before
// allowing the password change.
export async function googleResetPassword(
  email,
  credential,
  newPassword
) {
  let response;

  try {
    response = await fetch(
      `${API_URL}/auth/google-reset-password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          credential: credential,
          new_password: newPassword,
        }),
      }
    );
  } catch {
    throw new Error(
      "Cannot connect to backend. Check FastAPI server."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "Google password recovery API is not connected in FastAPI yet."
      );
    }

    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Unable to reset password with Google."
    );
  }

  return data;
}

// 8. GOOGLE LOGIN
export async function googleLogin(credential) {
  let response;

  try {
    response = await fetch(`${API_URL}/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        credential: credential,
      }),
    });
  } catch {
    throw new Error(
      "Cannot connect to backend. Check FastAPI server."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Google login failed."
    );
  }

  return data;
}

// 9. LOGOUT API
export async function logoutUser() {
  const refreshToken = localStorage.getItem(
    "advocanote_refresh_token"
  );

  if (!refreshToken) {
    return;
  }

  const response = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to log out from the server.");
  }
  return await response.json();
}
