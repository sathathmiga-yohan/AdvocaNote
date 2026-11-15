
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getLawyerCases } from "../services/diary";
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gavel,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";

import {
  useLawyerLayout,
  LawyerTopbarPortal,
  LawyerTopbarAvatar,
} from "../components/LawyerLayout";
import { logoutUser } from "../services/auth";

import "./MyLegalDiary.css";
import "./Calendar.css";

// Temporary preview events.
// Real events can be supplied through initialEvents.
const previewEvents = [
  {
    id: 1,
    title: "Client Meeting",
    date: "2026-11-05",
    type: "custom",
    time: "10:00 AM",
  },
  {
    id: 2,
    title: "Hearing - 05",
    date: "2026-11-05",
    type: "hearing",
    caseNo: "05",
  },
  {
    id: 3,
    title: "Hearing - 23",
    date: "2026-11-07",
    type: "hearing",
    caseNo: "23",
  },
  {
    id: 4,
    title: "Hearing - 26",
    date: "2026-11-30",
    type: "hearing",
    caseNo: "26",
  },
  {
    id: 5,
    title: "Hearing - 11",
    date: "2026-10-02",
    type: "hearing",
  },
  {
    id: 6,
    title: "Hearing - 15",
    date: "2026-10-12",
    type: "hearing",
  },
  {
    id: 7,
    title: "Hearing - 18",
    date: "2026-10-19",
    type: "hearing",
  },
  {
    id: 8,
    title: "Hearing - 20",
    date: "2026-09-10",
    type: "hearing",
  },
  {
    id: 9,
    title: "Hearing - 22",
    date: "2026-08-20",
    type: "hearing",
  },
];

const weekdays = [
  "Sun", "Mon", "Tue", "Wed",
  "Thu", "Fri", "Sat",
];

const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const parseDate = (key) => {
  const [year, month, day] = key.split("-").map(Number);

  return new Date(year, month - 1, day);
};

