
import { useState } from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { resetPassword } from "../services/auth";

import "./Login.css";
import "./ForgotPassword.css";
import "./AuthLayout.css";

function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [message, setMessage] = useState("");
  const [isResetting, setIsResetting] =
    useState(false);
  const [isSuccess, setIsSuccess] =
    useState(false);

  const handleReset = async (event) => {
    event.preventDefault();

    if (isResetting || isSuccess) {
      return;
    }

    setMessage("");

    if (!token) {
      setMessage(
        "Invalid reset link. Please request a new one."
      );
      return;
    }

    const strongPassword =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

    if (!strongPassword.test(password)) {
      setMessage(
        "Password must contain at least 12 characters, including letters, numbers and symbols."
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setIsResetting(true);

    try {
      await resetPassword(token, password);

      setIsSuccess(true);
      setMessage(
        "Password reset successfully! You can now log in with your new password."
      );

      setPassword("");
      setConfirmPassword("");

    } catch (error) {
      setMessage(
        error.message ||
          "Password reset failed. Please try again."
      );

    } finally {
      setIsResetting(false);
    }
  };

  return (
    <main className="login-page auth-sync forgot-page">
      {/* LEFT SIDE */}
      <section className="login-left">
        <div className="login-left-content">

          <div className="login-logo">
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
                <span className="advoca-text">
                  Advoca
                </span>
                <span className="note-text">
                  Note
                </span>
              </h2>
              <p>AI Smart Legal Diary</p>
            </div>
          </div>

          <div className="welcome-section">
            <div className="gold-line"></div>

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
            <div className="login-feature">
              <div>
                <h3>Secure & Confidential</h3>
                <p>
                  Your data is protected with modern
                  security standards.
                </p>
              </div>
            </div>

            <div className="login-feature">
              <div>
                <h3>All Your Cases in One Place</h3>
                <p>
                  Access your diary, hearings,
                  tasks and reminders anytime.
                </p>
              </div>
            </div>

            <div className="login-feature">
              <div>
                <h3>AI-Powered Support</h3>
                <p>
                  Use AI and voice features
                  when you need them.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* RIGHT SIDE */}
      <section className="login-right">

        <div className="register-section">
          <span>Already have an account?</span>

          <button
            type="button"
            onClick={() => navigate("/login")}
          >
            Login Here
          </button>
        </div>

        <div className="login-card forgot-card">

          <div className="login-card-header">
            <h2>AdvocaNote</h2>
          </div>

          <div className="forgot-content">

            <h1>Reset Password</h1>

            <p className="forgot-description">
              Create a new password for your
              AdvocaNote account.
            </p>

            {!token ? (
              <p className="forgot-message" role="alert">
                Reset link is missing.
                Please request a new password reset link.
              </p>
            ) : !isSuccess ? (
              <form
                className="forgot-form"
                onSubmit={handleReset}
              >

                <div className="login-input-group">
                  <label htmlFor="new-password">
                    New Password
                  </label>

                  <div className="login-input-box">
                    <input
                      id="new-password"
                      type="password"
                      placeholder="Enter new password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setMessage("");
                      }}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <div className="login-input-group">
                  <label htmlFor="confirm-password">
                    Confirm Password
                  </label>

                  <div className="login-input-box">
                    <input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(
                          event.target.value
                        );
                        setMessage("");
                      }}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="login-submit"
                  disabled={isResetting}
                >
                  {isResetting
                    ? "Resetting..."
                    : "Reset Password"}
                </button>
              </form>
            ) : null}

            {message && (
              <p className="forgot-message" role="status">
                {message}
              </p>
            )}

            <button
              type="button"
              className="forgot-back"
              onClick={() =>
                navigate(
                  isSuccess || !token
                    ? "/login"
                    : "/forgot-password"
                )
              }
            >
              {isSuccess || !token
                ? "Back to Login"
                : "Request Another Reset Link"}
            </button>

          </div>

        </div>
      </section>
    </main>
  );
}

export default ResetPassword;
