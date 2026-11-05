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

// Sign-in goes through a full redirect everywhere: popups are blocked outright in
// in-app browsers, strict privacy modes and many desktop setups, and a blocked
// popup looked like "nothing happens" when the user clicked Google.
const POPUP_ONLY_ENVIRONMENTS = new Set([
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

function googleProvider() {
  const provider = new GoogleAuthProvider();
  // Always let the user pick the account instead of silently reusing one.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

function errorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
}

// Cancelling is a normal user action, not something to shout about.
const SILENT_CODES = new Set(["auth/cancelled-popup-request", "auth/popup-closed-by-user", "auth/user-cancelled"]);

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
    try {
      await signInWithRedirect(auth, googleProvider());
    } catch (error) {
      if (POPUP_ONLY_ENVIRONMENTS.has(errorCode(error))) {
        try {
          await signInWithPopup(auth, googleProvider());
          return;
        } catch (popupError) {
          throw new Error(authErrorMessage(popupError));
        }
      }
      throw new Error(authErrorMessage(error));
    }
  }, []);

  const signOutNow = useCallback(async () => {
    await signOut(firebaseAuth());
  }, []);

  return { user, loading, authError, signInWithGoogle, signOut: signOutNow };
}
