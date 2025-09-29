// functions/src/quiz/quizzes.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db } from "../firebaseAdmin";
import { now } from "../quiz/utils/time";

import type {
  CreateQuizInput,
  QuizQuestion,
  Quiz,
  Participant,
  QuizType, // "org-async" | "personal-async"
} from "./quiz";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function assertMember(orgId: string | undefined, uid?: string) {
  if (!uid) throw new HttpsError("unauthenticated", "Login required");
  if (!orgId) throw new HttpsError("invalid-argument", "Missing orgId");
  const member = await db.ref(`organizations/${orgId}/members/${uid}`).get();
  if (!member.exists()) throw new HttpsError("permission-denied", "Not a member");
}

/** normalize LLM output to our QuizQuestion shape + basic validation */
function normalizeQuestions(qs: any[]): QuizQuestion[] {
  if (!Array.isArray(qs) || qs.length === 0) {
    throw new HttpsError("invalid-argument", "questions array is required and must be non-empty");
  }

  const cleaned: QuizQuestion[] = qs.map((q, i) => {
    const question = String(q?.question ?? "").trim();
    const rawOpts = Array.isArray(q?.options) ? q.options : [];
    const options = rawOpts.slice(0, 4).map((o: any) => String(o ?? "").trim());
    if (options.length !== 4 || options.some((o: string) => !o)) {
      throw new HttpsError("invalid-argument", `question ${i} must have exactly 4 non-empty options`);
    }

    let correct =
      typeof q?.correctIndex === "number"
        ? q.correctIndex
        : typeof q?.answerIndex === "number"
        ? q.answerIndex
        : -1;

    if (!(correct >= 0 && correct < 4)) {
      throw new HttpsError("invalid-argument", `question ${i} has invalid answer index`);
    }

    return {
      id: String(i),
      question,
      options,
      correctIndex: correct,
      explanation: typeof q?.explanation === "string" ? q.explanation.trim() : "",
    };
  });

  return cleaned;
}

function computeAttemptStats(ans: any[]): { avgTimeMs: number; correctCount: number } {
  const times = ans.map((a) => a?.timeMs).filter((x: any) => typeof x === "number");
  const avgTimeMs = times.length ? Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length) : 0;
  const correctCount = ans.filter((a) => a?.correct).length;
  return { avgTimeMs, correctCount };
}

/**
 * Prefer RTDB profile (UserSettings: name + surname).
 * Fallback to Firestore users/{uid}, then Firebase Auth.
 */
