
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

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

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

  const handleSearch = (event) => {
    event.preventDefault();

    const query = search.trim().toLowerCase();

    if (!query) return;

    const match = ADMIN_PAGES.find((page) =>
      page.name.toLowerCase().includes(query)
    );

    if (!match) {
      setSearchError("No matching admin page found.");
      return;
    }

    setSearchError("");
    setSearch("");
    navigate(match.path);
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    const refreshToken = sessionStorage.getItem(
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
      // Clear browser session even if server is down.
    } finally {
      sessionStorage.removeItem(
        "advocanote_access_token"
      );
      sessionStorage.removeItem(
        "advocanote_refresh_token"
      );
      sessionStorage.removeItem(
        "advocanote_auth_toast"
      );

      navigate("/login", { replace: true });
      setLoggingOut(false);
    }
  };

  const adminName =
    admin?.full_name || admin?.name || "Administrator";

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

            <button
              type="button"
              className="adm-icon-button"
              aria-label="View notifications"
              onClick={() =>
                navigate("/admin/notifications")
              }
            >
              <Bell size={23} />
            </button>

            <div className="adm-header-divider" />

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
          <p className="adm-search-error" role="alert">
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
