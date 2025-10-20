// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";

console.log('Firebase Config Check:', {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Set' : 'Missing',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'Set' : 'Missing',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Set' : 'Missing',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? 'Set' : 'Missing',
});

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Initialize (or reuse) the App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export the services (singletons)
export const auth = getAuth(app);
export const db   = getDatabase(app);

// ⭐ Explicit region to match your deploy (logs show us-central1)
export const fns  = getFunctions(app, "us-central1");

// Persist user session across reloads / tabs
setPersistence(auth, browserLocalPersistence).catch(() => {
  // Some environments block IndexedDB/localStorage — silent fallback to in-memory
});

// // (Optional) Use the emulator locally
// if (process.env.NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR === "1") {
//   const { connectFunctionsEmulator } = await import("firebase/functions");
//   connectFunctionsEmulator(fns, "localhost", 5001);
// }
