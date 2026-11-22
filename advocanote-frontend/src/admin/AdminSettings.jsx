
import { useState, useEffect } from "react";
import {
  Settings,
  UserRound,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Pencil,
  Save,
  Info,
} from "lucide-react";

import "./AdminSettings.css";

// =====================================
// API CONFIGURATION
// =====================================

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

// =====================================
// API HELPER
// =====================================

async function adminSettingsRequest(
  path,
  { method = "GET", body, signal } = {}
) {
  const token = localStorage.getItem(
    "advocanote_access_token"
  );

  if (!token) {
    throw new Error(
      "Login session not found. Please log in again."
    );
  }

  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        method,
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body
            ? { "Content-Type": "application/json" }
            : {}),
        },
        ...(body
          ? { body: JSON.stringify(body) }
          : {}),
      }
    );
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Cannot connect to backend. Check that the server is running."
    );
  }

  const result = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const detail = result.detail;

    let errorMessage = "Something went wrong.";

    if (typeof detail === "string") {
      errorMessage = detail;
    } else if (Array.isArray(detail)) {
      errorMessage = detail
        .map((item) => item.msg || "Invalid input")
        .join(", ");
    } else if (response.status === 401) {
      errorMessage =
        "Session expired. Please log in again.";
    } else if (response.status === 403) {
      errorMessage = "Admin access required.";
    } else {
      errorMessage = `Request failed (${response.status}).`;
    }

    throw new Error(errorMessage);
  }

  return result;
}

// =====================================
// ADMIN SETTINGS
// =====================================

