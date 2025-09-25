// functions/src/quiz/quiz.ts

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type QuizState = "lobby" | "countdown" | "active" | "ended" | "cancelled";

/**
 * Where and how the quiz runs:
 * - "org-live"     : organization, synchronous (lobby → countdown → active), has leaderboard
 * - "org-async"    : organization, asynchronous (per-user), results aggregated to an org leaderboard
 * - "personal-async": personal/self quiz on a user's own note (no leaderboard)
 */
export type QuizType = "org-live" | "org-async" | "personal-async";

export interface CreateQuizInput {
  /** For org quizzes */
  orgId?: string;
  /** Note ID (org or personal) */
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

  // per-user progress (asynchronous or live)
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
  /** Present for org quizzes; omitted for personal quizzes. */
  orgId?: string;
  noteId: string;
  creatorId: string;

  /** live / async / personal */
  type: QuizType;

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
  startedAt?: number;                                // when countdown was started (live)
  countdownEndAt?: number;                           // when countdown ends (ms) (live)
  finishedAt?: number;                               // when quiz ended (ms)

  // summary for review
  endSummary?: {
    leaderboard: LeaderboardEntry[];
    finishedAt: number;
  };
}
