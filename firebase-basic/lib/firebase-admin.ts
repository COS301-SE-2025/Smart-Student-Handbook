// lib/firebase-admin.ts
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

function loadServiceAccount() {
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT ?? "";
  // remove any leading BOM or whitespace
  raw = raw.replace(/^\uFEFF/, "").trim();
  try {
    return raw ? JSON.parse(raw) : undefined;
  } catch (e) {
    console.warn("⚠️  FIREBASE_SERVICE_ACCOUNT is not valid JSON", e);
    return undefined;
  }
}

const creds = loadServiceAccount();

const adminApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(
        creds
          ? {
              credential: cert(creds as any),
              databaseURL:
                "https://student-handbook-5ac1d-default-rtdb.asia-southeast1.firebasedatabase.app/",
            }
          : {
              // fallback so build still succeeds
              databaseURL:
                "https://student-handbook-5ac1d-default-rtdb.asia-southeast1.firebasedatabase.app/",
            }
      );

export const db = getDatabase(adminApp);
export const adminDb = db;