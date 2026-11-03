"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Captions,
  ChevronDown,
  History,
  Mic,
  Minus,
  Plus,
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

type Caption = { id: number; text: string };
type HistoryEntry = { id: number; question: string; answer: string };

const MIN_FONT = 15;
const MAX_FONT = 24;
const FONT_KEY = "copilot:font-size";

export default function TeleprompterPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  const { connected, lastEvent, send } = useWebSocket(sessionId);
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeTopic, setCodeTopic] = useState("");

  const answerBox = useRef<HTMLDivElement>(null);
  const answerContent = useRef<HTMLDivElement>(null);
  const captionBox = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const pendingCode = useRef(false);
  const [following, setFollowing] = useState(true);
  const streamBuffer = useRef("");
  const streamFrame = useRef<number | null>(null);
  const streamTimer = useRef<number | null>(null);
  const latestQuestion = useRef("");
  const latestAnswer = useRef("");

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
  }, []);

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.event === "status") setStatus(String(lastEvent.state));
    if (lastEvent.event === "caption") {
      setCaptions((current) => [...current, { id: Date.now() + current.length, text: String(lastEvent.text) }].slice(-40));
      setError("");
    }
    if (lastEvent.event === "snapshot") {
      const restored = Array.isArray(lastEvent.captions) ? lastEvent.captions.map(String) : [];
      if (restored.length) setCaptions(restored.map((text, index) => ({ id: Date.now() + index, text })));
      if (lastEvent.question) setQuestion(String(lastEvent.question));
      if (lastEvent.batch) setAskedBatch(String(lastEvent.batch));
      if (lastEvent.answer) setAnswer(String(lastEvent.answer));
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
      if (previous) {
        const entry: HistoryEntry = {
          id: Date.now(),
          question: latestQuestion.current || "Previous question",
          answer: previous,
        };
        setHistory((entries) => [entry, ...entries].slice(0, 30));
      }
      resetStream();
      setAnswer("");
      setError("");
      setNotice("");
      setCodeOpen(false);
      setQuestion(String(lastEvent.text || ""));
      if (lastEvent.batch) setAskedBatch(String(lastEvent.batch));
      follow(true);
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
      if (typeof lastEvent.answer === "string") setAnswer(lastEvent.answer);
      if (lastEvent.status === "truncated") setNotice("The answer hit the length limit. Tap Explain deeper for the rest.");
    }
    if (lastEvent.event === "cleared") {
      resetStream();
      pendingCode.current = false;
      follow(true);
      setCaptions([]);
      setAnswer("");
      setQuestion("");
      setAskedBatch("");
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
      setError("This interview room is closed. Its transcript, answers, and unshared resume data were deleted.");
    }
    if (lastEvent.event === "error") setError(String(lastEvent.message));
  }, [lastEvent, flushStream, resetStream, scheduleFlush, follow]);

  useEffect(() => {
    const box = answerBox.current;
    if (!box) return;
    if (pendingCode.current && revealCode()) {
      pendingCode.current = false;
      return;
    }
    if (followingRef.current) box.scrollTop = box.scrollHeight;
  }, [answer, revealCode]);

  useEffect(() => {
    const box = captionBox.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [captions.length]);

  const changeFont = (delta: number) => {
    setFontSize((current) => {
      const next = Math.min(MAX_FONT, Math.max(MIN_FONT, current + delta));
      window.localStorage.setItem(FONT_KEY, String(next));
      return next;
    });
  };

  const askAI = (action: "standard" | "explain_deeper" | "code_example" = "standard", topic = "") => {
    if (!connected || !captions.length) return;
    setNotice("");
    follow(true);
    pendingCode.current = action === "code_example";
    if (action === "standard") {
      send({ event: "ask_ai" });
      return;
    }
    send({ event: "quick_action", action, ...(topic.trim() ? { topic: topic.trim() } : {}) });
  };

  const submitCodeTopic = () => {
    setCodeOpen(false);
    askAI("code_example", codeTopic);
    setCodeTopic("");
  };

  const busy = status === "thinking" || status === "streaming";
  const actionsDisabled = !connected || !captions.length || busy;
  const hint = !connected
    ? "Reconnecting to your interview room…"
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
        </div>
      </header>

      {!connected ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-[11px] text-amber-200">
          <WifiOff size={12} aria-hidden="true" />
          Reconnecting to the interview room…
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,auto)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:grid-rows-1">
        <section
          aria-label="Live interviewer captions"
          className="flex min-h-0 max-h-[38dvh] flex-col border-b border-border/80 bg-card/25 lg:max-h-none lg:border-b-0 lg:border-r"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2.5">
            <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Captions size={13} className="text-primary" aria-hidden="true" />
              Live transcript
              {connected ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" /> : null}
            </p>
            <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {captions.length ? `${captions.length} ${captions.length === 1 ? "line" : "lines"}` : "Automatic"}
            </span>
          </div>
          <div ref={captionBox} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4" aria-live="polite">
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
                          aria-hidden="true"
                          className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${latest ? "bg-primary" : "bg-border"}`}
                        />
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
                    : "Keep this page open — captions resume automatically."}
                </p>
              </div>
            )}
          </div>
        </section>

        <section aria-label="Suggested interview response" className="flex min-h-0 flex-col bg-background">
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
                onClick={() => setHistoryOpen(true)}
                disabled={!history.length}
                aria-label="Open answer history"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                <History size={12} aria-hidden="true" />
                {history.length}
              </button>
            </div>
          </div>

          {question ? (
            <div className="flex shrink-0 items-start gap-2 border-b border-border/80 bg-primary/[0.04] px-4 py-2.5">
              <span className="mt-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-primary">
                This batch
              </span>
              <p className="max-h-32 min-w-0 flex-1 overflow-y-auto whitespace-pre-line border-l-2 border-primary/40 pl-2 text-xs leading-5 text-muted-foreground">
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
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
              aria-live="polite"
            >
              {answer ? (
                <div ref={answerContent} className="mx-auto max-w-[68ch]">
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
            onClear={() => send({ event: "clear" })}
          />
        </section>
      </div>

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
            <button
              onClick={() => setHistoryOpen(false)}
              aria-label="Close answer history"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X size={17} aria-hidden="true" />
            </button>
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
