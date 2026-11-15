
import React, { useEffect, useMemo, useState } from "react";
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

const STORAGE_KEY = "advocanote_admin_notifications_demo";
const PAGE_SIZE = 5;

// ========================================
// SAMPLE NOTIFICATIONS
// Replace with backend data later
// ========================================

const sampleNotifications = [
  {
    id: 1,
    type: "registration",
    title: "New Lawyer Registration",
    message: "Arul Prakash has registered as a lawyer.",
    createdAt: "2026-11-15T10:24:00+05:30",
    isRead: false,
    details: [
      ["Full Name", "Arul Prakash"],
      ["Email", "arul@example.com"],
      ["Account Type", "Individual Lawyer"],
      ["Status", "Registered"],
    ],
  },
  {
    id: 2,
    type: "subscription",
    title: "New Subscription",
    message: "Kavitha has subscribed to the Pro Plan.",
    createdAt: "2026-11-15T09:47:00+05:30",
    isRead: false,
    details: [
      ["Lawyer", "Kavitha"],
      ["Plan", "Pro Plan"],
      ["Billing", "Annual"],
      ["Status", "Active"],
    ],
  },
  {
    id: 3,
    type: "trial",
    title: "Trial Expiring Soon",
    message: "Dinesh's free trial will expire in 2 days.",
    createdAt: "2026-11-15T08:30:00+05:30",
    isRead: false,
    details: [
      ["Lawyer", "Dinesh"],
      ["Plan", "Free Trial"],
      ["Remaining", "2 Days"],
      ["Status", "Expiring Soon"],
    ],
  },
  {
    id: 4,
    type: "payment",
    title: "Payment Successful",
    message: "Subscription payment received from Senthil.",
    createdAt: "2026-11-14T18:20:00+05:30",
    isRead: true,
    details: [
      ["Lawyer", "Senthil"],
      ["Payment Type", "Subscription"],
      ["Status", "Successful"],
    ],
  },
  {
    id: 5,
    type: "feedback",
    title: "New Feedback",
    message: "Priya has submitted new feedback.",
    createdAt: "2026-11-14T15:10:00+05:30",
    isRead: true,
    details: [
      ["Submitted By", "Priya"],
      ["Category", "General Feedback"],
      ["Status", "Received"],
    ],
  },
  {
    id: 6,
    type: "failed",
    title: "Payment Failed",
    message: "Subscription payment failed for Ramesh.",
    createdAt: "2026-11-14T12:15:00+05:30",
    isRead: false,
    details: [
      ["Lawyer", "Ramesh"],
      ["Payment Type", "Subscription"],
      ["Status", "Failed"],
    ],
  },
  {
    id: 7,
    type: "expired",
    title: "Subscription Expired",
    message: "Ramesh's subscription has expired.",
    createdAt: "2026-11-13T17:15:00+05:30",
    isRead: true,
    details: [
      ["Lawyer", "Ramesh"],
      ["Plan", "Pro Plan"],
      ["Status", "Expired"],
    ],
  },
];

const notificationIcons = {
  registration: UserRoundPlus,
  subscription: Crown,
  trial: CalendarClock,
  payment: CreditCard,
  feedback: MessageSquare,
  failed: AlertTriangle,
  expired: CalendarX2,
};

function formatDate(value) {
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  }).format(new Date(value));
}

function loadNotifications() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.error("Notifications loading failed:", error);
  }

  return sampleNotifications;
}

