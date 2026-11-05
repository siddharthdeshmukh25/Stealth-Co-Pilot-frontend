import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/** Firebase project used for email/password accounts on the web app and the EXE. */
// Stay on Firebase's own authDomain: Google only accepts a redirect URI that is
// registered for the OAuth client, and `firebaseapp.com/__/auth/handler` already
// is. Pointing this at the site's own host needs that URI registered in Google
// Cloud Console first, otherwise Google answers with `redirect_uri_mismatch`.
// Sign-in therefore runs in a popup (see useAuth), which keeps the session
// first-party and works without any console change.
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDVWKY0h8eFXuNWnAssorpenLX2UgeQnPM",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "stealth-co-pilot.firebaseapp.com",
  projectId: "stealth-co-pilot",
  storageBucket: "stealth-co-pilot.firebasestorage.app",
  messagingSenderId: "79710562638",
  appId: "1:79710562638:web:42d546586ec1e2c459161f",
};

export function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

/** Firebase error codes turned into something a user can act on. */
export function authErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/invalid-email":
      return "That email address does not look right.";
    case "auth/email-already-in-use":
      return "An account with this email already exists — sign in instead.";
    case "auth/weak-password":
      return "Use a password with at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/network-request-failed":
      return "No internet connection. Check your network and retry.";
    case "auth/configuration-not-found":
    case "auth/operation-not-allowed":
      return "Firebase Authentication is not set up yet: open Firebase Console → Authentication → Sign-in method and enable Google.";
    case "auth/unauthorized-domain":
      return "This domain is not authorised in Firebase: add it under Authentication → Settings → Authorized domains.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google window. Allow pop-ups for this site and try again.";
    case "auth/api-key-not-valid":
    case "auth/invalid-api-key":
      return "This build has an invalid Firebase API key.";
    default:
      return error instanceof Error ? error.message : "Could not sign you in. Try again.";
  }
}
