
import { useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Crown,
  Folder,
  Gavel,
  LogOut,
  Sparkles,
  UserRound,
} from "lucide-react";

const MENU_ITEMS = [
  {
    label: "My Legal Diary",
    icon: CalendarDays,
    to: "/my-legal-diary",
  },
  {
    label: "My Cases",
    icon: Folder,
    to: "/cases",
  },
  {
    label: "Hearings",
    icon: Gavel,
    to: "/hearings",
  },
  {
    label: "Calendar",
    icon: CalendarDays,
    to: "/calendar",
  },
  {
    label: "Tasks & Deadlines",
    icon: CheckSquare,
    to: "/tasks",
  },
  {
    label: "AI Suggestions",
    icon: Sparkles,
    to: "/ai-suggestions",
  },
  {
    label: "Subscription",
    icon: Crown,
    to: "/subscription",
  },
  {
    label: "Profile",
    icon: UserRound,
    to: "/profile",
  },
];

export default function LawyerSidebar({
  isOpen = false,
  onClose,
  onLogout,
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path) => {
    if (path === "/my-legal-diary") {
      return [
        "/my-legal-diary",
        "/lawyer",
        "/add-diary-entry",
      ].includes(pathname);
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

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="ald-mobile-overlay"
          aria-label="Close sidebar"
          onClick={onClose}
        />
      )}

      <aside
        className={`ald-sidebar ${
          isOpen ? "ald-sidebar--open" : ""
        }`}
      >
        <div className="ald-sidebar-main">
          <div className="ald-sidebar-brand">
            <svg
              className="ald-brand-icon"
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

            <div className="ald-brand-wordmark">
              Advoca<span>Note</span>
            </div>

            <div className="ald-brand-subtitle">
              AI Smart Legal Diary
            </div>

            <div className="ald-brand-line" />
          </div>

          <nav
            className="ald-nav"
            aria-label="Lawyer dashboard navigation"
          >
            {MENU_ITEMS.map(({ label, icon: Icon, to }) => {
              const active = isActive(to);

              return (
                <button
                  key={to}
                  type="button"
                  className={`ald-nav-item ${
                    active ? "ald-nav-item--active" : ""
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
            })}

            <button
              type="button"
              className="ald-nav-item"
              onClick={onLogout}
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

        <div
          className="ald-sidebar-bottom-art"
          aria-hidden="true"
        />
      </aside>
    </>
  );
}
