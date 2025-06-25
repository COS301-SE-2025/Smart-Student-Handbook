// // firebase-basic/lib/firebase.ts
// // ------------------------------------------------------------
// // Central Firebase client-side initialisation
// // • Auth  -> auth
// // • RTDB  -> db
// // • Funcs -> fns
// // ------------------------------------------------------------

// import { initializeApp, getApps, getApp } from "firebase/app"
// import {
//   getAuth,
//   connectAuthEmulator,
//   browserLocalPersistence,
//   setPersistence,
// } from "firebase/auth"
// import {
//   getDatabase,
//   connectDatabaseEmulator,
// } from "firebase/database"
// import {
//   getFunctions,
//   connectFunctionsEmulator,
// } from "firebase/functions"

// // ──────────────────────────────────────────────────────────────
// // Config (pulled from NEXT_PUBLIC_* env vars)
// // ──────────────────────────────────────────────────────────────
// const firebaseConfig = {
//   apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
//   authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
//   databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL!,
//   projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
//   storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
//   messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
//   appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
// }

// // ──────────────────────────────────────────────────────────────
// // Initialise (or reuse) Firebase app
// // ──────────────────────────────────────────────────────────────
// const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

// // ──────────────────────────────────────────────────────────────
// // Service handles
// // ──────────────────────────────────────────────────────────────
// export const auth = getAuth(app)           // 🔑 Authentication
// export const db   = getDatabase(app)       // 🟢 Realtime Database
// export const fns  = getFunctions(app)      // ⚙️ Callable / HTTPS Functions

// // Persist the auth session across reloads / new tabs
// // (falls back to in-memory if IndexedDB/localStorage blocked)
// setPersistence(auth, browserLocalPersistence).catch(() => {
//   /* ignore – in private mode some browsers disallow IndexedDB */
// })

// // ──────────────────────────────────────────────────────────────
// // Local emulator suite (optional)
// // ──────────────────────────────────────────────────────────────
// if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "true") {
//   // Auth emulator
//   connectAuthEmulator(auth, "http://localhost:9099", {
//     disableWarnings: true,
//   })

//   // Realtime DB emulator
//   connectDatabaseEmulator(db, "localhost", 9000)

//   // Functions emulator
//   connectFunctionsEmulator(fns, "localhost", 5001)

//   console.info("[Firebase] Connected to local emulators ✔︎")
// }
import { initializeApp, getApps } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getDatabase, connectDatabaseEmulator } from "firebase/database"
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

const db = getDatabase(app)
const functions = getFunctions(app)
const auth = getAuth(app) // ✅ ADD THIS

if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "true") {
  connectDatabaseEmulator(db, "localhost", 9000)
  connectFunctionsEmulator(functions, "localhost", 5001)
}

export { db, functions, auth } // ✅ EXPORT IT
