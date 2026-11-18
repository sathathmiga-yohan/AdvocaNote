
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Bell,
  CheckCheck,
  Check,
  Trash2,
  Search,
  UserRoundPlus,
  Crown,
  CalendarClock,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Clock3,
} from "lucide-react";

import "./AdminNotifications.css";

const PAGE_SIZE = 5;

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

// ========================================
// NOTIFICATION ICONS
// ========================================

const notificationIcons = {
  registration: UserRoundPlus,
  subscription: Crown,
  trial: CalendarClock,
  payment: CreditCard,
  feedback: MessageSquare,
  failed: AlertTriangle,
  expired: CalendarX2,
};

// ========================================
// DETAIL LABELS
// ========================================

const detailLabels = {
  lawyer_id: "Lawyer ID",
  lawyer_name: "Lawyer Name",
  full_name: "Full Name",
  email: "Email",
  role: "Role",
  account_status: "Account Status",
  activity: "Activity",
  plan: "Plan",
  plan_name: "Plan",
  payment_status: "Payment Status",
  amount: "Amount",
  billing: "Billing",
};

function normalizeDetails(details) {
  if (!details || typeof details !== "object") {
    return [];
  }

  if (Array.isArray(details)) {
    return details;
  }

  return Object.entries(details).map(([key, value]) => {
    const label =
      detailLabels[key] ||
      key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const displayValue =
      value === null || value === undefined
        ? "—"
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);

    return [label, displayValue];
  });
}

// ========================================
// BACKEND DATA FORMAT
// ========================================

function normalizeNotification(item) {
  return {
    id: item.id,
    type: item.type || "general",
    title: item.title || "Notification",
    message: item.message || "",
    createdAt: item.created_at,
    isRead: Boolean(item.is_read),
    details: normalizeDetails(item.details),
  };
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  }).format(date);
}

// ========================================
// ADMIN API CONNECTION
// ========================================