async function resolveProfileDisplayName(uid: string): Promise<string | undefined> {
  if (!uid) return undefined;

  // 1) RTDB: users/{uid}/UserSettings
  try {
    const s = await db.ref(`users/${uid}/UserSettings`).get();
    if (s.exists()) {
      const d = s.val() || {};
      const first = String(d?.name ?? "").trim();
      const last = String(d?.surname ?? "").trim();
      const two = [first, last].filter(Boolean).join(" ").trim();
      if (two) return two;
      const display = String(d?.displayName ?? "").trim();
      if (display) return display;
    }
  } catch {
    /* noop */
  }

  // 2) Firestore: users/{uid}
  try {
    const fsUserDoc = await admin.firestore().collection("users").doc(uid).get();
    if (fsUserDoc.exists) {
      const d = (fsUserDoc.data() || {}) as any;
      const display = String(d?.displayName ?? d?.name ?? "").trim();
      if (display) return display;
    }
  } catch {
    /* noop */
  }

  // 3) Auth
  try {
    const u = await admin.auth().getUser(uid);
    return u.displayName || u.email || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Recompute RTDB leaderboard from Firestore attempts.
 */
async function recomputeAndStoreOrgLeaderboard(
  orgId: string,
  noteId: string,
  quizId: string,
  _uidJustFinishedOrUpdated: string
) {
  const firestore = admin.firestore();

  const attemptsSnap = await firestore
    .collection(`organizations/${orgId}/notes/${noteId}/quizzes/${quizId}/attempts`)
    .get();

  let totalFromRTDB: number | undefined;
  try {
    const qSnap = await db
      .ref(`organizations/${orgId}/notes/${noteId}/quizzes/${quizId}/questions`)
      .get();
    if (qSnap.exists()) totalFromRTDB = Object.keys(qSnap.val() || {}).length;
  } catch {
    /* noop */
  }

  const rows: any[] = [];

  for (const doc of attemptsSnap.docs) {
    const data = doc.data() as any;
    const uid = String(data.uid);

    let displayName: string | undefined = String(data?.name ?? "").trim() || undefined;
    if (!displayName) {
      displayName = await resolveProfileDisplayName(uid);
    }

    rows.push({
      uid,
      name: displayName || uid,
      score: data.score ?? 0,
      correctCount: data.correctCount ?? 0,
      avgTimeMs: data.avgTimeMs ?? 0,
      totalQuestions: data.totalQuestions ?? totalFromRTDB ?? null,
      finishedAt: data.finishedAt ?? null,
    });
  }

  rows.sort((a, b) => b.score - a.score || (a.avgTimeMs ?? 0) - (b.avgTimeMs ?? 0));
  const itemsWithPosition = rows.map((r, i) => ({ position: i + 1, ...r }));

  await db
    .ref(`organizations/${orgId}/notes/${noteId}/quizzes/${quizId}/leaderboard`)
    .set({
      items: itemsWithPosition,
      updatedAt: Date.now(),
    });
}

/* -------------------------------------------------------------------------- */
/*  CREATE APIs                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Create an ORG anytime quiz from an org note.
 * Writes:
 * - organizations/{orgId}/notes/{noteId}/quizzes/{quizId}
 * - organizations/{orgId}/notes/{noteId}/quizzesIndex/{quizId}
 */
export const createOrgAsyncQuiz = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, noteId, questionDurationSec, questions } =
    req.data as CreateQuizInput & { orgId: string; questions?: any[] };

  await assertMember(orgId, uid);
  if (!noteId) throw new HttpsError("invalid-argument", "Missing noteId");
  if (!Array.isArray(questions) || questions.length === 0)
    throw new HttpsError("invalid-argument", "questions are required (generate on client first)");

  // Ensure note exists
  const noteSnap = await db.ref(`organizations/${orgId}/notes/${noteId}`).get();
  if (!noteSnap.exists()) throw new HttpsError("not-found", "Note not found");

  const quizId = db.ref(`organizations/${orgId}/notes/${noteId}/quizzes`).push().key!;
  const finalQuestions = normalizeQuestions(questions);

  const quiz: Quiz = {
    id: quizId,
    orgId,
    noteId,
    creatorId: uid!,
    type: "org-async",
    state: "active",
    createdAt: now(),
    questionDurationSec,
    seed: `${noteId}:${uid}:${now()}`,
    questions: finalQuestions.reduce(
      (acc, q) => ((acc[q.id] = q), acc),
      {} as Record<string, QuizQuestion>
    ),
    participants: {},
  };

  const base = `organizations/${orgId}/notes/${noteId}`;
  const indexEntry = {
    id: quizId,
    title: "Anytime Quiz",
    numQuestions: finalQuestions.length,
    questionDurationSec,
    createdAt: quiz.createdAt,
  };

  const updates: Record<string, any> = {};
  updates[`${base}/quizzes/${quizId}`] = quiz;
  updates[`${base}/quizzesIndex/${quizId}`] = indexEntry;

  await db.ref().update(updates);
  return { quizId, type: "org-async" as QuizType };
});

/**
 * Create a SELF (personal-async) quiz from an org or personal note.
 * Writes:
 * - users/{uid}/quizzes/{quizId}
 * - userAsyncQuizzes/{uid}/{noteId}/{quizId}
 */
