import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

if (!getApps().length) initializeApp();
const db = getDatabase();

function rethrow(e: unknown): never {
  console.error(e);
  if (e instanceof HttpsError) throw e;
  const msg = e instanceof Error ? e.message : "Unknown error";
  throw new HttpsError("internal", msg);
}

const cardsPath = (orgId: string, noteId: string) =>
  `organizations/${orgId}/notes/${noteId}/flashcards`;

function toOrderedArray(obj: any): Array<{ number: number; question: string; answer: string }> {
  const entries = Object.entries(obj || {})
    .filter(([k, v]) => /^\d+$/.test(k) && v && typeof v === "object")
    .map(([k, v]: [string, any]) => ({
      number: parseInt(k, 10),
      question: String(v.question ?? ""),
      answer: String(v.answer ?? ""),
    }));
  entries.sort((a, b) => a.number - b.number);
  return entries;
}

function toNumberedObject(
  cards: Array<{ question: string; answer: string }>,
  startAt = 1
): Record<string, { question: string; answer: string }> {
  const out: Record<string, { question: string; answer: string }> = {};
  let i = startAt;
  for (const c of cards) {
    if (!c?.question || !c?.answer) continue;
    out[String(i)] = { question: c.question, answer: c.answer };
    i++;
  }
  return out;
}


async function doLoadPack(orgId: string, noteId: string) {
  const snap = await db.ref(cardsPath(orgId, noteId)).get();
  if (!snap.exists()) {
    return { success: true, orgId, noteId, exists: false, count: 0, cards: [] };
  }
  const cards = toOrderedArray(snap.val());
  return { success: true, orgId, noteId, exists: true, count: cards.length, cards };
}

async function doSavePack(
  orgId: string,
  noteId: string,
  mode: "append" | "replace" | undefined,
  cards: Array<{ question: string; answer: string }>
) {
  if (!Array.isArray(cards)) {
    throw new HttpsError("invalid-argument", "cards must be an array");
  }

  const opMode: "append" | "replace" = mode === "replace" ? "replace" : "append";
  const path = cardsPath(orgId, noteId);

  if (opMode === "replace") {
    const numbered = toNumberedObject(cards, 1);
    await db.ref(path).set(numbered);
  } else {
    const snap = await db.ref(path).get();
    const existing = toOrderedArray(snap.val());
    const lastNum = existing.length ? existing[existing.length - 1].number : 0;

    const updates: Record<string, unknown> = {};
    let i = lastNum + 1;
    for (const c of cards) {
      if (!c?.question || !c?.answer) continue;
      updates[`${path}/${i}`] = { question: c.question, answer: c.answer };
      i++;
    }
    if (!Object.keys(updates).length) {
      throw new HttpsError("invalid-argument", "No valid cards to write");
    }
    await db.ref().update(updates);
  }

  return { success: true, orgId, noteId, written: cards.length, mode: opMode };
}

async function doDeletePack(
  orgId: string,
  noteId: string,
  numbers?: number[],
  deleteAll?: boolean,
  compact?: boolean
) {
  const path = cardsPath(orgId, noteId);

  if (deleteAll) {
    await db.ref(path).set(null);
    return { success: true, orgId, noteId, deleted: -1, compacted: false };
  }

  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new HttpsError("invalid-argument", "Provide numbers[] or set deleteAll=true");
  }

  const snap = await db.ref(path).get();
  const arr = toOrderedArray(snap.val());
  const toDelete = new Set(numbers.map((n) => Number(n)));

  const doCompact = compact !== false; 
  if (doCompact) {
    const remaining = arr.filter((c) => !toDelete.has(c.number));
    const renumbered = toNumberedObject(
      remaining.map((c) => ({ question: c.question, answer: c.answer })),
      1
    );
    await db.ref(path).set(renumbered);
  } else {
    const updates: Record<string, unknown> = {};
    for (const n of toDelete) updates[`${path}/${n}`] = null;
    await db.ref().update(updates);
  }

  return { success: true, orgId, noteId, deleted: toDelete.size, compacted: compact !== false };
}

export const loadNoteFlashcardsPack = onCall(async (req) => {
  try {
    const { orgId, noteId } = req.data as { orgId: string; noteId: string };
    if (!orgId || !noteId) throw new HttpsError("invalid-argument", "Missing orgId or noteId");
    return await doLoadPack(orgId, noteId);
  } catch (e) { rethrow(e); }
});

export const saveNoteFlashcardsPack = onCall(async (req) => {
  try {
    const { orgId, noteId, mode, cards } = req.data as {
      orgId: string; noteId: string; mode?: "append" | "replace";
      cards: Array<{ question: string; answer: string }>;
    };
    if (!orgId || !noteId) throw new HttpsError("invalid-argument", "Missing orgId or noteId");
    return await doSavePack(orgId, noteId, mode, cards);
  } catch (e) { rethrow(e); }
});

export const deleteNoteFlashcardsPack = onCall(async (req) => {
  try {
    const { orgId, noteId, numbers, deleteAll, compact } = req.data as {
      orgId: string; noteId: string; numbers?: number[]; deleteAll?: boolean; compact?: boolean;
    };
    if (!orgId || !noteId) throw new HttpsError("invalid-argument", "Missing orgId or noteId");
    return await doDeletePack(orgId, noteId, numbers, deleteAll, compact);
  } catch (e) { rethrow(e); }
});


export const loadNoteFlashcards = onCall(async (req) => {
  try {
    const { orgId, noteId } = req.data as any; 
    if (!orgId || !noteId) throw new HttpsError("invalid-argument", "Missing orgId or noteId");
    return await doLoadPack(orgId, noteId);
  } catch (e) { rethrow(e); }
});

export const saveNoteFlashcards = onCall(async (req) => {
  try {
    const { orgId, noteId, mode, cards } = req.data as any;
    if (!orgId || !noteId) throw new HttpsError("invalid-argument", "Missing orgId or noteId");
    return await doSavePack(orgId, noteId, mode, cards);
  } catch (e) { rethrow(e); }
});

export const deleteNoteFlashcards = onCall(async (req) => {
  try {
    const { orgId, noteId, numbers, deleteAll, compact } = req.data as any; 
    if (!orgId || !noteId) throw new HttpsError("invalid-argument", "Missing orgId or noteId");
    return await doDeletePack(orgId, noteId, numbers, deleteAll, compact);
  } catch (e) { rethrow(e); }
});
