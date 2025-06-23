// lib/firebase-admin.ts
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import type { App } from "firebase-admin/app";

/** Parse service account JSON from env (one-line string). */
let credentials: object | undefined;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.warn(
      "FIREBASE_SERVICE_ACCOUNT is not valid JSON – using default creds"
    );
  }
}

/** Singleton admin app (re-use across hot reloads) */
const adminApp: App =
  getApps().length > 0
    ? getApp()
    : initializeApp(
        credentials
          ? {
              credential: cert(credentials as any),
              databaseURL:
                "https://student-handbook-5ac1d-default-rtdb.asia-southeast1.firebasedatabase.app/",
            }
          : {
              // fallback: ADC (works on Cloud Run / Functions / local if gcloud auth login)
              databaseURL:
                "https://student-handbook-5ac1d-default-rtdb.asia-southeast1.firebasedatabase.app/",
            }
      );

export const db = getDatabase(adminApp);
