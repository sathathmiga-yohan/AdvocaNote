
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    AlertTriangle,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Clock3,
    EllipsisVertical,
    Folder,
    Gavel,
    Hourglass,
    ListFilter,
    LogOut,
    Menu,
    Pencil,
    Plus,
    Search,
    SlidersHorizontal,
    Trash2,
    UserRound,
    X,
} from "lucide-react";

import {
    useLawyerLayout,
    LawyerTopbarPortal,
    LawyerTopbarAvatar,
} from "../components/LawyerLayout";

import { logoutUser } from "../services/auth";
import { getLawyerCases } from "../services/diary";

import "./MyLegalDiary.css";
import "./TasksPremium.css";

const API_BASE = (
    import.meta.env.VITE_API_BASE_URL ||
    "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const pad = (n) => String(n).padStart(2, "0");

function isoDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function readDate(value) {
    if (!value) return null;
    const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 12);
}

function formatDate(value) {
    const date = readDate(value);
    return date
        ? date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
        : "No deadline";
}

function normalizeArray(response, key) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.items)) return response.items;
    return [];
}

function taskState(task) {
    if (String(task.status).toLowerCase() === "completed") {
        return "Completed";
    }

    if (task.deadline && task.deadline.slice(0, 10) < isoDate(new Date())) {
        return "Overdue";
    }

    return "Pending";
}

async function apiRequest(path, options = {}) {
    const token = localStorage.getItem("advocanote_access_token");

    if (!token) {
        throw new Error("Session expired. Please log in again.");
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(options.headers || {}),
        },
    });

    const data = await response.json().catch(() => null);


    if (!response.ok) {
        const detail = data?.detail;

        const error = new Error(
            typeof detail === "string"
                ? detail
                : `Request failed (${response.status})`
        );

        error.status = response.status;
        throw error;
    }


    return data;
}


