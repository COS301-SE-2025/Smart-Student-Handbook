import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fire";

// GET /api/lectures?userId=...&semesterId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const semesterId = searchParams.get("semesterId");
  if (!userId || !semesterId)
    return NextResponse.json({ error: "Missing userId or semesterId" }, { status: 400 });

  const lecturesRef = db.ref(`users/${userId}/lectureSlots`);
  const snapshot = await lecturesRef.get();
  const lectures = snapshot.exists() ? Object.values(snapshot.val()) : [];
  // Only lectures for the selected semester
  const filtered = lectures.filter(
    (l: any) => l.semesterId === semesterId
  );
  return NextResponse.json(filtered);
}

// POST: Add a new lecture
export async function POST(req: NextRequest) {
  const { userId, semesterId, lecture } = await req.json();
  if (!userId || !semesterId || !lecture)
    return NextResponse.json({ error: "Missing data" }, { status: 400 });

  // Validate fields
  if (
    !lecture.subject ||
    !lecture.timeSlot ||
    typeof lecture.dayOfWeek !== "number"
  ) {
    return NextResponse.json({ error: "Invalid lecture data" }, { status: 400 });
  }

  const lecturesRef = db.ref(`users/${userId}/lectureSlots`);
  const newLectureRef = lecturesRef.push();
  const newLecture = { ...lecture, semesterId, id: newLectureRef.key };
  await newLectureRef.set(newLecture);

  return NextResponse.json(newLecture, { status: 201 });
}

// DELETE: Remove a lecture by ID
export async function DELETE(req: NextRequest) {
  const { userId, lectureId } = await req.json();
  if (!userId || !lectureId)
    return NextResponse.json({ error: "Missing userId or lectureId" }, { status: 400 });

  const lectureRef = db.ref(`users/${userId}/lectureSlots/${lectureId}`);
  await lectureRef.remove();
  return NextResponse.json({ success: true });
}
