

import { useEffect, useMemo, useState } from "react";


import {
  ArrowDownUp,
  CalendarDays,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  Folder,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";


import "./CaseDetails.css";
import DiaryVoiceDetails from "../components/DiaryVoiceDetails";
import "./DiaryEntryDetails.css";
import CaseTasks from "./CaseTasks";
import { getHearings } from "../services/diary";


const textOf = (value) => String(value ?? "").trim();

const toPoints = (value) =>
  String(value ?? "")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `• ${part}`)
    .join("\n");

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(
    `${String(value).slice(0, 10)}T12:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatLongDate = (value) => {
  if (!value) return "—";

  const date = new Date(
    `${String(value).slice(0, 10)}T12:00:00`
  );

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatWeekday = (value) => {
  if (!value) return "";

  const date = new Date(
    `${String(value).slice(0, 10)}T12:00:00`
  );

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB", {
    weekday: "long",
  });
};

const entryDate = (entry) =>
  entry.entry_date ||
  entry.entryDate ||
  entry.previous_date;

const entryNotes = (entry) =>
  textOf(
    entry.step_notes ||
    entry.note ||
    entry.proceedings ||
    entry.court_proceedings
  );

const entryNextDate = (entry) =>
  entry.next_date || entry.nextDate;

export default function CaseDetails({
  caseData,
  history = [],
  historyLoading = false,
  historyError = "",
  hearings = [],
  nextHearing = "",
  onBack,
  onAddDiary,
  onEditEntry,
  onDeleteEntry,
  onCloseCase,
  onHearingsChanged,
}) {
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [latestFirst, setLatestFirst] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [viewEntry, setViewEntry] = useState(null);

  const [closingCase, setClosingCase] = useState(false);
  const [closeCaseError, setCloseCaseError] = useState("");
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Hearings tab - Search, Sort, Pagination

  const [hearingQuery, setHearingQuery] = useState("");
  const [hearingLatestFirst, setHearingLatestFirst] =
    useState(false);
  const [hearingPage, setHearingPage] = useState(1);

  // RESCHEDULE HEARING

  const [localHearings, setLocalHearings] = useState(null);

  const [rescheduleTarget, setRescheduleTarget] =
    useState(null);

  const [newHearingDate, setNewHearingDate] =
    useState("");

  const [rescheduleReason, setRescheduleReason] =
    useState("");

  const [rescheduleSaving, setRescheduleSaving] =
    useState(false);

  const [rescheduleError, setRescheduleError] =
    useState("");

  useEffect(() => {
    setLocalHearings(null);
  }, [hearings]);

  const shownHearings = localHearings ?? hearings;

  const startRescheduling = (hearing) => {
    if (
      String(hearing.status).toLowerCase() !== "scheduled"
    ) {
      return;
    }

    setRescheduleTarget(hearing);
    setNewHearingDate("");
    setRescheduleReason("");
    setRescheduleError("");
  };

  const saveReschedule = async (event) => {
    event.preventDefault();

    if (!rescheduleTarget || rescheduleSaving) {
      return;
    }

    if (
      !newHearingDate ||
      newHearingDate <= rescheduleTarget.hearing_date
    ) {
      setRescheduleError(
        "New date must be after the original hearing date."
      );
      return;
    }

    if (rescheduleReason.trim().length < 3) {
      setRescheduleError(
        "Please enter a reason for postponement."
      );
      return;
    }

    setRescheduleSaving(true);
    setRescheduleError("");

    try {
      const API_BASE = (
        import.meta.env.VITE_API_BASE_URL ||
        "http://127.0.0.1:8000"
      ).replace(/\/$/, "");

      const token = sessionStorage.getItem(
        "advocanote_access_token"
      );

      const response = await fetch(
        `${API_BASE}/hearings/${rescheduleTarget.id}/reschedule`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token
              ? { Authorization: `Bearer ${token}` }
              : {}),
          },
          body: JSON.stringify({
            new_date: newHearingDate,
            reason: rescheduleReason.trim(),
          }),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof result?.detail === "string"
            ? result.detail
            : "Could not reschedule hearing."
        );
      }

      const updatedHearings = await getHearings();

      if (!Array.isArray(updatedHearings)) {
        throw new Error(
          "Hearing saved, but updated hearing data could not be loaded."
        );
      }

      setLocalHearings(updatedHearings);

      onHearingsChanged?.(updatedHearings);

      setRescheduleTarget(null);
      setHearingPage(1);
    } catch (error) {
      setRescheduleError(
        error.message || "Unable to reschedule hearing."
      );
    } finally {
      setRescheduleSaving(false);
    }
  };


  const [editingEntry, setEditingEntry] = useState(null);

  const [editDraft, setEditDraft] = useState({
    step_type: "",
    step_notes: "",
    previous_date: "",
    next_date: "",
    point_notes: "",
  });

  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [pointNotesManuallyEdited, setPointNotesManuallyEdited] =
    useState(false);


  // Open Edit popup

  const startEditing = (entry) => {
    setPointNotesManuallyEdited(false);
    setEditingEntry(entry);

    setEditDraft({
      step_type: textOf(entry.stepType || entry.step_type),
      step_notes: entryNotes(entry),
      previous_date: String(
        entry.previousDate || entry.previous_date || ""
      ).slice(0, 10),
      next_date: String(
        entry.nextDate || entry.next_date || ""
      ).slice(0, 10),
      point_notes: textOf(
        entry.pointNotes || entry.point_notes
      ),
    });

    setEditError("");
  };


  // Save edited diary entry

  const saveEditedEntry = async (event) => {
    event.preventDefault();

    if (!editDraft.step_type.trim()) {
      setEditError("Step Type is required.");
      return;
    }

    if (!editDraft.step_notes.trim()) {
      setEditError("Court proceedings are required.");
      return;
    }

    setEditSaving(true);
    setEditError("");

    try {
      await onEditEntry(editingEntry, {
        previous_date: editDraft.previous_date || null,
        next_date: editDraft.next_date || null,
        step_type: editDraft.step_type.trim(),
        step_notes: editDraft.step_notes.trim(),
        point_notes: editDraft.point_notes.trim() || null,
      });

      setEditingEntry(null);
    } catch (error) {
      setEditError(
        error.message || "Could not update diary entry."
      );
    } finally {
      setEditSaving(false);
    }
  };

  const caseNumber =
    textOf(caseData?.case_number || caseData?.caseNo) || "—";

  const caseTitle =
    textOf(caseData?.case_title || caseData?.caseTitle) ||
    "Untitled Case";

  const court =
    textOf(
      caseData?.court_name ||
      caseData?.court?.court_name
    ) || "—";

  const location = textOf(
    caseData?.location || caseData?.court?.location
  );

  const status =
    textOf(
      caseData?.status || caseData?.case_status
    ) || "Not set";

  const matchingHearings = useMemo(
    () =>
      shownHearings.filter(
        (h) =>
          (caseData?.id != null &&
            String(h.case_id) === String(caseData.id)) ||
          (textOf(h.case_number) &&
            textOf(h.case_number) === caseNumber)
      ),
    [shownHearings, caseData?.id, caseNumber]
  );

  // HEARINGS - SEARCH, SORT AND PAGINATION

  const hearingRows = useMemo(() => {
    const q = hearingQuery.trim().toLowerCase();

    return matchingHearings
      .filter((hearing) => {
        const values = [
          hearing.hearing_date,
          hearing.court,
          hearing.court_name,
          hearing.location,
          hearing.purpose,
          hearing.notes,
          hearing.description,
          hearing.status,
        ];

        return (
          !q ||
          values.some((value) =>
            textOf(value).toLowerCase().includes(q)
          )
        );
      })
      .sort((a, b) => {
        const dateA = textOf(a.hearing_date);
        const dateB = textOf(b.hearing_date);

        return hearingLatestFirst
          ? dateB.localeCompare(dateA)
          : dateA.localeCompare(dateB);
      });
  }, [matchingHearings, hearingQuery, hearingLatestFirst]);

  const HEARING_PAGE_SIZE = 5;

  const hearingPages = Math.max(
    1,
    Math.ceil(hearingRows.length / HEARING_PAGE_SIZE)
  );

  const currentHearingPage = Math.min(
    hearingPage,
    hearingPages
  );

  const hearingStart =
    (currentHearingPage - 1) * HEARING_PAGE_SIZE;

  const visibleHearings = hearingRows.slice(
    hearingStart,
    hearingStart + HEARING_PAGE_SIZE
  );

  const firstHearingItem = hearingRows.length
    ? hearingStart + 1
    : 0;

  const lastHearingItem = Math.min(
    hearingStart + HEARING_PAGE_SIZE,
    hearingRows.length
  );

  // Show actual hearing status.
  // Future scheduled hearings are displayed as Upcoming.


  const hearingStatus = (hearing) => {
    return textOf(hearing.status) || "Not set";
  };


  const hearingPurpose = (hearing) =>
    textOf(
      hearing.reschedule_reason ||
      hearing.purpose ||
      hearing.notes ||
      hearing.description ||
      hearing.purpose_notes
    ) || "—";

  const diaryRows = useMemo(() => {
    const q = search.toLowerCase().trim();

    return history
      .filter(
        (entry) =>
          !q ||
          [
            entryNotes(entry),
            entryDate(entry),
            entryNextDate(entry),
            entry.court_name,
            court,
          ].some((v) =>
            textOf(v).toLowerCase().includes(q)
          )
      )
      .sort((a, b) =>
        latestFirst
          ? textOf(entryDate(b)).localeCompare(
            textOf(entryDate(a))
          )
          : textOf(entryDate(a)).localeCompare(
            textOf(entryDate(b))
          )
      );
  }, [history, search, latestFirst, court]);

  // Diary History pagination

  const HISTORY_PAGE_SIZE = 5;

  const historyPages = Math.max(
    1,
    Math.ceil(diaryRows.length / HISTORY_PAGE_SIZE)
  );

  const currentHistoryPage = Math.min(
    historyPage,
    historyPages
  );

  const historyStart =
    (currentHistoryPage - 1) * HISTORY_PAGE_SIZE;

  const visibleHistory = diaryRows.slice(
    historyStart,
    historyStart + HISTORY_PAGE_SIZE
  );

  const firstHistoryItem = diaryRows.length
    ? historyStart + 1
    : 0;

  const lastHistoryItem = Math.min(
    historyStart + HISTORY_PAGE_SIZE,
    diaryRows.length
  );

  // Latest diary entry for the selected case

  const lastDiaryEntry =
    [...history]
      .filter((entry) => entryDate(entry))
      .sort((a, b) =>
        textOf(entryDate(b)).localeCompare(
          textOf(entryDate(a))
        )
      )[0] || null;

  const lastDiaryDate = lastDiaryEntry
    ? entryDate(lastDiaryEntry)
    : "";

  const latestCourtNotes = lastDiaryEntry
    ? entryNotes(lastDiaryEntry)
    : "";

  const caseCreatedDate =
    caseData?.created_at || caseData?.createdAt || "";

  // Actual case activity only - no sample data

  const recentActivities = [];

  if (lastDiaryEntry) {
    recentActivities.push({
      type: "diary",
      date: lastDiaryEntry.created_at || lastDiaryDate,
      title: lastDiaryEntry.created_at
        ? "Diary entry added"
        : "Diary entry",
      note: latestCourtNotes,
    });
  }

  if (nextHearing) {
    recentActivities.push({
      type: "hearing",
      date: nextHearing,
      title: "Next hearing date",
      note: "",
    });
  }

  if (caseCreatedDate) {
    recentActivities.push({
      type: "created",
      date: caseCreatedDate,
      title: "Case created",
      note: "",
    });
  }

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      icon: ClipboardList,
    },
    {
      key: "history",
      label: "Diary History",
      icon: FileText,
    },
    {
      key: "hearings",
      label: "Hearings",
      icon: CalendarDays,
    },
    {
      key: "tasks",
      label: "Tasks",
      icon: Clock3,
    },
  ];

  return (
    <main className="ald-main mc-main cd-page">
      {/* PAGE HEADING */}

      <div className="cd-heading">
        <button
          type="button"
          className="cd-back"
          onClick={onBack}
        >
          <ChevronLeft size={18} />
          Back to My Cases
        </button>

        <div className="cd-heading-title">
          <h1>Case Details</h1>
          <p>
            Complete information and diary history
            for this case.
          </p>
        </div>

        <button
          type="button"
          className="cd-add"
          onClick={onAddDiary}
        >
          <Plus size={19} />
          Add Diary Entry
        </button>
      </div>

      {/* CASE SUMMARY */}

      <section className="cd-summary">
        <div className="cd-summary-left">
          <div className="cd-folder">
            <Folder size={25} />
          </div>

          <div className="cd-case-identity">
            <div className="cd-case-line">
              <h2>{caseNumber}</h2>

              <span
                className={`cd-status ${status.toLowerCase() === "active"
                  ? "cd-active"
                  : ""
                  }`}
              >
                {status}
              </span>
            </div>

            <p>
              {court}
              {location ? ` – ${location}` : ""}
            </p>

            <small>{caseTitle}</small>
          </div>
        </div>

        <div className="cd-next-hearing">
          <CalendarDays size={22} />

          <div>
            <span>Next Hearing Date</span>
            <strong>
              {formatDate(nextHearing)}
            </strong>
          </div>
        </div>
      </section>

      {/* TABS */}

      <nav
        className="cd-tabs"
        aria-label="Case details sections"
      >
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-current={
              tab === key ? "page" : undefined
            }
            className={
              tab === key
                ? "cd-tab cd-tab-active"
                : "cd-tab"
            }
          >
            <Icon size={19} />
            {label}
          </button>
        ))}
      </nav>

      {/* OVERVIEW TAB */}

      {tab === "overview" && (
        <div className="cd-overview-layout">
          {/* LEFT SIDE - CASE OVERVIEW */}

          <section className="cd-overview-card cd-overview-main">
            <div className="cd-overview-heading">
              <FileText size={22} />

              <div>
                <h2>Case Overview</h2>
                <p>Key information about this case.</p>
              </div>
            </div>

            <div className="cd-overview-table">
              {[
                ["Case No.", caseNumber],
                [
                  "Court",
                  `${court}${location ? ` – ${location}` : ""}`,
                ],
                [
                  "Case Type",
                  textOf(caseData?.case_type) || "Not set",
                ],
                ["Status", status],
                [
                  "Last Diary Entry",
                  formatDate(lastDiaryDate),
                ],
                [
                  "Next Hearing Date",
                  formatDate(nextHearing),
                ],
                [
                  "Total Diary Entries",
                  history.length,
                ],
              ].map(([label, value]) => (
                <div className="cd-overview-row" key={label}>
                  <span>{label}</span>

                  <div>
                    {label === "Status" ? (
                      <div className="cd-status-actions">
                        <span
                          className={`cd-status ${status.toLowerCase() === "active"
                            ? "cd-active"
                            : ""
                            }`}
                        >
                          {value}
                        </span>

                        {status.toLowerCase() === "active" && (

                          <button
                            type="button"
                            className="cd-status-edit"
                            title="Change Case Status"
                            aria-label="Change Case Status"
                            disabled={closingCase || !onCloseCase}
                            onClick={() => {
                              setCloseCaseError("");
                              setShowCloseConfirm(true);
                            }}
                          >
                            <Pencil size={15} />
                          </button>

                        )}
                      </div>
                    ) : (
                      <strong>{value}</strong>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {closeCaseError && (
              <p role="alert">{closeCaseError}</p>
            )}

            {/* LATEST COURT NOTES */}

            <div className="cd-overview-notes">
              <h3>
                <FileText size={19} />
                Latest Court Notes (Preview)
              </h3>

              {historyLoading ? (
                <p>Loading court notes...</p>
              ) : historyError ? (
                <p role="alert">{historyError}</p>
              ) : (
                <>
                  <p className="cd-overview-notes-text">
                    {latestCourtNotes ||
                      "No court proceedings recorded yet."}
                  </p>

                  {lastDiaryEntry && (
                    <button
                      type="button"
                      onClick={() =>
                        setViewEntry(lastDiaryEntry)
                      }
                    >
                      <Eye size={16} />
                      View Full Entry
                    </button>
                  )}
                </>
              )}
            </div>
          </section>

          {/* RIGHT SIDE */}

          <aside className="cd-overview-side">
            {/* IMPORTANT DATES */}

            <section className="cd-overview-card">
              <div className="cd-overview-heading">
                <Clock3 size={22} />

                <div>
                  <h2>Important Dates</h2>
                  <p>Key dates for this case.</p>
                </div>
              </div>

              <div className="cd-important-dates">
                <div className="cd-important-row">
                  <CalendarDays size={18} />

                  <span>Last Diary Entry</span>

                  <strong>
                    {formatDate(lastDiaryDate)}
                  </strong>
                </div>

                <div className="cd-important-row">
                  <CalendarDays size={18} />

                  <span>Next Hearing Date</span>

                  <strong>
                    {formatDate(nextHearing)}
                  </strong>
                </div>
              </div>
            </section>

            {/* RECENT ACTIVITY */}

            <section className="cd-overview-card">
              <div className="cd-overview-heading">
                <ClipboardList size={22} />

                <div>
                  <h2>Recent Activity</h2>
                  <p>Latest updates for this case.</p>
                </div>
              </div>

              {historyLoading ? (
                <p className="cd-overview-empty">
                  Loading activity...
                </p>
              ) : recentActivities.length === 0 ? (
                <p className="cd-overview-empty">
                  No activity records available yet.
                </p>
              ) : (
                <div className="cd-activity-list">
                  {recentActivities.map((activity, index) => (
                    <div
                      className="cd-activity-item"
                      key={`${activity.type}-${index}`}
                    >
                      <span
                        className={`cd-activity-dot ${index === 0
                          ? "cd-activity-dot-active"
                          : ""
                          }`}
                      />

                      <div className="cd-activity-content">
                        <strong>
                          {formatDate(activity.date)}
                        </strong>

                        <span>
                          {activity.title}
                        </span>

                        {activity.note && (
                          <p>
                            {activity.note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      )}

      {/* DIARY HISTORY TAB */}

      {tab === "history" && (
        <section className="cd-panel cd-history-panel">
          {/* HEADER */}

          <div className="cd-history-header">
            <div className="cd-history-heading">
              <FileText size={23} />

              <div>
                <h2>Diary History</h2>

                <p>
                  All court proceedings recorded for
                  this case in chronological order.
                </p>
              </div>
            </div>

            {/* SEARCH AND SORT */}

            <div className="cd-history-controls">
              <label className="cd-history-search">
                <Search size={18} />

                <input
                  type="search"
                  aria-label="Search diary entries"
                  placeholder="Search diary entries..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHistoryPage(1);
                  }}
                />
              </label>

              <button
                type="button"
                className="cd-history-sort"
                onClick={() => {
                  setLatestFirst((v) => !v);
                  setHistoryPage(1);
                }}
              >
                <ArrowDownUp size={18} />

                Sort (
                {latestFirst
                  ? "Oldest First"
                  : "Latest First"}
                )
              </button>
            </div>
          </div>

          {/* LOADING / ERROR / EMPTY STATE */}

          {historyLoading ? (
            <div className="cd-history-message">
              Loading diary history...
            </div>
          ) : historyError ? (
            <div
              className="cd-history-message"
              role="alert"
            >
              {historyError}
            </div>
          ) : !diaryRows.length ? (
            <div className="cd-history-message">
              {history.length
                ? "No matching diary entries found."
                : "No diary entries recorded for this case yet."}
            </div>
          ) : (
            <>
              {/* DESKTOP / TABLET TABLE */}

              <div className="cd-history-table-scroll">
                <table className="cd-history-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Diary Date</th>
                      <th>Court</th>
                      <th>
                        Step (Court Proceedings Preview)
                      </th>
                      <th>Next Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleHistory.map((entry, index) => {
                      const rowNumber =
                        historyStart + index + 1;

                      return (
                        <tr key={entry.id ?? rowNumber}>
                          {/* TIMELINE NUMBER */}

                          <td className="cd-history-number-cell">
                            <span
                              className={
                                index === 0
                                  ? "cd-history-number cd-history-number-active"
                                  : "cd-history-number"
                              }
                            >
                              {rowNumber}
                            </span>
                          </td>

                          {/* DIARY DATE */}

                          <td>
                            <div className="cd-history-date">
                              <strong>
                                {formatLongDate(
                                  entryDate(entry)
                                )}
                              </strong>

                              <small>
                                {formatWeekday(
                                  entryDate(entry)
                                )}
                              </small>
                            </div>
                          </td>

                          {/* COURT */}

                          <td>
                            <div className="cd-history-court">
                              <span>
                                {textOf(entry.court_name) ||
                                  court}
                              </span>

                              {location && (
                                <small>
                                  {location}
                                </small>
                              )}
                            </div>
                          </td>

                          {/* COURT PROCEEDINGS */}


                          {/* COURT PROCEEDINGS PREVIEW */}

                          <td>
                            <div className="cd-history-note">
                              {textOf(entry.pointNotes ?? entry.point_notes) ||
                                entryNotes(entry) ||
                                "No court proceedings recorded."}
                            </div>
                          </td>


                          {/* NEXT DATE */}

                          <td>
                            <span className="cd-history-next">
                              {formatDate(
                                entryNextDate(entry)
                              )}
                            </span>
                          </td>

                          {/* ACTIONS */}

                          <td>
                            <div className="cd-history-actions">
                              <button
                                type="button"
                                className="cd-history-view"
                                aria-label={`View diary entry ${rowNumber}`}
                                title="View Diary Entry"
                                onClick={() =>
                                  setViewEntry(entry)
                                }
                              >
                                <Eye size={18} />
                              </button>

                              <button
                                type="button"
                                className="cd-history-edit"
                                aria-label={`Edit diary entry ${rowNumber}`}
                                title={
                                  onEditEntry
                                    ? "Edit Diary Entry"
                                    : "Edit integration pending"
                                }
                                disabled={!onEditEntry}
                                onClick={() => startEditing(entry)}
                              >
                                <Pencil size={17} />
                              </button>

                              <button
                                type="button"
                                className="cd-history-delete"
                                aria-label={`Delete diary entry ${rowNumber}`}
                                title={
                                  onDeleteEntry
                                    ? "Delete Diary Entry"
                                    : "Delete integration pending"
                                }
                                disabled={!onDeleteEntry}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Delete this diary entry permanently? Its linked hearings, tasks and reminders will also be deleted."
                                    )
                                  ) {
                                    onDeleteEntry?.(entry);
                                  }
                                }}
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE - COMPACT DIARY CARDS */}

              <div className="cd-history-mobile">
                {visibleHistory.map((entry, index) => {
                  const rowNumber =
                    historyStart + index + 1;

                  return (
                    <article
                      className="cd-history-mobile-card"
                      key={entry.id ?? rowNumber}
                    >
                      <div className="cd-history-mobile-top">
                        <span className="cd-history-mobile-number">
                          {rowNumber}
                        </span>

                        <div className="cd-history-mobile-date">
                          <strong>
                            {formatLongDate(
                              entryDate(entry)
                            )}
                          </strong>

                          <small>
                            {formatWeekday(
                              entryDate(entry)
                            )}
                          </small>
                        </div>

                        <span className="cd-history-next">
                          {formatDate(
                            entryNextDate(entry)
                          )}
                        </span>
                      </div>

                      <div className="cd-history-mobile-court">
                        {textOf(entry.court_name) ||
                          court}
                        {location ? ` · ${location}` : ""}
                      </div>

                      <p className="cd-history-mobile-note">
                        {entryNotes(entry) ||
                          "No court proceedings recorded."}
                      </p>

                      <div className="cd-history-mobile-actions">
                        <button
                          type="button"
                          onClick={() =>
                            setViewEntry(entry)
                          }
                        >
                          <Eye size={16} />
                          View
                        </button>

                        <button
                          type="button"
                          disabled={!onEditEntry}
                          onClick={() =>
                            startEditing(entry)
                          }
                        >
                          <Pencil size={15} />
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={!onDeleteEntry}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Delete this diary entry?"
                              )
                            ) {
                              onDeleteEntry?.(entry);
                            }
                          }}
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {/* FOOTER AND PAGINATION */}

          <div className="cd-history-footer">
            <span>
              Showing {firstHistoryItem} to{" "}
              {lastHistoryItem} of{" "}
              {diaryRows.length} entries
            </span>

            {diaryRows.length > 0 && (
              <div className="cd-history-pagination">
                <button
                  type="button"
                  aria-label="Previous diary history page"
                  disabled={currentHistoryPage <= 1}
                  onClick={() =>
                    setHistoryPage((p) =>
                      Math.max(1, p - 1)
                    )
                  }
                >
                  <ChevronLeft size={17} />
                </button>

                <span>
                  {currentHistoryPage} / {historyPages}
                </span>

                <button
                  type="button"
                  aria-label="Next diary history page"
                  disabled={
                    currentHistoryPage >= historyPages
                  }
                  onClick={() =>
                    setHistoryPage((p) =>
                      Math.min(historyPages, p + 1)
                    )
                  }
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* HEARINGS TAB */}

      {tab === "hearings" && (
        <section className="cd-panel cd-hearings-panel">
          {/* HEADER */}

          <div className="cd-hearings-header">
            <div className="cd-hearings-heading">
              <CalendarDays size={23} />

              <div>
                <h2>Hearings</h2>
                <p>
                  All hearing dates for this case
                  (based on diary entries).
                </p>
              </div>
            </div>

            {/* SEARCH AND SORT */}

            <div className="cd-hearings-controls">
              <label className="cd-hearings-search">
                <Search size={18} />

                <input
                  type="search"
                  placeholder="Search hearings..."
                  aria-label="Search hearings"
                  value={hearingQuery}
                  onChange={(event) => {
                    setHearingQuery(event.target.value);
                    setHearingPage(1);
                  }}
                />
              </label>

              <button
                type="button"
                className="cd-hearings-sort"
                onClick={() => {
                  setHearingLatestFirst((value) => !value);
                  setHearingPage(1);
                }}
              >
                <ArrowDownUp size={17} />
                Sort (
                {hearingLatestFirst
                  ? "Oldest First"
                  : "Latest First"}
                )
              </button>
            </div>
          </div>

          {/* EMPTY STATE */}

          {hearingRows.length === 0 ? (
            <div className="cd-hearings-empty">
              {hearingQuery
                ? "No matching hearings found."
                : "No hearing records found for this case."}
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}

              <div className="cd-hearings-table-scroll">
                <table className="cd-hearings-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Hearing Date</th>
                      <th>Court</th>
                      <th>Purpose / Notes</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleHearings.map((hearing, index) => {
                      const rowNumber =
                        hearingStart + index + 1;

                      const displayStatus =
                        hearingStatus(hearing);

                      return (
                        <tr key={hearing.id ?? rowNumber}>
                          {/* TIMELINE NUMBER */}

                          <td>
                            <span
                              className={`cd-hearings-number ${index === 0
                                ? "cd-hearings-number-active"
                                : ""
                                }`}
                            >
                              {rowNumber}
                            </span>
                          </td>

                          {/* HEARING DATE */}

                          <td>
                            <div className="cd-hearings-date">
                              <strong>
                                {formatLongDate(
                                  hearing.hearing_date
                                )}
                              </strong>

                              <small>
                                {formatWeekday(
                                  hearing.hearing_date
                                )}
                              </small>
                            </div>
                          </td>

                          {/* COURT */}

                          <td>
                            <div className="cd-hearings-court">
                              <span>
                                {textOf(
                                  hearing.court ||
                                  hearing.court_name
                                ) || court}
                              </span>

                              <small>
                                {textOf(hearing.location) ||
                                  location ||
                                  "—"}
                              </small>
                            </div>
                          </td>

                          {/* PURPOSE / NOTES */}

                          <td>
                            <div className="cd-hearings-purpose">
                              {hearingPurpose(hearing)}
                            </div>
                          </td>

                          {/* STATUS */}

                          <td>
                            <span
                              className={`cd-hearings-status ${displayStatus.toLowerCase() ===
                                "upcoming"
                                ? "cd-hearings-upcoming"
                                : displayStatus.toLowerCase() ===
                                  "tentative"
                                  ? "cd-hearings-tentative"
                                  : displayStatus.toLowerCase() ===
                                    "completed"
                                    ? "cd-hearings-completed"
                                    : "cd-hearings-default"
                                }`}
                            >
                              {displayStatus}
                            </span>
                          </td>


                          {/* RESCHEDULE ACTION */}

                          <td>
                            {textOf(hearing.status).toLowerCase() ===
                              "scheduled" ? (
                              <button
                                type="button"
                                className="cd-history-edit"
                                title="Reschedule Hearing"
                                aria-label={`Reschedule hearing on ${formatDate(
                                  hearing.hearing_date
                                )}`}
                                onClick={() => startRescheduling(hearing)}
                              >
                                <CalendarClock size={17} />
                              </button>
                            ) : (
                              <span>—</span>
                            )}
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE HEARING CARDS */}

              <div className="cd-hearings-mobile">
                {visibleHearings.map((hearing, index) => {
                  const rowNumber =
                    hearingStart + index + 1;

                  const displayStatus =
                    hearingStatus(hearing);

                  return (
                    <article
                      className="cd-hearings-mobile-card"
                      key={hearing.id ?? rowNumber}
                    >
                      <div className="cd-hearings-mobile-top">
                        <span className="cd-hearings-mobile-number">
                          {rowNumber}
                        </span>

                        <div className="cd-hearings-date">
                          <strong>
                            {formatLongDate(
                              hearing.hearing_date
                            )}
                          </strong>

                          <small>
                            {formatWeekday(
                              hearing.hearing_date
                            )}
                          </small>
                        </div>

                        <span
                          className={`cd-hearings-status ${displayStatus.toLowerCase() ===
                            "upcoming"
                            ? "cd-hearings-upcoming"
                            : displayStatus.toLowerCase() ===
                              "tentative"
                              ? "cd-hearings-tentative"
                              : displayStatus.toLowerCase() ===
                                "completed"
                                ? "cd-hearings-completed"
                                : "cd-hearings-default"
                            }`}
                        >
                          {displayStatus}
                        </span>
                      </div>

                      <div className="cd-hearings-mobile-info">
                        <strong>
                          {textOf(
                            hearing.court ||
                            hearing.court_name
                          ) || court}
                        </strong>

                        <small>
                          {textOf(hearing.location) ||
                            location ||
                            "—"}
                        </small>
                      </div>

                      <p className="cd-hearings-mobile-purpose">
                        {hearingPurpose(hearing)}
                      </p>


                      {textOf(hearing.status).toLowerCase() ===
                        "scheduled" && (
                          <button
                            type="button"
                            className="cd-history-edit"
                            title="Reschedule Hearing"
                            aria-label={`Reschedule hearing on ${formatDate(
                              hearing.hearing_date
                            )}`}
                            onClick={() => startRescheduling(hearing)}
                          >
                            <CalendarClock size={17} />
                          </button>
                        )}

                    </article>
                  );
                })}
              </div>
            </>
          )}

          {/* PAGINATION */}

          <div className="cd-hearings-footer">
            <span>
              Showing {firstHearingItem} to{" "}
              {lastHearingItem} of{" "}
              {hearingRows.length} hearings
            </span>

            {hearingRows.length > 0 && (
              <div className="cd-hearings-pagination">
                <button
                  type="button"
                  disabled={currentHearingPage <= 1}
                  aria-label="Previous hearings page"
                  onClick={() =>
                    setHearingPage((page) =>
                      Math.max(1, page - 1)
                    )
                  }
                >
                  <ChevronLeft size={17} />
                </button>

                <span>{currentHearingPage}</span>

                <button
                  type="button"
                  disabled={
                    currentHearingPage >= hearingPages
                  }
                  aria-label="Next hearings page"
                  onClick={() =>
                    setHearingPage((page) =>
                      Math.min(hearingPages, page + 1)
                    )
                  }
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TASKS TAB */}


      {/* TASKS TAB */}

      {tab === "tasks" && (
        <CaseTasks caseId={caseData?.id} />
      )}


      {/* RESCHEDULE HEARING POPUP */}

      {rescheduleTarget && (
        <div
          className="cd-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !rescheduleSaving
            ) {
              setRescheduleTarget(null);
            }
          }}
        >
          <section
            className="cd-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reschedule-title"
          >
            <div className="cd-modal-head">
              <h2 id="reschedule-title">
                Reschedule Hearing
              </h2>

              <button
                type="button"
                aria-label="Close"
                disabled={rescheduleSaving}
                onClick={() => setRescheduleTarget(null)}
              >
                <X size={19} />
              </button>
            </div>

            <form
              className="cd-edit-form"
              onSubmit={saveReschedule}
            >
              <label>
                <span>Original Hearing Date</span>

                <input
                  type="text"
                  value={formatLongDate(
                    rescheduleTarget.hearing_date
                  )}
                  readOnly
                />
              </label>

              <label>
                <span>New Hearing Date *</span>

                <input
                  type="date"
                  value={newHearingDate}
                  min={(() => {
                    const d = new Date(
                      `${rescheduleTarget.hearing_date}T12:00:00`
                    );

                    d.setDate(d.getDate() + 1);

                    return [
                      d.getFullYear(),
                      String(d.getMonth() + 1).padStart(2, "0"),
                      String(d.getDate()).padStart(2, "0"),
                    ].join("-");
                  })()}
                  required
                  onChange={(event) =>
                    setNewHearingDate(event.target.value)
                  }
                />
              </label>

              <label>
                <span>Reason for Postponement *</span>

                <textarea
                  rows={3}
                  maxLength={500}
                  required
                  value={rescheduleReason}
                  placeholder="e.g., Hearing postponed by court notice"
                  onChange={(event) =>
                    setRescheduleReason(event.target.value)
                  }
                />
              </label>

              <p>
                The original hearing will be marked as
                Postponed. A new Scheduled hearing will
                be created for the selected date.
              </p>

              {rescheduleError && (
                <p
                  className="cd-edit-error"
                  role="alert"
                >
                  {rescheduleError}
                </p>
              )}

              <div className="cd-edit-actions">
                <button
                  type="button"
                  disabled={rescheduleSaving}
                  onClick={() => setRescheduleTarget(null)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={rescheduleSaving}
                >
                  {rescheduleSaving
                    ? "Saving..."
                    : "Save Reschedule"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}



      {/* CONFIRM CASE CLOSURE */}

      {showCloseConfirm && (
        <div
          className="cd-close-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !closingCase
            ) {
              setShowCloseConfirm(false);
            }
          }}
        >
          <section
            className="cd-close-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cd-close-title"
          >
            <div className="cd-close-dialog-top">
              <span className="cd-close-dialog-icon">
                <Folder size={21} />
              </span>

              <button
                type="button"
                className="cd-close-dialog-x"
                aria-label="Close dialog"
                disabled={closingCase}
                onClick={() => setShowCloseConfirm(false)}
              >
                <X size={19} />
              </button>
            </div>

            <h2 id="cd-close-title">Change Case Status</h2>

            <p>
              Mark case <strong>{caseNumber}</strong> as closed
              only when its legal proceedings have concluded.
            </p>

            <div className="cd-close-preview">
              <span className="cd-status cd-active">Active</span>
              <span className="cd-close-arrow" aria-hidden="true">→</span>
              <span className="cd-status cd-close-target">Closed</span>
            </div>

            <p className="cd-close-note">
              Diary history will stay available. Scheduled
              hearings will not be changed automatically.
            </p>

            {closeCaseError && (
              <p className="cd-close-error" role="alert">
                {closeCaseError}
              </p>
            )}

            <div className="cd-close-dialog-actions">
              <button
                type="button"
                className="cd-close-cancel"
                disabled={closingCase}
                onClick={() => setShowCloseConfirm(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="cd-close-confirm"
                disabled={closingCase || !onCloseCase}
                onClick={async () => {
                  setClosingCase(true);
                  setCloseCaseError("");

                  try {
                    await onCloseCase(caseData);
                    setShowCloseConfirm(false);
                  } catch (error) {
                    setCloseCaseError(
                      error.message || "Could not close case."
                    );
                  } finally {
                    setClosingCase(false);
                  }
                }}
              >
                {closingCase ? "Closing..." : "Confirm Close"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* VIEW DIARY ENTRY POPUP */}

      {viewEntry && (
        <div
          className="cd-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setViewEntry(null);
            }
          }}
        >
          <section
            className="cd-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Diary entry details"
          >
            <div className="cd-modal-head">
              <h2>Diary Entry Details</h2>

              <button
                type="button"
                onClick={() =>
                  setViewEntry(null)
                }
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <p>
              <strong>Diary Date:</strong>{" "}
              {formatDate(
                entryDate(viewEntry)
              )}
            </p>

            <p>
              <strong>Court:</strong>{" "}
              {textOf(viewEntry.court_name) ||
                court}
            </p>

            <p>
              <strong>Next Date:</strong>{" "}
              {formatDate(
                entryNextDate(viewEntry)
              )}
            </p>

            <h3>Court Proceedings</h3>

            <p className="cd-full-note">
              {entryNotes(viewEntry) ||
                "No proceedings text"}
            </p>

            {/* ORIGINAL AUDIO + TAMIL TRANSCRIPT + AI NOTES */}

            <div style={{ marginTop: 20 }}>
              <DiaryVoiceDetails
                entryId={viewEntry.id}
              />
            </div>
          </section>
        </div>
      )}

      {/* EDIT DIARY ENTRY POPUP */}

      {editingEntry && (
        <div
          className="cd-modal-backdrop"
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !editSaving
            ) {
              setEditingEntry(null);
            }
          }}
        >
          <section
            className="cd-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Diary entry details"
            style={{
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            <div className="cd-modal-head">
              <h2>Edit Diary Entry</h2>

              <button
                type="button"
                aria-label="Close"
                disabled={editSaving}
                onClick={() => setEditingEntry(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="cd-edit-form"
              onSubmit={saveEditedEntry}
            >
              <label>
                <span>Step Type *</span>
                <input
                  required
                  value={editDraft.step_type}
                  onChange={(e) =>
                    setEditDraft((previous) => ({
                      ...previous,
                      step_type: e.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Previous Date</span>
                <input
                  type="date"
                  value={editDraft.previous_date}
                  onChange={(e) =>
                    setEditDraft((previous) => ({
                      ...previous,
                      previous_date: e.target.value,
                    }))
                  }
                />
              </label>


              <label>
                <span>Court Proceedings *</span>
                <textarea
                  required
                  rows={5}
                  value={editDraft.step_notes}
                  onChange={(e) => {
                    const updatedText = e.target.value;

                    setEditDraft((previous) => ({
                      ...previous,
                      step_notes: updatedText,
                      point_notes:
                        !pointNotesManuallyEdited &&
                          previous.point_notes.trim()
                          ? toPoints(updatedText)
                          : previous.point_notes,
                    }));
                  }}
                />
              </label>

              <label>
                <span>Point-wise Notes</span>
                <textarea
                  rows={3}
                  value={editDraft.point_notes}
                  onChange={(e) => {
                    setPointNotesManuallyEdited(true);

                    setEditDraft((previous) => ({
                      ...previous,
                      point_notes: e.target.value,
                    }));
                  }}
                />
              </label>


              <label>
                <span>Next Hearing Date</span>
                <input
                  type="date"
                  value={editDraft.next_date}
                  onChange={(e) =>
                    setEditDraft((previous) => ({
                      ...previous,
                      next_date: e.target.value,
                    }))
                  }
                />
              </label>

              {editError && (
                <p role="alert" className="cd-edit-error">
                  {editError}
                </p>
              )}

              <div className="cd-edit-actions">
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => setEditingEntry(null)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={editSaving}
                >
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
