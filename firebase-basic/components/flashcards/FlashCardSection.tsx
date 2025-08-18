"use client"

import { useEffect, useState } from "react"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { generateFlashcards } from "@/lib/gemini"

/* ----------------------------- Types ----------------------------- */
type FlashCardUI = { number: number; front: string; back: string }

type FlashCardSectionProps = {
  sourceText: string
  className?: string
  orgId: string
  ownerId: string // accepted for parity; not stored in minimal schema
  noteId: string
}

// payload/response types for callables
type LoadReq = { orgId: string; noteId: string }
type LoadRes = {
  success: boolean
  orgId: string
  noteId: string
  exists: boolean
  count: number
  cards: Array<{ number: number; question: string; answer: string }>
}

type SaveReq = {
  orgId: string
  noteId: string
  mode?: "append" | "replace"
  cards: Array<{ question: string; answer: string }>
}
type SaveRes = {
  success: boolean
  orgId: string
  noteId: string
  written: number
  mode: "append" | "replace"
}

type DeleteReq =
  | { orgId: string; noteId: string; deleteAll: true; numbers?: never; compact?: boolean }
  | { orgId: string; noteId: string; numbers: number[]; deleteAll?: false; compact?: boolean }
type DeleteRes = {
  success: boolean
  orgId: string
  noteId: string
  deleted: number // -1 when deleteAll
  compacted: boolean
}

/* ------------------------- Typed callables ------------------------ */
// Use the new Pack functions that you deployed
const callLoad = httpsCallable<LoadReq, LoadRes>(fns, "loadNoteFlashcardsPack")
const callSave = httpsCallable<SaveReq, SaveRes>(fns, "saveNoteFlashcardsPack")
const callDelete = httpsCallable<DeleteReq, DeleteRes>(fns, "deleteNoteFlashcardsPack")

/* ----------------------------- Helpers ---------------------------- */
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
      if (item == null) continue
      if (typeof item === "string") {
        const m = item.match(/^(.*?)\s*::\s*(.+)$/)
        if (m) { front = m[1]; back = m[2] }
      } else if (Array.isArray(item) && item.length >= 2) {
        front = String(item[0]); back = String(item[1])
      } else if (typeof item === "object") {
        front = (item as any).front ?? (item as any).question ?? (item as any).q ?? ""
        back = (item as any).back ?? (item as any).answer ?? (item as any).a ?? ""
        front = String(front); back = String(back)
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

/* ------------------------------ Component ------------------------------ */
export default function FlashCardSection({
  sourceText, className, orgId, ownerId: _ownerId, noteId,
}: FlashCardSectionProps) {
  const [flashCards, setFlashCards] = useState<FlashCardUI[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const canGenerate = !!(sourceText && sourceText.trim()) && !isGenerating

  const loadCards = async () => {
    if (!orgId || !noteId) return
    setIsLoading(true)
    try {
      const res = await callLoad({ orgId, noteId })
      const data = res.data
      const exists = (data?.exists ?? false) as boolean
      const cards = (data?.cards ?? []) as LoadRes["cards"]
      const mapped: FlashCardUI[] = cards.map((c) => ({ number: c.number, front: c.question, back: c.answer }))
      setFlashCards(exists ? mapped : [])
      setCurrentCardIndex(0)
      setIsFlipped(false)
    } catch (e) {
      console.error("Failed to load flashcards:", e)
      setFlashCards([])
      setCurrentCardIndex(0)
      setIsFlipped(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadCards()
  }, [orgId, noteId])

  const deleteCurrentCard = async () => {
    const current = flashCards[currentCardIndex]
    if (!current) return
    // optimistic UI
    const next = flashCards.filter((_, i) => i !== currentCardIndex)
    setFlashCards(next)
    if (currentCardIndex >= next.length && next.length > 0) setCurrentCardIndex(next.length - 1)
    else if (next.length === 0) setCurrentCardIndex(0)
    setIsFlipped(false)
    try {
      await callDelete({ orgId, noteId, numbers: [current.number], compact: true })
      await loadCards()
    } catch (e) {
      console.error("Failed to delete flashcard:", e)
      await loadCards()
    }
  }

  const generateFromAI = async () => {
    if (!sourceText.trim()) return
    setIsGenerating(true)
    try {
      const response = await generateFlashcards(sourceText)
      const parsed = parseFlashcards(response)
      if (!parsed.length) {
        setFlashCards([]); setCurrentCardIndex(0); setIsFlipped(false); return
      }
      try {
        await callSave({
          orgId, noteId, mode: "append",
          cards: parsed.map((c) => ({ question: c.front, answer: c.back })),
        })
        await loadCards()
      } catch (e) {
        console.error("Failed to save flashcards in DB, showing locally only:", e)
        const start = flashCards.length
        const local: FlashCardUI[] = parsed.map((c, i) => ({ number: start + i + 1, front: c.front, back: c.back }))
        setFlashCards((prev) => [...prev, ...local]); setCurrentCardIndex(start); setIsFlipped(false)
      }
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
        <div className="flex items-center gap-2">
          <Button onClick={generateFromAI} disabled={!canGenerate}>
            {isGenerating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>) : ("Generate Flash Cards")}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4.25rem)] flex flex-col min-h-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading  cards…
          </p>
        ) : flashCards.length > 0 && currentCard ? (
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
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <div className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md bg-white border text-black shadow-sm max-w-[70%]">
                        <span className="font-semibold text-xs sm:text-sm uppercase tracking-wide truncate">
                          Question #{currentCard.number}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={(e) => { e.stopPropagation(); deleteCurrentCard(); }}
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 p-0 opacity-70 hover:opacity-100"
                          aria-label="Delete card"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 w-full px-2 flex items-center justify-center overflow-auto">
                      <p className="text-center font-semibold leading-relaxed break-words hyphens-auto select-text text-[clamp(12px,2vw,18px)] md:text-lg">
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
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <div className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md bg-white border text-black shadow-sm">
                        <span className="font-semibold text-xs sm:text-sm uppercase tracking-wide">Answer</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={(e) => { e.stopPropagation(); deleteCurrentCard(); }}
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 p-0 opacity-70 hover:opacity-100"
                          aria-label="Delete card"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 w-full px-2 flex items-center justify-center overflow-auto">
                      <p className="text-center font-medium leading-relaxed break-words hyphens-auto select-text text-[clamp(12px,2vw,18px)] md:text-lg">
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
        
      </div>
    )}
      </CardContent>
    </Card>
  )
}
