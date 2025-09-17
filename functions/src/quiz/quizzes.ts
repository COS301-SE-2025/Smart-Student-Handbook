// functions/src/quiz/quizzes.ts

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../firebaseAdmin";
import { now } from "./utils/time";
import { extractPlainText } from "./utils/text";
import { generateQuestionsFromNote } from "./generateQuestions";
import type {
  CreateQuizInput,
  QuizQuestion,
  Quiz,
  Participant,
  LeaderboardEntry,
} from "./quiz";

// ---- helpers --------------------------------------------------------------

async function assertMember(orgId: string, uid?: string) {
  if (!uid) throw new HttpsError("unauthenticated", "Login required");
  const member = await db.ref(`organizations/${orgId}/members/${uid}`).get();
  if (!member.exists())
    throw new HttpsError("permission-denied", "Not a member");
}

async function getRole(orgId: string, uid: string) {
  const role = (await db.ref(`organizations/${orgId}/members/${uid}`).get()).val();
  return role as "Admin" | "Member" | undefined;
}

function connectedParticipants(p: any): string[] {
  if (!p) return [];
  return Object.entries(p)
    .filter(([_, v]: any) => v && v.connected !== false) // default connected if not set
    .map(([k]) => k);
}

function computeLeaderboard(participants: any): LeaderboardEntry[] {
  const arr = Object.entries(participants || {}).map(([pid, p]: any) => {
    const ans = p.answers ? Object.values(p.answers) : [];
    const times = ans
      .map((a: any) => a.timeMs)
      .filter((x: any) => typeof x === "number");
    const avgTimeMs = times.length
      ? Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length)
      : 0;
    const correctCount = ans.filter((a: any) => a.correct).length;
    return {
      uid: pid,
      name: p.displayName,
      score: p.score || 0,
      correctCount,
      avgTimeMs,
    };
  });

  arr.sort((a, b) => b.score - a.score || a.avgTimeMs - b.avgTimeMs);
  return arr;
}

async function maybeEndQuiz(orgId: string, quizId: string) {
  const quizPath = `organizations/${orgId}/quizzes/${quizId}`;
  await db.ref(quizPath).transaction((q: any) => {
    if (!q || q.state !== "active") return q;
    const part = q.participants || {};
    const ids = connectedParticipants(part);
    if (ids.length === 0) return q; // nothing to wait on

    const allFinished = ids.every((uid) => !!part?.[uid]?.finished);
    if (!allFinished) return q;

    const leaderboard = computeLeaderboard(part);
    const t = now();
    q.state = "ended";
    q.finishedAt = t;
    q.endSummary = { leaderboard, finishedAt: t };
    return q;
  });

  // Clear active pointer if ended
  const snap = await db.ref(quizPath).get();
  const q = snap.val();
  if (q?.state === "ended" && q?.noteId) {
    await db.ref(`organizationActiveQuiz/${orgId}/${q.noteId}`).set(null);
  }
}

// ---- callables ------------------------------------------------------------

export const createQuiz = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, noteId, questionDurationSec, numQuestions } =
    req.data as CreateQuizInput;

  await assertMember(orgId, uid);
  if ((await getRole(orgId, uid!)) !== "Admin")
    throw new HttpsError("permission-denied", "Admin only");

  const noteSnap = await db.ref(`organizations/${orgId}/notes/${noteId}`).get();
  if (!noteSnap.exists()) throw new HttpsError("not-found", "Note not found");
  const note = noteSnap.val() as { content?: string };

  // Convert rich note to plain text for generator
  const raw = note.content ?? "";
  const plain = extractPlainText(raw);

  const quizId = db.ref(`organizations/${orgId}/quizzes`).push().key!;
  const seed = `${noteId}:${uid}:${now()}`;
  const questions: QuizQuestion[] = await generateQuestionsFromNote(
    plain,
    numQuestions,
    seed
  );

  const quiz: Quiz = {
    id: quizId,
    noteId,
    creatorId: uid!,
    state: "lobby",
    createdAt: now(),
    questionDurationSec,
    seed,
    questions: questions.reduce(
      (acc, q) => ((acc[q.id] = q), acc),
      {} as Record<string, QuizQuestion>
    ),
    participants: {},
  };

  const updates: Record<string, any> = {};
  updates[`organizations/${orgId}/quizzes/${quizId}`] = quiz;
  updates[`organizationActiveQuiz/${orgId}/${noteId}`] = quizId;
  updates[`userQuizSessions/${uid}/${orgId}/${quizId}`] = true;

  await db.ref().update(updates);
  return { quizId };
});

export const joinQuiz = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, quizId, displayName } = req.data as {
    orgId: string;
    quizId: string;
    displayName: string;
  };

  await assertMember(orgId, uid);

  const path = `organizations/${orgId}/quizzes/${quizId}`;
  const snap = await db.ref(path).get();
  if (!snap.exists()) throw new HttpsError("not-found", "Quiz not found");
  const quiz = snap.val() as Quiz;
  if (!["lobby", "active", "countdown"].includes(quiz.state))
    throw new HttpsError("failed-precondition", "Quiz not joinable");

  const p: Partial<Participant> = {
    joinedAt: now(),
    displayName,
    connected: true,
    score: 0,
  };

  // If the quiz is already active, initialize per-user progress
  if (quiz.state === "active") {
    p.currentIndex = 0;
    p.questionStartAt = now();
  }

  await db.ref(`${path}/participants/${uid}`).update(p);
  await db.ref(`userQuizSessions/${uid}/${orgId}/${quizId}`).set(true);
  return { ok: true };
});

