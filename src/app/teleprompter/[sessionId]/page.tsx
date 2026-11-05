"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Bot,
  Captions,
  CheckCircle2,
  ChevronDown,
  Download,
  History,
  Mic,
  Minus,
  PhoneOff,
  Plus,
  Settings2,
  Sparkles,
  VolumeX,
  WifiOff,
  X,
} from "lucide-react";
import QuickActionButtons from "@/components/QuickActionButtons";
import StatusIndicator from "@/components/StatusIndicator";
import TeleprompterStream from "@/components/TeleprompterStream";
import ThemeToggle from "@/components/ThemeToggle";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWebSocket } from "@/hooks/useWebSocket";

type Caption = { id: number; text: string; timestamp: string | null };
type HistoryEntry = { id: number; question: string; answer: string };
type CaptionState = "on" | "paused" | "off";
type EndedInfo = {
  job_title: string;
  duration_seconds: number;
  questions: number;
  captions: number;
  ended_at: string | null;
};

const MIN_FONT = 15;
const MAX_FONT = 24;
const FONT_KEY = "copilot:font-size";
const MODEL_KEY = "copilot:answer-model";
const CONTEXT_KEY = "copilot:additional-context";
const HISTORY_KEY = "copilot:answer-history";
const CODING_REQUEST = /\b(write|implement|create|develop|build|solve)\b.{0,140}\b(program|function|method|script|solution|algorithm|snippet|code)\b/i;

function backendHttpBase() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || `http://${window.location.hostname}:8000`).replace(/\/$/, "");
}

function looksLikeQuestion(text: string) {
  return text.includes("?") || /\b(what|why|how|when|where|which|who|whose|tell me|explain|describe|walk me through|talk me through|can you|could you|would you|do you|did you|have you|are you|is there|give me|share)\b/i.test(text.trim());
}

function shouldAutoFollowAnswer() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

function clock(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes) return `${minutes}m ${String(rest).padStart(2, "0")}s`;
  return `${rest}s`;
}

