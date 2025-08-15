"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { generateFlashcards } from "@/lib/gemini"

type FlashCard = { id: string; front: string; back: string }

type FlashCardSectionProps = {
  sourceText: string
  className?: string
}

const makeId = (i = 0) =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ai-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`

const tidy = (s: string) =>
  s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim()

const normalizeQ = (s: string) => tidy(s).toLowerCase()
const stripFences = (s: string) => s.trim().replace(/^```[\w-]*\s*|\s*```$/g, "")

function tryJson(text: string): FlashCard[] | null {
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

    const out: FlashCard[] = []
    let i = 0
    for (const item of asArray) {
      let front = "",
        back = ""
      if (item == null) continue
      if (typeof item === "string") {
        const m = item.match(/^(.*?)\s*::\s*(.+)$/)
        if (m) {
          front = m[1]
          back = m[2]
        }
      } else if (Array.isArray(item) && item.length >= 2) {
        front = String(item[0])
        back = String(item[1])
      } else if (typeof item === "object") {
        front = (item.front ?? item.question ?? item.q ?? "").toString()
        back = (item.back ?? item.answer ?? item.a ?? "").toString()
      }
      front = tidy(front)
      back = tidy(back)
      if (front && back) out.push({ id: makeId(i++), front, back })
    }
    return out.length ? out : null
  } catch {
    return null
  }
}

function tryQARegex(text: string): FlashCard[] | null {
  const t = stripFences(text).replace(/\r\n/g, "\n")
  const re = /^Q\s*[:\-–]\s*(.*?)\nA\s*[:\-–]\s*([\s\S]*?)(?=\nQ\s*[:\-–]|$)/gim
  const out: FlashCard[] = []
  let i = 0
  for (const m of t.matchAll(re)) {
    const front = tidy(m[1])
    const back = tidy(m[2])
    if (front && back) out.push({ id: makeId(i++), front, back })
  }
  return out.length ? out : null
}

function tryLinePairs(text: string): FlashCard[] | null {
  const lines = stripFences(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const out: FlashCard[] = []
  let i = 0
  for (const line of lines) {
    const m = line.match(/^(.*?)\s*(?:::|->|—|-{1,2}>)\s*(.+)$/)
    if (m) {
      const front = tidy(m[1])
      const back = tidy(m[2])
      if (front && back) out.push({ id: makeId(i++), front, back })
    }
  }
  return out.length ? out : null
}

function tryAdjacentPairs(text: string): FlashCard[] | null {
  const lines = stripFences(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return null
  const out: FlashCard[] = []
  for (let i = 0, k = 0; i < lines.length - 1; i += 2, k++) {
    const front = tidy(lines[i])
    const back = tidy(lines[i + 1])
    if (front && back) out.push({ id: makeId(k), front, back })
  }
  return out.length ? out : null
}

function parseFlashcards(raw: string): FlashCard[] {
  const candidates = tryJson(raw) ?? tryQARegex(raw) ?? tryLinePairs(raw) ?? tryAdjacentPairs(raw) ?? []
  const seen = new Set<string>()
  const deduped: FlashCard[] = []
  for (const c of candidates) {
    const key = normalizeQ(c.front)
    if (key && !seen.has(key)) {
      seen.add(key)
      deduped.push(c)
    }
  }
  return deduped
}

export default function FlashCardSection({ sourceText, className }: FlashCardSectionProps) {
  const [flashCards, setFlashCards] = useState<FlashCard[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const deleteFlashCard = (id: string) => {
    setFlashCards((prev) => {
      const next = prev.filter((c) => c.id !== id)
      if (currentCardIndex >= next.length && next.length > 0) setCurrentCardIndex(next.length - 1)
      else if (next.length === 0) setCurrentCardIndex(0)
      return next
    })
    setIsFlipped(false)
  }

  const toggleFlip = () => setIsFlipped((f) => !f)
  const nextCard = () =>
    currentCardIndex < flashCards.length - 1 && (setCurrentCardIndex((i) => i + 1), setIsFlipped(false))
  const prevCard = () => currentCardIndex > 0 && (setCurrentCardIndex((i) => i - 1), setIsFlipped(false))

  const generateFromAI = async () => {
    if (!sourceText.trim()) return
    setIsGenerating(true)
    try {
      const response = await generateFlashcards(sourceText)
      const cards = parseFlashcards(response)
      if (cards.length) {
        setFlashCards(cards)
        setCurrentCardIndex(0)
        setIsFlipped(false)
      } else {
        console.warn("No parsable flashcards from model output.")
        setFlashCards([])
      }
    } catch (error) {
      console.error("Error generating flashcards:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const currentCard = flashCards[currentCardIndex]
  const canGenerate = !!(sourceText && sourceText.trim()) && !isGenerating

  return (
    <Card className={className}>
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

      <CardContent>
        {flashCards.length > 0 && currentCard ? (
          <div className="space-y-3">
            {/* Navigation controls */}
            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <span className="whitespace-nowrap">
                {currentCardIndex + 1} of {flashCards.length}
              </span>
              <div className="flex gap-2">
                <Button
                  onClick={prevCard}
                  variant="outline"
                  size="sm"
                  disabled={currentCardIndex === 0}
                  className="h-8 w-8 p-0 bg-transparent"
                  aria-label="Previous card"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  onClick={nextCard}
                  variant="outline"
                  size="sm"
                  disabled={currentCardIndex === flashCards.length - 1}
                  className="h-8 w-8 p-0 bg-transparent"
                  aria-label="Next card"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Flip card */}
            <div className="perspective-1000 flex justify-center items-center overflow-hidden">
              <div
                className="cursor-pointer transition-transform duration-500 hover:shadow-lg [transform-style:preserve-3d] w-full max-w-[380px] aspect-[5/3] relative rounded-xl"
                onClick={toggleFlip}
                style={{ transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              >
                {/* Front */}
                <Card className="absolute inset-0 [backface-visibility:hidden] border hover:shadow-lg bg-background overflow-hidden">
                  <CardContent className="p-3 sm:p-4 h-full flex flex-col justify-center relative">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteFlashCard(currentCard.id)
                      }}
                      variant="ghost"
                      size="icon"
                      className="absolute top-1.5 right-1.5 h-7 w-7 p-0 opacity-70 hover:opacity-100"
                      aria-label="Delete card"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>

                    <div className="text-center w-full px-2">
                      <div className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-muted mb-2">
                        <span className="text-foreground/80 font-medium text-xs">Question</span>
                      </div>
                      <div className="max-h-16 overflow-hidden">
                        <p className="text-sm font-medium leading-relaxed text-foreground break-words line-clamp-3">
                          {currentCard.front}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Back */}
                <Card
                  className="absolute inset-0 [backface-visibility:hidden] border hover:shadow-lg bg-background overflow-hidden"
                  style={{ transform: "rotateY(180deg)" }}
                >
                  <CardContent className="p-3 sm:p-4 h-full flex flex-col justify-center relative">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteFlashCard(currentCard.id)
                      }}
                      variant="ghost"
                      size="icon"
                      className="absolute top-1.5 right-1.5 h-7 w-7 p-0 opacity-70 hover:opacity-100"
                      aria-label="Delete card"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>

                    <div className="text-center w-full px-2">
                      <div className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-muted mb-2">
                        <span className="text-foreground/80 font-medium text-xs">Answer</span>
                      </div>
                      <div className="max-h-16 overflow-hidden">
                        <p className="text-sm font-medium leading-relaxed text-foreground break-words line-clamp-3">
                          {currentCard.back}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <p className="text-center text-[11px] text-muted-foreground">Click card to flip • Use arrows to navigate</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No flash cards yet. Generate flash cards to see them here.</p>
        )}

        <style jsx>{`
          .perspective-1000 { perspective: 1000px; }
        `}</style>
      </CardContent>
    </Card>
  )
}
