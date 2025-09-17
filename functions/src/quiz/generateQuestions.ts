// functions/src/quiz/generateQuestions.ts
import crypto from "crypto";
import type { QuizQuestion } from "./quiz";

/**
 * Deterministic RNG based on a seed string.
 * Use the same seed to reproduce the same question/option order.
 */
export function pseudoRandom(seed: string) {
  const hash = crypto.createHash("sha256").update(seed).digest();
  let i = 0;
  return () => hash[i++ % hash.length] / 255; // 0..1
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** crude keyphrase extraction: pick varied “terms” from the note deterministically */
function extractSnippets(note: string, want: number, rand: () => number): string[] {
  const plain = (note || "").replace(/\s+/g, " ").trim();

  // Split by sentences first; fall back to chunking words if too short.
  const sentenceCandidates = plain
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 25);

  let pool: string[];
  if (sentenceCandidates.length >= Math.max(5, Math.ceil(want / 2))) {
    pool = sentenceCandidates.map(s => s.length > 160 ? s.slice(0, 157) + "…" : s);
  } else {
    const words = plain.split(/\s+/).filter(Boolean);
    const chunkSize = 10 + Math.floor(rand() * 10); // 10–19 words
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      const part = words.slice(i, i + chunkSize).join(" ");
      if (part.length >= 25) chunks.push(part.length > 160 ? part.slice(0, 157) + "…" : part);
    }
    pool = chunks;
  }

  if (pool.length === 0) {
    return Array.from({ length: want }, () => "the provided study note");
  }

  // Deterministically sample distinct snippets
  const chosen: string[] = [];
  const used = new Set<number>();
  const cap = Math.min(want, pool.length);
  while (chosen.length < cap) {
    const idx = Math.floor(rand() * pool.length);
    if (!used.has(idx)) {
      used.add(idx);
      chosen.push(pool[idx]);
    }
  }
  // If still short, pad with random picks (unlikely)
  while (chosen.length < want) {
    chosen.push(pool[Math.floor(rand() * pool.length)]);
  }
  return chosen;
}

/**
 * Very lightweight fallback generator.
 * Keep this even if you add Gemini: it's handy for tests or if the LLM is unavailable.
 */
export async function generateQuestionsFromNote(
  noteContent: string,
  num: number,
  seed: string
): Promise<QuizQuestion[]> {
  const rand = pseudoRandom(seed);

  // Clamp to a sensible range (2–30)
  const n = Math.max(2, Math.min(30, Math.floor(num || 5)));

  const snippets = extractSnippets(noteContent, n, rand);

  const templates = [
    (s: string) => `Which statement best reflects the core idea of: "${s}"?`,
    (s: string) => `What is the most accurate takeaway from: "${s}"?`,
    (s: string) => `Based on this note excerpt, which is most correct: "${s}"?`,
    (s: string) => `Choose the best summary of: "${s}"`,
  ];

  const optionMolds = [
    (s: string) => [
      `Accurate summary of: ${s}`,
      `Overgeneralization of: ${s}`,
      `Common misconception about: ${s}`,
      `Irrelevant detail unrelated to: ${s}`,
    ],
    (s: string) => [
      `Key principle implied by: ${s}`,
      `Opposite claim to: ${s}`,
      `Partially true but misleading view of: ${s}`,
      `Tangential trivia about: ${s}`,
    ],
    (s: string) => [
      `Most defensible statement from: ${s}`,
      `Speculative claim beyond: ${s}`,
      `Incorrect causal link from: ${s}`,
      `Ambiguous/unverifiable note on: ${s}`,
    ],
  ];

  // Build questions with variety
  const base = Array.from({ length: n }).map((_, i) => {
    const s = snippets[i] ?? "the provided study note";
    const stem = templates[Math.floor(rand() * templates.length)](s);

    const rawOptions = optionMolds[Math.floor(rand() * optionMolds.length)](s);
    // Choose correct deterministically but not always 0
    const correctIndex = Math.floor(rand() * rawOptions.length);

    // Shuffle options and track new index
    const shuffled = shuffle(rawOptions, rand);
    const correctText = rawOptions[correctIndex];
    const newCorrect = Math.max(0, shuffled.findIndex(o => o === correctText));

    const q: QuizQuestion = {
      id: String(i),
      question: stem,
      options: shuffled.map(o => o.trim()),
      correctIndex: newCorrect,
      explanation: "Picked as the most accurate/defensible statement for this excerpt.",
    };

    return q;
  });

  // Shuffle question order for variability (still deterministic by seed)
  const questions = shuffle(base, rand);

  // Final light shuffle to reduce predictability in options
  for (const q of questions) {
    const before = q.options.slice();
    q.options = shuffle(q.options, rand);
    q.correctIndex = q.options.findIndex(o => o === before[q.correctIndex]);
    if (q.correctIndex < 0) q.correctIndex = 0;
  }

  return questions;
}
