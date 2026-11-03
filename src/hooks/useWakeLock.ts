"use client";
import { useEffect, useState } from "react";

export function useWakeLock() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    const request = async () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try { lock = await navigator.wakeLock.request("screen"); if (!disposed) setActive(true); lock.addEventListener("release", () => setActive(false)); }
      catch { setActive(false); }
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => { disposed = true; document.removeEventListener("visibilitychange", request); lock?.release(); };
  }, []);
  return active;
}

