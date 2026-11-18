import { useState } from "react";
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

export default function AdminSettings() {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
  });

  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  const [passwords, setPasswords] = useState({
    current: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleProfileChange = (e) => {
    const { name, value } = e.target;

    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;

    setPasswords((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileSave = (e) => {
    e.preventDefault();

    if (!profile.name.trim() || !profile.email.trim()) {
      setMessage("Please enter your name and email.");
      return;
    }

    setMessage(
      "UI preview only. Connect the backend to save profile changes."
    );
  };

  const handlePasswordUpdate = (e) => {
    e.preventDefault();

    if (
      !passwords.current ||
      !passwords.newPassword ||
      !passwords.confirmPassword
    ) {
      setMessage("Please complete all password fields.");
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setMessage("New passwords do not match.");
      return;
    }

    if (passwords.newPassword.length < 8) {
      setMessage("Password must contain at least 8 characters.");
      return;
    }

    setMessage(
      "UI preview only. Connect the backend to update the password."
    );
  };

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
            <p>Manage your admin profile and account security.</p>
          </div>
        </div>
      </div>

      <div className="ads-header-line" />

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

      {/* ADMIN PROFILE */}
      <section className="ads-card">
        <div className="ads-card-header">
          <div className="ads-card-title">
            <div className="ads-card-icon">
              <UserRound size={21} />
            </div>

            <div>
              <h2>Admin Profile</h2>
              <p>Manage your administrator account information.</p>
            </div>
          </div>

          <button
            type="button"
            className="ads-outline-btn"
            onClick={() => {
              setEditing(!editing);
              setMessage("");
            }}
          >
            <Pencil size={15} />
            {editing ? "Cancel Edit" : "Edit Profile"}
          </button>
        </div>

        <div className="ads-divider" />

        <div className="ads-profile-content">
          <div className="ads-avatar">
            <span>
              {profile.name.trim()
                ? profile.name.trim().charAt(0).toUpperCase()
                : "A"}
            </span>
          </div>

          <form
            className="ads-profile-form"
            onSubmit={handleProfileSave}
          >
            <div className="ads-fields-grid">
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
                    placeholder="Enter admin name"
                    readOnly={!editing}
                    required
                  />
                </div>
              </div>

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
                    placeholder="Enter email address"
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
                >
                  <Save size={16} />
                  Save Changes
                </button>
              </div>
            )}
          </form>
        </div>
      </section>

      {/* CHANGE PASSWORD */}
      <section className="ads-card">
        <div className="ads-card-header">
          <div className="ads-card-title">
            <div className="ads-card-icon">
              <ShieldCheck size={21} />
            </div>

            <div>
              <h2>Change Password</h2>
              <p>
                Update your password to keep your admin account
                secure.
              </p>
            </div>
          </div>
        </div>

        <div className="ads-divider" />

        <form onSubmit={handlePasswordUpdate}>
          <div className="ads-password-grid">
            <div className="ads-field">
              <label htmlFor="ads-current-password">
                Current Password
              </label>

              <div className="ads-input-wrap">
                <Lock size={17} />

                <input
                  id="ads-current-password"
                  type={showPassword ? "text" : "password"}
                  name="current"
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={handlePasswordChange}
                  placeholder="Enter current password"
                  required
                />
              </div>
            </div>

            <div className="ads-field">
              <label htmlFor="ads-new-password">
                New Password
              </label>

              <div className="ads-input-wrap">
                <Lock size={17} />

                <input
                  id="ads-new-password"
                  type={showPassword ? "text" : "password"}
                  name="newPassword"
                  autoComplete="new-password"
                  value={passwords.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="Enter new password"
                  required
                />
              </div>
            </div>

            <div className="ads-field">
              <label htmlFor="ads-confirm-password">
                Confirm New Password
              </label>

              <div className="ads-input-wrap">
                <Lock size={17} />

                <input
                  id="ads-confirm-password"
                  type={showPassword ? "text" : "password"}
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
            >
              <Lock size={16} />
              Update Password
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}