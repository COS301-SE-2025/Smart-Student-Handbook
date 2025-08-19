"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { generateFlashcards } from "@/lib/gemini";

/* ----------------------------- Helpers ----------------------------- */
const tidy = (s: string) =>
  s.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\s+/g, " ").trim();
const normalizeQ = (s: string) => tidy(s).toLowerCase();
const stripFences = (s: string) => s.trim().replace(/^```[\w-]*\s*|\s*```$/g, "");

function tryJson(text: string) {
  try {
    const cleaned = stripFences(text);
    const obj = JSON.parse(cleaned);
    const arr =
      Array.isArray(obj)
        ? obj
        : Array.isArray((obj as any).cards)
        ? (obj as any).cards
        : Array.isArray((obj as any).flashcards)
        ? (obj as any).flashcards
        : null;
    if (!arr) return null;
    const out: Array<{ front: string; back: string }> = [];
    for (const item of arr) {
      let front = "",
        back = "";
      if (typeof item === "string") {
        const m = item.match(/^(.*?)\s*::\s*(.+)$/);
        if (m) {
          front = m[1];
          back = m[2];
        }
      } else if (Array.isArray(item) && item.length >= 2) {
        front = String(item[0]);
        back = String(item[1]);
      } else if (typeof item === "object") {
        front =
          (item as any).front ??
          (item as any).question ??
          (item as any).q ??
          "";
        back =
          (item as any).back ?? (item as any).answer ?? (item as any).a ?? "";
      }
      front = tidy(front);
      back = tidy(back);
      if (front && back) out.push({ front, back });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

function tryQARegex(text: string) {
  const t = stripFences(text).replace(/\r\n/g, "\n");
  const re =
    /^Q\s*[:\-–]\s*(.*?)\nA\s*[:\-–]\s*([\s\S]*?)(?=\nQ\s*[:\-–]|$)/gim;
  const out: Array<{ front: string; back: string }> = [];
  for (const m of t.matchAll(re)) {
    const front = tidy(m[1]),
      back = tidy(m[2]);
    if (front && back) out.push({ front, back });
  }
  return out.length ? out : null;
}

function tryLinePairs(text: string) {
  const lines = stripFences(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Array<{ front: string; back: string }> = [];
  for (const line of lines) {
    const m = line.match(/^(.*?)\s*(?:::|->|—|-{1,2}>)\s*(.+)$/);
    if (m) {
      const front = tidy(m[1]),
        back = tidy(m[2]);
      if (front && back) out.push({ front, back });
    }
  }
  return out.length ? out : null;
}

function tryAdjacentPairs(text: string) {
  const lines = stripFences(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const out: Array<{ front: string; back: string }> = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const front = tidy(lines[i]),
      back = tidy(lines[i + 1]);
    if (front && back) out.push({ front, back });
  }
  return out.length ? out : null;
}

function parseFlashcards(raw: string) {
  const candidates =
    tryJson(raw) ??
    tryQARegex(raw) ??
    tryLinePairs(raw) ??
    tryAdjacentPairs(raw) ??
    [];
  const seen = new Set<string>();
  const deduped: Array<{ front: string; back: string }> = [];
  for (const c of candidates) {
    const key = normalizeQ(c.front);
    if (key && !seen.has(key)) {
      seen.add(key);
      deduped.push(c);
    }
  }
  return deduped;
}

/* -------------------------- Component -------------------------- */
type Flashcard = { front: string; back: string };

interface FlashcardGeneratorProps {
  initialText: string;
}

export default function FlashcardGenerator({
  initialText,
}: FlashcardGeneratorProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setFlipped(false);
    try {
      const raw = await generateFlashcards(initialText);
      const rawText = typeof raw === "string" ? raw : JSON.stringify(raw);
      setFlashcards(parseFlashcards(rawText));
      setCurrent(0);
    } catch (err) {
      console.error("Failed to generate flashcards:", err);
    } finally {
      setLoading(false);
    }
  }

  function nextCard() {
    setFlipped(false);
    setCurrent((prev) => (prev + 1) % flashcards.length);
  }
  function prevCard() {
    setFlipped(false);
    setCurrent((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  }
  function reset() {
    setFlipped(false);
    setCurrent(0);
    setFlashcards([]);
  }

  if (loading)
    return (
      <div className="flex justify-center items-center h-52">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  if (!flashcards.length)
    return (
      <Card className="flex flex-col items-start p-4">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Generate Flashcards
          </CardTitle>
        </CardHeader>
        <Button onClick={generate}>Generate</Button>
      </Card>
    );

  return (
    <Card className="flex flex-col items-center">
      <CardHeader className="w-full">
        <CardTitle className="text-lg font-semibold">
          Generate Flashcards
        </CardTitle>
      </CardHeader>

      <div
        className="w-80 h-52 perspective cursor-pointer"
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? "rotate-y-180" : ""
          }`}
        >
          {/* Front */}
          <Card className="absolute inset-0 [backface-visibility:hidden] flex items-center justify-center text-center">
            <CardHeader>
              <CardTitle>Question</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg overflow-auto break-words">
                {flashcards[current].front}
              </p>
            </CardContent>
          </Card>

          {/* Back */}
          <Card className="absolute inset-0 [backface-visibility:hidden] rotate-y-180 flex items-center justify-center text-center">
            <CardHeader>
              <CardTitle>Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg overflow-auto break-words">
                {flashcards[current].back}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-6 items-center">
        <Button onClick={prevCard} variant="outline">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span>
          {current + 1} / {flashcards.length}
        </span>
        <Button onClick={nextCard} variant="outline">
          <ChevronRight className="h-5 w-5" />
        </Button>
        <Button variant="destructive" onClick={reset}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
