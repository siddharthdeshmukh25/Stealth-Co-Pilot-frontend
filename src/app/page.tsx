"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, Captions, CodeXml, KeyRound, Laptop, Smartphone, Sparkles } from "lucide-react";

const FRONTEND_REPO = "https://github.com/siddharthdeshmukh25/Stealth-Co-Pilot-frontend";
const BACKEND_REPO = "https://github.com/siddharthdeshmukh25/Stealth-Co-Pilot-interview-backend";

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
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <a href="#top" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-emerald-400">◉</span>
            <span className="text-sm font-semibold tracking-tight">Stealth Co-Pilot</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground sm:flex">
            <a className="transition-colors hover:text-foreground" href="#features">Features</a>
            <a className="transition-colors hover:text-foreground" href="#how">How it works</a>
            <a className="transition-colors hover:text-foreground" href="#code">Pair a phone</a>
            <a className="transition-colors hover:text-foreground" href="#source">Source</a>
          </nav>
          <a
            href="#code"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Open room <ArrowRight className="size-4" />
          </a>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden border-b border-border">
          <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[46rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-5 py-20 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:py-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[.18em] text-emerald-400">
                <Sparkles className="size-3.5" /> Interview co-pilot
              </span>
              <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
                Your interview script,
                <br />
                on the phone in front of you.
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground">
                The desktop app hears the interview, the backend writes the captions, and this page shows them on your
                phone — with one-tap AI answers from your own resume and job description. Your shared screen stays clean.
              </p>

              <form onSubmit={openRoom} id="code" className="mt-9 max-w-xl rounded-2xl border border-border bg-card p-2 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="flex flex-1 items-center gap-3 rounded-xl bg-background px-4 py-3">
                    <KeyRound className="size-4 text-muted-foreground" />
                    <input
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Pairing code · 128-255"
                      aria-label="Pairing code"
                      className="w-full bg-transparent text-base tracking-[.14em] outline-none placeholder:tracking-normal placeholder:text-muted-foreground"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-emerald-950 transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? "Checking…" : "Open my room"}
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
                No code? Scan the QR in the desktop app — the room opens straight away.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-sm">
              <div className="absolute inset-x-6 -bottom-6 h-24 rounded-[2rem] bg-emerald-500/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card">
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
                      “…so tell me about a time you had to ship a feature with half the team out sick.”
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-4">
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

        <section id="features" className="mx-auto w-full max-w-6xl px-5 py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Built for the room you are actually in</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">
            One desktop app, one backend, one phone screen. No shared browser tabs, no pop-ups on the call.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="border-y border-border bg-card/40">
          <div className="mx-auto w-full max-w-6xl px-5 py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Three steps, one minute</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n} className="rounded-2xl border border-border bg-background p-6">
                  <span className="font-mono text-xs tracking-[.2em] text-emerald-400">{step.n}</span>
                  <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 rounded-2xl border border-border bg-background p-6">
              <p className="text-sm leading-6 text-muted-foreground">
                <span className="font-semibold text-foreground">Already have a code?</span> Type it above — the room opens
                with the same captions and AI answers the QR link gives you.
              </p>
            </div>
          </div>
        </section>

        <section id="source" className="mx-auto w-full max-w-6xl px-5 py-20">
          <div className="grid gap-6 rounded-3xl border border-border bg-card p-8 md:grid-cols-[1.2fr_.8fr] md:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Open code, your hardware</h2>
              <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
                The phone app is this Next.js site, the API is FastAPI, and the desktop client is a small Python EXE. Read
                both repos, run the stack locally, or point the app at your own backend.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <a
                href={FRONTEND_REPO}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-2"><CodeXml className="size-4" /> Frontend source</span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </a>
              <a
                href={BACKEND_REPO}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-2"><CodeXml className="size-4" /> Backend source</span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Stealth Interview Co-Pilot · captions and AI answers, on your phone.</p>
          <div className="flex items-center gap-5">
            <a className="transition-colors hover:text-foreground" href={FRONTEND_REPO} target="_blank" rel="noreferrer">
              Frontend
            </a>
            <a className="transition-colors hover:text-foreground" href={BACKEND_REPO} target="_blank" rel="noreferrer">
              Backend
            </a>
            <a className="transition-colors hover:text-foreground" href="#code">
              Pair a phone
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