function MiniCalendar({
    month,
    setMonth,
    selected,
    setSelected,
    tasks = [],
}) {
    const year = month.getFullYear();
    const monthNumber = month.getMonth();

    const firstDay = new Date(year, monthNumber, 1).getDay();

    const daysInMonth = new Date(
        year,
        monthNumber + 1,
        0
    ).getDate();

    const cells = [
        ...Array(firstDay).fill(null),
        ...Array.from(
            { length: daysInMonth },
            (_, index) => index + 1
        ),
    ];

    const deadlineDates = new Set(
        tasks
            .map((task) => task.deadline?.slice(0, 10))
            .filter(Boolean)
    );

    const currentMonthPrefix =
        `${year}-${String(monthNumber + 1).padStart(2, "0")}`;

    const visibleSelectedDate =
        selected?.startsWith(currentMonthPrefix)
            ? selected
            : null;

    const selectedTasks = visibleSelectedDate
        ? tasks.filter(
            (task) =>
                task.deadline?.slice(0, 10) === visibleSelectedDate
        )
        : [];

    const changeMonth = (direction) => {
        setMonth(
            new Date(year, monthNumber + direction, 1)
        );
    };

    return (
        <section className="tp-panel tp-calendar tp-calendar-v2">

            {/* CALENDAR HEADER */}
            <div className="tp-mini-calendar-head">

                <div className="tp-mini-heading">
                    <span className="tp-mini-icon">
                        <CalendarDays size={20} />
                    </span>

                    <div className="tp-mini-heading-text">
                        <h3>
                            {month.toLocaleDateString("en-GB", {
                                month: "long",
                                year: "numeric",
                            })}
                        </h3>

                        <span>Monthly task planner</span>
                    </div>
                </div>

                <div className="tp-mini-navigation">
                    <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                        aria-label="Previous month"
                    >
                        <ChevronLeft size={18} />
                    </button>

                    <button
                        type="button"
                        onClick={() => changeMonth(1)}
                        aria-label="Next month"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            <div className="tp-mini-divider" />

            {/* CALENDAR DATES */}
            <div className="tp-mini-calendar-grid">

                {["S", "M", "T", "W", "T", "F", "S"].map(
                    (day, index) => (
                        <span
                            className="tp-mini-weekday"
                            key={`weekday-${index}`}
                        >
                            {day}
                        </span>
                    )
                )}

                {cells.map((day, index) => {
                    if (!day) {
                        return (
                            <span
                                className="tp-mini-empty"
                                key={`empty-${index}`}
                            />
                        );
                    }

                    const dateKey =
                        `${year}-${String(monthNumber + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                    const isSelected =
                        visibleSelectedDate === dateKey;

                    const hasTask =
                        deadlineDates.has(dateKey);

                    return (
                        <button
                            key={dateKey}
                            type="button"
                            className={[
                                "tp-mini-day",
                                isSelected ? "is-selected" : "",
                                hasTask ? "has-deadline" : "",
                            ].join(" ")}
                            onClick={() => setSelected(dateKey)}
                            aria-label={`${formatDate(dateKey)}${hasTask ? ", task deadline" : ""}`}
                            aria-pressed={isSelected}
                        >
                            <span>{day}</span>

                            {hasTask && (
                                <span className="tp-mini-dot" />
                            )}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

const EMPTY_FORM = {
    title: "",
    case_id: "",
    deadline: "",
    priority: "Medium",
};
export default function TasksPremium() {
    const navigate = useNavigate();
    const { user, openSidebar } = useLawyerLayout();

    const [tasks, setTasks] = useState([]);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [tab, setTab] = useState("All");
    const [caseFilter, setCaseFilter] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [ascending, setAscending] = useState(true);

    const [month, setMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
    const [showSelectedTasks, setShowSelectedTasks] = useState(false);

    const [dialog, setDialog] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [menuId, setMenuId] = useState(null);
    const [profileOpen, setProfileOpen] = useState(false);


    const loadTasks = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const casesResponse =
                await getLawyerCases();

            const caseList = normalizeArray(
                casesResponse,
                "cases"
            );

            setCases(caseList);

            // Get all tasks from every lawyer case.

            const results = await Promise.allSettled(
                caseList.map((item) =>
                    apiRequest(
                        `/tasks/case/${encodeURIComponent(item.id)}`
                    )
                )
            );


            const loadedTasks = results.flatMap(
                (result) =>
                    result.status === "fulfilled"
                        ? normalizeArray(result.value, "tasks")
                        : []
            );

            setTasks(loadedTasks);

            const failures = results.filter(
                (result) => result.status === "rejected"
            );

            if (failures.length > 0) {
                setError(
                    `Could not load tasks for ${failures.length} case(s). ` +
                    (failures[0].reason?.message || "")
                );
            }
        } catch (err) {
            setTasks([]);
            setError(
                err.message || "Could not load tasks."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user?.id) loadTasks();
    }, [user?.id, loadTasks]);

    const caseMap = useMemo(
        () => new Map(cases.map((item) => [String(item.id), item])),
        [cases]
    );

    const enrichedTasks = useMemo(
        () =>
            tasks.map((task) => {
                const linkedCase = caseMap.get(String(task.case_id));
                return {
                    ...task,
                    caseNumber:
                        task.case_number || linkedCase?.case_number || "—",
                    caseTitle:
                        task.case_title || linkedCase?.case_title || "",
                    state: taskState(task),
                    priority: task.priority || "Medium",
                };
            }),
        [tasks, caseMap]
    );

    const counts = useMemo(() => {
        const completed = enrichedTasks.filter(
            (task) => task.state === "Completed"
        ).length;

        const overdue = enrichedTasks.filter(
            (task) => task.state === "Overdue"
        ).length;

        return {
            total: enrichedTasks.length,
            completed,
            overdue,
            pending: enrichedTasks.length - completed,
            pendingOnly: enrichedTasks.length - completed - overdue,
        };
    }, [enrichedTasks]);

    const filteredTasks = useMemo(() => {
        const query = search.trim().toLowerCase();

        return enrichedTasks
            .filter((task) => {
                if (tab === "Completed" && task.state !== "Completed") return false;
                if (tab === "Overdue" && task.state !== "Overdue") return false;
                if (
                    tab === "Pending" &&
                    task.state !== "Pending" &&
                    task.state !== "Overdue"
                ) {
                    return false;
                }

                if (caseFilter && String(task.case_id) !== caseFilter) return false;
                if (priorityFilter && task.priority !== priorityFilter) return false;
                if (statusFilter && task.state !== statusFilter) return false;

                return (
                    !query ||
                    [
                        task.title,
                        task.caseNumber,
                        task.caseTitle,
                        task.deadline,
                        task.priority,
                    ].some((value) =>
                        String(value || "").toLowerCase().includes(query)
                    )
                );
            })
            .sort((a, b) => {
                const aDate = a.deadline || "9999-12-31";
                const bDate = b.deadline || "9999-12-31";
                return ascending
                    ? aDate.localeCompare(bDate)
                    : bDate.localeCompare(aDate);
            });
    }, [
        enrichedTasks,
        tab,
        search,
        caseFilter,
        priorityFilter,
        statusFilter,
        ascending,
    ]);

    const upcoming = useMemo(() => {
        const today = new Date();
        const end = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 7
        );

        return enrichedTasks
            .filter((task) => {
                if (task.state === "Completed" || !task.deadline) return false;
                const date = readDate(task.deadline);
                return date && date >= readDate(isoDate(today)) && date <= end;
            })
            .sort((a, b) => a.deadline.localeCompare(b.deadline))
            .slice(0, 3);
    }, [enrichedTasks]);
    const displayedDeadlines = showSelectedTasks
        ? enrichedTasks.filter(
            (task) => task.deadline?.slice(0, 10) === selectedDate
        )
        : upcoming;

    const chartCompleted = counts.total
        ? (counts.completed / counts.total) * 100
        : 0;

    const chartPending = counts.total
        ? ((counts.completed + counts.pendingOnly) / counts.total) * 100
        : 0;

    const chartBackground = counts.total
        ? `conic-gradient(
        #4c9b78 0% ${chartCompleted}%,
        #f2b644 ${chartCompleted}% ${chartPending}%,
        #e95050 ${chartPending}% 100%
      )`
        : "#e8e3da";

    const openAdd = () => {
        setError("");
        setMenuId(null);
        setForm({
            ...EMPTY_FORM,
            case_id: cases[0] ? String(cases[0].id) : "",
        });
        setDialog({ mode: "add" });
    };

    const openEdit = (task) => {
        setError("");
        setMenuId(null);
        setForm({
            title: task.title || "",
            case_id: String(task.case_id || ""),
            deadline: task.deadline?.slice(0, 10) || "",
            priority: task.priority || "Medium",
        });
        setDialog({ mode: "edit", task });
    };

    const submitForm = async (event) => {
        event.preventDefault();
        if (!form.title.trim() || !form.case_id) {
            setError("Task title and case are required.");
            return;
        }

        setSaving(true);
        setError("");

        const payload = {
            title: form.title.trim(),
            deadline: form.deadline || null,
            priority: form.priority,
        };

        try {
            if (dialog?.mode === "edit") {
                await apiRequest(`/tasks/${dialog.task.id}`, {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                });
            } else {
                await apiRequest(`/tasks/case/${form.case_id}`, {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
            }

            setDialog(null);
            await loadTasks();
        } catch (err) {
            setError(err.message || "Could not save task.");
        } finally {
            setSaving(false);
        }
    };

    const toggleCompleted = async (task) => {
        setBusyId(task.id);
        setMenuId(null);
        setError("");

        try {
            await apiRequest(`/tasks/${task.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                    status: task.state === "Completed" ? "Pending" : "Completed",
                }),
            });

            await loadTasks();
        } catch (err) {
            setError(err.message || "Could not update task.");
        } finally {
            setBusyId(null);
        }
    };

    const deleteTask = async (task) => {
        setMenuId(null);

        if (!window.confirm(`Delete task "${task.title}"?`)) {
            return;
        }

        setBusyId(task.id);
        setError("");

        try {
            await apiRequest(`/tasks/${task.id}`, {
                method: "DELETE",
            });

            await loadTasks();
        } catch (err) {
            setError(err.message || "Could not delete task.");
        } finally {
            setBusyId(null);
        }
    };

    const signOut = async () => {
        try {
            await logoutUser();
        } catch {
            // Continue clearing the local session.
        }

        localStorage.removeItem("advocanote_access_token");
        localStorage.removeItem("advocanote_refresh_token");
        navigate("/login", { replace: true });
    };

    if (!user) return null;

    const displayName = user.full_name || "Lawyer";

    const initials = displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toUpperCase();

    return (
        <>
            <LawyerTopbarPortal>
                <button
                    className="ald-mobile-menu"
                    type="button"
                    onClick={openSidebar}
                    aria-label="Open menu"
                >
                    <Menu size={22} />
                </button>

                <div className="ald-global-search">
                    <Search size={20} />
                    <input
                        value={search}
                        placeholder="Search tasks, case numbers, or deadlines..."
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Search tasks"
                    />
                </div>

                <div className="ald-topbar-actions">



                    <div className="ald-dropdown-holder">
                        <button
                            type="button"
                            className="ald-account"
                            onClick={() => {
                                setProfileOpen(!profileOpen);
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
                                <button type="button" onClick={() => navigate("/profile")}>
                                    <UserRound size={16} /> My Profile
                                </button>
                                <button type="button" onClick={signOut}>
                                    <LogOut size={16} /> Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </LawyerTopbarPortal>

            <main className="tp-page">
                <div className="tp-layout">
                    <section className="tp-main">
                        {/* Premium heading, without big clipboard icon */}
                        <header className="tp-hero">
                            <div className="tp-hero-text">
                                <h1>Tasks &amp; Deadlines</h1>

                                <p>
                                    Organize case tasks, track deadlines and stay
                                    on top of your legal work.
                                </p>
                            </div>

                            <div
                                className="tp-hero-art"
                                aria-hidden="true"
                            />
                        </header>

                        {/* Tabs + Add Task */}
                        <div className="tp-tabs-line">
                            <div className="tp-tabs">
                                {[
                                    ["All", counts.total, ListFilter],
                                    ["Pending", counts.pending, Hourglass],
                                    ["Completed", counts.completed, CheckCircle2],
                                    ["Overdue", counts.overdue, AlertTriangle],
                                ].map(([name, count, Icon]) => (
                                    <button
                                        key={name}
                                        type="button"
                                        className={`tp-tab ${tab === name ? "active" : ""}`}
                                        onClick={() => setTab(name)}
                                    >
                                        <Icon size={17} />
                                        {name} ({count})
                                    </button>
                                ))}
                            </div>

                            <button className="tp-add" type="button" onClick={openAdd}>
                                <Plus size={20} />
                                Add Task
                            </button>
                        </div>

                        {/* Filters */}
                        <div className="tp-filters">
                            <label className="tp-search">
                                <Search size={19} />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search tasks..."
                                />
                            </label>

                            <label className="tp-filter">
                                <Folder size={17} />
                                <select
                                    value={caseFilter}
                                    onChange={(e) => setCaseFilter(e.target.value)}
                                >
                                    <option value="">All Cases</option>
                                    {cases.map((item) => (
                                        <option key={item.id} value={String(item.id)}>
                                            {item.case_number}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="tp-filter">
                                <SlidersHorizontal size={17} />
                                <select
                                    value={priorityFilter}
                                    onChange={(e) => setPriorityFilter(e.target.value)}
                                >
                                    <option value="">All Priorities</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </label>

                            <label className="tp-filter">
                                <Clock3 size={17} />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Overdue">Overdue</option>
                                </select>
                            </label>

                            <button
                                className="tp-sort"
                                type="button"
                                title="Change deadline sort order"
                                onClick={() => setAscending(!ascending)}
                            >
                                <SlidersHorizontal size={19} />
                            </button>
                        </div>

                        {error && (
                            <div className="tp-error" role="alert">
                                {error}
                                <button type="button" onClick={() => setError("")}>
                                    <X size={16} />
                                </button>
                            </div>
                        )}

                        {/* Live tasks from FastAPI */}
                        <div className="tp-task-list">
                            {loading ? (
                                <p className="tp-empty">Loading your tasks...</p>
                            ) : filteredTasks.length === 0 ? (
                                <p className="tp-empty">
                                    No matching tasks found.
                                </p>
                            ) : (
                                filteredTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className={`tp-task-card tp-task-${task.state.toLowerCase()}`}
                                    >
                                        <label className="tp-check">
                                            <input
                                                type="checkbox"
                                                checked={task.state === "Completed"}
                                                disabled={busyId === task.id}
                                                onChange={() => toggleCompleted(task)}
                                                aria-label={`Toggle ${task.title}`}
                                            />
                                            <span className="tp-check-box">
                                                <Check size={15} />
                                            </span>
                                        </label>

                                        <div className="tp-task-info">
                                            <strong>{task.title}</strong>
                                            <small>
                                                {task.caseTitle || `Case ${task.caseNumber}`}
                                            </small>
                                        </div>

                                        <div className="tp-task-case">
                                            <Folder size={16} />
                                            <span>{task.caseNumber}</span>
                                        </div>

                                        <div className="tp-task-date">
                                            <CalendarDays size={16} />
                                            <span>{formatDate(task.deadline)}</span>
                                        </div>

                                        <span className={`tp-priority tp-priority-${task.priority.toLowerCase()}`}>
                                            {task.priority}
                                        </span>

                                        <span className={`tp-status tp-status-${task.state.toLowerCase()}`}>
                                            <i />
                                            {task.state}
                                        </span>

                                        <div className="tp-action">
                                            <button
                                                type="button"
                                                className="tp-action-button"
                                                onClick={() => setMenuId(menuId === task.id ? null : task.id)}
                                                aria-label={`Actions for ${task.title}`}
                                            >
                                                <EllipsisVertical size={19} />
                                            </button>

                                            {menuId === task.id && (
                                                <div className="tp-action-menu">
                                                    <button type="button" onClick={() => openEdit(task)}>
                                                        <Pencil size={15} /> Edit
                                                    </button>
                                                    <button type="button" onClick={() => toggleCompleted(task)}>
                                                        <Check size={15} />
                                                        {task.state === "Completed" ? "Mark Pending" : "Complete"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="danger"
                                                        onClick={() => deleteTask(task)}
                                                    >
                                                        <Trash2 size={15} /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* Right sidebar */}
                    <aside className="tp-sidebar">
                        <MiniCalendar
                            month={month}
                            setMonth={setMonth}
                            selected={selectedDate}
                            setSelected={(date) => {
                                setSelectedDate(date);
                                setShowSelectedTasks(true);
                            }}
                            tasks={enrichedTasks}
                        />

                        <section className="tp-panel tp-upcoming">
                            <div className="tp-panel-heading">
                                <span className="tp-heading-icon">
                                    <CalendarDays size={24} />
                                </span>

                                <div>
                                    <h2>
                                        {showSelectedTasks
                                            ? "Tasks on Selected Date"
                                            : "Upcoming Deadlines"}
                                    </h2>

                                    <small>
                                        {showSelectedTasks
                                            ? formatDate(selectedDate)
                                            : "Next 7 days"}
                                    </small>
                                </div>
                            </div>

                            {showSelectedTasks && (
                                <button
                                    type="button"
                                    className="tp-back-upcoming"
                                    onClick={() => setShowSelectedTasks(false)}
                                >
                                    <ChevronLeft size={15} />
                                    Back to Upcoming
                                </button>
                            )}

                            {displayedDeadlines.length > 0 ? (
                                displayedDeadlines.map((task) => (
                                    <div
                                        className="tp-upcoming-item"
                                        key={task.id}
                                    >
                                        <span
                                            className={`tp-upcoming-bar tp-bar-${task.priority.toLowerCase()}`}
                                        />

                                        <div className="tp-upcoming-info">
                                            <strong>{task.title}</strong>
                                            <small>
                                                Case: {task.caseNumber}
                                            </small>
                                            <small>
                                                {task.state} · {task.priority} Priority
                                            </small>
                                        </div>

                                        <button
                                            type="button"
                                            className="tp-view-task"
                                            onClick={() => openEdit(task)}
                                        >
                                            View
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="tp-upcoming-empty">
                                    {showSelectedTasks
                                        ? "No tasks scheduled for this date."
                                        : "No deadlines in the next 7 days."}
                                </p>
                            )}
                        </section>


                        <section className="tp-panel tp-summary">
                            <div className="tp-panel-heading">
                                <span className="tp-heading-icon gold">
                                    <ListFilter size={23} />
                                </span>
                                <h2>Task Summary</h2>
                            </div>

                            <div className="tp-summary-body">
                                <div
                                    className="tp-donut"
                                    style={{ background: chartBackground }}
                                    role="img"
                                    aria-label={`${counts.total} total tasks, ${counts.completed} completed, ${counts.overdue} overdue`}
                                >
                                    <div className="tp-donut-center">
                                        <strong>{counts.total}</strong>
                                        <small>Tasks</small>
                                    </div>
                                </div>

                                <div className="tp-summary-legend">
                                    <div>
                                        <span className="tp-dot green" />
                                        Completed
                                        <strong>{counts.completed}</strong>
                                    </div>
                                    <div>
                                        <span className="tp-dot amber" />
                                        Pending
                                        <strong>{counts.pending}</strong>
                                    </div>
                                    <div>
                                        <span className="tp-dot red" />
                                        Overdue
                                        <strong>{counts.overdue}</strong>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </aside>
                </div>
            </main>

            {/* Add / Edit task modal */}
            {dialog && (
                <div className="tp-overlay" onMouseDown={() => setDialog(null)}>
                    <section
                        className="tp-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="tp-dialog-title"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="tp-dialog-header">
                            <h2 id="tp-dialog-title">
                                {dialog.mode === "add" ? "Add New Task" : "Edit Task"}
                            </h2>
                            <button type="button" onClick={() => setDialog(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={submitForm}>
                            <label>
                                Task Title
                                <input
                                    required
                                    maxLength={255}
                                    value={form.title}
                                    onChange={(e) =>
                                        setForm({ ...form, title: e.target.value })
                                    }
                                    placeholder="e.g. Prepare written submissions"
                                />
                            </label>

                            <label>
                                Case
                                <select
                                    required
                                    disabled={dialog.mode === "edit"}
                                    value={form.case_id}
                                    onChange={(e) =>
                                        setForm({ ...form, case_id: e.target.value })
                                    }
                                >
                                    <option value="">Select case</option>
                                    {cases.map((item) => (
                                        <option key={item.id} value={String(item.id)}>
                                            {item.case_number} — {item.case_title}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="tp-form-grid">
                                <label>
                                    Deadline
                                    <input
                                        type="date"
                                        value={form.deadline}
                                        onChange={(e) =>
                                            setForm({ ...form, deadline: e.target.value })
                                        }
                                    />
                                </label>

                                <label>
                                    Priority
                                    <select
                                        value={form.priority}
                                        onChange={(e) =>
                                            setForm({ ...form, priority: e.target.value })
                                        }
                                    >
                                        <option>Low</option>
                                        <option>Medium</option>
                                        <option>High</option>
                                    </select>
                                </label>
                            </div>

                            <div className="tp-dialog-actions">
                                <button
                                    className="tp-cancel"
                                    type="button"
                                    onClick={() => setDialog(null)}
                                >
                                    Cancel
                                </button>
                                <button className="tp-add" type="submit" disabled={saving}>
                                    {saving ? "Saving..." : "Save Task"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </>
    );
}
