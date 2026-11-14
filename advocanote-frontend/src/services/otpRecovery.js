
const API_URL = "http://127.0.0.1:8000";

async function postRecovery(path, payload) {
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
      "Cannot connect to FastAPI backend."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 404) {
    throw new Error(
      "OTP recovery API is not connected in the backend yet."
    );
  }

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Password recovery request failed. Please try again."
    );
  }

  return data;
}

// STEP 1 - REQUEST OTP
export function requestPasswordOtp(email) {
  return postRecovery(
    "/auth/forgot-password/request-otp",
    {
      email: email.trim().toLowerCase(),
    }
  );
}

// STEP 2 - VERIFY OTP
export function verifyPasswordOtp(email, otp) {
  return postRecovery(
    "/auth/forgot-password/verify-otp",
    {
      email: email.trim().toLowerCase(),
      otp,
    }
  );
}

// STEP 3 - RESET PASSWORD
export function resetPasswordWithOtp(
  resetToken,
  newPassword
) {
  return postRecovery(
    "/auth/forgot-password/reset-otp",
    {
      reset_token: resetToken,
      new_password: newPassword,
    }
  );
}
