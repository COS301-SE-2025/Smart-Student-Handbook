
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

const app = getApps().length ? getApp() : initializeApp();

export const db = getDatabase(app);
export default app;
