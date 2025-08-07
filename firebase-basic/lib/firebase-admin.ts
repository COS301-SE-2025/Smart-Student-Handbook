import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import serviceAccount from "./serviceAccountKey.json"; // This file must also exist!

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert(serviceAccount as any),
      databaseURL: "https://studenthandbook-a215a-default-rtdb.europe-west1.firebasedatabase.app",
    });

export const adminDb = getDatabase(app);
