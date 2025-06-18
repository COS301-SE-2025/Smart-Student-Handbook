
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

/** Decode the base-64 JSON string, if provided */
const serviceAccount =
  process.env.FIREBASE_SERVICE_ACCOUNT &&
  JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")
  );

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount as any),
        databaseURL:
          "https://studenthandbook-a215a-default-rtdb.europe-west1.firebasedatabase.app",
      });

export const adminDb = getDatabase(app);