export const createSelfAsyncQuiz = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  if (!uid) throw new HttpsError("unauthenticated", "Login required");

  const { noteId, questionDurationSec, orgId, questions } =
    req.data as CreateQuizInput & { orgId?: string; questions?: any[] };

  if (!noteId) throw new HttpsError("invalid-argument", "Missing noteId");
  if (!Array.isArray(questions) || questions.length === 0)
    throw new HttpsError("invalid-argument", "questions are required (generate on client first)");

  let notePath: string;
  if (orgId) {
    await assertMember(orgId, uid);
    notePath = `organizations/${orgId}/notes/${noteId}`;
  } else {
    notePath = `users/${uid}/notes/${noteId}`;
  }

  // Ensure note exists
  const noteSnap = await db.ref(notePath).get();
  if (!noteSnap.exists()) throw new HttpsError("not-found", "Note not found");

  const quizId = db.ref(`users/${uid}/quizzes`).push().key!;
  const finalQuestions = normalizeQuestions(questions);

  const quiz: Quiz = {
    id: quizId,
    type: "personal-async",
    noteId,
    creatorId: uid!,
    state: "active",
    createdAt: now(),
    questionDurationSec,
    seed: `${noteId}:${uid}:${now()}`,
    questions: finalQuestions.reduce(
      (acc, q) => ((acc[q.id] = q), acc),
      {} as Record<string, QuizQuestion>
    ),
    participants: {},
  };

  const updates: Record<string, any> = {};
  updates[`users/${uid}/quizzes/${quizId}`] = quiz;
  updates[`userAsyncQuizzes/${uid}/${noteId}/${quizId}`] = {
    id: quizId,
    title: "Self Quiz",
    numQuestions: finalQuestions.length,
    questionDurationSec,
    createdAt: quiz.createdAt,
  };

  await db.ref().update(updates);
  return { quizId, type: "personal-async" as QuizType };
});

/**
 * Optional alias so clients may call `createPersonalAsyncQuiz`
 * (same logic as createSelfAsyncQuiz).
 */
export const createPersonalAsyncQuiz = onCall(async (req) => {
  // Simply reuse the same logic as createSelfAsyncQuiz:
  return await (createSelfAsyncQuiz as any).run(req);
});

/* -------------------------------------------------------------------------- */
/*  LIST                                                                       */
/* -------------------------------------------------------------------------- */

export const listOrgAsyncQuizzes = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, noteId } = req.data as { orgId: string; noteId: string };
  await assertMember(orgId, uid);

  // lightweight index per note
  const snap = await db.ref(`organizations/${orgId}/notes/${noteId}/quizzesIndex`).get();
  const val = snap.val() || {};
  const items = Object.values(val);
  (items as any[]).sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return { items };
});

export const listPersonalAsyncQuizzes = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  if (!uid) throw new HttpsError("unauthenticated", "Login required");
  const { noteId } = req.data as { noteId: string };

  const snap = await db.ref(`userAsyncQuizzes/${uid}/${noteId}`).get();
  const val = snap.val() || {};
  const items = Object.values(val);
  (items as any[]).sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return { items };
});

/* -------------------------------------------------------------------------- */
/*  ORG-ASYNC ATTEMPTS                                                         */
/* -------------------------------------------------------------------------- */

export const startOrResumeOrgAsyncAttempt = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, noteId, quizId, displayName } = req.data as {
    orgId: string;
    noteId: string;
    quizId: string;
    displayName?: string; // optional; we'll resolve if absent
  };
  await assertMember(orgId, uid);

  const path = `organizations/${orgId}/notes/${noteId}/quizzes/${quizId}`;
  const snap = await db.ref(path).get();
  if (!snap.exists()) throw new HttpsError("not-found", "Quiz not found");
  const quiz = snap.val() as Quiz;
  if (quiz.type !== "org-async") throw new HttpsError("failed-precondition", "Not an Anytime (org) quiz");

  const resolvedName = displayName?.trim() || (await resolveProfileDisplayName(uid!)) || uid!;

  await db.ref(`${path}/participants/${uid}`).transaction((p: any) => {
    if (!p) {
      const init: Partial<Participant> = {
        joinedAt: now(),
        displayName: resolvedName,
        connected: true,
        score: 0,
        currentIndex: 0,
        questionStartAt: now(),
      };
      return init;
    }
    if (!p.displayName) p.displayName = resolvedName;
    if (p.connected === false) p.connected = true;
    if (typeof p.questionStartAt !== "number") p.questionStartAt = now();
    return p;
  });

  const pSnap = await db.ref(`${path}/participants/${uid}/currentIndex`).get();
  const currentIndex = pSnap.exists() ? Number(pSnap.val()) : 0;
  return { ok: true, currentIndex };
});