function downloadTextFile(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// One header for every card in the room feed: same height, same paddings, same
// label weight, so the transcript, the outline and the answers line up exactly.
function SectionHeader({
  icon,
  label,
  live = false,
  tone = "muted",
  children,
}: {
  icon: ReactNode;
  label: string;
  live?: boolean;
  tone?: "muted" | "primary";
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-[38px] items-center justify-between gap-2 border-b border-border/60 px-3.5 py-2">
      <p
        className={`inline-flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
          tone === "primary" ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {icon}
        <span className="truncate">{label}</span>
        {live ? <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" /> : null}
      </p>
      {children ? <div className="flex shrink-0 items-center gap-1.5">{children}</div> : null}
    </div>
  );
}

export default function TeleprompterPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  const { connected, eventsVersion, takeEvents, send } = useWebSocket(sessionId);
  useWakeLock();
  const [status, setStatus] = useState("listening");
  const [captionState, setCaptionState] = useState<CaptionState>("off");
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("");
  const [nextQuestion, setNextQuestion] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [fontSize, setFontSize] = useState(17);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [interviewEnded, setInterviewEnded] = useState(false);
  const [endedInfo, setEndedInfo] = useState<EndedInfo | null>(null);
  const [endedTranscript, setEndedTranscript] = useState<Caption[]>([]);
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

  const feedBox = useRef<HTMLDivElement>(null);
  const answerContent = useRef<HTMLDivElement>(null);
  const captionBox = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const captionFollowingRef = useRef(true);
  const pendingCode = useRef(false);
  const [following, setFollowing] = useState(true);
  const streamBuffer = useRef("");
  const streamFrame = useRef<number | null>(null);
  const streamTimer = useRef<number | null>(null);
  const latestQuestion = useRef("");
  const latestAnswer = useRef("");
  const currentAnswerQuestion = useRef("");
  // Mirrors the ref as state so the answer card keeps printing the question the
  // visible answer belongs to, even after the interviewer moves on.
  const [answerQuestion, setAnswerQuestion] = useState("");
  const rememberQuestion = useCallback((value: string) => {
    currentAnswerQuestion.current = value;
    setAnswerQuestion(value);
  }, []);
  const optimisticallyArchivedAnswer = useRef("");

  latestQuestion.current = question;
  latestAnswer.current = answer;

  const follow = useCallback((value: boolean) => {
    followingRef.current = value;
    setFollowing(value);
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
    const box = feedBox.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior });
  }, []);

  // "Code example" answers put the code block below the prose, so jump the code
  // block into view the moment it appears instead of leaving it off-screen.
  const revealCode = useCallback(() => {
    const code = answerContent.current?.querySelector("pre");
    if (!code) return false;
    code.scrollIntoView({ block: "nearest" });
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

  // An interview ended on the desktop must show the same page here, even when
  // this phone was closed at that moment.
  const loadEnded = useCallback(async () => {
    try {
      const response = await fetch(`${backendHttpBase()}/api/session/${sessionId}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (data.status !== "ended") return;
      setEndedInfo({
        job_title: String(data.job_title || "Interview"),
        duration_seconds: Number(data.duration_seconds || 0),
        questions: Number(data.questions || 0),
        captions: Number(data.captions || 0),
        ended_at: data.ended_at ? String(data.ended_at) : null,
      });
      setInterviewEnded(true);
      setStatus("closed");
      const detail = await fetch(`${backendHttpBase()}/api/history/${sessionId}`, { cache: "no-store" });
      if (detail.ok) {
        const body = await detail.json();
        if (Array.isArray(body.transcript)) {
          setEndedTranscript(
            body.transcript.map((line: { text?: string; timestamp?: string | null }, index: number) => ({
              id: index,
              text: String(line.text || ""),
              timestamp: line.timestamp || null,
            })).filter((line: Caption) => line.text),
          );
        }
      }
    } catch {
      /* Offline: the socket reconnect will try again. */
    }
  }, [sessionId]);

  useEffect(() => {
    void loadEnded();
  }, [loadEnded]);

  useEffect(() => {
    if (connected) void loadEnded();
  }, [connected, loadEnded]);

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
      if (lastEvent.event === "caption_state") {
        const value = String(lastEvent.state || "off") as CaptionState;
        setCaptionState(value === "on" || value === "paused" ? value : "off");
      }
      if (lastEvent.event === "caption") {
        const text = String(lastEvent.text);
        const timestamp = lastEvent.timestamp ? String(lastEvent.timestamp) : new Date().toISOString();
        setCaptions((current) => [...current, { id: Date.now() + current.length, text, timestamp }].slice(-80));
        setCaptionState("on");
        setError("");
        // Speech that arrives after an answer is very likely the next question:
        // give it its own outline under the answer, like the desktop window.
        if (latestAnswer.current.trim() && looksLikeQuestion(text)) setNextQuestion(text);
      }
      if (lastEvent.event === "snapshot") {
        const restoredRows = Array.isArray(lastEvent.transcript)
          ? lastEvent.transcript.map((line: { text?: string; timestamp?: string | null }, index: number) => ({
            id: Date.now() + index,
            text: String(line.text || ""),
            timestamp: line.timestamp || null,
          })).filter((line: Caption) => line.text)
          : [];
        const restored = restoredRows.length
          ? restoredRows
          : (Array.isArray(lastEvent.captions) ? lastEvent.captions.map(String) : []).map((text, index) => ({
            id: Date.now() + index,
            text,
            timestamp: null,
          }));
        if (restored.length) setCaptions(restored);
        if (lastEvent.caption_state) {
          const value = String(lastEvent.caption_state) as CaptionState;
          setCaptionState(value === "on" || value === "paused" ? value : "off");
        }
        if (lastEvent.question) setQuestion(String(lastEvent.question));
        if (lastEvent.answer) {
          setAnswer(String(lastEvent.answer));
          rememberQuestion(String(lastEvent.question || ""));
        }
      }
      if (lastEvent.event === "transcription_empty") setError(String(lastEvent.message || "No clear speech was detected."));
      if (lastEvent.event === "question_detected") {
        setQuestion(String(lastEvent.text || ""));
        setNotice("");
      }
      if (lastEvent.event === "answer_started") {
        setNextQuestion("");
        // Keep the previous answer above the new one so the feed reads like the
        // desktop window: transcript, then answer, then the next question.
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
        rememberQuestion(String(lastEvent.text || latestQuestion.current || ""));
        pendingCode.current = CODING_REQUEST.test(currentAnswerQuestion.current);
        resetStream();
        setAnswer("");
        setError("");
        setNotice("");
        setQuestion(String(lastEvent.text || ""));
        follow(shouldAutoFollowAnswer());
      }
      if (lastEvent.event === "answer_token") {
        streamBuffer.current += String(lastEvent.token);
        scheduleFlush();
      }
      if (lastEvent.event === "answer_done") {
        flushStream();
        resetStream();
        if (lastEvent.status === "error") setAnswer("");
        else if (typeof lastEvent.answer === "string") setAnswer(lastEvent.answer);
        if (lastEvent.status === "truncated") setNotice("The answer hit the length limit. Tap Explain deeper for the rest.");
      }
      if (lastEvent.event === "answer_cleared") {
        resetStream();
        setAnswer("");
        latestAnswer.current = "";
        rememberQuestion("");
        setError("");
        setNotice("");
      }
      if (lastEvent.event === "cleared") {
        resetStream();
        pendingCode.current = false;
        follow(true);
        setCaptions([]);
        setAnswer("");
        setQuestion("");
        setNextQuestion("");
        rememberQuestion("");
        setHistory([]);
        window.localStorage.removeItem(`${HISTORY_KEY}:${sessionId}`);
        setNotice("");
        setError("");
      }
      if (lastEvent.event === "room_closed" || lastEvent.event === "interview_ended") {
        resetStream();
        setStatus("closed");
        setInterviewEnded(true);
        setEndOpen(false);
        void loadEnded();
      }
      if (lastEvent.event === "error") {
        setStatus("listening");
        setError(String(lastEvent.message));
      }
    }
  }, [eventsVersion, takeEvents, flushStream, resetStream, scheduleFlush, follow, loadEnded, rememberQuestion, sessionId]);

  useEffect(() => {
    if (pendingCode.current && revealCode()) {
      pendingCode.current = false;
      return;
    }
    if (followingRef.current) scrollToLatest();
  }, [answer, revealCode, scrollToLatest]);

  // Auto-scroll the feed whenever a new outline (answer or next question) is
  // added below the sticky transcript, so the newest card is always in view.
  useEffect(() => {
    if (followingRef.current) scrollToLatest("smooth");
  }, [nextQuestion, question, history.length, scrollToLatest]);

  // Mobile browsers can reflow streamed text after React paints (font sizing,
  // wrapping, and code blocks). Keep the answer pinned to the latest content
  // while following, even when its layout changes without a new token.
  useEffect(() => {
    const content = answerContent.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (!followingRef.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (pendingCode.current && revealCode()) {
          pendingCode.current = false;
          return;
        }
        scrollToLatest();
      });
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [answer.length > 0, revealCode, scrollToLatest]);

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
    setQuestion("");
    setError("");
    setStatus("thinking");
    setNotice("");
    follow(shouldAutoFollowAnswer());
    pendingCode.current = action === "code_example";
    setNextQuestion("");
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

  const transcriptLines = (lines: Caption[]) => lines.map((line) => (
    line.timestamp ? `${clock(line.timestamp)}  ${line.text}` : line.text
  ));

  const downloadCaptions = (lines: Caption[], answers: HistoryEntry[], title: string) => {
    const header = [
      "STEALTH CO-PILOT - INTERVIEW CAPTIONS",
      "",
      `Role: ${title}`,
      `Saved: ${new Date().toLocaleString()}`,
      "",
      "LIVE TRANSCRIPT",
      transcriptLines(lines).join("\n") || "No captions were captured.",
    ];
    if (answers.length) {
      header.push("", "AI ANSWERS", answers.map((entry, index) => (
        `Q${index + 1} - ${entry.question}\nAnswer: ${entry.answer}`
      )).join("\n\n"));
    }
    downloadTextFile(`interview-captions-${sessionId.slice(0, 8)}.txt`, header.join("\n"));
  };

  const endedLines = endedTranscript.length ? endedTranscript : captions;
  const endedAnswers = [
    ...history.slice().reverse(),
    ...(answer.trim() ? [{ id: Date.now(), question: currentAnswerQuestion.current || question, answer }] : []),
  ];
  const answeredTurns = history.slice().reverse();

  const endInterview = async () => {
    setEnding(true);
    setEndError("");
    try {
      // No pairing code on the phone: the session link is the credential.
      const response = await fetch(`${backendHttpBase()}/api/session/${sessionId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not end this interview.");
      setEndOpen(false);
      setStatus("closed");
      setInterviewEnded(true);
      void loadEnded();
    } catch (err) {
      setEndError(err instanceof Error ? err.message : "Could not end this interview.");
    } finally {
      setEnding(false);
    }
  };

  // The answer card already prints the question it answers, so the same text
  // must never show up again underneath it as "Next question".
  const activeQuestion = answerQuestion || question;
  const busy = status === "thinking" || status === "streaming";
  const pendingQuestion = answer || busy
    ? nextQuestion.trim() && nextQuestion.trim() !== activeQuestion.trim() ? nextQuestion : ""
    : question;
  const actionsDisabled = !connected || !captions.length || busy;
  const hint = !connected
    ? "Reconnecting to your interview room…"
    : captionState === "off"
      ? "Live caption is off. Start captions in the desktop app."
      : !captions.length
        ? "Waiting for the interviewer's first caption before Ask AI unlocks."
        : "";

  if (interviewEnded) {
    const endedTitle = endedInfo?.job_title || "This interview";
    return (
      <main className="app-aurora relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-10">
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="animate-drift absolute -left-24 top-0 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
          <div className="animate-drift absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
        </div>
        <div className="absolute right-4 top-4 z-10">
          <ThemeToggle />
        </div>
        <section className="glass-flat animate-pop-in relative w-full max-w-md rounded-[30px] p-6 text-center sm:p-8">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <CheckCircle2 size={28} aria-hidden="true" />
          </span>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Stealth Co-Pilot</p>
          <h1 className="text-glow mt-1.5 text-2xl font-bold tracking-tight">Interview Ended</h1>
          <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
            {endedTitle} · {endedInfo?.ended_at ? new Date(endedInfo.ended_at).toLocaleString() : "just now"}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {[
              { label: "Duration", value: formatDuration(endedInfo?.duration_seconds || 0) },
              { label: "Questions", value: String(endedInfo?.questions ?? answeredTurns.length) },
              { label: "Captions", value: String(endedInfo?.captions ?? endedLines.length) },
            ].map((stat) => (
              <div key={stat.label} className="glass-soft rounded-2xl px-2 py-3">
                <p className="line-time text-sm font-bold text-foreground">{stat.value}</p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => downloadCaptions(endedLines, endedAnswers, endedTitle)}
            disabled={!endedLines.length && !endedAnswers.length}
            className="press mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-[0_18px_40px_-18px_var(--glow)] transition-[filter,box-shadow] hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40"
          >
            <Download size={17} aria-hidden="true" />
            Download captions
          </button>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            The full transcript and every AI answer stay saved in Interview History on your desktop.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-aurora relative flex h-[100dvh] flex-col overflow-hidden text-foreground">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="animate-drift absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="animate-drift absolute -right-24 top-1/4 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <header className="glass-flat safe-top sticky top-0 z-30 flex shrink-0 items-center justify-between gap-2 rounded-b-2xl px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_10px_24px_-12px_var(--glow)]">
            <Bot size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase leading-tight tracking-[0.12em]">
              <span className="text-muted-foreground">Stealth</span> <span className="text-foreground">Co-Pilot</span>
            </p>
            <StatusIndicator state={status} connected={connected} captionState={captionState} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Open AI settings"
            title="AI settings"
            className="press inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Settings2 size={15} aria-hidden="true" />
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            disabled={!history.length && !answer && !captions.length}
            aria-label="Open answer history"
            className="press inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card/60 px-2 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <History size={14} aria-hidden="true" />
            {history.length}
          </button>
          <button
            type="button"
            onClick={() => { setEndOpen(true); setEndError(""); }}
            aria-label="End interview"
            title="End interview"
            className="press inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-2.5 text-[11px] font-bold text-rose-300 transition-colors hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PhoneOff size={14} aria-hidden="true" />
            <span className="hidden sm:inline">End</span>
          </button>
        </div>
      </header>

      {!connected ? (
        <div className="mx-3 mt-2 flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-300">
          <WifiOff size={12} aria-hidden="true" />
          Reconnecting to the interview room…
        </div>
      ) : null}

      <div
        ref={feedBox}
        onScroll={(event) => {
          const element = event.currentTarget;
          const gap = element.scrollHeight - element.scrollTop - element.clientHeight;
          // A little hysteresis: a 40px nudge must not flip the follow pill on.
          if (gap < 64 && !followingRef.current) follow(true);
          else if (gap > 240 && followingRef.current) follow(false);
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2.5 px-3 py-3 pb-6 sm:px-5">
        <div className="sticky top-0 z-20 -mx-3 space-y-2 bg-background px-3 pb-2 pt-2 shadow-[0_12px_24px_-20px_rgba(0,0,0,0.85)] sm:-mx-5 sm:px-5">
        {captionState !== "on" ? (
          <div className="animate-fade-up flex items-start gap-2.5 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300">
              <VolumeX size={14} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-rose-200">
                Live caption {captionState === "paused" ? "paused" : "off"}
              </p>
              <p className="mt-0.5 text-[11px] leading-5 text-rose-200/75">
                {captionState === "paused"
                  ? "Captions are paused on the desktop app. Resume them to keep this transcript growing."
                  : "Start live captions in the desktop app so the interviewer's words appear here."}
              </p>
            </div>
          </div>
        ) : null}

        <section
          aria-label="Live interviewer captions"
          className="animate-fade-up overflow-hidden rounded-3xl border border-border/50 bg-transparent"
        >
          <SectionHeader
            icon={<Captions size={13} className="text-primary" aria-hidden="true" />}
            label="Live transcript"
            live={captionState === "on" && connected}
          >
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="line-time rounded-full border border-border bg-background/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                {captions.length ? `${captions.length} ${captions.length === 1 ? "line" : "lines"}` : "Automatic"}
              </span>
              <button
                type="button"
                onClick={() => downloadCaptions(captions, [], endedInfo?.job_title || "Interview")}
                disabled={!captions.length}
                aria-label="Download live transcript"
                title="Download live transcript"
                className="press inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <Download size={13} aria-hidden="true" />
              </button>
            </div>
          </SectionHeader>
          <div
            ref={captionBox}
            onScroll={(event) => {
              const element = event.currentTarget;
              const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 32;
              captionFollowingRef.current = atBottom;
              setCaptionFollowing(atBottom);
              if (atBottom) setNewCaptions(false);
            }}
            className="max-h-[26dvh] min-h-[86px] overflow-x-hidden overflow-y-auto overscroll-contain border-t border-border/60 px-2 py-2"
            aria-live="polite"
          >
            {captions.length ? (
              <ol className="space-y-0.5">
                {captions.map((caption, index) => {
                  const latest = index === captions.length - 1;
                  return (
                    <li
                      key={caption.id}
                      className={`flex gap-2.5 rounded-xl px-2 py-1.5 transition-colors ${latest ? "bg-primary/[0.06]" : "hover:bg-muted/40"}`}
                    >
                      <span className="line-time shrink-0 pt-[3px] text-[9.5px] font-medium text-muted-foreground/60">{clock(caption.timestamp)}</span>
                      <p className={`min-w-0 flex-1 text-[13px] leading-[1.55] [overflow-wrap:anywhere] ${latest ? "font-semibold text-foreground" : "font-medium text-muted-foreground/85"}`}>
                        {caption.text}
                      </p>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="flex h-full min-h-[76px] flex-col items-center justify-center gap-1.5 px-4 text-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                  <Mic size={15} aria-hidden="true" />
                </span>
                <p className="text-[12.5px] font-semibold text-foreground">
                  {connected ? "Listening for the interviewer" : "Connecting to your room"}
                </p>
                <p className="max-w-[30ch] text-[11px] leading-5 text-muted-foreground">
                  {connected
                    ? captionState === "on"
                      ? "Each caption appears here with the time it was spoken."
                      : "Captions start appearing the moment you start live captions on the desktop."
                    : "Keep this page open — captions resume automatically."}
                </p>
              </div>
            )}
          </div>
          {!captionFollowing ? (
            <button
              type="button"
              onClick={scrollCaptionsToLatest}
              className="press mx-auto mb-2 flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-1 text-[11px] font-medium text-foreground shadow-lg backdrop-blur transition-colors hover:bg-muted"
            >
              <ChevronDown size={12} aria-hidden="true" />
              {newCaptions ? "New captions" : "Latest"}
            </button>
          ) : null}
        </section>
        </div>

        {/* One answer slot only: each new answer replaces the previous one here,
            and the old ones stay reachable through Answer history. */}
        {answer || busy ? (
          <section aria-label="Suggested interview response" className="glass-flat animate-fade-up overflow-hidden rounded-3xl ring-1 ring-primary/20">
            <SectionHeader
              icon={<Sparkles size={11} className="text-primary" aria-hidden="true" />}
              label="Suggested response"
              tone="primary"
            >
              <div className="flex items-center gap-1">
                {status === "streaming" ? (
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
                    Streaming
                  </span>
                ) : status === "thinking" ? (
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-sky-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" aria-hidden="true" />
                    Thinking
                  </span>
                ) : (
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Ready</span>
                )}
                <div className="ml-1 flex items-center rounded-lg border border-border bg-background/40 p-0.5">
                  <button
                    aria-label="Decrease answer text size"
                    onClick={() => changeFont(-1)}
                    disabled={fontSize <= MIN_FONT}
                    className="press flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                  >
                    <Minus size={11} aria-hidden="true" />
                  </button>
                  <span className="line-time w-5 text-center text-[10px] font-bold text-foreground">{fontSize}</span>
                  <button
                    aria-label="Increase answer text size"
                    onClick={() => changeFont(1)}
                    disabled={fontSize >= MAX_FONT}
                    className="press flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                  >
                    <Plus size={11} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </SectionHeader>
            <div className="px-4 py-3.5" aria-live="polite">
              {answerQuestion || question ? (
                <>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Question</p>
                  <p className="mt-0.5 text-[12.5px] font-bold leading-5 text-foreground/90">
                    {answerQuestion || question}
                  </p>
                  <div className="my-2.5 border-t border-border/50" />
                </>
              ) : null}
              <div ref={answerContent} className="min-w-0">
                {answer ? (
                  <TeleprompterStream answer={answer} fontSize={fontSize} streaming={status === "streaming"} />
                ) : (
                  <p className="flex items-center gap-2 py-1 text-[12.5px] font-semibold text-muted-foreground">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
                    Preparing the answer…
                  </p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {pendingQuestion ? (
          <section aria-label="Next interview question" className="glass-flat animate-fade-up overflow-hidden rounded-3xl border-l-2 border-l-primary">
            <SectionHeader
              icon={<Mic size={12} className="text-primary" aria-hidden="true" />}
              label="Next question"
              tone="primary"
            >
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-primary">
                Ask AI
              </span>
            </SectionHeader>
            <p className="px-4 pb-3.5 pt-2.5 text-[13px] font-semibold leading-6 text-foreground/90">{pendingQuestion}</p>
          </section>
        ) : null}

        {!answer && !question ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-3xl px-6 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card/60 text-primary">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <p className="text-[13px] font-semibold text-foreground">No answer yet</p>
            <p className="max-w-[34ch] text-[11.5px] leading-5 text-muted-foreground">
              Captions are transcribed live. Tap <span className="font-semibold text-foreground">Ask AI</span> for a clear,
              tailored answer in easy spoken words.
            </p>
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="animate-fade-up rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2 text-[11.5px] leading-5 text-rose-300">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div role="status" className="animate-fade-up rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2 text-[11.5px] leading-5 text-amber-200">
            {notice}
          </div>
        ) : null}
      </div>
      </div>



      {codeOpen ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitCodeTopic();
          }}
          className="glass-flat mx-auto w-full max-w-2xl shrink-0 rounded-t-2xl px-3 py-2.5 sm:rounded-2xl sm:px-4"
        >
          <label htmlFor="code-topic" className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Which code example?
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="code-topic"
              autoFocus
              value={codeTopic}
              onChange={(event) => setCodeTopic(event.target.value)}
              placeholder="e.g. token bucket rate limiter in Python"
              className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60"
            />
            <button
              type="submit"
              className="press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Sparkles size={13} aria-hidden="true" />
              Get code
            </button>
            <button
              type="button"
              onClick={() => setCodeOpen(false)}
              aria-label="Cancel code example request"
              className="press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </form>
      ) : null}

      <QuickActionButtons
        disabled={actionsDisabled}
        hint={hint || undefined}
        onJumpToLatest={
          !following && answer
            ? () => {
                follow(true);
                scrollToLatest("smooth");
              }
            : undefined
        }
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

      {endOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <section role="dialog" aria-modal="true" aria-labelledby="end-interview-title" className="glass-strong animate-pop-in w-full max-w-md rounded-3xl p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/10 text-rose-300">
                <PhoneOff size={18} aria-hidden="true" />
              </span>
              <div>
                <h2 id="end-interview-title" className="text-base font-bold text-foreground">End Interview</h2>
                <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                  This ends the interview on your phone and the desktop app. The transcript and AI answers are saved to
                  Interview History, and you can download the captions right away.
                </p>
              </div>
            </div>
            {endError ? <p role="alert" className="mt-3 text-[11.5px] leading-5 text-rose-300">{endError}</p> : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setEndOpen(false)}
                className="press h-11 flex-1 rounded-xl border border-border text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={endInterview}
                disabled={ending}
                className="press inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <PhoneOff size={14} aria-hidden="true" />
                {ending ? "Ending…" : "End Interview"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-settings-title"
            className="glass-strong animate-fade-up max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl"
          >
            <header className="flex items-center justify-between border-b border-border/60 px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/60 text-primary">
                  <Settings2 size={15} aria-hidden="true" />
                </span>
                <div>
                  <h2 id="ai-settings-title" className="text-sm font-bold text-foreground">AI answer settings</h2>
                  <p className="text-[11px] text-muted-foreground">Choose a Groq model and your speaking style.</p>
                </div>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                aria-label="Close AI settings"
                className="press inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <div className="space-y-5 px-4 py-5">
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
                    {settingsLoading ? "Loading models…" : "Refresh models"}
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
                  className="h-11 w-full rounded-xl border border-border bg-background/60 px-3 text-sm text-foreground outline-none focus:border-primary/60 disabled:opacity-60"
                >
                  {modelOptions.length ? modelOptions.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.id}{model.context_window ? ` · ${Number(model.context_window).toLocaleString()} context` : ""}
                    </option>
                  )) : <option value="">{settingsLoading ? "Loading active models…" : "No models loaded"}</option>}
                </select>
                {settingsError ? <p role="alert" className="mt-2 text-[11.5px] leading-5 text-rose-300">{settingsError}</p> : null}
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  Active text-generation models from your Groq account. The API key stays on the backend.
                </p>
              </div>
              <div>
                <label htmlFor="extra-answer-context" className="text-xs font-semibold text-foreground">Extra answer context</label>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  Add preferences such as “use simple English”, “keep it under 30 seconds”, or a detail the answer should focus on.
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
                  placeholder="Use simple words and answer in 3–4 short sentences…"
                  className="mt-2 w-full resize-y rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/60"
                />
                <p className="line-time mt-1 text-right text-[10px] text-muted-foreground">{additionalContext.length}/3000</p>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setAdditionalContext("");
                    window.localStorage.removeItem(`${CONTEXT_KEY}:${sessionId}`);
                  }}
                  className="text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear extra context
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="press h-10 rounded-xl bg-primary px-4 text-[12px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Done
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {historyOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md">
          <header className="glass-flat flex h-16 shrink-0 items-center justify-between gap-3 rounded-b-2xl px-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/60 text-primary">
                <History size={16} aria-hidden="true" />
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
                onClick={() => downloadCaptions(captions, history.slice().reverse(), endedInfo?.job_title || "Interview")}
                className="press inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-2.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Download size={14} aria-hidden="true" />
                Download
              </button>
              <button
                onClick={() => setHistoryOpen(false)}
                aria-label="Close answer history"
                className="press inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
            <div className="mx-auto max-w-2xl space-y-3">
              {history.length ? (
                history.map((entry) => (
                  <article key={entry.id} className="glass-flat rounded-2xl p-3.5">
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Asked</p>
                    <p className="mt-1 text-[13px] font-semibold leading-6 text-foreground">{entry.question}</p>
                    <div className="mt-3 border-t border-border/60 pt-3">
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
