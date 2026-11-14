
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarDays } from "lucide-react";
import { useLawyerLayout } from "./LawyerLayout";
import "./NotificationBell.css";

const API = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function eventTime(date, time = "09:00") {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.slice(0, 5).split(":").map(Number);

  return new Date(y, m - 1, d, h, min).getTime();
}

function readStored(userId) {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        `advocanote_calendar_read_${userId}`
      ) || "[]"
    );
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

async function apiGet(path) {
  const token = sessionStorage.getItem(
    "advocanote_access_token"
  );

  if (!token) throw new Error("Please log in again.");

  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Could not load notifications (${response.status})`
    );
  }

  return response.json();
}

export default function NotificationBell() {
  const { user } = useLawyerLayout();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState({
    hearing_reminders: false,
    task_reminders: false,
  });
  const [readIds, setReadIds] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    setReadIds(readStored(user.id));

    async function refresh() {
      try {
        const today = new Date();

        const start = dateKey(
          new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() - 1
          )
        );

        const end = dateKey(
          new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 2
          )
        );

        const [calendar, profile] = await Promise.all([
          apiGet(
            `/calendar/events?start_date=${start}&end_date=${end}`
          ),
          apiGet("/profile/me"),
        ]);

        if (!active) return;

        setEvents(calendar.events || []);

        const prefs =
          profile.profile?.notification_preferences || {};

        setSettings({
          hearing_reminders: prefs.hearing_reminders === true,
          task_reminders: prefs.task_reminders === true,
        });

        setError("");
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      }
    }

    refresh();

    const timer = setInterval(() => {
      setNow(Date.now());
      refresh();
    }, 60000);

    window.addEventListener("focus", refresh);

    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [user?.id]);

  const reminders = useMemo(() => {
    return events
      .filter((event) => {
        if (event.type === "custom") return true;

        if (event.type === "hearing") {
          return (
            settings.hearing_reminders &&
            String(event.status).toLowerCase() === "scheduled"
          );
        }

        if (event.type === "task") {
          return (
            settings.task_reminders &&
            !["completed", "cancelled", "canceled"].includes(
              String(event.status || "").toLowerCase()
            )
          );
        }

        return false;
      })
      .map((event) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date || "")) {
          return null;
        }

        const timed =
          event.type === "custom" &&
          /^\d{2}:\d{2}/.test(event.time || "");

        let reminderAt;
        let expiresAt;

        const due = eventTime(
          event.date,
          timed ? event.time : "09:00"
        );

        if (event.type === "custom") {
          reminderAt = timed
            ? due - 30 * 60 * 1000
            : due;

          expiresAt = timed
            ? due + 60 * 60 * 1000
            : eventTime(event.date, "23:59");
        } else {
          reminderAt = eventTime(event.date) - 24 * 60 * 60 * 1000;
          expiresAt = eventTime(event.date, "23:59");
        }

        const id =
          event.type === "task"
            ? `backend-task-${event.record_id}`
            : String(event.id);

        return {
          ...event,
          id,
          reminderAt,
          expiresAt,
        };
      })
      .filter(
        (event) =>
          event &&
          now >= event.reminderAt &&
          now <= event.expiresAt &&
          !readIds.includes(String(event.id))
      )
      .sort((a, b) => a.reminderAt - b.reminderAt);
  }, [events, settings, now, readIds]);

  function openReminder(event) {
    const updated = [
      ...new Set([...readIds, String(event.id)]),
    ];

    setReadIds(updated);

    try {
      localStorage.setItem(
        `advocanote_calendar_read_${user.id}`,
        JSON.stringify(updated)
      );
    } catch {
      // Keep the current page's read state.
    }

    setOpen(false);
    navigate("/calendar");
  }

  return (
    <div className="ald-dropdown-holder anb-holder">
      <NotificationBell />

      {open && (
        <div className="ald-top-popover anb-popover">
          <strong>Notifications</strong>

          {error ? (
            <p>{error}</p>
          ) : reminders.length === 0 ? (
            <p>No new reminders.</p>
          ) : (
            <div className="anb-list">
              {reminders.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="anb-item"
                  onClick={() => openReminder(event)}
                >
                  <CalendarDays size={16} />

                  <span>
                    <b>{event.title}</b>
                    <small>
                      {event.type === "custom"
                        ? "Calendar"
                        : event.type === "hearing"
                          ? "Hearing"
                          : "Task"}
                      {" · "}
                      {event.date}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
