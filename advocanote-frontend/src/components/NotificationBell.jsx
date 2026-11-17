
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
  CalendarDays,
  CheckCheck,
  ListTodo,
} from "lucide-react";

import { useLawyerLayout } from "./LawyerLayout";
import "./NotificationBell.css";

const API = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");


async function notificationRequest(path, method = "GET") {
  const token = sessionStorage.getItem(
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

  if (
    /^\/(tasks?([^/]*?)|deadlines?)(\/|$)/.test(path)
  ) {
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



export default function NotificationBell() {
  const { user } = useLawyerLayout();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const holderRef = useRef(null);

  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    let active = true;

    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      setError("");
      return;
    }

    setNotifications([]);
    setUnreadCount(0);
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


  useEffect(() => {
    setOpen(false);
  }, [pathname]);


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
    setOpen((previous) => !previous);

    setRefreshKey(
      (previous) => previous + 1
    );
  }


  async function handleNotificationClick(item) {
    if (busyId !== null) return;

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


  async function handleMarkAllAsRead() {
    if (markingAll || unreadCount === 0) {
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


  async function handleMarkAsUnread(event, item) {
    event.stopPropagation();

    if (busyId !== null || !item.is_read) {
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

      setUnreadCount(
        (previous) => previous + 1
      );
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
        : "All reminders";


  return (
    <div
      ref={holderRef}
      className="ald-dropdown-holder anb-holder"
      style={{
        position: "relative",
        display: "inline-flex",
      }}
    >
      <button
        type="button"
        className="anb-trigger"
        onClick={toggleNotifications}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        title="Notifications"
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: 12,
          border: "1px solid #e4e5df",
          background: "#ffffff",
          color: "#004535",
          cursor: "pointer",
        }}
      >
        <Bell size={20} />

        {unreadCount > 0 && (
          <span
            className="anb-count"
            style={{
              position: "absolute",
              top: -6,
              right: -7,
              minWidth: 19,
              height: 19,
              padding: "0 4px",
              borderRadius: 20,
              background: "#b18a4c",
              color: "#ffffff",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="ald-top-popover anb-popover"
          role="region"
          aria-label="Notification list"
          style={{
            position: "absolute",
            top: "calc(100% + 12px)",
            right: 0,
            width: "min(380px, calc(100vw - 24px))",
            maxWidth: "calc(100vw - 24px)",
            borderRadius: 16,
            background: "#fffdf8",
            border: "1px solid #e8e1d1",
            boxShadow:
              "0 16px 36px rgba(0, 40, 30, 0.13)",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px",
              borderBottom: "1px solid #eee8df",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <strong
                  style={{
                    fontSize: 16,
                    color: "#004535",
                  }}
                >
                  Notifications
                </strong>

                <div
                  style={{
                    fontSize: 12,
                    color: "#78857e",
                    marginTop: 4,
                  }}
                >
                  {sectionLabel}
                </div>
              </div>

              <span
                style={{
                  fontSize: 12,
                  color: "#004535",
                  background: "#eef4ef",
                  borderRadius: 20,
                  padding: "6px 10px",
                }}
              >
                {unreadCount} unread
              </span>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={markingAll || busyId !== null}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "transparent",
                  border: 0,
                  color: "#004535",
                  cursor: "pointer",
                  fontSize: 12,
                  marginTop: 12,
                  padding: 0,
                }}
              >
                <CheckCheck size={15} />
                {markingAll
                  ? "Updating..."
                  : "Mark all as read"}
              </button>
            )}
          </div>

          {error && (
            <p
              role="alert"
              style={{
                margin: 12,
                color: "#b42318",
                fontSize: 12,
              }}
            >
              {error}
            </p>
          )}

          <div
            className="anb-list"
            style={{
              maxHeight: 350,
              overflowY: "auto",
            }}
          >
            {loading ? (
              <p
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: "#7c857f",
                  fontSize: 13,
                }}
              >
                Loading notifications...
              </p>
            ) : notifications.length === 0 ? (
              <p
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: "#7c857f",
                  fontSize: 13,
                }}
              >
                No notifications available.
              </p>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`anb-item ${item.is_read ? "is-read" : "is-unread"
                    }`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    background: item.is_read
                      ? "#fffdf8"
                      : "#f0f5ef",
                    borderBottom:
                      "1px solid #eee8df",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      handleNotificationClick(item)
                    }
                    disabled={busyId !== null}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flex: 1,
                      minWidth: 0,
                      textAlign: "left",
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      color: "#004535",
                    }}
                  >
                    {item.type === "hearing" ? (
                      <CalendarDays size={19} />
                    ) : (
                      <ListTodo size={19} />
                    )}

                    <span
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <strong
                        style={{
                          fontSize: 13,
                          fontWeight: item.is_read
                            ? 500
                            : 700,
                        }}
                      >
                        {item.title}
                      </strong>

                      <small
                        style={{
                          fontSize: 11,
                          color: "#7b8780",
                        }}
                      >
                        {item.type === "hearing"
                          ? "Hearing"
                          : item.type === "event"
                            ? "Event"
                            : "Task"}
                        {" · "}
                        {item.reminder_date}
                      </small>
                    </span>
                  </button>

                  {item.is_read ? (
                    <button
                      type="button"
                      onClick={(event) =>
                        handleMarkAsUnread(event, item)
                      }
                      disabled={busyId !== null}
                      title="Mark as unread"
                      aria-label="Mark as unread"
                      style={{
                        background: "transparent",
                        border: 0,
                        color: "#8a958e",
                        cursor: "pointer",
                        fontSize: 11,
                        padding: 4,
                      }}
                    >
                      Unread
                    </button>
                  ) : (
                    <span
                      title="Unread"
                      style={{
                        width: 8,
                        height: 8,
                        minWidth: 8,
                        borderRadius: "50%",
                        background: "#b18a4c",
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
