"use client";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  open: boolean;
  onClose: () => void;
  onSignedIn?: () => void;
  /** Copy shown under the title, e.g. "Sign in to download the desktop app". */
  reason?: string;
};

export default function AuthDialog({ open, onClose, onSignedIn, reason }: Props) {
  const { signInWithGoogle, authError } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // A redirect sign-in that fails comes back to the page, not to this click, so the
  // hook's message has to be shown too or the failure looks silent.
  const shown = error || authError;

  useEffect(() => {
    if (open) setError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle();
      // Popup sign-in resolves here; redirect sign-in lands back on the page signed in.
      onSignedIn?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign you in with Google.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="glass-strong animate-pop-in relative w-full max-w-md rounded-3xl p-5 sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="press absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={16} aria-hidden="true" />
        </button>

        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <ShieldCheck size={19} aria-hidden="true" />
        </span>
        <h2 id="auth-title" className="mt-4 text-lg font-bold tracking-tight">
          Continue with Google
        </h2>
        <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
          {reason || "One Google account works on this web app and the desktop app."}
        </p>

        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="press mt-5 inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white text-[13.5px] font-semibold text-[#1f1f1f] shadow-sm transition-[filter,transform] hover:brightness-[0.98] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={17} className="animate-spin" aria-hidden="true" />
          ) : (
            <GoogleMark />
          )}
          {busy ? "Opening Google…" : "Sign in with Google"}
        </button>

        {shown ? (
          <p role="alert" className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11.5px] leading-5 text-rose-300">
            {shown}
          </p>
        ) : null}

        <p className="mt-3 text-center text-[10.5px] leading-4 text-muted-foreground">
          Google handles the sign-in. We only receive your name, email and photo.
        </p>
      </section>
    </div>
  );
}

/** Official four-colour Google mark, drawn inline so it works offline. */
export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