export default function AdminNotifications() {
  const [notifications, setNotifications] =
    useState(loadNotifications);

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(1);
  const [checkedIds, setCheckedIds] = useState([]);
  const [page, setPage] = useState(1);

  // Save demo changes locally
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(notifications)
    );
  }, [notifications]);

  const totalCount = notifications.length;

  const unreadCount = notifications.filter(
    (item) => !item.isRead
  ).length;

  const readCount = totalCount - unreadCount;

  // ========================================
  // FILTER + SEARCH
  // ========================================

  const filteredNotifications = useMemo(() => {
    const term = search.trim().toLowerCase();

    return notifications.filter((item) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "unread" && !item.isRead) ||
        (activeTab === "read" && item.isRead);

      const matchesSearch =
        !term ||
        `${item.title} ${item.message}`
          .toLowerCase()
          .includes(term);

      return matchesTab && matchesSearch;
    });
  }, [notifications, activeTab, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredNotifications.length / PAGE_SIZE)
  );

  useEffect(() => {
    setPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  const visibleNotifications = filteredNotifications.slice(
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
    visibleIds.every((id) => checkedIds.includes(id));

  // ========================================
  // ACTIONS
  // ========================================

  const changeTab = (tab) => {
    setActiveTab(tab);
    setPage(1);
    setCheckedIds([]);
  };

  const markAsRead = (id) => {
    setNotifications((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, isRead: true }
          : item
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications((previous) =>
      previous.map((item) => ({
        ...item,
        isRead: true,
      }))
    );
  };

  const toggleChecked = (id) => {
    setCheckedIds((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
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

      return [...new Set([...previous, ...visibleIds])];
    });
  };

  const deleteNotifications = (ids) => {
    if (!ids.length) return;

    const confirmed = window.confirm(
      `Delete ${ids.length} notification(s)?`
    );

    if (!confirmed) return;

    setNotifications((previous) =>
      previous.filter((item) => !ids.includes(item.id))
    );

    setCheckedIds((previous) =>
      previous.filter((id) => !ids.includes(id))
    );

    if (ids.includes(selectedId)) {
      setSelectedId(null);
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
        <div className="adn-header">
          <div className="adn-header-left">
            <div className="adn-header-icon">
              <Bell size={25} strokeWidth={1.8} />
            </div>

            <div>
              <div className="adn-eyebrow">
                ADMIN / ACTIVITY CENTER
              </div>

              <h1>Notifications</h1>

              <p>
                Stay updated with important activities
                across AdvocaNote.
              </p>
            </div>
          </div>

          <div className="adn-header-actions">
            <button
              className="adn-btn adn-btn-gold"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck size={17} />
              Mark all as read
            </button>

            <button
              className="adn-btn adn-btn-danger"
              onClick={() =>
                deleteNotifications(checkedIds)
              }
              disabled={checkedIds.length === 0}
            >
              <Trash2 size={16} />
              Delete selected
              {checkedIds.length > 0 &&
                ` (${checkedIds.length})`}
            </button>
          </div>
        </div>

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
                  (activeTab === key ? "active" : "")
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

        {/* MAIN CONTENT */}
        <div className="adn-content">

          {/* LEFT: NOTIFICATION LIST */}
          <section className="adn-list-panel">
            <div className="adn-list-heading">
              <div>
                <h2>Recent Activity</h2>
                <p>Manage your system notifications</p>
              </div>

              <label className="adn-select-all">
                <input
                  type="checkbox"
                  checked={allVisibleChecked}
                  disabled={visibleIds.length === 0}
                  onChange={toggleAllVisible}
                />
                Select all
              </label>
            </div>

            <div className="adn-list-body">
              {visibleNotifications.length === 0 ? (
                <div className="adn-empty">
                  <Inbox size={35} strokeWidth={1.4} />
                  <h3>No notifications found</h3>
                  <p>
                    There are no notifications matching
                    your current filter.
                  </p>
                </div>
              ) : (
                visibleNotifications.map((item) => {
                  const Icon =
                    notificationIcons[item.type] || Bell;

                  const isActive =
                    selectedNotification?.id === item.id;

                  return (
                    <div
                      key={item.id}
                      className={[
                        "adn-notification",
                        !item.isRead ? "is-unread" : "",
                        isActive ? "is-active" : "",
                      ].join(" ")}
                    >
                      <input
                        className="adn-item-checkbox"
                        type="checkbox"
                        aria-label={`Select ${item.title}`}
                        checked={checkedIds.includes(
                          item.id
                        )}
                        onChange={() =>
                          toggleChecked(item.id)
                        }
                      />

                      <button
                        type="button"
                        className="adn-notification-main"
                        onClick={() =>
                          setSelectedId(item.id)
                        }
                      >
                        <div
                          className={
                            "adn-type-icon " +
                            item.type
                          }
                        >
                          <Icon size={19} strokeWidth={2} />
                        </div>

                        <div className="adn-item-content">
                          <div className="adn-item-heading">
                            <h3>{item.title}</h3>

                            {!item.isRead && (
                              <span className="adn-unread-dot" />
                            )}
                          </div>

                          <p>{item.message}</p>

                          <span className="adn-item-date">
                            <Clock3 size={12} />
                            {formatDate(item.createdAt)}
                          </span>
                        </div>

                        <ChevronRight size={17} className="adn-item-chevron" />
                      </button>
                    </div>
                  );
                })
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
                    setPage((previous) => previous - 1)
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
                      page === number ? "active" : ""
                    }
                    onClick={() => setPage(number)}
                  >
                    {number}
                  </button>
                ))}

                <button
                  disabled={page === totalPages}
                  onClick={() =>
                    setPage((previous) => previous + 1)
                  }
                  aria-label="Next page"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </section>

          {/* RIGHT: DETAILS PANEL */}
          <section className="adn-detail-panel">
            <div className="adn-detail-top">
              <div>
                <span className="adn-detail-overline">
                  SELECTED NOTIFICATION
                </span>
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
                    {selectedNotification.details.map(
                      ([label, value], index) => (
                        <div
                          className="adn-info-row"
                          key={index}
                        >
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="adn-detail-footer">
                  <button
                    className="adn-btn adn-btn-read"
                    onClick={() =>
                      markAsRead(selectedNotification.id)
                    }
                    disabled={selectedNotification.isRead}
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
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <div className="adn-detail-empty">
                <Bell size={36} strokeWidth={1.3} />
                <h3>No notification selected</h3>
                <p>
                  Select a notification to view its details.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