export default function AdminSettings() {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
  });

  const [savedProfile, setSavedProfile] = useState({
    name: "",
    email: "",
  });

  const [loadingProfile, setLoadingProfile] =
    useState(true);

  const [profileLoaded, setProfileLoaded] =
    useState(false);

  const [savingProfile, setSavingProfile] =
    useState(false);

  const [updatingPassword, setUpdatingPassword] =
    useState(false);

  const [editing, setEditing] = useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [message, setMessage] = useState("");

  const [passwords, setPasswords] = useState({
    current: "",
    newPassword: "",
    confirmPassword: "",
  });

  // =====================================
  // LOAD ADMIN PROFILE
  // =====================================

  useEffect(() => {
    const controller = new AbortController();

    const loadAdminProfile = async () => {
      setLoadingProfile(true);

      try {
        const data = await adminSettingsRequest(
          "/admin/settings/profile",
          { signal: controller.signal }
        );

        if (controller.signal.aborted) return;

        const adminData = {
          name: data.name || "",
          email: data.email || "",
        };

        setProfile(adminData);
        setSavedProfile(adminData);
        setProfileLoaded(true);

      } catch (error) {
        if (!controller.signal.aborted) {
          setMessage(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingProfile(false);
        }
      }
    };

    loadAdminProfile();

    return () => {
      controller.abort();
    };
  }, []);

  // =====================================
  // PROFILE INPUT CHANGE
  // =====================================

  const handleProfileChange = (e) => {
    const { name, value } = e.target;

    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =====================================
  // PASSWORD INPUT CHANGE
  // =====================================

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;

    setPasswords((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =====================================
  // EDIT / CANCEL PROFILE
  // =====================================

  const handleEditProfile = () => {
    setMessage("");

    if (editing) {
      setProfile({ ...savedProfile });
      setEditing(false);
    } else {
      setEditing(true);
    }
  };

  // =====================================
  // SAVE ADMIN PROFILE
  // =====================================

  const handleProfileSave = async (e) => {
    e.preventDefault();

    if (savingProfile) return;

    if (
      !profile.name.trim() ||
      !profile.email.trim()
    ) {
      setMessage(
        "Please enter your name and email."
      );
      return;
    }

    setSavingProfile(true);
    setMessage("");

    try {
      const result = await adminSettingsRequest(
        "/admin/settings/profile",
        {
          method: "PATCH",
          body: {
            name: profile.name.trim(),
            email: profile.email.trim(),
          },
        }
      );

      const updatedProfile = {
        name: result.profile.name,
        email: result.profile.email,
      };

      setProfile(updatedProfile);
      setSavedProfile(updatedProfile);
      setEditing(false);

      setMessage(
        result.message ||
        "Admin profile updated successfully."
      );

    } catch (error) {
      setMessage(error.message);
    } finally {
      setSavingProfile(false);
    }
  };

  // =====================================
  // UPDATE ADMIN PASSWORD
  // =====================================

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();

    if (updatingPassword) return;

    if (
      !passwords.current ||
      !passwords.newPassword ||
      !passwords.confirmPassword
    ) {
      setMessage(
        "Please complete all password fields."
      );
      return;
    }

    if (
      passwords.newPassword !==
      passwords.confirmPassword
    ) {
      setMessage(
        "New passwords do not match."
      );
      return;
    }

    if (passwords.newPassword.length < 8) {
      setMessage(
        "Password must contain at least 8 characters."
      );
      return;
    }

    if (
      passwords.current ===
      passwords.newPassword
    ) {
      setMessage(
        "New password must be different from current password."
      );
      return;
    }

    setUpdatingPassword(true);
    setMessage("");

    try {
      const result = await adminSettingsRequest(
        "/admin/settings/password",
        {
          method: "POST",
          body: {
            current_password: passwords.current,
            new_password: passwords.newPassword,
          },
        }
      );

      setPasswords({
        current: "",
        newPassword: "",
        confirmPassword: "",
      });

      setShowPassword(false);

      setMessage(
        result.message ||
        "Password updated successfully."
      );

    } catch (error) {
      setMessage(error.message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  // =====================================
  // UI
  // =====================================

  return (
    <main className="ads-page">

      {/* PAGE HEADER */}
      <div className="ads-header">
        <div className="ads-heading">
          <div className="ads-heading-icon">
            <Settings size={23} />
          </div>

          <div>
            <h1>Settings</h1>
            <p>
              Manage your admin profile and account security.
            </p>
          </div>
        </div>
      </div>

      <div className="ads-header-line" />

      {/* MESSAGE */}
      {message && (
        <div className="ads-message" role="status">
          <Info size={17} />

          <span>{message}</span>

          <button
            type="button"
            onClick={() => setMessage("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* =====================================
          ADMIN PROFILE
      ===================================== */}

      <section className="ads-card">

        <div className="ads-card-header">
          <div className="ads-card-title">
            <div className="ads-card-icon">
              <UserRound size={21} />
            </div>

            <div>
              <h2>Admin Profile</h2>
              <p>
                Manage your administrator account information.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="ads-outline-btn"
            onClick={handleEditProfile}
            disabled={
              loadingProfile ||
              !profileLoaded ||
              savingProfile
            }
          >
            <Pencil size={15} />

            {editing
              ? "Cancel Edit"
              : "Edit Profile"}
          </button>
        </div>

        <div className="ads-divider" />

        <div className="ads-profile-content">

          {/* ADMIN AVATAR */}
          <div className="ads-avatar">
            <span>
              {profile.name.trim()
                ? profile.name
                    .trim()
                    .charAt(0)
                    .toUpperCase()
                : "A"}
            </span>
          </div>

          {/* PROFILE FORM */}
          <form
            className="ads-profile-form"
            onSubmit={handleProfileSave}
          >

            <div className="ads-fields-grid">

              {/* NAME */}
              <div className="ads-field">
                <label htmlFor="ads-admin-name">
                  Admin Name
                </label>

                <div className="ads-input-wrap">
                  <UserRound size={17} />

                  <input
                    id="ads-admin-name"
                    type="text"
                    name="name"
                    value={profile.name}
                    onChange={handleProfileChange}
                    placeholder={
                      loadingProfile
                        ? "Loading..."
                        : "Enter admin name"
                    }
                    readOnly={!editing}
                    required
                  />
                </div>
              </div>

              {/* EMAIL */}
              <div className="ads-field">
                <label htmlFor="ads-admin-email">
                  Email Address
                </label>

                <div className="ads-input-wrap">
                  <Mail size={17} />

                  <input
                    id="ads-admin-email"
                    type="email"
                    name="email"
                    value={profile.email}
                    onChange={handleProfileChange}
                    placeholder={
                      loadingProfile
                        ? "Loading..."
                        : "Enter email address"
                    }
                    readOnly={!editing}
                    required
                  />
                </div>
              </div>

            </div>

            {editing && (
              <div className="ads-actions">
                <button
                  type="submit"
                  className="ads-primary-btn"
                  disabled={savingProfile}
                >
                  <Save size={16} />

                  {savingProfile
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            )}

          </form>
        </div>
      </section>

      {/* =====================================
          CHANGE PASSWORD
      ===================================== */}

      <section className="ads-card">

        <div className="ads-card-header">
          <div className="ads-card-title">
            <div className="ads-card-icon">
              <ShieldCheck size={21} />
            </div>

            <div>
              <h2>Change Password</h2>
              <p>
                Update your password to keep your admin
                account secure.
              </p>
            </div>
          </div>
        </div>

        <div className="ads-divider" />

        <form onSubmit={handlePasswordUpdate}>

          <div className="ads-password-grid">

            {/* CURRENT PASSWORD */}
            <div className="ads-field">
              <label htmlFor="ads-current-password">
                Current Password
              </label>

              <div className="ads-input-wrap">
                <Lock size={17} />

                <input
                  id="ads-current-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  name="current"
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={handlePasswordChange}
                  placeholder="Enter current password"
                  required
                />
              </div>
            </div>

            {/* NEW PASSWORD */}
            <div className="ads-field">
              <label htmlFor="ads-new-password">
                New Password
              </label>

              <div className="ads-input-wrap">
                <Lock size={17} />

                <input
                  id="ads-new-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  name="newPassword"
                  autoComplete="new-password"
                  value={passwords.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="Enter new password"
                  required
                />
              </div>
            </div>

            {/* CONFIRM PASSWORD */}
            <div className="ads-field">
              <label htmlFor="ads-confirm-password">
                Confirm New Password
              </label>

              <div className="ads-input-wrap">
                <Lock size={17} />

                <input
                  id="ads-confirm-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={passwords.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="Confirm new password"
                  required
                />
              </div>
            </div>

          </div>

          {/* FOOTER */}
          <div className="ads-password-footer">

            <label className="ads-show-password">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) =>
                  setShowPassword(e.target.checked)
                }
              />

              {showPassword ? (
                <EyeOff size={16} />
              ) : (
                <Eye size={16} />
              )}

              Show passwords
            </label>

            <button
              type="submit"
              className="ads-primary-btn"
              disabled={updatingPassword}
            >
              <Lock size={16} />

              {updatingPassword
                ? "Updating..."
                : "Update Password"}
            </button>

          </div>
        </form>
      </section>

    </main>
  );
}
