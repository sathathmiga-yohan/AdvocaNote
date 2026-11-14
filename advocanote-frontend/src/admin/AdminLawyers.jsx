
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Search,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import "./AdminLawyers.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminLawyers() {
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchLawyers() {
      setLoading(true);
      setError("");

      const token = sessionStorage.getItem(
        "advocanote_access_token"
      );

      if (!token) {
        setError("Your session has expired. Please login.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(

          `${API_URL}/admin/subscriptions/overview`,

          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            signal: controller.signal,
          }
        );

        if (response.status === 401) {
          throw new Error(
            "Your login session has expired."
          );
        }

        if (response.status === 403) {
          throw new Error(
            "You do not have permission to view lawyers."
          );
        }

        if (!response.ok) {
          throw new Error(
            `Unable to load lawyers (${response.status}).`
          );
        }

        const data = await response.json();


        const records = data?.lawyers;


        if (!Array.isArray(records)) {
          throw new Error("Unexpected API response.");
        }

        setLawyers(records);
      } catch (err) {
        if (err.name === "AbortError") return;

        setError(
          err.message || "Failed to load lawyer accounts."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchLawyers();

    return () => controller.abort();
  }, [refreshKey]);

  const filteredLawyers = useMemo(() => {
    return lawyers.filter((lawyer) => {
      const query = search.trim().toLowerCase();

      const text = [
        lawyer.id,
        lawyer.full_name,
        lawyer.email,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = text.includes(query);

      const matchesFilter =
        filter === "all" ||
        (filter === "active" &&
          lawyer.is_active === true) ||
        (filter === "suspended" &&
          lawyer.is_active === false);

      return matchesSearch && matchesFilter;
    });
  }, [lawyers, search, filter]);


  const statusAvailable =
    lawyers.length > 0 &&
    lawyers.every(
      (lawyer) => typeof lawyer.is_active === "boolean"
    );

  const activeCount = lawyers.filter(
    (lawyer) => lawyer.is_active === true
  ).length;

  const suspendedCount = lawyers.filter(
    (lawyer) => lawyer.is_active === false
  ).length;


  return (
    <div className="admin-lawyers-page">

      <div className="admin-lawyers-heading">
        <div>
          <h1>Lawyer Management</h1>
          <p>
            Manage registered lawyer accounts
            and monitor account status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((n) => n + 1)}
          disabled={loading}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="admin-lawyers-stats">

        <div className="admin-lawyers-stat">
          <Users size={24} />
          <span>Total Lawyers</span>
          <strong>{loading || error ? "—" : lawyers.length}</strong>
        </div>

        <div className="admin-lawyers-stat">
          <UserCheck size={24} />
          <span>Active Accounts</span>
          <strong>
            {loading || error || !statusAvailable ? "—" : activeCount}
          </strong>
        </div>

        <div className="admin-lawyers-stat">
          <UserX size={24} />
          <span>Suspended Accounts</span>
          <strong>
            {loading || error || !statusAvailable ? "—" : suspendedCount}
          </strong>
        </div>

      </div>

      <section className="admin-lawyers-panel">

        <div className="admin-lawyers-toolbar">

          <div className="admin-lawyers-search">
            <Search size={19} />

            <input
              type="search"
              placeholder="Search name, email or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter lawyer accounts"
          >
            <option value="all">All Accounts</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>

        </div>

        {error && (
          <div className="admin-lawyers-error" role="alert">
            {error}
          </div>
        )}

        <div className="admin-lawyers-table-wrap">
          <table className="admin-lawyers-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Lawyer Name</th>
                <th>Email</th>
                <th>Registered On</th>
                <th>Email Verification</th>
                <th>Account Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="table-message">
                    Loading lawyer accounts...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="6" className="table-message">
                    Unable to display records.
                  </td>
                </tr>
              ) : filteredLawyers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-message">
                    No lawyer accounts found.
                  </td>
                </tr>
              ) : (
                filteredLawyers.map((lawyer) => (
                  <tr key={lawyer.id}>
                    <td>#{lawyer.id}</td>

                    <td>
                      <strong>{lawyer.full_name}</strong>
                    </td>

                    <td>{lawyer.email}</td>

                    <td>
                      {formatDate(lawyer.created_at)}
                    </td>


                    <td>
                      {lawyer.is_verified === true ? (
                        <span className="lawyer-verified">
                          <ShieldCheck size={14} />
                          Verified
                        </span>
                      ) : lawyer.is_verified === false ? (
                        "Not Verified"
                      ) : (
                        "—"
                      )}
                    </td>



                    <td>
                      {typeof lawyer.is_active === "boolean" ? (
                        <span
                          className={
                            lawyer.is_active
                              ? "lawyer-active"
                              : "lawyer-suspended"
                          }
                        >
                          {lawyer.is_active ? "Active" : "Suspended"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </section>
    </div>
  );
}
