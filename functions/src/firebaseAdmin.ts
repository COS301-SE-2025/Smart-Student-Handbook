// functions/src/firebaseAdmin.ts

import { initializeApp, getApps, App } from "firebase-admin/app";
import { getDatabase, Database } from "firebase-admin/database";

/**
 * Initialize (or reuse) the Admin SDK App.
 */
const app: App = getApps().length > 0
  ? getApps()[0]
  : initializeApp();

/**
 * Get the Realtime Database instance.
 */
export const db: Database = getDatabase(app);

/**
 * If the RTDB emulator is running, the emulator will
 * set FIREBASE_DATABASE_EMULATOR_HOST to "localhost:9000".
 * Detect that and re-route admin DB calls to the emulator.
 */
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
  const [host, portStr] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(":");
  const port = Number(portStr);
  db.useEmulator(host, port);
  console.log(`[firebaseAdmin] RealtimeDB emulator detected at ${host}:${port}`);
}
