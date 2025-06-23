import { initializeApp, getApps, App } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

/** Initialise once and reuse everywhere */
const app: App = getApps().length ? getApps()[0] : initializeApp();
export const db = getDatabase(app);
