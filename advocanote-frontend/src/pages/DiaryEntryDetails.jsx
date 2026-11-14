
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft, Bell, ChevronDown, FileText, History,
    Layers, LogOut, Menu, Pencil, Plus, Printer, Search,
    UserRound, X,
} from "lucide-react";
import {
  useLawyerLayout,
  LawyerTopbarPortal,
  LawyerTopbarAvatar,
} from "../components/LawyerLayout";

import { logoutUser } from "../services/auth";

import {
    getCaseDiaryHistory,
    getDiaryEntryDetails,
    getDiaryOverview,
    updateDiaryEntry,
} from "../services/diary";

import "./DiaryEntryDetails.css";

const todayISO = () => {
    const d = new Date();

    return `${d.getFullYear()}-${String(
        d.getMonth() + 1
    ).padStart(2, "0")}-${String(
        d.getDate()
    ).padStart(2, "0")}`;
};

const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(
        `${String(value).slice(0, 10)}T12:00:00`
    );

    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
};

const editableDraft = (item) => ({
    previous_date: item.previousDate || "",
    next_date: item.nextDate || "",
    step_type: item.stepType || "Other",
    step_notes: item.note || "",
    point_notes: item.pointNotes || "",
});

function InfoField({ label, value }) {
    return (
        <div className="ded-field">
            <span>{label}</span>
            <strong>{value || "—"}</strong>
        </div>
    );
}

