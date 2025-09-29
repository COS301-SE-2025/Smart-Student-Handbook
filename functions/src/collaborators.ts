import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.database();

interface RemoveCollaboratorData {
  noteId: string;
  collaboratorId: string;
}

export const removeCollaborator = functions.https.onCall(
  async (request: functions.https.CallableRequest<RemoveCollaboratorData>) => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to remove a collaborator."
      );
    }

    const { noteId, collaboratorId } = request.data;
    const requesterId = request.auth.uid;

    if (!noteId || !collaboratorId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Both noteId and collaboratorId are required."
      );
    }

    try {
      // ✅ Look up the note in all users' collections to find the owner
      const usersRef = db.ref("users");
      const snapshot = await usersRef.once("value");

      let ownerId: string | null = null;
      snapshot.forEach((userSnap) => {
        const note = userSnap.child(`notes/${noteId}`);
        if (note.exists()) {
          ownerId = userSnap.key!;
          return true; // stop loop
        }
        return false;
      });

      if (!ownerId) {
        throw new functions.https.HttpsError(
          "not-found",
          "Note not found."
        );
      }

      // ✅ Only allow the note owner to remove collaborators
      if (requesterId !== ownerId) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only the owner can remove collaborators."
        );
      }

      const collabRef = db.ref(
        `users/${ownerId}/notes/${noteId}/collaborators/${collaboratorId}`
      );

      await collabRef.remove();

      return { success: true, message: `Removed ${collaboratorId}` };
    } catch (error: any) {
      console.error("Error removing collaborator:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to remove collaborator."
      );
    }
  }
);

interface ShareNoteData {
  noteId: string;
  collaboratorId: string;
  permission: "r" | "w";
}

export const shareNote = functions.https.onCall(
  async (request: functions.https.CallableRequest<ShareNoteData>) => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to share a note."
      );
    }

    const { noteId, collaboratorId, permission } = request.data;
    const requesterId = request.auth.uid;

    if (!noteId || !collaboratorId || !permission) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "noteId, collaboratorId, and permission are required."
      );
    }

    if (permission !== "r" && permission !== "w") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Permission must be 'r' or 'w'."
      );
    }

    try {
      const usersRef = db.ref("users");
      const snapshot = await usersRef.once("value");

      let ownerId: string | null = null;
      snapshot.forEach((userSnap) => {
        const note = userSnap.child(`notes/${noteId}`);
        if (note.exists()) {
          ownerId = userSnap.key!;
          return true; // stop loop
        }
        return false;
      });

      if (!ownerId) {
        throw new functions.https.HttpsError(
          "not-found",
          "Note not found."
        );
      }

      // Only allow the owner to share
      if (requesterId !== ownerId) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only the owner can share this note."
        );
      }

      // Add collaborator under the note
      const collabRef = db.ref(
        `users/${ownerId}/notes/${noteId}/collaborators/${collaboratorId}`
      );
      await collabRef.set(permission);

      // ===== New logic: Add note under collaborator's sharedNotes =====
      const sharedNoteRef = db.ref(
        `users/${collaboratorId}/sharedNotes/${noteId}`
      );

      // Optionally, store minimal info about the note
      await sharedNoteRef.set({
        noteId,
        owner : ownerId,
        permission,
        sharedAt: Date.now(),
      });
      // ================================================================

      return {
        success: true,
        message: `Shared with ${collaboratorId} (${permission}) and added to their sharedNotes`,
      };
    } catch (error: any) {
      console.error("Error sharing note:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to share note."
      );
    }
  }
);