async function adminNotificationRequest(
  path,
  options = {}
) {
  const token =
    sessionStorage.getItem(
      "advocanote_access_token"
    ) ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem(
      "advocanote_access_token"
    ) ||
    localStorage.getItem("access_token");

  if (!token) {
    throw new Error(
      "Admin session not found. Please log in again."
    );
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers || {}),
      },
    }
  );

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => null);

    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Request failed (${response.status})`
    );
  }

  return response.json();
}

// ========================================
// MAIN COMPONENT
// ========================================

export default function AdminNotifications() {
  const [notifications, setNotifications] =
    useState([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] =
    useState("all");

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] =
    useState(null);

  const [checkedIds, setCheckedIds] =
    useState([]);

  const [page, setPage] = useState(1);

  // ======================================
  // FETCH REAL NOTIFICATIONS
  // ======================================

  const loadNotifications = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);

      try {
        const result =
          await adminNotificationRequest(
            "/admin/notifications"
          );

        const rows = Array.isArray(result.items)
          ? result.items
          : [];

        setNotifications(
          rows.map(normalizeNotification)
        );

        setError("");
      } catch (err) {
        setError(
          err.message ||
          "Unable to load notifications."
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  // ======================================
  // INITIAL LOAD + AUTO REFRESH
  // ======================================

  useEffect(() => {
    // Remove old frontend demo data
    localStorage.removeItem(
      "advocanote_admin_notifications_demo"
    );

    loadNotifications();

    const interval = setInterval(() => {
      loadNotifications(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [loadNotifications]);

  // ======================================
  // COUNTS
  // ======================================

  const totalCount = notifications.length;

  const unreadCount = notifications.filter(
    (item) => !item.isRead
  ).length;

  const readCount = totalCount - unreadCount;

  // ======================================
  // FILTER + SEARCH
  // ======================================

  const filteredNotifications = useMemo(() => {
    const term = search.trim().toLowerCase();

    return notifications.filter((item) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "unread" &&
          !item.isRead) ||
        (activeTab === "read" &&
          item.isRead);

      const matchesSearch =
        !term ||
        `${item.title} ${item.message} ${item.details
          .flat()
          .join(" ")}`
          .toLowerCase()
          .includes(term);

      return matchesTab && matchesSearch;
    });
  }, [notifications, activeTab, search]);

  // ======================================
  // PAGINATION
  // ======================================

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredNotifications.length / PAGE_SIZE
    )
  );

  useEffect(() => {
    setPage((previous) =>
      Math.min(previous, totalPages)
    );
  }, [totalPages]);

  const visibleNotifications =
    filteredNotifications.slice(
      (page - 1) * PAGE_SIZE,
      page * PAGE_SIZE
    );

  const selectedNotification =
    filteredNotifications.find(
      (item) => item.id === selectedId
    ) ||
    filteredNotifications[0] ||
    null;

  const visibleIds = visibleNotifications.map(
    (item) => item.id
  );

  const allVisibleChecked =
    visibleIds.length > 0 &&
    visibleIds.every((id) =>
      checkedIds.includes(id)
    );

  // ======================================
  // CHANGE TAB
  // ======================================

  const changeTab = (tab) => {
    setActiveTab(tab);
    setPage(1);
    setCheckedIds([]);
  };

  // ======================================
  // MARK ONE AS READ
  // ======================================

  const markAsRead = async (id) => {
    if (busy) return;

    setBusy(true);

    try {
      await adminNotificationRequest(
        `/admin/notifications/${id}/read`,
        { method: "PATCH" }
      );

      setNotifications((previous) =>
        previous.map((item) =>
          item.id === id
            ? { ...item, isRead: true }
            : item
        )
      );

      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ======================================
  // MARK ALL AS READ
  // ======================================

  const markAllAsRead = async () => {
    if (busy || unreadCount === 0) return;

    setBusy(true);

    try {
      await adminNotificationRequest(
        "/admin/notifications/read-all",
        { method: "PATCH" }
      );

      setNotifications((previous) =>
        previous.map((item) => ({
          ...item,
          isRead: true,
        }))
      );

      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ======================================
  // CHECKBOX SELECTION
  // ======================================

  const toggleChecked = (id) => {
    setCheckedIds((previous) =>
      previous.includes(id)
        ? previous.filter(
          (value) => value !== id
        )
        : [...previous, id]
    );
  };

  const toggleAllVisible = () => {
    setCheckedIds((previous) => {
      if (allVisibleChecked) {
        return previous.filter(
          (id) => !visibleIds.includes(id)
        );
      }

      return [
        ...new Set([
          ...previous,
          ...visibleIds,
        ]),
      ];
    });
  };

  // ======================================
  // DELETE NOTIFICATIONS
  // ======================================

  const deleteNotifications = async (ids) => {
    if (!ids.length || busy) return;

    const confirmed = window.confirm(
      `Delete ${ids.length} notification(s)?`
    );

    if (!confirmed) return;

    setBusy(true);

    try {
      await adminNotificationRequest(
        "/admin/notifications/delete-selected",
        {
          method: "POST",
          body: JSON.stringify({ ids }),
        }
      );

      setNotifications((previous) =>
        previous.filter(
          (item) => !ids.includes(item.id)
        )
      );

      setCheckedIds((previous) =>
        previous.filter(
          (id) => !ids.includes(id)
        )
      );

      if (ids.includes(selectedId)) {
        setSelectedId(null);
      }

      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startItem =
    filteredNotifications.length === 0
      ? 0
      : (page - 1) * PAGE_SIZE + 1;

  const endItem = Math.min(
    page * PAGE_SIZE,
    filteredNotifications.length
  );

  return (
    <main className="adn-page">
      <div className="adn-container">

        {/* PAGE HEADER */}
        <div className="adn-header adn-dashboard-header">

          <div className="adn-header-title">
            <h1>Notifications</h1>

            <p>
              Stay updated with important activities
              across AdvocaNote.
            </p>
          </div>

          <div className="adn-header-actions">

            <button
              className="adn-btn adn-btn-gold"
              onClick={markAllAsRead}
              disabled={busy || unreadCount === 0}
            >
              <CheckCheck size={17} />
              Mark all as read
            </button>

            <button
              className="adn-btn adn-btn-danger"
              onClick={() =>
                deleteNotifications(checkedIds)
              }
              disabled={
                busy || checkedIds.length === 0
              }
            >
              <Trash2 size={16} />

              Delete selected

              {checkedIds.length > 0 &&
                ` (${checkedIds.length})`}
            </button>

          </div>
        </div>

        {/* SUMMARY */}

        {/* SUMMARY */}
        <div className="adn-summary">

          <div className="adn-summary-item">
            <span className="adn-summary-dot all" />
            <span>All Notifications</span>
            <strong>{totalCount}</strong>
          </div>

          <div className="adn-summary-divider" />

          <div className="adn-summary-item">
            <span className="adn-summary-dot unread" />
            <span>Unread</span>
            <strong>{unreadCount}</strong>
          </div>

          <div className="adn-summary-divider" />

          <div className="adn-summary-item">
            <span className="adn-summary-dot read" />
            <span>Read</span>
            <strong>{readCount}</strong>
          </div>

        </div>

        {/* FILTERS */}
        <div className="adn-toolbar">
          <div className="adn-tabs">
            {[
              ["all", "All", totalCount],
              ["unread", "Unread", unreadCount],
              ["read", "Read", readCount],
            ].map(([key, label, count]) => (
              <button
                key={key}
                className={
                  "adn-tab " +
                  (activeTab === key
                    ? "active"
                    : "")
                }
                onClick={() => changeTab(key)}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>

          <div className="adn-search">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search notifications..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* API ERROR */}
        {error && (
          <div
            role="alert"
            style={{
              color: "#9b2525",
              margin: "10px 0",
            }}
          >
            {error}
          </div>
        )}

        {/* MAIN CONTENT */}
        <div className="adn-content">

          {/* LEFT: NOTIFICATION LIST */}
          <section className="adn-list-panel">
            <div className="adn-list-heading">
              <div>
                <h2>Recent Activity</h2>
                <p>
                  Manage your system notifications
                </p>
              </div>

              <label className="adn-select-all">
                <input
                  type="checkbox"
                  checked={allVisibleChecked}
                  disabled={
                    busy ||
                    visibleIds.length === 0
                  }
                  onChange={toggleAllVisible}
                />
                Select all
              </label>
            </div>

            <div className="adn-list-body">
              {loading ? (
                <div className="adn-empty">
                  <Inbox
                    size={35}
                    strokeWidth={1.4}
                  />
                  <h3>Loading notifications...</h3>
                </div>
              ) : visibleNotifications.length ===
                0 ? (
                <div className="adn-empty">
                  <Inbox
                    size={35}
                    strokeWidth={1.4}
                  />

                  <h3>No notifications found</h3>

                  <p>
                    {error
                      ? "Unable to retrieve notifications from the backend."
                      : "There are no notifications matching your current filter."}
                  </p>
                </div>
              ) : (
                visibleNotifications.map(
                  (item) => {
                    const Icon =
                      notificationIcons[
                      item.type
                      ] || Bell;

                    const isActive =
                      selectedNotification?.id ===
                      item.id;

                    return (
                      <div
                        key={item.id}
                        className={[
                          "adn-notification",
                          !item.isRead
                            ? "is-unread"
                            : "",
                          isActive
                            ? "is-active"
                            : "",
                        ].join(" ")}
                      >
                        <input
                          className="adn-item-checkbox"
                          type="checkbox"
                          aria-label={`Select ${item.title}`}
                          checked={checkedIds.includes(
                            item.id
                          )}
                          disabled={busy}
                          onChange={() =>
                            toggleChecked(
                              item.id
                            )
                          }
                        />

                        <button
                          type="button"
                          className="adn-notification-main"
                          onClick={() =>
                            setSelectedId(
                              item.id
                            )
                          }
                        >
                          <div
                            className={
                              "adn-type-icon " +
                              item.type
                            }
                          >
                            <Icon
                              size={19}
                              strokeWidth={2}
                            />
                          </div>

                          <div className="adn-item-content">
                            <div className="adn-item-heading">
                              <h3>
                                {item.title}
                              </h3>

                              {!item.isRead && (
                                <span className="adn-unread-dot" />
                              )}
                            </div>

                            <p>{item.message}</p>

                            <span className="adn-item-date">
                              <Clock3 size={12} />
                              {formatDate(
                                item.createdAt
                              )}
                            </span>
                          </div>

                          <ChevronRight
                            size={17}
                            className="adn-item-chevron"
                          />
                        </button>
                      </div>
                    );
                  }
                )
              )}
            </div>

            {/* PAGINATION */}
            <div className="adn-pagination">
              <span>
                Showing {startItem}–{endItem} of{" "}
                {filteredNotifications.length}
              </span>

              <div className="adn-pagination-buttons">
                <button
                  disabled={page === 1}
                  onClick={() =>
                    setPage(
                      (previous) =>
                        previous - 1
                    )
                  }
                  aria-label="Previous page"
                >
                  <ChevronLeft size={17} />
                </button>

                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1
                ).map((number) => (
                  <button
                    key={number}
                    className={
                      page === number
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setPage(number)
                    }
                  >
                    {number}
                  </button>
                ))}

                <button
                  disabled={
                    page === totalPages
                  }
                  onClick={() =>
                    setPage(
                      (previous) =>
                        previous + 1
                    )
                  }
                  aria-label="Next page"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </section>

          {/* RIGHT: NOTIFICATION DETAILS */}
          <section className="adn-detail-panel">
            <div className="adn-detail-top">
              <div>

                <h2>Notification Details</h2>
              </div>

              <div className="adn-detail-bell">
                <Bell size={18} />
              </div>
            </div>

            {selectedNotification ? (
              <>
                <div className="adn-detail-content">
                  <div className="adn-detail-intro">
                    {(() => {
                      const Icon =
                        notificationIcons[
                        selectedNotification.type
                        ] || Bell;

                      return (
                        <div
                          className={
                            "adn-type-icon large " +
                            selectedNotification.type
                          }
                        >
                          <Icon size={24} />
                        </div>
                      );
                    })()}

                    <div className="adn-detail-intro-text">
                      <h3>
                        {selectedNotification.title}
                      </h3>

                      <span className="adn-detail-date">
                        {formatDate(
                          selectedNotification.createdAt
                        )}
                      </span>
                    </div>

                    <span
                      className={
                        "adn-status " +
                        (selectedNotification.isRead
                          ? "read"
                          : "unread")
                      }
                    >
                      {selectedNotification.isRead
                        ? "Read"
                        : "Unread"}
                    </span>
                  </div>

                  <div className="adn-detail-message">
                    {selectedNotification.message}
                  </div>

                  <div className="adn-info-heading">
                    Activity Information
                  </div>

                  <div className="adn-info-table">
                    {selectedNotification.details
                      .length > 0 ? (
                      selectedNotification.details.map(
                        ([label, value], index) => (
                          <div
                            className="adn-info-row"
                            key={index}
                          >
                            <span>
                              {label}
                            </span>

                            <strong>
                              {value}
                            </strong>
                          </div>
                        )
                      )
                    ) : (
                      <div className="adn-info-row">
                        <span>
                          No additional details
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="adn-detail-footer">
                  <button
                    className="adn-btn adn-btn-read"
                    onClick={() =>
                      markAsRead(
                        selectedNotification.id
                      )
                    }
                    disabled={
                      busy ||
                      selectedNotification.isRead
                    }
                  >
                    <Check size={17} />

                    {selectedNotification.isRead
                      ? "Already Read"
                      : "Mark as Read"}
                  </button>

                  <button
                    className="adn-btn adn-btn-danger"
                    onClick={() =>
                      deleteNotifications([
                        selectedNotification.id,
                      ])
                    }
                    disabled={busy}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <div className="adn-detail-empty">
                <Bell
                  size={36}
                  strokeWidth={1.3}
                />

                <h3>No notification selected</h3>

                <p>
                  Select a notification to view
                  its details.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
