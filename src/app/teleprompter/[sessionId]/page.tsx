"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Captions,
  ChevronDown,
  Download,
  History,
  Mic,
  Minus,
  PhoneOff,
  Plus,
  Settings2,
  Sparkles,
  Sun,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import QuickActionButtons from "@/components/QuickActionButtons";
import StatusIndicator from "@/components/StatusIndicator";
import TeleprompterStream from "@/components/TeleprompterStream";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWebSocket } from "@/hooks/useWebSocket";

type Caption = { id: number; text: string; questionNumber?: number };
type HistoryEntry = { id: number; question: string; answer: string };

const MIN_FONT = 15;
const MAX_FONT = 24;
const FONT_KEY = "copilot:font-size";
const MODEL_KEY = "copilot:answer-model";
const CONTEXT_KEY = "copilot:additional-context";
const HISTORY_KEY = "copilot:answer-history";
const QUESTION_COUNT_KEY = "copilot:question-count";
const CODING_REQUEST = /\b(write|implement|create|develop|build|solve)\b.{0,140}\b(program|function|method|script|solution|algorithm|snippet|code)\b/i;

function isQuestionCaption(text: string) {
  return text.includes("?") || /\b(what|why|how|when|where|which|who|whose|whom|tell me|explain|describe|walk me through|talk me through|can you|could you|would you|will you|do you|did you|have you|are you|is there|give me|share)\b/i.test(text.trim());
}

function backendHttpBase() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || `http://${window.location.hostname}:8000`).replace(/\/$/, "");
}

function shouldAutoFollowAnswer() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

