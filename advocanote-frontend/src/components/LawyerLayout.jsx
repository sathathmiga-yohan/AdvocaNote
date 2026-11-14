
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { createPortal } from "react-dom";

import LawyerSidebar from "./LawyerSidebar";
import Toast from "./Toast";
import ProfileAvatar from "./ProfileAvatar";
import FirstLoginOnboarding from "./FirstLoginOnboarding";

import {
  getCurrentUser,
  logoutUser,
} from "../services/auth";

// =====================================
// LAWYER LAYOUT CONTEXT
// =====================================

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

// =====================================
// MAIN LAWYER LAYOUT
// =====================================

export default function LawyerLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topbarHost, setTopbarHost] = useState(null);

  // SUCCESS NOTIFICATION
  const [toast, setToast] = useState(null);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  // =====================================
  // LOAD CURRENT LAWYER
  // =====================================

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((value) => {
        if (!active) return;

        setUser(value);

        // SUCCESS TOAST AFTER AUTHENTICATION

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
      })

      .catch((error) => {
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
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  // =====================================
  // CLOSE SIDEBAR ON NAVIGATION
  // =====================================

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // =====================================
  // LOGOUT
  // =====================================

  const logout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
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

      navigate("/login", {
        replace: true,
      });
    }
  };

  // =====================================
  // SHARED CONTEXT
  // =====================================

  const context = useMemo(
    () => ({
      user,
      topbarHost,

      openSidebar: () => {
        setSidebarOpen(true);
      },

      closeSidebar: () => {
        setSidebarOpen(false);
      },
    }),
    [user, topbarHost]
  );

  // =====================================
  // PAGE SPECIFIC CLASS
  // =====================================

  const pageClass =
    pathname === "/cases"
      ? "mc-app"
      : pathname === "/add-diary-entry"
        ? "ade2-app"
        : "";

  if (!user) return null;

  // =====================================
  // MAIN LAYOUT
  // =====================================

  return (
    <LawyerLayoutContext.Provider value={context}>

      <div className={`ald-app ${pageClass}`}>

        {/* PERSISTENT LAWYER SIDEBAR */}

        <LawyerSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={logout}
        />

        {/* MAIN WORKSPACE */}

        <div className="ald-workspace">

          {/* SHARED TOPBAR PORTAL HOST */}

          <header
            className="ald-topbar"
            ref={setTopbarHost}
          />

          {/* CURRENT PAGE */}

          <Outlet />

        </div>

        {/* SUCCESS TOAST */}

        <Toast
          toast={toast}
          onClose={closeToast}
        />

        {/* MANDATORY FIRST LOGIN ONBOARDING */}

        <FirstLoginOnboarding user={user} />

      </div>

    </LawyerLayoutContext.Provider>
  );
}

// =====================================
// SHARED TOPBAR PORTAL
// =====================================

export function LawyerTopbarPortal({ children }) {
  const { topbarHost } = useLawyerLayout();

  return topbarHost
    ? createPortal(children, topbarHost)
    : null;
}

// =====================================
// SHARED LAWYER PROFILE AVATAR
// =====================================

export function LawyerTopbarAvatar() {
  const { user } = useLawyerLayout();

  return <ProfileAvatar user={user} size={36} />;
}

