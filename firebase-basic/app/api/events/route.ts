// app/api/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";

// --- AUTH ---
async function verifyUser(req: NextRequest) {
  const header = req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const idToken = header.split(" ")[1];
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}

// --- GET EVENTS ---
export async function GET(req: NextRequest) {
  const uid = await verifyUser(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const eventsRef = adminDb.ref(`users/${uid}/events`);
  const snapshot = await eventsRef.get();
  const events = snapshot.exists() ? Object.values(snapshot.val()) : [];
  return NextResponse.json(events);
}

// --- ADD EVENT ---
export async function POST(req: NextRequest) {
  const uid = await verifyUser(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { event } = await req.json();
  if (!event || !event.title || !event.type || !event.date)
    return NextResponse.json({ error: "Missing event fields" }, { status: 400 });

  const eventsRef = adminDb.ref(`users/${uid}/events`);
  const newEventRef = eventsRef.push();
  const newEvent = { ...event, id: newEventRef.key };
  await newEventRef.set(newEvent);

  return NextResponse.json(newEvent, { status: 201 });
}

// --- DELETE EVENT ---
export async function DELETE(req: NextRequest) {
  const uid = await verifyUser(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { eventId } = await req.json();
  if (!eventId)
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  const eventRef = adminDb.ref(`users/${uid}/events/${eventId}`);
  await eventRef.remove();
  return NextResponse.json({ success: true });
}
