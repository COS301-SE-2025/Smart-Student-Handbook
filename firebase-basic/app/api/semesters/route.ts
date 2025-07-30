// app/api/semesters/route.ts
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

// --- GET SEMESTERS ---
export async function GET(req: NextRequest) {
  const uid = await verifyUser(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const semestersRef = adminDb.ref(`users/${uid}/semesters`);
  const snapshot = await semestersRef.get();
  const semesters = snapshot.exists() ? Object.values(snapshot.val()) : [];
  return NextResponse.json(semesters);
}

// --- ADD SEMESTER ---
export async function POST(req: NextRequest) {
  const uid = await verifyUser(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { semester } = await req.json();
  if (!semester || !semester.name || !semester.startDate || !semester.endDate)
    return NextResponse.json({ error: "Missing semester fields" }, { status: 400 });

  const semestersRef = adminDb.ref(`users/${uid}/semesters`);
  const newSemesterRef = semestersRef.push();
  const newSem = { ...semester, id: newSemesterRef.key, isActive: false };
  await newSemesterRef.set(newSem);

  return NextResponse.json(newSem, { status: 201 });
}

// --- PATCH: Set semester active ---
export async function PATCH(req: NextRequest) {
  const uid = await verifyUser(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { semesterId } = await req.json();
  if (!semesterId)
    return NextResponse.json({ error: "Missing semesterId" }, { status: 400 });

  const semestersRef = adminDb.ref(`users/${uid}/semesters`);
  const snapshot = await semestersRef.get();
  if (!snapshot.exists()) return NextResponse.json({ error: "No semesters" }, { status: 404 });

  const updates: any = {};
  Object.entries(snapshot.val()).forEach(([id, sem]: [string, any]) => {
    updates[`${id}/isActive`] = id === semesterId;
  });
  await semestersRef.update(updates);

  return NextResponse.json({ success: true });
}

// --- DELETE SEMESTER ---
export async function DELETE(req: NextRequest) {
  const uid = await verifyUser(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { semesterId } = await req.json();
  if (!semesterId)
    return NextResponse.json({ error: "Missing semesterId" }, { status: 400 });

  const semRef = adminDb.ref(`users/${uid}/semesters/${semesterId}`);
  await semRef.remove();
  return NextResponse.json({ success: true });
}
