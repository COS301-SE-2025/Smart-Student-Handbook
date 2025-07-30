import { onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { db } from "./firebaseAdmin";

// Event payload type
interface EventPayload {
  semesterId?: string;
  event?: any;
  eventId?: string;
}

/**
 * GET events
 * - If semesterId is provided, return only events with that semesterId
 * - If no semesterId, return all events (both general and semester-based)
 */
export const getEvents = onCall(
  async (req: CallableRequest<Pick<EventPayload, "semesterId">>) => {
    const uid = req.auth?.uid;
    const { semesterId } = req.data;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");

    const snap = await db.ref(`users/${uid}/events`).get();
    const rows = snap.exists() ? Object.values(snap.val()) : [];

    if (!semesterId) {
      // No semesterId specified: return all events
      return rows;
    } else {
      // Only events matching the given semesterId
      return rows.filter((e: any) => e.semesterId === semesterId);
    }
  }
);

/**
 * ADD event
 * - semesterId is optional
 * - For personal/general events, do NOT set semesterId
 * - For semester events, add semesterId to event object on the frontend
 */
export const addEvent = onCall(
  async (req: CallableRequest<Pick<EventPayload, "event">>) => {
    const uid = req.auth?.uid;
    const { event } = req.data;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!event?.title || !event?.type || !event?.date) {
      throw new HttpsError("invalid-argument", "Missing event fields");
    }

    const ref = db.ref(`users/${uid}/events`).push();
    const newEvent = { ...event, id: ref.key }; // semesterId included if present in event
    await ref.set(newEvent);
    return newEvent;
  }
);

/**
 * UPDATE event
 * - Allows updating any field (including semesterId or making event general)
 */
export const updateEvent = onCall(
  async (req: CallableRequest<{ eventId: string; updates: any }>) => {
    const uid = req.auth?.uid;
    const { eventId, updates } = req.data;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");
    if (!eventId || !updates) throw new HttpsError("invalid-argument", "Missing update fields");

    const eventRef = db.ref(`users/${uid}/events/${eventId}`);
    const snap = await eventRef.get();
    if (!snap.exists()) throw new HttpsError("not-found", "Event not found");

    await eventRef.update(updates);
    const updated = (await eventRef.get()).val();
    return updated;
  }
);

/**
 * DELETE event
 */
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

