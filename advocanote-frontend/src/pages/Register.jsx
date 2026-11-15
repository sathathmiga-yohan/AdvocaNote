
import { useState } from "react";
import { Link } from "react-router-dom";
import { registerUser } from "../services/auth";
import "./Register.css";

// =====================================
// SAME COURT LOGO AS LOGIN
// =====================================

function CourtLogo({ className = "" }) {
  return (
    <svg
      className={className}
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
  );
}

// =====================================
// ADVOCANOTE BRAND
// =====================================

function Brand({ dark = false }) {
  if (dark) {
    return (
      <div className="anr-brand anr-brand--dark login-logo dark">
        <CourtLogo className="anr-brand-icon" />

        <div className="anr-brand-text login-logo-text">
          <h2 className="anr-brand-name">
            <span className="anr-advoca advoca-text">
              Advoca
            </span>
            <span className="anr-note note-text">
              Note
            </span>
          </h2>

          <p className="anr-brand-subtitle">
            AI Smart Legal Diary
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="anr-brand anr-brand--hero an-hero-brand">
      <CourtLogo
        className="anr-brand-icon an-hero-court-icon"
      />

      <h2 className="anr-brand-name an-hero-brand-name">
        <span className="anr-advoca">
          Advoca
        </span>
        <span className="anr-note">
          Note
        </span>
      </h2>

      <p className="anr-brand-subtitle an-hero-tagline">
        AI Smart Legal Diary
      </p>

      <div
        className="anr-brand-line an-hero-gold-line"
        aria-hidden="true"
      />
    </div>
  );
}

// =====================================
// ICONS
// =====================================

const iconPaths = {
  trial: (
    <>
      <path d="M7 3H17V21L12 18L7 21V3Z" />
      <path d="M10 8H14M10 12H14" />
    </>
  ),

  book: (
    <>
      <path d="M12 6C10 4.5 7 4 3 4V19C7 19 10 19.5 12 21" />
      <path d="M12 6C14 4.5 17 4 21 4V19C17 19 14 19.5 12 21" />
      <path d="M12 6V21" />
    </>
  ),

  shield: (
    <path d="M12 2L20 6V11C20 16 17 20 12 22C7 20 4 16 4 11V6L12 2Z" />
  ),

  sparkles: (
    <>
      <path d="M13 2L15.2 8.8L22 11L15.2 13.2L13 20L10.8 13.2L4 11L10.8 8.8L13 2Z" />
      <path d="M5 18L5.8 20.2L8 21L5.8 21.8L5 24L4.2 21.8L2 21L4.2 20.2L5 18Z" />
    </>
  ),

  user: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21V19C4 15.7 7.6 13 12 13C16.4 13 20 15.7 20 19V21" />
    </>
  ),

  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7L12 13L21 7" />
    </>
  ),

  lock: (
    <>
      <rect x="5" y="10" width="14" height="12" rx="2" />
      <path d="M8 10V7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7V10" />
      <path d="M12 15V18" />
    </>
  ),

  eye: (
    <>
      <path d="M2 12C4.5 8 7.7 6 12 6C16.3 6 19.5 8 22 12C19.5 16 16.3 18 12 18C7.7 18 4.5 16 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),

  eyeOff: (
    <>
      <path d="M3 3L21 21" />
      <path d="M10 6.3C10.7 6.1 11.3 6 12 6C16.3 6 19.5 8 22 12C21.3 13.2 20.4 14.3 19.4 15.2" />
      <path d="M6.3 6.3C4.5 7.5 3.1 9.4 2 12C4.5 16 7.7 18 12 18C13.5 18 14.8 17.8 16 17.3" />
    </>
  ),

  arrow: (
    <>
      <path d="M4 12H20" />
      <path d="M13 5L20 12L13 19" />
    </>
  ),
};