// ADMIN: start → countdown (5s)
export const startQuiz = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, quizId } = req.data as { orgId: string; quizId: string };

  await assertMember(orgId, uid);
  if ((await getRole(orgId, uid!)) !== "Admin")
    throw new HttpsError("permission-denied", "Admin only");

  const quizRef = db.ref(`organizations/${orgId}/quizzes/${quizId}`);
  const t = now();
  const countdownMs = 5000;

  await quizRef.update({
    state: "countdown",
    startedAt: t,
    countdownEndAt: t + countdownMs,
  });
  return { ok: true, countdownEndAt: t + countdownMs, countdownMs };
});

/**
 * advanceIfReady now ONLY handles countdown→active.
 * When countdown completes, quiz becomes active and each existing participant gets
 * currentIndex=0 and questionStartAt=now (if not already set).
 */
export const advanceIfReady = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, quizId } = req.data as { orgId: string; quizId: string };
  await assertMember(orgId, uid);

  const quizPath = `organizations/${orgId}/quizzes/${quizId}`;
  let transitioned = false;

  await db.ref(quizPath).transaction((q: any) => {
    if (!q) return q;

    const nowTs = now();

    if (q.state === "countdown") {
      if (typeof q.countdownEndAt === "number" && nowTs >= q.countdownEndAt) {
        q.state = "active";

        // Initialize per-user progress for all joined participants
        const part = q.participants || {};
        Object.keys(part).forEach((pid) => {
          const p = part[pid] || {};
          if (p.finished) return;
          if (typeof p.currentIndex !== "number") p.currentIndex = 0;
          if (typeof p.questionStartAt !== "number") p.questionStartAt = nowTs;
        });

        transitioned = true;
      }
    }

    return q;
  });

  return { ok: true, transitioned };
});

/**
 * Submit an answer for the user's current question.
 * - Validates per-user timer window.
 * - Records the answer and bumps the user's currentIndex + resets timer.
 * - If user finished last question, marks finished and checks end condition.
 */
export const submitAnswer = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, quizId, optionIdx } = req.data as {
    orgId: string;
    quizId: string;
    optionIdx: number;
  };

  await assertMember(orgId, uid);

  const quizPath = `organizations/${orgId}/quizzes/${quizId}`;

  // We'll do a transaction on the user sub-tree to avoid race conditions
  let finishedNow = false;

  await db.ref(quizPath).transaction((q: any) => {
    if (!q || q.state !== "active") return q;

    const user = q.participants?.[uid!];
    if (!user || user.finished) return q;

    const idx = typeof user.currentIndex === "number" ? user.currentIndex : 0;
    const questions = q.questions || {};
    const qArr = Object.values(questions) as QuizQuestion[];
    qArr.sort((a: any, b: any) => Number(a.id) - Number(b.id));
    const total = qArr.length;

    const question = qArr[idx];
    if (!question) return q;

    const startAt = user.questionStartAt as number | undefined;
    const durationMs = (q.questionDurationSec as number) * 1000;
    const nowTs = now();
    const elapsed = typeof startAt === "number" ? nowTs - startAt : 0;

    if (elapsed > durationMs) {
      throw new HttpsError("deadline-exceeded", "Too late");
    }

    const correct = optionIdx === question.correctIndex;

    // record answer
    if (!q.participants[uid!].answers) q.participants[uid!].answers = {};
    q.participants[uid!].answers[idx] = { optionIdx, timeMs: elapsed, correct };

    // update score
    if (correct) {
      const s = q.participants[uid!].score || 0;
      q.participants[uid!].score = s + 1;
    }

    // advance user or finish
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

  // If user finished just now, check if quiz can end
  if (finishedNow) {
    await maybeEndQuiz(orgId, quizId);
  }

  return { ok: true };
});

export const endQuiz = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, quizId } = req.data as { orgId: string; quizId: string };

  await assertMember(orgId, uid);
  if ((await getRole(orgId, uid!)) !== "Admin")
    throw new HttpsError("permission-denied", "Admin only");

  const quizPath = `organizations/${orgId}/quizzes/${quizId}`;
  const snap = await db.ref(quizPath).get();
  if (!snap.exists()) throw new HttpsError("not-found", "Quiz not found");
  const quiz = snap.val() as any;

  const participants = quiz.participants || {};
  const leaderboard = computeLeaderboard(participants);

  const updates: Record<string, any> = {};
  updates[`${quizPath}/state`] = "ended";
  updates[`${quizPath}/finishedAt`] = now();
  updates[`${quizPath}/endSummary`] = { leaderboard, finishedAt: now() };
  updates[`organizationActiveQuiz/${orgId}/${quiz.noteId}`] = null;

  await db.ref().update(updates);
  return { ok: true };
});

export const leaveQuiz = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, quizId } = req.data as { orgId: string; quizId: string };

  await assertMember(orgId, uid);
  await db
    .ref(`organizations/${orgId}/quizzes/${quizId}/participants/${uid}`)
    .update({ connected: false });
  return { ok: true };
});

export const cancelQuiz = onCall(async (req) => {
  const uid = req.auth?.uid as string | undefined;
  const { orgId, quizId } = req.data as { orgId: string; quizId: string };

  await assertMember(orgId, uid);
  if ((await getRole(orgId, uid!)) !== "Admin")
    throw new HttpsError("permission-denied", "Admin only");

  const quizPath = `organizations/${orgId}/quizzes/${quizId}`;
  const snap = await db.ref(quizPath).get();
  if (!snap.exists()) throw new HttpsError("not-found", "Quiz not found");
  const quiz = snap.val() as any;

  const updates: Record<string, any> = {};
  updates[`${quizPath}/state`] = "cancelled";
  updates[`organizationActiveQuiz/${orgId}/${quiz.noteId}`] = null;

  await db.ref().update(updates);
  return { ok: true };
});
