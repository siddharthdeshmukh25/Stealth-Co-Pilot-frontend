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

// Desktop browsers get the popup: the account picker runs in a window that Google
// already trusts, and the signed-in session is written by this page itself, so it
// survives third-party storage blocking. Redirect stays for phones, where popups
// are unreliable.
const POPUP_FALLBACK = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

const SILENT_CODES = new Set([
  "auth/cancelled-popup-request",
  "auth/popup-closed-by-user",
  "auth/user-cancelled",
]);

function googleProvider() {
  const provider = new GoogleAuthProvider();
  // Always let the user pick the account instead of silently reusing one.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

function prefersRedirect() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function errorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let active = true;
    const auth = firebaseAuth();
    // Completes a redirect sign-in that came back from Google; failures used to be
    // swallowed here, which is why a broken sign-in showed no message at all.
    getRedirectResult(auth).catch((error: unknown) => {
      if (!active || SILENT_CODES.has(errorCode(error))) return;
      setAuthError(authErrorMessage(error));
    });
    const unsubscribe = onAuthStateChanged(auth, (next) => {
      if (!active) return;
      setUser(next);
      setLoading(false);
      if (next) setAuthError("");
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const auth = firebaseAuth();
    setAuthError("");
    if (prefersRedirect()) {
      await signInWithRedirect(auth, googleProvider());
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider());
    } catch (error) {
      if (POPUP_FALLBACK.has(errorCode(error))) {
        // Popup refused: fall back to a redirect so the click still does something.
        await signInWithRedirect(auth, googleProvider());
        return;
      }
      throw new Error(authErrorMessage(error));
    }
  }, []);

  const signOutNow = useCallback(async () => {
    await signOut(firebaseAuth());
  }, []);

  return { user, loading, authError, signInWithGoogle, signOut: signOutNow };
}
