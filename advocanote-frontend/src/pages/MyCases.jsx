
import {
  useLawyerLayout,
  LawyerTopbarPortal,
  LawyerTopbarAvatar,
} from "../components/LawyerLayout";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";

import {
  useNavigate,
  useLocation,
} from "react-router-dom";
import { createPortal } from "react-dom";

import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  EllipsisVertical,
  Trash2,
  Eye,
  Folder,
  Gavel,
  LogOut,
  Menu,
  Plus,
  Search,
  Scale,
  UserRound,
  X,
} from "lucide-react";

import { logoutUser } from "../services/auth";

import {
  getDiaryOverview,
  getHearings,
  getLawyerCases,
} from "../services/diary";

import "./MyLegalDiary.css";
import "./MyCases.css";
import "./MyCasesActions.css";

import CaseDetails from "./CaseDetails";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const PAGE_SIZE = 6;

const CASE_TYPES = [
  "Civil",
  "Criminal",
  "Family",
  "Land",
  "Labour",
  "Commercial",
  "Fundamental Rights",
  "Writ",
  "Testamentary",
  "Other",
];

const COURT_TYPES = [
  "Supreme Court",
  "Court of Appeal",
  "High Court",
  "Civil Appellate High Court",
  "Commercial High Court",
  "District Court",
  "Magistrate's Court",
  "Primary Court",
  "Labour Tribunal",
  "Other",
];

const COURT_TOWNS = [
  "Colombo",
  "Battaramulla",
  "Kaduwela",
  "Homagama",
  "Mount Lavinia",
  "Gampaha",
  "Negombo",
  "Wattala",
  "Panadura",
  "Kalutara",
  "Avissawella",
  "Kandy",
  "Matale",
  "Dambulla",
  "Nawalapitiya",
  "Nuwara Eliya",
  "Hatton",
  "Galle",
  "Matara",
  "Tangalle",
  "Hambantota",
  "Badulla",
  "Bandarawela",
  "Monaragala",
  "Ratnapura",
  "Balangoda",
  "Kegalle",
  "Kurunegala",
  "Kuliyapitiya",
  "Chilaw",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Trincomalee",
  "Batticaloa",
  "Ampara",
  "Kalmunai",
  "Jaffna",
  "Kilinochchi",
  "Vavuniya",
  "Mannar",
  "Mullaitivu",
  "Other",
];

