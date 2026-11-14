
import React, { useEffect, useState } from "react";

import {
    X,
    ChevronLeft,
    ArrowRight,
    UserRound,
    BriefcaseBusiness,
    Bell,
    MapPin,
    Phone,
    Check,
    ShieldCheck,
} from "lucide-react";

import { CheckCircle2 } from "lucide-react";

import {
    getMyOnboarding,
    completeMyOnboarding,
    skipMyOnboarding,
} from "../services/onboardingApi";

import "./FirstLoginOnboarding.css";

const PRACTICE_AREAS = [
    "Civil Law",
    "Criminal Law",
    "Family Law",
    "Land Law",
    "Commercial Law",
    "Labour Law",
    "Other",
];

const EMPTY_FORM = {
    phone: "",
    location: "",
    barNumber: "",
    practiceAreas: [],
    language: "English",
    hearingReminders: true,
    taskReminders: true,
    emailNotifications: true,
};

export default function FirstLoginOnboarding({ user }) {
    const [isOpen, setIsOpen] = useState(false);
    const [checking, setChecking] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState(EMPTY_FORM);
    const [completed, setCompleted] = useState(false);

    // =====================================
    // CHECK DATABASE ON FIRST LOGIN
    // =====================================

    useEffect(() => {
        let cancelled = false;

        async function checkOnboarding() {
            try {
                const data = await getMyOnboarding();

                if (cancelled) return;

                const profile = data.profile || {};
                const notifications =
                    profile.notification_preferences || {};

                setForm({
                    phone: profile.phone || "",
                    location: profile.location || "",
                    barNumber: profile.bar_number || "",
                    practiceAreas: profile.practice_areas || [],
                    language: profile.preferred_language || "English",
                    hearingReminders:
                        notifications.hearing_reminders ?? true,
                    taskReminders:
                        notifications.task_reminders ?? true,
                    emailNotifications:
                        notifications.email_notifications ?? true,
                });

                setIsOpen(
                    data.onboarding_status === "pending" &&
                    data.should_show_onboarding === true
                );

            } catch (err) {
                if (!cancelled) {
                    console.error(
                        "Unable to load onboarding:",
                        err
                    );

                    setLoadError(
                        err.message ||
                        "Unable to check your profile."
                    );
                }
            } finally {
                if (!cancelled) {
                    setChecking(false);
                }
            }
        }

        checkOnboarding();

        return () => {
            cancelled = true;
        };
    }, []);

    // =====================================
    // PREVENT BACKGROUND SCROLL
    // =====================================

    useEffect(() => {
        if (!isOpen) return;

        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previous;
        };
    }, [isOpen]);

    // =====================================
    // FORM HELPERS
    // =====================================

    function updateField(name, value) {
        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    function togglePractice(area) {
        setForm((previous) => ({
            ...previous,
            practiceAreas: previous.practiceAreas.includes(area)
                ? previous.practiceAreas.filter(
                    (item) => item !== area
                )
                : [...previous.practiceAreas, area],
        }));
    }

    // =====================================
    // SKIP - SAVE IN DATABASE
    // =====================================

    async function handleSkip() {
        if (saving) return;

        setSaving(true);
        setError("");

        try {
            await skipMyOnboarding();

            setIsOpen(false);
        } catch (err) {
            setError(
                err.message || "Unable to skip setup."
            );
        } finally {
            setSaving(false);
        }
    }

    // =====================================
    // FINISH - SAVE IN DATABASE
    // =====================================

    async function handleFinish() {
        if (saving) return;

        setSaving(true);
        setError("");

        try {
            const details = {
                phone: form.phone.trim() || null,
                location: form.location.trim() || null,
                bar_number: form.barNumber.trim() || null,
                practice_areas: form.practiceAreas,
                preferred_language: form.language,

                notification_preferences: {
                    hearing_reminders: form.hearingReminders,
                    task_reminders: form.taskReminders,
                    email_notifications: form.emailNotifications,
                },
            };

            await completeMyOnboarding(details);

            // Show success screen after database save
            setCompleted(true);
        } catch (err) {
            setError(
                err.message || "Unable to save your profile."
            );
        } finally {
            setSaving(false);
        }
    }


    function handleNext(event) {
        event.preventDefault();
        setError("");

        if (step === 1) {
            if (
                !form.phone.trim() ||
                !form.location.trim() ||
                !form.barNumber.trim()
            ) {
                setError(
                    "Please complete all your professional details."
                );
                return;
            }

            if (form.practiceAreas.length === 0) {
                setError(
                    "Please select at least one practice area."
                );
                return;
            }

            setStep(2);
            return;
        }

        if (!form.language) {
            setError("Please select your preferred language.");
            return;
        }

        handleFinish();
    }


    if (checking || loadError) {
        return (
            <div className="an-ob-overlay">
                <section
                    className="an-ob-modal"
                    style={{
                        padding: "35px",
                        textAlign: "center",
                    }}
                >
                    {checking ? (
                        <p>Checking your profile...</p>
                    ) : (
                        <>
                            <h2>Unable to verify your profile</h2>

                            <p role="alert">{loadError}</p>

                            <button
                                type="button"
                                className="an-ob-continue"
                                onClick={() => window.location.reload()}
                            >
                                Retry
                            </button>
                        </>
                    )}
                </section>
            </div>
        );
    }


    if (!isOpen) return null;


    if (completed) {
        return (
            <div className="an-ob-overlay">
                <section
                    className="an-ob-modal an-ob-success-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="onboarding-success-title"
                >
                    <div className="an-ob-success-content">

                        <div className="an-ob-success-icon">
                            <CheckCircle2
                                size={42}
                                strokeWidth={1.7}
                            />
                        </div>

                        <span className="an-ob-success-label">
                            SETUP COMPLETED
                        </span>

                        <h2 id="onboarding-success-title">
                            You're All Set!
                        </h2>

                        <p className="an-ob-success-description">
                            Your professional profile has been
                            successfully created.

                            Welcome to AdvocaNote! Your legal
                            workspace is ready to use.
                        </p>

                        <div className="an-ob-success-details">
                            <CheckCircle2 size={17} />

                            <span>
                                Profile information saved successfully
                            </span>
                        </div>

                        <button
                            type="button"
                            className="an-ob-success-button"
                            onClick={() => {
                                window.location.assign(
                                    "/my-legal-diary"
                                );
                            }}
                        >
                            Go to My Legal Diary

                            <ArrowRight size={18} />
                        </button>

                        <p className="an-ob-success-footer">
                            Manage cases, hearings, tasks and
                            your legal diary in one place.
                        </p>

                    </div>
                </section>
            </div>
        );
    }


    const lawyerName =
        user?.full_name ||
        user?.fullName ||
        user?.name ||
        "Lawyer";

    return (
        <div className="an-ob-overlay">
            <section
                className="an-ob-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="an-ob-title"
            >

                {/* CLOSE */}

                <button
                    type="button"
                    className="an-ob-close"
                    onClick={handleSkip}
                    disabled={saving}
                    aria-label="Skip profile setup"
                >
                    <X size={20} />
                </button>

                {/* HEADER */}

                <div className="an-ob-header">
                    <div className="an-ob-brand-mark">
                        <BriefcaseBusiness size={25} />
                    </div>

                    <p className="an-ob-brand">
                        ADVOCANOTE
                    </p>

                    <h2 id="an-ob-title">
                        Welcome to AdvocaNote!
                    </h2>

                    <p className="an-ob-subtitle">
                        Complete a few details to personalize
                        your legal workspace.
                    </p>

                    <div className="an-ob-progress">
                        <div className="an-ob-progress-line active" />

                        <div
                            className={`an-ob-progress-line ${step === 2 ? "active" : ""
                                }`}
                        />
                    </div>

                    <span className="an-ob-step-label">
                        Step {step} of 2
                    </span>
                </div>

                <form onSubmit={handleNext}>

                    {/* STEP 1 - PROFESSIONAL DETAILS */}

                    {step === 1 && (
                        <div className="an-ob-body">

                            <div className="an-ob-section-heading">
                                <UserRound size={19} />

                                <div>
                                    <h3>Your Professional Details</h3>
                                    <p>
                                        Tell us a little about your practice.
                                    </p>
                                </div>
                            </div>

                            <div className="an-ob-welcome-name">
                                <span>Registered Lawyer</span>
                                <strong>{lawyerName}</strong>
                            </div>

                            <div className="an-ob-fields">

                                <label className="an-ob-field">
                                    <span>
                                        <Phone size={14} />
                                        Phone Number
                                    </span>

                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={(event) =>
                                            updateField(
                                                "phone",
                                                event.target.value
                                            )
                                        }
                                        placeholder="+94 77 123 4567"
                                    />
                                </label>

                                <label className="an-ob-field">
                                    <span>
                                        <MapPin size={14} />
                                        City / Location
                                    </span>

                                    <input
                                        type="text"
                                        value={form.location}
                                        onChange={(event) =>
                                            updateField(
                                                "location",
                                                event.target.value
                                            )
                                        }
                                        placeholder="e.g. Colombo, Sri Lanka"
                                    />
                                </label>

                                <label className="an-ob-field">
                                    <span>Bar / Enrollment Number</span>

                                    <input
                                        type="text"
                                        value={form.barNumber}
                                        onChange={(event) =>
                                            updateField(
                                                "barNumber",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Optional"
                                    />
                                </label>

                            </div>

                            <div className="an-ob-practice">
                                <h4>Practice Areas</h4>

                                <p>
                                    Select the areas you usually work in.
                                </p>

                                <div className="an-ob-practice-list">
                                    {PRACTICE_AREAS.map((area) => {
                                        const selected =
                                            form.practiceAreas.includes(area);

                                        return (
                                            <button
                                                key={area}
                                                type="button"
                                                aria-pressed={selected}
                                                className={`an-ob-practice-chip ${selected ? "selected" : ""
                                                    }`}
                                                onClick={() =>
                                                    togglePractice(area)
                                                }
                                            >
                                                {selected && <Check size={13} />}
                                                {area}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>
                    )}

                    {/* STEP 2 - APP PREFERENCES */}

                    {step === 2 && (
                        <div className="an-ob-body">

                            <div className="an-ob-section-heading">
                                <Bell size={19} />

                                <div>
                                    <h3>Personalize Your Workspace</h3>
                                    <p>
                                        Choose your preferred settings.
                                    </p>
                                </div>
                            </div>

                            <label className="an-ob-field">
                                <span>Preferred Language</span>

                                <select
                                    value={form.language}
                                    onChange={(event) =>
                                        updateField(
                                            "language",
                                            event.target.value
                                        )
                                    }
                                >
                                    <option value="English">
                                        English
                                    </option>

                                    <option value="Tamil">
                                        Tamil
                                    </option>

                                    <option value="Sinhala">
                                        Sinhala
                                    </option>
                                </select>
                            </label>

                            <div className="an-ob-notifications">
                                <h4>Notification Preferences</h4>

                                <label className="an-ob-notification-row">
                                    <div>
                                        <strong>Hearing Reminders</strong>
                                        <small>
                                            Important upcoming court dates
                                        </small>
                                    </div>

                                    <input
                                        type="checkbox"
                                        checked={form.hearingReminders}
                                        onChange={(event) =>
                                            updateField(
                                                "hearingReminders",
                                                event.target.checked
                                            )
                                        }
                                    />
                                </label>

                                <label className="an-ob-notification-row">
                                    <div>
                                        <strong>
                                            Task Deadline Reminders
                                        </strong>
                                        <small>
                                            Pending tasks and due dates
                                        </small>
                                    </div>

                                    <input
                                        type="checkbox"
                                        checked={form.taskReminders}
                                        onChange={(event) =>
                                            updateField(
                                                "taskReminders",
                                                event.target.checked
                                            )
                                        }
                                    />
                                </label>

                                <label className="an-ob-notification-row">
                                    <div>
                                        <strong>Email Notifications</strong>
                                        <small>
                                            Important account updates
                                        </small>
                                    </div>

                                    <input
                                        type="checkbox"
                                        checked={form.emailNotifications}
                                        onChange={(event) =>
                                            updateField(
                                                "emailNotifications",
                                                event.target.checked
                                            )
                                        }
                                    />
                                </label>

                            </div>

                            <div className="an-ob-privacy-note">
                                <ShieldCheck size={17} />

                                <p>
                                    You can update these details later
                                    from your Profile page.
                                </p>
                            </div>

                        </div>
                    )}

                    {/* ERROR MESSAGE */}

                    {error && (
                        <p className="an-ob-error" role="alert">
                            {error}
                        </p>
                    )}

                    {/* FOOTER */}

                    <div className="an-ob-footer">

                        <div className="an-ob-footer-right">

                            {step === 2 && (
                                <button
                                    type="button"
                                    className="an-ob-back"
                                    onClick={() => setStep(1)}
                                    disabled={saving}
                                >
                                    <ChevronLeft size={17} />
                                    Back
                                </button>
                            )}

                            <button
                                type="submit"
                                className="an-ob-continue"
                                disabled={saving}
                            >
                                {saving
                                    ? "Saving..."
                                    : step === 1
                                        ? "Continue"
                                        : "Finish Setup"}

                                {!saving && <ArrowRight size={17} />}
                            </button>

                        </div>
                    </div>

                </form>
            </section>
        </div>
    );
}
