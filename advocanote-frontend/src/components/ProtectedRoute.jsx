
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { getCurrentUser } from "../services/auth";

function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let active = true;

    async function checkLogin() {
      const token = localStorage.getItem(
        "advocanote_access_token"
      );

      // No login session
      if (!token) {
        if (active) {
          setStatus("unauthorized");
        }
        return;
      }

      try {
        // Verify the current session with FastAPI
        const user = await getCurrentUser();

        // Ignore responses from an old/unmounted request
        if (!active) return;

        console.log(
          "[ProtectedRoute] User role:",
          user?.role
        );

        if (user?.role === "lawyer") {
          setStatus("allowed");
        } else {
          setStatus("unauthorized");
        }

      } catch (error) {
        // Do not let an old request clear a newer session
        if (!active) return;

        console.error(
          "[ProtectedRoute] Authentication error:",
          error
        );

        // Only clear tokens when authentication is rejected
        if (
          error?.status === 401 ||
          error?.status === 403
        ) {
          localStorage.removeItem(
            "advocanote_access_token"
          );

          localStorage.removeItem(
            "advocanote_refresh_token"
          );

          setStatus("unauthorized");
          return;
        }

        // Network/server errors are not the same as logout
        setStatus("error");
      }
    }

    checkLogin();

    return () => {
      active = false;
    };
  }, []);

  // Checking authenticated session
  if (status === "checking") {
    return null;
  }

  // Invalid or missing login session
  if (status === "unauthorized") {
    return <Navigate to="/login" replace />;
  }

  // Temporary backend/network failure
  if (status === "error") {
    return (
      <div role="alert">
        Unable to verify your login session.
        Please refresh the page and try again.
      </div>
    );
  }

  // Valid lawyer session
  return children;
}

export default ProtectedRoute;
