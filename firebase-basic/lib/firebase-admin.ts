import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

// Use secret from GitHub Actions or fallback to local file
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require("./serviceAccountKey.json");

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert(serviceAccount as any),
      databaseURL: "https://studenthandbook-a215a-default-rtdb.europe-west1.firebasedatabase.app",
    });

export const adminDb = getDatabase(app);
