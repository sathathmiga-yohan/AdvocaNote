
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import NotificationBell from "../components/NotificationBell";
import {
  UserRound,
  BriefcaseBusiness,
  CreditCard,
  Bell,
  ShieldCheck,
  Camera,
  Mail,
  MapPin,
  Phone,
  Check,
  CheckCircle2,
  Download,
  Trash2,
  Save,
  X,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";

import { useLawyerLayout } from "../components/LawyerLayout";

import {
  getMyProfile,
  updateMyProfile,
  getMyProfilePhoto,
  uploadMyProfilePhoto,
  removeMyProfilePhoto,
} from "../services/profileApi";

import SubscriptionBilling from "../components/SubscriptionBilling";

import "./AccountPages.css";
import "./ProfileV2.css";

// =====================================
// PROFILE TABS
// =====================================

const TABS = [
  {
    id: "account",
    label: "Account Settings",
    Icon: UserRound,
  },
  {
    id: "professional",
    label: "Professional Profile",
    Icon: BriefcaseBusiness,
  },
  {
    id: "billing",
    label: "Billing & Subscription",
    Icon: CreditCard,
  },
  {
    id: "preferences",
    label: "Preferences",
    Icon: Bell,
  },
  {
    id: "privacy",
    label: "Privacy & Data",
    Icon: ShieldCheck,
  },
];

const PRACTICE_AREAS = [
  "Civil Law",
  "Criminal Law",
  "Family Law",
  "Land Law",
  "Commercial Law",
  "Labour Law",
  "Fundamental Rights",
  "Other",
];

// =====================================
// CONVERT PROFILE DATA
// =====================================

function toForm(data) {
  const profile = data?.profile || {};
  const notifications =
    profile.notification_preferences || {};

  return {
    fullName: data?.full_name || "",
    phone: profile.phone || "",
    location: profile.location || "",
    title: profile.professional_title || "",
    barNumber: profile.bar_number || "",
    lawFirm: profile.law_firm || "",

    practiceAreas: Array.isArray(
      profile.practice_areas
    )
      ? [...profile.practice_areas]
      : [],

    hearingReminders:
      notifications.hearing_reminders ?? true,

    taskReminders:
      notifications.task_reminders ?? true,

    emailNotifications:
      notifications.email_notifications ?? true,
  };
}

// =====================================
// SETTINGS INPUT FIELD
// =====================================

function SettingField({
  id,
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  required = false,
  readOnly = false,
  maxLength = 150,
}) {
  return (
    <div className="anp-v2-field-row">
      <label htmlFor={id}>
        {label}

        {required && (
          <span className="anp-v2-required">
            {" "}*
          </span>
        )}
      </label>

      <div className="anp-v2-field-control">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) =>
            onChange?.(event.target.value)
          }
          placeholder={placeholder}
          required={required}
          readOnly={readOnly}
          maxLength={maxLength}
        />
      </div>
    </div>
  );
}

// =====================================
// SECTION HEADING
// =====================================

function SectionHeading({
  title,
  description,
}) {
  return (
    <div className="anp-v2-section-heading">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

// =====================================
// NOTIFICATION OPTION
// =====================================

function NotificationOption({
  title,
  description,
  checked,
  disabled,
  onChange,
}) {
  return (
    <div className="anp-v2-feature-row">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <input
        className="anp-v2-switch"
        type="checkbox"
        aria-label={title}
        checked={checked}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.checked)
        }
      />
    </div>
  );
}

