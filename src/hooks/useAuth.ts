"use client";
import { useCallback, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { authErrorMessage, firebaseAuth } from "@/lib/firebase";

const POPUP_FALLBACK = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

function googleProvider() {
  const provider = new GoogleAuthProvider();
  // Always let the user pick the account instead of silently reusing one.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

function prefersRedirect() {
  if (typeof navigator === "undefined") return false;
  // iOS Safari and in-app browsers block popups far more often than desktop.
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const auth = firebaseAuth();
    // Completes a redirect sign-in that came back from Google.
    getRedirectResult(auth).catch(() => undefined);
    const unsubscribe = onAuthStateChanged(auth, (next) => {
      if (!active) return;
      setUser(next);
      setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const auth = firebaseAuth();
    try {
      if (prefersRedirect()) {
        await signInWithRedirect(auth, googleProvider());
        return;
      }
      await signInWithPopup(auth, googleProvider());
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
      if (POPUP_FALLBACK.has(code)) {
        await signInWithRedirect(auth, googleProvider());
        return;
      }
      throw new Error(authErrorMessage(error));
    }
  }, []);

  const signOutNow = useCallback(async () => {
    await signOut(firebaseAuth());
  }, []);

  return { user, loading, signInWithGoogle, signOut: signOutNow };
}
