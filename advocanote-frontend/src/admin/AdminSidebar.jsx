
import { useLocation, useNavigate } from "react-router-dom";

import {
  LayoutDashboard,
  Users,
  CreditCard,
  Landmark,
  Bell,
  Settings,
  ChevronRight,
  LogOut,
} from "lucide-react";

import "./AdminSidebar.css";

const ADMIN_MENU_ITEMS = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    to: "/admin",
  },
  {
    label: "Lawyers",
    icon: Users,
    to: "/admin/lawyers",
  },
  {
    label: "Subscriptions",
    icon: CreditCard,
    to: "/admin/subscriptions",
  },
  {
    label: "Notifications",
    icon: Bell,
    to: "/admin/notifications",
  },
  {
    label: "System Settings",
    icon: Settings,
    to: "/admin/settings",
  },
];

export default function AdminSidebar({
  isOpen = false,
  onClose,
  onLogout,
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path) => {
    if (path === "/admin") {
      return pathname === "/admin" ||
        pathname === "/admin/dashboard";
    }

    return (
      pathname === path ||
      pathname.startsWith(`${path}/`)
    );
  };

  const goTo = (path) => {
    onClose?.();
    navigate(path);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }

    // Client-side fallback.
    // Production logout should also revoke sessions
    // through the backend where supported.
    localStorage.removeItem(
      "advocanote_access_token"
    );

    localStorage.removeItem(
      "advocanote_refresh_token"
    );

    localStorage.removeItem(
      "advocanote_auth_toast"
    );

    navigate("/login", { replace: true });
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="adms-mobile-overlay"
          aria-label="Close admin sidebar"
          onClick={onClose}
        />
      )}

      <aside
        className={`adms-sidebar ${
          isOpen ? "adms-sidebar--open" : ""
        }`}
      >
        <div className="adms-sidebar-main">

          {/* ADVOCANOTE LOGO */}

          <div className="adms-sidebar-brand">
            <svg
              className="adms-brand-icon"
              viewBox="0 0 48 58"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M24 3 5 12h38L24 3ZM9 16h30M7 51h34M4 56h40"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />

              <path
                d="M12 19v28M20 19v28M28 19v28M36 19v28"
                stroke="currentColor"
                strokeWidth="4"
              />
            </svg>

            <div className="adms-brand-wordmark">
              Advoca<span>Note</span>
            </div>

            <div className="adms-brand-subtitle">
              Admin Panel
            </div>

            <div className="adms-brand-line" />
          </div>

          {/* ADMIN NAVIGATION */}

          <nav
            className="adms-nav"
            aria-label="Admin dashboard navigation"
          >
            {ADMIN_MENU_ITEMS.map(
              ({ label, icon: Icon, to }) => {
                const active = isActive(to);

                return (
                  <button
                    key={to}
                    type="button"
                    className={`adms-nav-item ${
                      active
                        ? "adms-nav-item--active"
                        : ""
                    }`}
                    aria-current={
                      active ? "page" : undefined
                    }
                    onClick={() => goTo(to)}
                  >
                    <Icon
                      size={26}
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />

                    <span>{label}</span>

                    {active && (
                      <ChevronRight
                        size={19}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              }
            )}

            {/* LOGOUT */}

            <button
              type="button"
              className="adms-nav-item"
              onClick={handleLogout}
            >
              <LogOut
                size={26}
                strokeWidth={1.9}
                aria-hidden="true"
              />

              <span>Logout</span>
            </button>

          </nav>
        </div>

        {/* Background image already
            contains books and scales */}

        <div
          className="adms-sidebar-bottom-art"
          aria-hidden="true"
        />

      </aside>
    </>
  );
}
