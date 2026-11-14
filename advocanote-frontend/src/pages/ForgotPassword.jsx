
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "./Login.css";
import "./ForgotPassword.css";
import "./AuthLayout.css";

import {
  requestPasswordOtp,
  verifyPasswordOtp,
  resetPasswordWithOtp,
} from "../services/otpRecovery";

// Original Icons
function Icon({ name, size = 24 }) {
  const icons = {
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </>
    ),
    zap: (
      <path d="m13 2-9 12h7l-1 8 10-12h-7V2Z" />
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    back: (
      <>
        <path d="M19 12H5" />
        <path d="m11 18-6-6 6-6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    check: (
      <path d="m5 12 4 4L19 6" />
    ),

    // NEW: PASSWORD VISIBILITY ICONS
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="m3 3 18 18" />
        <path d="M10.6 5.1A11 11 0 0 1 12 5c6 0 10 7 10 7a15 15 0 0 1-3.1 3.7" />
        <path d="M6.2 6.2C3.6 8 2 12 2 12s4 7 10 7a9 9 0 0 0 4-.9" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

// Original AdvocaNote Logo
function Logo({ dark = false }) {
  return (
    <div className={`login-logo ${dark ? "dark" : ""}`}>
      <svg
        width="48"
        height="58"
        viewBox="0 0 48 58"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M24 3 5 12h38L24 3ZM9 16h30M7 51h34M4 56h40"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M12 19v28M20 19v28M28 19v28M36 19v28"
          stroke="currentColor"
          strokeWidth="4"
        />
      </svg>

      <div className="login-logo-text">
        <h2>
          <span className="advoca-text">Advoca</span>
          <span className="note-text">Note</span>
        </h2>
        <p>AI Smart Legal Diary</p>
      </div>
    </div>
  );
}

// Original Left Side Features
const features = [
  {
    icon: "shield",
    title: "Secure & Confidential",
    description:
      "Your data is protected with modern security standards.",
  },
  {
    icon: "briefcase",
    title: "All Your Cases in One Place",
    description:
      "Access your diary, hearings, tasks and reminders anytime.",
  },
  {
    icon: "zap",
    title: "AI-Powered Support",
    description:
      "Use AI and voice features when you need them.",
  },
];

export default function ForgotPassword() {
  const navigate = useNavigate();

  // email -> otp -> password -> success
  const [stage, setStage] = useState("email");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // NEW: EYE ICON STATES
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const registeredEmail = email.trim().toLowerCase();

  // STEP 1 - SEND OTP
  const sendOtp = async (event) => {
    event?.preventDefault();

    if (busy || !registeredEmail) return;

    setBusy(true);
    setMessage("");

    try {
      await requestPasswordOtp(registeredEmail);

      setOtp("");
      setStage("otp");

      setMessage(
        "If this email is registered, a 6-digit code has been sent. Check your inbox or spam folder."
      );
    } catch (error) {
      setMessage(
        error.message ||
          "Could not request verification code."
      );
    } finally {
      setBusy(false);
    }
  };

  // STEP 2 - VERIFY OTP
  const checkOtp = async (event) => {
    event.preventDefault();

    if (busy) return;

    if (!/^\d{6}$/.test(otp)) {
      setMessage("Enter the 6-digit code.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const data = await verifyPasswordOtp(
        registeredEmail,
        otp
      );

      if (!data.reset_token) {
        throw new Error(
          "Verification response is missing a reset token."
        );
      }

      setResetToken(data.reset_token);
      setOtp("");
      setStage("password");
    } catch (error) {
      setMessage(
        error.message || "Verification failed."
      );
    } finally {
      setBusy(false);
    }
  };

  // STEP 3 - RESET PASSWORD
  const changePassword = async (event) => {
    event.preventDefault();

    if (busy) return;

    const validPassword =
      newPassword.length >= 8 &&
      /[A-Za-z]/.test(newPassword) &&
      /\d/.test(newPassword) &&
      /[^A-Za-z0-9\s]/.test(newPassword);

    if (!validPassword) {
      setMessage(
        "Use at least 8 characters with a letter, number and symbol."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage(
        "New Password and Confirm Password do not match."
      );
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      await resetPasswordWithOtp(
        resetToken,
        newPassword
      );

      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");

      setStage("success");

      setMessage(
        "Your password has been reset successfully."
      );
    } catch (error) {
      setMessage(
        error.message || "Password reset failed."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page auth-sync forgot-page">

      {/* ORIGINAL LEFT SIDE */}
      <section className="login-left">
        <div className="login-left-content">
          <Logo />

          <div className="welcome-section">
            <div className="gold-line" />

            <h1>
              Welcome Back,
              <span>Counsel.</span>
            </h1>

            <p>
              Continue managing your legal diary,
              cases, hearings and daily legal activities
              in one secure place.
            </p>
          </div>

          <div className="login-features">
            {features.map((feature) => (
              <div
                className="login-feature"
                key={feature.title}
              >
                <div className="feature-icon">
                  <Icon
                    name={feature.icon}
                    size={29}
                  />
                </div>

                <div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ORIGINAL RIGHT SIDE */}
      <section className="login-right">

        <div className="register-section">
          <span>Don't have an account?</span>

          <button
            type="button"
            onClick={() => navigate("/register")}
          >
            Register Here
          </button>
        </div>

        <div className="login-card forgot-card">

          <div className="login-card-header">
            <Logo dark />
          </div>

          <div className="forgot-content">

            <div className="forgot-icon">
              <Icon
                name={
                  stage === "success" ? "check" : "mail"
                }
                size={30}
              />
            </div>

            <h1>
              {stage === "success"
                ? "Password Reset Successful!"
                : "Forgot Password?"}
            </h1>

            <p className="forgot-description">
              {stage === "email" &&
                "Enter your registered email to receive a verification code."}

              {stage === "otp" &&
                "Enter the 6-digit code sent to your registered email."}

              {stage === "password" &&
                "Account verified. Create your new password."}

              {stage === "success" &&
                "You can now log in using your new password."}
            </p>

            {/* STEP 1 - EMAIL */}
            {stage === "email" && (
              <form
                className="forgot-form"
                onSubmit={sendOtp}
              >
                <div className="login-input-group">
                  <label htmlFor="forgot-email">
                    Email Address
                  </label>

                  <div className="login-input-box">
                    <Icon name="mail" size={22} />

                    <input
                      id="forgot-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      autoComplete="email"
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setMessage("");
                      }}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="login-submit"
                  disabled={busy}
                >
                  {busy
                    ? "Sending..."
                    : "Send Verification Code"}

                  <Icon name="arrow" />
                </button>
              </form>
            )}

            {/* STEP 2 - VERIFY OTP */}
            {stage === "otp" && (
              <form
                className="forgot-form"
                onSubmit={checkOtp}
              >
                <div className="login-input-group">
                  <label htmlFor="forgot-otp">
                    6-Digit Verification Code
                  </label>

                  <div className="login-input-box">
                    <Icon name="lock" size={22} />

                    <input
                      id="forgot-otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      autoComplete="one-time-code"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(event) => {
                        setOtp(
                          event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6)
                        );

                        setMessage("");
                      }}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="login-submit"
                  disabled={busy}
                >
                  {busy
                    ? "Verifying..."
                    : "Verify OTP"}

                  <Icon name="arrow" />
                </button>

                <div className="forgot-secondary-actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => sendOtp()}
                  >
                    Resend Code
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setStage("email");
                      setOtp("");
                      setMessage("");
                    }}
                  >
                    Change Email
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3 - NEW PASSWORD */}
            {stage === "password" && (
              <form
                className="forgot-form"
                onSubmit={changePassword}
              >
                {/* NEW PASSWORD */}
                <div className="login-input-group">
                  <label htmlFor="forgot-new-password">
                    New Password
                  </label>

                  <div className="login-input-box">
                    <Icon name="lock" size={22} />

                    <input
                      id="forgot-new-password"
                      type={
                        showNewPassword
                          ? "text"
                          : "password"
                      }
                      autoComplete="new-password"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(event) => {
                        setNewPassword(
                          event.target.value
                        );
                        setMessage("");
                      }}
                      minLength={8}
                      required
                    />

                    {/* NEW PASSWORD EYE ICON */}
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() =>
                        setShowNewPassword(
                          (value) => !value
                        )
                      }
                      aria-label={
                        showNewPassword
                          ? "Hide new password"
                          : "Show new password"
                      }
                      aria-pressed={showNewPassword}
                    >
                      <Icon
                        name={
                          showNewPassword
                            ? "eyeOff"
                            : "eye"
                        }
                        size={21}
                      />
                    </button>
                  </div>
                </div>

                {/* CONFIRM PASSWORD */}
                <div className="login-input-group">
                  <label htmlFor="forgot-confirm-password">
                    Confirm Password
                  </label>

                  <div className="login-input-box">
                    <Icon name="lock" size={22} />

                    <input
                      id="forgot-confirm-password"
                      type={
                        showConfirmPassword
                          ? "text"
                          : "password"
                      }
                      autoComplete="new-password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(
                          event.target.value
                        );
                        setMessage("");
                      }}
                      minLength={8}
                      required
                    />

                    {/* CONFIRM PASSWORD EYE ICON */}
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() =>
                        setShowConfirmPassword(
                          (value) => !value
                        )
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                      aria-pressed={showConfirmPassword}
                    >
                      <Icon
                        name={
                          showConfirmPassword
                            ? "eyeOff"
                            : "eye"
                        }
                        size={21}
                      />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="login-submit"
                  disabled={busy}
                >
                  {busy
                    ? "Resetting..."
                    : "Reset Password"}

                  <Icon name="arrow" />
                </button>
              </form>
            )}

            {/* STEP 4 - SUCCESS */}
            {stage === "success" && (
              <button
                className="login-submit forgot-success-button"
                type="button"
                onClick={() => navigate("/login")}
              >
                Go to Login
                <Icon name="arrow" />
              </button>
            )}

            {message && (
              <p
                className="forgot-message"
                role="status"
              >
                {message}
              </p>
            )}

            {stage !== "success" && (
              <button
                type="button"
                className="forgot-back"
                onClick={() => navigate("/login")}
              >
                <Icon name="back" size={19} />
                Back to Login
              </button>
            )}

          </div>

          {/* ORIGINAL SECURITY NOTE */}
          <div className="login-security forgot-security">
            <Icon name="shield" size={25} />

            <span>
              Secure, private and built for Sri Lankan
              lawyers.
            </span>
          </div>

        </div>
      </section>
    </main>
  );
}