export const submitOrgAsyncAnswer = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, noteId, quizId, optionIdx } = req.data as {
    orgId: string;
    noteId: string;
    quizId: string;
    optionIdx: number;
  };
  await assertMember(orgId, uid);

  const quizPath = `organizations/${orgId}/notes/${noteId}/quizzes/${quizId}`;
  let finishedNow = false;

  let lastScore: number | null = null;
  let lastCorrectCount: number | null = null;
  let lastTotalQuestions: number | null = null;

  try {
    await db.ref(quizPath).transaction((q: any) => {
      if (!q || q.type !== "org-async" || q.state !== "active") return q;
      if (!q.participants || typeof q.participants !== "object") return q;

      const user = q.participants?.[uid!];
      if (!user || user.finished) return q;

      const idx = typeof user.currentIndex === "number" ? user.currentIndex : 0;
      const qArr = Object.values(q.questions || {}) as QuizQuestion[];
      qArr.sort((a: any, b: any) => Number(a.id) - Number(b.id));

      const question = qArr[idx];
      if (!question) return q;

      const nowTs = now();
      const elapsed = typeof user.questionStartAt === "number" ? nowTs - user.questionStartAt : 0;
      const correct = optionIdx === question.correctIndex;

      if (!q.participants[uid!]) q.participants[uid!] = {};
      if (!q.participants[uid!].answers) q.participants[uid!].answers = {};
      q.participants[uid!].answers[idx] = { optionIdx, timeMs: elapsed, correct };

      if (correct) q.participants[uid!].score = (q.participants[uid!].score || 0) + 1;

      if (idx + 1 >= qArr.length) {
        q.participants[uid!].finished = true;
        q.participants[uid!].finishedAt = nowTs;
        delete q.participants[uid!].questionStartAt;
        finishedNow = true;

        // snapshot for return
        lastScore = q.participants[uid!].score || 0;
        lastTotalQuestions = qArr.length;
        const answersArr = Object.values(q.participants[uid!].answers || {});
        lastCorrectCount = (answersArr as any[]).filter((a: any) => a?.correct).length;
      } else {
        q.participants[uid!].currentIndex = idx + 1;
        q.participants[uid!].questionStartAt = nowTs;
      }

      return q;
    });
  } catch (err) {
    console.error("submitOrgAsyncAnswer transaction failed:", err);
    throw new HttpsError("internal", "Could not submit answer. See logs.");
  }

  if (finishedNow) {
    try {
      // resolve proper name and backfill participant.displayName
      const bestName = (await resolveProfileDisplayName(uid!)) || uid!;
      try {
        await db.ref(`${quizPath}/participants/${uid}/displayName`).set(bestName);
      } catch {
        /* ignore */
      }

      // Compute stats from answers
      const partSnap = await db.ref(`${quizPath}/participants/${uid}`).get();
      const p = partSnap.exists() ? (partSnap.val() as any) : null;
      const answersArr = p?.answers ? (Object.values(p.answers) as any[]) : [];
      const { avgTimeMs, correctCount } = computeAttemptStats(answersArr);

      // Derive total questions
      const quizSnap = await db.ref(quizPath).get();
      const qVal = quizSnap.exists() ? (quizSnap.val() as any) : null;
      const totalQuestions = qVal?.questions ? Object.keys(qVal.questions).length : null;

      // normalize return values with authoritative data
      lastScore = typeof p?.score === "number" ? p.score : (lastScore ?? 0);
      lastCorrectCount = typeof correctCount === "number" ? correctCount : (lastCorrectCount ?? 0);
      lastTotalQuestions = typeof totalQuestions === "number" ? totalQuestions : (lastTotalQuestions ?? null);

      // Write/update attempt doc (one per uid) under Firestore
      await admin
        .firestore()
        .collection(`organizations/${orgId}/notes/${noteId}/quizzes/${quizId}/attempts`)
        .doc(uid!)
        .set({
          uid,
          name: bestName,
          score: lastScore ?? 0,
          correctCount: lastCorrectCount ?? 0,
          avgTimeMs,
          finishedAt: now(),
          totalQuestions: lastTotalQuestions,
        });
    } catch (err) {
      console.error("Failed to persist attempt doc:", err);
    }
  }

  try {
    await recomputeAndStoreOrgLeaderboard(orgId, noteId, quizId, uid!);
  } catch (err) {
    console.error("recomputeAndStoreOrgLeaderboard failed", err);
  }

  // IMPORTANT: return stats on finish so client can show accurate mark/percentage immediately
  return {
    ok: true,
    finishedNow,
    score: finishedNow ? (lastScore ?? 0) : undefined,
    correctCount: finishedNow ? (lastCorrectCount ?? 0) : undefined,
    totalQuestions: finishedNow ? (lastTotalQuestions ?? null) : undefined,
  };
});

