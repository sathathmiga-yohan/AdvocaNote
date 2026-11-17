
import {
  useLawyerLayout,
  LawyerTopbarPortal,
  LawyerTopbarAvatar,
} from "../components/LawyerLayout";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, CalendarDays, CalendarPlus, CheckSquare, ChevronDown,
  ChevronLeft, ChevronRight, Eye, FileText, Filter,
  Gavel, Info, LogOut, Menu, Plus, Search,
  UserRound, X, Pencil, Trash2, Save,
} from "lucide-react";

import "./MyLegalDiary.css";
import "./MyLegalDiaryRightPanel.css";
import { logoutUser } from "../services/auth";
import {
  getDiaryOverview,
  getHearings,
  updateDiaryEntry,
  deleteDiaryEntry,
} from "../services/diary";

const toISODate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const parseDate = (date) => new Date(`${date}T12:00:00`);

const readableDate = (date) =>
  !date ? "—" : new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(parseDate(date));

const fullDate = (date) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(parseDate(date));

const PAGE_SIZE = 5;

function DiaryMiniCalendar({ selectedDate, onSelect }) {
  const [month, setMonth] = useState(() => {
    const day = parseDate(selectedDate);
    return new Date(day.getFullYear(), day.getMonth(), 1);
  });

  useEffect(() => {
    const day = parseDate(selectedDate);
    setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
  }, [selectedDate]);

  const offset = (month.getDay() + 6) % 7;
  const totalDays = new Date(
    month.getFullYear(), month.getMonth() + 1, 0
  ).getDate();

  const today = toISODate(new Date());
  const days = [
    ...Array(offset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  return (
    <section className="ald-diary-widget" aria-label="Diary mini calendar">
      <div className="ald-widget-heading">
        <h3><CalendarDays size={18} /> Calendar</h3>

        <div className="ald-widget-month-controls">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth(new Date(
              month.getFullYear(), month.getMonth() - 1, 1
            ))}
          >
            <ChevronLeft size={17} />
          </button>

          <span>
            {month.toLocaleDateString("en-GB", {
              month: "short",
              year: "numeric",
            })}
          </span>

          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonth(new Date(
              month.getFullYear(), month.getMonth() + 1, 1
            ))}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="ald-widget-calendar-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((label, i) => (
          <span className="ald-widget-weekday" key={i}>
            {label}
          </span>
        ))}

        {days.map((number, i) => {
          if (!number) return <span key={`blank-${i}`} />;

          const iso = toISODate(new Date(
            month.getFullYear(),
            month.getMonth(),
            number
          ));

          return (
            <button
              type="button"
              key={iso}
              className={[
                iso === selectedDate ? "ald-widget-selected" : "",
                iso === today ? "ald-widget-today" : "",
              ].join(" ")}
              onClick={() => onSelect(iso)}
              aria-label={`Show diary entries on ${readableDate(iso)}`}
              aria-pressed={iso === selectedDate}
            >
              {number}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function MyLegalDiary({ onLogout }) {
  const navigate = useNavigate();
  const globalSearchRef = useRef(null);

  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({
    upcoming_hearings: 0,
    pending_tasks: 0,
    courts_attended: 0,
  });

  const [reminders, setReminders] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [hearingError, setHearingError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const [editingEntry, setEditingEntry] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [actionError, setActionError] = useState("");

  const [diaryError, setDiaryError] = useState("");
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Logged-in lawyer comes from the shared layout
  const {
    user: currentUser,
    openSidebar,
    closeSidebar,
  } = useLawyerLayout();

  const [profileOpen, setProfileOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState(() => {
    const dateFromUrl = new URLSearchParams(
      window.location.search
    ).get("date");

    return /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl || "")
      ? dateFromUrl
      : toISODate(new Date());
  });

  const [globalQuery, setGlobalQuery] = useState("");
  const [diaryQuery, setDiaryQuery] = useState("");
  const [courtFilter, setCourtFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [stepFilter, setStepFilter] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Load diary entries from FastAPI
  useEffect(() => {
    if (!currentUser) return;
    let active = true;

    setLoadingEntries(true);
    setDiaryError("");

    getDiaryOverview(selectedDate)
      .then((data) => {
        if (!active) return;
        setEntries(data.entries || []);
        setStats(data.stats || {
          upcoming_hearings: 0,
          pending_tasks: 0,
          courts_attended: 0,
        });
        setReminders(data.notifications || []);
        setDiaryError("");
      })
      .catch((error) => {
        if (!active) return;
        setEntries([]);
        setReminders([]);
        setStats({
          upcoming_hearings: 0,
          pending_tasks: 0,
          courts_attended: 0,
        });
        setDiaryError(error.message || "Could not load diary entries.");
      })
      .finally(() => {
        if (active) setLoadingEntries(false);
      });

    return () => { active = false; };
  }, [currentUser, selectedDate, refreshTick]);

  // Load real hearings
  useEffect(() => {
    if (!currentUser) return;
    let active = true;

    getHearings()
      .then((items) => {
        if (active) {
          setHearings(Array.isArray(items) ? items : []);
          setHearingError("");
        }
      })
      .catch((error) => {
        if (active) {
          setHearings([]);
          setHearingError(
            error.message || "Unable to load hearings."
          );
        }
      });

    return () => { active = false; };
  }, [currentUser, refreshTick]);

  // Search keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        globalSearchRef.current?.focus();
      }

      if (event.key === "Escape") {
        setSelectedEntry(null);
        closeSidebar();
        setProfileOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSidebar]);

  const shiftDate = (days) => {
    const date = parseDate(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(toISODate(date));
    setPage(1);
  };

  const changeFilter = (setter, value) => {
    setter(value);
    setPage(1);
  };

  const dayEntries = useMemo(
    () => entries.filter((entry) => entry.entryDate === selectedDate),
    [entries, selectedDate]
  );

  const filteredEntries = useMemo(() => {
    const today = toISODate(new Date());
    const inThirtyDays = new Date();
    inThirtyDays.setDate(inThirtyDays.getDate() + 30);
    const thirtyDays = toISODate(inThirtyDays);

    const matching = dayEntries.filter((entry) => {
      const haystack = `${entry.caseNo} ${entry.caseTitle} ${entry.court} ${entry.location} ${entry.note}`.toLowerCase();

      if (
        globalQuery.trim() &&
        !haystack.includes(globalQuery.trim().toLowerCase())
      ) return false;

      if (
        diaryQuery.trim() &&
        !haystack.includes(diaryQuery.trim().toLowerCase())
      ) return false;

      if (courtFilter !== "all" && entry.court !== courtFilter) {
        return false;
      }

      if (stepFilter !== "all" && entry.stepType !== stepFilter) {
        return false;
      }

      if (
        dateFilter === "upcoming" &&
        (!entry.nextDate || entry.nextDate < today)
      ) return false;

      if (
        dateFilter === "overdue" &&
        (!entry.nextDate || entry.nextDate >= today)
      ) return false;

      if (
        dateFilter === "30-days" &&
        (!entry.nextDate ||
          entry.nextDate < today ||
          entry.nextDate > thirtyDays)
      ) return false;

      return true;
    });

    if (sortBy === "case") {
      matching.sort((a, b) => a.caseNo.localeCompare(b.caseNo));
    }

    if (sortBy === "next") {
      matching.sort((a, b) =>
        (a.nextDate || "9999-12-31").localeCompare(
          b.nextDate || "9999-12-31"
        )
      );
    }

    return matching;
  }, [
    dayEntries, globalQuery, diaryQuery,
    courtFilter, dateFilter, stepFilter, sortBy,
  ]);

  const pagesCount = Math.max(
    1, Math.ceil(filteredEntries.length / PAGE_SIZE)
  );
  const currentPage = Math.min(page, pagesCount);
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const startIndex = filteredEntries.length
    ? (currentPage - 1) * PAGE_SIZE + 1
    : 0;

  const endIndex = Math.min(
    currentPage * PAGE_SIZE,
    filteredEntries.length
  );

  const courts = [...new Set(entries.map((entry) => entry.court))];
  const todayISO = toISODate(new Date());

  const upcomingHearings = hearings
    .filter((hearing) =>
      hearing.hearing_date >= todayISO &&
      hearing.status === "Scheduled"
    )
    .sort((a, b) =>
      a.hearing_date.localeCompare(b.hearing_date)
    )
    .slice(0, 3);

  const todayReminders = reminders.filter(
    (reminder) => reminder.date === todayISO
  );

  // Edit diary entry
  const beginEdit = (entry) => {
    setSelectedEntry(null);
    setActionError("");
    setEditingEntry(entry);

    setEditDraft({
      previousDate: entry.previousDate || "",
      nextDate: entry.nextDate || "",
      stepType: entry.stepType || "Other",
      note: entry.note || "",
      pointNotes: entry.pointNotes || "",
    });
  };

  const saveEdit = async (event) => {
    event.preventDefault();

    if (!editingEntry || !editDraft || savingEdit) return;

    if (!editDraft.note.trim()) {
      setActionError("Court proceedings note is required.");
      return;
    }

    setSavingEdit(true);
    setActionError("");

    try {
      await updateDiaryEntry(editingEntry.id, {
        previous_date: editDraft.previousDate || null,
        next_date: editDraft.nextDate || null,
        step_type: editDraft.stepType,
        step_notes: editDraft.note.trim(),
        point_notes: editDraft.pointNotes.trim() || null,
      });

      setEditingEntry(null);
      setEditDraft(null);
      setRefreshTick((value) => value + 1);
    } catch (error) {
      setActionError(error.message || "Could not update diary entry.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete diary entry
  const removeEntry = async (entry) => {
    if (deletingEntry) return;

    const allowed = window.confirm(
      `Permanently delete diary entry ${entry.caseNo}? ` +
      "This also removes its linked hearing, task and " +
      "reminder records. This cannot be undone."
    );

    if (!allowed) return;

    setDeletingEntry(true);
    setActionError("");

    try {
      await deleteDiaryEntry(entry.id);
      setSelectedEntry(null);
      setEditingEntry(null);
      setRefreshTick((value) => value + 1);
    } catch (error) {
      setActionError(error.message || "Could not delete diary entry.");
    } finally {
      setDeletingEntry(false);
    }
  };

  const clearFilters = () => {
    setGlobalQuery("");
    setDiaryQuery("");
    setCourtFilter("all");
    setDateFilter("all");
    setStepFilter("all");
    setSortBy("default");
    setPage(1);
  };

  const displayName = currentUser?.full_name || "Lawyer";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const logout = async () => {
    try {
      if (typeof onLogout === "function") {
        await onLogout();
      } else {
        await logoutUser();
      }
    } catch (error) {
      console.error("Server logout failed:", error.message);
    } finally {
      sessionStorage.removeItem("advocanote_access_token");
      sessionStorage.removeItem("advocanote_refresh_token");
      navigate("/login", { replace: true });
    }
  };

  if (!currentUser) return null;

  return (
    <>
      {/* CONTENT FOR THE ONE COMMON TOPBAR */}
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
          <Search size={23} aria-hidden="true" />
          <input
            ref={globalSearchRef}
            value={globalQuery}
            onChange={(event) =>
              changeFilter(setGlobalQuery, event.target.value)
            }
            placeholder="Search cases, hearings, dates, notes..."
            aria-label="Search all diary entries"
          />
        </div>


        <div
          className="ald-topbar-actions"
          style={{ order: 3 }}
        >
          <div className="ald-topbar-divider" />

          <div className="ald-dropdown-holder">
            <button
              type="button"
              className="ald-account"
              onClick={() => {
                setProfileOpen((value) => !value);
              }}
              aria-expanded={profileOpen}
            >
              <LawyerTopbarAvatar />

              <span className="ald-account-text">
                <strong>{displayName}</strong>
                <small>Attorney-at-Law</small>
              </span>

              <ChevronDown size={18} aria-hidden="true" />
            </button>

            {profileOpen && (
              <div className="ald-top-popover ald-account-popover">
                <button
                  type="button"
                  onClick={() => navigate("/profile")}
                >
                  <UserRound size={17} />
                  My Profile
                </button>

                <button
                  type="button"
                  onClick={logout}
                >
                  <LogOut size={17} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

      </LawyerTopbarPortal>

      {/* MAIN DIARY CONTENT - LEFT AND RIGHT */}
      <main className="ald-main">
        <div className="ald-diary-content-grid">


          {/* LEFT: ORIGINAL DIARY */}
          <div className="ald-diary-primary">

            {/* MY LEGAL DIARY BANNER */}
            <section
              className="ald-heading-row"
              aria-labelledby="ald-page-heading"
            >
              <div>

                <h1 className="ald-diary-compact-title">
                  My Legal Diary
                </h1>
                <p>
                  Record court proceedings day by day.
                  Next dates sync to Hearings, Calendar
                  and Reminders.
                </p>
              </div>
            </section>

            {diaryError && <p role="alert">{diaryError}</p>}

            {/* DATE NAVIGATION */}
            <section
              className="ald-date-panel"
              aria-label="Choose diary date"
            >
              <div className="ald-date-left">
                <button
                  type="button"
                  className="ald-date-arrow"
                  onClick={() => shiftDate(-1)}
                  aria-label="Previous day"
                >
                  <ChevronLeft size={22} />
                </button>

                <button
                  type="button"
                  className="ald-date-arrow"
                  onClick={() => shiftDate(1)}
                  aria-label="Next day"
                >
                  <ChevronRight size={22} />
                </button>

                <h2>{fullDate(selectedDate)}</h2>
              </div>

              <div className="ald-date-right">
                <label className="ald-date-picker">
                  <span className="ald-sr-only">
                    Select diary date
                  </span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => {
                      setSelectedDate(
                        event.target.value || selectedDate
                      );
                      setPage(1);
                    }}
                  />
                </label>

                <button
                  type="button"
                  className="ald-today-button"
                  onClick={() => {
                    setSelectedDate(toISODate(new Date()));
                    setPage(1);
                  }}
                >
                  Today
                </button>

                <button
                  type="button"
                  className="ald-add-button"
                  onClick={() =>
                    navigate(`/add-diary-entry?date=${selectedDate}`)
                  }
                >
                  <Plus size={21} />
                  Add Diary Entry
                </button>
              </div>
            </section>

            {/* STATISTICS */}


            {/* STATISTICS */}
            <section
              className="ald-stats"
              aria-label="Diary statistics"
            >
              <div className="ald-stat ald-stat--green">
                <span className="ald-stat-icon">
                  <FileText size={31} strokeWidth={1.8} />
                </span>
                <div>
                  <strong>{dayEntries.length}</strong>
                  <span>Entries on date</span>
                </div>
              </div>

              <div className="ald-stat ald-stat--mint">
                <span className="ald-stat-icon">
                  <CalendarPlus size={31} strokeWidth={1.8} />
                </span>
                <div>
                  <strong>
                    {loadingEntries
                      ? "—"
                      : stats.upcoming_hearings}
                  </strong>
                  <span>Upcoming hearings</span>
                </div>
              </div>

              <div className="ald-stat ald-stat--blue">
                <span className="ald-stat-icon">
                  <CheckSquare size={31} strokeWidth={1.8} />
                </span>
                <div>
                  <strong>
                    {loadingEntries ? "—" : stats.pending_tasks}
                  </strong>
                  <span>Pending tasks</span>
                </div>
              </div>

              <div className="ald-stat ald-stat--gold">
                <span className="ald-stat-icon">
                  <Gavel size={31} strokeWidth={1.8} />
                </span>
                <div>
                  <strong>
                    {loadingEntries ? "—" : stats.courts_attended}
                  </strong>
                  <span>Courts attended</span>
                </div>
              </div>
            </section>

            {/* FILTERS */}
            <section
              className="ald-filters"
              aria-label="Diary entry filters"
            >
              <div className="ald-filters-main">
                <label className="ald-entry-search">
                  <Search size={21} aria-hidden="true" />
                  <input
                    value={diaryQuery}
                    onChange={(event) =>
                      changeFilter(setDiaryQuery, event.target.value)
                    }
                    placeholder="Search diary entries (case no, court, note...)"
                    aria-label="Search diary entries"
                  />
                </label>

                <label className="ald-select-wrap">
                  <span className="ald-sr-only">
                    Filter by court
                  </span>
                  <select
                    value={courtFilter}
                    onChange={(event) =>
                      changeFilter(setCourtFilter, event.target.value)
                    }
                  >
                    <option value="all">All Courts</option>
                    {courts.map((court) => (
                      <option key={court} value={court}>
                        {court}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} aria-hidden="true" />
                </label>

                <label className="ald-select-wrap">
                  <span className="ald-sr-only">
                    Filter by next date
                  </span>
                  <select
                    value={dateFilter}
                    onChange={(event) =>
                      changeFilter(setDateFilter, event.target.value)
                    }
                  >
                    <option value="all">All Dates</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="30-days">Next 30 Days</option>
                    <option value="overdue">Past Dates</option>
                  </select>
                  <ChevronDown size={18} aria-hidden="true" />
                </label>

                <label className="ald-select-wrap">
                  <span className="ald-sr-only">
                    Filter by proceeding step
                  </span>
                  <select
                    value={stepFilter}
                    onChange={(event) =>
                      changeFilter(setStepFilter, event.target.value)
                    }
                  >
                    <option value="all">All Steps</option>
                    <option value="Evidence">Evidence</option>
                    <option value="Submissions">Submissions</option>
                    <option value="Settlement">Settlement</option>
                    <option value="Other">Other</option>
                  </select>
                  <ChevronDown size={18} aria-hidden="true" />
                </label>

                <button
                  type="button"
                  className={`ald-filter-button ${advancedOpen
                    ? "ald-filter-button--active"
                    : ""
                    }`}
                  onClick={() =>
                    setAdvancedOpen((value) => !value)
                  }
                  aria-expanded={advancedOpen}
                >
                  <Filter size={21} aria-hidden="true" />
                  Filters
                </button>
              </div>

              {advancedOpen && (
                <div className="ald-advanced-filters">
                  <label htmlFor="ald-sort-by">Sort by</label>
                  <select
                    id="ald-sort-by"
                    value={sortBy}
                    onChange={(event) =>
                      changeFilter(setSortBy, event.target.value)
                    }
                  >
                    <option value="default">Default order</option>
                    <option value="case">Case number (A–Z)</option>
                    <option value="next">Next date (earliest)</option>
                  </select>

                  <button
                    type="button"
                    onClick={clearFilters}
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </section>

            {/* DIARY TABLE */}
            <section
              className="ald-table-card"
              aria-label="Diary entries for selected date"
            >
              <div className="ald-table-scroll">
                <table className="ald-table">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Case No</th>
                      <th scope="col">Court</th>
                      <th scope="col">Previous Date</th>
                      <th scope="col">
                        Step (Court Note Preview)
                      </th>
                      <th scope="col">Next Date</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedEntries.length ? (
                      paginatedEntries.map((entry, index) => (
                        <tr key={entry.id}>
                          <td>
                            {(currentPage - 1) *
                              PAGE_SIZE + index + 1}
                          </td>

                          <td className="ald-case-cell">
                            <strong>{entry.caseNo}</strong>
                            <span>{entry.caseTitle}</span>
                          </td>

                          <td className="ald-court-cell">
                            {entry.court}
                            <span>{entry.location}</span>
                          </td>

                          <td className="ald-prev-date">
                            {readableDate(entry.previousDate)}
                          </td>

                          <td>
                            <span
                              className="ald-note-preview"
                              title={entry.note}
                            >
                              {entry.note}
                            </span>
                          </td>

                          <td>
                            <span className="ald-next-date">
                              {readableDate(entry.nextDate)}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="ald-view-button"
                              aria-label={`View entry for ${entry.caseNo}`}

                              onClick={() =>
                                navigate(
                                  `/diary-entry-details/${entry.id}`,
                                  {
                                    state: {
                                      returnDate: selectedDate,
                                    },
                                  }
                                )
                              }

                            >
                              <Eye
                                size={22}
                                strokeWidth={1.8}
                              />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          className="ald-table-empty"
                          colSpan={7}
                        >
                          <FileText size={29} />
                          {loadingEntries
                            ? "Loading diary entries..."
                            : diaryError
                              ? "Unable to load diary entries."
                              : "No diary entries yet for this date."}

                          <button
                            type="button"
                            onClick={clearFilters}
                          >
                            Clear filters
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <footer className="ald-table-footer">
                <span>
                  Showing {startIndex} – {endIndex}
                  {" of "}
                  {filteredEntries.length} entries
                </span>

                <div className="ald-table-help">
                  <Info size={18} />
                  Full court notes are available
                  in the diary details view.
                </div>

                <div className="ald-pagination">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() =>
                      setPage((value) => Math.max(1, value - 1))
                    }
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={19} />
                  </button>

                  <span
                    aria-label={`Page ${currentPage} of ${pagesCount}`}
                  >
                    {currentPage}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage >= pagesCount}
                    onClick={() =>
                      setPage((value) =>
                        Math.min(pagesCount, value + 1)
                      )
                    }
                    aria-label="Next page"
                  >
                    <ChevronRight size={19} />
                  </button>
                </div>
              </footer>
            </section>
          </div>

          {/* RIGHT: COMPACT PROFESSIONAL WIDGETS */}
          <aside
            className="ald-diary-widgets"
            aria-label="Diary calendar and reminders"
          >


            <section className="ald-diary-widget ald-hearings-card">
              <div className="ald-widget-heading ald-hearings-heading">
                <h3>
                  <Gavel size={18} />
                  Upcoming Hearings
                </h3>

                <span className="ald-hearings-count">
                  Next {upcomingHearings.length}
                </span>
              </div>

              {hearingError ? (
                <p className="ald-widget-muted" role="alert">
                  {hearingError}
                </p>
              ) : upcomingHearings.length === 0 ? (
                <p className="ald-widget-muted">
                  No upcoming hearings.
                </p>
              ) : (
                <div className="ald-hearings-list">
                  {upcomingHearings.map((hearing) => {
                    const date = parseDate(
                      String(hearing.hearing_date).slice(0, 10)
                    );

                    return (
                      <div className="ald-hearing-row" key={hearing.id}>
                        <time
                          className="ald-hearing-date"
                          dateTime={String(hearing.hearing_date).slice(0, 10)}
                        >
                          <strong>
                            {String(date.getDate()).padStart(2, "0")}
                          </strong>

                          <span>
                            {date.toLocaleDateString("en-GB", {
                              month: "short",
                            }).toUpperCase()}
                          </span>
                        </time>

                        <div className="ald-hearing-info">
                          <strong>
                            Case {hearing.case_number}
                          </strong>

                          <span title={hearing.court}>
                            {hearing.court || "Court not set"}
                          </span>

                          <small>{date.getFullYear()}</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>


            <section className="ald-diary-widget ald-reminders-card">
              <div className="ald-widget-heading">
                <h3>
                  <Bell size={18} />
                  Today's Reminders
                </h3>

                {todayReminders.length > 0 && (
                  <span className="ald-reminder-count">
                    {todayReminders.length}
                  </span>
                )}
              </div>

              {todayReminders.length === 0 ? (
                <p className="ald-widget-muted">
                  No reminders scheduled for today.
                </p>
              ) : (
                <div className="ald-reminders-list">
                  {todayReminders.map((reminder) => (
                    <div
                      className="ald-reminder-item"
                      key={reminder.id}
                    >
                      <span className="ald-reminder-icon">
                        <Bell size={15} />
                      </span>

                      <div className="ald-reminder-content">
                        <strong>{reminder.title}</strong>

                        <small>
                          {readableDate(reminder.date)}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </aside>
        </div>
      </main >

      {/* DIARY DETAILS POPUP */}
      {
        selectedEntry && (
          <div
            className="ald-modal-backdrop"
            onClick={() => setSelectedEntry(null)}
          >
            <section
              className="ald-details-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Diary entry ${selectedEntry.caseNo}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="ald-modal-header">
                <div>
                  <small>Diary Entry Details</small>
                  <h2>{selectedEntry.caseNo}</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  aria-label="Close details"
                >
                  <X size={22} />
                </button>
              </div>

              <p className="ald-modal-case-title">
                {selectedEntry.caseTitle}
              </p>

              <dl className="ald-modal-meta">
                <div>
                  <dt>Court</dt>
                  <dd>
                    {selectedEntry.court}, {selectedEntry.location}
                  </dd>
                </div>
                <div>
                  <dt>Previous Date</dt>
                  <dd>{readableDate(selectedEntry.previousDate)}</dd>
                </div>
                <div>
                  <dt>Next Date</dt>
                  <dd>{readableDate(selectedEntry.nextDate)}</dd>
                </div>
                <div>
                  <dt>Step</dt>
                  <dd>{selectedEntry.stepType}</dd>
                </div>
              </dl>

              <h3>Court Proceedings</h3>
              <p className="ald-modal-note">
                {selectedEntry.note}
              </p>

              {selectedEntry.pointNotes && (
                <>
                  <h3>Point-wise Notes</h3>
                  <div className="ald-modal-note">
                    {selectedEntry.pointNotes
                      .split("\n")
                      .map((line, index) => (
                        <p key={index}>{line}</p>
                      ))}
                  </div>
                </>
              )}

              {actionError && (
                <p
                  role="alert"
                  className="ald-diary-action-error"
                >
                  {actionError}
                </p>
              )}

              <div className="ald-diary-modal-actions">
                <button
                  type="button"
                  className="ald-diary-edit-btn"
                  onClick={() => beginEdit(selectedEntry)}
                  disabled={deletingEntry}
                >
                  <Pencil size={16} />
                  Edit Entry
                </button>

                <button
                  type="button"
                  className="ald-diary-delete-btn"
                  disabled={deletingEntry}
                  onClick={() => removeEntry(selectedEntry)}
                >
                  <Trash2 size={16} />
                  {deletingEntry ? "Deleting..." : "Delete Entry"}
                </button>

                <button
                  type="button"
                  className="ald-modal-close"
                  onClick={() => {
                    setSelectedEntry(null);
                    setActionError("");
                  }}
                >
                  Close
                </button>
              </div>
            </section>
          </div>
        )
      }

      {/* EDIT DIARY POPUP */}
      {
        editingEntry && editDraft && (
          <div
            className="ald-modal-backdrop"
            onClick={() => {
              if (!savingEdit) setEditingEntry(null);
            }}
          >
            <section
              className="ald-details-modal ald-diary-edit-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Edit diary entry ${editingEntry.caseNo}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="ald-modal-header">
                <div>
                  <small>Edit Diary Entry</small>
                  <h2>{editingEntry.caseNo}</h2>
                </div>

                <button
                  type="button"
                  disabled={savingEdit}
                  aria-label="Close edit"
                  onClick={() => setEditingEntry(null)}
                >
                  <X size={22} />
                </button>
              </div>

              <p className="ald-modal-case-title">
                {editingEntry.caseTitle} — {editingEntry.court}
              </p>

              <form
                className="ald-diary-edit-form"
                onSubmit={saveEdit}
              >
                <label>
                  Previous Date
                  <input
                    type="date"
                    value={editDraft.previousDate}
                    onChange={(event) =>
                      setEditDraft((draft) => ({
                        ...draft,
                        previousDate: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Next Hearing Date
                  <input
                    type="date"
                    value={editDraft.nextDate}
                    onChange={(event) =>
                      setEditDraft((draft) => ({
                        ...draft,
                        nextDate: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Step
                  <select
                    value={editDraft.stepType}
                    onChange={(event) =>
                      setEditDraft((draft) => ({
                        ...draft,
                        stepType: event.target.value,
                      }))
                    }
                  >
                    {[
                      "Evidence", "Submissions",
                      "Settlement", "Other",
                    ].map((step) => (
                      <option key={step} value={step}>
                        {step}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Court Proceedings
                  <textarea
                    required
                    rows={5}
                    value={editDraft.note}
                    onChange={(event) =>
                      setEditDraft((draft) => ({
                        ...draft,
                        note: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Point-wise Notes (Optional)
                  <textarea
                    rows={3}
                    value={editDraft.pointNotes}
                    onChange={(event) =>
                      setEditDraft((draft) => ({
                        ...draft,
                        pointNotes: event.target.value,
                      }))
                    }
                  />
                </label>

                {actionError && (
                  <p
                    role="alert"
                    className="ald-diary-action-error"
                  >
                    {actionError}
                  </p>
                )}

                <div className="ald-diary-modal-actions">
                  <button
                    type="submit"
                    className="ald-diary-edit-btn"
                    disabled={savingEdit}
                  >
                    <Save size={16} />
                    {savingEdit ? "Saving..." : "Save Changes"}
                  </button>

                  <button
                    type="button"
                    className="ald-modal-close"
                    disabled={savingEdit}
                    onClick={() => setEditingEntry(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          </div>
        )
      }
    </>
  );
}
