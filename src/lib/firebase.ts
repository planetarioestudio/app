import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

export const configured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);
export const ownerEmail =
  import.meta.env.VITE_OWNER_EMAIL || "planetariomkt@gmail.com";
export const app: FirebaseApp | null = configured
  ? initializeApp(config)
  : null;
export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export function requireDb(): Firestore {
  if (!db) throw new Error("Configure o Firebase no arquivo .env.local.");
  return db;
}
