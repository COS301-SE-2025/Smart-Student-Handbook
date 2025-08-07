// app/api/lectures/route.ts
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

// --- GET LECTURES ---
export async function GET(req: NextRequest) {
  const uid = await verifyUser(req);
  const { searchParams } = new URL(req.url);
  const semesterId = searchParams.get("semesterId");
  if (!uid || !semesterId)
    return NextResponse.json({ error: "Missing user or semesterId" }, { status: 400 });

  const lecturesRef = adminDb.ref(`users/${uid}/lectureSlots`);
  const snapshot = await lecturesRef.get();
  const lectures = snapshot.exists() ? Object.values(snapshot.val()) : [];
  const filtered = lectures.filter((l: any) => l.semesterId === semesterId);
  return NextResponse.json(filtered);
}

// --- ADD LECTURE ---
export async function POST(req: NextRequest) {
  const uid = await verifyUser(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { semesterId, lecture } = await req.json();
  if (!semesterId || !lecture)
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  if (!lecture.subject || !lecture.timeSlot || typeof lecture.dayOfWeek !== "number")
    return NextResponse.json({ error: "Invalid lecture data" }, { status: 400 });

  const lecturesRef = adminDb.ref(`users/${uid}/lectureSlots`);
  const newLectureRef = lecturesRef.push();
  const newLecture = { ...lecture, semesterId, id: newLectureRef.key };
  await newLectureRef.set(newLecture);
  return NextResponse.json(newLecture, { status: 201 });
}

// --- DELETE LECTURE ---
export async function DELETE(req: NextRequest) {
  const uid = await verifyUser(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { lectureId } = await req.json();
  if (!lectureId)
    return NextResponse.json({ error: "Missing lectureId" }, { status: 400 });

  const lectureRef = adminDb.ref(`users/${uid}/lectureSlots/${lectureId}`);
  await lectureRef.remove();
  return NextResponse.json({ success: true });
}
