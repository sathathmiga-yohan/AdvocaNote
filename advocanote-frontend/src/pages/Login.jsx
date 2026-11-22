
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

import "./Login.css";
import "./LoginContentFix.css";


import {
  loginUser,
  googleLogin,
  getCurrentUser
} from "../services/auth";

// =====================================
// ICON COMPONENT
// =====================================

function Icon({ name, size = 23 }) {
  const icons = {
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
        <path d="M3 12h18M10 12v2h4v-2" />
      </>
    ),

    zap: (
      <path d="m13 2-9 12h7l-1 8 10-12h-7V2Z" />
    ),

    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),

    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <path d="M12 14v3" />
      </>
    ),

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

    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
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

// =====================================
// ADVOCANOTE LOGO
// =====================================

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

// =====================================
// LOGIN PAGE
// =====================================

function Login() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem(
      "advocanote_access_token"
    );

    if (!token) return;

    let active = true;

    const checkExistingLogin = async () => {
      try {
        const user = await getCurrentUser();

        if (!active) return;

        if (user?.role === "admin") {
          navigate("/admin", { replace: true });
        } else if (user?.role === "lawyer") {
          navigate("/my-legal-diary", { replace: true });
        }
      } catch (error) {
        console.error("Existing login check failed:", error);
      }
    };

    checkExistingLogin();

    return () => {
      active = false;
    };
  }, [navigate]);
  // =====================================
  // COMMON ROLE-BASED LOGIN
  // =====================================

  const finishLogin = (data, loginMethod) => {
    const role = String(
      data?.role ?? data?.user?.role ?? ""
    )
      .trim()
      .toLowerCase();

    if (!data?.access_token) {
      throw new Error(
        "Login succeeded but no access token was returned."
      );
    }

    if (role !== "admin" && role !== "lawyer") {
      throw new Error("Unsupported account role.");
    }

    localStorage.setItem(
      "advocanote_access_token",
      data.access_token
    );

    if (data.refresh_token) {
      localStorage.setItem(
        "advocanote_refresh_token",
        data.refresh_token
      );
    } else {
      localStorage.removeItem(
        "advocanote_refresh_token"
      );
    }

    // ADMIN LOGIN
    if (role === "admin") {
      localStorage.removeItem(
        "advocanote_auth_toast"
      );

      navigate("/admin", {
        replace: true,
      });

      return;
    }

    // LAWYER LOGIN
    localStorage.setItem(
      "advocanote_auth_toast",
      loginMethod
    );

    navigate("/my-legal-diary", {
      replace: true,
    });
  };

  // =====================================
  // EMAIL + PASSWORD LOGIN
  // =====================================

  const handleLogin = async (e) => {
    e.preventDefault();

    if (isLoggingIn) return;

    setMessage("");
    setIsLoggingIn(true);

    try {
      const data = await loginUser(
        email.trim().toLowerCase(),
        password
      );

      finishLogin(data, "login");
    } catch (error) {
      setMessage(
        error?.message ||
        "Could not connect to the backend."
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  // =====================================
  // GOOGLE LOGIN
  // =====================================

  const handleGoogleSuccess = async (
    credentialResponse
  ) => {
    const credential =
      credentialResponse?.credential;

    if (!credential) {
      setMessage(
        "Google did not return a login credential."
      );
      return;
    }

    if (isLoggingIn) return;

    setMessage("");
    setIsLoggingIn(true);

    try {
      const data = await googleLogin(credential);

      finishLogin(data, "google");
    } catch (error) {
      setMessage(
        error?.message || "Google login failed."
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="login-page auth-sync">

      {/* LEFT SIDE - ORIGINAL DESIGN */}

      <section className="login-left an-hero">
        <div className="an-hero-inner">

          {/* LOGO */}

          <div className="an-hero-brand">
            <svg
              className="an-hero-court-icon"
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

            <h2 className="an-hero-brand-name">
              <span>Advoca</span>
              <span>Note</span>
            </h2>

            <p className="an-hero-tagline">
              AI Smart Legal Diary
            </p>

            <div className="an-hero-gold-line" />
          </div>

          {/* WELCOME MESSAGE */}

          <div className="an-hero-welcome">
            <h1>
              Welcome Back,
              <span>Counsel.</span>
            </h1>


            <p>
              Continue managing your legal diary, cases,
              hearings and daily legal activities in one
              secure place.
            </p>

          </div>

          {/* FEATURE ITEMS */}

          <div className="an-hero-features">

            <div className="an-hero-feature">
              <div className="an-hero-feature-icon">
                <Icon name="shield" size={29} />
              </div>

              <div className="an-hero-feature-text">
                <h3>Secure &amp; Confidential</h3>
                <p>
                  Your data is protected with modern
                  security standards.
                </p>
              </div>
            </div>

            <div className="an-hero-feature">
              <div className="an-hero-feature-icon">
                <Icon name="briefcase" size={29} />
              </div>

              <div className="an-hero-feature-text">
                <h3>All Your Cases in One Place</h3>
                <p>
                  Access your diary, hearings, tasks
                  and reminders anytime.
                </p>
              </div>
            </div>

            <div className="an-hero-feature">
              <div className="an-hero-feature-icon">
                <Icon name="zap" size={29} />
              </div>

              <div className="an-hero-feature-text">
                <h3>AI-Powered Support</h3>
                <p>
                  Use AI and voice features when
                  you need them.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* RIGHT SIDE - LOGIN FORM */}

      <section className="login-right">

        {/* REGISTER LINK */}

        <div className="register-section">
          <span>Don't have an account?</span>

          <button
            type="button"
            onClick={() => navigate("/register")}
          >
            Register Here
          </button>
        </div>

        {/* LOGIN CARD */}


        <div className="login-card">

          {/* BACK TO HOME */}


          {/* BACK TO HOME */}

          <Link
            to="/"
            className="login-back-home"
          >
            <span aria-hidden="true">←</span>
            <span className="login-back-home-text">
              Back to Home
            </span>
          </Link>


          <div className="login-card-header">

            <Logo dark />

            <h1>Login to Your Account</h1>

            <p>
              Access your legal diary and manage your
              practice with confidence.
            </p>
          </div>

          <form onSubmit={handleLogin}>

            {/* EMAIL */}

            <div className="login-input-group">
              <label htmlFor="login-email">
                Email Address
              </label>

              <div className="login-input-box">
                <Icon name="mail" size={22} />

                <input
                  id="login-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  required
                />
              </div>
            </div>

            {/* PASSWORD */}

            <div className="login-input-group">
              <label htmlFor="login-password">
                Password
              </label>

              <div className="login-input-box">
                <Icon name="lock" size={22} />

                <input
                  id="login-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label="Show or hide password"
                >
                  <Icon
                    name={
                      showPassword
                        ? "eyeOff"
                        : "eye"
                    }
                    size={20}
                  />
                </button>
              </div>
            </div>

            {/* REMEMBER / FORGOT */}

            <div className="login-options">
              <label className="remember-me">
                <input type="checkbox" />
                <span>Remember Me</span>
              </label>

              <button
                type="button"
                className="forgot-password"
                onClick={() =>
                  navigate("/forgot-password")
                }
              >
                Forgot Password?
              </button>
            </div>

            {/* LOGIN BUTTON */}

            <button
              type="submit"
              className="login-submit"
              disabled={isLoggingIn}
            >
              {isLoggingIn
                ? "Logging in..."
                : "Login"}

              <Icon name="arrow" size={24} />
            </button>

            {message && (
              <p role="alert" className="login-message">
                {message}
              </p>
            )}
          </form>

          {/* DIVIDER */}

          <div className="login-divider">
            <span>or</span>
          </div>

          {/* GOOGLE LOGIN */}

          <div className="google-login-container">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                setMessage(
                  "Google sign-in was unsuccessful."
                );
              }}
              type="standard"
              theme="outline"
              size="medium"
              text="continue_with"
              shape="rectangular"
              width="190"
              auto_select={false}
              ux_mode="popup"
            />
          </div>

          {/* CLOSED ACCOUNT RECOVERY */}

          <div
            style={{
              textAlign: "center",
              marginTop: 18,
              paddingTop: 15,
              borderTop: "1px solid #eceee8",
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: "#65716c",
                margin: 0,
                lineHeight: 1.8,
              }}
            >
              Previously closed your account?{" "}
              <Link
                to="/rejoin-account"
                style={{
                  color: "#004535",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Restore or Start Fresh
              </Link>
            </p>
          </div>


        </div>
      </section>

    </div>
  );
}

export default Login;
