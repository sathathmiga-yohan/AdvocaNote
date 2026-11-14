
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUser } from "../services/auth";

function AdminRoute({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      const token = sessionStorage.getItem(
        "advocanote_access_token"
      );

      if (!token) {
        if (active) setStatus("unauthorized");
        return;
      }

      try {
        const user = await getCurrentUser();

        if (!active) return;

        const role = String(user?.role ?? "")
          .trim()
          .toLowerCase();

        if (role === "admin") {
          setStatus("allowed");
        } else if (role === "lawyer") {
          setStatus("lawyer");
        } else {
          setStatus("forbidden");
        }
      } catch (error) {
        if (!active) return;

        if (error?.status === 401) {
          sessionStorage.removeItem(
            "advocanote_access_token"
          );
          sessionStorage.removeItem(
            "advocanote_refresh_token"
          );

          setStatus("unauthorized");
        } else if (error?.status === 403) {
          setStatus("forbidden");
        } else {
          setStatus("error");
        }
      }
    }

    checkAdmin();

    return () => {
      active = false;
    };
  }, []);

  if (status === "checking") {
    return null;
  }

  if (status === "unauthorized") {
    return <Navigate to="/login" replace />;
  }

  if (status === "lawyer") {
    return (
      <Navigate to="/my-legal-diary" replace />
    );
  }

  if (status === "forbidden") {
    return (
      <div role="alert">
        Access denied. You do not have admin permission.
      </div>
    );
  }

  if (status === "error") {
    return (
      <div role="alert">
        Unable to verify your session.
        Please refresh the page and try again.
      </div>
    );
  }

  return children;
}

export default AdminRoute;