export const getOrgAsyncLeaderboard = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, noteId, quizId } = req.data as { orgId: string; noteId: string; quizId: string };
  await assertMember(orgId, uid);

  const snap = await db
    .ref(`organizations/${orgId}/notes/${noteId}/quizzes/${quizId}/leaderboard`)
    .get();

  const val = snap.val() || {};
  const items = Array.isArray(val.items) ? val.items : Object.values(val.items || {});
  return { items, updatedAt: val.updatedAt ?? null };
});

/** Get my detailed attempt for a given org quiz (for review) */
export const getMyOrgAsyncAttempt = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, noteId, quizId } = req.data as { orgId: string; noteId: string; quizId: string };
  await assertMember(orgId, uid);

  const pSnap = await db
    .ref(`organizations/${orgId}/notes/${noteId}/quizzes/${quizId}/participants/${uid}`)
    .get();

  if (!pSnap.exists()) return { attempt: null };

  const p = pSnap.val();
  const answers = p?.answers ? (Object.values(p.answers) as any[]) : [];
  const { avgTimeMs, correctCount } = computeAttemptStats(answers);
  return {
    attempt: {
      uid,
      displayName: p?.displayName ?? (await resolveProfileDisplayName(uid!)) ?? uid,
      score: p?.score ?? 0,
      finished: !!p?.finished,
      finishedAt: p?.finishedAt ?? null,
      answers,
      stats: { avgTimeMs, correctCount },
    },
  };
});

/** List my org attempts (light) for quizzes of a given note */
export const listMyOrgAsyncAttempts = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, noteId } = req.data as { orgId: string; noteId: string };
  await assertMember(orgId, uid);

  const idxSnap = await db.ref(`organizations/${orgId}/notes/${noteId}/quizzesIndex`).get();
  const idx = idxSnap.val() || {};
  const quizIds: string[] = Object.keys(idx);

  const attempts: any[] = [];
  for (const qid of quizIds) {
    const pSnap = await db
      .ref(`organizations/${orgId}/notes/${noteId}/quizzes/${qid}/participants/${uid}`)
      .get();
    if (pSnap.exists()) {
      const p = pSnap.val();
      attempts.push({
        quizId: qid,
        finished: !!p?.finished,
        finishedAt: p?.finishedAt ?? null,
        score: p?.score ?? 0,
      });
    }
  }
  attempts.sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
  return { attempts };
});

/* -------------------------------------------------------------------------- */
/*  PERSONAL-ASYNC ATTEMPTS                                                   */
/* -------------------------------------------------------------------------- */

