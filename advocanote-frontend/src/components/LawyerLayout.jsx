
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { createPortal } from "react-dom";

import {
  Menu,
  Search,
  ChevronDown,
  UserRound,
  LogOut,
} from "lucide-react";

import LawyerSidebar from "./LawyerSidebar";
import Toast from "./Toast";
import ProfileAvatar from "./ProfileAvatar";
import FirstLoginOnboarding from "./FirstLoginOnboarding";
import SubscriptionGate from "./SubscriptionGate";
import NotificationBell from "./NotificationBell";

import {
  getCurrentUser,
  logoutUser,
} from "../services/auth";

import "./LawyerUnifiedTopbar.css";


const API_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");


const LawyerLayoutContext = createContext(null);


export function useLawyerLayout() {
  const context = useContext(LawyerLayoutContext);

  if (!context) {
    throw new Error(
      "Lawyer pages must be inside LawyerLayout"
    );
  }

  return context;
}


function findSearchInput(children) {
  let found = null;

  function visit(nodes) {
    Children.forEach(nodes, (node) => {
      if (found || !isValidElement(node)) {
        return;
      }

      if (
        node.type === "input" &&
        (
          !node.props.type ||
          node.props.type === "text" ||
          node.props.type === "search"
        )
      ) {
        found = node;
        return;
      }

      if (node.props.children) {
        visit(node.props.children);
      }
    });
  }

  visit(children);

  return found;
}


export default function LawyerLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const profileRef = useRef(null);

  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [topbarHost, setTopbarHost] = useState(null);
  const [topbarSearchHost, setTopbarSearchHost] =
    useState(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState(null);


  const closeToast = useCallback(() => {
    setToast(null);
  }, []);


  useEffect(() => {
    let active = true;

    async function initializeLawyer() {
      try {
        const value = await getCurrentUser();

        if (!active) return;

        const token = sessionStorage.getItem(
          "advocanote_access_token"
        );

        if (value?.role === "lawyer" && token) {
          try {
            const response = await fetch(
              `${API_URL}/subscriptions/access`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            const subscription = await response
              .json()
              .catch(() => null);

            if (!response.ok) {
              console.error(
                "Subscription initialization failed:",
                subscription
              );
            }
          } catch (error) {
            console.error(
              "Unable to initialize subscription:",
              error
            );
          }
        }

        if (!active) return;

        setUser(value);

        const notification = sessionStorage.getItem(
          "advocanote_auth_toast"
        );

        if (notification) {
          sessionStorage.removeItem(
            "advocanote_auth_toast"
          );

          if (notification === "register") {
            setToast({
              title: "Registration Successful!",
              message:
                "Welcome to AdvocaNote! Your account is ready.",
            });
          } else if (notification === "login") {
            setToast({
              title: "Login Successful!",
              message:
                "Welcome back to AdvocaNote!",
            });
          } else if (notification === "google") {
            setToast({
              title: "Google Login Successful!",
              message:
                "Welcome back to AdvocaNote!",
            });
          }
        }
      } catch (error) {
        if (!active) return;

        console.error(
          "Unable to load current lawyer:",
          error
        );

        sessionStorage.removeItem(
          "advocanote_access_token"
        );

        sessionStorage.removeItem(
          "advocanote_refresh_token"
        );

        sessionStorage.removeItem(
          "advocanote_auth_toast"
        );

        navigate("/login", {
          replace: true,
        });
      }
    }

    initializeLawyer();

    return () => {
      active = false;
    };
  }, [navigate]);


  useEffect(() => {
    setSidebarOpen(false);
    setProfileOpen(false);
  }, [pathname]);


  useEffect(() => {
    if (!profileOpen) return;

    function handleOutsideClick(event) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setProfileOpen(false);
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
  }, [profileOpen]);


  const logout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Logout error:", error);
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

      setUser(null);
      setProfileOpen(false);

      navigate("/login", {
        replace: true,
      });
    }
  };


  const context = useMemo(
    () => ({
      user,
      topbarHost,
      topbarSearchHost,

      openSidebar: () => {
        setSidebarOpen(true);
      },

      closeSidebar: () => {
        setSidebarOpen(false);
      },
    }),
    [user, topbarHost, topbarSearchHost]
  );


  const pageClass =
    pathname === "/cases"
      ? "mc-app"
      : pathname === "/add-diary-entry"
        ? "ade2-app"
        : "";


  const displayName =
    user?.full_name ||
    user?.name ||
    [user?.first_name, user?.last_name]
      .filter(Boolean)
      .join(" ") ||
    "Lawyer";


  if (!user) return null;


  return (
    <LawyerLayoutContext.Provider value={context}>
      <div className={`ald-app ${pageClass}`}>
        <LawyerSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={logout}
        />

        <div className="ald-workspace">
          <header
            className="ald-topbar alu-topbar"
            ref={setTopbarHost}
          >
            <button
              type="button"
              className="alu-mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={23} />
            </button>

            <div
              ref={setTopbarSearchHost}
              className="ald-global-search alu-search"
              role="search"
            >
              <Search
                size={22}
                className="alu-search-icon"
                aria-hidden="true"
              />
            </div>

            <div className="alu-topbar-actions">
              <NotificationBell />

              <div className="alu-divider" />

              <div
                ref={profileRef}
                className="alu-profile-holder"
              >
                <button
                  type="button"
                  className="alu-account"
                  onClick={() =>
                    setProfileOpen((previous) => !previous)
                  }
                  aria-label="Account menu"
                  aria-expanded={profileOpen}
                  aria-haspopup="true"
                >
                  <ProfileAvatar
                    user={user}
                    size={36}
                  />

                  <span className="alu-account-info">
                    <strong>{displayName}</strong>
                    <small>Attorney-at-Law</small>
                  </span>

                  <ChevronDown
                    size={18}
                    className="alu-account-chevron"
                  />
                </button>

                {profileOpen && (
                  <div className="alu-account-popover">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate("/profile");
                      }}
                    >
                      <UserRound size={17} />
                      My Profile
                    </button>

                    <button
                      type="button"
                      onClick={logout}
                    >
                      <LogOut size={17} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <Outlet />
        </div>

        <Toast
          toast={toast}
          onClose={closeToast}
        />

        <FirstLoginOnboarding user={user} />

        <SubscriptionGate />
      </div>
    </LawyerLayoutContext.Provider>
  );
}


export function LawyerTopbarPortal({ children }) {
  const { topbarSearchHost } = useLawyerLayout();

  const searchInput = findSearchInput(children);

  if (!topbarSearchHost || !searchInput) {
    return null;
  }

  return createPortal(
    cloneElement(searchInput, {
      className: "alu-search-input",
      placeholder: "Search cases, hearings, tasks...",
    }),
    topbarSearchHost
  );
}


export function LawyerTopbarAvatar() {
  const { user } = useLawyerLayout();

  return (
    <ProfileAvatar
      user={user}
      size={36}
    />
  );
}
