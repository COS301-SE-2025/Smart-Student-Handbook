import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fire";

// GET /api/semesters?userId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId)
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const semestersRef = db.ref(`users/${userId}/semesters`);
  const snapshot = await semestersRef.get();
  const semesters = snapshot.exists() ? Object.values(snapshot.val()) : [];
  return NextResponse.json(semesters);
}

// POST: Add a new semester
export async function POST(req: NextRequest) {
  const { userId, semester } = await req.json();
  if (!userId || !semester)
    return NextResponse.json({ error: "Missing data" }, { status: 400 });

  if (!semester.name || !semester.startDate || !semester.endDate)
    return NextResponse.json({ error: "Missing semester fields" }, { status: 400 });

  const semestersRef = db.ref(`users/${userId}/semesters`);
  const newSemesterRef = semestersRef.push();
  const newSem = { ...semester, id: newSemesterRef.key, isActive: false };
  await newSemesterRef.set(newSem);

  return NextResponse.json(newSem, { status: 201 });
}

// PATCH: Set semester active
export async function PATCH(req: NextRequest) {
  const { userId, semesterId } = await req.json();
  if (!userId || !semesterId)
    return NextResponse.json({ error: "Missing data" }, { status: 400 });

  const semestersRef = db.ref(`users/${userId}/semesters`);
  const snapshot = await semestersRef.get();
  if (!snapshot.exists()) return NextResponse.json({ error: "No semesters" }, { status: 404 });

  const updates: any = {};
  Object.entries(snapshot.val()).forEach(([id, sem]: [string, any]) => {
    updates[`${id}/isActive`] = id === semesterId;
  });
  await semestersRef.update(updates);

  return NextResponse.json({ success: true });
}

// DELETE: Remove a semester by ID
export async function DELETE(req: NextRequest) {
  const { userId, semesterId } = await req.json();
  if (!userId || !semesterId)
    return NextResponse.json({ error: "Missing userId or semesterId" }, { status: 400 });

  const semRef = db.ref(`users/${userId}/semesters/${semesterId}`);
  await semRef.remove();
  return NextResponse.json({ success: true });
}
