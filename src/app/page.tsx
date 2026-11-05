"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Captions,
  Check,
  Download,
  KeyRound,
  Laptop,
  LogOut,
  MonitorDown,
  Smartphone,
  Sparkles,
  UserRound,
} from "lucide-react";
import AuthDialog, { GoogleMark } from "@/components/AuthDialog";
import { useAuth } from "@/hooks/useAuth";

// GitHub always serves the newest release asset behind "latest", so this link
// never goes stale after a new desktop build is published.
const DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_DOWNLOAD_URL ||
  "https://github.com/siddharthdeshmukh25/Stealth-Co-Pilot-desktop/releases/latest/download/StealthInterviewCoPilot.exe";
// Kept in step with desktop-client/src/version.py; the app updates itself in place.
const DESKTOP_VERSION = "1.1.0";
const DESKTOP_SIZE = "162 MB";
const DOWNLOAD_INTENT = "copilot:download-intent";

// Storage can throw in private mode / embedded browsers; the download must still work.
function intent(action: "read" | "set" | "clear") {
  try {
    if (action === "set") window.sessionStorage.setItem(DOWNLOAD_INTENT, "1");
    else if (action === "clear") window.sessionStorage.removeItem(DOWNLOAD_INTENT);
    else return window.sessionStorage.getItem(DOWNLOAD_INTENT) === "1";
  } catch {
    /* ignore blocked storage */
  }
  return false;
}

const FEATURES = [
  {
    icon: Captions,
    title: "Live captions",
    body: "Whatever is said in the interview streams to your phone as clean, readable text in near real time.",
  },
  {
    icon: Bot,
    title: "AI answers",
    body: "Tap Ask AI for a short, structured answer built from your resume and the job description you loaded.",
  },
  {
    icon: Smartphone,
    title: "Phone as second screen",
    body: "Your laptop runs the room, the phone shows the script. Nothing appears on the shared screen.",
  },
  {
    icon: Laptop,
    title: "Runs from the desktop app",
    body: "The desktop EXE captures speaker audio, sends it to the backend, and keeps your session data in one place.",
  },
];

