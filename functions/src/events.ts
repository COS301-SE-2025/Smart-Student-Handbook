import { onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { db } from "./firebaseAdmin";

interface EventPayload {
  semesterId?: string;
  event?: any;
  eventId?: string;
}

export const getEvents = onCall(
  async (req: CallableRequest<Pick<EventPayload, "semesterId">>) => {
    const uid = req.auth?.uid;
    const { semesterId } = req.data;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!semesterId) throw new HttpsError("invalid-argument", "semesterId missing");

    const snap = await db.ref(`users/${uid}/events`).get();
    const rows = snap.exists() ? Object.values(snap.val()) : [];
    return rows.filter((e: any) => e.semesterId === semesterId);
  }
);

/** ADD event */
export const addEvent = onCall(
  async (req: CallableRequest<Pick<EventPayload, "event" | "semesterId">>) => {
    const uid = req.auth?.uid;
    const { event, semesterId } = req.data;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!semesterId || !event?.title || !event?.type || !event?.date) {
      throw new HttpsError("invalid-argument", "Missing event fields");
    }

    const ref = db.ref(`users/${uid}/events`).push();
    const newEvent = { ...event, semesterId, id: ref.key };
    await ref.set(newEvent);
    return newEvent;
  }
);

/** DELETE event */
export const deleteEvent = onCall(
  async (req: CallableRequest<Pick<EventPayload, "eventId">>) => {
    const uid = req.auth?.uid;
    const { eventId } = req.data;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!eventId) throw new HttpsError("invalid-argument", "eventId missing");

    await db.ref(`users/${uid}/events/${eventId}`).remove();
    return { success: true };
  }
);
