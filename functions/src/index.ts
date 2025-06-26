/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onCall, onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import * as admin from "firebase-admin";
import {getDatabase} from "firebase-admin/database";
admin.initializeApp();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

export const shareNote = onCall(async (request) => {
  const {collaboratorId, noteId} = request.data;
  const ownerId = request.auth?.uid;

  if (!ownerId) {
    throw new Error("Unauthenticated user");
  }
  if (!collaboratorId || !noteId) {
    throw new Error("Missing parameters");
  }
  const db = getDatabase();

  const sharedRef = db.ref(`users/${collaboratorId}/sharedNotes/${noteId}`);
  await sharedRef.set({owner: ownerId, noteId});
  const path = `users/${ownerId}/notes/${noteId}`;

  const noteCollabRef = db.ref(`${path}/collaborators/${collaboratorId}`);
  await noteCollabRef.set(true);

  return {status: "success"};
});