export default function DiaryEntryDetails() {
    const { entryId } = useParams();

    const navigate = useNavigate();
    const location = useLocation();

    const { user, openSidebar } = useLawyerLayout();

    const historyRef = useRef(null);
    const searchRef = useRef(null);

    const [entry, setEntry] = useState(null);
    const [history, setHistory] = useState([]);

    const [entryPosition, setEntryPosition] = useState(0);
    const [totalEntries, setTotalEntries] = useState(0);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [historyError, setHistoryError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    const [search, setSearch] = useState("");

    const [bellOpen, setBellOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState("");

    // Load selected entry and its case history
    useEffect(() => {
        if (!entryId) return;

        let active = true;

        setLoading(true);
        setError("");
        setHistoryError("");

        async function load() {
            try {
                const result = await getDiaryEntryDetails(entryId);

                if (!active) return;

                setEntry(result.entry);
                setEntryPosition(result.entryPosition || 0);
                setTotalEntries(result.totalEntries || 0);

                try {
                    const items = await getCaseDiaryHistory(
                        result.entry.caseId
                    );

                    if (active) {
                        const historyItems = Array.isArray(items)
                            ? items
                            : items?.entries || items?.history || [];

                        setHistory(Array.isArray(historyItems) ? historyItems : []);
                    }
                } catch (reason) {
                    if (active) {
                        setHistory([]);
                        setHistoryError(
                            reason.message || "Could not load case history."
                        );
                    }
                }
            } catch (reason) {
                if (active) {
                    setEntry(null);
                    setHistory([]);
                    setError(
                        reason.message || "Could not load diary entry."
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        load();

        return () => {
            active = false;
        };
    }, [entryId, refreshKey]);

    // Existing reminder API
    useEffect(() => {
        let active = true;

        getDiaryOverview(todayISO())
            .then((result) => {
                if (active) {
                    setNotifications(result.notifications || []);
                }
            })
            .catch(() => {
                if (active) setNotifications([]);
            });

        return () => {
            active = false;
        };
    }, []);

    // Existing Ctrl + K shortcut
    useEffect(() => {
        const handleShortcut = (event) => {
            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "k"
            ) {
                event.preventDefault();
                searchRef.current?.focus();
            }

            if (event.key === "Escape" && !saving) {
                setEditing(false);
                setProfileOpen(false);
                setBellOpen(false);
            }
        };

        window.addEventListener("keydown", handleShortcut);

        return () =>
            window.removeEventListener("keydown", handleShortcut);
    }, [saving]);

    // Chronological case diary history
    const orderedHistory = useMemo(
        () =>
            [...history].sort(
                (a, b) =>
                    (a.entryDate || "").localeCompare(
                        b.entryDate || ""
                    ) || a.id - b.id
            ),
        [history]
    );

    const visibleHistory = useMemo(() => {
        const query = search.trim().toLowerCase();

        return orderedHistory.filter(
            (item) =>
                !query ||
                `${item.caseNo} ${item.court} ${item.note} ${item.entryDate}`
                    .toLowerCase()
                    .includes(query)
        );
    }, [orderedHistory, search]);

    const fullName = user?.full_name || "Lawyer";

    const initials = fullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();

    // Return to originally selected diary date
    const goBack = () =>
        navigate(
            `/my-legal-diary?date=${encodeURIComponent(
                location.state?.returnDate ||
                entry?.entryDate ||
                todayISO()
            )}`
        );

    const logout = async () => {
        try {
            await logoutUser();
        } catch (reason) {
            console.error("Logout failed", reason);
        } finally {
            sessionStorage.removeItem(
                "advocanote_access_token"
            );
            sessionStorage.removeItem(
                "advocanote_refresh_token"
            );

            navigate("/login", { replace: true });
        }
    };

    // Edit selected entry
    const startEdit = () => {
        if (!entry) return;

        setDraft(editableDraft(entry));
        setEditError("");
        setEditing(true);
    };

    const saveEdit = async (event) => {
        event.preventDefault();

        if (!draft || saving || !entry) return;

        if (!draft.step_notes.trim()) {
            setEditError("Court proceedings cannot be empty.");
            return;
        }

        setSaving(true);
        setEditError("");

        try {
            const result = await updateDiaryEntry(entry.id, {
                previous_date: draft.previous_date || null,
                next_date: draft.next_date || null,
                step_type: draft.step_type,
                step_notes: draft.step_notes.trim(),
                point_notes: draft.point_notes.trim() || null,
            });

            console.log("Diary Entry Updated:", result);

            setEditing(false);
            setRefreshKey((key) => key + 1);

        } catch (error) {
            console.error("Diary Entry Save Error:", error);

            setEditError(
                error.message || "Failed to save diary entry."
            );
        } finally {
            setSaving(false);
        }
    };

    // Select another entry from this case
    const navigateEntry = (id) => {
        if (id === entry?.id) return;

        setSearch("");

        navigate(`/diary-entry-details/${id}`, {
            state: {
                returnDate:
                    location.state?.returnDate || entry?.entryDate,
            },
        });
    };

    const showHistory = () => {
        setSearch("");

        historyRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });

        historyRef.current?.focus({
            preventScroll: true,
        });
    };

    return (
        <>
            {/* EXISTING SHARED TOPBAR */}
            <LawyerTopbarPortal>
                <button
                    type="button"
                    className="ald-mobile-menu"
                    onClick={openSidebar}
                    aria-label="Open sidebar"
                >
                    <Menu size={24} />
                </button>

                <div className="ald-global-search">
                    <Search size={22} />

                    <input
                        ref={searchRef}
                        value={search}
                        onChange={(event) =>
                            setSearch(event.target.value)
                        }
                        placeholder="Search this case's diary history..."
                        aria-label="Search case diary history"
                    />
                </div>

                <div className="ald-topbar-actions">
                        <NotificationBell />

                    <div className="ald-topbar-divider" />

                    <div className="ald-dropdown-holder">
                        <button
                            type="button"
                            className="ald-account"
                            aria-expanded={profileOpen}
                            onClick={() => {
                                setProfileOpen(!profileOpen);
                                setBellOpen(false);
                            }}
                        >
                            <LawyerTopbarAvatar />

                            <span className="ald-account-text">
                                <strong>{fullName}</strong>
                                <small>Attorney-at-Law</small>
                            </span>

                            <ChevronDown size={18} />
                        </button>

                        {profileOpen && (
                            <div className="ald-top-popover ald-account-popover">
                                <button
                                    type="button"
                                    onClick={() => navigate("/profile")}
                                >
                                    <UserRound size={16} />
                                    My Profile
                                </button>

                                <button
                                    type="button"
                                    onClick={logout}
                                >
                                    <LogOut size={16} />
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </LawyerTopbarPortal>

            {/* DIARY ENTRY DETAILS PAGE */}
            <main className="ald-main ded-page">
                <div className="ded-heading">
                    <div className="ded-heading-main">
                        <button
                            type="button"
                            className="ded-back"
                            onClick={goBack}
                        >
                            <ArrowLeft size={18} />
                            Back to My Legal Diary
                        </button>

                        <div>
                            <h1>Diary Entry Details</h1>
                            <p>
                                Full details of the selected diary entry.
                            </p>
                        </div>
                    </div>

                    {entry && (
                        <div className="ded-position">
                            <strong>
                                Entry {entryPosition} of {totalEntries}
                            </strong>
                            <small>{entry.caseNo}</small>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="ded-message">
                        Loading diary entry details...
                    </div>
                ) : error ? (
                    <div className="ded-message" role="alert">
                        {error}

                        <button type="button" onClick={goBack}>
                            Back to My Legal Diary
                        </button>
                    </div>
                ) : entry && (
                    <div className="ded-layout">
                        {/* LEFT SIDE */}
                        <div className="ded-primary">
                            <section className="ded-card">
                                <h2 className="ded-card-title">
                                    <FileText size={22} />
                                    Case Information
                                </h2>

                                <div className="ded-info-grid">
                                    <InfoField
                                        label="Case No."
                                        value={entry.caseNo}
                                    />

                                    <InfoField
                                        label="Court"
                                        value={[
                                            entry.court,
                                            entry.location,
                                        ]
                                            .filter(Boolean)
                                            .join(" – ")}
                                    />

                                    <InfoField
                                        label="Diary Date"
                                        value={formatDate(entry.entryDate)}
                                    />

                                    <InfoField
                                        label="Previous Date"
                                        value={formatDate(entry.previousDate)}
                                    />

                                    <InfoField
                                        label="Next Date"
                                        value={formatDate(entry.nextDate)}
                                    />

                                    <div className="ded-field">
                                        <span>Case Status</span>

                                        <strong>
                                            <em className="ded-status">
                                                {entry.caseStatus || "Not set"}
                                            </em>
                                        </strong>
                                    </div>
                                </div>
                            </section>

                            {/* COMPLETE COURT PROCEEDINGS */}
                            <section className="ded-card">
                                <h2 className="ded-card-title">
                                    <FileText size={22} />
                                    Step – Full Court Proceedings
                                </h2>

                                <div className="ded-proceedings">
                                    {entry.note ||
                                        "No proceedings recorded."}
                                </div>

                                {entry.pointNotes && (
                                    <div className="ded-points">
                                        <h3>Point-wise Notes</h3>

                                        <div className="ded-proceedings">
                                            {entry.pointNotes}
                                        </div>
                                    </div>
                                )}

                                <div className="ded-actions">
                                    <button
                                        type="button"
                                        className="ded-button ded-button-primary"
                                        onClick={startEdit}
                                    >
                                        <Pencil size={18} />
                                        Edit Entry
                                    </button>

                                    <button
                                        type="button"
                                        className="ded-button ded-button-secondary"
                                        onClick={() => window.print()}
                                    >
                                        <Printer size={19} />
                                        Print Entry
                                    </button>
                                </div>
                            </section>
                        </div>

                        {/* RIGHT SIDE - REAL CASE HISTORY */}
                        <aside
                            className="ded-card ded-history"
                            ref={historyRef}
                            tabIndex={-1}
                            aria-label="This case diary history"
                        >
                            <h2 className="ded-history-title">
                                <Layers size={22} />
                                This Case – Diary History
                            </h2>

                            <p className="ded-history-subtitle">
                                All diary entries for {entry.caseNo}
                            </p>

                            {historyError && (
                                <p role="alert" className="ded-error">
                                    {historyError}
                                </p>
                            )}

                            {!historyError &&
                                visibleHistory.length === 0 && (
                                    <p className="ded-empty">
                                        {search
                                            ? "No matching entries."
                                            : "No diary history found."}
                                    </p>
                                )}

                            <div className="ded-timeline">
                                {visibleHistory.map((item) => {
                                    const position =
                                        orderedHistory.findIndex(
                                            (record) => record.id === item.id
                                        ) + 1;

                                    return (
                                        <button
                                            type="button"
                                            key={item.id}
                                            className={`ded-history-item ${item.id === entry.id
                                                ? "ded-history-active"
                                                : ""
                                                }`}
                                            onClick={() =>
                                                navigateEntry(item.id)
                                            }
                                        >
                                            <span className="ded-dot" />

                                            <span className="ded-history-body">
                                                <span className="ded-history-heading">
                                                    <strong>Entry {position}</strong>

                                                    <b>
                                                        {formatDate(item.entryDate)}
                                                    </b>
                                                </span>

                                                <span className="ded-history-note">
                                                    {item.note ||
                                                        "No proceedings recorded."}
                                                </span>

                                                <small>
                                                    Next Date:{" "}
                                                    {formatDate(item.nextDate)}
                                                </small>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                type="button"
                                className="ded-button ded-button-add"
                                onClick={() =>
                                    navigate(
                                        `/add-diary-entry?date=${encodeURIComponent(
                                            entry.entryDate
                                        )}`
                                    )
                                }
                            >
                                <Plus size={19} />
                                Add Another Diary Entry
                            </button>
                        </aside>
                    </div>
                )}
            </main>

            {/* EDIT ENTRY - EXISTING BACKEND UPDATE API */}
            {editing && draft && (
                <div
                    className="ded-edit-backdrop"
                    onMouseDown={(event) => {
                        if (
                            event.target === event.currentTarget &&
                            !saving
                        ) {
                            setEditing(false);
                        }
                    }}
                >
                    <section
                        className="ded-edit-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Edit diary entry"
                    >
                        <div className="ded-edit-head">
                            <h2>Edit Diary Entry</h2>

                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => setEditing(false)}
                                aria-label="Close edit"
                            >
                                <X size={21} />
                            </button>
                        </div>

                        <p>Case {entry?.caseNo}</p>

                        <form
                            onSubmit={saveEdit}
                            className="ded-edit-form"
                        >
                            <label>
                                Previous Date
                                <input
                                    type="date"
                                    value={draft.previous_date}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            previous_date: event.target.value,
                                        })
                                    }
                                />
                            </label>

                            <label>
                                Next Date
                                <input
                                    type="date"
                                    value={draft.next_date}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            next_date: event.target.value,
                                        })
                                    }
                                />
                            </label>

                            <label>
                                Step
                                <select
                                    value={draft.step_type}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            step_type: event.target.value,
                                        })
                                    }
                                >
                                    {[
                                        "Evidence",
                                        "Submissions",
                                        "Settlement",
                                        "Other",
                                    ].map((value) => (
                                        <option key={value} value={value}>
                                            {value}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                Court Proceedings
                                <textarea
                                    rows={6}
                                    required
                                    value={draft.step_notes}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            step_notes: event.target.value,
                                        })
                                    }
                                />
                            </label>

                            <label>
                                Point-wise Notes (Optional)
                                <textarea
                                    rows={4}
                                    value={draft.point_notes}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            point_notes: event.target.value,
                                        })
                                    }
                                />
                            </label>

                            {editError && (
                                <p className="ded-error" role="alert">
                                    {editError}
                                </p>
                            )}

                            <div className="ded-edit-actions">
                                <button
                                    type="button"
                                    className="ded-button ded-button-secondary"
                                    disabled={saving}
                                    onClick={() => setEditing(false)}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="ded-button ded-button-primary"
                                    disabled={saving}
                                >
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </>
    );
}
