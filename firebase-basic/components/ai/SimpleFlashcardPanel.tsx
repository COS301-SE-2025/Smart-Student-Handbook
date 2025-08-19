"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { generateFlashcards } from "@/lib/gemini"

/* ----------------------------- Types ----------------------------- */
type FlashCardUI = { number: number; front: string; back: string }

type SimpleFlashCardSectionProps = {
  sourceText: string
  className?: string
}

/* ----------------------------- Helpers ----------------------------- */
const tidy = (s: string) => s.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\s+/g, " ").trim()
const normalizeQ = (s: string) => tidy(s).toLowerCase()
const stripFences = (s: string) => s.trim().replace(/^```[\w-]*\s*|\s*```$/g, "")

function tryJson(text: string): Array<{ front: string; back: string }> | null {
  try {
    const cleaned = stripFences(text)
    const obj = JSON.parse(cleaned)
    const asArray = Array.isArray(obj)
      ? obj
      : Array.isArray((obj as any).cards)
        ? (obj as any).cards
        : Array.isArray((obj as any).flashcards)
          ? (obj as any).flashcards
          : null
    if (!asArray) return null
    const out: Array<{ front: string; back: string }> = []
    for (const item of asArray) {
      let front = "", back = ""
      if (typeof item === "string") {
        const m = item.match(/^(.*?)\s*::\s*(.+)$/)
        if (m) { front = m[1]; back = m[2] }
      } else if (Array.isArray(item) && item.length >= 2) {
        front = String(item[0]); back = String(item[1])
      } else if (typeof item === "object") {
        front = (item as any).front ?? (item as any).question ?? (item as any).q ?? ""
        back = (item as any).back ?? (item as any).answer ?? (item as any).a ?? ""
      }
      front = tidy(front); back = tidy(back)
      if (front && back) out.push({ front, back })
    }
    return out.length ? out : null
  } catch { return null }
}
function tryQARegex(text: string): Array<{ front: string; back: string }> | null {
  const t = stripFences(text).replace(/\r\n/g, "\n")
  const re = /^Q\s*[:\-–]\s*(.*?)\nA\s*[:\-–]\s*([\s\S]*?)(?=\nQ\s*[:\-–]|$)/gim
  const out: Array<{ front: string; back: string }> = []
  for (const m of t.matchAll(re)) {
    const front = tidy(m[1]); const back = tidy(m[2])
    if (front && back) out.push({ front, back })
  }
  return out.length ? out : null
}
function tryLinePairs(text: string): Array<{ front: string; back: string }> | null {
  const lines = stripFences(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const out: Array<{ front: string; back: string }> = []
  for (const line of lines) {
    const m = line.match(/^(.*?)\s*(?:::|->|—|-{1,2}>)\s*(.+)$/)
    if (m) {
      const front = tidy(m[1]); const back = tidy(m[2])
      if (front && back) out.push({ front, back })
    }
  }
  return out.length ? out : null
}
function tryAdjacentPairs(text: string): Array<{ front: string; back: string }> | null {
  const lines = stripFences(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return null
  const out: Array<{ front: string; back: string }> = []
  for (let i = 0; i < lines.length - 1; i += 2) {
    const front = tidy(lines[i]); const back = tidy(lines[i + 1])
    if (front && back) out.push({ front, back })
  }
  return out.length ? out : null
}
function parseFlashcards(raw: string): Array<{ front: string; back: string }> {
  const candidates = tryJson(raw) ?? tryQARegex(raw) ?? tryLinePairs(raw) ?? tryAdjacentPairs(raw) ?? []
  const seen = new Set<string>()
  const deduped: Array<{ front: string; back: string }> = []
  for (const c of candidates) {
    const key = normalizeQ(c.front)
    if (key && !seen.has(key)) { seen.add(key); deduped.push(c) }
  }
  return deduped
}

/* ----------------------------- Component ----------------------------- */
export default function SimpleFlashCardSection({
  sourceText,
  className,
}: SimpleFlashCardSectionProps) {
  const [flashCards, setFlashCards] = useState<FlashCardUI[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const canGenerate = !!(sourceText && sourceText.trim()) && !isGenerating

  const generateFromAI = async () => {
    if (!sourceText.trim()) return
    setIsGenerating(true)
    try {
      const response = await generateFlashcards(sourceText)
      const parsed = parseFlashcards(response)
      const local: FlashCardUI[] = parsed.map((c, i) => ({ number: i + 1, front: c.front, back: c.back }))
      setFlashCards(local)
      setCurrentCardIndex(0)
      setIsFlipped(false)
    } catch (error) {
      console.error("Error generating flashcards:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleFlip = () => setIsFlipped((f) => !f)
  const nextCard = () => currentCardIndex < flashCards.length - 1 && (setCurrentCardIndex((i) => i + 1), setIsFlipped(false))
  const prevCard = () => currentCardIndex > 0 && (setCurrentCardIndex((i) => i - 1), setIsFlipped(false))

  const currentCard = flashCards[currentCardIndex]

  return (
    <Card className={`${className ?? ""} h-full`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Flash Cards</CardTitle>
        <Button onClick={generateFromAI} disabled={!canGenerate}>
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…
            </>
          ) : (
            "Generate Flash Cards"
          )}
        </Button>
      </CardHeader>

      <CardContent className="h-[calc(100%-4.25rem)] flex flex-col min-h-0">
        {flashCards.length > 0 && currentCard ? (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <span className="whitespace-nowrap">{currentCardIndex + 1} of {flashCards.length}</span>
              <div className="flex gap-2">
                <Button onClick={prevCard} variant="outline" size="sm" disabled={currentCardIndex === 0} className="h-8 w-8 p-0 bg-transparent" aria-label="Previous card"><ChevronLeft className="w-4 h-4" /></Button>
                <Button onClick={nextCard} variant="outline" size="sm" disabled={currentCardIndex === flashCards.length - 1} className="h-8 w-8 p-0 bg-transparent" aria-label="Next card"><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 flex justify-center items-center overflow-hidden">
              <div
                className="cursor-pointer transition-transform duration-500 hover:shadow-lg [transform-style:preserve-3d] relative rounded-2xl border w-full max-w-[820px] h-full max-h-full"
                onClick={toggleFlip}
                style={{ transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              >
                {/* Front */}
                <Card className="absolute inset-0 [backface-visibility:hidden] border bg-background overflow-hidden rounded-2xl">
                  <CardContent className="p-6 sm:p-8 h-full flex flex-col relative">
                    <div className="flex items-center justify-center mb-2 sm:mb-3">
                      <span className="font-semibold text-xs sm:text-sm uppercase tracking-wide truncate">
                        Question #{currentCard.number}
                      </span>
                    </div>
                    <div className="flex-1 w-full px-2 flex items-center justify-center overflow-auto">
                      <p className="text-center font-semibold leading-relaxed break-words select-text text-[clamp(14px,2.6vw,22px)] md:text-2xl">
                        {currentCard.front}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Back */}
                <Card
                  className="absolute inset-0 [backface-visibility:hidden] border bg-background overflow-hidden rounded-2xl"
                  style={{ transform: "rotateY(180deg)" }}
                >
                  <CardContent className="p-6 sm:p-8 h-full flex flex-col relative">
                    <div className="flex items-center justify-center mb-2 sm:mb-3">
                      <span className="font-semibold text-xs sm:text-sm uppercase tracking-wide">Answer</span>
                    </div>
                    <div className="flex-1 w-full px-2 flex items-center justify-center overflow-auto">
                      <p className="text-center font-medium leading-relaxed break-words select-text text-[clamp(14px,2.6vw,22px)] md:text-2xl">
                        {currentCard.back}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <p>No flash cards yet.</p>
            <Button onClick={generateFromAI} disabled={!canGenerate}>
              {isGenerating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>) : ("Generate from Note")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
