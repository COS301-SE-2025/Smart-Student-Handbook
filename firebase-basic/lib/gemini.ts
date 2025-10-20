import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("Missing env var NEXT_PUBLIC_GEMINI_API_KEY");
}

const MODEL_NAME = "gemini-2.0-flash";
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
  options: string[];     
  answerIndex: number;   
  explanation?: string;
};

function sanitizeRichNoteToPlain(input: unknown): string {
  const s = String(input ?? "");
  if (!s) return "";


  try {
    const parsed = JSON.parse(s);
    const lines: string[] = [];

    const walk = (node: any) => {
      if (node == null) return;

      if (typeof node === "string") {
        if (node.trim()) lines.push(node);
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === "object") {
        //  DB shape: array of blocks; each block has content: [{ type:"text", text:"..." }]
        if (Array.isArray((node as any).content)) {
          for (const part of (node as any).content) {
            if (part && typeof part.text === "string" && part.text.trim()) {
              lines.push(part.text);
            }
          }
        }
        // Fallbacks: some editors place text in .text or .content as string
        if (typeof (node as any).text === "string" && (node as any).text.trim()) {
          lines.push((node as any).text);
        }
        if (typeof (node as any).content === "string" && (node as any).content.trim()) {
          lines.push((node as any).content);
        }
        // Recurse over other fields
        for (const v of Object.values(node)) walk(v);
      }
    };

    walk(parsed);
    return lines
      .join(" ")
      .replace(/<[^>]*>/g, " ")          
      .replace(/\bhttps?:\/\/\S+/gi, " ") 
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    
    return s
      .replace(/<[^>]*>/g, " ")
      .replace(/\bhttps?:\/\/\S+/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}


function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function sanitizeItem(raw: any): ClientQuizItem {
  const q = String(raw?.question ?? "").trim();

  const options = Array.isArray(raw?.options)
    ? raw.options.map((o: any) => String(o ?? "").trim()).slice(0, 4)
    : [];
  while (options.length < 4) options.push("N/A");

  let idx = Number(raw?.answerIndex);
  if (!Number.isInteger(idx)) idx = 0;
  idx = clamp(idx, 0, 3);

  const explanation =
    typeof raw?.explanation === "string" ? String(raw.explanation).trim() : undefined;

  return { question: q, options, answerIndex: idx, explanation };
}

/**
 * Strictly: provide sanitized text + ask for the JSON shape. No extra guidance.
 */
export async function generateQuizQuestions(
  note: string,
  numQuestions = 5
): Promise<ClientQuizItem[]> {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const plain = sanitizeRichNoteToPlain(note);
  const count = clamp(Math.floor(numQuestions || 5), 1, 20);

  const prompt = `
Return ONLY a JSON array of exactly ${count} items. Each item must be:

{
  "question": "string",
  "options": ["string","string","string","string"],
  "answerIndex": 0..3,
  "explanation": "string"
}

Use ONLY the following NOTE_TEXT as source:
"""${plain}"""
`.trim();


  const generationConfig: any = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "ARRAY",
      minItems: count,
      maxItems: count,
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: {
            type: "ARRAY",
            minItems: 4,
            maxItems: 4,
            items: { type: "STRING" }
          },
          answerIndex: { type: "INTEGER" },
          explanation: { type: "STRING" }
        },
        required: ["question", "options", "answerIndex"]
      }
    }
  };

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig
  });

  const raw = (await result.response).text().trim();

  
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) {
      const stripped = raw.replace(/```json/gi, "```").replace(/```/g, "").trim();
      parsed = JSON.parse(stripped);
    } else {
      parsed = JSON.parse(m[0]);
    }
  }

  if (!Array.isArray(parsed) || parsed.length !== count) {
    throw new Error("Quiz generation failed: invalid JSON shape.");
  }

  return parsed.map(sanitizeItem);
}
