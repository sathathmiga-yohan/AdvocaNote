
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  FileText,
  LoaderCircle,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";

import {
  useLawyerLayout,
  LawyerTopbarPortal,
  LawyerTopbarAvatar,
} from "../components/LawyerLayout";

import "./AISuggestions.css";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const getStatus = (value) => {
  const status = String(value || "").toLowerCase();

  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(
    `${String(value).slice(0, 10)}T12:00:00`
  );

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function SuggestionStatus({ status }) {
  return (
    <span className={`ais-status ${status}`}>
      <span className="ais-status-dot" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function AISuggestions() {
  const navigate = useNavigate();

  const { user, openSidebar } = useLawyerLayout();

  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [editedTitle, setEditedTitle] = useState("");

  const [bellOpen, setBellOpen] = useState(false);

  // LOAD SUGGESTIONS

  const loadSuggestions = useCallback(async (signal) => {
    setLoading(true);
    setError("");

    try {
      const token = sessionStorage.getItem(
        "advocanote_access_token"
      );

      if (!token) {
        throw new Error("Please log in again.");
      }

      const response = await fetch(
        `${API_URL}/diary/ai-suggestions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            "AI Suggestions API not found. Check the backend GET endpoint."
          );
        }

        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to load AI suggestions."
        );
      }

      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data.suggestions)
          ? data.suggestions
          : [];

      const items = rows.map((item) => ({
        id: item.id,
        entryId: item.entry_id,
        caseNo: item.case_number || "—",
        date: item.entry_date || "",
        title: item.title || item.suggested_value || "",
        type: item.type || "Task",
        source: item.source || "manual",
        status: getStatus(item.status),
      }));

      if (!signal?.aborted) {
        setSuggestions(items);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Unable to load suggestions.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadSuggestions(controller.signal);

    return () => controller.abort();
  }, [loadSuggestions]);

  // COUNTS

  const counts = useMemo(
    () => ({
      all: suggestions.length,
      pending: suggestions.filter(
        (item) => item.status === "pending"
      ).length,
      approved: suggestions.filter(
        (item) => item.status === "approved"
      ).length,
      rejected: suggestions.filter(
        (item) => item.status === "rejected"
      ).length,
    }),
    [suggestions]
  );

  // SEARCH AND FILTER

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return suggestions.filter((item) => {
      const statusMatches =
        filter === "all" || item.status === filter;

      const searchMatches =
        !query ||
        item.caseNo.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query);

      return statusMatches && searchMatches;
    });
  }, [suggestions, filter, search]);

  const selected =
    filtered.find((item) => item.id === selectedId) ||
    filtered[0] ||
    null;

  useEffect(() => {
    setEditedTitle(selected?.title || "");
  }, [selected?.id, selected?.title]);

  // APPROVE OR REJECT

  const reviewSuggestion = async (status) => {
    if (!selected || selected.status !== "pending" || reviewing) {
      return;
    }

    const title = editedTitle.trim();

    if (status === "Approved" && title.length < 3) {
      setError("Enter a valid task title.");
      return;
    }

    const token = sessionStorage.getItem(
      "advocanote_access_token"
    );

    if (!token) {
      setError("Please log in again.");
      return;
    }

    setReviewing(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/diary/ai-suggestions/${selected.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            title: status === "Approved" ? title : selected.title,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Could not update suggestion."
        );
      }

      setSuggestions((previous) =>
        previous.map((item) =>
          item.id === selected.id
            ? {
              ...item,
              title: data.title || title || item.title,
              status: getStatus(data.status || status),
            }
            : item
        )
      );

      setSuccess(
        status === "Approved"
          ? "Suggestion approved and task created successfully."
          : "Suggestion rejected successfully."
      );
    } catch (err) {
      setError(err.message || "Review failed.");
    } finally {
      setReviewing(false);
    }
  };

  const tabs = [
    { key: "all", label: "All Suggestions" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <>
      {/* SHARED TOPBAR */}

      <LawyerTopbarPortal>
        <div className="ais-topbar">
          <button
            type="button"
            className="ais-mobile-menu"
            onClick={openSidebar}
            aria-label="Open sidebar"
          >
            <Menu size={24} />
          </button>

          <div className="ais-top-search">
            <Search size={22} />

            <input
              type="search"
              placeholder="Search cases, hearings, tasks..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search AI suggestions"
            />
          </div>

          <div className="ais-top-actions">
            <div className="ais-bell-holder">
              <button
                type="button"
                className="ais-bell-button"
                onClick={() => setBellOpen((old) => !old)}
                aria-label="Pending AI reviews"
              >
                <Bell size={24} />

                {counts.pending > 0 && (
                  <span className="ais-bell-dot" />
                )}
              </button>

              {bellOpen && (
                <div className="ais-bell-popover">
                  <strong>AI Reviews</strong>

                  <p>
                    {counts.pending} suggestion
                    {counts.pending === 1 ? "" : "s"} awaiting review.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setFilter("pending");
                      setSelectedId(null);
                      setBellOpen(false);
                    }}
                  >
                    View Pending Suggestions
                  </button>
                </div>
              )}
            </div>

            <span className="ais-top-divider" />

            <button
              type="button"
              className="ais-account-button"
              onClick={() => navigate("/profile")}
            >
              <LawyerTopbarAvatar />

              <span className="ais-account-info">
                <strong>{user?.full_name || "Lawyer"}</strong>
                <small>Attorney-at-Law</small>
              </span>

              <ChevronDown size={17} />
            </button>
          </div>
        </div>
      </LawyerTopbarPortal>

      {/* PAGE */}

      <main className="ais-page">

        {error && (
          <div className="ais-alert ais-alert-error" role="alert">
            <AlertCircle size={17} />
            <span>{error}</span>
            <button type="button" onClick={() => setError("")}>
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div className="ais-alert ais-alert-success" role="status">
            <CheckCircle2 size={17} />
            <span>{success}</span>
            <button type="button" onClick={() => setSuccess("")}>
              <X size={15} />
            </button>
          </div>
        )}

        <div className="ais-layout">

          {/* LEFT CONTENT */}

          <section className="ais-primary">

            {/* HEARINGS STYLE BANNER */}

            <header className="ais-hero">
              <div className="ais-hero-copy">
                <div className="ais-hero-title">
                  <Sparkles size={27} />

                  <div>
                    <h1>AI Suggestions</h1>
                    <p>
                      Review AI-generated tasks from your legal diary.
                    </p>
                  </div>
                </div>
              </div>

              <div className="ais-hero-image" aria-hidden="true" />
            </header>

            {/* FILTER BUTTONS */}

            <div className="ais-filter-bar">
              <div className="ais-filters">
                {tabs.map((tab) => (
                  <button
                    type="button"
                    key={tab.key}
                    className={`ais-filter ${filter === tab.key ? "active" : ""
                      }`}
                    onClick={() => {
                      setFilter(tab.key);
                      setSelectedId(null);
                    }}
                  >
                    {tab.label} ({counts[tab.key]})
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="ais-refresh"
                onClick={() => {
                  setSuccess("");
                  loadSuggestions();
                }}
                disabled={loading || reviewing}
              >
                <RefreshCw size={15} />
                Refresh
              </button>
            </div>

            {/* SUGGESTIONS TABLE */}

            <section className="ais-table-card">
              <div className="ais-table-scroll">
                <table className="ais-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Case No</th>
                      <th>AI Suggestion</th>
                      <th>Diary Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="ais-empty-cell">
                          <LoaderCircle
                            size={22}
                            className="ais-spin"
                          />
                          Loading suggestions...
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="ais-empty-cell">
                          <Sparkles size={25} />
                          <strong>No suggestions found</strong>
                          <span>
                            AI suggestions saved with your diary
                            will appear here.
                          </span>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((item, index) => (
                        <tr
                          key={item.id}
                          className={
                            selected?.id === item.id
                              ? "ais-selected-row"
                              : ""
                          }
                        >
                          <td>{index + 1}</td>

                          <td className="ais-case-cell">
                            {item.caseNo}
                          </td>

                          <td className="ais-title-cell">
                            <span>{item.title}</span>
                            <small>
                              {item.source === "voice"
                                ? "Voice Note"
                                : "Legal Diary"}{" "}
                              · {item.type}
                            </small>
                          </td>

                          <td>
                            <span className="ais-date-cell">
                              <CalendarDays size={15} />
                              {formatDate(item.date)}
                            </span>
                          </td>

                          <td>
                            <SuggestionStatus status={item.status} />
                          </td>

                          <td>
                            <button
                              type="button"
                              className="ais-view-button"
                              onClick={() => {
                                setSelectedId(item.id);
                                setError("");
                              }}
                              aria-label={`View suggestion for ${item.caseNo}`}
                            >
                              <Eye size={19} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          {/* RIGHT SIDEBAR */}

          <aside className="ais-sidebar">

            {/* REVIEW PANEL */}

            <section className="ais-side-card">
              <div className="ais-card-heading">
                <Sparkles size={20} />
                <div>
                  <h2>Review Suggestion</h2>
                  <p>AI-assisted task review</p>
                </div>
              </div>

              {selected ? (
                <>
                  <div className="ais-review-status">
                    <span>Current Status</span>
                    <SuggestionStatus status={selected.status} />
                  </div>

                  <div className="ais-details-grid">
                    <div>
                      <small>Case Number</small>
                      <strong>{selected.caseNo}</strong>
                    </div>

                    <div>
                      <small>Diary Date</small>
                      <strong>{formatDate(selected.date)}</strong>
                    </div>

                    <div>
                      <small>Source</small>
                      <strong>
                        {selected.source === "voice"
                          ? "Voice Note"
                          : "Legal Diary"}
                      </strong>
                    </div>

                    <div>
                      <small>Suggestion Type</small>
                      <strong>{selected.type}</strong>
                    </div>
                  </div>

                  <div className="ais-review-subheading">
                    <FileText size={15} />
                    Suggested Task
                  </div>

                  {selected.status === "pending" ? (
                    <textarea
                      className="ais-task-textarea"
                      value={editedTitle}
                      onChange={(event) =>
                        setEditedTitle(event.target.value)
                      }
                      rows={4}
                      maxLength={500}
                      aria-label="Edit suggested task"
                    />
                  ) : (
                    <div className="ais-task-preview">
                      {selected.title}
                    </div>
                  )}

                  {selected.status === "pending" ? (
                    <div className="ais-review-actions">
                      <button
                        type="button"
                        className="ais-approve"
                        disabled={reviewing}
                        onClick={() =>
                          reviewSuggestion("Approved")
                        }
                      >
                        {reviewing ? (
                          <LoaderCircle
                            size={15}
                            className="ais-spin"
                          />
                        ) : (
                          <Check size={16} />
                        )}
                        Approve
                      </button>

                      <button
                        type="button"
                        className="ais-reject"
                        disabled={reviewing}
                        onClick={() =>
                          reviewSuggestion("Rejected")
                        }
                      >
                        <X size={16} />
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`ais-reviewed ais-reviewed-${selected.status}`}
                    >
                      {selected.status === "approved" ? (
                        <CheckCircle2 size={17} />
                      ) : (
                        <XCircle size={17} />
                      )}

                      {selected.status === "approved"
                        ? "Already Approved"
                        : "Suggestion Rejected"}
                    </div>
                  )}

                  {selected.status === "approved" && (
                    <button
                      type="button"
                      className="ais-detail-link"
                      onClick={() => navigate("/tasks")}
                    >
                      View Tasks & Deadlines
                      <ArrowUpRight size={15} />
                    </button>
                  )}

                  <button
                    type="button"
                    className="ais-detail-link"
                    onClick={() =>
                      navigate(
                        `/my-legal-diary?date=${selected.date}`
                      )
                    }
                  >
                    Open Legal Diary
                    <ArrowUpRight size={15} />
                  </button>
                </>
              ) : (
                <div className="ais-empty-review">
                  <Sparkles size={26} />
                  <strong>No Suggestion Selected</strong>
                  <p>
                    Select a suggestion to view its details.
                  </p>
                </div>
              )}
            </section>

            {/* COMPACT SUMMARY */}

            <section className="ais-side-card">
              <div className="ais-card-heading">
                <CheckCircle2 size={20} />

                <div>
                  <h2>AI Review Summary</h2>
                  <p>Overview of your suggestions</p>
                </div>
              </div>

              <div className="ais-summary-grid">
                <div className="ais-summary-box total">
                  <strong>{counts.all}</strong>
                  <small>Total</small>
                </div>

                <div className="ais-summary-box pending">
                  <strong>{counts.pending}</strong>
                  <small>Pending</small>
                </div>

                <div className="ais-summary-box approved">
                  <strong>{counts.approved}</strong>
                  <small>Approved</small>
                </div>

                <div className="ais-summary-box rejected">
                  <strong>{counts.rejected}</strong>
                  <small>Rejected</small>
                </div>
              </div>
            </section>

            {/* SECURITY NOTE */}

            <section className="ais-side-card ais-security-card">
              <ShieldCheck size={21} />

              <div>
                <strong>You're in Control</strong>
                <p>
                  AI suggestions are optional. Your original
                  diary notes are never overwritten.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
