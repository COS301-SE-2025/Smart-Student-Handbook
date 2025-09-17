"use client"

import { useEffect, useState, useMemo } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, ChevronLeft, ChevronRight, Loader2, Maximize2, Minimize2 } from "lucide-react"
import { generateFlashcards } from "@/lib/gemini"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type FlashCardUI = { number: number; front: string; back: string }

type FlashCardSectionProps = {
  /** Accept either prop name for compatibility */
  initialText?: string
  sourceText?: string

  /** UI-only props */
  className?: string

  /** DB context for ORG notes */
  orgId?: string

  /** DB context for USER notes */
  userId?: string

  /** Current user id (optional, used to infer scope if needed) */
  ownerId?: string

  /** If true, force saving/loading under users/{userId}/... */
  isPersonal?: boolean

  /** legacy (ignored) */
  setNumber?: number

  /** Note id (required to load/save) */
  noteId?: string
}

/* ----------------------------- Parse helpers ----------------------------- */
const tidy = (s: string) =>
  s.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\s+/g, " ").trim()
const normalizeQ = (s: string) => tidy(s).toLowerCase()
const stripFences = (s: string) => s.trim().replace(/^```[\w-]*\s*|\s*```$/g, "")

function tryJson(text: string) {
  try {
    const cleaned = stripFences(text)
    const obj = JSON.parse(cleaned)
    const arr =
      Array.isArray(obj)
        ? obj
        : Array.isArray((obj as any).cards)
          ? (obj as any).cards
          : Array.isArray((obj as any).flashcards)
            ? (obj as any).flashcards
            : null
    if (!arr) return null
    const out: Array<{ front: string; back: string }> = []
    for (const item of arr) {
      let front = "", back = ""
      if (typeof item === "string") {
        const m = item.match(/^(.*?)\s*::\s*(.+)$/)
        if (m) { front = m[1]; back = m[2] }
      } else if (Array.isArray(item) && item.length >= 2) {
        front = String(item[0]); back = String(item[1])
      } else if (typeof item === "object" && item) {
        front = (item as any).front ?? (item as any).question ?? (item as any).q ?? ""
        back = (item as any).back ?? (item as any).answer ?? (item as any).a ?? ""
      }
      front = tidy(front); back = tidy(back)
      if (front && back) out.push({ front, back })
    }
    return out.length ? out : null
  } catch { return null }
}

function tryQARegex(text: string) {
  const t = stripFences(text).replace(/\r\n/g, "\n")
  const re = /^Q\s*[:\-–]\s*(.*?)\nA\s*[:\-–]\s*([\s\S]*?)(?=\nQ\s*[:\-–]|$)/gim
  const out: Array<{ front: string; back: string }> = []
  for (const m of t.matchAll(re)) {
    const front = tidy(m[1]), back = tidy(m[2])
    if (front && back) out.push({ front, back })
  }
  return out.length ? out : null
}

