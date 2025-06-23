import { onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { db } from "./firebaseAdmin";

interface SemPayload {
  semester?: any;
  semesterId?: string;
}

/** GET semesters */
export const getSemesters = onCall(async (req: CallableRequest<{}>) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required");

  const snap = await db.ref(`users/${uid}/semesters`).get();
  return snap.exists() ? Object.values(snap.val()) : [];
});

/** ADD semester */
export const addSemester = onCall(
  async (req: CallableRequest<Pick<SemPayload, "semester">>) => {
    const uid = req.auth?.uid;
    const { semester } = req.data;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!semester?.name || !semester.startDate || !semester.endDate) {
      throw new HttpsError("invalid-argument", "Missing semester fields");
    }

    const ref = db.ref(`users/${uid}/semesters`).push();
    const newSem = { ...semester, id: ref.key, isActive: false };
    await ref.set(newSem);
    return newSem;
  }
);
//update semester:
interface UpdateSemPayload {
  semesterId: string;
  updates: {
    name?: string;
    startDate?: string; // ISO string from client
    endDate?: string;
  };
}

export const updateSemester = onCall(
  async (req: CallableRequest<UpdateSemPayload>) => {
    const uid = req.auth?.uid;
    const { semesterId, updates } = req.data;

    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!semesterId) throw new HttpsError("invalid-argument", "semesterId missing");
    if (!updates || Object.keys(updates).length === 0) {
      throw new HttpsError("invalid-argument", "Nothing to update");
    }

    const ref = db.ref(`users/${uid}/semesters/${semesterId}`);
    const snap = await ref.get();
    if (!snap.exists()) throw new HttpsError("not-found", "Semester not found");

    // sanitize so clients cannot edit protected fields like isActive
    const safe: Record<string, unknown> = {};
    if (updates.name) safe["name"] = updates.name.trim();
    if (updates.startDate) safe["startDate"] = updates.startDate;
    if (updates.endDate) safe["endDate"] = updates.endDate;

    await ref.update(safe);
    const updatedSnap = await ref.get();
    return updatedSnap.val();
  }
);


/** SET active semester */
export const setActiveSemester = onCall(
  async (req: CallableRequest<Pick<SemPayload, "semesterId">>) => {
    const uid = req.auth?.uid;
    const { semesterId } = req.data;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!semesterId) throw new HttpsError("invalid-argument", "semesterId missing");

    const ref = db.ref(`users/${uid}/semesters`);
    const snap = await ref.get();
    if (!snap.exists()) return { success: false };

    const updates: Record<string, unknown> = {};
    Object.keys(snap.val()!).forEach((id) => {
      updates[`${id}/isActive`] = id === semesterId;
    });
    await ref.update(updates);
    return { success: true };
  }
);

/** DELETE semester */
export const deleteSemester = onCall(
  async (req: CallableRequest<Pick<SemPayload, "semesterId">>) => {
    const uid = req.auth?.uid;
    const { semesterId } = req.data;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!semesterId) throw new HttpsError("invalid-argument", "semesterId missing");

    await db.ref(`users/${uid}/semesters/${semesterId}`).remove();
    return { success: true };
  }
);
