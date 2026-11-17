
import { useEffect, useRef, useState } from "react";
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
  Upload,
} from "lucide-react";

import {
  useLawyerLayout,
  LawyerTopbarPortal,
  LawyerTopbarAvatar,
} from "../components/LawyerLayout";

import {
  createDiaryEntry,
  getDiaryOverview,
  getLawyerCases,
} from "../services/diary";

import SriLankaCourtFields from "./SriLankaCourtFields";
import StructuredLegalNotes from "../components/StructuredLegalNotes";

import "./MyLegalDiary.css";
import "./AddDiaryEntry.css";

// =====================================
// ADVOCANOTE API CONFIGURATION
// =====================================

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

const AUDIO_EXTENSIONS = new Set([
  ".wav",
  ".mp3",
  ".m4a",
  ".mp4",
  ".webm",
  ".ogg",
  ".flac",
]);

// =====================================
// DATE HELPERS
// =====================================

const toISO = (date) =>
  `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const fromISO = (value) =>
  new Date(`${value}T12:00:00`);

const goodISO = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  !Number.isNaN(fromISO(value).getTime()) &&
  toISO(fromISO(value)) === value;

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

// =====================================
// MONTH CALENDAR
// =====================================

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
    const current = fromISO(date);

    setViewMonth(
      new Date(
        current.getFullYear(),
        current.getMonth(),
        1
      )
    );
  }, [date]);

  const first = (viewMonth.getDay() + 6) % 7;

  const days = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0
  ).getDate();

  const cells = [
    ...Array(first).fill(null),
    ...Array.from(
      { length: days },
      (_, index) => index + 1
    ),
  ];

  return (
    <section
      className="ade2-panel ade2-calendar"
      aria-label="Select diary date"
    >
      <div className="ade2-calendar-top">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() =>
            setViewMonth(
              new Date(
                viewMonth.getFullYear(),
                viewMonth.getMonth() - 1,
                1
              )
            )
          }
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
          aria-label="Next month"
          onClick={() =>
            setViewMonth(
              new Date(
                viewMonth.getFullYear(),
                viewMonth.getMonth() + 1,
                1
              )
            )
          }
        >
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="ade2-calendar-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map(
          (day, index) => (
            <span
              key={`${day}-${index}`}
              className="ade2-weekday"
            >
              {day}
            </span>
          )
        )}

        {cells.map((day, index) => {
          if (!day) {
            return (
              <span key={`empty-${index}`} />
            );
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
                iso === date
                  ? "ade2-day-active"
                  : ""
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

// =====================================
// ADD DIARY ENTRY
// =====================================

export default function AddDiaryEntry() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, openSidebar } = useLawyerLayout();

  const params = new URLSearchParams(
    location.search
  );

  const urlDate = params.get("date");
  const selectedCaseId = params.get("caseId");

  const [entryDate, setEntryDate] = useState(
    goodISO(urlDate)
      ? urlDate
      : toISO(new Date())
  );

  // =====================================
  // DIARY STATE
  // =====================================

  const [cases, setCases] = useState([]);
  const [notifications, setNotifications] =
    useState([]);

  const [dateCount, setDateCount] = useState(0);
  const [globalQuery, setGlobalQuery] =
    useState("");

  const [draft, setDraft] = useState(emptyDraft);
  const [pickedCase, setPickedCase] = useState(null);
  const [newCase, setNewCase] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [showPoints, setShowPoints] = useState(true);

  // =====================================
  // VOICE + AI STATE
  // =====================================

  const [recording, setRecording] = useState(false);

  const [analyzingVoice, setAnalyzingVoice] =
    useState(false);

  const [
    voiceProcessingStep,
    setVoiceProcessingStep,
  ] = useState("");

  const [recordedAudio, setRecordedAudio] =
    useState(null);

  const [audioUrl, setAudioUrl] = useState("");

  const [aiAnalysis, setAiAnalysis] =
    useState(null);

  const [
    originalTranscript,
    setOriginalTranscript,
  ] = useState("");

  const [tasks, setTasks] = useState([]);
  // Voice-to-Text Language
  const [voiceLanguage, setVoiceLanguage] = useState("ta");

  // AI Analysis Output Language
  const [aiLanguage, setAiLanguage] = useState("ta");
  const [
    pendingVoiceEntry,
    setPendingVoiceEntry,
  ] = useState(null);

  // =====================================
  // LIVE VOICE STATUS
  // =====================================

  const [liveSpeechState, setLiveSpeechState] =
    useState("idle");

  // =====================================
  // REFS
  // =====================================

  const caseBoxRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const audioUrlRef = useRef("");
  const abortRef = useRef(null);
  const mountedRef = useRef(true);
  const taskIdRef = useRef(0);

  // Browser SpeechRecognition refs

  const liveSpeechRef = useRef(null);

  const liveSpeechActiveRef = useRef(false);

  const liveSpeechTimerRef = useRef(null);

  const liveSpeechSessionRef = useRef(0);

  const liveSpeechAccumulatedRef = useRef("");

  const liveSpeechVisibleRef = useRef("");

  // =====================================
  // UPDATE DIARY FIELD
  // =====================================

  const setField = (field, value) => {
    setDraft((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  // =====================================
  // MICROPHONE CLEANUP
  // =====================================

  const cleanupStream = () => {
    streamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());

    streamRef.current = null;
  };

  // =====================================
  // STOP LIVE SPEECH RECOGNITION
  // =====================================

  const stopLiveSpeech = (discard = false) => {
    liveSpeechActiveRef.current = false;

    if (liveSpeechTimerRef.current) {
      clearTimeout(
        liveSpeechTimerRef.current
      );

      liveSpeechTimerRef.current = null;
    }

    if (discard) {
      liveSpeechSessionRef.current += 1;
    }

    const speech = liveSpeechRef.current;

    if (speech) {
      try {
        if (discard) {
          speech.abort();
        } else {
          speech.stop();
        }
      } catch {
        // Recognition already stopped.
      }
    }

    if (discard) {
      liveSpeechRef.current = null;

      liveSpeechAccumulatedRef.current = "";
      liveSpeechVisibleRef.current = "";

      setLiveSpeechState("idle");
    } else {
      setLiveSpeechState((old) =>
        old === "fallback"
          ? old
          : "completed"
      );
    }
  };

  // =====================================
  // LIVE TAMIL VOICE TO TEXT
  // =====================================

  const startLiveSpeech = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setLiveSpeechState("fallback");

      setError(
        "Live Tamil voice typing is not supported in this browser. Finish recording and use the Whisper fallback."
      );

      return;
    }

    const session =
      ++liveSpeechSessionRef.current;

    liveSpeechActiveRef.current = true;

    liveSpeechAccumulatedRef.current = "";
    liveSpeechVisibleRef.current = "";

    setLiveSpeechState("listening");

    const listen = () => {
      if (
        !liveSpeechActiveRef.current ||
        session !==
        liveSpeechSessionRef.current
      ) {
        return;
      }

      const recognition =
        new SpeechRecognition();

      liveSpeechRef.current =
        recognition;

      recognition.lang =
        voiceLanguage === "en"
          ? "en-US"
          : "ta-IN";

      recognition.continuous = true;

      recognition.interimResults = true;

      let latestFinal = "";
      let latestInterim = "";

      // =================================
      // SHOW TEXT WHILE SPEAKING
      // =================================

      recognition.onresult = (event) => {
        if (
          !mountedRef.current ||
          session !==
          liveSpeechSessionRef.current
        ) {
          return;
        }

        const confirmed = [];
        const provisional = [];

        for (
          let index = 0;
          index < event.results.length;
          index += 1
        ) {
          const item =
            event.results[index];

          const words =
            item[0]?.transcript?.trim();

          if (!words) continue;

          if (item.isFinal) {
            confirmed.push(words);
          } else {
            provisional.push(words);
          }
        }

        latestFinal =
          confirmed.join(" ");

        latestInterim =
          provisional.join(" ");

        const visibleText = [
          liveSpeechAccumulatedRef.current,
          latestFinal,
          latestInterim,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

        liveSpeechVisibleRef.current =
          visibleText;

        // Update textarea immediately.

        setDraft((old) => ({
          ...old,

          input_method: "voice",

          step_notes: visibleText,
        }));

        // Keep original recognised text
        // separately from later lawyer edits.

        setOriginalTranscript(
          visibleText
        );
      };

      // =================================
      // LIVE SPEECH ERRORS
      // =================================

      recognition.onerror = (event) => {
        if (
          session !==
          liveSpeechSessionRef.current
        ) {
          return;
        }

        const permanentErrors = [
          "not-allowed",
          "service-not-allowed",
          "audio-capture",
          "network",
          "language-not-supported",
        ];

        if (
          permanentErrors.includes(
            event.error
          )
        ) {
          liveSpeechActiveRef.current =
            false;

          setLiveSpeechState(
            "fallback"
          );

          setError(
            "Live Tamil voice typing is unavailable. Finish recording, then use Convert with Whisper (Fallback)."
          );
        }
      };

      // =================================
      // FINALISE SPEECH SEGMENT
      // =================================

      recognition.onend = () => {
        if (
          session !==
          liveSpeechSessionRef.current
        ) {
          return;
        }

        const segment = [
          latestFinal,
          latestInterim,
        ]
          .filter(Boolean)
          .join(" ");

        if (segment) {
          const completeText = [
            liveSpeechAccumulatedRef.current,
            segment,
          ]
            .filter(Boolean)
            .join(" ")
            .trim();

          liveSpeechAccumulatedRef.current =
            completeText;

          liveSpeechVisibleRef.current =
            completeText;

          setOriginalTranscript(
            completeText
          );

          setDraft((old) => ({
            ...old,

            input_method: "voice",

            step_notes: completeText,
          }));
        }

        if (
          liveSpeechRef.current ===
          recognition
        ) {
          liveSpeechRef.current = null;
        }

        // Browsers sometimes stop after
        // a short pause. Restart if the
        // recording is still active.

        if (
          liveSpeechActiveRef.current
        ) {
          liveSpeechTimerRef.current =
            setTimeout(
              listen,
              300
            );
        } else {
          setLiveSpeechState((old) =>
            old === "fallback"
              ? old
              : "completed"
          );
        }
      };

      try {
        recognition.start();
      } catch {
        liveSpeechActiveRef.current =
          false;

        setLiveSpeechState(
          "fallback"
        );

        setError(
          "Could not start live Tamil voice typing. Finish recording and use the Whisper fallback."
        );
      }
    };

    listen();
  };

  // =====================================
  // CLEAR AUDIO
  // =====================================

  const clearAudio = () => {
    stopLiveSpeech(true);

    if (
      mediaRecorderRef.current?.state ===
      "recording"
    ) {
      mediaRecorderRef.current.onstop =
        null;

      mediaRecorderRef.current.stop();
    }

    cleanupStream();

    abortRef.current?.abort();

    abortRef.current = null;

    if (audioUrlRef.current) {
      URL.revokeObjectURL(
        audioUrlRef.current
      );
    }

    audioUrlRef.current = "";

    setAudioUrl("");
    setRecordedAudio(null);

    setRecording(false);

    setAnalyzingVoice(false);

    setVoiceProcessingStep("");

    setAiAnalysis(null);

    setOriginalTranscript("");

    setTasks([]);
  };

  // =====================================
  // CLEANUP ON PAGE UNMOUNT
  // =====================================

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      liveSpeechActiveRef.current =
        false;

      liveSpeechSessionRef.current += 1;

      if (
        liveSpeechTimerRef.current
      ) {
        clearTimeout(
          liveSpeechTimerRef.current
        );
      }

      try {
        liveSpeechRef.current?.abort();
      } catch {
        // Already stopped.
      }

      if (
        mediaRecorderRef.current?.state ===
        "recording"
      ) {
        mediaRecorderRef.current.onstop =
          null;

        mediaRecorderRef.current.stop();
      }

      streamRef.current
        ?.getTracks()
        .forEach((track) =>
          track.stop()
        );

      abortRef.current?.abort();

      if (audioUrlRef.current) {
        URL.revokeObjectURL(
          audioUrlRef.current
        );
      }
    };
  }, []);

  // =====================================
  // LOAD CASES AND DIARY OVERVIEW
  // =====================================

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

        const loaded =
          Array.isArray(myCases)
            ? myCases
            : myCases?.cases || [];

        setCases(loaded);

        setNotifications(
          overview?.notifications || []
        );

        setDateCount(
          (overview?.entries || [])
            .length
        );

        if (selectedCaseId) {
          const match = loaded.find(
            (item) =>
              String(item.id) ===
              String(selectedCaseId)
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

            case_number:
              match.case_number || "",

            case_title:
              match.case_title || "",

            case_type:
              match.case_type || "",

            court_name:
              match.court_name || "",

            location:
              match.location || "",
          }));
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err.message ||
            "Could not load lawyer cases."
          );
        }
      })
      .finally(() => {
        if (active) {
          setListLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    user,
    entryDate,
    selectedCaseId,
  ]);

  // =====================================
  // CLOSE CASE DROPDOWN
  // =====================================

  useEffect(() => {
    const close = (event) => {
      if (
        caseBoxRef.current &&
        !caseBoxRef.current.contains(
          event.target
        )
      ) {
        setCaseOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      close
    );

    return () =>
      document.removeEventListener(
        "pointerdown",
        close
      );
  }, []);

  // =====================================
  // FILTER EXISTING CASES
  // =====================================

  const filteredCases = cases
    .filter((item) => {
      const value = `
        ${item.case_number || ""}
        ${item.case_title || ""}
        ${item.court_name || ""}
        ${item.location || ""}
      `.toLowerCase();

      return (
        (item.case_number || "")
          .toLowerCase()
          .includes(
            draft.case_number.toLowerCase()
          ) &&
        value.includes(
          globalQuery.toLowerCase()
        )
      );
    })
    .slice(0, 8);

  // =====================================
  // SELECT EXISTING CASE
  // =====================================

  const chooseExistingCase = (item) => {
    setPickedCase(item);

    setNewCase(false);
    setCaseOpen(false);

    setDraft((old) => ({
      ...old,

      case_number:
        item.case_number || "",

      case_title:
        item.case_title || "",

      case_type:
        item.case_type || "",

      court_name:
        item.court_name || "",

      location:
        item.location || "",
    }));
  };

  // =====================================
  // SELECT NEW CASE
  // =====================================

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

  // =====================================
  // CHANGE DIARY DATE
  // =====================================

  const changeDate = (next) => {
    if (pendingVoiceEntry) {
      setError(
        "Voice diary was created, but audio upload is incomplete. Retry Save Diary Entry before changing the date."
      );
      return;
    }

    if (
      !goodISO(next) ||
      next === entryDate ||
      recording ||
      analyzingVoice
    ) {
      return;
    }

    const hasUnsaved = Boolean(
      draft.case_number ||
      draft.step_notes ||
      draft.previous_date ||
      draft.next_date ||
      recordedAudio ||
      tasks.length
    );

    if (
      hasUnsaved &&
      !window.confirm(
        "Change date? Unsaved diary entry and audio will be discarded."
      )
    ) {
      return;
    }

    clearAudio();

    setDraft(emptyDraft());

    setPickedCase(null);

    setNewCase(false);

    setEntryDate(next);

    setError("");

    navigate(
      `/add-diary-entry?date=${next}${selectedCaseId
        ? `&caseId=${encodeURIComponent(
          selectedCaseId
        )}`
        : ""
      }`,
      { replace: true }
    );
  };

  // =====================================
  // ACCEPT AUDIO FILE
  // =====================================

  const acceptAudioFile = (
    file,
    preserveTranscript = false
  ) => {
    if (!file) return;

    if (pendingVoiceEntry) {
      setError(
        "Complete the pending audio upload before changing your recording."
      );
      return;
    }

    const extension = `.${(
      file.name.split(".").pop() || ""
    ).toLowerCase()}`;

    if (
      !AUDIO_EXTENSIONS.has(
        extension
      )
    ) {
      setError(
        "Choose a WAV, MP3, M4A, MP4, WEBM, OGG or FLAC audio file."
      );

      return;
    }

    if (
      !file.size ||
      file.size > MAX_AUDIO_BYTES
    ) {
      setError(
        "Audio must be non-empty and less than 20 MB."
      );

      return;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(
        audioUrlRef.current
      );
    }

    const url =
      URL.createObjectURL(file);

    audioUrlRef.current = url;

    setAudioUrl(url);

    setRecordedAudio(file);

    setAiAnalysis(null);

    if (!preserveTranscript) {
      setOriginalTranscript("");

      setDraft((old) => ({
        ...old,

        input_method: "voice",

        step_notes: "",
      }));

      setLiveSpeechState("idle");
    }

    setTasks((old) =>
      old.filter((task) =>
        task.id.startsWith(
          "manual-"
        )
      )
    );

    setError("");
  };

  // =====================================
  // START VOICE RECORDING
  // =====================================

  const startRecording = async () => {
    if (
      recording ||
      analyzingVoice ||
      saving ||
      pendingVoiceEntry
    ) {
      return;
    }

    if (
      (draft.step_notes.trim() ||
        recordedAudio) &&
      !window.confirm(
        "Start a new recording? The existing transcript and unsaved audio will be replaced."
      )
    ) {
      return;
    }

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder ===
      "undefined"
    ) {
      setError(
        "Recording is not available in this browser. Use Chrome on localhost or upload audio."
      );

      return;
    }

    try {
      setError("");

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      if (!mountedRef.current) {
        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        return;
      }

      streamRef.current = stream;

      chunksRef.current = [];

      const type = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ].find((value) =>
        MediaRecorder.isTypeSupported(
          value
        )
      );

      const recorder = type
        ? new MediaRecorder(
          stream,
          {
            mimeType: type,
          }
        )
        : new MediaRecorder(stream);

      mediaRecorderRef.current =
        recorder;

      // Collect original audio.

      recorder.ondataavailable = (
        event
      ) => {
        if (event.data?.size) {
          chunksRef.current.push(
            event.data
          );
        }
      };

      recorder.onerror = () => {
        stopLiveSpeech(true);

        cleanupStream();

        if (mountedRef.current) {
          setRecording(false);

          setError(
            "Voice recording failed. Please try again."
          );
        }
      };

      recorder.onstop = () => {
        cleanupStream();

        if (!mountedRef.current) {
          return;
        }

        setRecording(false);

        const mime =
          recorder.mimeType ||
          "audio/webm";

        const extension =
          mime.includes("mp4")
            ? "mp4"
            : "webm";

        const blob = new Blob(
          chunksRef.current,
          {
            type: mime,
          }
        );

        const file = new File(
          [blob],
          `advocanote-voice.${extension}`,
          {
            type: mime,
          }
        );

        // IMPORTANT:
        // Preserve live transcript and
        // attach original recording.

        acceptAudioFile(
          file,
          true
        );
      };

      // Start saving original audio.

      recorder.start(1000);

      if (audioUrlRef.current) {
        URL.revokeObjectURL(
          audioUrlRef.current
        );

        audioUrlRef.current = "";
      }

      setAudioUrl("");

      setRecordedAudio(null);

      setOriginalTranscript("");

      setAiAnalysis(null);

      setTasks((old) =>
        old.filter((task) =>
          task.id.startsWith(
            "manual-"
          )
        )
      );

      setDraft((old) => ({
        ...old,

        input_method: "voice",

        step_notes: "",
      }));

      setRecording(true);

      // Start live browser transcription.
      // No Whisper CPU request here.

      startLiveSpeech();
    } catch (err) {
      stopLiveSpeech(true);

      cleanupStream();

      setRecording(false);

      setError(
        err.message ||
        "Microphone permission denied."
      );
    }
  };

  // =====================================
  // STOP RECORDING
  // =====================================

  const stopRecording = () => {
    // Finalize live Tamil text.

    stopLiveSpeech();

    // Stop original audio capture.

    if (
      mediaRecorderRef.current?.state ===
      "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  // =====================================
  // WHISPER FALLBACK
  // =====================================

  const convertVoiceToText = async () => {
    if (
      !recordedAudio ||
      recording ||
      analyzingVoice ||
      saving ||
      pendingVoiceEntry
    ) {
      return;
    }

    const token =
      sessionStorage.getItem(
        "advocanote_access_token"
      );

    if (!token) {
      setError(
        "Please log in again."
      );

      return;
    }

    if (
      draft.step_notes.trim() &&
      !window.confirm(
        "Replace the existing proceedings text with the new Whisper transcript?"
      )
    ) {
      return;
    }

    const controller =
      new AbortController();

    abortRef.current = controller;

    setAnalyzingVoice(true);

    setVoiceProcessingStep(
      "transcribing"
    );

    setError("");

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        recordedAudio,
        recordedAudio.name
      );
      formData.append("language", voiceLanguage);

      const response =
        await fetch(
          `${API_URL}/voice-ai/transcribe`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            body: formData,

            signal:
              controller.signal,
          }
        );

      const result =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof result.detail ===
            "string"
            ? result.detail
            : "Voice transcription failed."
        );
      }

      const transcript =
        typeof result.transcript ===
          "string"
          ? result.transcript.trim()
          : "";

      if (!transcript) {
        throw new Error(
          "No speech detected."
        );
      }

      setOriginalTranscript(
        transcript
      );

      setDraft((old) => ({
        ...old,

        input_method: "voice",

        step_notes: transcript,
      }));

      setAiAnalysis(null);

      setTasks((old) =>
        old.filter((task) =>
          task.id.startsWith(
            "manual-"
          )
        )
      );

      setLiveSpeechState(
        "completed"
      );
    } catch (err) {
      if (
        err.name !==
        "AbortError"
      ) {
        setError(
          err.message ||
          "Cannot connect to the transcription server."
        );
      }
    } finally {
      if (mountedRef.current) {
        setAnalyzingVoice(false);

        setVoiceProcessingStep("");

        abortRef.current = null;
      }
    }
  };

  // =====================================
  // ANALYSE TEXT WITH QWEN
  // =====================================

  const analyzeText = async () => {
    if (
      recording ||
      analyzingVoice ||
      saving ||
      pendingVoiceEntry
    ) {
      return;
    }

    // Use the latest edited transcript.

    const transcript =
      draft.step_notes.trim();

    if (!transcript) {
      setError(
        "Enter or convert text before analysing."
      );

      return;
    }

    const token =
      sessionStorage.getItem(
        "advocanote_access_token"
      );

    if (!token) {
      setError(
        "Please log in again."
      );

      return;
    }

    const controller =
      new AbortController();

    abortRef.current = controller;

    setAnalyzingVoice(true);

    setVoiceProcessingStep(
      "analyzing"
    );

    setError("");

    setAiAnalysis(null);

    // Keep manually created tasks.

    setTasks((old) =>
      old.filter((task) =>
        task.id.startsWith(
          "manual-"
        )
      )
    );

    try {
      const response =
        await fetch(
          `${API_URL}/voice-ai/analyze-text`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              text: transcript,
              language: aiLanguage,
            }),

            signal:
              controller.signal,
          }
        );

      const result =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof result.detail ===
            "string"
            ? result.detail
            : "AI text analysis failed."
        );
      }

      // Legal notes and highlights.

      setAiAnalysis({
        notes: Array.isArray(
          result.notes
        )
          ? result.notes
          : [],

        criticalHighlights:
          Array.isArray(
            result.critical_highlights
          )
            ? result.critical_highlights
            : [],

        analysisIncomplete:
          Boolean(
            result.analysis_incomplete
          ),
      });

      // Task suggestions must be approved.

      const suggestions =
        Array.isArray(
          result.suggested_tasks
        )
          ? result.suggested_tasks
          : [];

      const preparedTasks =
        suggestions
          .filter(
            (title) =>
              typeof title ===
              "string" &&
              title.trim()
          )
          .map((title) => ({
            id:
              `ai-${++taskIdRef.current}`,

            title:
              title.trim(),

            deadline: "",

            priority:
              "Medium",

            status:
              "pending",

            editing: false,
          }));

      setTasks((old) => [
        ...old.filter(
          (task) =>
            task.id.startsWith(
              "manual-"
            )
        ),

        ...preparedTasks,
      ]);

      setShowPoints(true);
    } catch (err) {
      if (
        err.name !==
        "AbortError"
      ) {
        setError(
          err.message ||
          "Cannot connect to the AI server."
        );
      }
    } finally {
      if (mountedRef.current) {
        setAnalyzingVoice(false);

        setVoiceProcessingStep("");

        abortRef.current = null;
      }
    }
  };

  // =====================================
  // SWITCH TO MANUAL TYPING
  // =====================================

  const switchToManual = () => {
    if (
      recording ||
      analyzingVoice ||
      saving ||
      pendingVoiceEntry
    ) {
      return;
    }

    if (
      recordedAudio &&
      !window.confirm(
        "Switch to manual typing? Unsaved audio will be discarded. The transcript text will remain."
      )
    ) {
      return;
    }

    clearAudio();

    setField(
      "input_method",
      "manual"
    );

    setError("");
  };

  // =====================================
  // EDIT COURT PROCEEDINGS
  // =====================================

  const editProceedings = (
    value
  ) => {
    setField(
      "step_notes",
      value
    );

    // Previous AI results are invalid
    // when the source text changes.

    if (aiAnalysis) {
      setAiAnalysis(null);

      setTasks((old) =>
        old.filter((task) =>
          task.id.startsWith(
            "manual-"
          )
        )
      );
    }
  };

  // =====================================
  // UPDATE TASK
  // =====================================

  const updateTask = (
    id,
    changes
  ) => {
    setTasks((previous) =>
      previous.map((task) =>
        task.id === id
          ? {
            ...task,
            ...changes,
          }
          : task
      )
    );
  };

  // =====================================
  // APPROVE TASK
  // =====================================


  const approveTask = (id) => {
    const target = tasks.find(
      (task) => task.id === id
    );

    if (
      !target?.title?.trim() ||
      target.title.trim().length < 3
    ) {
      setError(
        "Enter a valid task title before approval."
      );
      return;
    }

    setTasks((previous) =>
      previous.map((task) =>
        task.id === id
          ? {
            ...task,
            status: "approved",
            editing: false,
          }
          : task
      )
    );

    setError("");
  };


  // =====================================
  // ADD MANUAL TASK
  // =====================================

  const addManualTask = () => {
    setTasks((previous) => [
      ...previous,

      {
        id:
          `manual-${++taskIdRef.current}`,

        title: "",

        deadline: "",

        priority:
          "Medium",

        status:
          "pending",

        editing: true,
      },
    ]);
  };

  // =====================================
  // SAVE DIARY + ORIGINAL AUDIO
  // =====================================

  const handleSave = async () => {
    if (
      saving ||
      recording ||
      analyzingVoice ||
      listLoading
    ) {
      return;
    }

    // If an audio is attached,
    // its original transcript is required.

    if (
      recordedAudio &&
      !originalTranscript.trim()
    ) {
      setError(
        "Voice text is missing. Use live transcription or Convert with Whisper (Fallback) before saving."
      );

      return;
    }

    if (
      selectedCaseId &&
      String(pickedCase?.id) !==
      String(selectedCaseId)
    ) {
      setError(
        "Selected case could not be verified."
      );

      return;
    }

    if (
      !pickedCase &&
      !newCase
    ) {
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


    // Manual approved tasks only
    const approvedTasks = tasks.filter(
      (task) =>
        task.id.startsWith("manual-") &&
        task.status === "approved"
    );

    // Only AI-generated suggestions
    const aiSuggestions = tasks
      .filter((task) =>
        task.id.startsWith("ai-")
      )
      .map((task) => ({
        title: task.title.trim(),
        status: task.status || "pending",
        deadline: task.deadline || null,
        priority: task.priority || "Medium",
      }));

    if (
      aiSuggestions.some(
        (item) => item.title.length < 3
      )
    ) {
      setError(
        "Check AI suggestion titles before saving."
      );
      return;
    }


    if (
      approvedTasks.some(
        (task) => !task.title?.trim() ||
          task.title.trim().length < 3
      )
    ) {
      setError("Check approved task titles.");
      return;
    }

    const token =
      sessionStorage.getItem(
        "advocanote_access_token"
      );

    if (
      recordedAudio &&
      !token
    ) {
      setError(
        "Please log in again."
      );

      return;
    }

    setSaving(true);

    setError("");

    // Saved diary result is kept
    // for retrying a failed audio upload.

    let diaryResult =
      pendingVoiceEntry;

    try {
      // ===============================
      // 1. CREATE DIARY ENTRY
      // ===============================

      if (!diaryResult) {
        diaryResult =
          await createDiaryEntry({
            ...draft,

            entry_date:
              entryDate,

            case_number:
              draft.case_number.trim(),

            case_title:
              draft.case_title.trim() ||
              "Untitled Case",

            court_name:
              draft.court_name.trim(),

            location:
              draft.location.trim(),

            step_notes:
              draft.step_notes.trim(),

            previous_date:
              draft.previous_date ||
              null,

            next_date:
              draft.next_date ||
              null,

            step_type:
              "Other",

            point_notes:
              null,



            /* MANUAL APPROVED TASKS ONLY */

            approved_tasks: approvedTasks
              .filter((task) =>
                String(task.id).startsWith("manual-")
              )
              .map((task) => ({
                title: task.title.trim(),
                deadline: task.deadline || null,
              })),

            /* AI GENERATED TASKS ONLY */

            ai_suggestions: tasks
              .filter((task) =>
                String(task.id).startsWith("ai-") &&
                task.title?.trim()
              )
              .map((task) => ({
                title: task.title.trim(),
                deadline: task.deadline || null,
                priority: task.priority || "Medium",
                status:
                  task.status === "approved"
                    ? "approved"
                    : task.status === "rejected"
                      ? "rejected"
                      : "pending",
              })),

          });

        if (recordedAudio) {
          setPendingVoiceEntry(
            diaryResult
          );
        }
      }

      // ===============================
      // 2. SAVE ORIGINAL AUDIO
      // ===============================

      if (recordedAudio) {
        const rawEntryId =
          diaryResult?.diary_entry_id ??
          diaryResult?.entry_id ??
          diaryResult?.id ??
          diaryResult?.entry?.id ??
          diaryResult?.diary_entry?.id ??
          diaryResult?.data?.id;

        const entryId =
          Number(rawEntryId);

        if (
          !Number.isInteger(
            entryId
          ) ||
          entryId < 1
        ) {
          throw new Error(
            "Diary was created, but its ID was not returned. Check the createDiaryEntry API response before retrying."
          );
        }

        const formData =
          new FormData();

        // Original audio file.

        formData.append(
          "audio",
          recordedAudio,
          recordedAudio.name
        );

        // Browser or Whisper source transcript.

        formData.append(
          "source_transcript",
          originalTranscript
        );

        // Lawyer-reviewed transcript.

        formData.append(
          "reviewed_transcript",
          draft.step_notes.trim()
        );

        // AI notes.

        formData.append(
          "notes_json",
          JSON.stringify(
            aiAnalysis?.notes ||
            []
          )
        );

        // Important highlights.

        formData.append(
          "highlights_json",
          JSON.stringify(
            aiAnalysis?.criticalHighlights ||
            []
          )
        );

        // No notes are auto-approved.

        formData.append(
          "approved_notes_json",
          JSON.stringify([])
        );

        const uploadResponse =
          await fetch(
            `${API_URL}/voice-ai/recordings/${entryId}`,
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              body:
                formData,
            }
          );

        const uploadData =
          await uploadResponse
            .json()
            .catch(() => ({}));

        if (
          !uploadResponse.ok
        ) {
          const message =
            typeof uploadData.detail ===
              "string"
              ? uploadData.detail
              : "Audio upload failed.";

          throw new Error(
            message
          );
        }

        if (
          uploadData.audio_saved !==
          true
        ) {
          throw new Error(
            "Audio storage was not confirmed."
          );
        }
      }

      // ===============================
      // 3. SUCCESS
      // ===============================

      setPendingVoiceEntry(
        null
      );

      setSuccess(
        diaryResult
      );

      setDateCount(
        (count) =>
          count + 1
      );

      setError("");
    } catch (err) {
      if (
        recordedAudio &&
        diaryResult
      ) {
        setError(
          `Diary entry was created, but audio saving is incomplete. ${err.message} Do not refresh or create another entry. Click Save Diary Entry again to retry the audio upload.`
        );
      } else {
        setError(
          err.message ||
          "Diary save failed."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  // =====================================
  // RESET ENTRY
  // =====================================

  const resetEntry = () => {
    clearAudio();

    setPendingVoiceEntry(
      null
    );

    setSuccess(null);

    const keepCase =
      selectedCaseId
        ? pickedCase
        : null;

    setDraft(
      keepCase
        ? {
          ...emptyDraft(),

          case_number:
            keepCase.case_number ||
            "",

          case_title:
            keepCase.case_title ||
            "",

          case_type:
            keepCase.case_type ||
            "",

          court_name:
            keepCase.court_name ||
            "",

          location:
            keepCase.location ||
            "",
        }
        : emptyDraft()
    );

    setPickedCase(
      keepCase
    );

    setNewCase(false);

    setError("");
  };

  // =====================================
  // BACK TO LEGAL DIARY
  // =====================================

  const back = () => {
    if (
      pendingVoiceEntry
    ) {
      setError(
        "Audio upload is incomplete. Retry Save Diary Entry before leaving."
      );

      return;
    }

    if (
      recordedAudio &&
      !success &&
      !window.confirm(
        "Leave this page? Your unsaved voice recording will be lost."
      )
    ) {
      return;
    }

    navigate(
      `/my-legal-diary?date=${entryDate}`
    );
  };

  const fullName =
    user?.full_name ||
    "Lawyer";

  // =====================================
  // MAIN JSX
  // =====================================

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
            onChange={(event) =>
              setGlobalQuery(
                event.target.value
              )
            }
          />
        </div>

        <div className="ald-topbar-actions">
          <div className="ald-dropdown-holder">
            <button
              type="button"
              className="ald-notify"
              onClick={() =>
                setBellOpen(
                  (old) => !old
                )
              }
              aria-label="Bell reminders"
            >
              <Bell size={25} />
            </button>

            {bellOpen && (
              <div className="ald-top-popover ald-notifications-popover">
                <strong>
                  Reminders
                </strong>

                {notifications.length ? (
                  notifications.map(
                    (item) => (
                      <p key={item.id}>
                        {item.title}
                        {" — "}
                        {item.date}
                      </p>
                    )
                  )
                ) : (
                  <p>
                    No reminders yet.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="ald-topbar-divider" />

          <div className="ald-account">
            <LawyerTopbarAvatar />

            <span className="ald-account-text">
              <strong>
                {fullName}
              </strong>

              <small>
                Attorney-at-Law
              </small>
            </span>

            <ChevronDown
              size={18}
            />
          </div>
        </div>
      </LawyerTopbarPortal>

      {/* MAIN PAGE */}

      <main className="ade2-main">
        <div className="ade2-content">
          <div className="ade2-heading">
            <div>
              <h1>
                Add Diary Entry
              </h1>

              <p>
                Record today's hearing,
                next dates and steps —
                with voice or typing,
                all in one place.
              </p>
            </div>

            <button
              type="button"
              className="ade2-back"
              onClick={back}
            >
              <ArrowLeft
                size={17}
              />

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
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "39%" }} />
                  <col style={{ width: "14%" }} />
                </colgroup>


                <thead>
                  <tr>
                    <th>
                      Case No
                    </th>

                    <th>
                      Court
                    </th>

                    <th>
                      Previous Date
                    </th>

                    <th>
                      Step (Court Proceedings)
                    </th>

                    <th>
                      Next Date
                    </th>
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
                          <Search
                            size={16}
                          />

                          <input
                            aria-label="Search case number"
                            placeholder="Search case number"
                            value={
                              draft.case_number
                            }
                            readOnly={Boolean(
                              selectedCaseId
                            )}
                            onFocus={() => {
                              if (
                                !selectedCaseId
                              ) {
                                setCaseOpen(
                                  true
                                );
                              }
                            }}
                            onChange={(event) => {
                              setField(
                                "case_number",
                                event.target.value
                              );

                              setPickedCase(
                                null
                              );

                              setCaseOpen(
                                !newCase
                              );
                            }}
                          />
                        </div>

                        {caseOpen &&
                          !selectedCaseId && (
                            <div className="ade2-case-list">
                              {filteredCases.map(
                                (item) => (
                                  <button
                                    type="button"
                                    key={item.id}
                                    onClick={() =>
                                      chooseExistingCase(
                                        item
                                      )
                                    }
                                  >
                                    <strong>
                                      {
                                        item.case_number
                                      }
                                    </strong>

                                    <small>
                                      {
                                        item.court_name
                                      }
                                      {" — "}
                                      {
                                        item.location
                                      }
                                    </small>
                                  </button>
                                )
                              )}

                              {!filteredCases.length && (
                                <p>
                                  No matching
                                  case yet.
                                </p>
                              )}

                              <button
                                type="button"
                                className="ade2-new-case"
                                onClick={
                                  chooseNewCase
                                }
                              >
                                <Plus
                                  size={14}
                                />

                                New Case
                              </button>
                            </div>
                          )}
                      </div>

                      {pickedCase && (
                        <small className="ade2-helper">
                          Existing case
                          selected
                        </small>
                      )}

                      {newCase && (
                        <div className="ade2-new-details">
                          <small>
                            New case —
                            created when saved
                          </small>

                          <label>
                            Case Title
                            (Optional)

                            <input
                              type="text"
                              aria-label="New case title"
                              placeholder="e.g., Perera v. Silva"
                              value={
                                draft.case_title
                              }
                              onChange={(event) =>
                                setField(
                                  "case_title",
                                  event.target.value
                                )
                              }
                            />
                          </label>

                          <label>
                            Case Type

                            <select
                              aria-label="Case type"
                              value={
                                draft.case_type ||
                                ""
                              }
                              onChange={(event) => {
                                setField(
                                  "case_type",
                                  event.target.value
                                );

                                setField(
                                  "other_case_type",
                                  ""
                                );
                              }}
                            >
                              <option
                                value=""
                                disabled
                              >
                                Select Case Type
                              </option>

                              {[
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
                              ].map(
                                (type) => (
                                  <option
                                    value={
                                      type
                                    }
                                    key={type}
                                  >
                                    {type}
                                  </option>
                                )
                              )}
                            </select>
                          </label>

                          {draft.case_type ===
                            "Other" && (
                              <label>
                                Specify Other
                                Case Type

                                <input
                                  type="text"
                                  aria-label="Other case type"
                                  placeholder="Enter your case type..."
                                  value={
                                    draft.other_case_type ||
                                    ""
                                  }
                                  onChange={(event) =>
                                    setField(
                                      "other_case_type",
                                      event.target.value
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
                        court={
                          draft.court_name
                        }
                        location={
                          draft.location
                        }
                        onCourtChange={(value) =>
                          setField(
                            "court_name",
                            value
                          )
                        }
                        onLocationChange={(value) =>
                          setField(
                            "location",
                            value
                          )
                        }
                        readOnly={Boolean(
                          pickedCase
                        )}
                      />
                    </td>

                    {/* PREVIOUS DATE */}

                    <td>
                      <input
                        className="ade2-control"
                        type="date"
                        aria-label="Previous hearing date"
                        value={
                          draft.previous_date
                        }
                        onChange={(event) =>
                          setField(
                            "previous_date",
                            event.target.value
                          )
                        }
                      />
                    </td>

                    {/* COURT PROCEEDINGS - MANUAL + VOICE IN ONE BOX */}

                    <td className="ade2-step-cell">
                      <section className="ade2-unified-editor">
                        <div className="ade2-editor-heading">
                          <strong>Court Proceedings</strong>
                          <span>Type or use voice</span>
                        </div>

                        {/* MANUAL AND VOICE USE THE SAME TEXTAREA */}

                        <textarea
                          className="ade2-unified-textarea"
                          aria-label="Court proceedings"
                          placeholder="Type what happened in court, or record your voice. You can edit the text here."
                          value={draft.step_notes}
                          readOnly={
                            recording ||
                            analyzingVoice ||
                            saving ||
                            Boolean(pendingVoiceEntry)
                          }
                          onChange={(event) =>
                            editProceedings(event.target.value)
                          }
                        />

                        {/* VOICE CONTROLS - NO MODE SWITCH NEEDED */}

                        <div className="ade2-voice-toolbar">
                          <label className="ade2-voice-language">
                            <span>Voice language</span>

                            <select
                              value={voiceLanguage}
                              onChange={(event) =>
                                setVoiceLanguage(event.target.value)
                              }
                              disabled={
                                recording ||
                                analyzingVoice ||
                                saving ||
                                Boolean(pendingVoiceEntry)
                              }
                            >
                              <option value="ta">Tamil</option>
                              <option value="en">English</option>
                            </select>
                          </label>

                          {/* RECORD / STOP */}

                          <button
                            type="button"
                            className={`ade2-voice-action ${recording ? "is-recording" : ""
                              }`}
                            onClick={
                              recording ? stopRecording : startRecording
                            }
                            disabled={
                              analyzingVoice ||
                              saving ||
                              Boolean(pendingVoiceEntry)
                            }
                          >
                            {recording ? (
                              <Square size={15} />
                            ) : (
                              <Mic size={16} />
                            )}

                            {recording
                              ? "Stop Recording"
                              : "Record Voice"}
                          </button>

                          {/* UPLOAD AUDIO */}

                          <label className="ade2-upload-action">
                            <Upload size={15} />
                            <span>Upload Audio</span>

                            <input
                              type="file"
                              accept=".wav,.mp3,.m4a,.mp4,.webm,.ogg,.flac,audio/*"
                              disabled={
                                recording ||
                                analyzingVoice ||
                                saving ||
                                Boolean(pendingVoiceEntry)
                              }
                              onChange={(event) => {
                                acceptAudioFile(event.target.files?.[0]);
                                event.target.value = "";
                              }}
                            />
                          </label>
                        </div>

                        {/* RECORDING STATUS */}

                        {recording && (
                          <p className="ade2-recording">
                            <span className="ade2-rec-dot" />

                            {liveSpeechState === "listening"
                              ? `Recording... ${voiceLanguage === "en"
                                ? "English"
                                : "Tamil"
                              } text appears in the box above.`
                              : "Recording audio... Live voice typing may be unavailable."}
                          </p>
                        )}

                        {/* AUDIO PLAYBACK + WHISPER FALLBACK */}

                        {audioUrl && (
                          <div className="ade2-recorded-audio">
                            <audio src={audioUrl} controls />

                            {(liveSpeechState === "fallback" ||
                              !originalTranscript.trim()) && (
                                <button
                                  type="button"
                                  className="ade2-whisper-action"
                                  onClick={convertVoiceToText}
                                  disabled={
                                    recording ||
                                    analyzingVoice ||
                                    saving ||
                                    Boolean(pendingVoiceEntry)
                                  }
                                >
                                  <Mic size={15} />

                                  {voiceProcessingStep === "transcribing"
                                    ? "Converting with Whisper..."
                                    : "Convert with Whisper (Fallback)"}
                                </button>
                              )}
                          </div>
                        )}

                        {/* WHISPER PROCESSING */}

                        {analyzingVoice &&
                          voiceProcessingStep === "transcribing" && (
                            <small className="ade2-processing-note">
                              Whisper is converting the saved audio
                              on your CPU.
                            </small>
                          )}

                        <small className="ade2-voice-privacy">
                          Live voice recognition may use an online
                          browser service. Original audio is
                          uploaded to FastAPI only when you save.
                        </small>
                      </section>

                      {/* OPTIONAL AI ASSISTANCE */}

                      <section className="ade2-ai-assist">
                        <div className="ade2-ai-assist-heading">
                          <strong>
                            <Sparkles size={16} />
                            AI Assistance
                          </strong>

                          <span>Optional</span>
                        </div>

                        <p>
                          Analyse the proceedings only if you want
                          AI-organised notes and suggested tasks.
                        </p>

                        <div className="ade2-ai-assist-controls">
                          <label htmlFor="ai-output-language">
                            AI Notes Language
                          </label>

                          <select
                            id="ai-output-language"
                            value={aiLanguage}
                            disabled={
                              recording ||
                              analyzingVoice ||
                              saving ||
                              Boolean(pendingVoiceEntry)
                            }
                            onChange={(event) => {
                              setAiLanguage(event.target.value);
                              setAiAnalysis(null);

                              setTasks((old) =>
                                old.filter((task) =>
                                  task.id.startsWith("manual-")
                                )
                              );
                            }}
                          >
                            <option value="ta">Tamil</option>
                            <option value="en">English</option>
                          </select>

                          <button
                            type="button"
                            className="ade2-ai-run"
                            onClick={analyzeText}
                            disabled={
                              recording ||
                              analyzingVoice ||
                              saving ||
                              !draft.step_notes.trim() ||
                              Boolean(pendingVoiceEntry)
                            }
                          >
                            <Sparkles size={16} />

                            {voiceProcessingStep === "analyzing"
                              ? "Analysing Text..."
                              : "Analyse Text with AI"}
                          </button>
                        </div>

                        {/* AI PROCESSING STATUS */}

                        {analyzingVoice &&
                          voiceProcessingStep === "analyzing" && (
                            <small className="ade2-processing-note">
                              Qwen is analysing your edited text
                              on the CPU.
                            </small>
                          )}

                        {originalTranscript &&
                          draft.step_notes !== originalTranscript && (
                            <small className="ade2-processing-note">
                              Transcript edited. Analyse again to
                              refresh AI notes and tasks.
                            </small>
                          )}
                      </section>

                      {/* AI LEGAL NOTES PREVIEW */}

                      {aiAnalysis && (
                        <div className="ade2-point-preview">
                          <button
                            type="button"
                            onClick={() =>
                              setShowPoints((old) => !old)
                            }
                          >
                            <Sparkles size={16} />
                            AI Analysed Legal Notes
                            <ChevronDown size={15} />
                          </button>

                          {showPoints && (
                            <div style={{ marginTop: 12 }}>
                              {aiAnalysis.notes.length ? (
                                <StructuredLegalNotes
                                  notes={aiAnalysis.notes}
                                />
                              ) : (
                                <p>
                                  No important notes were extracted.
                                  Review the proceedings text.
                                </p>
                              )}

                              {/* CRITICAL HIGHLIGHTS */}

                              {!!aiAnalysis.criticalHighlights.length && (
                                <div style={{ marginTop: 14 }}>
                                  <strong>Critical Highlights</strong>

                                  {aiAnalysis.criticalHighlights.map(
                                    (highlight, index) => (
                                      <p
                                        key={index}
                                        style={{ margin: "7px 0" }}
                                      >
                                        • {highlight}
                                      </p>
                                    )
                                  )}
                                </div>
                              )}

                              {/* AI ANALYSIS WARNING */}

                              {aiAnalysis.analysisIncomplete && (
                                <small className="ade2-processing-note">
                                  Some details could not be fully
                                  verified by AI. Review the
                                  original text.
                                </small>
                              )}

                              <small>
                                AI notes are a review preview.
                                Check facts and dates against
                                the original proceedings text.
                              </small>
                            </div>
                          )}
                        </div>
                      )}
                    </td>


                    {/* NEXT HEARING */}

                    <td>
                      <input
                        className="ade2-control"
                        type="date"
                        aria-label="Next hearing date"
                        value={
                          draft.next_date
                        }
                        onChange={(event) =>
                          setField(
                            "next_date",
                            event.target.value
                          )
                        }
                      />

                      <label
                        htmlFor="next-hearing-purpose"
                        style={{
                          display:
                            "block",

                          marginTop:
                            14,

                          marginBottom:
                            7,

                          fontSize:
                            13,

                          fontWeight:
                            600,
                        }}
                      >
                        Next Hearing
                        Purpose (Optional)
                      </label>

                      <input
                        id="next-hearing-purpose"
                        className="ade2-control"
                        type="text"
                        maxLength={255}
                        placeholder="e.g. Witness"
                        value={
                          draft.next_hearing_purpose
                        }
                        onChange={(event) =>
                          setField(
                            "next_hearing_purpose",
                            event.target.value
                          )
                        }
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* AI SUGGESTED TASKS */}

          <section
            className="ade2-tasks"
            aria-label="Suggested tasks"
          >
            <div className="ade2-tasks-heading">
              <h2>
                <Sparkles
                  size={21}
                />

                AI Suggested Tasks

                <span>
                  (review before saving)
                </span>
              </h2>

              <small>
                Only tasks explicitly
                mentioned in the
                transcript should be
                considered. Verify all
                suggestions.
              </small>
            </div>

            <button
              type="button"
              className="ade2-manual-task-button"
              onClick={
                addManualTask
              }
              disabled={
                saving ||
                analyzingVoice ||
                Boolean(
                  pendingVoiceEntry
                )
              }
            >
              <Plus
                size={15}
              />

              Add Task Manually
            </button>

            {tasks.length ? (
              <div className="ade2-task-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>

                      <th>
                        Suggested Task
                      </th>

                      <th>
                        Due Date
                      </th>

                      <th>
                        Priority
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {tasks.map(
                      (
                        task,
                        index
                      ) => (
                        <tr
                          key={
                            task.id
                          }
                        >
                          <td>
                            {index + 1}
                          </td>

                          <td>
                            {task.editing ? (
                              <input
                                aria-label={`Edit task ${index + 1}`}
                                value={
                                  task.title
                                }
                                onChange={(event) =>
                                  updateTask(
                                    task.id,
                                    {
                                      title:
                                        event.target.value,

                                      status:
                                        "pending",
                                    }
                                  )
                                }
                              />
                            ) : (
                              <strong>
                                {
                                  task.title
                                }
                              </strong>
                            )}

                            {task.status ===
                              "rejected" && (
                                <small>
                                  {" "}
                                  Rejected
                                </small>
                              )}
                          </td>

                          <td>
                            <input
                              aria-label={`Task ${index + 1} due date`}
                              type="date"
                              value={
                                task.deadline
                              }
                              onChange={(event) =>
                                updateTask(
                                  task.id,
                                  {
                                    deadline:
                                      event.target.value,

                                    status:
                                      "pending",
                                  }
                                )
                              }
                            />
                          </td>

                          <td>
                            <select
                              aria-label={`Task ${index + 1} priority`}
                              value={
                                task.priority
                              }
                              onChange={(event) =>
                                updateTask(
                                  task.id,
                                  {
                                    priority:
                                      event.target.value,

                                    status:
                                      "pending",
                                  }
                                )
                              }
                            >
                              <option>
                                Low
                              </option>

                              <option>
                                Medium
                              </option>

                              <option>
                                High
                              </option>
                            </select>
                          </td>

                          <td>
                            <div className="ade2-task-actions">
                              <button
                                type="button"
                                className={
                                  task.status ===
                                    "approved"
                                    ? "ade2-approved"
                                    : "ade2-approve"
                                }
                                onClick={() =>
                                  approveTask(
                                    task.id
                                  )
                                }
                              >
                                <Check
                                  size={14}
                                />

                                {task.status ===
                                  "approved"
                                  ? "Approved"
                                  : "Approve"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateTask(
                                    task.id,
                                    {
                                      editing:
                                        !task.editing,
                                    }
                                  )
                                }
                              >
                                {task.editing
                                  ? "Done"
                                  : "Edit"}
                              </button>

                              <button
                                type="button"
                                className={
                                  task.status ===
                                    "rejected"
                                    ? "ade2-rejected"
                                    : "ade2-reject"
                                }
                                onClick={() =>
                                  updateTask(
                                    task.id,
                                    {
                                      status:
                                        "rejected",

                                      editing:
                                        false,
                                    }
                                  )
                                }
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ade2-task-empty">
                No suggested tasks yet.
                Analyse text with AI,
                or add a task manually.
                No task is saved without
                approval.
              </p>
            )}

            <small
              style={{
                display:
                  "block",

                marginTop:
                  9,
              }}
            >
              Current Diary API supports
              one approved task per entry.
              Approving another task
              replaces the previous selection.
            </small>
          </section>

          {/* ERROR */}

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
            date={
              entryDate
            }
            onPick={
              changeDate
            }
          />

          <section className="ade2-panel ade2-sync">
            <h2>
              Automatic Sync
            </h2>

            <p>
              <Check
                size={17}
              />

              Hearing date saved
              when provided
            </p>

            <p>
              <Check
                size={17}
              />

              Calendar can use
              linked hearing
            </p>

            <p>
              <Check
                size={17}
              />

              Bell reminder record
              linked
            </p>

            <small>
              {dateCount}
              {" "}
              entry/entries already
              saved on this date.
            </small>
          </section>

          {/* SAVE DIARY */}

          <button
            type="button"
            className="ade2-save"
            onClick={
              handleSave
            }
            disabled={
              saving ||
              recording ||
              analyzingVoice ||
              listLoading
            }
          >
            <BookOpen
              size={20}
            />

            {saving
              ? "Saving..."
              : "Save Diary Entry"}
          </button>

          <button
            type="button"
            className="ade2-cancel"
            onClick={
              back
            }
          >
            Cancel
          </button>

          <p className="ade2-private">
            Original voice recordings
            are stored privately when
            the diary is saved. Review
            transcripts and AI suggestions
            before saving.
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
              <Check
                size={30}
              />
            </div>

            <h2 id="ade2-success-title">
              Diary Entry Saved
              Successfully!
            </h2>

            <p>
              {success.case_number}
              {" — "}
              {entryDate}
            </p>

            <div className="ade2-result-grid">
              <div>
                <BookOpen
                  size={22}
                />

                <strong>
                  Legal Diary
                </strong>

                <small>
                  Entry saved
                </small>
              </div>

              <div>
                <Gavel
                  size={22}
                />

                <strong>
                  Hearings
                </strong>

                <small>
                  {success.hearing_added
                    ? "Hearing linked"
                    : "No next date"}
                </small>
              </div>

              <div>
                <CalendarDays
                  size={22}
                />

                <strong>
                  Calendar
                </strong>

                <small>
                  {success.hearing_added
                    ? "Date available"
                    : "No date"}
                </small>
              </div>

              <div>
                <Bell
                  size={22}
                />

                <strong>
                  Reminders
                </strong>

                <small>
                  {success.hearing_added
                    ? "Bell reminder saved"
                    : "None"}
                </small>
              </div>
            </div>

            {success.task_added && (
              <p>
                Approved task saved.
              </p>
            )}

            <button
              type="button"
              className="ade2-save"
              onClick={
                back
              }
            >
              View Selected Date's Diary
            </button>

            <button
              type="button"
              className="ade2-cancel"
              onClick={
                resetEntry
              }
            >
              Add Another Entry
            </button>
          </section>
        </div>
      )}
    </>
  );
}
