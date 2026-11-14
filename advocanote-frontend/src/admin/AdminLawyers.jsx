
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  UsersRound,
  UserCheck,
  UserX,
  Search,
  RefreshCw,
  Eye,
  X,
  CreditCard,
  ShieldCheck,
  Ban,
  CheckCircle2,
  CalendarDays,
  AlertCircle,
} from "lucide-react";

import "./AdminLawyers.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(value) {
  return String(value || "L")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function getStatus(lawyer) {
  if (typeof lawyer.is_active !== "boolean") {
    return "unknown";
  }

  return lawyer.is_active ? "active" : "suspended";
}

function getVerification(lawyer) {
  const verified =
    lawyer.email_verified ??
    lawyer.is_email_verified ??
    lawyer.is_verified;

  if (verified === true) return "Verified";
  if (verified === false) return "Not Verified";
  return "Unknown";
}

function DetailItem({ label, value }) {
  return (
    <div className="alm-detail-item">
      <span>{label}</span>
      <strong>{value ?? "Not available"}</strong>
    </div>
  );
}

export default function AdminLawyers() {
  const [overview, setOverview] = useState({
    lawyers: [],
    plans: [],
  });

  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const lawyersPerPage = 20;
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");

  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  // Load real admin data

  useEffect(() => {
    const controller = new AbortController();

    async function loadLawyers() {
      setLoading(true);
      setError("");

      const token = sessionStorage.getItem(
        "advocanote_access_token"
      );

      if (!token) {
        setError("Please sign in as an administrator.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/admin/subscriptions/overview?period=30d`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            signal: controller.signal,
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.detail ||
            `Unable to load lawyers (${response.status}).`
          );
        }

        if (!Array.isArray(data.lawyers)) {
          throw new Error("Invalid lawyers API response.");
        }

        if (!controller.signal.aborted) {
          setOverview({
            lawyers: data.lawyers,
            plans: Array.isArray(data.plans)
              ? data.plans
              : [],
          });
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(
            err.message || "Could not load lawyers."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadLawyers();

    return () => controller.abort();
  }, [refreshKey]);

  const lawyers = overview.lawyers;

  const selectedLawyer = lawyers.find(
    (lawyer) =>
      String(lawyer.id) === String(selectedId)
  );

  const activeCount = lawyers.filter(
    (lawyer) => lawyer.is_active === true
  ).length;

  const suspendedCount = lawyers.filter(
    (lawyer) => lawyer.is_active === false
  ).length;

  const filteredLawyers = useMemo(() => {
    return lawyers
      .filter((lawyer) => {
        const query = search.trim().toLowerCase();

        const text = [
          lawyer.id,
          lawyer.full_name,
          lawyer.email,
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !query || text.includes(query);


        const accountStatus = getStatus(lawyer);
        const verification = getVerification(lawyer);

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" &&
            accountStatus === "active") ||
          (statusFilter === "suspended" &&
            accountStatus === "suspended") ||
          (statusFilter === "not_verified" &&
            verification === "Not Verified") ||
          (statusFilter === "verified" &&
            verification === "Verified");


        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const dateA = new Date(
          a.created_at || 0
        ).getTime();

        const dateB = new Date(
          b.created_at || 0
        ).getTime();

        return dateB - dateA;
      });
  }, [lawyers, search, statusFilter]);

  // =====================================
  // PAGINATION - 20 LAWYERS PER PAGE
  // =====================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLawyers.length / lawyersPerPage)
  );

  const startIndex = (currentPage - 1) * lawyersPerPage;

  const paginatedLawyers = filteredLawyers.slice(
    startIndex,
    startIndex + lawyersPerPage
  );

  const startRecord = filteredLawyers.length
    ? startIndex + 1
    : 0;

  const endRecord = Math.min(
    startIndex + lawyersPerPage,
    filteredLawyers.length
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function getSubscription(lawyer) {
    const subscription = lawyer?.subscription;

    if (!subscription) {
      return {
        name: "No subscription record",
        status: "Not available",
        start: null,
        end: null,
      };
    }

    const plan = overview.plans.find(
      (item) =>
        Number(item.id) ===
        Number(subscription.plan_id)
    );

    return {
      name:
        subscription.plan_name ||
        plan?.name ||
        "Plan not available",

      status:
        subscription.status || "Unknown",

      start:
        subscription.start_date ||
        subscription.starts_at ||
        subscription.current_period_start,

      end:
        subscription.end_date ||
        subscription.expires_at ||
        subscription.current_period_end,
    };
  }

  function openLawyer(lawyer, tab = "profile") {
    setSelectedId(lawyer.id);
    setActiveTab(tab);
    setReason("");
    setActionError("");
  }

  function closeLawyer() {
    if (saving) return;

    setSelectedId(null);
    setReason("");
    setActionError("");
  }

  // Suspend or reactivate a lawyer

  async function updateAccountStatus() {
    if (!selectedLawyer || saving) return;

    if (
      typeof selectedLawyer.is_active !== "boolean"
    ) {
      setActionError(
        "Account status is unavailable."
      );
      return;
    }

    const nextActive = !selectedLawyer.is_active;

    if (!nextActive && !reason.trim()) {
      setActionError(
        "Please enter a reason for suspension."
      );
      return;
    }

    const action = nextActive
      ? "reactivate"
      : "suspend";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ` +
      `${selectedLawyer.full_name}?`
    );

    if (!confirmed) return;

    const token = sessionStorage.getItem(
      "advocanote_access_token"
    );

    if (!token) {
      setActionError("Admin session expired.");
      return;
    }

    setSaving(true);
    setActionError("");

    try {
      const response = await fetch(
        `${API_URL}/admin/lawyers/${selectedLawyer.id}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            is_active: nextActive,
            reason: nextActive
              ? "Account reactivated by administrator"
              : reason.trim(),
          }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail =
          typeof result.detail === "string"
            ? result.detail
            : "Could not update account status.";

        throw new Error(detail);
      }

      if (
        result.id == null ||
        typeof result.is_active !== "boolean" ||
        String(result.id) !== String(selectedLawyer.id) ||
        result.is_active !== nextActive
      ) {
        throw new Error(
          "Server did not confirm the requested status."
        );
      }

      setOverview((previous) => ({
        ...previous,
        lawyers: previous.lawyers.map((lawyer) =>
          String(lawyer.id) === String(selectedLawyer.id)
            ? {
              ...lawyer,
              is_active: result.is_active,
            }
            : lawyer
        ),
      }));

      setNotice(
        nextActive
          ? "Lawyer account reactivated successfully."
          : "Lawyer account suspended successfully."
      );

      setSelectedId(null);
      setReason("");
    } catch (err) {
      setActionError(
        err.message || "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  // Close drawer using Escape

  useEffect(() => {
    if (selectedId === null) return;

    function onKeyDown(event) {
      if (event.key === "Escape" && !saving) {
        closeLawyer();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () =>
      document.removeEventListener("keydown", onKeyDown);
  }, [selectedId, saving]);

  return (
    <main className="alm-page">
      <header className="alm-page-header">
        <div>
          <h1>Lawyer Management</h1>
          <p>
            Manage registered lawyers and monitor
            account status.
          </p>
        </div>

        <button
          className="alm-refresh"
          type="button"
          disabled={loading}
          onClick={() => {
            setNotice("");
            setRefreshKey((value) => value + 1);
          }}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </header>

      {error && (
        <div className="alm-message alm-error" role="alert">
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      {notice && (
        <div className="alm-message alm-success" role="status">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}

      <section className="alm-stats">
        {[
          {
            label: "Total Lawyers",
            value: lawyers.length,
            icon: UsersRound,
          },
          {
            label: "Active Accounts",
            value: activeCount,
            icon: UserCheck,
          },
          {
            label: "Suspended Accounts",
            value: suspendedCount,
            icon: UserX,
          },
        ].map((stat) => {
          const Icon = stat.icon;

          return (
            <article className="alm-stat" key={stat.label}>
              <div className="alm-stat-icon">
                <Icon size={22} />
              </div>
              <span>{stat.label}</span>
              <strong>
                {loading ? "—" : stat.value}
              </strong>
            </article>
          );
        })}
      </section>

      <section className="alm-table-card">
        <div className="alm-directory-header">
          <div>
            <span className="alm-directory-eyebrow">
              ACCOUNT DIRECTORY
            </span>
            <h2>Registered Lawyers</h2>
          </div>

          <span className="alm-directory-count">
            {filteredLawyers.length} Lawyers
          </span>
        </div>
        <div className="alm-toolbar">
          <div className="alm-search">
            <Search size={19} />
            <input
              type="search"
              placeholder="Search name, email or ID..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
            />
          </div>


          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter lawyer accounts"
          >
            <option value="all">All Accounts</option>
            <option value="active">Active Accounts</option>
            <option value="suspended">Suspended Accounts</option>
          </select>

        </div>

        <div className="alm-table-scroll">

          <table className="alm-table alm-reference-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>LAWYER NAME</th>
                <th>EMAIL</th>
                <th>REGISTERED ON</th>
                <th>ACCOUNT STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {!loading && paginatedLawyers.length > 0 ? (
                paginatedLawyers.map((lawyer) => {
                  const accountStatus = getStatus(lawyer);

                  const displayName = String(
                    lawyer.full_name || "Lawyer"
                  ).replace(/([a-z])([A-Z])/g, "$1 $2");

                  const initials = getInitials(displayName);

                  const subtitle =
                    lawyer.professional_title ||
                    lawyer.law_firm ||
                    "Registered Lawyer";

                  return (
                    <tr key={lawyer.id}>
                      <td className="alm-ref-id">
                        #{lawyer.id}
                      </td>

                      <td>
                        <div className="alm-ref-person">
                          <div
                            className={`alm-ref-avatar ${accountStatus === "active"
                              ? "alm-avatar-active"
                              : accountStatus === "suspended"
                                ? "alm-avatar-suspended"
                                : "alm-avatar-unknown"
                              }`}
                          >
                            {initials}
                          </div>

                          <div className="alm-ref-person-info">
                            <strong>{displayName}</strong>
                            <span>{subtitle}</span>
                          </div>
                        </div>
                      </td>

                      <td className="alm-ref-email">
                        {lawyer.email || "—"}
                      </td>

                      <td className="alm-ref-date">
                        {formatDate(lawyer.created_at)}
                      </td>

                      <td>
                        <span
                          className={`alm-ref-badge ${accountStatus === "active"
                            ? "alm-ref-active"
                            : accountStatus === "suspended"
                              ? "alm-ref-suspended"
                              : "alm-ref-unknown"
                            }`}
                        >
                          <span className="alm-ref-dot" />
                          {accountStatus}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="alm-ref-manage"
                          onClick={() => openLawyer(lawyer)}
                        >
                          <Eye size={14} />
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="alm-empty">
                    {loading
                      ? "Loading lawyers..."
                      : "No matching lawyers found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

        </div>


        <div className="alm-table-footer alm-pagination">

          <span className="alm-pagination-info">
            Showing {startRecord}–{endRecord} of{" "}
            {filteredLawyers.length} lawyers
          </span>

          <div className="alm-pagination-controls">

            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() =>
                setCurrentPage((page) => page - 1)
              }
            >
              Previous
            </button>

            <span className="alm-page-number">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((page) => page + 1)
              }
            >
              Next
            </button>

          </div>

        </div>

      </section>


      {/* =====================================
    PREMIUM LAWYER MANAGEMENT DRAWER
===================================== */}

      {/* NEW PROFESSIONAL MANAGE DRAWER */}

      {selectedLawyer && (
        <div
          className="alx-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeLawyer();
            }
          }}
        >
          <aside
            className="alx-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="alx-heading"
          >
            {/* CLEAN HEADER */}

            <header className="alx-header">
              <div className="alx-header-icon">
                <UsersRound size={19} />
              </div>

              <div className="alx-header-text">
                <h2 id="alx-heading">Account Details</h2>
                <p>Lawyer account management</p>
              </div>

              <button
                type="button"
                className="alx-close"
                aria-label="Close account details"
                disabled={saving}
                onClick={closeLawyer}
              >
                <X size={19} />
              </button>
            </header>

            <div className="alx-scroll">

              {/* LAWYER IDENTITY */}

              <section className="alx-identity">
                <div
                  className={`alx-avatar ${getStatus(selectedLawyer) === "active"
                      ? "active"
                      : getStatus(selectedLawyer) === "suspended"
                        ? "suspended"
                        : "unknown"
                    }`}
                >
                  {getInitials(selectedLawyer.full_name)}
                </div>

                <div className="alx-identity-info">
                  <h3>
                    {selectedLawyer.full_name || "Lawyer"}
                  </h3>

                  <p>
                    {selectedLawyer.email || "Not provided"}
                  </p>

                  <span className="alx-id">
                    Lawyer ID #{selectedLawyer.id}
                  </span>
                </div>

                <span
                  className={`alx-status ${getStatus(selectedLawyer)
                    }`}
                >
                  {getStatus(selectedLawyer)}
                </span>
              </section>

              {/* TABS */}

              <nav className="alx-tabs" aria-label="Lawyer details">
                <button
                  type="button"
                  className={
                    activeTab === "profile" ? "active" : ""
                  }
                  onClick={() => setActiveTab("profile")}
                >
                  <UsersRound size={15} />
                  Profile
                </button>

                <button
                  type="button"
                  className={
                    activeTab === "subscription"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveTab("subscription")
                  }
                >
                  <CreditCard size={15} />
                  Subscription
                </button>
              </nav>

              {/* PROFILE TAB */}

              {activeTab === "profile" ? (
                <section className="alx-section">
                  <div className="alx-section-header">
                    <div>
                      <h3>Professional Profile</h3>
                      <p>
                        Information provided by the lawyer
                      </p>
                    </div>
                  </div>

                  <div className="alx-field-grid">
                    {[
                      {
                        label: "Phone Number",
                        value: selectedLawyer.phone_number,
                      },
                      {
                        label: "City",
                        value: selectedLawyer.city,
                      },
                      {
                        label: "Professional Title",
                        value: selectedLawyer.professional_title,
                      },
                      {
                        label: "Bar Number",
                        value: selectedLawyer.bar_number,
                      },
                      {
                        label: "Law Firm / Chambers",
                        value: selectedLawyer.law_firm,
                        wide: true,
                      },
                      {
                        label: "Registration Date",
                        value: formatDate(
                          selectedLawyer.created_at
                        ),
                        wide: true,
                      },
                    ].map((field) => (
                      <div
                        key={field.label}
                        className={`alx-field ${field.wide ? "alx-field-wide" : ""
                          }`}
                      >
                        <span>{field.label}</span>
                        <strong>
                          {field.value || "Not provided"}
                        </strong>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="alx-section">
                  <div className="alx-section-header">
                    <div>
                      <h3>Subscription Overview</h3>
                      <p>Current subscription information</p>
                    </div>
                  </div>

                  <div className="alx-plan">
                    <div>
                      <span>CURRENT PLAN</span>
                      <h3>
                        {getSubscription(selectedLawyer).name}
                      </h3>
                    </div>

                    <div className="alx-plan-icon">
                      <CreditCard size={21} />
                    </div>
                  </div>

                  <div className="alx-field-grid">
                    {[
                      {
                        label: "Plan Status",
                        value:
                          getSubscription(selectedLawyer).status,
                      },
                      {
                        label: "Start Date",
                        value: formatDate(
                          getSubscription(selectedLawyer).start
                        ),
                      },
                      {
                        label: "Expiry Date",
                        value: formatDate(
                          getSubscription(selectedLawyer).end
                        ),
                        wide: true,
                      },
                    ].map((field) => (
                      <div
                        key={field.label}
                        className={`alx-field ${field.wide ? "alx-field-wide" : ""
                          }`}
                      >
                        <span>{field.label}</span>
                        <strong>{field.value}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ACCOUNT ACCESS */}

              <section className="alx-access-section">
                <div className="alx-section-header">
                  <div>
                    <h3>Account Access</h3>
                    <p>Control lawyer access to AdvocaNote</p>
                  </div>
                </div>

                <div className="alx-access-card">
                  <div className="alx-access-top">
                    <div className="alx-access-symbol">
                      <ShieldCheck size={19} />
                    </div>

                    <div className="alx-access-info">
                      <strong>
                        {selectedLawyer.is_active
                          ? "Account is Active"
                          : "Account is Suspended"}
                      </strong>

                      <p>
                        {selectedLawyer.is_active
                          ? "This lawyer can currently access the platform."
                          : "This lawyer's access is currently restricted."}
                      </p>
                    </div>
                  </div>

                  {selectedLawyer.is_active === true && (
                    <div className="alx-reason">
                      <label htmlFor="alx-reason">
                        Suspension Reason
                      </label>

                      <textarea
                        id="alx-reason"
                        rows={3}
                        value={reason}
                        placeholder="Enter the reason for suspension..."
                        onChange={(event) =>
                          setReason(event.target.value)
                        }
                      />
                    </div>
                  )}

                  {actionError && (
                    <p className="alx-error" role="alert">
                      {actionError}
                    </p>
                  )}

                  <button
                    type="button"
                    className={`alx-action ${selectedLawyer.is_active
                        ? "alx-suspend"
                        : "alx-reactivate"
                      }`}
                    disabled={
                      saving ||
                      typeof selectedLawyer.is_active !==
                      "boolean"
                    }
                    onClick={updateAccountStatus}
                  >
                    {selectedLawyer.is_active ? (
                      <Ban size={16} />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}

                    {saving
                      ? "Updating Account..."
                      : selectedLawyer.is_active
                        ? "Suspend Account"
                        : "Reactivate Account"}
                  </button>
                </div>
              </section>
            </div>

            {/* FOOTER */}

            <footer className="alx-footer">
              <span>
                <ShieldCheck size={14} />
                Admin account controls
              </span>

              <button
                type="button"
                disabled={saving}
                onClick={closeLawyer}
              >
                Done
              </button>
            </footer>
          </aside>
        </div>
      )}


    </main>
  );
}