function tryLinePairs(text: string) {
  const lines = stripFences(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const out: Array<{ front: string; back: string }> = []
  for (const line of lines) {
    const m = line.match(/^(.*?)\s*(?:::|->|—|-{1,2}>)\s*(.+)$/)
    if (m) {
      const front = tidy(m[1]), back = tidy(m[2])
      if (front && back) out.push({ front, back })
    }
  }
  return out.length ? out : null
}

function tryAdjacentPairs(text: string) {
  const lines = stripFences(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return null
  const out: Array<{ front: string; back: string }> = []
  for (let i = 0; i < lines.length - 1; i += 2) {
    const front = tidy(lines[i]), back = tidy(lines[i + 1])
    if (front && back) out.push({ front, back })
  }
  return out.length ? out : null
}

function parseFlashcards(raw: string) {
  const candidates =
    tryJson(raw) ?? tryQARegex(raw) ?? tryLinePairs(raw) ?? tryAdjacentPairs(raw) ?? []
  const seen = new Set<string>()
  const deduped: Array<{ front: string; back: string }> = []
  for (const c of candidates) {
    const key = normalizeQ(c.front)
    if (key && !seen.has(key)) { seen.add(key); deduped.push(c) }
  }
  return deduped
}

/* -------------------------- Callables (org & user) -------------------------- */
const callLoadOrgPack = httpsCallable(fns, "loadNoteFlashcardsPack")
const callSaveOrgPack = httpsCallable(fns, "saveNoteFlashcardsPack")
const callLoadUserPack = httpsCallable(fns, "loadUserNoteFlashcardsPack")
const callSaveUserPack = httpsCallable(fns, "saveUserNoteFlashcardsPack")

/* -------------------------------------------------------------------------- */
/*                                Component UI                                */
/* -------------------------------------------------------------------------- */

export default function FlashCardSection({
  initialText,
  sourceText,
  className,
  orgId,
  userId,
  ownerId,
  isPersonal,
  noteId,
}: FlashCardSectionProps) {
  // Text we feed to the AI for generation
  const text = (sourceText ?? initialText ?? "").trim()

  const [flashCards, setFlashCards] = useState<FlashCardUI[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => setIsClient(true), [])

  // Decide scope. User scope if explicitly forced, or if no orgId, or if user owns it.
  const useUserScope = useMemo(() => {
    if (typeof isPersonal === "boolean") return isPersonal
    if (!orgId) return true
    if (userId && ownerId && userId === ownerId) return true
    return false
  }, [isPersonal, orgId, userId, ownerId])

  // Keep overlay tidy on expand/collapse
  useEffect(() => {
    const cls = "overlay-open"
    const el = document.documentElement
    if (isExpanded) {
      el.classList.add(cls)
      document.body.style.overflow = "hidden"
    } else {
      el.classList.remove(cls)
      document.body.style.overflow = ""
    }
    return () => {
      el.classList.remove(cls)
      document.body.style.overflow = ""
    }
  }, [isExpanded])

  const canGenerate = !!text && !isGenerating

  /* -------------------- Load existing pack whenever note changes -------------------- */
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!noteId) return
      setIsLoading(true)
      try {
        if (useUserScope) {
          if (!userId) return
          const res: any = await callLoadUserPack({ userId, noteId })
          const cards = (res?.data?.cards ?? []) as Array<{ number: number; question: string; answer: string }>
          if (!cancelled) {
            const mapped: FlashCardUI[] = cards.map(c => ({
              number: c.number,
              front: tidy(c.question),
              back: tidy(c.answer),
            }))
            setFlashCards(mapped)
            setCurrentCardIndex(0)
            setIsFlipped(false)
          }
        } else {
          if (!orgId) return
          const res: any = await callLoadOrgPack({ orgId, noteId })
          const cards = (res?.data?.cards ?? []) as Array<{ number: number; question: string; answer: string }>
          if (!cancelled) {
            const mapped: FlashCardUI[] = cards.map(c => ({
              number: c.number,
              front: tidy(c.question),
              back: tidy(c.answer),
            }))
            setFlashCards(mapped)
            setCurrentCardIndex(0)
            setIsFlipped(false)
          }
        }
      } catch (e) {
        console.error("[Flashcards] Failed to load:", e)
        if (!cancelled) {
          setFlashCards([])
          setCurrentCardIndex(0)
          setIsFlipped(false)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load()
    return () => { cancelled = true }
  }, [useUserScope, userId, orgId, noteId])

  /* -------------------- Generate + SAVE pack (replace) -------------------- */
  const generateFromAI = async () => {
    if (!text) return
    setIsGenerating(true)
    setIsFlipped(false)
    try {
      const raw = await generateFlashcards(text)
      const rawText = typeof raw === "string" ? raw : JSON.stringify(raw)
      const parsed = parseFlashcards(rawText)

      const mapped: FlashCardUI[] = parsed.map((c, i) => ({
        number: i + 1,
        front: c.front,
        back: c.back,
      }))

      // Update UI immediately
      setFlashCards(mapped)
      setCurrentCardIndex(0)

      // Persist pack (replace)
      const cardsForSave = mapped.map(m => ({ question: m.front, answer: m.back }))

      try {
        if (useUserScope) {
          if (!userId || !noteId) {
            console.warn("[Flashcards] User scope chosen but userId/noteId missing; skipping save.")
          } else {
            const res: any = await callSaveUserPack({
              userId,
              noteId,
              mode: "replace",
              cards: cardsForSave,
            } as any)
            // Optional debug:
            // console.log("[Flashcards] Saved user pack:", res?.data)
          }
        } else {
          if (!orgId || !noteId) {
            console.warn("[Flashcards] Org scope chosen but orgId/noteId missing; skipping save.")
          } else {
            const res: any = await callSaveOrgPack({
              orgId,
              noteId,
              mode: "replace",
              cards: cardsForSave,
            } as any)
            // Optional debug:
            // console.log("[Flashcards] Saved org pack:", res?.data)
          }
        }
      } catch (err) {
        console.error("[Flashcards] Failed to save:", err)
      }
    } catch (error) {
      console.error("[Flashcards] Failed to generate:", error)
      setFlashCards([])
      setCurrentCardIndex(0)
    } finally {
      setIsGenerating(false)
    }
  }

  /* -------------------- UI helpers -------------------- */
  const deleteCurrentCard = () => {
    const next = flashCards.filter((_, i) => i !== currentCardIndex)
    const renumbered = next.map((c, i) => ({ ...c, number: i + 1 }))
    setFlashCards(renumbered)
    if (currentCardIndex >= renumbered.length && renumbered.length > 0) {
      setCurrentCardIndex(renumbered.length - 1)
    } else if (renumbered.length === 0) {
      setCurrentCardIndex(0)
    }
    setIsFlipped(false)
    // (Optional) Persist delete by re-saving pack here if you want live deletes saved.
  }

  const toggleFlip = () => setIsFlipped(f => !f)
  const nextCard = () => {
    if (currentCardIndex < flashCards.length - 1) {
      setCurrentCardIndex(i => i + 1)
      setIsFlipped(false)
    }
  }
  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(i => i - 1)
      setIsFlipped(false)
    }
  }

  const toggleExpanded = () => setIsExpanded(e => !e)
  const currentCard = flashCards[currentCardIndex]

  return (
    <>
      {/* Modal via portal */}
      {isExpanded && isClient &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-black/35 backdrop-blur-[6px] flex items-center justify-center p-4"
            onClick={toggleExpanded}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Card className="w-full max-w-4xl min-w-[900px] h-[90vh] min-h-[700px] max-h-[800px] bg-background shadow-2xl flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between px-6 py-4 border-b shrink-0">
                  <CardTitle className="text-xl">Flash Cards</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={generateFromAI}
                      disabled={!canGenerate}
                      variant="default"
                      size="sm"
                      className="shrink-0 px-4"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating…
                        </>
                      ) : (
                        "Generate Flash Cards"
                      )}
                    </Button>
                    <Button
                      onClick={toggleExpanded}
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0 hover:bg-accent bg-transparent"
                      aria-label="Close modal"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 min-h-0 px-6 pb-6">
                  {isLoading ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading cards…
                    </div>
                  ) : flashCards.length > 0 && currentCard ? (
                    <div className="flex-1 flex flex-col gap-3 min-h-0">
                      <div className="flex items-center justify-between gap-2 text-xs sm:text-sm text-muted-foreground">
                        <span className="whitespace-nowrap font-medium">
                          {currentCardIndex + 1} of {flashCards.length}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            onClick={prevCard}
                            variant="outline"
                            size="sm"
                            disabled={currentCardIndex === 0}
                            className="h-8 w-8 p-0 shrink-0 hover:bg-accent disabled:opacity-50 bg-transparent"
                            aria-label="Previous card"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={nextCard}
                            variant="outline"
                            size="sm"
                            disabled={currentCardIndex === flashCards.length - 1}
                            className="h-8 w-8 p-0 shrink-0 hover:bg-accent disabled:opacity-50 bg-transparent"
                            aria-label="Next card"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex-1 min-h-0 flex justify-center items-center overflow-hidden p-2">
                        <div
                          className="cursor-pointer transition-transform duration-500 hover:shadow-lg [transform-style:preserve-3d] relative rounded-2xl border w-full h-full"
                          onClick={toggleFlip}
                          style={{ transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
                        >
                          {/* Front */}
                          <Card className="absolute inset-0 [backface-visibility:hidden] border bg-background overflow-hidden rounded-2xl">
                            <CardContent className="h-full flex flex-col justify-center items-center relative p-8">
                              <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                                <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-white border-2 border-black">
                                  <span className="font-semibold text-sm uppercase tracking-wide text-black">
                                    Question
                                  </span>
                                </div>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteCurrentCard()
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 shrink-0 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                  aria-label="Delete card"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="text-center w-full px-4 overflow-y-auto max-h-full">
                                <div className="px-2">
                                  <p className="font-medium leading-relaxed text-foreground break-words text-lg md:text-xl">
                                    {currentCard.front}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                          {/* Back */}
                          <Card
                            className="absolute inset-0 [backface-visibility:hidden] border bg-background overflow-hidden rounded-2xl"
                            style={{ transform: "rotateY(180deg)" }}
                          >
                            <CardContent className="h-full flex flex-col p-8">
                              <div className="flex items-center justify-between mb-4">
                                <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-white border-2 border-black">
                                  <span className="font-semibold text-sm uppercase tracking-wide text-black">
                                    Answer
                                  </span>
                                </div>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteCurrentCard();
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 shrink-0 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                  aria-label="Delete card"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>

                              <div className="flex-1 overflow-y-auto w-full text-center px-2">
                                <p className="font-medium leading-relaxed text-foreground break-words text-lg md:text-xl">
                                  {currentCard.back}
                                </p>
                              </div>
                            </CardContent>
                          </Card>

                        </div>
                      </div>

                      <p className="text-center text-muted-foreground text-sm">
                        Click card to flip • Use arrows to navigate
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-muted-foreground text-lg text-center">
                        No flash cards yet. Generate flash cards to see them here.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>,
          document.body
        )
      }

      {/* Inline card view */}
      {!isExpanded && (
        <Card className={`${className ?? ""} h-full w-full`}>
          <CardHeader className="flex flex-row items-center justify-between p-4">
            <CardTitle className="text-lg">Flash Cards</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsExpanded(true)}
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 shrink-0 hover:bg-accent bg-transparent"
                aria-label="Expand"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                onClick={generateFromAI}
                disabled={!canGenerate}
                variant="default"
                size="sm"
                className="shrink-0 px-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Flash Cards
                  </>
                ) : (
                  "Generate Flash Cards"
                )}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col min-h-0 h-[calc(100%-4.25rem)] p-4">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading cards…
              </div>
            ) : flashCards.length > 0 && currentCard ? (
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                <div className="flex items-center justify-between gap-2 text-xs sm:text-sm text-muted-foreground">
                  <span className="whitespace-nowrap font-medium">
                    {currentCardIndex + 1} of {flashCards.length}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      onClick={prevCard}
                      variant="outline"
                      size="sm"
                      disabled={currentCardIndex === 0}
                      className="h-8 w-8 p-0 shrink-0 hover:bg-accent disabled:opacity-50 bg-transparent"
                      aria-label="Previous card"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={nextCard}
                      variant="outline"
                      size="sm"
                      disabled={currentCardIndex === flashCards.length - 1}
                      className="h-8 w-8 p-0 shrink-0 hover:bg-accent disabled:opacity-50 bg-transparent"
                      aria-label="Next card"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 flex justify-center items-center overflow-hidden p-2">
                  <div
                    className="cursor-pointer transition-transform duration-500 hover:shadow-lg [transform-style:preserve-3d] relative rounded-2xl border w-full h-full min-h-[200px] max-h-[280px]"
                    onClick={toggleFlip}
                    style={{ transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
                  >
                    {/* Front */}
                    <Card className="absolute inset-0 [backface-visibility:hidden] border bg-background overflow-hidden rounded-2xl">
                      <CardContent className="h-full flex flex-col justify-center items-center relative p-4">
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                          <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-white border-2 border-black">
                            <span className="font-semibold text-sm uppercase tracking-wide text-black">Question</span>
                          </div>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteCurrentCard()
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 shrink-0 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                            aria-label="Delete card"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="text-center w-full px-4 overflow-y-auto max-h-full">
                          <div className="px-2">
                            <p className="font-medium leading-relaxed text-foreground break-words text-sm md:text-base">
                              {currentCard.front}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Back */}
                    <Card
                      className="absolute inset-0 [backface-visibility:hidden] border bg-background overflow-hidden rounded-2xl"
                      style={{ transform: "rotateY(180deg)" }}
                    >
                      <CardContent className="h-full min-h-0 flex flex-col relative p-4 pt-14">
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                          <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-white border-2 border-black">
                            <span className="font-semibold text-sm uppercase tracking-wide text-black">
                              answer
                            </span>
                          </div>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCurrentCard();
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 shrink-0 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                            aria-label="Delete card"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Scrollable content */}
                        <div className="flex-1 min-h-0 w-full overflow-y-auto px-4 text-center">
                          <p className="font-medium leading-relaxed text-foreground break-words text-sm md:text-base">
                            {currentCard.back}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                  </div>
                </div>

                <p className="text-center text-muted-foreground text-xs">Click card to flip • Use arrows to navigate</p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm"> </p>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
