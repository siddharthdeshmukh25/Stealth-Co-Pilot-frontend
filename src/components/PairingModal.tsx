"use client";
import { QRCodeSVG } from "qrcode.react";

export default function PairingModal({ sessionId, code, onClose }: { sessionId: string; code: string; onClose: () => void }) {
  const base = typeof window === "undefined" ? "" : `${window.location.protocol}//${window.location.host}`;
  const url = `${base}/teleprompter/${sessionId}`;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-lg rounded-3xl border border-border bg-card p-7 text-card-foreground shadow-2xl">
    <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Live session ready</p><h2 className="mt-2 text-2xl font-semibold">Connect your devices</h2></div><button onClick={onClose} aria-label="Close" className="text-2xl text-muted-foreground">×</button></div>
    <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-sm text-muted-foreground">Enter this code in Stealth Audio Bridge</p><div className="mt-2 font-mono text-5xl font-bold tracking-[.22em] text-primary">{code.slice(0, 3)}-{code.slice(3)}</div><div className="mt-6 space-y-3 text-sm"><p>✓ Resume parsed and cached in SQLite</p><p>◷ Mobile teleprompter ready to connect</p><p>◷ Desktop audio bridge waiting</p></div></div><div className="rounded-2xl bg-white p-3"><QRCodeSVG value={url} size={132} /></div></div>
    <p className="mt-5 break-all rounded-xl bg-background p-3 text-xs text-muted-foreground">{url}</p>
  </section></div>;
}