export const startOrResumePersonalAsyncAttempt = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  if (!uid) throw new HttpsError("unauthenticated", "Login required");

  const { quizId } = req.data as { quizId: string };
  const path = `users/${uid}/quizzes/${quizId}`;
  const snap = await db.ref(path).get();
  if (!snap.exists()) throw new HttpsError("not-found", "Quiz not found");

  const quiz = snap.val() as Quiz;
  if (quiz.type !== "personal-async") throw new HttpsError("failed-precondition", "Not a personal quiz");

  await db.ref(`${path}/participants/${uid}`).transaction((p: any) => {
    if (!p) {
      return {
        joinedAt: now(),
        displayName: "You",
        connected: true,
        score: 0,
        currentIndex: 0,
        questionStartAt: now(),
      };
    }
    if (p.connected === false) p.connected = true;
    if (typeof p.questionStartAt !== "number") p.questionStartAt = now();
    return p;
  });

  const cur = await db.ref(`${path}/participants/${uid}/currentIndex`).get();
  return { ok: true, currentIndex: cur.exists() ? Number(cur.val()) : 0 };
});

export const submitPersonalAsyncAnswer = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  if (!uid) throw new HttpsError("unauthenticated", "Login required");

  const { quizId, optionIdx } = req.data as { quizId: string; optionIdx: number };
  if (!quizId || typeof optionIdx !== "number") {
    throw new HttpsError("invalid-argument", "quizId and optionIdx required");
  }

  const quizPath = `users/${uid}/quizzes/${quizId}`;
  let finishedNow = false;

  try {
    await db.ref(quizPath).transaction((q: any) => {
      if (!q || q.type !== "personal-async" || q.state !== "active") return q;

      const user = q.participants?.[uid!];
      if (!user || user.finished) return q;

      const idx = typeof user.currentIndex === "number" ? user.currentIndex : 0;
      const qArr = Object.values(q.questions || {}) as QuizQuestion[];
      qArr.sort((a: any, b: any) => Number(a.id) - Number(b.id));
      const total = qArr.length;

      const question = qArr[idx];
      if (!question) return q;

      const nowTs = now();
      const elapsed = typeof user.questionStartAt === "number" ? nowTs - user.questionStartAt : 0;

      const correct = optionIdx === question.correctIndex;

      if (!q.participants[uid!].answers) q.participants[uid!].answers = {};
      q.participants[uid!].answers[idx] = { optionIdx, timeMs: elapsed, correct };

      if (correct) q.participants[uid!].score = (q.participants[uid!].score || 0) + 1;

      if (idx + 1 >= total) {
        q.participants[uid!].finished = true;
        q.participants[uid!].finishedAt = nowTs;
        delete q.participants[uid!].questionStartAt;
        finishedNow = true;
      } else {
        q.participants[uid!].currentIndex = idx + 1;
        q.participants[uid!].questionStartAt = nowTs;
      }

      return q;
    });
  } catch (err) {
    console.error("submitPersonalAsyncAnswer transaction failed:", err);
    throw new HttpsError("internal", "Could not submit answer. See logs.");
  }

  // Mirror org behavior: on finish, return accurate stats so UI can show mark immediately
  if (finishedNow) {
    const partSnap = await db.ref(`${quizPath}/participants/${uid}`).get();
    const p = partSnap.exists() ? (partSnap.val() as any) : null;
    const answersArr = p?.answers ? (Object.values(p.answers) as any[]) : [];
    const { avgTimeMs, correctCount } = computeAttemptStats(answersArr);

    const quizSnap = await db.ref(quizPath).get();
    const qVal = quizSnap.exists() ? (quizSnap.val() as any) : null;
    const totalQuestions = qVal?.questions ? Object.keys(qVal.questions).length : null;
    const score = typeof p?.score === "number" ? p.score : 0;

    return {
      ok: true,
      finishedNow: true,
      score,
      correctCount,
      totalQuestions,
      avgTimeMs,
    };
  }

  return { ok: true, finishedNow: false };
});

