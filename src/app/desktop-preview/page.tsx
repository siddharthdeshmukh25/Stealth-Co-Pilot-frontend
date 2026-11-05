"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft, ArrowRight, AudioLines, BriefcaseBusiness, Check, CheckCircle2,
  ChevronRight, CircleHelp, Copy, FileText, Link2, LockKeyhole, Monitor,
  Pause, Radio, ShieldCheck, Smartphone, Upload, Wifi,
} from "lucide-react";

const STEPS = ["Resume & role", "Job details", "Review room", "Phone pairing"];

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return <button onClick={onClick} aria-label={label} title={label} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition hover:border-input hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{children}</button>;
}

export default function DesktopPreviewPage() {
  const [step, setStep] = useState(0);
  const [resumeName, setResumeName] = useState("");
  const [title, setTitle] = useState("Senior Product Designer");
  const [description, setDescription] = useState("We are looking for a product designer to shape intuitive experiences across our platform. You will partner with engineering and research, define interaction patterns, and use customer insights to improve product outcomes.");
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);
  const mobileUrl = "http://192.168.1.42:3000/teleprompter/preview-room";
  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  const chooseResume = (file?: File) => { if (file) setResumeName(file.name); };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(mobileUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };

  return <main className="min-h-screen bg-background px-4 py-7 text-foreground [font-family:Inter,ui-sans-serif,system-ui,sans-serif] sm:px-8 sm:py-10">
    <div className="mx-auto max-w-[1320px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Desktop app preview</p><h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Stealth Interview Co-Pilot</h1></div>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/[.06] px-3 py-1.5 text-xs font-medium text-amber-200"><CircleHelp size={14} /> Visual preview only · no interview session is created</div>
      </div>

      <section className="overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_35px_110px_-35px_rgba(0,0,0,.9)] ring-1 ring-white/[.025]">
        <div className="flex h-12 items-center justify-between border-b border-border bg-muted px-4 sm:px-5">
          <div className="flex items-center gap-3"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><AudioLines size={16} /></div><span className="text-[13px] font-semibold text-foreground">Stealth Interview Co-Pilot</span><span className="hidden rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground sm:inline">Desktop setup</span></div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(255,255,255,.25)]" /> Local services ready</div>
        </div>

        <div className="grid min-h-[710px] md:grid-cols-[252px_minmax(0,1fr)] lg:min-h-[760px] lg:grid-cols-[278px_minmax(0,1fr)]">
          <aside className="hidden border-r border-border bg-background p-5 md:flex md:flex-col">
            <div className="rounded-2xl border border-border bg-muted p-4"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><ShieldCheck size={16} className="text-primary" /> Private by design</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Your profile and interview room stay on this computer.</p></div>
            <div className="mt-8"><p className="px-2 text-[10px] font-semibold uppercase tracking-[.17em] text-muted-foreground">SETUP FLOW</p><nav aria-label="Setup steps" className="mt-3 space-y-1">
              {STEPS.map((item, index) => <button key={item} onClick={() => { if (index <= step) setStep(index); }} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${index === step ? "bg-primary/10 text-foreground" : index < step ? "text-muted-foreground hover:bg-muted hover:text-foreground" : "text-muted-foreground"}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold ${index < step ? "border-border bg-primary/10 text-primary" : index === step ? "border-border bg-primary/10 text-primary-foreground" : "border-border bg-muted text-muted-foreground"}`}>{index < step ? <Check size={14} /> : `0${index + 1}`}</span><span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{item}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{["Your profile", "Role context", "Confirm details", "Connect phone"][index]}</span></span>{index === step && <ChevronRight size={15} className="text-primary" />}
              </button>)}
            </nav></div>
            <div className="mt-auto rounded-2xl border border-border bg-muted p-4"><div className="flex items-center gap-2 text-xs font-medium text-foreground"><LockKeyhole size={14} className="text-muted-foreground" /> Local session</div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">SQLite storage · LAN phone link · no cloud database</p></div>
          </aside>

          <div className="flex min-w-0 flex-col">
            <div className="flex items-center justify-between border-b border-border px-5 py-3 md:hidden"><span className="text-xs font-medium text-muted-foreground">Step {step + 1} of {STEPS.length}</span><span className="text-xs font-medium text-primary">{STEPS[step]}</span></div>
            <div className="h-0.5 bg-muted md:hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
            <div className="flex flex-1 flex-col px-5 py-7 sm:px-9 sm:py-9 lg:px-12">
              <div className="mb-7 hidden items-center gap-2 md:flex">{STEPS.map((item, index) => <div key={item} className="flex items-center gap-2"><span className={`h-1.5 w-10 rounded-full ${index <= step ? "bg-primary" : "bg-accent"}`} /><span className={`text-[11px] ${index === step ? "font-medium text-foreground" : "text-muted-foreground"}`}>{item}</span></div>)}</div>

              {step < 3 && <div className="max-w-[780px]">
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">{step === 0 ? "INTERVIEW PROFILE" : step === 1 ? "ROLE CONTEXT" : "READY TO CREATE"}</p>
                <h2 className="mt-2 text-[30px] font-bold leading-tight tracking-[-.035em] text-foreground sm:text-[32px]">{step === 0 ? "Set up your interview" : step === 1 ? "Add the job description" : "Review your interview room"}</h2>
                <p className="mt-2 max-w-xl text-[14px] leading-6 text-muted-foreground">{step === 0 ? "Choose the resume and role details the assistant should use for this interview." : step === 1 ? "Give the assistant the context it needs to tailor captions and answers to this role." : "Check the profile and role before creating a private room on this computer."}</p>

                {step === 0 && <div className="mt-7 space-y-6">
                  <div><label className="mb-2 block text-xs font-semibold text-foreground" htmlFor="preview-resume">Resume PDF</label><label htmlFor="preview-resume" className="group flex min-h-[116px] cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-input bg-card px-5 py-5 transition hover:border-ring hover:bg-muted focus-within:ring-2 focus-within:ring-ring"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-primary">{resumeName ? <FileText size={20} /> : <Upload size={20} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{resumeName || "Choose a resume PDF"}</span><span className="mt-1 block text-xs text-muted-foreground">{resumeName ? "Ready to use for this interview" : "PDF format · up to 12 MB"}</span></span><span className="rounded-lg border border-border bg-muted px-3 py-2 text-xs font-semibold text-foreground transition group-hover:border-input">Browse files</span><input id="preview-resume" type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => chooseResume(event.target.files?.[0])} /></label><p className="mt-2 text-[11px] text-muted-foreground">Files are processed by the local backend for this preview.</p></div>
                  <div><label className="mb-2 block text-xs font-semibold text-foreground" htmlFor="preview-title">Interview title</label><div className="relative"><BriefcaseBusiness size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input id="preview-title" value={title} onChange={(event) => setTitle(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="e.g. Senior Product Designer" /></div></div>
                </div>}

                {step === 1 && <div className="mt-7"><label className="mb-2 block text-xs font-semibold text-foreground" htmlFor="preview-jd">Job description</label><textarea id="preview-jd" value={description} onChange={(event) => setDescription(event.target.value)} rows={12} className="w-full resize-y rounded-xl border border-input bg-card px-4 py-3.5 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Paste the role description here…"/><div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>Paste the role description from the job listing.</span><span>{description.length} characters</span></div></div>}

                {step === 2 && <div className="mt-7 space-y-3"><div className="rounded-2xl border border-border bg-card p-5"><div className="grid gap-5 sm:grid-cols-[130px_1fr]"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resume</span><span className="flex items-center gap-2 text-sm text-foreground"><FileText size={16} className="text-primary" />{resumeName || "Sample-Resume.pdf (preview)"}</span><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interview title</span><span className="text-sm text-foreground">{title || "Untitled interview"}</span><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job details</span><span className="line-clamp-3 text-sm leading-6 text-muted-foreground">{description || "No job description added yet."}</span></div></div><div className="flex items-start gap-3 rounded-xl border border-border bg-primary/5 p-4"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-primary"/><p className="text-xs leading-5 text-muted-foreground">Room data is saved in the local SQLite database. Your phone connects over the same Wi-Fi network.</p></div></div>}
              </div>}

              {step === 3 && <div className="max-w-[850px]"><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">ROOM CREATED</p><h2 className="mt-2 text-[30px] font-bold leading-tight tracking-[-.035em] text-foreground sm:text-[32px]">Pair your phone</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Scan this code to open the live captions and AI answer screen on your phone.</p><div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px]"><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[.15em] text-muted-foreground">Pairing code</p><span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary"><Wifi size={12}/> Same Wi-Fi</span></div><p className="mt-3 font-mono text-[40px] font-semibold leading-none tracking-[.13em] text-primary">482-916</p><p className="mt-2 text-xs text-muted-foreground">Enter this code in the desktop audio bridge.</p><div className="mt-6 border-t border-border pt-5"><p className="mb-2 text-xs font-semibold text-foreground">Mobile link</p><div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5"><Link2 size={14} className="shrink-0 text-muted-foreground"/><span className="min-w-0 flex-1 truncate text-xs text-foreground">{mobileUrl}</span><IconButton label={copied ? "Copied" : "Copy mobile link"} onClick={copyLink}>{copied ? <Check size={15}/> : <Copy size={15}/>}</IconButton></div><p className="mt-2 text-[10px] text-muted-foreground">{copied ? "Link copied to clipboard" : "Open on a phone connected to this Wi-Fi."}</p></div><div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-muted p-3"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${started ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{started ? <AudioLines size={16}/> : <Radio size={16}/>}</span><span className="min-w-0 flex-1"><span className="block text-xs font-medium text-foreground">{started ? "Live captions active" : "Audio bridge waiting"}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{started ? "Speaker audio is being transcribed" : "Start speaker capture when ready"}</span></span><span className={`h-2 w-2 rounded-full ${started ? "animate-pulse bg-primary" : "bg-muted-foreground"}`}/></div><button onClick={() => setStarted((value) => !value)} className={`mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${started ? "border border-border bg-muted text-foreground hover:bg-accent" : "bg-primary text-primary-foreground shadow-[0_8px_24px_-12px_rgba(255,255,255,.24)] hover:bg-primary/90"}`}>{started ? <Pause size={16}/> : <AudioLines size={16}/>} {started ? "Pause captions" : "Start live captions"}</button></section><section className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-5"><div className="rounded-2xl bg-white p-3 shadow-[0_12px_40px_-15px_rgba(0,0,0,.7)]"><QRCodeSVG value={mobileUrl} size={184} level="M" includeMargin /></div><p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-foreground"><Smartphone size={14} className="text-primary"/> Scan with your phone</p><p className="mt-1 text-[10px] text-muted-foreground">QR code · mobile interview room</p></section></div><div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck size={13}/> Captions and AI answers go to your phone; speaker audio stays on the desktop-to-backend path.</div></div>}

              <footer className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-5">
                <div className="text-[11px] text-muted-foreground">{step < 3 ? <span className="inline-flex items-center gap-1.5"><Monitor size={13}/> Local desktop setup</span> : <span className="inline-flex items-center gap-1.5"><Smartphone size={13}/> Mobile room ready</span>}</div>
                {step < 3 && <div className="flex items-center gap-2">{step > 0 && <button onClick={() => setStep((value) => value - 1)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-muted px-4 text-xs font-semibold text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft size={14}/> Back</button>}<button onClick={() => { if (step === 0 && !title.trim()) return; if (step === 1 && description.trim().length < 20) return; setStep((value) => value + 1); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{step === 2 ? "Create interview room" : "Continue"}<ArrowRight size={14}/></button></div>}
                {step === 3 && <button onClick={() => setStep(0)} className="rounded-xl border border-border bg-muted px-4 py-2.5 text-xs font-semibold text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">New interview</button>}
              </footer>
            </div>
          </div>
        </div>
      </section>
      <p className="mt-4 text-center text-xs text-muted-foreground">Preview URL: <span className="font-mono text-muted-foreground">/desktop-preview</span> · Sample room and pairing data are for visual review only.</p>
    </div>
  </main>;
}