const longDate = (key) => {
  return parseDate(key).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const monthLabel = (date) => {
  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
};

const FILTERS = [
  {
    id: "all",
    label: "All Events",
    icon: CalendarDays,
  },
  {
    id: "hearing",
    label: "Hearings",
    icon: Gavel,
  },
  {
    id: "task",
    label: "Tasks & Deadlines",
    icon: ListChecks,
  },
  {
    id: "custom",
    label: "Custom Events",
    icon: CalendarPlus,
  },
];


/* ==========================================
   CALENDAR - TASKS BACKEND INTEGRATION
========================================== */

const CALENDAR_API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

// =====================================
// CALENDAR BACKEND API
// =====================================

async function calendarApiRequest(path, options = {}) {
  const token = sessionStorage.getItem(
    "advocanote_access_token"
  );

  if (!token) {
    throw new Error(
      "Session expired. Please log in again."
    );
  }

  const response = await fetch(
    `${CALENDAR_API_BASE}${path}`,
    {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(options.body
        ? { body: JSON.stringify(options.body) }
        : {}),
    }
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Calendar request failed (${response.status})`
    );
  }

  return data;
}

function calendarNormalizeList(response, key) {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.[key])) {
    return response[key];
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  return [];
}

async function calendarTaskRequest(path) {
  const token = sessionStorage.getItem(
    "advocanote_access_token"
  );

  if (!token) {
    throw new Error(
      "Session expired. Please log in again."
    );
  }

  const response = await fetch(
    `${CALENDAR_API_BASE}${path}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Could not load tasks (${response.status})`
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

async function getCalendarTasks() {
  try {
    // First try the same /tasks endpoint
    // used by TasksPremium.jsx.

    const response = await calendarTaskRequest(
      "/tasks"
    );

    if (
      !Array.isArray(response) &&
      !Array.isArray(response?.tasks) &&
      !Array.isArray(response?.items)
    ) {
      throw new Error(
        "Unexpected tasks response format."
      );
    }

    return calendarNormalizeList(
      response,
      "tasks"
    );
  } catch (error) {
    // Only use the case-wise fallback
    // when /tasks returns 404.

    if (error.status !== 404) {
      throw error;
    }

    const casesResponse = await getLawyerCases();

    const cases = calendarNormalizeList(
      casesResponse,
      "cases"
    );

    if (cases.length === 0) {
      return [];
    }

    const results = await Promise.allSettled(
      cases.map((item) =>
        calendarTaskRequest(
          `/tasks/case/${encodeURIComponent(item.id)}`
        )
      )
    );

    if (
      results.every(
        (result) => result.status === "rejected"
      )
    ) {
      throw new Error(
        "Could not load tasks from the backend."
      );
    }

    return results.flatMap((result) =>
      result.status === "fulfilled"
        ? calendarNormalizeList(result.value, "tasks")
        : []
    );
  }
}

export default function Calendar({
  initialEvents = [],
  onCreateEvent,
  onEventClick,
}) {
  const navigate = useNavigate();


  const { user, openSidebar } = useLawyerLayout();
  console.log("CALENDAR COMPONENT RENDERED");

  // TOP NAVBAR STATES
  const [globalSearch, setGlobalSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [clockNow, setClockNow] = useState(() => new Date());

  const [reminderSettings, setReminderSettings] = useState({
    hearing_reminders: false,
    task_reminders: false,
  });

  useEffect(() => {
    if (!user?.id) return;

    let active = true;

    async function loadReminderSettings() {
      try {
        const data = await calendarApiRequest("/profile/me");

        if (active) {
          const prefs = data?.profile?.notification_preferences;

          setReminderSettings({
            hearing_reminders: prefs?.hearing_reminders === true,
            task_reminders: prefs?.task_reminders === true,
          });
        }
      } catch (error) {
        console.error("Reminder settings error:", error);
      }
    }

    loadReminderSettings();

    window.addEventListener("focus", loadReminderSettings);

    return () => {
      active = false;
      window.removeEventListener("focus", loadReminderSettings);
    };
  }, [user?.id]);


  const [readReminderIds, setReadReminderIds] = useState([]);

  useEffect(() => {
    if (!user?.id) {
      setReadReminderIds([]);
      return;
    }

    const key = `advocanote_calendar_read_${user.id}`;

    try {
      const saved = JSON.parse(
        localStorage.getItem(key) || "[]"
      );

      setReadReminderIds(
        Array.isArray(saved) ? saved : []
      );
    } catch {
      setReadReminderIds([]);
    }
  }, [user?.id]);


  useEffect(() => {
    const timer = setInterval(() => {
      setClockNow(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // CALENDAR STATES
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );
  });

  const [selectedDate, setSelectedDate] = useState(
    () => dateKey(new Date())
  );

  const [events, setEvents] = useState(initialEvents);

  /* ==========================================
     TASKS AUTO SYNC
  ========================================== */

  const [taskEvents, setTaskEvents] = useState([]);

  const [taskSyncError, setTaskSyncError] = useState("");


  const [calendarLoadError, setCalendarLoadError] =
    useState("");

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    async function loadRealEvents() {
      try {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();

        // Current month + next month.
        // Fits backend's 62-day maximum window.
        const startDate = dateKey(
          new Date(year, month, 1)
        );

        const endDate = dateKey(
          new Date(year, month + 2, 0)
        );

        const response = await calendarApiRequest(
          `/calendar/events?start_date=${startDate}&end_date=${endDate}`
        );

        if (cancelled) return;

        const items = Array.isArray(response?.events)
          ? response.events
          : [];


        // Get actual case numbers from My Cases
        let casesById = new Map();

        try {
          const casesResponse = await getLawyerCases();

          const caseList = calendarNormalizeList(
            casesResponse,
            "cases"
          );

          casesById = new Map(
            caseList.map((caseItem) => [
              String(caseItem.id),
              String(caseItem.case_number || "").trim(),
            ])
          );
        } catch (error) {
          console.error(
            "Could not load case numbers:",
            error
          );
        }

        if (cancelled) return;


        // Tasks are already loaded separately.
        // Exclude them here to avoid duplicates.

        const realEvents = items
          .filter((item) =>
            ["hearing", "postponed", "custom"].includes(
              item.type
            )
          )
          .map((item) => {
            const isHearing =
              item.type === "hearing" ||
              item.type === "postponed";

            const caseId =
              item.case_id ?? item.case?.id;

            // Get real Case No, not Hearing ID
            const caseNo = String(
              item.case_number ||
              item.caseNo ||
              item.case?.case_number ||
              (caseId != null
                ? casesById.get(String(caseId))
                : "") ||
              ""
            ).trim();

            return {
              ...item,

              type:
                item.type === "postponed"
                  ? "hearing"
                  : item.type,

              caseNo,

              // Show actual Case No for hearings
              title: isHearing
                ? caseNo
                  ? `Case No: ${caseNo}`
                  : "Hearing"
                : item.title,

              time: item.time
                ? String(item.time).slice(0, 5)
                : "",
            };
          });


        setEvents(realEvents);
        setCalendarLoadError("");
      } catch (err) {
        if (cancelled) return;

        setCalendarLoadError(
          err.message || "Could not load calendar events."
        );
      }
    }

    loadRealEvents();

    window.addEventListener("focus", loadRealEvents);

    return () => {
      cancelled = true;

      window.removeEventListener(
        "focus",
        loadRealEvents
      );
    };
  }, [user?.id, viewDate]);


  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    async function loadCalendarTasks() {
      try {
        const tasks = await getCalendarTasks();

        if (cancelled) return;

        const uniqueTasks = new Map();

        tasks.forEach((task) => {
          // Tasks without deadlines cannot be
          // positioned on a calendar date.
          const deadline = String(
            task.deadline || ""
          ).slice(0, 10);

          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
            task.id == null
          ) {
            return;
          }

          uniqueTasks.set(String(task.id), {
            id: `backend-task-${task.id}`,
            taskId: task.id,
            title: task.title || "Untitled Task",
            date: deadline,
            type: "task",
            caseNo: task.case_number || "",
            priority: task.priority || "Medium",
            status: task.status || "Pending",
          });
        });

        setTaskEvents(
          Array.from(uniqueTasks.values())
        );

        setTaskSyncError("");
      } catch (error) {
        if (!cancelled) {
          setTaskSyncError(
            error.message || "Could not load tasks."
          );
        }
      }
    }

    // Load tasks when the Calendar page opens.
    loadCalendarTasks();

    // Refresh if user returns to this browser tab.
    window.addEventListener(
      "focus",
      loadCalendarTasks
    );

    return () => {
      cancelled = true;

      window.removeEventListener(
        "focus",
        loadCalendarTasks
      );
    };
  }, [user?.id]);

  /* Combine existing hearings/custom events
     with actual backend tasks. */

  const allEvents = useMemo(() => {
    return [
      ...events,
      ...taskEvents,
    ];
  }, [events, taskEvents]);

  const calendarBellReminders = useMemo(() => {
    const now = clockNow.getTime();

    return allEvents
      .filter((event) => {
        if (event.type === "custom") {
          return true;
        }

        if (event.type === "hearing") {
          return (
            reminderSettings.hearing_reminders &&
            String(event.status).toLowerCase() === "scheduled"
          );
        }

        if (event.type === "task") {
          return (
            reminderSettings.task_reminders &&
            !["completed", "cancelled"].includes(
              String(event.status || "Pending").toLowerCase()
            )
          );
        }

        return false;
      })
      .map((event) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date || "")) {
          return null;
        }

        let reminderAt;
        let expiresAt;

        if (event.type === "custom") {
          const time = /^\d{2}:\d{2}/.test(event.time || "")
            ? event.time.slice(0, 5)
            : null;

          const eventAt = new Date(
            `${event.date}T${time || "09:00"}:00`
          ).getTime();

          reminderAt = time
            ? eventAt - 30 * 60 * 1000
            : eventAt;

          expiresAt = time
            ? eventAt + 60 * 60 * 1000
            : new Date(
              `${event.date}T23:59:59`
            ).getTime();
        } else {
          // Hearing and Task: one day before, 9 AM
          const before = parseDate(event.date);

          before.setDate(before.getDate() - 1);
          before.setHours(9, 0, 0, 0);

          reminderAt = before.getTime();

          const dueDate = parseDate(event.date);
          dueDate.setHours(23, 59, 59, 999);

          expiresAt = dueDate.getTime();
        }

        return {
          ...event,
          reminderAt,
          expiresAt,
        };
      })
      .filter(
        (event) =>
          event &&
          now >= event.reminderAt &&
          now <= event.expiresAt
      )
      .sort((a, b) => a.reminderAt - b.reminderAt);
  }, [allEvents, clockNow, reminderSettings]);

  const unreadCalendarReminders = useMemo(() => {
    return calendarBellReminders.filter(
      (event) =>
        !readReminderIds.includes(String(event.id))
    );
  }, [calendarBellReminders, readReminderIds]);

  function markCalendarReminderRead(eventId) {
    if (!user?.id) return;

    const key = `advocanote_calendar_read_${user.id}`;

    setReadReminderIds((previous) => {
      const updated = [
        ...new Set([
          ...previous,
          String(eventId),
        ]),
      ];

      localStorage.setItem(
        key,
        JSON.stringify(updated)
      );

      return updated;
    });
  }


  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState("month");

  // ADD EVENT STATES
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    date: dateKey(new Date()),
    type: "custom",
    time: "",
    caseNo: "",
  });

  const todayKey = dateKey(new Date());

  const displayName = user?.full_name || "Lawyer";


  /* ==========================================
     UPDATED CALENDAR EVENT COUNTS
  ========================================== */

  const counts = useMemo(() => ({
    all: allEvents.length,

    hearing: allEvents.filter(
      (event) => event.type === "hearing"
    ).length,

    task: allEvents.filter(
      (event) => event.type === "task"
    ).length,

    custom: allEvents.filter(
      (event) => event.type === "custom"
    ).length,

  }), [allEvents]);

  /* ==========================================
     SEARCH + EVENT FILTERS
  ========================================== */

  const filteredEvents = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();

    return allEvents.filter((event) => {
      const matchesFilter =
        filter === "all" ||
        event.type === filter;

      const matchesSearch =
        !query ||
        [
          event.title,
          event.caseNo,
          event.date,
          event.time,
          event.type,
          event.priority,
          event.status,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

      return matchesFilter && matchesSearch;
    });

  }, [allEvents, filter, globalSearch]);


  // =====================================
  // CURRENT MONTH EVENTS
  // =====================================

  const monthPrefix =
    `${viewDate.getFullYear()}-` +
    `${String(viewDate.getMonth() + 1).padStart(2, "0")}-`;

  const monthEvents = filteredEvents.filter(
    (event) => event.date?.startsWith(monthPrefix)
  );

  // SELECTED DATE EVENTS
  const selectedEvents = filteredEvents.filter(
    (event) => event.date === selectedDate
  );

  // UPCOMING EVENTS
  const upcoming = [...filteredEvents]
    .filter((event) => event.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  // =====================================
  // BUILD CALENDAR GRID
  // =====================================

  const firstWeekday = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1
  ).getDay();

  const daysInMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() + 1,
    0
  ).getDate();

  const numberOfCells = Math.max(
    35,
    Math.ceil((firstWeekday + daysInMonth) / 7) * 7
  );

  const cells = Array.from(
    { length: numberOfCells },
    (_, index) => {
      const day = index - firstWeekday + 1;

      if (day < 1 || day > daysInMonth) {
        return null;
      }

      return dateKey(
        new Date(
          viewDate.getFullYear(),
          viewDate.getMonth(),
          day
        )
      );
    }
  );

  // =====================================
  // CALENDAR NAVIGATION
  // =====================================

  function selectDay(key) {
    setSelectedDate(key);

    const date = parseDate(key);

    if (
      date.getMonth() !== viewDate.getMonth() ||
      date.getFullYear() !== viewDate.getFullYear()
    ) {
      setViewDate(
        new Date(
          date.getFullYear(),
          date.getMonth(),
          1
        )
      );
    }
  }

  function moveMonth(step) {
    const nextMonth = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth() + step,
      1
    );

    setViewDate(nextMonth);
    setSelectedDate(dateKey(nextMonth));
  }

  function goToday() {
    const now = new Date();

    setViewDate(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      )
    );

    setSelectedDate(dateKey(now));
  }

  // =====================================
  // ADD EVENT
  // =====================================

  function openCreate(date = selectedDate) {
    setForm({
      title: "",
      date,
      type: "custom",
      time: "",
      caseNo: "",
    });

    setError("");
    setShowAdd(true);
  }


  async function saveEvent(e) {
    e.preventDefault();

    if (!form.title.trim()) {
      setError("Enter an event title.");
      return;
    }

    if (!form.date) {
      setError("Choose an event date.");
      return;
    }

    if (form.type !== "custom") {
      setError(
        "Please add hearings and case tasks from their respective pages."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        title: form.title.trim(),
        event_date: form.date,
        event_time: form.time || null,
        kind: "Custom",
        notes: form.caseNo.trim()
          ? `Case No: ${form.caseNo.trim()}`
          : "",
      };

      const created = await calendarApiRequest(
        "/calendar/events",
        {
          method: "POST",
          body: payload,
        }
      );

      const newEvent = {
        ...created,
        type: "custom",
        caseNo: form.caseNo.trim(),
        time: created.time
          ? String(created.time).slice(0, 5)
          : "",
      };

      setEvents((previous) => {
        const withoutDuplicate = previous.filter(
          (item) => item.id !== newEvent.id
        );

        return [...withoutDuplicate, newEvent];
      });

      selectDay(newEvent.date);
      setShowAdd(false);
    } catch (err) {
      setError(
        err.message || "Could not save event."
      );
    } finally {
      setSaving(false);
    }
  }
  function openEvent(event) {
    selectDay(event.date);

    if (onEventClick) {
      onEventClick(event);
    }
  }

  // =====================================
  // LOGOUT
  // =====================================

  async function signOut() {
    try {
      await logoutUser();
    } catch {
      // Continue clearing local session
    }

    sessionStorage.removeItem(
      "advocanote_access_token"
    );

    sessionStorage.removeItem(
      "advocanote_refresh_token"
    );

    navigate("/login", { replace: true });
  }

  // =====================================
  // MAIN JSX
  // =====================================

  return (
    <>

      {/* ===============================
          TOP NAVBAR
      =============================== */}

      <LawyerTopbarPortal>

        {/* MOBILE SIDEBAR BUTTON */}

        <button
          className="ald-mobile-menu"
          type="button"
          onClick={openSidebar}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        {/* GLOBAL SEARCH */}

        <div className="ald-global-search">

          <Search size={20} />

          <input
            type="search"
            value={globalSearch}
            onChange={(e) =>
              setGlobalSearch(e.target.value)
            }
            placeholder="Search hearings, tasks, or events..."
            aria-label="Search calendar"
          />

        </div>

        {/* NAVBAR RIGHT ACTIONS */}

        <div className="ald-topbar-actions">

          {/* NOTIFICATION BELL */}


          {/* DIVIDER */}

          <div className="ald-topbar-divider" />

          {/* USER PROFILE */}

          <div className="ald-dropdown-holder">

            <button
              type="button"
              className="ald-account"
              onClick={() => {
                setProfileOpen((previous) => !previous);
                setBellOpen(false);
              }}
              aria-label="Account menu"
            >

              <LawyerTopbarAvatar />

              <span className="ald-account-text">

                <strong>{displayName}</strong>

                <small>Attorney-at-Law</small>

              </span>

              <ChevronDown size={18} />

            </button>

            {/* PROFILE DROPDOWN */}

            {profileOpen && (

              <div className="ald-top-popover ald-account-popover">

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate("/profile");
                  }}
                >
                  <UserRound size={16} />
                  My Profile
                </button>

                <button
                  type="button"
                  onClick={signOut}
                >
                  <LogOut size={16} />
                  Logout
                </button>

              </div>

            )}

          </div>

        </div>

      </LawyerTopbarPortal>

      {/* ===============================
          CALENDAR PAGE
      =============================== */}

      <div className="acp-page">

        <div className="acp-layout">

          {/* LEFT MAIN CONTENT */}

          <main className="acp-main">

            {/* CALENDAR BANNER */}

            {/* CALENDAR BANNER */}

            <section className="acp-hero">

              <div className="acp-hero-copy">
                <h1>Calendar</h1>

                <p>
                  Manage your hearings, tasks and personal
                  events in one place.
                </p>
              </div>

            </section>


            {/* MAIN CALENDAR */}

            <section className="acp-calendar-card">



              {/* MONTH HEADER */}

              <div className="acp-month-header acp-month-header-split">

                {/* LEFT - MONTH TITLE AND ARROWS */}

                <div className="acp-month-title">

                  <div className="acp-month-title-row">

                    <h2>{monthLabel(viewDate)}</h2>

                    <div className="acp-month-nav">

                      <button
                        type="button"
                        onClick={() => moveMonth(-1)}
                        aria-label="Previous month"
                      >
                        <ChevronLeft size={17} />
                      </button>

                      <button
                        type="button"
                        onClick={() => moveMonth(1)}
                        aria-label="Next month"
                      >
                        <ChevronRight size={17} />
                      </button>

                    </div>

                  </div>

                  <p>
                    {monthEvents.length}{" "}
                    {monthEvents.length === 1 ? "event" : "events"}{" "}
                    this month
                  </p>

                </div>

                {/* RIGHT SIDE CONTROLS */}

                <div className="acp-month-actions acp-month-actions-right">

                  <button
                    type="button"
                    onClick={goToday}
                  >
                    Today
                  </button>

                  <div className="acp-view-switch">

                    <button
                      type="button"
                      className={viewMode === "month" ? "active" : ""}
                      onClick={() => setViewMode("month")}
                    >
                      Month
                    </button>

                    <button
                      type="button"
                      className={viewMode === "list" ? "active" : ""}
                      onClick={() => setViewMode("list")}
                    >
                      List
                    </button>

                  </div>

                  {/* ADD EVENT - AFTER LIST */}

                  <button
                    type="button"
                    className="acp-add-btn acp-header-add-btn"
                    onClick={() => openCreate()}
                  >
                    <CalendarPlus size={17} />
                    Add Event
                  </button>

                </div>

              </div>


              {/* =====================
                  MONTH VIEW
              ===================== */}

              {viewMode === "month" ? (

                <div className="acp-month-grid">

                  {/* WEEKDAYS */}

                  {weekdays.map((day) => (

                    <div
                      className="acp-weekday"
                      key={day}
                    >
                      {day}
                    </div>

                  ))}

                  {/* CALENDAR DATES */}

                  {cells.map((key, index) => {

                    const dayEvents = key
                      ? monthEvents.filter(
                        (event) =>
                          event.date === key
                      )
                      : [];

                    return (

                      <div
                        key={key ?? `blank-${index}`}
                        className={[
                          "acp-day",
                          !key ? "is-blank" : "",
                          key === selectedDate
                            ? "is-selected"
                            : "",
                        ].join(" ")}
                      >

                        {key && (
                          <>

                            {/* DATE NUMBER */}

                            <button
                              type="button"
                              className={[
                                "acp-day-num",
                                key === todayKey
                                  ? "is-today"
                                  : "",
                              ].join(" ")}
                              onClick={() =>
                                selectDay(key)
                              }
                              aria-label={
                                `Select ${longDate(key)}`
                              }
                            >
                              {parseDate(key).getDate()}
                            </button>

                            {/* DATE EVENTS */}

                            <div className="acp-day-events">

                              {dayEvents
                                .slice(0, 3)
                                .map((event) => (

                                  <button
                                    type="button"
                                    key={event.id}
                                    className={
                                      `acp-event acp-event-${event.type}`
                                    }
                                    onClick={() =>
                                      openEvent(event)
                                    }
                                    title={event.title}
                                  >
                                    {event.title}
                                  </button>

                                ))}

                              {dayEvents.length > 3 && (

                                <button
                                  type="button"
                                  className="acp-more"
                                  onClick={() =>
                                    selectDay(key)
                                  }
                                >
                                  +{dayEvents.length - 3} more
                                </button>

                              )}

                            </div>

                          </>
                        )}

                      </div>

                    );

                  })}

                </div>

              ) : (

                /* =====================
                   LIST VIEW
                ===================== */

                <div className="acp-event-list">

                  {monthEvents.length === 0 ? (

                    <p className="acp-muted">
                      No events for this month.
                    </p>

                  ) : (

                    [...monthEvents]
                      .sort((a, b) =>
                        a.date.localeCompare(b.date)
                      )
                      .map((event) => (

                        <button
                          type="button"
                          key={event.id}
                          className="acp-list-row"
                          onClick={() =>
                            openEvent(event)
                          }
                        >

                          <span className="acp-list-date">
                            {parseDate(
                              event.date
                            ).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                              }
                            )}
                          </span>

                          <span>
                            {event.title}
                          </span>

                          <span className="acp-type-label">
                            {event.type}
                          </span>

                          <ChevronRight size={16} />

                        </button>

                      ))

                  )}

                </div>

              )}


              {/* CALENDAR FOOTER */}

              <div className="acp-calendar-footer">

                <span>
                  Click any date to view its hearings,
                  tasks and events.
                </span>

                <div className="acp-legend">

                  <span className="acp-legend-entry">
                    <span className="acp-legend-dot hearing" />
                    Hearing
                  </span>

                  <span className="acp-legend-entry">
                    <span className="acp-legend-dot task" />
                    Tasks & Deadlines
                  </span>

                  <span className="acp-legend-entry">
                    <span className="acp-legend-dot custom" />
                    Custom Event
                  </span>

                </div>

              </div>

              {/* TASK SYNC ERROR MESSAGE */}


              {taskSyncError && (
                <p className="acp-error">
                  Tasks could not sync: {taskSyncError}
                </p>
              )}

              {calendarLoadError && (
                <p className="acp-error">
                  Calendar events could not load: {calendarLoadError}
                </p>
              )}


            </section>


          </main>

          {/* ===============================
              RIGHT SIDEBAR
          =============================== */}

          <aside className="acp-sidebar">

            {/* SELECTED DATE */}

            <section className="acp-side-card acp-selected-card">

              <div className="acp-side-heading">

                <div>
                  <CalendarDays size={19} />
                  <h2>Selected Date</h2>
                </div>

                <button
                  type="button"
                  className="acp-side-plus"
                  onClick={() =>
                    openCreate(selectedDate)
                  }
                  aria-label="Add event"
                >
                  <Plus size={18} />
                </button>

              </div>

              <p className="acp-selected-date">
                {longDate(selectedDate)}
              </p>

              {selectedEvents.length === 0 ? (

                <p className="acp-muted">
                  No events on this date.
                </p>

              ) : (

                <div className="acp-selected-events">

                  {selectedEvents.map((event) => (

                    <button
                      type="button"
                      key={event.id}
                      className={
                        `acp-event acp-event-${event.type}`
                      }
                      onClick={() =>
                        openEvent(event)
                      }
                    >
                      {event.title}
                    </button>

                  ))}

                </div>

              )}

            </section>

            {/* =====================
                UPCOMING EVENTS
            ===================== */}

            <section className="acp-side-card acp-upcoming-card">

              <div className="acp-side-heading">

                <div>
                  <Clock3 size={19} />
                  <h2>Upcoming Events</h2>
                </div>

              </div>

              <div className="acp-upcoming-list">

                {upcoming.length === 0 ? (

                  <p className="acp-muted">
                    No upcoming events.
                  </p>

                ) : (

                  upcoming.map((event) => {

                    const date = parseDate(
                      event.date
                    );

                    return (

                      <button
                        type="button"
                        key={event.id}
                        className="acp-upcoming-row"
                        onClick={() =>
                          openEvent(event)
                        }
                      >

                        <span className="acp-date-chip">

                          <strong>
                            {String(
                              date.getDate()
                            ).padStart(2, "0")}
                          </strong>

                          <small>
                            {date.toLocaleString(
                              "en-GB",
                              { month: "short" }
                            ).toUpperCase()}
                          </small>

                        </span>

                        <span className="acp-upcoming-info">

                          <strong>
                            {event.title}
                          </strong>

                          <small>
                            {event.time || "All day"}
                          </small>

                        </span>

                        <ChevronRight size={17} />

                      </button>

                    );

                  })

                )}

              </div>

            </section>

            {/* =====================
                EVENT FILTERS
            ===================== */}

            <section className="acp-side-card acp-filters-card">

              <div className="acp-side-heading acp-filter-heading">

                <div>
                  <SlidersHorizontal size={18} />
                  <h2>Event Filters</h2>
                </div>

                <small>
                  View by type
                </small>

              </div>

              <div className="acp-filter-list">

                {FILTERS.map((item) => {

                  const Icon = item.icon;

                  return (

                    <button
                      type="button"
                      key={item.id}
                      className={[
                        "acp-filter-btn",
                        filter === item.id
                          ? "active"
                          : "",
                      ].join(" ")}
                      onClick={() =>
                        setFilter(item.id)
                      }
                      aria-pressed={
                        filter === item.id
                      }
                    >

                      <span>
                        <Icon size={16} />
                        {item.label}
                      </span>

                      <strong>
                        {counts[item.id]}
                      </strong>

                    </button>

                  );

                })}

              </div>

            </section>

          </aside>

        </div>

        {/* ===============================
            ADD EVENT MODAL
        =============================== */}

        {showAdd && (

          <div
            className="acp-overlay"
            onMouseDown={(e) => {
              if (
                e.target === e.currentTarget
              ) {
                setShowAdd(false);
              }
            }}
          >

            <section
              className="acp-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Add event"
            >

              {/* MODAL HEADER */}

              <div className="acp-dialog-head">

                <h2>Add Event</h2>

                <button
                  type="button"
                  onClick={() =>
                    setShowAdd(false)
                  }
                  aria-label="Close"
                >
                  <X size={19} />
                </button>

              </div>

              {/* ADD EVENT FORM */}

              <form onSubmit={saveEvent}>

                <label>

                  Event title

                  <input
                    type="text"
                    placeholder="e.g. Case hearing"
                    value={form.title}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        title: e.target.value,
                      })
                    }
                    required
                  />

                </label>

                {/* DATE + EVENT TYPE */}

                <div className="acp-form-row">

                  <label>

                    Date

                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          date: e.target.value,
                        })
                      }
                      required
                    />

                  </label>


                  <label>
                    Event type

                    <select
                      value={form.type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          type: e.target.value,
                        })
                      }
                    >
                      <option value="custom">
                        Custom Event
                      </option>
                    </select>
                  </label>


                </div>

                {/* TIME + CASE NUMBER */}

                <div className="acp-form-row">

                  <label>

                    Time (optional)

                    <input
                      type="time"
                      placeholder="e.g. 10:00 AM"
                      value={form.time}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          time: e.target.value,
                        })
                      }
                    />

                  </label>

                  <label>

                    Case No. (optional)

                    <input
                      type="text"
                      placeholder="e.g. 05"
                      value={form.caseNo}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          caseNo: e.target.value,
                        })
                      }
                    />

                  </label>

                </div>

                {/* ERROR MESSAGE */}

                {error && (

                  <p className="acp-error">
                    {error}
                  </p>

                )}

                {/* FORM BUTTONS */}

                <div className="acp-dialog-actions">

                  <button
                    type="button"
                    onClick={() =>
                      setShowAdd(false)
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="acp-save"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : "Save Event"}
                  </button>

                </div>

              </form>

            </section>

          </div>

        )}

      </div>

    </>
  );
}
