
import {
  useLawyerLayout,
  LawyerTopbarPortal,
  LawyerTopbarAvatar,
} from "../components/LawyerLayout";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gavel,
  Menu,
  Mic,
  Plus,
  Search,
  Sparkles,
  Square,
} from "lucide-react";

import { logoutUser } from "../services/auth";

import {
  createDiaryEntry,
  getDiaryOverview,
  getLawyerCases,
} from "../services/diary";

import "./MyLegalDiary.css";
import "./AddDiaryEntry.css";

import SriLankaCourtFields from "./SriLankaCourtFields";

const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fromISO = (d) => new Date(`${d}T12:00:00`);

const goodISO = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s || "") &&
  !Number.isNaN(fromISO(s).getTime());

const emptyDraft = () => ({
  case_number: "",
  case_title: "",
  case_type: "",
  other_case_type: "",
  court_name: "",
  location: "",
  previous_date: "",
  step_notes: "",
  next_date: "",
  input_method: "manual",
  next_hearing_purpose: "",
});

const toPoints = (text) =>
  text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => `• ${x}`)
    .join("\n");

const actionSentence = (text) =>
  text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .find((x) =>
      /\b(file|submit|prepare|draft|serve|send|produce|review|obtain|collect)\b/i.test(x)
    ) || "";

