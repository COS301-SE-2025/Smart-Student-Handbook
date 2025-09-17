/**
 * AI utilities for summarizing notes, generating flashcards, and producing MCQs.
 * - Tight cleaners strip URLs/citations/editor junk and meta option prefixes.
 * - MCQ generator uses a BYU-inspired prompt, bans meta phrasing, and requests JSON.
 * - Includes robust JSON parsing and final sanitization for client safety.
 *
 * NOTE: Using NEXT_PUBLIC_GEMINI_API_KEY exposes your key to the client.
 * For production, move calls to a server route or Firebase Callable Function.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
if (!API_KEY) {
  // Fail fast in dev so you don't ship a broken build
  throw new Error("Missing env var NEXT_PUBLIC_GEMINI_API_KEY");
}

const MODEL_NAME = "gemini-1.5-pro"; // You can also use "models/gemini-1.5-pro" if your SDK expects that.
const genAI = new GoogleGenerativeAI(API_KEY);

export async function summarizeNote(content: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const prompt = `Summarize the following note in 3–6 concise bullet points, no links or citations:\n\n${content}`;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

export async function generateFlashcards(note: string) {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const prompt = `
Generate concise flashcards from the following notes. Use the exact format:

Q: [question]
A: [answer]

Rules:
- No links, citations, or HTML/markdown.
- Keep each Q/A pair brief and factual.
- Prefer application/understanding over pure recall.
- 6–12 cards.

NOTES:
${note}
  `.trim();

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  return text.trim();
}

export type ClientQuizItem = {
  question: string;
  options: string[];     // length 4
  answerIndex: number;   // 0..3
  explanation?: string;
};

/** Remove leaked JSON/HTML/URLs/wiki artifacts and clamp length. */
function cleanLine(s: string): string {
  let t = (s ?? "").toString().trim();

  // Strip JSON/editor fragments & HTML
  t = t.replace(/\[\s*{\s*"id"\s*:[\s\S]*$/g, "");
  t = t.replace(/"id"\s*:\s*".*?"/g, "");
  t = t.replace(/"type"\s*:\s*".*?"/g, "");
  t = t.replace(/"props"\s*:\s*{[^}]*}/g, "");
  t = t.replace(/<[^>]+>/g, " ");

  // Strip URLs/citations and wiki/link artifacts
  t = t.replace(/\bhttps?:\/\/\S+/gi, " ");
  t = t.replace(/\bcite_note[-\w]*/gi, " ");
  t = t.replace(/\blink\b/gi, " ");
  t = t.replace(/\[\d+\]/g, " "); // [13], [15], etc.

  // Strip common meta prefixes models like to emit
  t = t.replace(
    /^(Key principle implied by|Most defensible statement from|Opposite claim to|Partially true but misleading view of|Tangential trivia about|Ambiguous\/unverifiable note on|Incorrect causal link from|Speculative claim beyond)\s*:\s*/i,
    ""
  );

  // Collapse whitespace and clamp
  t = t.replace(/\s+/g, " ").trim();
  if (t.length > 180) t = t.slice(0, 177) + "...";
  return t;
}

/** Extract plain text from JSON/HTML/strings to avoid leaking editor markup into prompts. */
function extractPlainText(input: string | undefined | null): string {
  const s = (input ?? "").toString();
  if (!s) return "";
  try {
    const parsed = JSON.parse(s);
    const out: string[] = [];
    const walk = (node: any) => {
      if (node == null) return;
      if (typeof node === "string") {
        out.push(node);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === "object") {
        if (typeof (node as any).text === "string") out.push((node as any).text);
        if (typeof (node as any).content === "string") out.push((node as any).content);
        for (const v of Object.values(node)) walk(v);
      }
    };
    walk(parsed);
    return out
      .join(" ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\bhttps?:\/\/\S+/gi, " ")
      .replace(/\bcite_note[-\w]*/gi, " ")
      .replace(/\blink\b/gi, " ")
      .replace(/\[\d+\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return s
      .replace(/<[^>]*>/g, " ")
      .replace(/\bhttps?:\/\/\S+/gi, " ")
      .replace(/\bcite_note[-\w]*/gi, " ")
      .replace(/\blink\b/gi, " ")
      .replace(/\[\d+\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

function sanitizeClientQuestion(raw: any): ClientQuizItem {
  const q = cleanLine(raw?.question ?? "");
  const optsRaw = Array.isArray(raw?.options) ? raw.options : [];
  const options = optsRaw
    .slice(0, 4)
    .map((o: any) => cleanLine(String(o)))
    .filter((o: string) => o.length > 0);

  while (options.length < 4) options.push("N/A");

  let idx = Number(raw?.answerIndex);
  if (!(idx >= 0 && idx < 4)) idx = 0;

  const explanation =
    typeof raw?.explanation === "string" ? cleanLine(raw.explanation) : undefined;

  return { question: q, options: options.slice(0, 4), answerIndex: idx, explanation };
}

/**
 * Client-side generator for MCQs.
 * For production, prefer your server callable (avoids exposing API key).
 */
export async function generateQuizQuestions(
  note: string,
  numQuestions = 5
): Promise<ClientQuizItem[]> {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const plain = extractPlainText(note);
  const count = Math.max(1, Math.min(20, Math.floor(numQuestions || 5)));

  const prompt = `
You are writing ${count} Multiple-Choice Questions (MCQs) from NOTE_TEXT.

Write higher-quality MCQs that assess understanding and application (not mere recall).
Use a direct question format (end stems with a '?').

STRICT BANS:
- Do NOT include URLs, markdown, HTML, citations, the word "link", "cite_note", or bracketed numbers like [13].
- Do NOT use meta option prefixes such as "Key principle implied by:", "Most defensible statement from:", etc.
- Do NOT use "All of the above" or "None of the above".
- Do NOT write negatively phrased questions (avoid "NOT", "EXCEPT").

REQUIREMENTS per item:
- One clear question stem related to NOTE_TEXT.
- Exactly 4 concise, plausible options; only one is clearly correct.
- Options must be homogeneous in content and similar in length.
- Provide a short explanation that cites facts from NOTE_TEXT (no URLs/citations).
- Length limits: stem ≤ 160 chars; each option ≤ 110 chars; explanation ≤ 220 chars.
- Vary the position of the correct answer across questions.

OUTPUT FORMAT:
Return ONLY a JSON array with items shaped as:
{
  "question": "string",
  "options": ["string","string","string","string"],
  "answerIndex": 0..3,
  "explanation": "string"
}

NOTE_TEXT:
"""${plain}"""
`.trim();

  // Ask Gemini to return JSON. Some SDK versions support responseMimeType + responseSchema.
  const generationConfig: any = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "array",
      minItems: count,
      maxItems: count,
      items: {
        type: "object",
        required: ["question", "options", "answerIndex"],
        additionalProperties: false,
        properties: {
          question: { type: "string", maxLength: 160 },
          options: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "string", maxLength: 110 }
          },
          answerIndex: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string", maxLength: 220 }
        }
      }
    }
  };

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig
  });

  const raw = (await result.response).text().trim();

  // Robust parse with fences fallback
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) {
      // Last-chance cleanup (strip ```json / ``` fences)
      const stripped = raw.replace(/```json/gi, "```").replace(/```/g, "").trim();
      try {
        parsed = JSON.parse(stripped);
      } catch {
        console.error("❌ Failed to parse quiz questions:", raw);
        throw new Error("Quiz generation failed. Model did not return valid JSON.");
      }
    } else {
      parsed = JSON.parse(m[0]);
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Quiz generation failed. Empty or invalid array.");
  }

  // Sanitize and enforce final constraints
  const bannedOpt = /(all\s*(of\s*)?the\s*above|none\s*(of\s*)?the\s*above|https?:\/\/|\blink\b|cite_note|\[\d+\])/i;

  const items = parsed.map(sanitizeClientQuestion).slice(0, count).map((it) => {
    it.question = cleanLine(it.question);
    it.options = it.options.map((o) => {
      let v = cleanLine(o);
      if (bannedOpt.test(v)) v = "N/A";
      return v;
    });

    // Ensure exactly 4 options
    if (it.options.length !== 4) {
      while (it.options.length < 4) it.options.push("N/A");
      it.options = it.options.slice(0, 4);
    }

    // Ensure valid answerIndex
    if (!(it.answerIndex >= 0 && it.answerIndex < 4)) it.answerIndex = 0;

    // Optional explanation cleanup
    if (typeof it.explanation === "string") {
      it.explanation = cleanLine(it.explanation);
      if (!it.explanation) delete it.explanation;
    }

    return it;
  });

  return items;
}
