import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import serviceAccount from "./serviceAccountKey.json";

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert(serviceAccount as any),
      databaseURL: "https://student-handbook-5ac1d-default-rtdb.asia-southeast1.firebasedatabase.app/",
    });

export const db = getDatabase(app);