// =====================================
// MAIN PROFILE PAGE
// =====================================

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useLawyerLayout();

  const fileRef = useRef(null);
  const photoUrlRef = useRef("");

  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(null);

  const [activeTab, setActiveTab] =
    useState("account");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState("");

  const [photoBusy, setPhotoBusy] =
    useState(false);

  const [exporting, setExporting] =
    useState(false);

  const [photoUrl, setPhotoUrl] =
    useState("");

  const [dialog, setDialog] =
    useState("");

  const [notice, setNotice] =
    useState(null);

  // =====================================
  // NOTIFICATION MESSAGES
  // =====================================

  function success(message) {
    setNotice({
      type: "success",
      message,
    });
  }

  function showError(message) {
    setNotice({
      type: "error",
      message,
    });
  }

  // =====================================
  // LOAD PROFILE
  // =====================================

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await getMyProfile();

        if (!active) return;

        setRecord(data);
        setForm(toForm(data));
      } catch (err) {
        if (active) {
          showError(
            err.message ||
              "Unable to load profile."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  // =====================================
  // LOAD PROFILE PHOTO
  // =====================================

  useEffect(() => {
    let active = true;

    async function loadPhoto() {
      try {
        const blob =
          await getMyProfilePhoto();

        if (!active || !blob) return;

        const url =
          URL.createObjectURL(blob);

        if (photoUrlRef.current) {
          URL.revokeObjectURL(
            photoUrlRef.current
          );
        }

        photoUrlRef.current = url;
        setPhotoUrl(url);
      } catch (err) {
        console.error(
          "Profile photo loading error:",
          err
        );
      }
    }

    loadPhoto();

    return () => {
      active = false;

      if (photoUrlRef.current) {
        URL.revokeObjectURL(
          photoUrlRef.current
        );

        photoUrlRef.current = "";
      }
    };
  }, []);

  // =====================================
  // CLOSE DIALOG WITH ESCAPE
  // =====================================

  useEffect(() => {
    if (!dialog) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setDialog("");
      }
    };

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [dialog]);

  // =====================================
  // UPDATE FORM
  // =====================================

  function updateField(key, value) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function selectTab(tab) {
    setActiveTab(tab);
    setNotice(null);
  }

  // =====================================
  // SAVE PROFILE
  // =====================================

  async function saveProfile(
    section,
    payload
  ) {
    if (saving) return false;

    setSaving(section);
    setNotice(null);

    try {
      const updated =
        await updateMyProfile(payload);

      const latest = toForm(updated);

      setRecord(updated);

      const sectionFields = {
        account: [
          "fullName",
          "phone",
          "location",
        ],

        professional: [
          "title",
          "barNumber",
          "lawFirm",
          "practiceAreas",
        ],

        notifications: [
          "hearingReminders",
          "taskReminders",
          "emailNotifications",
        ],
      };

      setForm((previous) => {
        const next = { ...previous };

        for (
          const key of
          sectionFields[section] || []
        ) {
          next[key] = latest[key];
        }

        return next;
      });

      window.dispatchEvent(
        new Event(
          "advocanote:profile-updated"
        )
      );

      success(
        "Changes saved successfully."
      );

      return true;
    } catch (err) {
      showError(
        err.message ||
          "Unable to save changes."
      );

      if (
        section === "notifications" &&
        record
      ) {
        const previous = toForm(record);

        setForm((current) => ({
          ...current,

          hearingReminders:
            previous.hearingReminders,

          taskReminders:
            previous.taskReminders,

          emailNotifications:
            previous.emailNotifications,
        }));
      }

      return false;
    } finally {
      setSaving("");
    }
  }

  // =====================================
  // SAVE ACCOUNT
  // =====================================

  function saveAccount(event) {
    event.preventDefault();

    const fullName =
      form.fullName.trim();

    const phone =
      form.phone.trim();

    const location =
      form.location.trim();

    if (
      fullName.length < 2 ||
      phone.length < 7 ||
      location.length < 2
    ) {
      showError(
        "Please enter valid personal information."
      );

      return;
    }

    saveProfile("account", {
      full_name: fullName,
      phone,
      location,
    });
  }

  // =====================================
  // SAVE PROFESSIONAL PROFILE
  // =====================================

  function saveProfessional(event) {
    event.preventDefault();

    if (
      !form.title.trim() ||
      !form.barNumber.trim() ||
      !form.practiceAreas.length
    ) {
      showError(
        "Enter your professional title, bar number and practice areas."
      );

      return;
    }

    saveProfile("professional", {
      professional_title:
        form.title.trim(),

      bar_number:
        form.barNumber.trim(),

      law_firm:
        form.lawFirm.trim() || null,

      practice_areas:
        form.practiceAreas,
    });
  }

  // =====================================
  // PRACTICE AREAS
  // =====================================

  function togglePractice(area) {
    setForm((previous) => ({
      ...previous,

      practiceAreas:
        previous.practiceAreas.includes(
          area
        )
          ? previous.practiceAreas.filter(
              (item) => item !== area
            )
          : [
              ...previous.practiceAreas,
              area,
            ],
    }));
  }

  // =====================================
  // NOTIFICATION PREFERENCES
  // =====================================

  async function changeNotification(
    key,
    checked
  ) {
    if (saving) return;

    const next = {
      ...form,
      [key]: checked,
    };

    setForm(next);

    await saveProfile(
      "notifications",
      {
        notification_preferences: {
          hearing_reminders:
            next.hearingReminders,

          task_reminders:
            next.taskReminders,

          email_notifications:
            next.emailNotifications,
        },
      }
    );
  }

  // =====================================
  // UPLOAD PROFILE PHOTO
  // =====================================

  async function uploadPhoto(event) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file || photoBusy) return;

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(file.type)
    ) {
      showError(
        "Choose a JPG, PNG or WEBP image."
      );

      return;
    }

    if (
      file.size >
      3 * 1024 * 1024
    ) {
      showError(
        "Image must be smaller than 3 MB."
      );

      return;
    }

    setPhotoBusy(true);
    setNotice(null);

    try {
      await uploadMyProfilePhoto(file);

      const blob =
        await getMyProfilePhoto();

      if (!blob) {
        throw new Error(
          "Saved photo could not be loaded."
        );
      }

      const nextUrl =
        URL.createObjectURL(blob);

      const previousUrl =
        photoUrlRef.current;

      photoUrlRef.current = nextUrl;

      setPhotoUrl(nextUrl);

      if (previousUrl) {
        URL.revokeObjectURL(
          previousUrl
        );
      }

      window.dispatchEvent(
        new Event(
          "advocanote:profile-photo-changed"
        )
      );

      success(
        "Profile photo updated."
      );
    } catch (err) {
      showError(
        err.message ||
          "Photo upload failed."
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  // =====================================
  // REMOVE PROFILE PHOTO
  // =====================================

  async function deletePhoto() {
    if (photoBusy) return;

    setPhotoBusy(true);
    setNotice(null);

    try {
      await removeMyProfilePhoto();

      if (photoUrlRef.current) {
        URL.revokeObjectURL(
          photoUrlRef.current
        );

        photoUrlRef.current = "";
      }

      setPhotoUrl("");

      window.dispatchEvent(
        new Event(
          "advocanote:profile-photo-changed"
        )
      );

      success(
        "Profile photo removed."
      );
    } catch (err) {
      showError(
        err.message ||
          "Unable to remove photo."
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  // =====================================
  // DOWNLOAD PROFILE DATA
  // =====================================

  async function downloadProfile() {
    if (exporting) return;

    setExporting(true);
    setNotice(null);

    try {
      const data =
        await getMyProfile();

      const blob = new Blob(
        [
          JSON.stringify(
            {
              exported_at:
                new Date().toISOString(),

              export_type:
                "AdvocaNote Profile Data",

              account: data,
            },
            null,
            2
          ),
        ],
        {
          type: "application/json",
        }
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        "advocanote-profile.json";

      document.body.appendChild(link);

      link.click();
      link.remove();

      setTimeout(
        () => URL.revokeObjectURL(url),
        1000
      );

      success(
        "Profile data downloaded."
      );
    } catch (err) {
      showError(
        err.message ||
          "Download failed."
      );
    } finally {
      setExporting(false);
    }
  }

  // =====================================
  // PROFILE DISPLAY VALUES
  // =====================================

  const fullName =
    record?.full_name ||
    user?.full_name ||
    user?.name ||
    "Lawyer";

  const email =
    record?.email ||
    user?.email ||
    "";

  const profile =
    record?.profile || {};

  const initials =
    fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0)
      )
      .join("")
      .toUpperCase() || "L";

  const fieldsCompleted = [
    Boolean(
      record?.full_name?.trim()
    ),

    Boolean(email),

    Boolean(profile.phone),

    Boolean(profile.location),

    Boolean(
      profile.professional_title
    ),

    Boolean(profile.bar_number),

    Boolean(profile.law_firm),

    Boolean(
      profile.practice_areas?.length
    ),

    Boolean(photoUrl),
  ];

  const completeness = Math.round(
    (
      fieldsCompleted.filter(Boolean)
        .length /
      fieldsCompleted.length
    ) * 100
  );

  const availableAreas =
    Array.from(
      new Set([
        ...PRACTICE_AREAS,

        ...(
          form?.practiceAreas || []
        ),
      ])
    );

  // =====================================
  // PROFILE UI
  // =====================================

  return (
    <main className="anp-page anp-v2">
      <div className="anp-v2-container">

        {/* PAGE HEADER */}

        <div className="anp-v2-page-header">
          <div>
            <span className="anp-v2-eyebrow">
              ADVOCANOTE / MY ACCOUNT
            </span>

            <h1>
              Profile & Settings
            </h1>

            <p>
              Manage your legal professional
              profile, account information
              and preferences.
            </p>
          </div>

          {(
            activeTab === "account" ||
            activeTab === "professional"
          ) && record && (
            <button
              type="submit"
              form={
                activeTab === "account"
                  ? "anp-v2-account-form"
                  : "anp-v2-professional-form"
              }
              className="anp-v2-save"
              disabled={Boolean(saving)}
            >
              <Save size={17} />

              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>
          )}
        </div>

        {/* LOADING */}

        {loading && (
          <div className="anp-v2-loading">
            Loading your profile...
          </div>
        )}

        {/* LOAD ERROR */}

        {!loading && !record && (
          <div className="anp-v2-loading">
            <p>
              {notice?.message ||
                "Unable to load your profile."}
            </p>

            <button
              type="button"
              className="anp-v2-save"
              onClick={() =>
                window.location.reload()
              }
            >
              <RefreshCw size={16} />

              Retry
            </button>
          </div>
        )}

        {/* PROFILE CONTENT */}

        {!loading && record && form && (
          <div className="anp-v2-shell">

            {/* LEFT PROFILE SIDEBAR */}

            <aside className="anp-v2-sidebar">

              {/* PROFILE AVATAR */}

              <div className="anp-v2-avatar">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={`${fullName} profile`}
                  />
                ) : (
                  initials
                )}
              </div>

              <h2 className="anp-v2-lawyer-name">
                {fullName}
              </h2>

              <p className="anp-v2-lawyer-role">
                {profile.professional_title ||
                  "Lawyer"}
              </p>

              <span className="anp-v2-lawyer-tag">
                <ShieldCheck size={13} />

                Lawyer Account
              </span>

              {/* PHOTO ACTIONS */}

              <div className="anp-v2-photo-actions">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={uploadPhoto}
                  className="anp-v2-hidden"
                  aria-label="Choose profile photo"
                />

                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() =>
                    fileRef.current?.click()
                  }
                >
                  <Camera size={15} />

                  {photoBusy
                    ? "Updating..."
                    : "Update Photo"}
                </button>

                {photoUrl && (
                  <button
                    type="button"
                    onClick={deletePhoto}
                    disabled={photoBusy}
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* PROFILE COMPLETENESS */}

              <div className="anp-v2-completion">
                <div className="anp-v2-completion-label">
                  <span>
                    Profile completeness
                  </span>

                  <strong>
                    {completeness}%
                  </strong>
                </div>

                <div
                  className="anp-v2-progress"
                  role="progressbar"
                  aria-label="Profile completeness"
                  aria-valuenow={completeness}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span
                    style={{
                      width: `${completeness}%`,
                    }}
                  />
                </div>

                <p>
                  Complete your professional
                  details to keep your account
                  up to date.
                </p>
              </div>

              {/* PROFESSIONAL OVERVIEW */}

              <div className="anp-v2-sidebar-section">
                <h3>
                  Professional Overview
                </h3>

                <div className="anp-v2-sidebar-detail">
                  <MapPin size={16} />

                  <span>
                    {profile.location ||
                      "Location not provided"}
                  </span>
                </div>

                <div className="anp-v2-sidebar-detail">
                  <Mail size={16} />

                  <span>
                    {email}
                  </span>
                </div>

                {profile.phone && (
                  <div className="anp-v2-sidebar-detail">
                    <Phone size={16} />

                    <span>
                      {profile.phone}
                    </span>
                  </div>
                )}

                {profile.law_firm && (
                  <div className="anp-v2-sidebar-detail">
                    <BriefcaseBusiness size={16} />

                    <span>
                      {profile.law_firm}
                    </span>
                  </div>
                )}
              </div>

              {/* PRACTICE AREAS */}

              <div className="anp-v2-sidebar-section">
                <h3>
                  Practice Areas
                </h3>

                {profile.practice_areas?.length ? (
                  <div className="anp-v2-tags">
                    {profile.practice_areas.map(
                      (area) => (
                        <span key={area}>
                          {area}
                        </span>
                      )
                    )}
                  </div>
                ) : (
                  <p className="anp-v2-empty">
                    No practice areas added yet.
                  </p>
                )}
              </div>
            </aside>

            {/* RIGHT SETTINGS */}

            <div className="anp-v2-main">

              {/* NAVIGATION TABS */}

              <div
                className="anp-v2-tabs"
                role="tablist"
                aria-label="Profile settings sections"
              >
                {TABS.map(
                  ({
                    id,
                    label,
                    Icon,
                  }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      id={`anp-v2-tab-${id}`}
                      aria-selected={
                        activeTab === id
                      }
                      aria-controls="anp-v2-panel"
                      className={
                        activeTab === id
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        selectTab(id)
                      }
                    >
                      <Icon size={16} />

                      <span>
                        {label}
                      </span>
                    </button>
                  )
                )}
              </div>

              {/* TAB PANEL */}

              <div
                className="anp-v2-panel"
                id="anp-v2-panel"
                role="tabpanel"
                aria-labelledby={
                  `anp-v2-tab-${activeTab}`
                }
              >

                {/* SUCCESS / ERROR */}

                {notice && (
                  <div
                    className={
                      `anp-v2-notice ${notice.type}`
                    }
                    role={
                      notice.type === "error"
                        ? "alert"
                        : "status"
                    }
                  >
                    {notice.type === "success" ? (
                      <CheckCircle2 size={17} />
                    ) : (
                      <X size={17} />
                    )}

                    <span>
                      {notice.message}
                    </span>
                  </div>
                )}

                {/* ACCOUNT SETTINGS */}

                {activeTab === "account" && (
                  <div className="anp-v2-section">
                    <SectionHeading
                      title="Profile Information"
                      description="Manage your personal details and keep your contact information up to date."
                    />

                    <form
                      id="anp-v2-account-form"
                      onSubmit={saveAccount}
                    >
                      <SettingField
                        id="anp-v2-name"
                        label="Full Name"
                        value={form.fullName}
                        required
                        onChange={(value) =>
                          updateField(
                            "fullName",
                            value
                          )
                        }
                      />

                      <SettingField
                        id="anp-v2-email"
                        label="Email Address"
                        value={email}
                        readOnly
                      />

                      <SettingField
                        id="anp-v2-phone"
                        label="Phone Number"
                        type="tel"
                        maxLength={30}
                        required
                        placeholder="Enter your phone number"
                        value={form.phone}
                        onChange={(value) =>
                          updateField(
                            "phone",
                            value
                          )
                        }
                      />

                      <SettingField
                        id="anp-v2-location"
                        label="City / Location"
                        maxLength={100}
                        required
                        placeholder="Enter your city or location"
                        value={form.location}
                        onChange={(value) =>
                          updateField(
                            "location",
                            value
                          )
                        }
                      />
                    </form>
                  </div>
                )}

                {/* PROFESSIONAL PROFILE */}

                {activeTab === "professional" && (
                  <div className="anp-v2-section">
                    <SectionHeading
                      title="Professional Profile"
                      description="Your legal identity, enrolment details and areas of practice."
                    />

                    <form
                      id="anp-v2-professional-form"
                      onSubmit={saveProfessional}
                    >
                      <SettingField
                        id="anp-v2-title"
                        label="Professional Title"
                        value={form.title}
                        maxLength={80}
                        required
                        placeholder="e.g. Attorney-at-Law"
                        onChange={(value) =>
                          updateField(
                            "title",
                            value
                          )
                        }
                      />

                      <SettingField
                        id="anp-v2-bar"
                        label="Bar / Enrollment Number"
                        value={form.barNumber}
                        maxLength={100}
                        required
                        onChange={(value) =>
                          updateField(
                            "barNumber",
                            value
                          )
                        }
                      />

                      <SettingField
                        id="anp-v2-firm"
                        label="Law Firm / Chambers"
                        value={form.lawFirm}
                        maxLength={150}
                        placeholder="Enter your chambers or law firm"
                        onChange={(value) =>
                          updateField(
                            "lawFirm",
                            value
                          )
                        }
                      />

                      {/* PRACTICE AREAS */}

                      <div className="anp-v2-field-row anp-v2-areas-row">
                        <label>
                          Practice Areas

                          <span className="anp-v2-required">
                            {" "}*
                          </span>
                        </label>

                        <div className="anp-v2-area-control">
                          <p>
                            Select the legal fields
                            you practise in.
                          </p>

                          <div className="anp-v2-area-list">
                            {availableAreas.map(
                              (area) => {
                                const selected =
                                  form.practiceAreas.includes(
                                    area
                                  );

                                return (
                                  <button
                                    key={area}
                                    type="button"
                                    aria-pressed={selected}
                                    className={
                                      selected
                                        ? "selected"
                                        : ""
                                    }
                                    onClick={() =>
                                      togglePractice(
                                        area
                                      )
                                    }
                                  >
                                    {selected && (
                                      <Check
                                        size={13}
                                      />
                                    )}

                                    {area}
                                  </button>
                                );
                              }
                            )}
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>
                )}

                {/* BILLING & SUBSCRIPTION */}

                {activeTab === "billing" && (
                  <div className="anp-v2-section">
                    <SectionHeading
                      title="Billing & Subscription"
                      description="Manage your AdvocaNote subscription and billing details."
                    />

                    <SubscriptionBilling />

                    <div className="anp-v2-feature-row">
                      <div>
                        <strong>
                          Subscription Management
                        </strong>

                        <p>
                          View and manage your
                          subscription plans.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="anp-v2-outline-button"
                        onClick={() =>
                          navigate(
                            "/subscription"
                          )
                        }
                      >
                        Open Subscription

                        <ArrowUpRight
                          size={15}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* NOTIFICATION PREFERENCES */}

                {activeTab === "preferences" && (
                  <div className="anp-v2-section">
                    <SectionHeading
                      title="Notification Preferences"
                      description="Choose which reminders and notifications you want to receive."
                    />

                    <div className="anp-v2-preferences-panel">
                      <NotificationOption
                        title="Hearing Reminders"
                        description="Reminders for upcoming court hearings."
                        checked={
                          form.hearingReminders
                        }
                        disabled={
                          Boolean(saving)
                        }
                        onChange={(checked) =>
                          changeNotification(
                            "hearingReminders",
                            checked
                          )
                        }
                      />

                      <NotificationOption
                        title="Task Reminders"
                        description="Reminders for tasks and deadlines."
                        checked={
                          form.taskReminders
                        }
                        disabled={
                          Boolean(saving)
                        }
                        onChange={(checked) =>
                          changeNotification(
                            "taskReminders",
                            checked
                          )
                        }
                      />

                      <NotificationOption
                        title="Email Notifications"
                        description="Control your email notification preference."
                        checked={
                          form.emailNotifications
                        }
                        disabled={
                          Boolean(saving)
                        }
                        onChange={(checked) =>
                          changeNotification(
                            "emailNotifications",
                            checked
                          )
                        }
                      />
                    </div>
                  </div>
                )}

                {/* PRIVACY & DATA */}

                {activeTab === "privacy" && (
                  <div className="anp-v2-section">
                    <SectionHeading
                      title="Privacy & Data"
                      description="Review available data controls for your AdvocaNote account."
                    />

                    <div className="anp-v2-feature-row">
                      <div>
                        <strong>
                          Download Profile Data
                        </strong>

                        <p>
                          Export your account and
                          professional profile
                          as a JSON file.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="anp-v2-outline-button"
                        onClick={downloadProfile}
                        disabled={exporting}
                      >
                        <Download size={16} />

                        {exporting
                          ? "Exporting..."
                          : "Download"}
                      </button>
                    </div>


                    <div className="anp-v2-feature-row anp-v2-delete-row">
                      <div>
                        <strong>
                          Delete Account
                        </strong>

                        <p>
                          View the account
                          deletion status
                          and requirements.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="anp-v2-delete-button"
                        onClick={() =>
                          setDialog("delete")
                        }
                      >
                        <Trash2 size={16} />

                        Delete Account
                      </button>
                    </div>

                    <p className="anp-v2-footnote">
                      Profile export does not
                      include legal diary entries,
                      cases, hearings, tasks
                      or other records.
                    </p>
                  </div>
                )}

              </div>
              {/* END TAB PANEL */}

            </div>
            {/* END MAIN SETTINGS */}

          </div>
          /* END PROFILE SHELL */
        )}

        {/* DELETE ACCOUNT INFORMATION */}

        {dialog === "delete" && (
          <div
            className="anp-v2-modal-backdrop"
            onClick={() =>
              setDialog("")
            }
          >
            <div
              className="anp-v2-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="anp-v2-delete-title"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                className="anp-v2-modal-close"
                aria-label="Close dialog"
                onClick={() =>
                  setDialog("")
                }
              >
                <X size={20} />
              </button>

              <Trash2 size={27} />

              <h2 id="anp-v2-delete-title">
                Delete Account
              </h2>

              <p>
                Permanent account deletion
                is not available yet.
                Your account has not
                been deleted.
              </p>

              <p>
                This feature requires
                identity verification,
                legal data retention checks
                and safe handling of
                related case records.
              </p>

              <button
                type="button"
                className="anp-v2-save"
                onClick={() =>
                  setDialog("")
                }
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