export default function TeleprompterPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  const router = useRouter();
  const { connected, eventsVersion, takeEvents, send } = useWebSocket(sessionId);
  const wakeLock = useWakeLock();
  const [status, setStatus] = useState("listening");
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("");
  const [askedBatch, setAskedBatch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [fontSize, setFontSize] = useState(17);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [endCode, setEndCode] = useState("");
  const [endError, setEndError] = useState("");
  const [ending, setEnding] = useState(false);
  const [captionFollowing, setCaptionFollowing] = useState(true);
  const [newCaptions, setNewCaptions] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeTopic, setCodeTopic] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelOptions, setModelOptions] = useState<{ id: string; owned_by: string; context_window: number | null }[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [modelRefresh, setModelRefresh] = useState(0);

  const answerBox = useRef<HTMLDivElement>(null);
  const answerContent = useRef<HTMLDivElement>(null);
  const captionBox = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const captionFollowingRef = useRef(true);
  const questionSequence = useRef(0);
  const pendingCode = useRef(false);
  const [following, setFollowing] = useState(true);
  const streamBuffer = useRef("");
  const streamFrame = useRef<number | null>(null);
  const streamTimer = useRef<number | null>(null);
  const latestQuestion = useRef("");
  const latestAnswer = useRef("");
  const currentAnswerQuestion = useRef("");
  const optimisticallyArchivedAnswer = useRef("");

  latestQuestion.current = question;
  latestAnswer.current = answer;

  const follow = useCallback((value: boolean) => {
    followingRef.current = value;
    setFollowing(value);
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
    const box = answerBox.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior });
  }, []);

  // "Code example" answers put the code block below the prose, so jump the code
  // block into view the moment it appears instead of leaving it off-screen.
  const revealCode = useCallback(() => {
    const box = answerBox.current;
    const code = answerContent.current?.querySelector("pre");
    if (!box || !code) return false;
    const offset = box.getBoundingClientRect().top;
    box.scrollTo({ top: Math.max(code.getBoundingClientRect().top - offset + box.scrollTop - 12, 0) });
    return true;
  }, []);

  // Tokens arrive several times per second; paint them once per frame so the
  // teleprompter never re-renders (and re-scrolls) for every single token.
  const flushStream = useCallback(() => {
    streamFrame.current = null;
    const chunk = streamBuffer.current;
    streamBuffer.current = "";
    if (chunk) setAnswer((value) => value + chunk);
  }, []);

  // requestAnimationFrame is paused while the phone screen is off or the tab is
  // hidden, so fall back to a timer: the answer must never stall mid-sentence.
  const scheduleFlush = useCallback(() => {
    if (streamFrame.current !== null) return;
    streamFrame.current = requestAnimationFrame(flushStream);
    streamTimer.current = window.setTimeout(() => {
      streamTimer.current = null;
      if (streamFrame.current === null) return;
      cancelAnimationFrame(streamFrame.current);
      streamFrame.current = null;
      flushStream();
    }, 180);
  }, [flushStream]);

  const resetStream = useCallback(() => {
    if (streamFrame.current !== null) cancelAnimationFrame(streamFrame.current);
    if (streamTimer.current !== null) window.clearTimeout(streamTimer.current);
    streamFrame.current = null;
    streamTimer.current = null;
    streamBuffer.current = "";
  }, []);

  useEffect(() => resetStream, [resetStream]);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(FONT_KEY));
    if (stored >= MIN_FONT && stored <= MAX_FONT) setFontSize(stored);
    setSelectedModel(window.localStorage.getItem(`${MODEL_KEY}:${sessionId}`) || "");
    setAdditionalContext(window.localStorage.getItem(`${CONTEXT_KEY}:${sessionId}`) || "");
  }, [sessionId]);

  useEffect(() => {
    setHistoryLoaded(false);
    try {
      const saved = JSON.parse(window.localStorage.getItem(`${HISTORY_KEY}:${sessionId}`) || "[]");
      setHistory(Array.isArray(saved) ? saved.filter((entry): entry is HistoryEntry => (
        entry && typeof entry.id === "number" && typeof entry.question === "string" && typeof entry.answer === "string"
      )).slice(0, 30) : []);
    } catch {
      setHistory([]);
    }
    setHistoryLoaded(true);
  }, [sessionId]);

  useEffect(() => {
    if (!historyLoaded) return;
    window.localStorage.setItem(`${HISTORY_KEY}:${sessionId}`, JSON.stringify(history));
  }, [history, historyLoaded, sessionId]);

  useEffect(() => {
    if (!settingsOpen || modelOptions.length) return;
    let active = true;
    setSettingsLoading(true);
    setSettingsError("");
    fetch(`${backendHttpBase()}/api/ai/models`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Could not load Groq models.");
        return data;
      })
      .then((data) => {
        if (!active) return;
        const options = Array.isArray(data.models) ? data.models : [];
        setModelOptions(options);
        const saved = window.localStorage.getItem(`${MODEL_KEY}:${sessionId}`) || "";
        const initial = options.find((item: { id: string }) => item.id === saved)?.id
          || options.find((item: { id: string }) => item.id === data.default_model)?.id
          || options[0]?.id
          || "";
        setSelectedModel(initial);
        if (initial) window.localStorage.setItem(`${MODEL_KEY}:${sessionId}`, initial);
      })
      .catch((err) => {
        if (active) setSettingsError(err instanceof Error ? err.message : "Could not load Groq models.");
      })
      .finally(() => {
        if (active) setSettingsLoading(false);
      });
    return () => { active = false; };
  }, [settingsOpen, modelOptions.length, modelRefresh, sessionId]);

  useEffect(() => {
    if (!eventsVersion) return;
    const receivedEvents = takeEvents();
    for (const lastEvent of receivedEvents) {
    if (lastEvent.event === "status") setStatus(String(lastEvent.state));
    if (lastEvent.event === "caption") {
      const text = String(lastEvent.text);
      if (/welcome to .*interview/i.test(text)) {
        questionSequence.current = 0;
        window.localStorage.setItem(`${QUESTION_COUNT_KEY}:${sessionId}`, "0");
      }
      const questionNumber = isQuestionCaption(text) ? ++questionSequence.current : undefined;
      if (questionNumber) window.localStorage.setItem(`${QUESTION_COUNT_KEY}:${sessionId}`, String(questionSequence.current));
      setCaptions((current) => [...current, { id: Date.now() + current.length, text, questionNumber }].slice(-40));
      setError("");
    }
    if (lastEvent.event === "snapshot") {
      const restored = Array.isArray(lastEvent.captions) ? lastEvent.captions.map(String) : [];
      if (restored.length) {
        const savedSequence = Number(window.localStorage.getItem(`${QUESTION_COUNT_KEY}:${sessionId}`) || 0);
        const restoredQuestions = restored.filter(isQuestionCaption).length;
        questionSequence.current = Math.max(0, savedSequence - restoredQuestions);
        setCaptions(restored.map((text, index) => {
          const questionNumber = isQuestionCaption(text) ? ++questionSequence.current : undefined;
          return { id: Date.now() + index, text, questionNumber };
        }));
        if (questionSequence.current < savedSequence) questionSequence.current = savedSequence;
      }
      if (lastEvent.question) setQuestion(String(lastEvent.question));
      if (lastEvent.batch) setAskedBatch(String(lastEvent.batch));
      if (lastEvent.answer) {
        setAnswer(String(lastEvent.answer));
        currentAnswerQuestion.current = String(lastEvent.question || "");
      }
    }
    if (lastEvent.event === "transcription_empty") setError(String(lastEvent.message || "No clear speech was detected."));
    if (lastEvent.event === "question_detected") {
      setQuestion(String(lastEvent.text || ""));
      setAskedBatch(String(lastEvent.batch || ""));
      setNotice("");
    }
    if (lastEvent.event === "answer_started") {
      // Keep the previous answer in history so only the newest one stays inline.
      const previous = latestAnswer.current.trim();
      if (previous && optimisticallyArchivedAnswer.current !== previous) {
        const entry: HistoryEntry = {
          id: Date.now(),
          question: currentAnswerQuestion.current || latestQuestion.current || "Previous question",
          answer: previous,
        };
        setHistory((entries) => [entry, ...entries].slice(0, 30));
      }
      optimisticallyArchivedAnswer.current = "";
      currentAnswerQuestion.current = String(lastEvent.text || latestQuestion.current || "");
      pendingCode.current = CODING_REQUEST.test(currentAnswerQuestion.current);
      resetStream();
      setAnswer("");
      setError("");
      setNotice("");
      setQuestion(String(lastEvent.text || ""));
      if (lastEvent.batch) setAskedBatch(String(lastEvent.batch));
      follow(shouldAutoFollowAnswer());
    }
    if (lastEvent.event === "answer_token") {
      streamBuffer.current += String(lastEvent.token);
      scheduleFlush();
    }
    if (lastEvent.event === "answer_done") {
      // Commit tokens still waiting in the frame buffer before clearing timers.
      flushStream();
      resetStream();
      // Use the server's completed answer as the canonical text on every device.
      if (lastEvent.status === "error") setAnswer("");
      else if (typeof lastEvent.answer === "string") setAnswer(lastEvent.answer);
      if (lastEvent.status === "truncated") setNotice("The answer hit the length limit. Tap Explain deeper for the rest.");
    }
    if (lastEvent.event === "answer_cleared") {
      resetStream();
      setAnswer("");
      latestAnswer.current = "";
      currentAnswerQuestion.current = "";
      setError("");
      setNotice("");
    }
    if (lastEvent.event === "cleared") {
      resetStream();
      pendingCode.current = false;
      follow(true);
      setCaptions([]);
      questionSequence.current = 0;
      window.localStorage.removeItem(`${QUESTION_COUNT_KEY}:${sessionId}`);
      setAnswer("");
      setQuestion("");
      setAskedBatch("");
      setHistory([]);
      window.localStorage.removeItem(`${HISTORY_KEY}:${sessionId}`);
      setNotice("");
      setError("");
    }
    if (lastEvent.event === "room_closed") {
      resetStream();
      setStatus("closed");
      setCaptions([]);
      setAnswer("");
      setQuestion("");
      setAskedBatch("");
      setError("Interview ended on the desktop device. This room session is closed, and its transcript and answers were deleted.");
      setHistory([]);
      setHistoryLoaded(false);
      window.localStorage.removeItem(`${HISTORY_KEY}:${sessionId}`);
      window.localStorage.removeItem(`${QUESTION_COUNT_KEY}:${sessionId}`);
    }
    if (lastEvent.event === "error") {
      setStatus("listening");
      setError(String(lastEvent.message));
    }
    }
  }, [eventsVersion, takeEvents, flushStream, resetStream, scheduleFlush, follow]);

  useEffect(() => {
    const box = answerBox.current;
    if (!box) return;
    if (pendingCode.current && revealCode()) {
      pendingCode.current = false;
      return;
    }
    if (followingRef.current) box.scrollTop = box.scrollHeight;
  }, [answer, revealCode]);

  // Mobile browsers can reflow streamed text after React paints (font sizing,
  // wrapping, and code blocks). Keep the answer pinned to the latest content
  // while following, even when its layout changes without a new token.
  useEffect(() => {
    const content = answerContent.current;
    const box = answerBox.current;
    if (!content || !box || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (!followingRef.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (pendingCode.current && revealCode()) {
          pendingCode.current = false;
          return;
        }
        box.scrollTop = box.scrollHeight;
      });
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [answer.length > 0, revealCode]);

  useEffect(() => {
    const box = captionBox.current;
    if (!box) return;
    if (captionFollowingRef.current) {
      box.scrollTop = box.scrollHeight;
      setNewCaptions(false);
    } else {
      setNewCaptions(true);
    }
  }, [captions.length]);

  const scrollCaptionsToLatest = useCallback(() => {
    const box = captionBox.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    captionFollowingRef.current = true;
    setCaptionFollowing(true);
    setNewCaptions(false);
  }, []);

  const changeFont = (delta: number) => {
    setFontSize((current) => {
      const next = Math.min(MAX_FONT, Math.max(MIN_FONT, current + delta));
      window.localStorage.setItem(FONT_KEY, String(next));
      return next;
    });
  };

  const askAI = (action: "standard" | "explain_deeper" | "code_example" = "standard", topic = "") => {
    if (!connected || !captions.length) return;
    const previous = latestAnswer.current.trim();
    if (previous) {
      setHistory((entries) => [
        {
          id: Date.now(),
          question: currentAnswerQuestion.current || latestQuestion.current || "Previous question",
          answer: previous,
        },
        ...entries,
      ].slice(0, 30));
      optimisticallyArchivedAnswer.current = previous;
    }
    latestAnswer.current = "";
    setAnswer("");
    setAskedBatch("");
    setQuestion("");
    setError("");
    setStatus("thinking");
    setNotice("");
    follow(shouldAutoFollowAnswer());
    pendingCode.current = action === "code_example";
    setCodeOpen(action === "code_example" && !topic.trim());
    const answerPreferences = {
      ...(selectedModel ? { model: selectedModel } : {}),
      ...(additionalContext.trim() ? { additional_context: additionalContext.trim() } : {}),
    };
    if (action === "standard") {
      send({ event: "ask_ai", ...answerPreferences });
      return;
    }
    send({
      event: "quick_action",
      action,
      ...answerPreferences,
      ...(topic.trim() ? { topic: topic.trim() } : {}),
    });
  };

  const submitCodeTopic = () => {
    askAI("code_example", codeTopic);
    setCodeTopic("");
  };

  const downloadInterview = () => {
    const transcript = captions.map((caption) => (
      caption.questionNumber ? `Q${caption.questionNumber} - ${caption.text}` : caption.text
    ));
    const answers = [
      ...history.slice().reverse(),
      ...(answer.trim() ? [{ id: Date.now(), question: currentAnswerQuestion.current || question, answer }] : []),
    ];
    const content = [
      "STEALTH CO-PILOT - INTERVIEW NOTES",
      "",
      "INTERVIEW TRANSCRIPT",
      transcript.length ? transcript.join("\n") : "No transcript captions captured.",
      "",
      "AI ANSWERS",
      answers.length
        ? answers.map((entry, index) => `Q${index + 1} - ${entry.question}\nAnswer: ${entry.answer}`).join("\n\n")
        : "No AI answers captured.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `stealth-interview-${sessionId.slice(0, 8)}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadTranscript = () => {
    const lines = captions.map((caption) => (
      caption.questionNumber ? `Q${caption.questionNumber} - ${caption.text}` : caption.text
    ));
    const content = [
      "STEALTH CO-PILOT - LIVE INTERVIEW TRANSCRIPT",
      "",
      lines.length ? lines.join("\n") : "No transcript captions captured.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `stealth-transcript-${sessionId.slice(0, 8)}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const endInterview = async () => {
    const digits = endCode.replace(/\D/g, "");
    if (digits.length !== 6) {
      setEndError("Enter the 6-digit pairing code shown in the desktop app.");
      return;
    }
    setEnding(true);
    setEndError("");
    try {
      const response = await fetch(`${backendHttpBase()}/api/session/${sessionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairing_code: digits }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not end this interview.");
      window.localStorage.removeItem(`${HISTORY_KEY}:${sessionId}`);
      window.localStorage.removeItem(`${CONTEXT_KEY}:${sessionId}`);
      window.localStorage.removeItem(`${MODEL_KEY}:${sessionId}`);
      window.localStorage.removeItem(`${QUESTION_COUNT_KEY}:${sessionId}`);
      router.push("/");
    } catch (err) {
      setEndError(err instanceof Error ? err.message : "Could not end this interview.");
    } finally {
      setEnding(false);
    }
  };

  const busy = status === "thinking" || status === "streaming";
  const actionsDisabled = !connected || !captions.length || busy;
  const hint = !connected
    ? "Reconnecting to your interview roomâ€¦"
    : !captions.length
      ? "Waiting for the interviewer's first caption before Ask AI unlocks."
      : "";

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Bot size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-extrabold uppercase leading-tight tracking-[0.2em]">
              <span className="text-muted-foreground">Stealth</span> <span className="text-foreground">Co-Pilot</span>
            </p>
            <StatusIndicator state={status} connected={connected} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium md:inline-flex ${
              wakeLock
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            <Sun size={12} aria-hidden="true" />
            {wakeLock ? "Screen awake" : "Screen may sleep"}
          </span>
          <div className="flex items-center rounded-xl border border-border bg-card p-1">
            <button
              aria-label="Decrease answer text size"
              onClick={() => changeFont(-1)}
              disabled={fontSize <= MIN_FONT}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <span className="w-8 text-center font-mono text-xs font-semibold tabular-nums text-foreground">{fontSize}</span>
            <button
              aria-label="Increase answer text size"
              onClick={() => changeFont(1)}
              disabled={fontSize >= MAX_FONT}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setEndOpen(true); setEndError(""); }}
            aria-label="End interview"
            title="End interview"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-auto md:gap-1.5 md:px-2.5"
          >
            <PhoneOff size={15} aria-hidden="true" />
            <span className="hidden text-[11px] font-medium md:inline">End interview</span>
          </button>
        </div>
      </header>

      {!connected ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-[11px] text-amber-200">
          <WifiOff size={12} aria-hidden="true" />
          Reconnecting to the interview roomâ€¦
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-rows-[18dvh_minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:grid-rows-1">
        <section
          aria-label="Live interviewer captions"
          className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-b border-border/80 bg-card/25 lg:max-h-none lg:border-b-0 lg:border-r"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2.5">
            <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Captions size={13} className="text-primary" aria-hidden="true" />
              Live transcript
              {connected ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" /> : null}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {captions.length ? `${captions.length} ${captions.length === 1 ? "line" : "lines"}` : "Automatic"}
              </span>
              <button
                type="button"
                onClick={downloadTranscript}
                disabled={!captions.length}
                aria-label="Download live transcript"
                title="Download live transcript"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <Download size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div
            ref={captionBox}
            onScroll={(event) => {
              const element = event.currentTarget;
              const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 32;
              captionFollowingRef.current = atBottom;
              setCaptionFollowing(atBottom);
              if (atBottom) setNewCaptions(false);
            }}
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-4"
            aria-live="polite"
          >
            {captions.length ? (
              <>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                  <UserRound size={11} aria-hidden="true" />
                  Interviewer
                </p>
                <ol className="space-y-1">
                  {captions.map((caption, index) => {
                    const latest = index === captions.length - 1;
                    return (
                      <li key={caption.id} className="flex gap-3">
                        <span
                          aria-hidden={!caption.questionNumber}
                          className={caption.questionNumber
                            ? "mt-0.5 shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary"
                            : `mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${latest ? "bg-primary" : "bg-border"}`}
                        >
                          {caption.questionNumber ? `Q${caption.questionNumber} -` : null}
                        </span>
                        <p
                          className={`min-w-0 flex-1 text-sm leading-6 [overflow-wrap:anywhere] ${
                            latest ? "text-foreground" : "text-muted-foreground/75"
                          }`}
                        >
                          {caption.text}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </>
            ) : (
              <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 px-6 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                  <Mic size={16} aria-hidden="true" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  {connected ? "Listening for the interviewer" : "Connecting to your room"}
                </p>
                <p className="max-w-[26ch] text-xs leading-5 text-muted-foreground">
                  {connected
                    ? "Captions appear here the moment speech is detected on your laptop."
                    : "Keep this page open â€” captions resume automatically."}
                </p>
              </div>
            )}
          </div>
          {!captionFollowing ? (
            <button
              type="button"
              onClick={scrollCaptionsToLatest}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-lg backdrop-blur transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronDown size={13} aria-hidden="true" />
              {newCaptions ? "New captions Â· Latest" : "Latest"}
            </button>
          ) : null}
        </section>

        <section aria-label="Suggested interview response" className="flex min-h-0 min-w-0 flex-col bg-background">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 px-4 py-2.5">
            <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Sparkles size={13} className="text-primary" aria-hidden="true" />
              Suggested response
            </p>
            <div className="flex items-center gap-2">
              {status === "streaming" ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
                  Streaming
                </span>
              ) : status === "thinking" ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" aria-hidden="true" />
                  Thinking
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                  {answer ? "Ready" : "Idle"}
                </span>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="Open AI settings"
                title="AI settings"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Settings2 size={13} aria-hidden="true" />
              </button>
              <button
                onClick={() => setHistoryOpen(true)}
                disabled={!history.length && !answer && !captions.length}
                aria-label="Open answer history"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                <History size={12} aria-hidden="true" />
                {history.length}
              </button>
            </div>
          </div>

          {question ? (
            <div className="flex h-10 max-h-10 shrink-0 items-center gap-2 overflow-hidden border-b border-border/80 bg-primary/[0.04] px-4 py-1 sm:h-auto sm:max-h-none sm:items-start sm:overflow-visible sm:py-2.5">
              <span className="mt-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-primary">
                This batch
              </span>
              <p className="h-full min-h-0 min-w-0 flex-1 overflow-y-auto whitespace-pre-line border-l-2 border-primary/40 pl-2 text-[11px] leading-4 text-muted-foreground sm:h-auto sm:max-h-32 sm:text-xs sm:leading-5">
                {askedBatch || question}
              </p>
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="shrink-0 border-b border-rose-500/20 bg-rose-950/30 px-4 py-2 text-xs leading-5 text-rose-300">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div role="status" className="shrink-0 border-b border-amber-500/20 bg-amber-950/25 px-4 py-2 text-xs leading-5 text-amber-200">
              {notice}
            </div>
          ) : null}

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              ref={answerBox}
              onScroll={(event) => {
                const element = event.currentTarget;
                const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
                if (atBottom !== followingRef.current) follow(atBottom);
              }}
              className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
              aria-live="polite"
            >
              {answer ? (
                <div ref={answerContent} className="mx-auto w-full min-w-0 max-w-[68ch]">
                  <TeleprompterStream answer={answer} fontSize={fontSize} streaming={status === "streaming"} />
                </div>
              ) : (
                <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-3 px-6 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-primary">
                    <Sparkles size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">No answer yet</p>
                    <p className="mx-auto mt-1 max-w-[34ch] text-xs leading-5 text-muted-foreground">
                      Captions are transcribed live. Press <span className="font-medium text-foreground">Ask AI</span>{" "}
                      for a clear, tailored answer in easy spoken words.
                    </p>
                  </div>
                </div>
              )}
            </div>
            {answer && !following ? (
              <button
                onClick={() => {
                  follow(true);
                  scrollToLatest();
                }}
                className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-lg backdrop-blur transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown size={13} aria-hidden="true" />
                Jump to latest
              </button>
            ) : null}
          </div>

          {codeOpen ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitCodeTopic();
              }}
              className="shrink-0 border-t border-border/80 bg-card/40 px-3 py-2.5 sm:px-5"
            >
              <label htmlFor="code-topic" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Which code example?
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id="code-topic"
                  autoFocus
                  value={codeTopic}
                  onChange={(event) => setCodeTopic(event.target.value)}
                  placeholder="e.g. token bucket rate limiter in Python"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Sparkles size={13} aria-hidden="true" />
                  Get code
                </button>
                <button
                  type="button"
                  onClick={() => setCodeOpen(false)}
                  aria-label="Cancel code example request"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            </form>
          ) : null}

          <QuickActionButtons
            disabled={actionsDisabled}
            hint={hint || undefined}
            onAskAI={() => askAI()}
            onAction={(action) => {
              if (action === "code_example") {
                setCodeOpen((open) => !open);
                return;
              }
              askAI(action);
            }}
            onClear={() => send({ event: "clear_answer" })}
          />
        </section>
      </div>

      {endOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-3 sm:items-center sm:p-6">
          <section role="dialog" aria-modal="true" aria-labelledby="end-interview-title" className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300">
                <PhoneOff size={17} aria-hidden="true" />
              </span>
              <div>
                <h2 id="end-interview-title" className="text-sm font-bold text-foreground">End interview</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">This closes the room and deletes its transcript, answers, and saved resume data.</p>
              </div>
            </div>
            <label htmlFor="end-pairing-code" className="mt-5 block text-xs font-semibold text-foreground">Desktop pairing code</label>
            <input
              id="end-pairing-code"
              autoFocus
              inputMode="numeric"
              autoComplete="off"
              value={endCode}
              onChange={(event) => setEndCode(event.target.value)}
              placeholder="6-digit code"
              className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm tracking-[0.16em] text-foreground outline-none placeholder:tracking-normal placeholder:text-muted-foreground focus:border-primary/60"
            />
            {endError ? <p role="alert" className="mt-2 text-xs text-rose-300">{endError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEndOpen(false)} className="h-10 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Cancel</button>
              <button type="button" onClick={endInterview} disabled={ending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-500 px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                <PhoneOff size={13} aria-hidden="true" />
                {ending ? "Ending..." : "End and delete room"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-3 sm:items-center sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-settings-title"
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-primary">
                  <Settings2 size={16} aria-hidden="true" />
                </span>
                <div>
                  <h2 id="ai-settings-title" className="text-sm font-bold text-foreground">AI answer settings</h2>
                  <p className="text-[11px] text-muted-foreground">Choose a Groq model and set your speaking style.</p>
                </div>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                aria-label="Close AI settings"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <div className="space-y-5 px-4 py-5 sm:px-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="answer-model" className="text-xs font-semibold text-foreground">Groq model</label>
                  <button
                    type="button"
                    onClick={() => {
                      setModelOptions([]);
                      setModelRefresh((value) => value + 1);
                    }}
                    disabled={settingsLoading}
                    className="text-[11px] font-medium text-primary transition-opacity hover:opacity-80 disabled:opacity-50"
                  >
                    {settingsLoading ? "Loading modelsâ€¦" : "Refresh models"}
                  </button>
                </div>
                <select
                  id="answer-model"
                  value={selectedModel}
                  onChange={(event) => {
                    setSelectedModel(event.target.value);
                    window.localStorage.setItem(`${MODEL_KEY}:${sessionId}`, event.target.value);
                  }}
                  disabled={settingsLoading || !modelOptions.length}
                  className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/60 disabled:opacity-60"
                >
                  {modelOptions.length ? modelOptions.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.id}{model.context_window ? ` Â· ${Number(model.context_window).toLocaleString()} context` : ""}
                    </option>
                  )) : <option value="">{settingsLoading ? "Loading active modelsâ€¦" : "No models loaded"}</option>}
                </select>
                {settingsError ? <p role="alert" className="mt-2 text-xs leading-5 text-rose-300">{settingsError}</p> : null}
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  Active text-generation models from your Groq account. The API key stays on the backend.
                </p>
              </div>
              <div>
                <label htmlFor="extra-answer-context" className="text-xs font-semibold text-foreground">Extra answer context</label>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  Add preferences such as â€œuse simple Englishâ€, â€œkeep it under 30 secondsâ€, or a detail the answer should focus on.
                </p>
                <textarea
                  id="extra-answer-context"
                  rows={4}
                  maxLength={3000}
                  value={additionalContext}
                  onChange={(event) => {
                    setAdditionalContext(event.target.value);
                    window.localStorage.setItem(`${CONTEXT_KEY}:${sessionId}`, event.target.value);
                  }}
                  placeholder="Use simple words and answer in 3â€“4 short sentencesâ€¦"
                  className="mt-2 w-full resize-y rounded-xl border border-border bg-card px-3 py-2.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/60"
                />
                <p className="mt-1 text-right text-[10px] tabular-nums text-muted-foreground">{additionalContext.length}/3000</p>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setAdditionalContext("");
                    window.localStorage.removeItem(`${CONTEXT_KEY}:${sessionId}`);
                  }}
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear extra context
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Done
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {historyOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-primary">
                <History size={17} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold tracking-tight text-foreground">Answer history</p>
                <p className="text-[11px] text-muted-foreground">
                  {history.length} {history.length === 1 ? "earlier answer" : "earlier answers"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadInterview}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Download size={14} aria-hidden="true" />
                Download
              </button>
              <button
                onClick={() => setHistoryOpen(false)}
                aria-label="Close answer history"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <div className="mx-auto max-w-[68ch] space-y-4">
              {history.length ? (
                history.map((entry) => (
                  <article key={entry.id} className="rounded-xl border border-border bg-card/50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Asked</p>
                    <p className="mt-1 text-sm leading-6 text-foreground">{entry.question}</p>
                    <div className="mt-3 border-t border-border/70 pt-3">
                      <TeleprompterStream answer={entry.answer} fontSize={16} />
                    </div>
                  </article>
                ))
              ) : (
                <p className="pt-10 text-center text-sm text-muted-foreground">
                  No earlier answers yet. Each new answer moves the previous one here.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