const today = () => {
  const d = new Date();

  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, "0")}-` +
    `${String(d.getDate()).padStart(2, "0")}`
  );
};

const niceDate = (value) => {
  if (!value) return "—";

  const dt = new Date(
    `${String(value).slice(0, 10)}T12:00:00`
  );

  return Number.isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
};

const clean = (v) => String(v ?? "").trim();

const statusOf = (c) =>
  clean(c.status || c.case_status) || "Not set";

const caseTypeOf = (c) =>
  clean(c.case_type) || "Not set";

const courtOf = (c) =>
  clean(c.court_name || c.court?.court_name) || "—";

const locationOf = (c) =>
  clean(c.location || c.court?.location) || "—";

const numberOf = (c) =>
  clean(c.case_number || c.caseNo);

const titleOf = (c) =>
  clean(c.case_title || c.caseTitle) || "Untitled Case";

// Display only: do not change unknown database values.

const caseTypeLabel = (c) =>
  caseTypeOf(c) === "Not set" ? "—" : caseTypeOf(c);

const statusLabel = (c) =>
  statusOf(c) === "Not set" ? "—" : statusOf(c);

async function authorizedRequest(path, options = {}) {
  const token = localStorage.getItem(
    "advocanote_access_token"
  );

  const result = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
      ...options.headers,
    },
  });

  const data = await result.json().catch(() => null);

  if (!result.ok) {
    const error = data?.detail;

    throw new Error(
      typeof error === "string"
        ? error
        : `Request failed (${result.status}). Check the FastAPI case endpoint.`
    );
  }

  return data;
}

const newCaseDraft = () => ({
  case_number: "",
  case_title: "",
  case_type: "",
  other_case_type: "",
  case_stage: "",
  status: "Active",
  court_type: "",
  other_court_type: "",
  court_name: "",
  location: "",
  other_location: "",
});

function Choice({
  label,
  value,
  options,
  onChange,
  otherValue,
  onOtherChange,
  otherHint,
}) {
  return (
    <label className="mc-field">
      <span>{label}</span>

      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);

          if (onOtherChange) {
            onOtherChange("");
          }
        }}
      >
        <option value="">Select {label}</option>

        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      {value === "Other" && (
        <input
          value={otherValue}
          onChange={(e) =>
            onOtherChange(e.target.value)
          }
          placeholder={
            otherHint ||
            `Enter ${label.toLowerCase()}...`
          }
          aria-label={`Specify other ${label.toLowerCase()}`}
        />
      )}
    </label>
  );
}

export default function MyCases({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);

  const { user, openSidebar } = useLawyerLayout();

  const [cases, setCases] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [courtFilter, setCourtFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);

  // Selected case and diary history

  const [selectedCase, setSelectedCase] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  // Add New Case

  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState(newCaseDraft);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Selected case actions

  const [caseMenu, setCaseMenu] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingCase, setDeletingCase] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Search shortcut

  useEffect(() => {
    const focusSearch = (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", focusSearch);

    return () =>
      window.removeEventListener("keydown", focusSearch);
  }, []);

  // Load existing cases, hearings and notifications

  useEffect(() => {
    if (!user) return;

    let active = true;

    setLoading(true);
    setLoadError("");

    Promise.allSettled([
      getLawyerCases(),
      getHearings(),
      getDiaryOverview(today()),
    ])
      .then(([c, h, d]) => {
        if (!active) return;

        if (c.status === "fulfilled") {
          const raw = c.value;

          setCases(
            Array.isArray(raw)
              ? raw
              : Array.isArray(raw?.cases)
                ? raw.cases
                : []
          );
        } else {
          setLoadError(
            c.reason?.message ||
            "Could not load your cases."
          );
        }

        if (h.status === "fulfilled") {
          setHearings(
            Array.isArray(h.value) ? h.value : []
          );
        }

        if (d.status === "fulfilled") {
          setNotifications(
            d.value?.notifications || []
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, refresh]);

  // Upcoming hearing dates

  const upcomingByCase = useMemo(() => {
    const map = new Map();

    hearings.forEach((h) => {
      const date = clean(h.hearing_date).slice(0, 10);

      if (
        !date ||
        date < today() ||
        clean(h.status).toLowerCase() !== "scheduled"
      ) {
        return;
      }

      const key = clean(
        h.case_id || h.case_number
      ).toLowerCase();

      if (!key) return;

      if (!map.has(key) || date < map.get(key)) {
        map.set(key, date);
      }
    });

    return map;
  }, [hearings]);

  const hearingDate = (c) =>
    upcomingByCase.get(clean(c.id).toLowerCase()) ||
    upcomingByCase.get(numberOf(c).toLowerCase()) ||
    "";

  const courts = useMemo(
    () =>
      [
        ...new Set(
          cases.map(courtOf).filter((x) => x !== "—")
        ),
      ].sort(),
    [cases]
  );

  const types = useMemo(
    () =>
      [
        ...new Set(
          cases
            .map(caseTypeOf)
            .filter((x) => x !== "Not set")
        ),
      ].sort(),
    [cases]
  );

  const activeCases = cases.filter(
    (c) => statusOf(c).toLowerCase() === "active"
  ).length;

  const closedCases = cases.filter(
    (c) => statusOf(c).toLowerCase() === "closed"
  ).length;

  const hearingCases = cases.filter(
    (c) => Boolean(hearingDate(c))
  ).length;

  // Case filtering and sorting

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const items = cases.filter((c) => {
      const matchQuery =
        !q ||
        [
          numberOf(c),
          titleOf(c),
          courtOf(c),
          locationOf(c),
          caseTypeOf(c),
          clean(c.party_names),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchCourt =
        !courtFilter || courtOf(c) === courtFilter;

      const matchType =
        !typeFilter || caseTypeOf(c) === typeFilter;

      const matchStatus =
        !statusFilter ||
        (statusFilter === "Hearing"
          ? Boolean(hearingDate(c))
          : statusOf(c).toLowerCase() ===
          statusFilter.toLowerCase());

      return (
        matchQuery &&
        matchCourt &&
        matchType &&
        matchStatus
      );
    });

    items.sort((a, b) => {
      if (sort === "case") {
        return numberOf(a).localeCompare(numberOf(b));
      }

      if (sort === "hearing") {
        return (hearingDate(a) || "9999").localeCompare(
          hearingDate(b) || "9999"
        );
      }

      return (
        clean(b.created_at).localeCompare(
          clean(a.created_at)
        ) ||
        Number(b.id || 0) - Number(a.id || 0)
      );
    });

    return items;
  }, [
    cases,
    query,
    courtFilter,
    typeFilter,
    statusFilter,
    sort,
    upcomingByCase,
  ]);

  // Pagination

  const pages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE)
  );

  const shownPage = Math.min(page, pages);

  const rows = filtered.slice(
    (shownPage - 1) * PAGE_SIZE,
    shownPage * PAGE_SIZE
  );

  const patchDraft = (name, value) =>
    setDraft((current) => ({
      ...current,
      [name]: value,
    }));

  // Lawyer details

  const fullName = user?.full_name || "Lawyer";

  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const logout = async () => {
    try {
      if (onLogout) {
        await onLogout();
      } else {
        await logoutUser();
      }
    } catch (e) {
      console.error("Logout error", e);
    } finally {
      localStorage.removeItem(
        "advocanote_access_token"
      );

      localStorage.removeItem(
        "advocanote_refresh_token"
      );

      navigate("/login", { replace: true });
    }
  };


const openCase = useCallback(async (c) => {
  if (!c?.id) {
    setHistoryError("Case ID is missing.");
    return;
  }

  setSelectedCase(c);
  setHistory([]);
  setHistoryLoading(true);
  setHistoryError("");

  try {
    const raw = await authorizedRequest(
      `/diary/case/${encodeURIComponent(c.id)}/history`
    );

    const entries = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.entries)
        ? raw.entries
        : Array.isArray(raw?.history)
          ? raw.history
          : [];

    setHistory(entries);
  } catch (error) {
    setHistoryError(
      error.message || "Could not load diary history."
    );
  } finally {
    setHistoryLoading(false);
  }
}, []);



  useEffect(() => {
    const target = location.state;

    if (
      !target ||
      (target.calendarCaseId == null &&
        !target.calendarCaseNo) ||
      loading
    ) {
      return;
    }

    const targetId = String(
      target.calendarCaseId ?? ""
    ).trim();

    const targetNumber = String(
      target.calendarCaseNo ?? ""
    ).trim().toLowerCase();

    const matchingCase = cases.find((item) => {
      const sameId =
        targetId !== "" &&
        String(item.id) === targetId;

      const sameNumber =
        targetNumber !== "" &&
        String(
          item.case_number || item.caseNo || ""
        ).trim().toLowerCase() === targetNumber;

      return sameId || sameNumber;
    });

    if (matchingCase) {
      openCase(
        matchingCase,
        target.calendarEventDate || ""
      );
    } else {
      setLoadError(
        "The selected calendar case was not found."
      );
    }

    // Clear the navigation request after opening.
    navigate(location.pathname, {
      replace: true,
      state: null,
    });
  }, [
    cases,
    loading,
    location.state,
    location.pathname,
    navigate,
    openCase,
  ]);


  const handleCloseCase = async (caseData) => {
    const result = await authorizedRequest(
      `/cases/${encodeURIComponent(caseData.id)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "Closed",
        }),
      }
    );

    const updatedStatus = result.status;

    setSelectedCase((previous) =>
      previous?.id === caseData.id
        ? { ...previous, status: updatedStatus }
        : previous
    );

    setCases((previous) =>
      previous.map((item) =>
        item.id === caseData.id
          ? { ...item, status: updatedStatus }
          : item
      )
    );
  };

  // EDIT DIARY ENTRY

  const handleEditDiaryEntry = async (entry, changes) => {
    if (!entry?.id) {
      throw new Error("Diary entry ID is missing.");
    }

    // Save changes in backend
    const result = await authorizedRequest(
      `/diary/entries/${encodeURIComponent(entry.id)}`,
      {
        method: "PUT",
        body: JSON.stringify(changes),
      }
    );

    // Update the edited entry immediately
    if (result?.entry) {
      setHistory((previous) =>
        previous.map((item) =>
          String(item.id) === String(entry.id)
            ? result.entry
            : item
        )
      );
    }

    // Reload diary history and hearings from backend
    const [historyResult, hearingsResult] =
      await Promise.allSettled([
        authorizedRequest(
          `/diary/case/${encodeURIComponent(selectedCase.id)}/history`
        ),
        getHearings(),
      ]);

    if (historyResult.status === "fulfilled") {
      const raw = historyResult.value;

      const updatedHistory = Array.isArray(raw)
        ? raw
        : raw?.entries || raw?.history || [];

      setHistory(
        Array.isArray(updatedHistory) ? updatedHistory : []
      );
    }

    if (
      hearingsResult.status === "fulfilled" &&
      Array.isArray(hearingsResult.value)
    ) {
      setHearings(hearingsResult.value);
    }

    // Refresh cases and notifications too
    setRefresh((n) => n + 1);

    return result;
  };


  // DELETE DIARY ENTRY

  const handleDeleteDiaryEntry = async (entry) => {
    if (!entry?.id) {
      window.alert("Diary entry ID is missing.");
      return;
    }

    try {
      await authorizedRequest(
        `/diary/entries/${encodeURIComponent(entry.id)}`,
        {
          method: "DELETE",
        }
      );

      setHistory((previous) =>
        previous.filter(
          (item) => String(item.id) !== String(entry.id)
        )
      );

      setRefresh((n) => n + 1);
    } catch (error) {
      window.alert(
        error.message || "Could not delete diary entry."
      );
    }
  };

  // Three-dot menu position

  const openCaseActions = (event, c) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 224;
    const menuHeight = 112;

    const left = Math.max(
      8,
      Math.min(
        rect.right - menuWidth,
        window.innerWidth - menuWidth - 8
      )
    );

    const top =
      rect.bottom + menuHeight + 8 <= window.innerHeight
        ? rect.bottom + 6
        : Math.max(8, rect.top - menuHeight - 6);

    setCaseMenu((current) =>
      current?.caseData?.id === c.id
        ? null
        : { caseData: c, left, top }
    );
  };

  // Existing diary page with selected case

  const addDiaryForCase = (c) => {
    setCaseMenu(null);

    navigate(
      `/add-diary-entry?caseId=${encodeURIComponent(c.id)}`
    );
  };

  const confirmDeleteCase = (c) => {
    setCaseMenu(null);
    setDeleteTarget(c);
    setDeleteError("");
  };

  // Delete empty case only

  const handleDeleteCase = async () => {
    if (!deleteTarget || deletingCase) return;

    setDeletingCase(true);
    setDeleteError("");

    try {
      await authorizedRequest(
        `/cases/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" }
      );

      setCases((old) =>
        old.filter((c) => c.id !== deleteTarget.id)
      );

      setDeleteTarget(null);
      setRefresh((current) => current + 1);
    } catch (e) {
      setDeleteError(
        e.message || "Could not delete this case."
      );
    } finally {
      setDeletingCase(false);
    }
  };

  useEffect(() => {
    if (!caseMenu) return;

    const onOutside = (event) => {
      if (
        !event.target.closest(".mc-row-action-menu") &&
        !event.target.closest(".mc-row-more-button")
      ) {
        setCaseMenu(null);
      }
    };

    const onEscape = (event) => {
      if (event.key === "Escape") {
        setCaseMenu(null);
      }
    };

    const onScroll = () => setCaseMenu(null);

    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [caseMenu]);

  // Add New Case

  const saveCase = async (event) => {
    event.preventDefault();

    const caseType =
      draft.case_type === "Other"
        ? draft.other_case_type.trim()
        : draft.case_type;

    const courtType =
      draft.court_type === "Other"
        ? draft.other_court_type.trim()
        : draft.court_type;

    const courtLocation =
      draft.location === "Other"
        ? draft.other_location.trim()
        : draft.location;

    if (
      !draft.case_number.trim() ||
      !caseType ||
      !courtType ||
      !draft.court_name.trim() ||
      !courtLocation
    ) {
      setFormError(
        "Case No, Case Type, Court Type, Court Name and Location are required."
      );
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      await authorizedRequest("/cases", {
        method: "POST",
        body: JSON.stringify({
          case_number: draft.case_number.trim(),
          case_title:
            draft.case_title.trim() || "Untitled Case",
          case_type: caseType,
          case_stage: draft.case_stage.trim() || null,
          status: draft.status,
          court_type: courtType,
          court_name: draft.court_name.trim(),
          location: courtLocation,
        }),
      });

      setShowCreate(false);
      setDraft(newCaseDraft());
      setRefresh((n) => n + 1);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* COMMON TOPBAR */}

      <LawyerTopbarPortal>
        <button
          type="button"
          className="ald-mobile-menu"
          aria-label="Open sidebar"
          onClick={openSidebar}
        >
          <Menu size={24} />
        </button>

        <div className="ald-global-search">
          <Search size={23} />

          <input
            ref={searchRef}
            aria-label="Search cases"
            placeholder="Search cases, court names, parties, notes..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="ald-topbar-actions">
          <div className="ald-dropdown-holder">
            <button
              type="button"
              className="ald-notify"
              aria-label="Notifications"
              aria-expanded={bellOpen}
              onClick={() => {
                setBellOpen((v) => !v);
                setProfileOpen(false);
              }}
            >
              <Bell size={26} />
            </button>

            {bellOpen && (
              <div className="ald-top-popover ald-notifications-popover">
                <strong>Notifications</strong>

                {notifications.length ? (
                  notifications.map((n) => (
                    <div key={n.id}>
                      <strong>{n.title}</strong>
                      <p>{niceDate(n.date)}</p>
                    </div>
                  ))
                ) : (
                  <p>No notifications for today.</p>
                )}
              </div>
            )}
          </div>

          <div className="ald-topbar-divider" />

          <div className="ald-dropdown-holder">
            <button
              type="button"
              className="ald-account"
              aria-expanded={profileOpen}
              onClick={() => {
                setProfileOpen((v) => !v);
                setBellOpen(false);
              }}
            >
              <LawyerTopbarAvatar />
              <span className="ald-account-text">
                <strong>{fullName}</strong>
                <small>Attorney-at-Law</small>
              </span>

              <ChevronDown size={18} />
            </button>

            {profileOpen && (
              <div className="ald-top-popover ald-account-popover">
                <button
                  type="button"
                  onClick={() => navigate("/profile")}
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
      </LawyerTopbarPortal>

      {/* MY CASES OR CASE DETAILS */}

      {!selectedCase ? (
        <main className="ald-main mc-main">
          <div className="mc-layout">
            <div className="mc-primary">
              {/* TITLE */}

              {/* MY CASES HEADER */}

              <div className="mc-title-row">

                <div className="mc-heading-text">
                  <h1>My Cases</h1>
                  <p>Manage all your legal cases in one place.</p>
                </div>

                <div className="mc-title-actions">
                  <button
                    type="button"
                    className="mc-primary-btn"
                    onClick={() => {
                      setDraft(newCaseDraft());
                      setFormError("");
                      setShowCreate(true);
                    }}
                  >
                    <Plus size={17} />
                    Add New Case
                  </button>
                </div>

              </div>


              {/* STATISTICS */}

              <div className="mc-stats">
                <div className="mc-stat mc-stat-green">
                  <span>
                    <Folder size={29} />
                  </span>

                  <div>
                    <strong>
                      {loading ? "—" : cases.length}
                    </strong>
                    <small>Total Cases</small>
                  </div>
                </div>

                <div className="mc-stat mc-stat-mint">
                  <span>
                    <Scale size={29} />
                  </span>

                  <div>
                    <strong>
                      {loading ? "—" : activeCases}
                    </strong>
                    <small>Active Cases</small>
                  </div>
                </div>

                <div className="mc-stat mc-stat-gold">
                  <span>
                    <Clock3 size={29} />
                  </span>

                  <div>
                    <strong>
                      {loading ? "—" : hearingCases}
                    </strong>
                    <small>
                      Cases with Upcoming Hearings
                    </small>
                  </div>
                </div>

                <div className="mc-stat mc-stat-red">
                  <span>
                    <Gavel size={29} />
                  </span>

                  <div>
                    <strong>
                      {loading ? "—" : closedCases}
                    </strong>
                    <small>Closed Cases</small>
                  </div>
                </div>
              </div>

              {/* FILTERS */}

              <div className="mc-toolbar">
                <div className="mc-toolbar-search">
                  <Search size={19} />

                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search cases by no., party, court..."
                    aria-label="Filter cases"
                  />
                </div>

                <select
                  aria-label="Court filter"
                  value={courtFilter}
                  onChange={(e) => {
                    setCourtFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Courts</option>

                  {courts.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Case type filter"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Case Types</option>

                  {types.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Status filter"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Status</option>
                  <option>Active</option>
                  <option>Pending</option>
                  <option>Closed</option>
                  <option>Not set</option>
                </select>

                <select
                  aria-label="Sort cases"
                  value={sort}
                  onChange={(e) =>
                    setSort(e.target.value)
                  }
                >
                  <option value="recent">Newest</option>
                  <option value="case">Case No A–Z</option>
                  <option value="hearing">Next Hearing</option>
                </select>
              </div>

              {/* MY CASES TABLE */}

              <section
                className="mc-table-card"
                aria-label="My cases list"
              >
                {loadError && (
                  <p role="alert" className="mc-alert">
                    {loadError}
                  </p>
                )}

                <div className="mc-table-scroll">
                  <table className="mc-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Case No</th>
                        <th>Case Title / Parties</th>
                        <th>Court</th>
                        <th>Case Type</th>
                        <th>Next Hearing</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((c, i) => (
                        <tr key={c.id || numberOf(c)}>
                          <td>
                            {(shownPage - 1) *
                              PAGE_SIZE +
                              i +
                              1}
                          </td>

                          <td className="mc-case-no">
                            {numberOf(c)}
                          </td>

                          <td>
                            <strong>
                              {titleOf(c)}
                            </strong>

                            {c.party_names && (
                              <small>
                                {c.party_names}
                              </small>
                            )}
                          </td>

                          <td>
                            {courtOf(c)}
                            <small>
                              {locationOf(c)}
                            </small>
                          </td>

                          <td>
                            {caseTypeLabel(c)}
                          </td>

                          <td>
                            <span
                              className={
                                hearingDate(c)
                                  ? "mc-date"
                                  : "mc-dash"
                              }
                            >
                              {niceDate(
                                hearingDate(c)
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`mc-status mc-${statusOf(c)
                                .toLowerCase()
                                .replace(/\s+/g, "-")}`}
                            >
                              {statusLabel(c)}
                            </span>
                          </td>

                          {/* ACTION BUTTONS */}

                          <td>
                            <div className="mc-actions">
                              <button
                                type="button"
                                aria-label={`View ${numberOf(c)}`}
                                title="Case details"
                                onClick={() =>
                                  openCase(c)
                                }
                              >
                                <Eye size={19} />
                              </button>

                              <button
                                type="button"
                                className="mc-row-more-button"
                                aria-label={`More actions for ${numberOf(c)}`}
                                aria-haspopup="menu"
                                aria-expanded={
                                  caseMenu?.caseData?.id === c.id
                                }
                                title="More case actions"
                                onClick={(event) =>
                                  openCaseActions(event, c)
                                }
                              >
                                <EllipsisVertical size={19} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {!rows.length && (
                        <tr>
                          <td
                            colSpan={8}
                            className="mc-empty"
                          >
                            {loading
                              ? "Loading your cases..."
                              : "No cases found. Create a case or clear the filters."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION */}

                <footer className="mc-table-footer">
                  <span>
                    Showing{" "}
                    {filtered.length
                      ? (shownPage - 1) * PAGE_SIZE + 1
                      : 0}
                    {" – "}
                    {Math.min(
                      shownPage * PAGE_SIZE,
                      filtered.length
                    )}
                    {" of "}
                    {filtered.length} cases
                  </span>

                  <div className="mc-pages">
                    <button
                      type="button"
                      disabled={shownPage <= 1}
                      onClick={() =>
                        setPage((p) =>
                          Math.max(1, p - 1)
                        )
                      }
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={17} />
                    </button>

                    <span>
                      {shownPage} / {pages}
                    </span>

                    <button
                      type="button"
                      disabled={shownPage >= pages}
                      onClick={() =>
                        setPage((p) =>
                          Math.min(pages, p + 1)
                        )
                      }
                      aria-label="Next page"
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </footer>
              </section>
            </div>
          </div>
        </main>
      ) : (
        <CaseDetails
          caseData={selectedCase}
          history={history}
          historyLoading={historyLoading}
          historyError={historyError}
          hearings={hearings}
          nextHearing={hearingDate(selectedCase)}
          onBack={() => {
            setSelectedCase(null);
          }}
          onAddDiary={() => addDiaryForCase(selectedCase)}
          onEditEntry={handleEditDiaryEntry}
          onDeleteEntry={handleDeleteDiaryEntry}
          onCloseCase={handleCloseCase}
          onHearingsChanged={setHearings}
        />
      )}

      {/* THREE DOT CASE ACTIONS */}

      {caseMenu &&
        createPortal(
          <div
            role="menu"
            aria-label={`Actions for case ${numberOf(
              caseMenu.caseData
            )}`}
            className="mc-row-action-menu"
            style={{
              top: caseMenu.top,
              left: caseMenu.left,
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                addDiaryForCase(caseMenu.caseData)
              }
            >
              <Plus size={16} />
              Add New Diary Entry
            </button>

            <button
              type="button"
              role="menuitem"
              className="mc-row-action-danger"
              onClick={() =>
                confirmDeleteCase(caseMenu.caseData)
              }
            >
              <Trash2 size={16} />
              Delete Case
            </button>
          </div>,
          document.body
        )}

      {/* DELETE CASE CONFIRMATION */}

      {deleteTarget && (
        <div
          className="mc-case-delete-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !deletingCase
            ) {
              setDeleteTarget(null);
            }
          }}
        >
          <section
            className="mc-case-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mc-delete-case-title"
          >
            <div className="mc-case-delete-heading">
              <h2 id="mc-delete-case-title">
                Delete Case?
              </h2>

              <button
                type="button"
                aria-label="Close"
                disabled={deletingCase}
                onClick={() => setDeleteTarget(null)}
              >
                <X size={18} />
              </button>
            </div>

            <p>
              Delete case{" "}
              <strong>{numberOf(deleteTarget)}</strong>?
            </p>

            <p className="mc-case-delete-note">
              For legal record safety, a case with diary
              history, hearings or tasks cannot be
              permanently deleted.
            </p>

            {deleteError && (
              <p
                className="mc-case-delete-error"
                role="alert"
              >
                {deleteError}
              </p>
            )}

            <div className="mc-case-delete-buttons">
              <button
                type="button"
                className="mc-case-delete-cancel"
                disabled={deletingCase}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="mc-case-delete-confirm"
                disabled={deletingCase}
                onClick={handleDeleteCase}
              >
                {deletingCase ? "Deleting..." : "Delete Case"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ADD NEW CASE POPUP */}

      {showCreate && (
        <div
          className="mc-backdrop"
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !saving
            ) {
              setShowCreate(false);
            }
          }}
        >
          <section
            className="mc-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Add New Case"
          >
            <header>
              <div>
                <small>My Cases</small>
                <h2>Add New Case</h2>
              </div>

              <button
                type="button"
                onClick={() => setShowCreate(false)}
                disabled={saving}
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </header>

            <form
              onSubmit={saveCase}
              className="mc-create-form"
            >
              <div className="mc-form-grid">
                <label className="mc-field">
                  <span>Case Number *</span>

                  <input
                    required
                    value={draft.case_number}
                    onChange={(e) =>
                      patchDraft(
                        "case_number",
                        e.target.value
                      )
                    }
                    placeholder="e.g., DC/45/2026"
                  />
                </label>

                <label className="mc-field">
                  <span>Case Title (Optional)</span>

                  <input
                    value={draft.case_title}
                    onChange={(e) =>
                      patchDraft(
                        "case_title",
                        e.target.value
                      )
                    }
                    placeholder="e.g., Perera v. Silva"
                  />
                </label>

                <Choice
                  label="Case Type"
                  value={draft.case_type}
                  options={CASE_TYPES}
                  onChange={(v) =>
                    patchDraft("case_type", v)
                  }
                  otherValue={draft.other_case_type}
                  onOtherChange={(v) =>
                    patchDraft("other_case_type", v)
                  }
                />

                <label className="mc-field">
                  <span>Case Stage</span>

                  <input
                    value={draft.case_stage}
                    onChange={(e) =>
                      patchDraft(
                        "case_stage",
                        e.target.value
                      )
                    }
                    placeholder="e.g., Trial"
                  />
                </label>

                <label className="mc-field">
                  <span>Status</span>

                  <select
                    value={draft.status}
                    onChange={(e) =>
                      patchDraft("status", e.target.value)
                    }
                  >
                    <option>Active</option>
                    <option>Pending</option>
                    <option>Closed</option>
                  </select>
                </label>

                <Choice
                  label="Court Type"
                  value={draft.court_type}
                  options={COURT_TYPES}
                  onChange={(v) =>
                    patchDraft("court_type", v)
                  }
                  otherValue={draft.other_court_type}
                  onOtherChange={(v) =>
                    patchDraft("other_court_type", v)
                  }
                />

                <label className="mc-field">
                  <span>Court Name *</span>

                  <input
                    required
                    value={draft.court_name}
                    onChange={(e) =>
                      patchDraft(
                        "court_name",
                        e.target.value
                      )
                    }
                    placeholder="e.g., District Court"
                  />
                </label>

                <Choice
                  label="Location"
                  value={draft.location}
                  options={COURT_TOWNS}
                  onChange={(v) =>
                    patchDraft("location", v)
                  }
                  otherValue={draft.other_location}
                  onOtherChange={(v) =>
                    patchDraft("other_location", v)
                  }
                />
              </div>

              {formError && (
                <p className="mc-alert" role="alert">
                  {formError}
                </p>
              )}

              <p className="mc-helper">
                Saved case details must be linked to the
                logged-in lawyer and a Court record by
                FastAPI. This form does not create an empty
                diary entry.
              </p>

              <footer>
                <button
                  className="mc-outline"
                  type="button"
                  onClick={() => setShowCreate(false)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  className="mc-primary-btn"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Case"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
