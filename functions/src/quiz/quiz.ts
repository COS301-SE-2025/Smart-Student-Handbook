// functions/src/quiz/quiz.ts

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type QuizState = "lobby" | "countdown" | "active" | "ended" | "cancelled";

export interface CreateQuizInput {
  orgId: string;
  noteId: string;
  /** Per-question time in seconds */
  questionDurationSec: number;
  /** How many questions to generate */
  numQuestions: number;
}

export interface QuizQuestion {
  id: string;                 // stable id for the question (stringified index)
  question: string;           // the stem
  options: string[];          // exactly 4 options (text)
  correctIndex: number;       // 0..3
  explanation?: string;       // optional explanation shown in review
}

export interface AnswerRecord {
  optionIdx: number;          // 0..3 chosen by user
  timeMs: number;             // time taken to answer this question
  correct: boolean;           // whether it was correct
}

export interface Participant {
  joinedAt: number;                                 // timestamp
  displayName: string;                              // name to show in lobby/leaderboard
  connected: boolean;                               // live presence flag

  // per-user progress (asynchronous)
  currentIndex?: number;                            // user's current question index (0-based)
  questionStartAt?: number;                         // when the user's current question timer started (ms)
  finished?: boolean;                               // user has completed all questions
  finishedAt?: number;                              // when the user finished (ms)

  score: number;                                    // number of correct answers
  answers?: Record<number, AnswerRecord>;           // keyed by questionIndex (0-based)
}

export interface LeaderboardEntry {
  uid: string;
  name: string;
  score: number;
  correctCount: number;
  avgTimeMs: number;
}

export interface Quiz {
  id: string;
  noteId: string;
  creatorId: string;
  state: QuizState;                                  // "lobby" | "countdown" | "active" | "ended" | "cancelled"
  createdAt: number;

  // generation params
  questionDurationSec: number;
  seed: string;

  // questions keyed by id for stability
  questions: Record<string, QuizQuestion>;

  // participants by uid
  participants: Record<string, Participant>;

  // runtime fields
  startedAt?: number;                                // when countdown was started
  countdownEndAt?: number;                           // when countdown ends (ms)

  // (legacy global fields are no longer used but left here for forward/back compat)
  currentIndex?: number;                             // UNUSED after async move
  questionStartAt?: number;                          // UNUSED after async move
  finishedAt?: number;                               // when quiz ended (ms)

  // final summary shown in review
  endSummary?: {
    leaderboard: LeaderboardEntry[];
    finishedAt: number;
  };
}
