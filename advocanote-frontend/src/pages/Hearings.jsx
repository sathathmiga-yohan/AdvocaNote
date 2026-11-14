
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  LogOut,
  Menu,
  PieChart,
  Search,
  UserRound,
  X,
} from "lucide-react";

import {
  useLawyerLayout,
  LawyerTopbarPortal,
  LawyerTopbarAvatar,
} from "../components/LawyerLayout";

import { logoutUser } from "../services/auth";

import {
  getHearings,
  getLawyerCases,
} from "../services/diary";

import "./MyLegalDiary.css";
import "./Hearings.css";

const todayISO = () => {
  const d = new Date();

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

const dateISO = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(`${value.slice(0, 10)}T12:00:00`);

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const isUpcoming = (hearing) => {
  const status = String(hearing.status || "").toLowerCase();

  return (
    hearing.hearing_date >= todayISO() &&
    !["completed", "postponed", "cancelled", "canceled"].includes(status)
  );
};

const hearingStatus = (hearing) => {
  const status = String(hearing.status || "").toLowerCase();

  if (status === "postponed") return "Postponed";
  if (status === "completed") return "Completed";
  if (status === "cancelled" || status === "canceled") {
    return "Cancelled";
  }

  if (hearing.hearing_date === todayISO()) return "Today";
  if (isUpcoming(hearing)) return "Upcoming";

  return "Past";
};

function HearingCalendar({ hearings, selectedDate, onSelect }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const daysInMonth = new Date(
    year,
    monthIndex + 1,
    0
  ).getDate();

  const startDay = new Date(
    year,
    monthIndex,
    1
  ).getDay();

  const hearingDates = new Set(
    hearings
      .filter(isUpcoming)
      .map((hearing) => hearing.hearing_date.slice(0, 10))
  );

  const cells = [
    ...Array(startDay).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => index + 1
    ),
  ];

  return (
    <section className="hr-card hr-calendar">
      <div className="hr-calendar-heading">
        <button
          type="button"
          onClick={() =>
            setMonth(new Date(year, monthIndex - 1, 1))
          }
          aria-label="Previous month"
        >
          <ChevronLeft size={20} />
        </button>

        <strong>
          {month.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          }).toUpperCase()}
        </strong>

        <button
          type="button"
          onClick={() =>
            setMonth(new Date(year, monthIndex + 1, 1))
          }
          aria-label="Next month"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="hr-calendar-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map(
          (day, index) => (
            <span
              className="hr-calendar-weekday"
              key={index}
            >
              {day}
            </span>
          )
        )}

        {cells.map((day, index) => {
          if (!day) {
            return (
              <span
                key={`empty-${index}`}
                className="hr-calendar-empty"
              />
            );
          }

          const iso = dateISO(
            new Date(year, monthIndex, day)
          );

          const hasHearing = hearingDates.has(iso);

          return (
            <button
              type="button"
              key={iso}
              className={[
                "hr-calendar-day",
                iso === todayISO() ? "hr-day-today" : "",
                iso === selectedDate ? "hr-day-selected" : "",
                hasHearing ? "hr-day-hearing" : "",
              ].join(" ")}
              onClick={() =>
                onSelect(selectedDate === iso ? "" : iso)
              }
              aria-label={`${formatDate(iso)}${hasHearing ? ", upcoming hearing" : ""
                }`}
            >
              {day}
              {hasHearing && (
                <span className="hr-calendar-dot" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function Hearings() {
  const navigate = useNavigate();

  const { user, openSidebar } = useLawyerLayout();

  const [hearings, setHearings] = useState([]);
  const [cases, setCases] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");

  const [selectedHearing, setSelectedHearing] = useState(null);

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const [hearingResult, caseResult] =
        await Promise.allSettled([
          getHearings(),
          getLawyerCases(),
        ]);

      if (!active) return;

      if (hearingResult.status === "fulfilled") {
        setHearings(
          Array.isArray(hearingResult.value)
            ? hearingResult.value
            : []
        );
      } else {
        setHearings([]);
        setError(
          hearingResult.reason?.message ||
          "Unable to load hearings."
        );
      }

      if (caseResult.status === "fulfilled") {
        setCases(
          Array.isArray(caseResult.value)
            ? caseResult.value
            : []
        );
      } else {
        setCases([]);
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [userId]);


  const hearingRows = useMemo(() => {
    const caseMap = new Map(
      cases.map((item) => [String(item.id), item])
    );

    return hearings.map((hearing) => {
      const matchedCase = caseMap.get(
        String(hearing.case_id)
      );

      return {
        ...hearing,

        case_title:
          hearing.case_title ||
          matchedCase?.case_title ||
          "Untitled Case",

        client_name:
          hearing.client_name ||
          matchedCase?.client_name ||
          "",
      };
    });
  }, [hearings, cases]);


  const upcoming = useMemo(
    () => hearingRows.filter(isUpcoming),
    [hearingRows]
  );

  const todayHearings = useMemo(
    () =>
      upcoming.filter(
        (hearing) => hearing.hearing_date === todayISO()
      ),
    [upcoming]
  );


  const completed = useMemo(
    () =>
      hearingRows.filter(
        (hearing) =>
          String(hearing.status || "").toLowerCase() ===
          "completed"
      ),
    [hearingRows]
  );

  const postponed = useMemo(
    () =>
      hearingRows.filter(
        (hearing) =>
          String(hearing.status || "").toLowerCase() ===
          "postponed"
      ),
    [hearingRows]
  );


  const thisWeek = useMemo(() => {
    const today = new Date(`${todayISO()}T12:00:00`);

    const monday = new Date(today);
    monday.setDate(
      today.getDate() - ((today.getDay() + 6) % 7)
    );

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const start = dateISO(monday);
    const end = dateISO(sunday);

    return upcoming.filter(
      (hearing) =>
        hearing.hearing_date >= start &&
        hearing.hearing_date <= end
    );
  }, [upcoming]);


  const tabs = [
    {
      id: "all",
      label: "All Hearings",
      count: hearingRows.length,
    },
    {
      id: "upcoming",
      label: "Upcoming",
      count: upcoming.length,
    },
    {
      id: "today",
      label: "Today",
      count: todayHearings.length,
    },
    {
      id: "week",
      label: "This Week",
      count: thisWeek.length,
    },
    {
      id: "completed",
      label: "Completed",
      count: completed.length,
    },
    {
      id: "postponed",
      label: "Postponed",
      count: postponed.length,
    },
  ];


  const filteredHearings = useMemo(() => {
    let rows = hearingRows;

    if (activeTab === "upcoming") rows = upcoming;
    if (activeTab === "today") rows = todayHearings;
    if (activeTab === "week") rows = thisWeek;
    if (activeTab === "completed") rows = completed;
    if (activeTab === "postponed") rows = postponed;

    if (selectedDate) {
      rows = rows.filter(
        (hearing) => hearing.hearing_date === selectedDate
      );
    }

    const query = search.toLowerCase().trim();

    if (query) {
      rows = rows.filter((hearing) =>
        [
          hearing.case_number,
          hearing.case_title,
          hearing.hearing_date,
          formatDate(hearing.hearing_date),
          hearing.purpose,
          hearing.court,
          hearing.location,
          hearing.status,
        ].some((value) =>
          String(value || "").toLowerCase().includes(query)
        )
      );
    }

    return [...rows].sort((a, b) =>
      activeTab === "completed" || activeTab === "postponed"
        ? b.hearing_date.localeCompare(a.hearing_date)
        : a.hearing_date.localeCompare(b.hearing_date)
    );
  }, [
    hearingRows,
    upcoming,
    todayHearings,
    thisWeek,
    postponed,
    completed,
    activeTab,
    selectedDate,
    search,
  ]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredHearings.length / pageSize)
  );

  const currentPage = Math.min(page, pageCount);

  const paginatedHearings = filteredHearings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const nextFive = [...upcoming]
    .sort((a, b) =>
      a.hearing_date.localeCompare(b.hearing_date)
    )
    .slice(0, 5);

  const displayName =
    user?.full_name || user?.name || "Lawyer";

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      sessionStorage.removeItem("advocanote_access_token");
      sessionStorage.removeItem("advocanote_refresh_token");
      navigate("/login", { replace: true });
    }
  };


  const completeSelectedHearing = async () => {
    if (!selectedHearing || completing) return;

    setCompleting(true);
    setCompleteError("");

    try {
      const token = sessionStorage.getItem(
        "advocanote_access_token"
      );

      const API_BASE = (
        import.meta.env.VITE_API_BASE_URL ||
        "http://127.0.0.1:8000"
      ).replace(/\/$/, "");

      const response = await fetch(
        `${API_BASE}/hearings/${selectedHearing.id}/complete`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.detail || "Could not complete hearing"
        );
      }

      const updatedHearings = await getHearings();

      setHearings(updatedHearings);
      setSelectedHearing(null);

    } catch (error) {
      setCompleteError(error.message);
    } finally {
      setCompleting(false);
    }
  };


  if (!user) return null;

  return (
    <>
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
          <Search size={23} />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search case number, client name, or hearing date..."
            aria-label="Search hearings"
          />
        </div>

        <div className="ald-topbar-actions">
          <div className="ald-dropdown-holder">
            <button
              type="button"
              className="ald-notify"
              onClick={() => {
                setNotificationOpen(!notificationOpen);
                setProfileOpen(false);
              }}
              aria-label="Hearing notifications"
            >
              <Bell size={26} />
            </button>

            {notificationOpen && (
              <div className="ald-top-popover ald-notifications-popover">
                <strong>Upcoming Hearings</strong>
                <p>
                  You have {upcoming.length} upcoming
                  hearing{upcoming.length === 1 ? "" : "s"}.
                </p>
              </div>
            )}
          </div>

          <div className="ald-topbar-divider" />

          <div className="ald-dropdown-holder">
            <button
              type="button"
              className="ald-account"
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotificationOpen(false);
              }}
            >
              <LawyerTopbarAvatar />

              <span className="ald-account-text">
                <strong>{displayName}</strong>
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
                  <UserRound size={17} />
                  My Profile
                </button>

                <button type="button" onClick={handleLogout}>
                  <LogOut size={17} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </LawyerTopbarPortal>

      <main className="hr-page">
        <div className="hr-layout">
          <div className="hr-primary">
            <div className="hr-heading-row hr-hero-banner">
              <div className="hr-page-title">
                <div>
                  <h1>Hearings</h1>
                  <p>
                    View all upcoming and past hearing
                    dates for your cases.
                  </p>
                </div>
              </div>

              <div className="hr-info-banner">
                <Info size={23} />
                <span>
                  Hearing dates come from your diary entries.
                  To add or update a hearing date, go to the
                  respective case diary and save the next date.
                </span>
              </div>

              <div className="hr-hero-image" aria-hidden="true" />
            </div>

            <div className="hr-tabs">
              {tabs.map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  className={
                    activeTab === tab.id ? "hr-tab active" : "hr-tab"
                  }
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedDate("");
                    setPage(1);
                  }}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {selectedDate && (
              <div className="hr-date-filter">
                Showing hearings for {formatDate(selectedDate)}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate("");
                    setPage(1);
                  }}
                >
                  Clear date <X size={15} />
                </button>
              </div>
            )}

            {error && (
              <p className="hr-error" role="alert">
                {error}
              </p>
            )}

            <div className="hr-table-card">
              <div className="hr-table-scroll">
                <table className="hr-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Case No</th>
                      <th>Case Title</th>
                      <th>Client Name</th>
                      <th>Purpose / Notes</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="hr-empty">
                          Loading hearings...
                        </td>
                      </tr>
                    ) : paginatedHearings.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="hr-empty">
                          {error
                            ? "Hearings could not be loaded."
                            : "No hearings found."}
                        </td>
                      </tr>
                    ) : (
                      paginatedHearings.map((hearing, index) => {
                        const status = hearingStatus(hearing);

                        return (
                          <tr key={hearing.id}>
                            <td>
                              {(currentPage - 1) *
                                pageSize + index + 1}
                            </td>

                            <td>
                              <div className="hr-date-cell">
                                <CalendarDays size={17} />

                                <span>
                                  <strong>
                                    {formatDate(
                                      hearing.hearing_date
                                    )}
                                  </strong>
                                  <small>
                                    {new Date(
                                      `${hearing.hearing_date}T12:00:00`
                                    ).toLocaleDateString("en-GB", {
                                      weekday: "short",
                                    })}
                                  </small>
                                </span>
                              </div>
                            </td>

                            <td>{hearing.case_number}</td>

                            <td>{hearing.case_title}</td>

                            <td>{hearing.client_name || "—"}</td>

                            <td>{hearing.purpose || "—"}</td>

                            <td>
                              <span
                                className={
                                  "hr-status " +
                                  status.toLowerCase()
                                }
                              >
                                <span className="hr-status-dot" />
                                {status}
                              </span>
                            </td>

                            <td>
                              <button
                                type="button"
                                className="hr-view-button"
                                onClick={() =>
                                  setSelectedHearing(hearing)
                                }
                                aria-label="View hearing details"
                              >
                                <Eye size={19} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>


              {/* ==========================================
    MOBILE HEARINGS LIST
    DESKTOP TABLE IS PRESERVED
========================================== */}

              <div className="hr-mobile-list">

                {loading ? (
                  <div className="hr-mobile-empty">
                    Loading hearings...
                  </div>
                ) : error && paginatedHearings.length === 0 ? (
                  <div className="hr-mobile-empty">
                    Unable to load hearings.
                  </div>
                ) : paginatedHearings.length === 0 ? (
                  <div className="hr-mobile-empty">
                    No hearings found.
                  </div>
                ) : (
                  paginatedHearings.map((hearing) => {
                    const status = hearingStatus(hearing);

                    return (
                      <article
                        className="hr-mobile-item"
                        key={hearing.id}
                      >

                        <div className="hr-mobile-item-top">

                          <div className="hr-mobile-case">
                            <small>CASE NUMBER</small>

                            <h3>
                              {hearing.case_number || "Not provided"}
                            </h3>
                          </div>

                          <span
                            className={
                              "hr-status " +
                              status.toLowerCase()
                            }
                          >
                            <span className="hr-status-dot" />
                            {status}
                          </span>

                        </div>

                        <dl className="hr-mobile-details">

                          <div>
                            <dt>Hearing Date</dt>
                            <dd>
                              <CalendarDays size={15} />
                              {formatDate(hearing.hearing_date)}
                            </dd>
                          </div>

                          <div>
                            <dt>Case Title</dt>
                            <dd>
                              {hearing.case_title || "—"}
                            </dd>
                          </div>

                          <div>
                            <dt>Client Name</dt>
                            <dd>
                              {hearing.client_name || "—"}
                            </dd>
                          </div>

                          <div>
                            <dt>Purpose / Notes</dt>
                            <dd>
                              {hearing.purpose || "—"}
                            </dd>
                          </div>

                        </dl>

                        <button
                          type="button"
                          className="hr-mobile-view"
                          onClick={() =>
                            setSelectedHearing(hearing)
                          }
                        >
                          <Eye size={17} />
                          View Hearing Details
                        </button>

                      </article>
                    );
                  })
                )}

              </div>


              {pageCount > 1 && (
                <div className="hr-pagination">
                  <span>
                    Page {currentPage} of {pageCount}
                  </span>

                  <div>
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() =>
                        setPage((value) => value - 1)
                      }
                    >
                      Previous
                    </button>

                    <button
                      type="button"
                      disabled={currentPage === pageCount}
                      onClick={() =>
                        setPage((value) => value + 1)
                      }
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="hr-sidebar">
            <HearingCalendar
              hearings={hearingRows}
              selectedDate={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setActiveTab("all");
                setPage(1);
              }}
            />

            <section className="hr-card hr-upcoming-card">
              <div className="hr-card-heading">
                <PieChart size={23} />

                <div>
                  <h3>Upcoming Hearings</h3>
                  <p>Next 5 hearings</p>
                </div>
              </div>

              <div className="hr-upcoming-list">
                {nextFive.length === 0 ? (
                  <p className="hr-empty-small">
                    No upcoming hearings.
                  </p>
                ) : (
                  nextFive.map((hearing) => {
                    const date = new Date(
                      `${hearing.hearing_date}T12:00:00`
                    );

                    return (
                      <button
                        key={hearing.id}
                        type="button"
                        className="hr-upcoming-item"
                        onClick={() =>
                          setSelectedHearing(hearing)
                        }
                      >
                        <span className="hr-upcoming-date">
                          <strong>{date.getDate()}</strong>
                          <small>
                            {date.toLocaleDateString("en-GB", {
                              month: "short",
                            })}
                          </small>
                        </span>

                        <span className="hr-upcoming-text">
                          <strong>
                            {hearing.case_number}
                          </strong>
                          <span>{hearing.case_title}</span>
                          <small>
                            {hearing.purpose || "No purpose added"}
                          </small>
                        </span>

                        <ChevronRight size={17} />
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="hr-card hr-summary-card">
              <div className="hr-card-heading">
                <PieChart size={23} />
                <h3>Hearing Summary</h3>
              </div>

              <div className="hr-summary-grid">
                <div className="hr-summary-box total">
                  <strong>{hearingRows.length}</strong>
                  <small>Total Hearings</small>
                </div>

                <div className="hr-summary-box upcoming">
                  <strong>{upcoming.length}</strong>
                  <small>Upcoming</small>
                </div>

                <div className="hr-summary-box today">
                  <strong>{todayHearings.length}</strong>
                  <small>Today</small>
                </div>

                <div className="hr-summary-box completed">
                  <strong>{completed.length}</strong>
                  <small>Completed </small>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>

      {selectedHearing && (
        <div
          className="hr-modal-backdrop"
          onClick={() => setSelectedHearing(null)}
        >
          <div
            className="hr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hr-modal-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="hr-modal-heading">
              <h2 id="hr-modal-heading">
                Hearing Details
              </h2>

              <button
                type="button"
                onClick={() => setSelectedHearing(null)}
                aria-label="Close hearing details"
              >
                <X size={22} />
              </button>
            </div>

            <div className="hr-modal-content">
              <p>
                <strong>Case Number:</strong>{" "}
                {selectedHearing.case_number}
              </p>

              <p>
                <strong>Case Title:</strong>{" "}
                {selectedHearing.case_title}
              </p>

              <p>
                <strong>Hearing Date:</strong>{" "}
                {formatDate(selectedHearing.hearing_date)}
              </p>

              <p>
                <strong>Court:</strong>{" "}
                {selectedHearing.court || "—"}
              </p>

              <p>
                <strong>Location:</strong>{" "}
                {selectedHearing.location || "—"}
              </p>

              <p>
                <strong>Purpose:</strong>{" "}
                {selectedHearing.purpose || "—"}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                {hearingStatus(selectedHearing)}
              </p>

              {selectedHearing.reschedule_reason && (
                <p>
                  <strong>Reschedule Reason:</strong>{" "}
                  {selectedHearing.reschedule_reason}
                </p>
              )}
            </div>


            {String(selectedHearing.status || "").toLowerCase() ===
              "scheduled" &&
              selectedHearing.hearing_date <= todayISO() && (
                <button
                  type="button"
                  className="hr-complete-button"
                  disabled={completing}
                  onClick={completeSelectedHearing}
                >
                  {completing
                    ? "Saving..."
                    : "Mark as Completed"}
                </button>
              )}

            {completeError && (
              <p className="hr-error" role="alert">
                {completeError}
              </p>
            )}


            {selectedHearing.diary_entry_id && (
              <button
                type="button"
                className="hr-diary-link"
                onClick={() =>
                  navigate(
                    `/diary-entry-details/${selectedHearing.diary_entry_id}`
                  )
                }
              >
                View Diary Entry
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
