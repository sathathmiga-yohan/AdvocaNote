
import { useState } from "react";

import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { GoogleLogin } from "@react-oauth/google";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Mail,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  LockKeyhole,
} from "lucide-react";


// =====================================
// API CONFIGURATION
// =====================================

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");


// =====================================
// API REQUEST HELPER
// =====================================

async function postAccountRequest(path, payload) {
  const response = await fetch(
    `${API_URL}${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
      credentials: "omit",
      body: JSON.stringify(payload),
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Unable to complete the request."
    );
  }

  return data;
}


// =====================================
// PASSWORD VALIDATION
// =====================================

function isValidPassword(password) {
  return (
    password.length >= 12 &&
    /[a-zA-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^a-zA-Z0-9]/.test(password)
  );
}


// =====================================
// UI STYLES
// =====================================

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(145deg, #f8f5ed 0%, #f1eee4 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "30px 18px",
    fontFamily: "Inter, Poppins, sans-serif",
    boxSizing: "border-box",
  },

  card: {
    width: "100%",
    maxWidth: 480,
    background: "#fff",
    border: "1px solid #e7e3d8",
    borderRadius: 18,
    padding: "28px",
    boxShadow: "0 10px 35px rgba(0, 45, 32, 0.05)",
    boxSizing: "border-box",
  },

  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#f0f5ef",
    border: "1px solid #dce9dd",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#004535",
    marginBottom: 16,
  },

  title: {
    fontSize: 24,
    fontWeight: 650,
    color: "#003e30",
    margin: "0 0 9px",
    lineHeight: 1.3,
  },

  description: {
    fontSize: 13,
    color: "#65716c",
    lineHeight: 1.75,
    margin: "0 0 22px",
  },

  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#344b42",
    marginBottom: 7,
  },

  input: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 13px",
    border: "1px solid #dce3dc",
    borderRadius: 9,
    background: "#fff",
    color: "#1d342b",
    fontSize: 13,
    outlineColor: "#004535",
    marginBottom: 17,
    fontFamily: "inherit",
  },

  primaryButton: {
    width: "100%",
    minHeight: 43,
    padding: "11px 15px",
    background: "#004535",
    color: "#fff",
    border: "1px solid #004535",
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  notice: {
    padding: "12px 13px",
    borderRadius: 9,
    fontSize: 12,
    lineHeight: 1.7,
    marginBottom: 17,
  },

  infoBox: {
    background: "#faf8f1",
    border: "1px solid #ece3cb",
    borderRadius: 10,
    padding: "12px 14px",
    color: "#706143",
    fontSize: 12,
    lineHeight: 1.75,
    marginBottom: 19,
  },

  divider: {
    height: 1,
    background: "#eceee8",
    margin: "23px 0 17px",
  },
};


// =====================================
// MAIN COMPONENT
// =====================================

export default function RejoinAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Recovery token received through email link.
  const token = (
    searchParams.get("token") || ""
  ).trim();

  // -------------------------------------
  // REQUEST RECOVERY STATE
  // -------------------------------------

  const [email, setEmail] = useState("");

  const [requestLoading, setRequestLoading] =
    useState(false);

  const [emailRequested, setEmailRequested] =
    useState(false);

  const [requestNewLink, setRequestNewLink] =
    useState(false);

  // -------------------------------------
  // COMPLETE RECOVERY STATE
  // -------------------------------------

  const [choice, setChoice] = useState("restore");

  const [verificationMethod, setVerificationMethod] =
    useState("password");

  const [oldPassword, setOldPassword] = useState("");

  const [googleCredential, setGoogleCredential] =
    useState("");

  const [fullName, setFullName] = useState("");

  const [newPassword, setNewPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // -------------------------------------
  // FEEDBACK STATE
  // -------------------------------------

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const [completedStatus, setCompletedStatus] =
    useState("");

  // -------------------------------------
  // WHICH SCREEN SHOULD APPEAR?
  // -------------------------------------

  const hasRecoveryToken = Boolean(token);

  const showRecoveryForm =
    hasRecoveryToken &&
    !requestNewLink &&
    !completedStatus;


  // =====================================
  // STEP 1 - SEND RECOVERY EMAIL
  // =====================================

  async function handleRequestRecovery(event) {
    event.preventDefault();

    if (requestLoading) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Enter your previous email address.");
      return;
    }

    setRequestLoading(true);
    setError("");
    setMessage("");
    setEmailRequested(false);

    try {
      const data = await postAccountRequest(
        "/account/recovery/request",
        {
          email: cleanEmail,
        }
      );

      setEmailRequested(true);

      setMessage(
        data.message ||
          "If this email belongs to a closed account, a recovery link will be sent."
      );
    } catch (err) {
      setError(
        err.message ||
          "Could not request recovery email."
      );
    } finally {
      setRequestLoading(false);
    }
  }


  // =====================================
  // STEP 2 - RESTORE / START FRESH
  // =====================================

  async function handleCompleteRecovery(event) {
    event.preventDefault();

    if (loading) return;

    if (!token) {
      setError(
        "Recovery link is missing. Request a new link."
      );
      return;
    }

    // ----------------------------------
    // VERIFY SELECTED IDENTITY METHOD
    // ----------------------------------

    if (
      verificationMethod === "password" &&
      !oldPassword
    ) {
      setError(
        "Enter your previous account password."
      );
      return;
    }

    if (
      verificationMethod === "google" &&
      !googleCredential
    ) {
      setError(
        "Please verify your previous Google account."
      );
      return;
    }

    // ----------------------------------
    // VALIDATE START FRESH FIELDS
    // ----------------------------------

    if (choice === "fresh") {
      const cleanName = fullName.trim();

      if (
        cleanName.length < 2 ||
        cleanName.length > 150
      ) {
        setError(
          "Enter your full name (2 to 150 characters)."
        );
        return;
      }

      if (
        verificationMethod === "password" &&
        !newPassword
      ) {
        setError(
          "Create a password for your new account."
        );
        return;
      }

      if (
        newPassword &&
        !isValidPassword(newPassword)
      ) {
        setError(
          "New password must contain at least 12 characters, letters, numbers and symbols."
        );
        return;
      }
    }

    // ----------------------------------
    // CONFIRM ACTION
    // ----------------------------------

    const confirmed = window.confirm(
      choice === "restore"
        ? "Restore your previous AdvocaNote account and its existing records?"
        : "Create a new AdvocaNote account? Your previous legal records will remain separately retained under the closed account."
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      // ----------------------------------
      // SEND TO REAL BACKEND
      // ----------------------------------

      const data = await postAccountRequest(
        "/account/recovery/complete",
        {
          token,

          choice,

          old_password:
            verificationMethod === "password"
              ? oldPassword
              : "",

          google_credential:
            verificationMethod === "google"
              ? googleCredential
              : "",

          full_name:
            choice === "fresh"
              ? fullName.trim()
              : "",

          new_password:
            choice === "fresh"
              ? newPassword
              : "",
        }
      );

      // Do not show success unless the backend
      // confirms the requested operation.

      const expectedStatus =
        choice === "restore"
          ? "restored"
          : "fresh";

      if (data.status !== expectedStatus) {
        throw new Error(
          "The server did not confirm account recovery."
        );
      }

      // ----------------------------------
      // RECOVERY SUCCESS
      // ----------------------------------

      setCompletedStatus(data.status);

      setMessage(
        data.message ||
          "Account recovery completed successfully."
      );

      setOldPassword("");
      setNewPassword("");
      setGoogleCredential("");

      // Remove the used recovery token from URL.
      navigate("/rejoin-account", {
        replace: true,
      });

    } catch (err) {
      setError(
        err.message ||
          "Could not complete account recovery."
      );
    } finally {
      setLoading(false);
    }
  }


  // =====================================
  // FEEDBACK COMPONENTS
  // =====================================

  function ErrorMessage() {
    if (!error) return null;

    return (
      <div
        role="alert"
        style={{
          ...styles.notice,
          background: "#fff1ef",
          border: "1px solid #f3d5cf",
          color: "#b42318",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <AlertCircle
          size={16}
          style={{ flexShrink: 0, marginTop: 2 }}
        />
        <span>{error}</span>
      </div>
    );
  }


  function SuccessMessage() {
    if (!message) return null;

    return (
      <div
        role="status"
        style={{
          ...styles.notice,
          background: "#edf7f0",
          border: "1px solid #d1e9d7",
          color: "#176c46",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <CheckCircle2
          size={16}
          style={{ flexShrink: 0, marginTop: 2 }}
        />
        <span>{message}</span>
      </div>
    );
  }


  // =====================================
  // PAGE UI
  // =====================================

  return (
    <main style={styles.page}>
      <section style={styles.card}>

        {/* =================================
            BRAND HEADER
        ================================= */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 25,
          }}
        >
          <div>
            <div
              style={{
                color: "#004535",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "-0.5px",
              }}
            >
              Advoca
              <span style={{ color: "#bd9449" }}>
                Note
              </span>
            </div>

            <div
              style={{
                fontSize: 10,
                color: "#79867d",
                marginTop: 3,
              }}
            >
              AI SMART LEGAL DIARY
            </div>
          </div>

          <ShieldCheck
            size={21}
            color="#b58c43"
          />
        </div>


        {/* =================================
            SUCCESS SCREEN
        ================================= */}

        {completedStatus ? (
          <>
            <div style={styles.iconBox}>
              <CheckCircle2 size={22} />
            </div>

            <h1 style={styles.title}>
              {completedStatus === "restored"
                ? "Account Restored"
                : "Welcome to AdvocaNote"}
            </h1>

            <p style={styles.description}>
              {completedStatus === "restored"
                ? "Your previous account has been reactivated. Your existing legal records remain linked to your original account."
                : "Your fresh account has been created. Your previous legal records remain separate."}
            </p>

            <SuccessMessage />

            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => navigate("/login")}
            >
              Continue to Login
              <ArrowRight size={16} />
            </button>
          </>
        ) : showRecoveryForm ? (

          // =================================
          // RECOVERY LINK SCREEN
          // =================================

          <>
            <div style={styles.iconBox}>
              <Sparkles size={22} />
            </div>

            <h1 style={styles.title}>
              Welcome Back
            </h1>

            <p style={styles.description}>
              Your recovery link has been received.
              Choose whether to restore your previous
              records or start with a new account.
            </p>


            {/* RECOVERY CHOICE */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 22,
              }}
            >
              {[
                ["restore", "Restore My Data"],
                ["fresh", "Start Fresh"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setChoice(value);
                    setError("");
                  }}
                  style={{
                    padding: "13px 8px",
                    borderRadius: 9,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border:
                      choice === value
                        ? "1px solid #004535"
                        : "1px solid #dce3dc",
                    background:
                      choice === value
                        ? "#004535"
                        : "#fff",
                    color:
                      choice === value
                        ? "#fff"
                        : "#004535",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>


            {/* RECOVERY FORM */}

            <form onSubmit={handleCompleteRecovery}>

              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#294739",
                  marginBottom: 11,
                }}
              >
                Verify Previous Account
              </p>

              {/* VERIFICATION METHOD */}

              <div
                style={{
                  display: "flex",
                  gap: 15,
                  marginBottom: 18,
                  flexWrap: "wrap",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    cursor: "pointer",
                    color: "#42584c",
                  }}
                >
                  <input
                    type="radio"
                    name="verificationMethod"
                    checked={
                      verificationMethod === "password"
                    }
                    onChange={() => {
                      setVerificationMethod("password");
                      setGoogleCredential("");
                      setError("");
                    }}
                  />
                  Old Password
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    cursor: "pointer",
                    color: "#42584c",
                  }}
                >
                  <input
                    type="radio"
                    name="verificationMethod"
                    checked={
                      verificationMethod === "google"
                    }
                    onChange={() => {
                      setVerificationMethod("google");
                      setOldPassword("");
                      setError("");
                    }}
                  />
                  Google Account
                </label>
              </div>


              {/* PASSWORD VERIFICATION */}

              {verificationMethod === "password" && (
                <div>
                  <label
                    htmlFor="rejoin-old-password"
                    style={styles.label}
                  >
                    Previous Account Password
                  </label>

                  <input
                    id="rejoin-old-password"
                    type="password"
                    style={styles.input}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your old password"
                    value={oldPassword}
                    onChange={(event) => {
                      setOldPassword(event.target.value);
                      setError("");
                    }}
                  />
                </div>
              )}


              {/* GOOGLE VERIFICATION */}

              {verificationMethod === "google" && (
                <div
                  style={{
                    padding: 15,
                    border: "1px solid #e2e9df",
                    borderRadius: 11,
                    marginBottom: 19,
                    background: "#fbfdfb",
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      color: "#66756c",
                      lineHeight: 1.7,
                      margin: "0 0 13px",
                    }}
                  >
                    Sign in using the Google account
                    previously linked to your
                    AdvocaNote account.
                  </p>

                  <GoogleLogin
                    onSuccess={(credentialResponse) => {
                      if (!credentialResponse.credential) {
                        setGoogleCredential("");

                        setError(
                          "Google did not return a valid credential."
                        );

                        return;
                      }

                      setGoogleCredential(
                        credentialResponse.credential
                      );

                      setError("");
                    }}
                    onError={() => {
                      setGoogleCredential("");

                      setError(
                        "Google verification failed. Please try again."
                      );
                    }}
                    theme="outline"
                    size="large"
                    text="signin_with"
                  />

                  {googleCredential && (
                    <p
                      style={{
                        color: "#176c46",
                        fontSize: 12,
                        margin: "12px 0 0",
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                      }}
                    >
                      <CheckCircle2 size={15} />
                      Google credential received.
                      Server verification is required.
                    </p>
                  )}
                </div>
              )}


              {/* START FRESH FIELDS */}

              {choice === "fresh" && (
                <>
                  <div style={styles.divider} />

                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#294739",
                      marginBottom: 15,
                    }}
                  >
                    New Account Details
                  </p>

                  <label
                    htmlFor="rejoin-full-name"
                    style={styles.label}
                  >
                    Full Name
                  </label>

                  <input
                    id="rejoin-full-name"
                    type="text"
                    style={styles.input}
                    required
                    maxLength={150}
                    autoComplete="name"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(event) => {
                      setFullName(event.target.value);
                      setError("");
                    }}
                  />

                  <label
                    htmlFor="rejoin-new-password"
                    style={styles.label}
                  >
                    New Password
                    {verificationMethod === "google"
                      ? " (Optional)"
                      : ""}
                  </label>

                  <input
                    id="rejoin-new-password"
                    type="password"
                    style={styles.input}
                    required={
                      verificationMethod === "password"
                    }
                    minLength={12}
                    autoComplete="new-password"
                    placeholder="At least 12 characters"
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setError("");
                    }}
                  />

                  <p
                    style={{
                      fontSize: 11,
                      lineHeight: 1.6,
                      color: "#7a857c",
                      margin: "-8px 0 17px",
                    }}
                  >
                    Use letters, numbers and symbols.
                    Google-verified users may leave
                    the password empty.
                  </p>
                </>
              )}


              {/* INFORMATION */}

              <div style={styles.infoBox}>
                {choice === "restore" ? (
                  <>
                    <strong>Restore My Data</strong>
                    <p style={{ margin: "5px 0 0" }}>
                      Your previous profile, cases,
                      diary entries, voice records,
                      hearings and tasks will become
                      accessible again. Subscription
                      billing will not restart
                      automatically.
                    </p>
                  </>
                ) : (
                  <>
                    <strong>Start Fresh</strong>
                    <p style={{ margin: "5px 0 0" }}>
                      A new account with a new User ID
                      will be created. Previous legal
                      records will remain retained
                      under your old closed account.
                      They will not appear in the
                      new account.
                    </p>
                  </>
                )}
              </div>


              <ErrorMessage />

              <SuccessMessage />


              {/* SUBMIT */}

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.primaryButton,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading
                    ? "wait"
                    : "pointer",
                }}
              >
                <LockKeyhole size={16} />

                {loading
                  ? "Verifying Account..."
                  : choice === "restore"
                    ? "Restore My Account"
                    : "Create Fresh Account"}
              </button>
            </form>


            {/* REQUEST ANOTHER LINK */}

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setRequestNewLink(true);
                setError("");
                setMessage("");
                setEmailRequested(false);
              }}
              style={{
                border: 0,
                background: "transparent",
                color: "#004535",
                fontSize: 12,
                cursor: "pointer",
                marginTop: 17,
                padding: "5px 0",
              }}
            >
              Recovery link expired?
              Request another link
            </button>
          </>

        ) : (

          // =================================
          // REQUEST RECOVERY EMAIL SCREEN
          // =================================

          <>
            <div style={styles.iconBox}>
              <Mail size={22} />
            </div>

            <h1 style={styles.title}>
              Recover Your Account
            </h1>

            <p style={styles.description}>
              Previously closed your AdvocaNote
              account? Enter your previous email
              address to request a secure
              recovery link.
            </p>


            {/* REQUEST FORM */}

            <form onSubmit={handleRequestRecovery}>
              <label
                htmlFor="rejoin-email"
                style={styles.label}
              >
                Previous Email Address
              </label>

              <input
                id="rejoin-email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder="your@email.com"
                style={styles.input}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
              />

              <ErrorMessage />

              <SuccessMessage />

              {emailRequested && (
                <div style={styles.infoBox}>
                  If your email belongs to a
                  previously closed account, check
                  your inbox and spam folder for
                  the recovery link. The link will
                  expire after 30 minutes.
                </div>
              )}

              <button
                type="submit"
                disabled={requestLoading}
                style={{
                  ...styles.primaryButton,
                  opacity: requestLoading ? 0.7 : 1,
                  cursor: requestLoading
                    ? "wait"
                    : "pointer",
                }}
              >
                <Mail size={16} />

                {requestLoading
                  ? "Sending Request..."
                  : emailRequested
                    ? "Request Recovery Link Again"
                    : "Send Recovery Link"}
              </button>
            </form>

            <p
              style={{
                color: "#8b958d",
                fontSize: 11,
                lineHeight: 1.7,
                marginTop: 18,
              }}
            >
              For your security, we only send
              recovery instructions if an eligible
              closed account exists.
            </p>
          </>
        )}


        {/* =================================
            FOOTER NAVIGATION
        ================================= */}

        <div style={styles.divider} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              textDecoration: "none",
              color: "#004535",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={15} />
            Back to Login
          </Link>

          <Link
            to="/register"
            style={{
              textDecoration: "none",
              color: "#748078",
              fontSize: 12,
            }}
          >
            Create New Account
          </Link>
        </div>
      </section>
    </main>
  );
}
