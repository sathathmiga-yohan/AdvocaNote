
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Bell,
  BellRing,
  CalendarDays,
  CheckCheck,
  ListTodo,
  CalendarClock,
  Mail,
  Inbox,
  Sparkles,
} from "lucide-react";

import { useLawyerLayout } from "./LawyerLayout";
import "./NotificationBell.css";

const API = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

async function notificationRequest(path, method = "GET") {
  const token = localStorage.getItem(
    "advocanote_access_token"
  );

  if (!token) {
    throw new Error("Please log in again.");
  }

  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Notification request failed (${response.status})`
    );
  }

  return data;
}

function getNotificationType(pathname) {
  const path = pathname.toLowerCase();

  if (/^\/hearings?(\/|$)/.test(path)) {
    return "hearing";
  }

  if (/^\/(tasks?|deadlines?)(\/|$)/.test(path)) {
    return "task";
  }

  if (
    path === "/calendar" ||
    path.startsWith("/calendar/") ||
    path === "/my-legal-diary" ||
    path.startsWith("/my-legal-diary/")
  ) {
    return "all";
  }

  return "core";
}

function formatReminderDate(value) {
  if (!value) return "";

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (!match) return String(value);

  const [, year, month, day] = match;

  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day)
    )
  );

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getNotificationMeta(type) {
  if (type === "hearing") {
    return {
      label: "Hearing",
      icon: CalendarDays,
      className: "hearing",
    };
  }

  if (type === "event") {
    return {
      label: "Event",
      icon: CalendarClock,
      className: "event",
    };
  }

  return {
    label: "Task",
    icon: ListTodo,
    className: "task",
  };
}

export default function NotificationBell() {
  const { user } = useLawyerLayout();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const holderRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const notificationType = useMemo(
    () => getNotificationType(pathname),
    [pathname]
  );

  // FETCH NOTIFICATIONS

  useEffect(() => {
    let active = true;

    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);

    async function refreshNotifications() {
      try {
        const data = await notificationRequest(
          `/notifications?type=${notificationType}`
        );

        if (!active) return;

        setNotifications(
          Array.isArray(data?.notifications)
            ? data.notifications
            : []
        );

        setUnreadCount(
          Number(data?.unread_count) || 0
        );

        setError("");
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    refreshNotifications();

    const timer = setInterval(
      refreshNotifications,
      60000
    );

    window.addEventListener(
      "focus",
      refreshNotifications
    );

    return () => {
      active = false;
      clearInterval(timer);

      window.removeEventListener(
        "focus",
        refreshNotifications
      );
    };
  }, [user?.id, notificationType, refreshKey]);

  // CLOSE ON ROUTE CHANGE

  useEffect(() => {
    setOpen(false);
    setActiveTab("all");
  }, [pathname]);

  // OUTSIDE CLICK

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event) {
      if (
        holderRef.current &&
        !holderRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [open]);

  function toggleNotifications() {
    if (!open) {
      setActiveTab("all");
      setRefreshKey((previous) => previous + 1);
    }

    setOpen((previous) => !previous);
  }

  // CLICK NOTIFICATION

  async function handleNotificationClick(item) {
    if (busyId !== null || markingAll) return;

    setBusyId(item.id);
    setError("");

    try {
      if (!item.is_read) {
        await notificationRequest(
          `/notifications/${item.id}/read`,
          "PATCH"
        );

        setNotifications((previous) =>
          previous.map((notification) =>
            notification.id === item.id
              ? {
                  ...notification,
                  is_read: true,
                  read_at: new Date().toISOString(),
                }
              : notification
          )
        );

        setUnreadCount((previous) =>
          Math.max(0, previous - 1)
        );
      }

      setOpen(false);

      if (
        item.type === "hearing" &&
        notificationType !== "hearing"
      ) {
        navigate("/hearings");
      } else if (
        item.type === "task" &&
        notificationType !== "task"
      ) {
        navigate("/tasks");
      } else if (
        item.type === "event" &&
        !pathname.startsWith("/calendar")
      ) {
        navigate("/calendar");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  // MARK ALL AS READ

  async function handleMarkAllAsRead() {
    if (
      markingAll ||
      busyId !== null ||
      unreadCount === 0
    ) {
      return;
    }

    setMarkingAll(true);
    setError("");

    try {
      await notificationRequest(
        `/notifications/read-all?type=${notificationType}`,
        "PATCH"
      );

      const readTime = new Date().toISOString();

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          is_read: true,
          read_at: notification.read_at || readTime,
        }))
      );

      setUnreadCount(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setMarkingAll(false);
    }
  }

  // MARK SINGLE AS UNREAD

  async function handleMarkAsUnread(event, item) {
    event.stopPropagation();

    if (
      busyId !== null ||
      markingAll ||
      !item.is_read
    ) {
      return;
    }

    setBusyId(item.id);
    setError("");

    try {
      await notificationRequest(
        `/notifications/${item.id}/unread`,
        "PATCH"
      );

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === item.id
            ? {
                ...notification,
                is_read: false,
                read_at: null,
              }
            : notification
        )
      );

      setUnreadCount((previous) => previous + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const sectionLabel =
    notificationType === "hearing"
      ? "Hearing reminders"
      : notificationType === "task"
        ? "Task reminders"
        : "Your legal workspace updates";

  const filteredNotifications =
    activeTab === "unread"
      ? notifications.filter((item) => !item.is_read)
      : notifications;

  return (
    <div ref={holderRef} className="anb-holder">

      {/* BELL */}

      <button
        type="button"
        className={`anb-trigger ${open ? "is-active" : ""}`}
        onClick={toggleNotifications}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        aria-controls="anb-notification-panel"
        title="Notifications"
      >
        <Bell size={20} strokeWidth={1.9} />

        {unreadCount > 0 && (
          <span className="anb-count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* PREMIUM POPUP */}

      {open && (
        <div
          id="anb-notification-panel"
          className="anb-popover"
          role="region"
          aria-label="Notification center"
        >

          {/* BRAND HEADER */}

          <div className="anb-header">
            <div className="anb-header-main">

              <div className="anb-header-icon">
                <BellRing size={21} strokeWidth={1.8} />
              </div>

              <div className="anb-header-content">
                <h3>Notifications</h3>
                <p>{sectionLabel}</p>
              </div>

              <span className="anb-header-status">
                <span className="anb-status-dot" />
                {unreadCount > 0
                  ? `${unreadCount} new`
                  : "All read"}
              </span>
            </div>

            <div className="anb-header-bottom">
              <Sparkles size={13} />
              <span>
                Stay on top of your legal work
              </span>
            </div>
          </div>

          {/* FILTERS + ACTION */}

          <div className="anb-toolbar">

            <div
              className="anb-tabs"
              aria-label="Filter notifications"
            >
              <button
                type="button"
                className={`anb-tab ${
                  activeTab === "all" ? "active" : ""
                }`}
                onClick={() => setActiveTab("all")}
                aria-pressed={activeTab === "all"}
              >
                All
                <span>{notifications.length}</span>
              </button>

              <button
                type="button"
                className={`anb-tab ${
                  activeTab === "unread" ? "active" : ""
                }`}
                onClick={() => setActiveTab("unread")}
                aria-pressed={activeTab === "unread"}
              >
                Unread
                <span>{unreadCount}</span>
              </button>
            </div>

            <button
              type="button"
              className="anb-mark-all"
              onClick={handleMarkAllAsRead}
              disabled={
                unreadCount === 0 ||
                markingAll ||
                busyId !== null
              }
              title="Mark all notifications as read"
            >
              <CheckCheck size={15} />
              <span>
                {markingAll
                  ? "Updating..."
                  : "Mark all read"}
              </span>
            </button>
          </div>

          {/* ERROR */}

          {error && (
            <div className="anb-error" role="alert">
              {error}
            </div>
          )}

          {/* LIST */}

          <div className="anb-list">

            {loading ? (
              <div className="anb-empty-state">
                <div className="anb-empty-icon">
                  <Bell size={23} />
                </div>
                <p>Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="anb-empty-state">
                <div className="anb-empty-icon">
                  <Inbox size={25} strokeWidth={1.6} />
                </div>

                <strong>
                  {activeTab === "unread"
                    ? "You're all caught up!"
                    : "No notifications yet"}
                </strong>

                <p>
                  {activeTab === "unread"
                    ? "You have no unread reminders."
                    : "Your reminders will appear here."}
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const meta = getNotificationMeta(
                  item.type
                );

                const IconComponent = meta.icon;

                return (
                  <div
                    key={item.id}
                    className={`anb-item ${
                      item.is_read
                        ? "is-read"
                        : "is-unread"
                    }`}
                  >

                    <button
                      type="button"
                      className="anb-item-main"
                      onClick={() =>
                        handleNotificationClick(item)
                      }
                      disabled={
                        busyId !== null ||
                        markingAll
                      }
                    >

                      <span
                        className={`anb-item-icon ${meta.className}`}
                      >
                        <IconComponent
                          size={19}
                          strokeWidth={1.9}
                        />
                      </span>

                      <span className="anb-item-content">

                        <span className="anb-item-top">
                          <span
                            className={`anb-type ${meta.className}`}
                          >
                            {meta.label}
                          </span>

                          {!item.is_read && (
                            <span className="anb-new-label">
                              NEW
                            </span>
                          )}
                        </span>

                        <strong className="anb-item-title">
                          {item.title}
                        </strong>

                        <small className="anb-item-date">
                          {formatReminderDate(
                            item.reminder_date
                          )}
                        </small>

                      </span>
                    </button>

                    <div className="anb-item-action">
                      {item.is_read ? (
                        <button
                          type="button"
                          className="anb-unread-action"
                          onClick={(event) =>
                            handleMarkAsUnread(
                              event,
                              item
                            )
                          }
                          disabled={
                            busyId !== null ||
                            markingAll
                          }
                          title="Mark as unread"
                          aria-label="Mark as unread"
                        >
                          <Mail size={15} />
                        </button>
                      ) : (
                        <span
                          className="anb-unread-dot"
                          title="Unread"
                        />
                      )}
                    </div>

                  </div>
                );
              })
            )}

          </div>

          {/* FOOTER */}

          <div className="anb-footer">
            <span className="anb-footer-dot" />
            Notifications refresh automatically
          </div>

        </div>
      )}
    </div>
  );
}
