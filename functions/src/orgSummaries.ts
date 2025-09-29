import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

if (!getApps().length) initializeApp();
const db = getDatabase();

/* ----------------------------- Helpers & errors ---------------------------- */

function rethrow(e: unknown): never {
  console.error(e);
  if (e instanceof HttpsError) throw e;
  const msg = e instanceof Error ? e.message : "Unknown error";
  throw new HttpsError("internal", msg);
}

const summaryPath = (orgId: string, noteId: string) =>
  `organizations/${orgId}/notes/${noteId}/summary`;

/* ---------------------------------- LOAD ----------------------------------- */
/**
 * Load a note's summary.
 * Input:  { orgId: string, noteId: string }
 * Output: { success: true, exists: boolean, summary?: { id, orgId, noteId, ownerId, text, title, createdAt, updatedAt } }
 */
export const loadSummary = onCall(async (req) => {
  try {
    const { orgId, noteId } = req.data as { orgId: string; noteId: string };
    if (!orgId || !noteId) {
      throw new HttpsError("invalid-argument", "Missing orgId or noteId");
    }

    const snap = await db.ref(summaryPath(orgId, noteId)).get();
    if (!snap.exists()) {
      return { success: true, exists: false };
    }
    const val = snap.val();
    return {
      success: true,
      exists: true,
      summary: {
        id: val?.id ?? noteId,
        orgId,
        noteId,
        ownerId: val?.ownerId ?? null,
        text: val?.text ?? "",
        title: val?.title ?? "",
        createdAt: val?.createdAt ?? null,
        updatedAt: val?.updatedAt ?? null,
      },
    };
  } catch (e) {
    rethrow(e);
  }
});

/* ---------------------------------- SAVE ----------------------------------- */
/**
 * Upsert a summary for a note.
 * Input:  { orgId, noteId, ownerId, text, title? }
 * Output: { success: true, id, path }
 */
export const saveSummary = onCall(async (req) => {
  try {
    const { orgId, noteId, ownerId, text, title } = req.data as {
      orgId: string;
      noteId: string;
      ownerId: string;
      text: string;
      title?: string;
    };

    if (!orgId || !noteId || !ownerId || !text) {
      throw new HttpsError("invalid-argument", "Missing orgId, noteId, ownerId, or text");
    }

    const ref = db.ref(summaryPath(orgId, noteId));
    const current = await ref.get();
    const now = Date.now();

    if (!current.exists()) {
      await ref.set({
        id: noteId,
        orgId,
        noteId,
        ownerId,
        text,
        title: title ?? "",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ref.update({
        ownerId,          // keep/refresh author
        text,
        title: title ?? "",
        updatedAt: now,
      });
    }

    return { success: true, id: noteId, path: summaryPath(orgId, noteId) };
  } catch (e) {
    rethrow(e);
  }
});

/* --------------------------------- DELETE ---------------------------------- */
/**
 * Delete a note's summary.
 * Input:  { orgId: string, noteId: string }
 * Output: { success: true }
 */
export const deleteSummary = onCall(async (req) => {
  try {
    const { orgId, noteId } = req.data as { orgId: string; noteId: string };
    if (!orgId || !noteId) {
      throw new HttpsError("invalid-argument", "Missing orgId or noteId");
    }
    await db.ref(summaryPath(orgId, noteId)).remove();
    return { success: true };
  } catch (e) {
    rethrow(e);
  }
});
