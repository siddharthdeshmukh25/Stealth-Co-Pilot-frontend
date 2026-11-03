"use client";
import { useRef, useState } from "react";

export type ResumeInfo = { id: number; name: string; structured: { core_skills?: string[]; [key: string]: unknown } };
export default function ResumeUploader({ onUploaded }: { onUploaded: (resume: ResumeInfo) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  const input = useRef<HTMLInputElement>(null);
  async function upload(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Choose a PDF file."); return; }
    setBusy(true); setError("");
    try {
      const body = new FormData(); body.append("file", file);
      const backend = process.env.NEXT_PUBLIC_BACKEND_URL || `http://${window.location.hostname}:8000`;
      const response = await fetch(`${backend}/api/resume/upload`, { method: "POST", body });
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || "Resume upload failed.");
      setResume(data); onUploaded(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Resume upload failed."); }
    finally { setBusy(false); }
  }
  return <div>
    <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
    <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); }} className="w-full rounded-2xl border border-dashed border-input bg-card px-5 py-8 text-left transition hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary text-primary">⇧</span>
      <strong className="block text-sm text-foreground">{busy ? "Parsing resume…" : resume ? `✓ ${resume.name}` : "Drop Resume PDF here"}</strong>
      <span className="mt-1 block text-xs text-muted-foreground">PDF up to 12 MB · stored in your local SQLite database</span>
      {resume?.structured.core_skills?.length ? <span className="mt-4 flex flex-wrap gap-2">{resume.structured.core_skills.slice(0, 10).map((skill) => <i key={skill} className="not-italic rounded-full border border-border px-2 py-1 text-xs text-primary">{skill}</i>)}</span> : null}
    </button>
    {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
  </div>;
}