function MonthCalendar({ date, onPick }) {
  const selected = fromISO(date);

  const [viewMonth, setViewMonth] = useState(
    () =>
      new Date(
        selected.getFullYear(),
        selected.getMonth(),
        1
      )
  );

  useEffect(() => {
    setViewMonth(
      new Date(
        selected.getFullYear(),
        selected.getMonth(),
        1
      )
    );
  }, [date]);

  const first = (viewMonth.getDay() + 6) % 7;

  const count = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0
  ).getDate();

  const cells = [
    ...Array(first).fill(null),
    ...Array.from({ length: count }, (_, i) => i + 1),
  ];

  return (
    <section
      className="ade2-panel ade2-calendar"
      aria-label="Select diary date"
    >
      <div className="ade2-calendar-top">
        <button
          type="button"
          onClick={() =>
            setViewMonth(
              new Date(
                viewMonth.getFullYear(),
                viewMonth.getMonth() - 1,
                1
              )
            )
          }
          aria-label="Previous month"
        >
          <ChevronLeft size={17} />
        </button>

        <strong>
          {viewMonth
            .toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })
            .toUpperCase()}
        </strong>

        <button
          type="button"
          onClick={() =>
            setViewMonth(
              new Date(
                viewMonth.getFullYear(),
                viewMonth.getMonth() + 1,
                1
              )
            )
          }
          aria-label="Next month"
        >
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="ade2-calendar-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map(
          (s, i) => (
            <span className="ade2-weekday" key={i}>
              {s}
            </span>
          )
        )}

        {cells.map((day, i) => {
          if (!day) {
            return <span key={`empty-${i}`} />;
          }

          const iso = toISO(
            new Date(
              viewMonth.getFullYear(),
              viewMonth.getMonth(),
              day
            )
          );

          return (
            <button
              key={iso}
              type="button"
              className={
                iso === date ? "ade2-day-active" : ""
              }
              onClick={() => onPick(iso)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function AddDiaryEntry() {
  const navigate = useNavigate();
  const location = useLocation();

  const urlParams = new URLSearchParams(location.search);
  const urlDate = urlParams.get("date");
  const selectedCaseId = urlParams.get("caseId");

  const [entryDate, setEntryDate] = useState(
    goodISO(urlDate) ? urlDate : toISO(new Date())
  );

  const { user, openSidebar } = useLawyerLayout();

  const [cases, setCases] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dateCount, setDateCount] = useState(0);

  const [globalQuery, setGlobalQuery] = useState("");
  const [draft, setDraft] = useState(emptyDraft);

  const [pickedCase, setPickedCase] = useState(null);
  const [newCase, setNewCase] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);

  const [listLoading, setListLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [bellOpen, setBellOpen] = useState(false);

  // Voice recording state
  const [recording, setRecording] = useState(false);

  // Tamil selected by default
  const [language, setLanguage] = useState("ta-IN");

  const [showPoints, setShowPoints] = useState(true);

  const [taskStatus, setTaskStatus] = useState("pending");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [editTask, setEditTask] = useState(false);
  const [manualTask, setManualTask] = useState(false);

  const [success, setSuccess] = useState(null);

  const speechRef = useRef(null);
  const caseBoxRef = useRef(null);

  // Voice session management
  const keepListeningRef = useRef(false);
  const voiceRetryTimerRef = useRef(null);
  const voiceRetryCountRef = useRef(0);
  const voiceSessionRef = useRef(0);

  const stopVoice = (discardPending = false) => {
    keepListeningRef.current = false;

    if (voiceRetryTimerRef.current !== null) {
      clearTimeout(voiceRetryTimerRef.current);
      voiceRetryTimerRef.current = null;
    }

    if (discardPending) {
      voiceSessionRef.current += 1;
    }

    try {
      speechRef.current?.stop();
    } catch {
      // Recognition may already be stopped.
    }

    if (discardPending) {
      setRecording(false);
    }
  };

  const setField = (field, value) =>
    setDraft((old) => ({
      ...old,
      [field]: value,
    }));

  const rawSuggestedTask = useMemo(
    () => actionSentence(draft.step_notes),
    [draft.step_notes]
  );

  const suggestedTitle = manualTask
    ? taskTitle
    : taskTitle || rawSuggestedTask;

  const filteredCases = cases
    .filter((c) => {
      const name = `${c.case_number || ""} ${c.case_title || ""
        } ${c.court_name || ""} ${c.location || ""
        }`.toLowerCase();

      return (
        (c.case_number || "")
          .toLowerCase()
          .includes(draft.case_number.toLowerCase()) &&
        name.includes(globalQuery.toLowerCase())
      );
    })
    .slice(0, 8);

  const fullName = user?.full_name || "Lawyer";

  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

  // Load cases and diary overview
  useEffect(() => {
    if (!user) return;

    let active = true;
    setListLoading(true);

    Promise.all([
      getLawyerCases(),
      getDiaryOverview(entryDate),
    ])
      .then(([myCases, overview]) => {
        if (!active) return;

        const loadedCases = Array.isArray(myCases)
          ? myCases
          : myCases?.cases || [];

        setCases(loadedCases);
        setNotifications(overview.notifications || []);
        setDateCount((overview.entries || []).length);

        if (selectedCaseId) {
          const match = loadedCases.find(
            (c) =>
              String(c.id) === String(selectedCaseId)
          );

          if (!match) {
            setPickedCase(null);
            setError(
              "Selected case was not found. Return to My Cases."
            );
            return;
          }

          setPickedCase(match);
          setNewCase(false);
          setCaseOpen(false);

          setDraft((old) => ({
            ...old,
            case_number: match.case_number || "",
            case_title: match.case_title || "",
            case_type: match.case_type || "",
            court_name: match.court_name || "",
            location: match.location || "",
          }));
        }

        setError("");
      })
      .catch((e) => {
        if (active) {
          setError(
            e.message || "Could not load lawyer cases."
          );
        }
      })
      .finally(() => {
        if (active) setListLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, entryDate, selectedCaseId]);

  // Cleanup microphone on page exit
  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
      voiceSessionRef.current += 1;

      if (voiceRetryTimerRef.current !== null) {
        clearTimeout(voiceRetryTimerRef.current);
      }

      try {
        speechRef.current?.abort();
      } catch {
        // No active microphone.
      }
    };
  }, []);

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (
        caseBoxRef.current &&
        !caseBoxRef.current.contains(event.target)
      ) {
        setCaseOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      closeOnOutside
    );

    return () =>
      document.removeEventListener(
        "pointerdown",
        closeOnOutside
      );
  }, []);

  // Select existing case
  const chooseExistingCase = (c) => {
    setPickedCase(c);
    setNewCase(false);
    setCaseOpen(false);

    setDraft((old) => ({
      ...old,
      case_number: c.case_number,
      case_title: c.case_title || "",
      case_type: c.case_type || "",
      court_name: c.court_name || "",
      location: c.location || "",
    }));
  };

  // Create new case
  const chooseNewCase = () => {
    setPickedCase(null);
    setNewCase(true);
    setCaseOpen(false);

    setDraft((old) => ({
      ...old,
      court_name: "",
      location: "",
      case_title: "",
    }));
  };

  // Change selected diary date
  const changeDate = (next) => {
    if (next === entryDate || !goodISO(next)) return;

    const dirty =
      draft.case_number ||
      draft.step_notes ||
      draft.previous_date ||
      draft.next_date;

    if (
      dirty &&
      !window.confirm(
        "Change date? Unsaved diary entry will be cleared."
      )
    ) {
      return;
    }

    stopVoice(true);

    setDraft(emptyDraft());
    setPickedCase(null);
    setNewCase(false);

    setTaskTitle("");
    setTaskStatus("pending");
    setTaskDue("");

    setEntryDate(next);

    navigate(
      `/add-diary-entry?date=${next}${selectedCaseId
        ? `&caseId=${encodeURIComponent(selectedCaseId)}`
        : ""
      }`,
      { replace: true }
    );
  };

  // =====================================
  // TAMIL / ENGLISH VOICE RECOGNITION
  // =====================================

  const toggleVoice = () => {
    if (recording) {
      stopVoice();
      return;
    }

    const Speech =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!Speech) {
      setError(
        "Voice-to-text is unavailable in this browser. Please use Google Chrome or Manual Typing."
      );
      return;
    }

    const rec = new Speech();

    const sessionId = ++voiceSessionRef.current;

    keepListeningRef.current = true;
    voiceRetryCountRef.current = 0;

    rec.lang = language;
    rec.continuous = true;
    rec.interimResults = false;

    // Receive final speech transcript
    rec.onresult = (event) => {
      if (sessionId !== voiceSessionRef.current) {
        return;
      }

      const spoken = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((item) => item.isFinal)
        .map((item) => item[0].transcript.trim())
        .filter(Boolean)
        .join(" ");

      if (spoken) {
        voiceRetryCountRef.current = 0;

        setDraft((old) => ({
          ...old,
          step_notes: [
            old.step_notes.trim(),
            spoken,
          ]
            .filter(Boolean)
            .join(" "),
          input_method: "voice",
        }));
      }
    };

    // Handle microphone and speech errors
    rec.onerror = (event) => {
      if (sessionId !== voiceSessionRef.current) {
        return;
      }

      if (event.error === "no-speech") {
        return;
      }

      keepListeningRef.current = false;

      const messages = {
        "not-allowed":
          "Microphone permission denied. Please allow microphone access.",
        "audio-capture":
          "Microphone not found. Check your microphone.",
        network:
          "Speech recognition network error. Check your internet connection.",
        "language-not-supported":
          "Selected language is unavailable in this browser.",
        "service-not-allowed":
          "Speech recognition service is not available.",
      };

      setError(
        messages[event.error] ||
        `Voice recognition failed: ${event.error}`
      );
    };

    // Handle automatic browser stop
    rec.onend = () => {
      if (sessionId !== voiceSessionRef.current) {
        return;
      }

      // User intentionally stopped
      if (!keepListeningRef.current) {
        setRecording(false);
        return;
      }

      // Limit automatic retries
      if (voiceRetryCountRef.current >= 3) {
        keepListeningRef.current = false;
        setRecording(false);

        setError(
          "Voice recognition stopped. Review your transcript and click Voice Note to continue."
        );
        return;
      }

      voiceRetryCountRef.current += 1;

      voiceRetryTimerRef.current = setTimeout(() => {
        voiceRetryTimerRef.current = null;

        if (
          !keepListeningRef.current ||
          sessionId !== voiceSessionRef.current
        ) {
          return;
        }

        try {
          rec.start();
        } catch {
          keepListeningRef.current = false;
          setRecording(false);

          setError(
            "Could not resume the microphone. Review your transcript and try again."
          );
        }
      }, 400);
    };

    speechRef.current = rec;

    try {
      rec.start();
      setRecording(true);
      setError("");
    } catch {
      keepListeningRef.current = false;
      setRecording(false);
      setError("Could not start microphone.");
    }
  };

  // =====================================
  // SAVE DIARY ENTRY
  // =====================================

  const handleSave = async () => {
    if (saving) return;

    stopVoice();

    if (
      selectedCaseId &&
      String(pickedCase?.id) !== selectedCaseId
    ) {
      setError(
        "Selected case could not be verified. Return to My Cases."
      );
      return;
    }

    if (!pickedCase && !newCase) {
      setError(
        "Select an existing case or choose + New Case."
      );
      return;
    }

    if (
      !draft.case_number.trim() ||
      !draft.court_name.trim() ||
      !draft.location.trim() ||
      !draft.step_notes.trim()
    ) {
      setError(
        "Case No, Court, Location and Step are required."
      );
      return;
    }

    if (
      taskStatus === "approved" &&
      suggestedTitle.trim().length < 3
    ) {
      setError("Check the approved task title.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const result = await createDiaryEntry({
        ...draft,
        entry_date: entryDate,
        case_number: draft.case_number.trim(),
        case_title:
          draft.case_title.trim() || "Untitled Case",
        court_name: draft.court_name.trim(),
        location: draft.location.trim(),
        step_notes: draft.step_notes.trim(),
        previous_date: draft.previous_date || null,
        next_date: draft.next_date || null,
        step_type: "Other",

        // AI point-wise notes must remain preview-only.
        point_notes: null,

        approved_task:
          taskStatus === "approved" &&
            suggestedTitle.trim()
            ? {
              title: suggestedTitle.trim(),
              deadline: taskDue || null,
              priority: taskPriority,
            }
            : null,
      });

      setSuccess(result);
      setDateCount((x) => x + 1);
    } catch (e) {
      setError(e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  // Reset for another entry
  const resetEntry = () => {
    setSuccess(null);

    const keepCase = selectedCaseId
      ? pickedCase
      : null;

    setDraft(
      keepCase
        ? {
          ...emptyDraft(),
          case_number: keepCase.case_number || "",
          case_title: keepCase.case_title || "",
          case_type: keepCase.case_type || "",
          court_name: keepCase.court_name || "",
          location: keepCase.location || "",
        }
        : emptyDraft()
    );

    setPickedCase(keepCase);
    setNewCase(false);

    setTaskStatus("pending");
    setTaskTitle("");
    setTaskDue("");
    setTaskPriority("Medium");
    setManualTask(false);
  };

  const back = () =>
    navigate(`/my-legal-diary?date=${entryDate}`);

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      // Clear session anyway
    }

    sessionStorage.removeItem(
      "advocanote_access_token"
    );

    sessionStorage.removeItem(
      "advocanote_refresh_token"
    );

    navigate("/login", {
      replace: true,
    });
  };

  return (
    <>
      {/* TOPBAR */}

      <LawyerTopbarPortal>
        <button
          type="button"
          className="ald-mobile-menu"
          onClick={openSidebar}
          aria-label="Open menu"
        >
          <Menu />
        </button>

        <div className="ald-global-search">
          <Search size={21} />

          <input
            aria-label="Search existing cases"
            placeholder="Search your existing cases by number, court or title..."
            value={globalQuery}
            onChange={(e) =>
              setGlobalQuery(e.target.value)
            }
          />
        </div>

        <div className="ald-topbar-actions">
          <div className="ald-dropdown-holder">
            <button
              type="button"
              className="ald-notify"
              onClick={() =>
                setBellOpen((x) => !x)
              }
              aria-label="Bell reminders"
            >
              <Bell size={25} />
            </button>

            {bellOpen && (
              <div className="ald-top-popover ald-notifications-popover">
                <strong>Reminders</strong>

                {notifications.length ? (
                  notifications.map((x) => (
                    <p key={x.id}>
                      {x.title} — {x.date}
                    </p>
                  ))
                ) : (
                  <p>No reminders yet.</p>
                )}
              </div>
            )}
          </div>

          <div className="ald-topbar-divider" />

          <div className="ald-account">
            <LawyerTopbarAvatar />

            <span className="ald-account-text">
              <strong>{fullName}</strong>
              <small>Attorney-at-Law</small>
            </span>

            <ChevronDown size={18} />
          </div>
        </div>
      </LawyerTopbarPortal>

      {/* MAIN PAGE */}

      <main className="ade2-main">
        <div className="ade2-content">
          <div className="ade2-heading">
            <div>
              <h1>Add Diary Entry</h1>

              <p>
                Record today's hearing, next dates and
                steps — with voice or typing, all in one
                place.
              </p>
            </div>

            <button
              type="button"
              className="ade2-back"
              onClick={back}
            >
              <ArrowLeft size={17} />
              Back to My Legal Diary
            </button>
          </div>

          {/* DIARY TABLE */}

          <section
            className="ade2-entry-sheet"
            aria-label="Add case proceedings"
          >
            <div className="ade2-sheet-scroll">
              <table className="ade2-diary-table">
                <colgroup>
                  <col style={{ width: "17%" }} />
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "32%" }} />
                  <col style={{ width: "16%" }} />
                </colgroup>

                <thead>
                  <tr>
                    <th>Case No</th>
                    <th>Court</th>
                    <th>Previous Date</th>
                    <th>Step (Court Proceedings)</th>
                    <th>Next Date</th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    {/* CASE NUMBER */}

                    <td className="ade2-cell-case">
                      <div
                        className="ade2-case-wrapper"
                        ref={caseBoxRef}
                      >
                        <div className="ade2-control ade2-case-control">
                          <Search size={16} />

                          <input
                            aria-label="Search case number"
                            placeholder="Search case number"
                            value={draft.case_number}
                            readOnly={Boolean(selectedCaseId)}
                            onFocus={() => {
                              if (!selectedCaseId) {
                                setCaseOpen(true);
                              }
                            }}
                            onChange={(e) => {
                              setField(
                                "case_number",
                                e.target.value
                              );
                              setPickedCase(null);
                              setCaseOpen(!newCase);
                            }}
                          />
                        </div>

                        {caseOpen && !selectedCaseId && (
                          <div className="ade2-case-list">
                            {filteredCases.map((c) => (
                              <button
                                type="button"
                                key={c.id}
                                onClick={() =>
                                  chooseExistingCase(c)
                                }
                              >
                                <strong>
                                  {c.case_number}
                                </strong>

                                <small>
                                  {c.court_name} —{" "}
                                  {c.location}
                                </small>
                              </button>
                            ))}

                            {!filteredCases.length && (
                              <p>No matching case yet.</p>
                            )}

                            <button
                              type="button"
                              className="ade2-new-case"
                              onClick={chooseNewCase}
                            >
                              <Plus size={14} />
                              New Case
                            </button>
                          </div>
                        )}
                      </div>

                      {pickedCase && (
                        <small className="ade2-helper">
                          Existing case selected
                        </small>
                      )}

                      {newCase && (
                        <div className="ade2-new-details">
                          <small>
                            New case — created when saved
                          </small>

                          <label>
                            Case Title (Optional)

                            <input
                              type="text"
                              aria-label="New case title"
                              placeholder="e.g., Perera v. Silva"
                              value={draft.case_title}
                              onChange={(e) =>
                                setField(
                                  "case_title",
                                  e.target.value
                                )
                              }
                            />
                          </label>

                          <label>
                            Case Type

                            <select
                              aria-label="Case type"
                              value={draft.case_type || ""}
                              onChange={(e) => {
                                setField(
                                  "case_type",
                                  e.target.value
                                );

                                setField(
                                  "other_case_type",
                                  ""
                                );
                              }}
                            >
                              <option value="" disabled>
                                Select Case Type
                              </option>
                              <option value="Civil">
                                Civil
                              </option>
                              <option value="Criminal">
                                Criminal
                              </option>
                              <option value="Family">
                                Family
                              </option>
                              <option value="Land">
                                Land
                              </option>
                              <option value="Labour">
                                Labour
                              </option>
                              <option value="Commercial">
                                Commercial
                              </option>
                              <option value="Fundamental Rights">
                                Fundamental Rights
                              </option>
                              <option value="Writ">
                                Writ
                              </option>
                              <option value="Testamentary">
                                Testamentary
                              </option>
                              <option value="Other">
                                Other
                              </option>
                            </select>
                          </label>

                          {draft.case_type === "Other" && (
                            <label>
                              Specify Other Case Type

                              <input
                                type="text"
                                aria-label="Other case type"
                                placeholder="Enter your case type..."
                                value={
                                  draft.other_case_type || ""
                                }
                                onChange={(e) =>
                                  setField(
                                    "other_case_type",
                                    e.target.value
                                  )
                                }
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </td>

                    {/* COURT */}

                    <td>
                      <SriLankaCourtFields
                        key={`${entryDate}-${newCase}-${pickedCase?.id ?? "none"}`}
                        court={draft.court_name}
                        location={draft.location}
                        onCourtChange={(value) =>
                          setField("court_name", value)
                        }
                        onLocationChange={(value) =>
                          setField("location", value)
                        }
                        readOnly={Boolean(pickedCase)}
                      />
                    </td>

                    {/* PREVIOUS DATE */}

                    <td>
                      <input
                        className="ade2-control"
                        aria-label="Previous hearing date"
                        type="date"
                        value={draft.previous_date}
                        onChange={(e) =>
                          setField(
                            "previous_date",
                            e.target.value
                          )
                        }
                      />
                    </td>

                    {/* COURT PROCEEDINGS */}

                    <td className="ade2-step-cell">
                      <div className="ade2-step-tabs">
                        <button
                          type="button"
                          className={
                            draft.input_method === "voice"
                              ? "ade2-tab-active"
                              : ""
                          }
                          onClick={toggleVoice}
                        >
                          {recording ? (
                            <Square size={16} />
                          ) : (
                            <Mic size={17} />
                          )}

                          {recording
                            ? "Stop Recording"
                            : "Voice Note"}
                        </button>

                        <button
                          type="button"
                          className={
                            draft.input_method === "manual"
                              ? "ade2-tab-active"
                              : ""
                          }
                          onClick={() => {
                            stopVoice(true);
                            setField(
                              "input_method",
                              "manual"
                            );
                          }}
                        >
                          <BookOpen size={17} />
                          Manual Typing
                        </button>

                        <select
                          aria-label="Voice language"
                          value={language}
                          onChange={(e) =>
                            setLanguage(e.target.value)
                          }
                        >
                          <option value="en-LK">
                            English
                          </option>
                          <option value="ta-IN">
                            Tamil
                          </option>
                        </select>
                      </div>

                      {recording && (
                        <div className="ade2-recording">
                          <span className="ade2-rec-dot" />
                          Listening...

                          <span
                            className="ade2-wave"
                            aria-hidden="true"
                          >
                            ▁▅▂▆▃▇▃▅▂▆▁▅▃▇
                          </span>
                        </div>
                      )}

                      <div className="ade2-transcript">
                        <strong>
                          {draft.input_method === "voice"
                            ? "Original Voice Transcript (preserved)"
                            : "Court Proceedings"}
                        </strong>

                        <textarea
                          aria-label="Court proceedings"
                          placeholder="Write what happened in court or record a voice note..."
                          value={draft.step_notes}
                          onChange={(e) => {
                            setField(
                              "step_notes",
                              e.target.value
                            );

                            setTaskTitle("");
                            setTaskStatus("pending");
                          }}
                        />
                      </div>

                      {/* POINT-WISE PREVIEW */}

                      {draft.step_notes.trim() && (
                        <div className="ade2-point-preview">
                          <button
                            type="button"
                            onClick={() =>
                              setShowPoints((x) => !x)
                            }
                          >
                            <Sparkles size={16} />
                            Optional Point-wise Format
                            <ChevronDown size={15} />
                          </button>

                          {showPoints && (
                            <pre>
                              {toPoints(draft.step_notes)}
                            </pre>
                          )}

                          <small>
                            Original note is preserved.
                            Points are basic formatting,
                            not verified AI.
                          </small>
                        </div>
                      )}
                    </td>

                    {/* NEXT HEARING */}

                    <td>
                      <input
                        className="ade2-control"
                        aria-label="Next hearing date"
                        type="date"
                        value={draft.next_date}
                        onChange={(e) =>
                          setField(
                            "next_date",
                            e.target.value
                          )
                        }
                      />

                      <label
                        htmlFor="next-hearing-purpose"
                        style={{
                          display: "block",
                          marginTop: "14px",
                          marginBottom: "7px",
                          fontSize: "13px",
                          fontWeight: 600,
                        }}
                      >
                        Next Hearing Purpose (Optional)
                      </label>

                      <input
                        id="next-hearing-purpose"
                        className="ade2-control"
                        type="text"
                        maxLength={255}
                        placeholder="e.g. Witness"
                        value={draft.next_hearing_purpose}
                        onChange={(e) =>
                          setField(
                            "next_hearing_purpose",
                            e.target.value
                          )
                        }
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* SUGGESTED TASKS */}

          <section
            className="ade2-tasks"
            aria-label="Suggested tasks"
          >
            <div className="ade2-tasks-heading">
              <h2>
                <Sparkles size={21} />
                AI Suggested Tasks
                <span>
                  (based on today's entry)
                </span>
              </h2>

              <small>
                Rule-based preview until AI service
                is connected
              </small>
            </div>

            <button
              type="button"
              className="ade2-manual-task-button"
              onClick={() => {
                setManualTask(
                  (current) => !current
                );
                setTaskTitle("");
                setTaskDue("");
                setTaskPriority("Medium");
                setTaskStatus("pending");
                setEditTask(false);
              }}
            >
              <Plus size={15} />
              {manualTask
                ? "Cancel Manual Task"
                : "Add Task Manually"}
            </button>

            {rawSuggestedTask || manualTask ? (
              <div className="ade2-task-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Suggested Task</th>
                      <th>Due Date</th>
                      <th>Priority</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>1</td>

                      <td>
                        {editTask || manualTask ? (
                          <input
                            aria-label="Edit task title"
                            value={suggestedTitle}
                            onChange={(e) =>
                              setTaskTitle(
                                e.target.value
                              )
                            }
                          />
                        ) : (
                          <strong>
                            {suggestedTitle}
                          </strong>
                        )}
                      </td>

                      <td>
                        <input
                          aria-label="Suggested task due date"
                          type="date"
                          value={taskDue}
                          onChange={(e) =>
                            setTaskDue(
                              e.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <select
                          aria-label="Task priority"
                          value={taskPriority}
                          onChange={(e) =>
                            setTaskPriority(
                              e.target.value
                            )
                          }
                        >
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                        </select>
                      </td>

                      <td>
                        <div className="ade2-task-actions">
                          <button
                            type="button"
                            className={
                              taskStatus === "approved"
                                ? "ade2-approved"
                                : "ade2-approve"
                            }
                            onClick={() => {
                              setTaskStatus("approved");
                              setEditTask(false);
                            }}
                          >
                            <Check size={14} />
                            {taskStatus === "approved"
                              ? "Approved"
                              : "Approve"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setEditTask((x) => !x)
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className={
                              taskStatus === "rejected"
                                ? "ade2-rejected"
                                : "ade2-reject"
                            }
                            onClick={() =>
                              setTaskStatus("rejected")
                            }
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ade2-task-empty">
                Write or record a Step to check for
                suggested actions. No task is created
                without your approval.
              </p>
            )}
          </section>

          {error && (
            <p
              className="ade2-error"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        {/* RIGHT PANEL */}

        <aside className="ade2-right">
          <MonthCalendar
            date={entryDate}
            onPick={changeDate}
          />

          <section className="ade2-panel ade2-sync">
            <h2>Automatic Sync</h2>

            <p>
              <Check size={17} />
              Hearing date saved when provided
            </p>

            <p>
              <Check size={17} />
              Calendar can use linked hearing
            </p>

            <p>
              <Check size={17} />
              Bell reminder record linked
            </p>

            <small>
              {dateCount} entry/entries already
              saved on this date.
            </small>
          </section>

          <button
            type="button"
            className="ade2-save"
            onClick={handleSave}
            disabled={
              saving ||
              recording ||
              listLoading
            }
          >
            <BookOpen size={20} />

            {saving
              ? "Saving..."
              : "Save Diary Entry"}
          </button>

          <button
            type="button"
            className="ade2-cancel"
            onClick={back}
          >
            Cancel
          </button>

          <p className="ade2-private">
            Original court proceedings remain preserved.
            Browser voice recognition may send audio
            to its speech provider.
          </p>
        </aside>
      </main>

      {/* SUCCESS POPUP */}

      {success && (
        <div className="ade2-overlay">
          <section
            className="ade2-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ade2-success-title"
          >
            <div className="ade2-success-mark">
              <Check size={30} />
            </div>

            <h2 id="ade2-success-title">
              Diary Entry Saved Successfully!
            </h2>

            <p>
              {success.case_number} — {entryDate}
            </p>

            <div className="ade2-result-grid">
              <div>
                <BookOpen size={22} />
                <strong>Legal Diary</strong>
                <small>Entry saved</small>
              </div>

              <div>
                <Gavel size={22} />
                <strong>Hearings</strong>
                <small>
                  {success.hearing_added
                    ? "Hearing linked"
                    : "No next date"}
                </small>
              </div>

              <div>
                <CalendarDays size={22} />
                <strong>Calendar</strong>
                <small>
                  {success.hearing_added
                    ? "Date available"
                    : "No date"}
                </small>
              </div>

              <div>
                <Bell size={22} />
                <strong>Reminders</strong>
                <small>
                  {success.hearing_added
                    ? "Bell reminder saved"
                    : "None"}
                </small>
              </div>
            </div>

            {success.task_added && (
              <p>Approved task saved.</p>
            )}

            <button
              type="button"
              className="ade2-save"
              onClick={back}
            >
              View Selected Date's Diary
            </button>

            <button
              type="button"
              className="ade2-cancel"
              onClick={resetEntry}
            >
              Add Another Entry
            </button>
          </section>
        </div>
      )}
    </>
  );
}