/* -------------------------------------------------------------------------- */
/*  QUIZ DETAIL                                                                */
/* -------------------------------------------------------------------------- */

/** Minimal quiz detail (with questions) for client attempt/review UIs - ORG */
export const getOrgQuizDetail = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, noteId, quizId } = req.data as { orgId: string; noteId: string; quizId: string };
  await assertMember(orgId, uid);

  const snap = await db.ref(`organizations/${orgId}/notes/${noteId}/quizzes/${quizId}`).get();
  if (!snap.exists()) throw new HttpsError("not-found", "Quiz not found");
  const q = snap.val() as Quiz;
  if (q.type !== "org-async") throw new HttpsError("failed-precondition", "Not an org-async quiz");

  const questions = q.questions || {};
  const numQuestions = Object.keys(questions).length;

  const payload = {
    id: q.id,
    title: (q as any).title ?? "Anytime Quiz",
    numQuestions,
    questionDurationSec: q.questionDurationSec ?? 45,
    questions,
  };

  return { quiz: payload };
});

/** Minimal quiz detail (with questions) for client attempt/review UIs - PERSONAL */
export const getPersonalQuizDetail = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  if (!uid) throw new HttpsError("unauthenticated", "Login required");
  const { quizId } = req.data as { quizId: string };
  if (!quizId) throw new HttpsError("invalid-argument", "Missing quizId");

  const snap = await db.ref(`users/${uid}/quizzes/${quizId}`).get();
  if (!snap.exists()) throw new HttpsError("not-found", "Quiz not found");
  const q = snap.val() as Quiz;
  if (q.type !== "personal-async") throw new HttpsError("failed-precondition", "Not a personal quiz");

  const questions = q.questions || {};
  const numQuestions = Object.keys(questions).length;

  return {
    quiz: {
      id: q.id,
      title: (q as any).title ?? "Self Quiz",
      numQuestions,
      questionDurationSec: q.questionDurationSec ?? 45,
      questions,
    },
  };
});

/* -------------------------------------------------------------------------- */
/*  PERSONAL ATTEMPT FETCHES (for review and list)                             */
/* -------------------------------------------------------------------------- */

export const getMyPersonalAsyncAttempt = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  if (!uid) throw new HttpsError("unauthenticated", "Login required");
  const { quizId } = req.data as { quizId: string };
  if (!quizId) throw new HttpsError("invalid-argument", "Missing quizId");

  const pSnap = await db.ref(`users/${uid}/quizzes/${quizId}/participants/${uid}`).get();
  if (!pSnap.exists()) return { attempt: null };

  const p = pSnap.val();
  const answers = p?.answers ? (Object.values(p.answers) as any[]) : [];
  const { avgTimeMs, correctCount } = computeAttemptStats(answers);

  return {
    attempt: {
      uid,
      displayName: p?.displayName ?? "You",
      score: p?.score ?? 0,
      finished: !!p?.finished,
      finishedAt: p?.finishedAt ?? null,
      answers,
      stats: { avgTimeMs, correctCount },
    },
  };
});

export const listMyPersonalAsyncAttempts = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  if (!uid) throw new HttpsError("unauthenticated", "Login required");
  const { noteId } = req.data as { noteId: string };
  if (!noteId) throw new HttpsError("invalid-argument", "Missing noteId");

  // find quiz ids from the note-scoped index
  const idxSnap = await db.ref(`userAsyncQuizzes/${uid}/${noteId}`).get();
  const idxVal = idxSnap.val() || {};
  const quizIds: string[] = Object.keys(idxVal);

  const attempts: any[] = [];
  for (const qid of quizIds) {
    const pSnap = await db.ref(`users/${uid}/quizzes/${qid}/participants/${uid}`).get();
    if (pSnap.exists()) {
      const p = pSnap.val() || {};
      attempts.push({
        quizId: qid,
        finished: !!p.finished,
        finishedAt: p.finishedAt ?? null,
        score: p.score ?? 0,
      });
    }
  }

  attempts.sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
  return { attempts };
});
