import { onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { db } from "./firebaseAdmin";

interface LecturePayload {
  semesterId?: string;
  lecture?: any;
  lectureId?: string;
}

/** GET lectures */
export const getLectures = onCall(
  async (req: CallableRequest<Pick<LecturePayload, "semesterId">>) => {
    const uid = req.auth?.uid;
    const { semesterId } = req.data;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!semesterId) throw new HttpsError("invalid-argument", "semesterId missing");

    const snap = await db.ref(`users/${uid}/lectureSlots`).get();
    const rows = snap.exists() ? Object.values(snap.val()) : [];
    return rows.filter((l: any) => l.semesterId === semesterId);
  }
);

/** ADD lecture */
export const addLecture = onCall(
  async (req: CallableRequest<Pick<LecturePayload, "lecture" | "semesterId">>) => {
    const uid = req.auth?.uid;
    const { lecture, semesterId } = req.data;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (
      !semesterId ||
      !lecture?.subject ||
      !lecture?.timeSlot ||
      typeof lecture?.dayOfWeek !== "number"
    ) {
      throw new HttpsError("invalid-argument", "Invalid lecture data");
    }

    const ref = db.ref(`users/${uid}/lectureSlots`).push();
    const newLecture = { ...lecture, semesterId, id: ref.key };
    await ref.set(newLecture);
    return newLecture;
  }
);

/** DELETE lecture */
export const deleteLecture = onCall(
  async (req: CallableRequest<Pick<LecturePayload, "lectureId">>) => {
    const uid = req.auth?.uid;
    const { lectureId } = req.data;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!lectureId) throw new HttpsError("invalid-argument", "lectureId missing");

    await db.ref(`users/${uid}/lectureSlots/${lectureId}`).remove();
    return { success: true };
  }
);
