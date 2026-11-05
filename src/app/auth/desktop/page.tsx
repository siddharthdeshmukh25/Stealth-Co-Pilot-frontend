"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Laptop, Loader2 } from "lucide-react";
import { GoogleMark } from "@/components/AuthDialog";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hand-off page for the Windows app.
 *
 * The EXE opens this URL with a random port + state, the visitor signs in with
 * Google here, and the tokens are posted back to the loopback listener the EXE
 * is running. Nothing is stored on this page.
 */
export default function DesktopAuthPage() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [port, setPort] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [auto, setAuto] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const sentRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPort(params.get("port") || "");
    setState(params.get("state") || "");
    setAuto(params.get("auto") === "1");
  }, []);

  const handOff = useCallback(async (refreshToken: string, email: string, uid: string) => {
    if (!port || !state || sentRef.current) return;
    sentRef.current = true;
    const endpoint = `http://127.0.0.1:${port}/finish`;
    const fallback = new URL(endpoint);
    fallback.searchParams.set("state", state);
    fallback.searchParams.set("refresh_token", refreshToken);
    fallback.searchParams.set("email", email);
    fallback.searchParams.set("uid", uid);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, refresh_token: refreshToken, email, uid }),
      });
      if (!response.ok) throw new Error("rejected");
      setSent(true);
    } catch {
      // Browsers that block an https page from calling loopback still allow the
      // navigation, and the local page knows how to finish the hand-off.
      try {
        window.location.assign(fallback.toString());
      } catch {
        sentRef.current = false;
        setError("Could not reach the desktop app. Keep the app open and try again.");
      }
    }
  }, [port, state]);

  useEffect(() => {
    if (!user || !port) return;
    let active = true;
    (async () => {
      try {
        const token = user.refreshToken;
        if (!token) throw new Error("no refresh token");
        if (active) await handOff(token, user.email || "", user.uid);
      } catch {
        if (active) setError("Google returned no long-lived session. Try signing in again.");
      }
    })();
    return () => { active = false; };
  }, [user, port, handOff]);

  const startGoogle = useCallback(async () => {
    setBusy(true);
    setError("");
    if (user) await signOut();
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign you in with Google.");
    } finally {
      setBusy(false);
    }
  }, [user, signInWithGoogle, signOut]);

  // The desktop app asks for auto=1: go straight to Google instead of showing a
  // second "Continue with Google" click. Popups without a gesture are blocked,
  // so useAuth falls back to the redirect flow, which needs no click at all.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!auto || !port || loading || user || sent || autoStarted.current) return;
    autoStarted.current = true;
    void startGoogle();
  }, [auto, port, loading, user, sent, startGoogle]);

  const missingLink = !loading && !port;

  return (
    <main className="app-aurora flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <section className="glass-strong animate-pop-in w-full max-w-md rounded-3xl p-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <Laptop size={22} aria-hidden="true" />
        </span>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Stealth Co-Pilot</p>
        <h1 className="mt-1.5 text-xl font-bold tracking-tight">Sign in for the desktop app</h1>
        <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">
          Use your Google account on the same computer as the app. This tab can be closed once the app
          is signed in.
        </p>

        {missingLink ? (
          <p role="alert" className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11.5px] leading-5 text-amber-200">
            Open this page from the desktop app&apos;s Sign in button.
          </p>
        ) : sent ? (
          <div className="animate-fade-up mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-4">
            <CheckCircle2 className="mx-auto text-emerald-400" size={22} aria-hidden="true" />
            <p className="mt-2 text-[13px] font-semibold text-emerald-200">Signed in</p>
            <p className="mt-1 text-[11.5px] leading-5 text-emerald-200/80">
              You can close this tab — the desktop app is ready.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={startGoogle}
            disabled={busy || loading}
            className="press mt-6 inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white text-[13.5px] font-semibold text-[#1f1f1f] shadow-sm transition-[filter] hover:brightness-[0.98] disabled:opacity-60"
          >
            {busy || loading ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <GoogleMark />}
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>
        )}

        {error ? (
          <p role="alert" className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11.5px] leading-5 text-rose-300">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