function Icon({ name, size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

// =====================================
// REGISTER BENEFITS
// =====================================

const benefits = [
  {
    icon: "trial",
    title: "7-Day Free Trial",
    description:
      "Try all AI and voice features free for 7 days.",
  },
  {
    icon: "book",
    title: "Free Manual Diary",
    description:
      "Continue using the manual diary even after the trial ends.",
  },
  {
    icon: "shield",
    title: "Secure and Private",
    description:
      "Your data is protected with modern security standards.",
  },
  {
    icon: "sparkles",
    title: "AI-Powered Features",
    description:
      "Use voice-to-text, AI suggestions",
  },
];

// =====================================
// MAIN REGISTER PAGE
// =====================================

export default function Register() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // =====================================
  // INPUT CHANGE
  // =====================================

  const updateField = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  // =====================================
  // REGISTER SUBMIT
  // =====================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");

    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (
      !fullName ||
      !email ||
      !password ||
      !form.confirmPassword
    ) {
      setError("Please complete all required fields.");
      return;
    }

    if (fullName.length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (
      password.length < 12 ||
      !/[a-zA-Z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^a-zA-Z0-9]/.test(password)
    ) {
      setError(
        "Password must have at least 12 characters, including letters, numbers and symbols."
      );
      return;
    }

    if (password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await registerUser(fullName, email, password);

      localStorage.setItem(
        `advocanote:onboarding:pending:${email}`,
        "1"
      );

      setSuccess(
        "Registration request completed successfully."
      );
    } catch (err) {
      setError(
        err?.message ||
        "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================
  // PAGE DESIGN
  // =====================================

  return (
    <main className="anr-page">

      {/* LEFT SIDE */}

      <section className="anr-hero">
        <div className="anr-hero-content">

          {/* SAME LOGIN LOGO */}

          <Brand />

          {/* WELCOME TEXT */}

          <div className="anr-intro">
            <h1 className="anr-title">
              <span className="anr-title-white">
                Start Your
              </span>

              <span className="anr-title-gold">
                Smarter Legal Practice.
              </span>
            </h1>

            <p className="auth-description">
              Join AdvocaNote to manage your cases,
              hearings, and daily legal activities
              in one place.
            </p>
          </div>

          {/* FEATURES */}

          <div className="anr-features">
            {benefits.map((benefit) => (
              <div
                className="anr-feature"
                key={benefit.title}
              >
                <div className="anr-feature-icon">
                  <Icon
                    name={benefit.icon}
                    size={27}
                  />
                </div>

                <div className="anr-feature-content">
                  <h3>{benefit.title}</h3>
                  <p>{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* RIGHT SIDE */}

      <section className="anr-right">

        {/* LOGIN LINK */}

        <div className="anr-topbar">
          <span>Already have an account?</span>

          <Link
            to="/login"
            className="anr-login-link"
          >
            Login Here
          </Link>
        </div>

        {/* REGISTER CARD */}


        <div className="anr-card">

          {/* BACK TO HOME */}

          <Link
            to="/"
            className="auth-back-home"
          >
            <span aria-hidden="true">←</span>
            Back to Home
          </Link>

          <Brand dark />


          {/* CARD HEADER */}

          <div className="anr-card-header">
            <h2>Create Your Account</h2>

            <p>
              Join AdvocaNote and start managing
              your legal practice with confidence.
            </p>
          </div>

          {/* REGISTER FORM */}

          <form
            className="anr-form"
            onSubmit={handleSubmit}
            noValidate
          >

            {/* FULL NAME */}

            <div className="anr-field">
              <label htmlFor="anr-fullName">
                Full Name <span>*</span>
              </label>

              <div className="anr-input-wrap">
                <Icon name="user" />

                <input
                  id="anr-fullName"
                  name="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={form.fullName}
                  onChange={updateField}
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            {/* EMAIL */}

            <div className="anr-field">
              <label htmlFor="anr-email">
                Email Address <span>*</span>
              </label>

              <div className="anr-input-wrap">
                <Icon name="mail" />

                <input
                  id="anr-email"
                  name="email"
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={updateField}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* PASSWORD */}

            <div className="anr-field">
              <label htmlFor="anr-password">
                Password <span>*</span>
              </label>

              <div className="anr-input-wrap">
                <Icon name="lock" />

                <input
                  id="anr-password"
                  name="password"
                  type={
                    showPassword ? "text" : "password"
                  }
                  placeholder="Create a password"
                  value={form.password}
                  onChange={updateField}
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  className="anr-eye"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  onClick={() =>
                    setShowPassword((previous) => !previous)
                  }
                >
                  <Icon
                    name={
                      showPassword ? "eyeOff" : "eye"
                    }
                  />
                </button>
              </div>

              <p className="anr-hint">
                Use at least 12 characters with a mix
                of letters, numbers and symbols.
              </p>
            </div>

            {/* CONFIRM PASSWORD */}

            <div className="anr-field">
              <label htmlFor="anr-confirmPassword">
                Confirm Password <span>*</span>
              </label>

              <div className="anr-input-wrap">
                <Icon name="lock" />

                <input
                  id="anr-confirmPassword"
                  name="confirmPassword"
                  type={
                    showConfirm ? "text" : "password"
                  }
                  placeholder="Confirm your password"
                  value={form.confirmPassword}
                  onChange={updateField}
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  className="anr-eye"
                  aria-label={
                    showConfirm
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  onClick={() =>
                    setShowConfirm((previous) => !previous)
                  }
                >
                  <Icon
                    name={
                      showConfirm ? "eyeOff" : "eye"
                    }
                  />
                </button>
              </div>
            </div>

            {/* ERROR MESSAGE */}

            {error && (
              <p
                className="anr-message anr-error"
                role="alert"
              >
                {error}
              </p>
            )}

            {/* SUCCESS MESSAGE */}

            {success && (
              <p
                className="anr-message anr-success"
                role="status"
              >
                {success}
              </p>
            )}

            {/* REGISTER BUTTON */}

            <button
              className="anr-submit"
              type="submit"
              disabled={loading}
            >
              <span>
                {loading
                  ? "Creating Account..."
                  : "Register Account"}
              </span>

              {!loading && (
                <Icon name="arrow" />
              )}
            </button>

          </form>

          {/* RESTORE OR START FRESH ACCOUNT */}
          <p
            style={{
              textAlign: "center",
              marginTop: 12,
              marginBottom: 16,
              fontSize: 13,
              color: "#64716c",
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
      </section>
    </main>
  );
}
