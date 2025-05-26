import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fire";

// GET /api/events?userId=...&semesterId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  // const semesterId = searchParams.get("semesterId");
  if (!userId)
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const eventsRef = db.ref(`users/${userId}/events`);
  const snapshot = await eventsRef.get();
  const events = snapshot.exists() ? Object.values(snapshot.val()) : [];
  // Only events within the semester dates (optionally filter)
  return NextResponse.json(events);
}

// POST: Add a new event
export async function POST(req: NextRequest) {
  const { userId, event } = await req.json();
  if (!userId || !event)
    return NextResponse.json({ error: "Missing data" }, { status: 400 });

  if (!event.title || !event.type || !event.date)
    return NextResponse.json({ error: "Missing event fields" }, { status: 400 });

  const eventsRef = db.ref(`users/${userId}/events`);
  const newEventRef = eventsRef.push();
  const newEvent = { ...event, id: newEventRef.key };
  await newEventRef.set(newEvent);

  return NextResponse.json(newEvent, { status: 201 });
}

// DELETE: Remove an event by ID
export async function DELETE(req: NextRequest) {
  const { userId, eventId } = await req.json();
  if (!userId || !eventId)
    return NextResponse.json({ error: "Missing userId or eventId" }, { status: 400 });

  const eventRef = db.ref(`users/${userId}/events/${eventId}`);
  await eventRef.remove();
  return NextResponse.json({ success: true });
}
