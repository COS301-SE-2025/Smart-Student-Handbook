import { onCall } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

initializeApp();
const db = getDatabase();

export const createNoteAtPath = onCall(async (req: { data: { path: any; note: any; }; }) => {
    const { path, note } = req.data;
    if (!path || !note) throw new functions.https.HttpsError('invalid-argument', 'Missing path or note');
    await db.ref(path).set(note);
    return { success: true };
});

export const updateNoteAtPath = onCall(async (req: { data: { path: any; note: any; }; }) => {
    const { path, note } = req.data;
    if (!path || !note) throw new functions.https.HttpsError('invalid-argument', 'Missing path or update');
    await db.ref(path).update(note);
    return { success: true };
});

export const deleteNoteAtPath = onCall(async (req: { data: { path: any; }; }) => {
    const { path } = req.data;
    if (!path) throw new functions.https.HttpsError('invalid-argument', 'Missing path');
    await db.ref(path).remove();
    return { success: true };
});
