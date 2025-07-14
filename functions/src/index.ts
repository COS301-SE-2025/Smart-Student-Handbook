import { onCall } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

initializeApp();
const db = getDatabase();

export const updateNoteAtPath = onCall(async (req) => {
  const { path, note } = req.data;

  if (!path || typeof path !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing or invalid 'path'"
    );
  }

  if (!note || typeof note !== "object") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing or invalid 'note' object"
    );
  }

  try {
    await db.ref(path).update(note);
    return { success: true };
  } catch (error: any) {
    console.error("Error updating note:", error);
    throw new functions.https.HttpsError("internal", "Failed to update note");
  }
});