const STEPS = [
  { n: "01", title: "Create the room", body: "Open the desktop app, add your resume and job details, then review the room." },
  { n: "02", title: "Pair your phone", body: "Scan the QR code, open the mobile link, or type the 6-digit pairing code right here." },
  { n: "03", title: "Start live captions", body: "Captions and AI answers arrive on the phone while the interview keeps running on your laptop." },
];

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [downloadPending, setDownloadPending] = useState(false);

  const startDownload = () => {
    intent("clear");
    window.location.href = DOWNLOAD_URL;
  };

  // A Google redirect sign-in comes back to this page already signed in; finish
  // the download the visitor originally asked for.
  useEffect(() => {
    if (user && intent("read")) startDownload();
  }, [user]);

  // The EXE is members-only: the download button signs the visitor in with
  // Google first and then continues straight into the installer download.
  const requestDownload = () => {
    if (user) {
      startDownload();
      return;
    }
    intent("set");
    setDownloadPending(true);
    setAuthOpen(true);
  };

  const openAuth = () => {
    intent("clear");
    setDownloadPending(false);
    setAuthOpen(true);
  };

  async function openRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Enter the 6-digit pairing code shown in the desktop app.");
      return;
    }
    const base = (
      process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "")
    ).replace(/\/$/, "");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${base}/api/session/pairing/${digits}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "That room could not be found.");
      }
      router.push(`/teleprompter/${data.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That room could not be found.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#0B0D0E] text-white [--background:#0B0D0E] [--card:#141719] [--border:rgba(255,255,255,0.09)]">
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#0B0D0E]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[64px] w-full max-w-7xl items-center justify-between gap-2 px-4 sm:h-[72px] sm:px-8">
          <a href="#top" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#141719] text-[#19C994] sm:h-10 sm:w-10"><Sparkles className="size-[17px]" /></span>
            <span className="truncate whitespace-nowrap text-[13px] font-semibold tracking-[-0.02em] sm:text-[15px]">Stealth Co-Pilot</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground sm:flex">
            <a className="transition-colors hover:text-foreground" href="#features">Features</a>
            <a className="transition-colors hover:text-foreground" href="#how">How it works</a>
            <a className="transition-colors hover:text-foreground" href="#code">Pair a phone</a>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {authLoading ? (
              <span className="h-10 w-10 animate-pulse rounded-xl bg-white/5 sm:w-24" aria-hidden="true" />
            ) : user ? (
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 sm:inline-flex">
                  <UserRound className="size-3.5 text-[#19C994]" />
                  <span className="max-w-[160px] truncate">{user.displayName || user.email}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  aria-label="Sign out"
                  title="Sign out"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={openAuth}
                aria-label="Sign in with Google"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/[0.06] hover:text-white sm:px-3.5"
              >
                <GoogleMark size={15} /> <span className="hidden sm:inline">Sign in</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden border-b border-white/[0.08]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_72%_42%,rgba(25,201,148,0.08),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.055] [background-image:linear-gradient(rgba(148,163,184,0.24)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.24)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
          <div className="relative mx-auto grid w-full max-w-7xl gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:gap-20 lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3.5 py-2 text-xs font-medium text-slate-200">
                <Sparkles className="size-3.5 text-[#19C994]" /> Interview co-pilot
              </span>
              <h1 className="mt-7 max-w-[680px] text-[clamp(2.65rem,5.4vw,4.35rem)] font-semibold leading-[1.04] tracking-[-0.055em]">
                Your interview script, right on your <span className="text-[#19C994]">phone.</span>
              </h1>
              <p className="mt-5 max-w-[610px] text-base leading-7 text-slate-400 sm:text-[17px] sm:leading-8">
                The desktop app hears the interview, the backend writes the captions, and this page shows them on your
                phone - with one-tap AI answers from your own resume and job description. Your shared screen stays clean.
              </p>

              <form onSubmit={openRoom} id="code" className="mt-9 max-w-xl rounded-2xl border border-white/[0.09] bg-[#141719] p-2 shadow-[0_18px_55px_-42px_rgba(0,0,0,0.8)]">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="flex flex-1 items-center gap-3 rounded-xl bg-background px-4 py-3">
                    <KeyRound className="size-4 text-muted-foreground" />
                    <input
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Pairing code - 128-255"
                      aria-label="Pairing code"
                      className="w-full bg-transparent text-base tracking-[.14em] outline-none placeholder:tracking-normal placeholder:text-muted-foreground"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 min-h-12 rounded-xl bg-[#19C994] px-5 py-3 text-sm font-semibold text-[#06291F] transition-colors duration-200 hover:bg-[#27d8a4] disabled:opacity-60"
                  >
                    {busy ? "Checking..." : "Open my room"}
                    {!busy && <ArrowRight className="size-4" />}
                  </button>
                </div>
                {error ? (
                  <p className="px-3 pb-1 pt-2 text-xs text-destructive">{error}</p>
                ) : (
                  <p className="px-3 pb-1 pt-2 text-xs text-muted-foreground">
                    Six digits, exactly as the desktop app shows them. A fresh code is valid for 10 minutes.
                  </p>
                )}
              </form>

              <p className="mt-4 text-xs text-muted-foreground">
                No code? Scan the QR in the desktop app - the room opens straight away.
              </p>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-300">
                {["Live captions", "Resume-aware answers", "Phone companion"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2"><Check className="size-4 text-[#19C994]" />{item}</span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[430px] lg:justify-self-end">
              <div className="relative overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#101314] shadow-[0_30px_80px_-48px_rgba(0,0,0,0.95)]">
                <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-white/15" />
                <div className="flex items-center justify-between border-b border-border px-5 py-3 text-[11px] uppercase tracking-[.16em] text-muted-foreground">
                  <span className="flex items-center gap-2 text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400" /> Live
                  </span>
                  <span>Room 3d6051</span>
                </div>
                <div className="space-y-5 px-5 py-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Captions</p>
                    <p className="mt-2 text-[15px] leading-7">
                      "...so tell me about a time you had to ship a feature with half the team out sick."
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#19C994]/20 bg-[#0B0D0E] p-4">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.16em] text-emerald-400">
                      <Bot className="size-3.5" /> AI answer
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Lead with the constraint, then the decision: I cut scope to the checkout path, moved analytics to a
                      follow-up, and shipped two days early with a written handover.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">Ask AI</span>
                    <span className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">Story</span>
                    <span className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">Follow-up</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Built for the room you are actually in</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">
            One desktop app, one backend, one phone screen. No shared browser tabs, no pop-ups on the call.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="group rounded-2xl border border-white/[0.08] bg-[#111516] p-5 transition-colors duration-200 hover:border-white/[0.15] hover:bg-[#14191a]">
                <span className="flex size-10 items-center justify-center rounded-xl border border-[#19C994]/10 bg-[#19C994]/[0.08] text-[#19C994]">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="border-y border-white/[0.08] bg-white/[0.015]">
          <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Three steps, one minute</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n} className="rounded-2xl border border-white/[0.08] bg-[#111516] p-6 transition-colors duration-200 hover:border-white/[0.14]">
                  <span className="font-mono text-xs tracking-[.2em] text-emerald-400">{step.n}</span>
                  <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 rounded-2xl border border-white/[0.08] bg-[#0B0D0E] p-6">
              <p className="text-sm leading-6 text-muted-foreground">
                <span className="font-semibold text-foreground">Already have a code?</span> Type it above - the room opens
                with the same captions and AI answers the QR link gives you.
              </p>
            </div>
          </div>
        </section>

        <section id="download" className="border-t border-white/[0.08]">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#19C994]/25 bg-[#19C994]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-[#19C994]">
                <MonitorDown className="size-3.5" /> Windows app
              </span>
              <h2 className="mt-5 text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.04em]">
                Download Stealth Co-Pilot for your laptop
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-7 text-muted-foreground">
                The desktop app creates the room, captures the interviewer&apos;s audio on your own PC and keeps your
                resume and interview history. One account unlocks the download and signs you in on both devices.
              </p>
              <ul className="mt-6 grid gap-2.5 text-sm text-slate-300 sm:grid-cols-2">
                {["Windows 10 / 11 (64-bit)", "Sign-in required", "Local speech model, no audio upload", "Interview history on your PC"].map((item) => (
                  <li key={item} className="inline-flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-[#19C994]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0E1112] shadow-[0_34px_90px_-46px_rgba(0,0,0,0.98)]">
              <div className="flex items-center gap-2 border-b border-white/[0.08] bg-white/[0.045] px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-[#FF5F57]" />
                <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
                <span className="size-2.5 rounded-full bg-[#28C840]" />
                <p className="ml-2 truncate text-[11px] font-medium text-slate-400">Stealth Co-Pilot — Setup</p>
                <span className="ml-auto rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  v{DESKTOP_VERSION}
                </span>
              </div>

              <div className="p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#19C994]/15 bg-[#19C994]/10 text-[#19C994]">
                    <Laptop className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">StealthInterviewCoPilot.exe</p>
                    <p className="text-xs text-muted-foreground">Windows 10 / 11 · 64-bit · {DESKTOP_SIZE}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 font-mono text-[11px] text-muted-foreground">
                  <p className="flex items-center justify-between gap-3">
                    <span>Version</span>
                    <span className="text-slate-300">{DESKTOP_VERSION} (latest)</span>
                  </p>
                  <p className="flex items-center justify-between gap-3">
                    <span>Updates</span>
                    <span className="text-slate-300">Automatic, in-app</span>
                  </p>
                  <p className="flex items-center justify-between gap-3">
                    <span>Account</span>
                    <span className="text-slate-300">Google sign-in</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={requestDownload}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#19C994] px-5 text-sm font-semibold text-[#06291F] transition-colors duration-200 hover:bg-[#27d8a4] disabled:opacity-60"
                >
                  <Download className="size-4" />
                  {user ? "Download for Windows" : "Sign in to download"}
                </button>
                <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">
                  {user
                    ? `Signed in as ${user.email}`
                    : "New here? Google creates your account the first time you sign in."}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Stealth Interview Co-Pilot - captions and AI answers, on your phone.</p>
          <div className="flex items-center gap-5">
            <a className="transition-colors hover:text-foreground" href="#download">
              Download app
            </a>
            <a className="transition-colors hover:text-foreground" href="#code">
              Pair a phone
            </a>
          </div>
        </div>
      </footer>

      <AuthDialog
        open={authOpen}
        reason={downloadPending ? "Sign in with Google to download the desktop app." : undefined}
        onClose={() => setAuthOpen(false)}
        onSignedIn={() => {
          if (downloadPending) startDownload();
          setDownloadPending(false);
        }}
      />
    </div>
  );
}
