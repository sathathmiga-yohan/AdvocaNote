
import { useEffect, useState } from "react";

import {
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
} from "lucide-react";

import AdminSidebar from "./AdminSidebar";
import { getCurrentUser } from "../services/auth";
import "./AdminLayout.css";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const ADMIN_PAGES = [
  { name: "Dashboard", path: "/admin" },
  { name: "Lawyers", path: "/admin/lawyers" },
  {
    name: "Subscriptions & Payments",
    path: "/admin/subscriptions",
  },
  {
    name: "Court & Case Settings",
    path: "/admin/court-settings",
  },
  {
    name: "Notifications",
    path: "/admin/notifications",
  },
  {
    name: "Support & Feedback",
    path: "/admin/support",
  },
  {
    name: "Security & Audit",
    path: "/admin/security",
  },
  {
    name: "System Settings",
    path: "/admin/settings",
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [admin, setAdmin] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  // ==========================================
  // ADMIN NOTIFICATION COUNT
  // ==========================================

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    getCurrentUser()
      .then((user) => {
        if (mounted) setAdmin(user);
      })
      .catch(() => {
        // AdminRoute handles authentication errors.
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  // ==========================================
  // FETCH REAL ADMIN NOTIFICATION COUNT
  // ==========================================

  useEffect(() => {
    let active = true;

    const fetchUnreadCount = async () => {
      const token =
        localStorage.getItem(
          "advocanote_access_token"
        ) ||
        localStorage.getItem("access_token") ||
        localStorage.getItem(
          "advocanote_access_token"
        ) ||
        localStorage.getItem("access_token");

      if (!token) {
        if (active) setUnreadCount(0);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/admin/notifications`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401 && active) {
            setUnreadCount(0);
          }
          return;
        }

        const data = await response.json();

        const items = Array.isArray(data.items)
          ? data.items
          : [];

        const count = items.filter(
          (item) => !item.is_read
        ).length;

        if (active) {
          setUnreadCount(count);
        }
      } catch (error) {
        console.error(
          "Admin notification count error:",
          error
        );
      }
    };

    // Load immediately
    fetchUnreadCount();

    // Refresh every 15 seconds
    const interval = setInterval(
      fetchUnreadCount,
      15000
    );

    // Refresh when returning to browser
    window.addEventListener(
      "focus",
      fetchUnreadCount
    );

    return () => {
      active = false;
      clearInterval(interval);

      window.removeEventListener(
        "focus",
        fetchUnreadCount
      );
    };
  }, [location.pathname]);

  // ==========================================
  // SEARCH ADMIN PAGES
  // ==========================================

  const handleSearch = (event) => {
    event.preventDefault();

    const query = search.trim().toLowerCase();

    if (!query) return;

    const match = ADMIN_PAGES.find((page) =>
      page.name.toLowerCase().includes(query)
    );

    if (!match) {
      setSearchError(
        "No matching admin page found."
      );
      return;
    }

    setSearchError("");
    setSearch("");
    navigate(match.path);
  };

  // ==========================================
  // ADMIN LOGOUT
  // ==========================================

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    const refreshToken = localStorage.getItem(
      "advocanote_refresh_token"
    );

    try {
      if (refreshToken) {
        const controller = new AbortController();

        const timeout = setTimeout(
          () => controller.abort(),
          4000
        );

        try {
          await fetch(`${API_URL}/auth/logout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              refresh_token: refreshToken,
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
      }
    } catch {
      // Clear session even if server is down.
    } finally {
      localStorage.removeItem(
        "advocanote_access_token"
      );
      localStorage.removeItem(
        "advocanote_refresh_token"
      );
      localStorage.removeItem(
        "advocanote_auth_toast"
      );

      setUnreadCount(0);

      navigate("/login", {
        replace: true,
      });

      setLoggingOut(false);
    }
  };

  const adminName =
    admin?.full_name ||
    admin?.name ||
    "Administrator";

  const initial =
    adminName.trim().charAt(0).toUpperCase() || "A";

  return (
    <div className="adm-layout">

      {/* SAME ORIGINAL SIDEBAR DESIGN */}

      <AdminSidebar
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={handleLogout}
      />

      <div className="adm-workspace">

        {/* TOP HEADER */}

        <header className="adm-topbar">

          <button
            type="button"
            className="adm-menu-toggle"
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin navigation"
          >
            <Menu size={23} />
          </button>

          <form
            className="adm-header-search"
            onSubmit={handleSearch}
            role="search"
          >
            <Search size={21} />

            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchError("");
              }}
              placeholder="Search admin pages..."
              aria-label="Search admin pages"
            />

            <button type="submit">
              Search
            </button>
          </form>

          <div className="adm-header-actions">

            {/* ==============================
                ADMIN NOTIFICATION BELL
            ============================== */}

            <button
              type="button"
              className="adm-icon-button adm-notification-button"
              aria-label={
                unreadCount > 0
                  ? `${unreadCount} unread notifications`
                  : "View notifications"
              }
              onClick={() =>
                navigate("/admin/notifications")
              }
            >
              <Bell size={23} />

              {unreadCount > 0 && (
                <span className="adm-notification-badge">
                  {unreadCount > 99
                    ? "99+"
                    : unreadCount}
                </span>
              )}
            </button>

            <div className="adm-header-divider" />

            {/* ORIGINAL ADMIN PROFILE */}

            <div className="adm-profile-area">
              <button
                type="button"
                className="adm-profile-button"
                onClick={() =>
                  setProfileOpen(!profileOpen)
                }
                aria-expanded={profileOpen}
              >
                <span className="adm-avatar">
                  {initial}
                </span>

                <span className="adm-profile-info">
                  <strong>{adminName}</strong>
                  <small>Administrator</small>
                </span>

                <ChevronDown size={17} />
              </button>

              {profileOpen && (
                <div className="adm-profile-dropdown">
                  <strong>{adminName}</strong>
                  <small>{admin?.email || ""}</small>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    <LogOut size={17} />

                    {loggingOut
                      ? "Logging out..."
                      : "Logout"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {searchError && (
          <p
            className="adm-search-error"
            role="alert"
          >
            {searchError}
          </p>
        )}

        {/* ALL ADMIN PAGES DISPLAY HERE */}

        <main className="adm-main">
          <Outlet />
        </main>

      </div>
    </div>
  );
}

