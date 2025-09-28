"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import Ribbon, { type RibbonSection } from "@/components/ribbon/Ribbon"
import EditorMain from "@/components/YjsEditor/EditorMain"
import RightNotesPanel from "./RightNotesPanel"
import { httpsCallable } from "firebase/functions"
import { fns, db } from "@/lib/firebase"
import { get, ref, update } from "firebase/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Loader2, X } from "lucide-react"
import { createPortal } from "react-dom"
import { generateQuizQuestions, type ClientQuizItem } from "@/lib/gemini"

/** Defensive dynamic panels to avoid hard crashes if a file is missing */
const SummaryPanel = dynamic(
  () =>
    import("@/components/ai/SummaryPanel")
      .then((m) => m.default)
      .catch(() => () => <div className="p-4 text-sm text-muted-foreground">Summary unavailable.</div>),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading summary…</div> },
)
const FlashCardSection = dynamic(
  () =>
    import("@/components/flashcards/FlashCardSection")
      .then((m) => m.default)
      .catch(() => () => <div className="p-4 text-sm text-muted-foreground">Flashcards unavailable.</div>),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading flashcards…</div> },
)

/* --------------------------------- Types --------------------------------- */
export type Note = {
  ownerId: string
  id: string
  name: string
  content: string
  type: "note"
  createdAt?: number
  updatedAt?: number
}

type NotesSplitViewProps = {
  notes: Note[]
  userID: string
  selectedId?: string
  onSelect?: (noteId: string) => void
  initialSelectedId?: string | null
  loading?: boolean
  title?: string
  onTitleChange?: (name: string) => void
  onTitleCommit?: () => void
}

/* ------------------------------ Utilities -------------------------------- */
function htmlToPlain(html: string): string {
  if (!html) return ""
  const doc = new DOMParser().parseFromString(html, "text/html")
  return (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim()
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function fmtMs(ms: number | undefined) {
  if (!ms) return "0s"
  return `${Math.round(ms / 1000)}s`
}

/* --------------------------- Firebase callables --------------------------- */
const callUpdateNoteFn = httpsCallable(fns, "updateNoteAtPath")
async function callUpdateNote(path: string, note: Partial<Note>) {
  await callUpdateNoteFn({ path, note })
}

/* ---------------------- Personal Quiz Inline Component -------------------- */

type QuizListItem = {
  id: string
  title: string
  numQuestions: number
  questionDurationSec: number
  createdAt?: number
}

type AttemptLight = {
  quizId: string
  finished: boolean
  finishedAt: number | null
  score: number
}

type AttemptAnswer = {
  optionIdx: number
  timeMs: number
  correct: boolean
}

type PersonalQuizDetail = {
  id: string
  title?: string
  numQuestions: number
  questionDurationSec: number
  questions: {
    [id: string]: {
      id: string
      question: string
      options: string[]
      correctIndex: number
      explanation?: string
    }
  }
  // UI-only fields for completion screen:
  showCompletion?: boolean
  finalScore?: number
  totalQuestions?: number
}

function PersonalQuizBarInline({
  userId,
  noteId,
  displayName = "You",
  defaultDurationSec = 45,
  defaultNumQuestions = 5,
}: {
  userId: string
  noteId: string
  displayName?: string
  defaultDurationSec?: number
  defaultNumQuestions?: number
}) {
  // folders
  const [expandedFolders, setExpandedFolders] = useState({ active: true, completed: true })
  // data
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([])
  const [myAttempts, setMyAttempts] = useState<AttemptLight[]>([])
  // selections
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null)

  // loading flags
  const [loadingActive, setLoadingActive] = useState(false)
  const [loadingCompleted, setLoadingCompleted] = useState(false)
  const [creating, setCreating] = useState(false)
  const [attemptLoading, setAttemptLoading] = useState(false)
  const [submittingAnswer, setSubmittingAnswer] = useState(false)

  // create modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [createNumQuestions, setCreateNumQuestions] = useState<number>(defaultNumQuestions)
  const [createDurationSec, setCreateDurationSec] = useState<number>(defaultDurationSec)
  const [createPreview, setCreatePreview] = useState<ClientQuizItem[] | null>(null)
  const createdRef = useRef<{ createdQuizId?: string }>({})

  // attempt modal state
  const [attemptOpen, setAttemptOpen] = useState(false)
  const [attemptQuizDetail, setAttemptQuizDetail] = useState<PersonalQuizDetail | null>(null)
  const [attemptIndex, setAttemptIndex] = useState<number>(0)
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null)
  const [answerFeedback, setAnswerFeedback] = useState<{ index: number; correct: boolean } | null>(null)

  // force fresh render key for in-place restart
  const [attemptRunKey, setAttemptRunKey] = useState(0)

  // buffer the finished result until modal is closed
  const pendingResultRef = useRef<{ quizId: string; score: number; total: number } | null>(null)

  // review modal state (NEW)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewAttempt, setReviewAttempt] = useState<{
    score: number
    finished: boolean
    finishedAt: number | null
    answers: AttemptAnswer[]
    stats: { avgTimeMs: number; correctCount: number }
  } | null>(null)
  const [reviewQuizDetail, setReviewQuizDetail] = useState<PersonalQuizDetail | null>(null)
  const [reviewIndex, setReviewIndex] = useState(0)

  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])

  // Partition quizzes based on attempt list
  const finishedIds = useMemo(() => new Set(myAttempts.filter((a) => a.finished).map((a) => a.quizId)), [myAttempts])
  const activeQuizzes = useMemo(() => quizzes.filter((q) => !finishedIds.has(q.id)), [quizzes, finishedIds])
  const completedQuizzes = useMemo(() => quizzes.filter((q) => finishedIds.has(q.id)), [quizzes, finishedIds])

  // ----- Load list + attempts -----
  async function refreshLists() {
    setLoadingActive(true)
    setLoadingCompleted(true)
    try {
      const listFn = httpsCallable(fns, "listPersonalAsyncQuizzes")
      const mineFn = httpsCallable(fns, "listMyPersonalAsyncAttempts")
      const [{ data: ld }, { data: md }]: any = await Promise.all([listFn({ noteId }), mineFn({ noteId })])
      setQuizzes((ld?.items || []) as QuizListItem[])
      setMyAttempts((md?.attempts || []) as AttemptLight[])
    } finally {
      setLoadingActive(false)
      setLoadingCompleted(false)
    }
  }

  useEffect(() => {
    if (userId && noteId) refreshLists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, noteId])

  // ----- Create flow -----
  function handleOpenCreate() {
    setCreateOpen(true)
    setCreatePreview(null)
    setCreateNumQuestions(defaultNumQuestions)
    setCreateDurationSec(defaultDurationSec)
  }

  async function handleGenerateFromNote() {
    setCreating(true)
    setCreatePreview(null)
    try {
      const noteSnap = await get(ref(db, `users/${userId}/notes/${noteId}/content`))
      const noteContent = noteSnap.exists() ? String(noteSnap.val() ?? "") : ""
      const items = await generateQuizQuestions(noteContent, createNumQuestions)
      setCreatePreview(items)
    } catch (e) {
      console.error("Personal quiz generation failed:", e)
      alert("Quiz generation failed. Check console/logs.")
    } finally {
      setCreating(false)
    }
  }

  async function handleCreatePersonal() {
    if (!createPreview || createPreview.length === 0) return
    setCreating(true)
    try {
      const createFn = httpsCallable(fns, "createSelfAsyncQuiz")
      const questions = createPreview.map((q, i) => ({
        id: String(i),
        question: q.question,
        options: q.options,
        correctIndex: q.answerIndex,
        explanation: q.explanation ?? "",
      }))

      const quizLetter = String.fromCharCode(65 + quizzes.length) // A, B, C, etc.
      const quizTitle = `Quiz ${quizLetter}`

      const { data }: any = await createFn({
        noteId,
        questionDurationSec: createDurationSec,
        questions,
        title: quizTitle,
      })
      await refreshLists()
      const newId = data?.quizId as string
      createdRef.current.createdQuizId = newId
      await handleStartQuiz(newId)
      setCreateOpen(false)
      setCreatePreview(null)
    } catch (e) {
      console.error("Create personal quiz failed:", e)
      alert("Create quiz failed. See console.")
    } finally {
      setCreating(false)
    }
  }

  // ----- Attempt flow -----
  async function loadQuizDetail(quizId: string): Promise<PersonalQuizDetail | null> {
    const snap = await get(ref(db, `users/${userId}/quizzes/${quizId}`))
    if (!snap.exists()) return null
    const q = snap.val() as any
    if (q?.type !== "personal-async") return null
    const questions = q.questions || {}
    const numQuestions = Object.keys(questions).length
    return {
      id: q.id,
      title: q.title ?? `Quiz ${String.fromCharCode(65 + quizzes.findIndex((quiz) => quiz.id === quizId))}`,
      numQuestions,
      questionDurationSec: q.questionDurationSec ?? 45,
      questions,
    }
  }

  async function handleStartQuiz(quizId: string) {
    setAttemptLoading(true)
    try {
      const startFn = httpsCallable(fns, "startOrResumePersonalAsyncAttempt")
      const { data }: any = await startFn({ quizId })
      const quiz = await loadQuizDetail(quizId)
      setAttemptQuizDetail(quiz)
      setAttemptIndex(Number(data?.currentIndex || 0))
      setSelectedQuizId(quizId)
      setAttemptOpen(true)
      setSelectedAnswerIndex(null)
      setAnswerFeedback(null)
    } catch (e) {
      console.error("Start personal attempt failed:", e)
      alert("Could not start the quiz. See console.")
    } finally {
      setAttemptLoading(false)
    }
  }

  async function submitAnswer(optionIdx: number) {
    if (!attemptQuizDetail || selectedQuizId == null) return
    setSubmittingAnswer(true)

    const qArrSorted = Object.values(attemptQuizDetail.questions).sort((a, b) => Number(a.id) - Number(b.id))
    const currentQ = qArrSorted[attemptIndex]
    const isCorrect = optionIdx === currentQ.correctIndex
    setAnswerFeedback({ index: optionIdx, correct: isCorrect })

    await new Promise((r) => setTimeout(r, 800))

    try {
      const submitFn = httpsCallable(fns, "submitPersonalAsyncAnswer")
      const { data }: any = await submitFn({ quizId: selectedQuizId, optionIdx })

      const totalLocal = attemptQuizDetail.numQuestions
      const isLast = attemptIndex >= totalLocal - 1

      if (data?.finishedNow || isLast) {
        // compute/collect score for completion screen and buffer for save-on-close
        let serverScore: number | undefined =
          typeof data?.score === "number" ? data.score : undefined
        let serverTotal: number = typeof data?.totalQuestions === "number" ? data.totalQuestions : totalLocal

        if (serverScore == null) {
          // fallback: fetch attempt and compute score client-side
          try {
            const mineFn = httpsCallable(fns, "getMyPersonalAsyncAttempt")
            const { data: md }: any = await mineFn({ quizId: selectedQuizId })
            const answers = (md?.attempt?.answers || []) as AttemptAnswer[]
            const qArr = qArrSorted
            let correctCount = 0
            for (let i = 0; i < qArr.length; i++) {
              const a = answers[i]
              if (a && typeof a.optionIdx === "number" && a.optionIdx === qArr[i].correctIndex) {
                correctCount++
              }
            }
            serverScore = correctCount
            serverTotal = qArr.length
          } catch {
            // if we cannot fetch, at least set 0/total to move forward
            serverScore = 0
            serverTotal = totalLocal
          }
        }

        // buffer result; do NOT persist yet
        pendingResultRef.current = {
          quizId: selectedQuizId,
          score: serverScore!,
          total: serverTotal,
        }

        setAttemptQuizDetail({
          ...attemptQuizDetail,
          showCompletion: true,
          finalScore: serverScore!,
          totalQuestions: serverTotal,
        })
      } else {
        setAttemptIndex((i) => Math.min(i + 1, totalLocal - 1))
        setSelectedAnswerIndex(null)
        setAnswerFeedback(null)
      }
    } catch (e) {
      console.error("Submit personal answer failed:", e)
      alert("Could not submit answer. See console.")
    } finally {
      setSubmittingAnswer(false)
    }
  }

  // finalize (save) buffered result when modal is closed after a completion
  async function finalizeIfPendingAndClose() {
    try {
      const pending = pendingResultRef.current
      // Only commit when a run is completed and there's a pending score
      if (attemptQuizDetail?.showCompletion && pending && pending.quizId === selectedQuizId) {
        try {
          // Prefer explicit finalize callable if available
          const finalizeFn = httpsCallable(fns, "finalizePersonalAsyncAttempt") as any
          await finalizeFn({
            quizId: pending.quizId,
            score: pending.score,
            totalQuestions: pending.total,
          })
        } catch {
          // fallback: even if finalize isn't available, refresh lists so UI stays consistent
        }
        pendingResultRef.current = null
        await refreshLists()
      }
    } finally {
      setAttemptOpen(false)
    }
  }

  // ----- Review flow (NEW) -----
  async function openReview(quizId: string) {
    try {
      setReviewOpen(true)
      setReviewAttempt(null)
      setReviewQuizDetail(null)
      setReviewIndex(0)

      const detail = await loadQuizDetail(quizId)
      setReviewQuizDetail(detail || null)

      // mirror org naming: getMyPersonalAsyncAttempt
      const mineFn = httpsCallable(fns, "getMyPersonalAsyncAttempt")
      const { data }: any = await mineFn({ quizId })
      if (!data?.attempt) {
        setReviewAttempt({
          score: 0,
          finished: false,
          finishedAt: null,
          answers: [],
          stats: { avgTimeMs: 0, correctCount: 0 },
        })
      } else {
        setReviewAttempt(data.attempt)
      }
      setSelectedQuizId(quizId)
    } catch (e) {
      console.error("Open personal review failed:", e)
      alert("Could not load your attempt. See console.")
    }
  }

  function renderReviewCard() {
    if (!reviewAttempt || !reviewQuizDetail) return null
    const qArr = Object.values(reviewQuizDetail.questions).sort((a, b) => Number(a.id) - Number(b.id))
    const aArr = reviewAttempt.answers || []
    const q = qArr[reviewIndex]
    const a = aArr[reviewIndex]
    const idxHuman = reviewIndex + 1

    const chosen = typeof a?.optionIdx === "number" ? a.optionIdx : null
    const correct = q.correctIndex

    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Review {idxHuman} / {qArr.length}
        </div>
        <div className="text-base font-medium text-foreground">{q.question}</div>

        <div className="grid gap-2">
          {q.options.map((opt, i) => {
            const isCorrect = i === correct
            const isChosen = i === chosen
            let style = "rounded-lg border p-3 flex items-center gap-2"

            if (isCorrect && isChosen) {
              style += " bg-green-100 border-green-300 text-green-800"
            } else if (isCorrect) {
              style += " bg-green-50 border-green-200 text-green-700"
            } else if (isChosen) {
              style += " bg-red-100 border-red-300 text-red-800"
            } else {
              style += " bg-white border-gray-200 text-black"
            }

            return (
              <div key={i} className={style}>
                <span className="font-medium bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                <div className="text-sm flex-1">{opt}</div>
                {isCorrect && <span className="text-green-600 text-xs font-bold">✓</span>}
                {isChosen && !isCorrect && <span className="text-red-600 text-xs font-bold">✗</span>}
              </div>
            )
          })}
        </div>

        <div className="text-sm">
          {chosen === correct ? (
            <span className="text-green-600 font-medium">✓ Correct</span>
          ) : (
            <span className="text-red-600 font-medium">✗ Incorrect</span>
          )}{" "}
          <span className="text-muted-foreground">Time: {fmtMs(a?.timeMs)}</span>
        </div>

        {q.explanation && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <div className="font-medium mb-1 text-black">Explanation</div>
            <div className="text-gray-600">{q.explanation}</div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            disabled={reviewIndex <= 0}
            onClick={() => setReviewIndex((i) => Math.max(0, i - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setReviewIndex((i) => Math.min(qArr.length - 1, i + 1))}
            disabled={reviewIndex >= qArr.length - 1}
          >
            Next
          </Button>
        </div>
      </div>
    )
  }

  // ----- UI -----
  function renderQuestionCard() {
    if (!attemptQuizDetail) return null
    const qArr = Object.values(attemptQuizDetail.questions).sort((a, b) => Number(a.id) - Number(b.id))

    // If finished, show animated completion screen using server score (buffered for save-on-close)
    if ((attemptQuizDetail as any)?.showCompletion) {
      return renderCompletionScreen(
        (attemptQuizDetail as any).finalScore ?? 0,
        (attemptQuizDetail as any).totalQuestions ?? qArr.length,
      )
    }

    const q = qArr[attemptIndex]
    const idxHuman = attemptIndex + 1
    const progress = (idxHuman / qArr.length) * 100

    return (
      <div key={attemptRunKey} className="space-y-6">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="text-lg text-muted-foreground font-medium">
          Question {idxHuman} of {qArr.length}
        </div>

        <div className="text-2xl font-semibold text-foreground leading-relaxed">{q.question}</div>

        <div className="grid gap-4">
          {q.options.map((opt, i) => {
            let btn =
              "justify-start text-left transition-all duration-200 p-6 text-lg min-h-[80px] relative overflow-hidden"
            if (answerFeedback && answerFeedback.index === i) {
              btn += answerFeedback.correct
                ? " bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-emerald-600 shadow-xl transform scale-[1.02] ring-4 ring-emerald-200"
                : " bg-gradient-to-r from-red-500 to-red-600 text-white border-red-600 shadow-xl transform scale-[1.02] ring-4 ring-red-200"
            } else if (selectedAnswerIndex === i) {
              btn +=
                " bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-lg transform scale-[1.01] ring-2 ring-blue-200"
            } else {
              btn +=
                " hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 hover:border-blue-500 hover:shadow-lg hover:transform hover:scale-[1.01] hover:ring-2 hover:ring-blue-200 bg-white text-gray-900 border-gray-300"
            }

            return (
              <Button
                key={i}
                variant="outline"
                className={btn}
                disabled={submittingAnswer || answerFeedback !== null}
                onClick={() => {
                  setSelectedAnswerIndex(i)
                  setTimeout(() => submitAnswer(i), 50)
                }}
              >
                <span className="font-bold mr-4 bg-gray-800 text-white px-4 py-2 rounded-full text-lg min-w-[48px] flex items-center justify-center shadow-md">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{opt}</span>
                {submittingAnswer && selectedAnswerIndex === i && <Loader2 className="h-6 w-6 animate-spin ml-auto" />}
              </Button>
            )
          })}
        </div>
      </div>
    )
  }

  // in-place retake (keeps modal open, restarts to Q1, can update seconds/question)
  async function handleRetakeInPlace() {
    if (!selectedQuizId) return
    try {
      // 1) Allow user to tweak seconds/question
      const current = await loadQuizDetail(selectedQuizId)
      const defaultSec = current?.questionDurationSec ?? 45
      const input = window.prompt("Seconds per question for retake:", String(defaultSec))
      let sec = Number(input)
      if (!Number.isFinite(sec)) sec = defaultSec
      sec = clamp(sec, 10, 300)

      // 2) Update duration in RTDB (best-effort)
      try {
        await update(ref(db, `users/${userId}/quizzes/${selectedQuizId}`), {
          questionDurationSec: sec,
        })
      } catch {
        /* ignore permission issues */
      }

      // 3) Try to reset attempt on server if callable exists; fallback to resume with reset hint
      try {
        const resetFn = httpsCallable(fns, "resetPersonalAsyncAttempt")
        await resetFn({ quizId: selectedQuizId })
      } catch {
        try {
          const resumeFn = httpsCallable(fns, "startOrResumePersonalAsyncAttempt")
          await resumeFn({ quizId: selectedQuizId, reset: true } as any)
        } catch {
          /* ignore */
        }
      }

      // 4) Reload detail; clear completion & selection; reset to Q1; keep modal open
      const fresh = await loadQuizDetail(selectedQuizId)
      if (fresh) {
        setAttemptQuizDetail({
          ...fresh,
          showCompletion: false,
          finalScore: undefined,
          totalQuestions: undefined,
        })
      }
      setAttemptIndex(0)
      setSelectedAnswerIndex(null)
      setAnswerFeedback(null)
      setAttemptRunKey((k) => k + 1)

      // 5) Since user chose to retake, discard any previously buffered score
      pendingResultRef.current = null
    } catch (e) {
      console.error("Retake in place failed:", e)
      alert("Could not restart the quiz. See console.")
    }
  }

  function renderCompletionScreen(score: number, total: number) {
    const safeTotal = Math.max(1, Number(total || 0))
    const percentage = (Number(score || 0) / safeTotal) * 100

    let congratsData = {
      emoji: "🎉",
      title: "Outstanding!",
      subtitle: "Perfect performance!",
      bgGradient: "from-yellow-400 via-yellow-500 to-amber-500",
      textColor: "text-yellow-900",
      ringColor: "ring-yellow-300",
    }

    if (percentage >= 90) {
      congratsData = { ...congratsData }
    } else if (percentage >= 80) {
      congratsData = {
        emoji: "🌟",
        title: "Excellent work!",
        subtitle: "Great job!",
        bgGradient: "from-emerald-400 via-emerald-500 to-green-500",
        textColor: "text-emerald-900",
        ringColor: "ring-emerald-300",
      }
    } else if (percentage >= 70) {
      congratsData = {
        emoji: "👏",
        title: "Good job!",
        subtitle: "Well done!",
        bgGradient: "from-blue-400 via-blue-500 to-indigo-500",
        textColor: "text-blue-900",
        ringColor: "ring-blue-300",
      }
    } else if (percentage >= 60) {
      congratsData = {
        emoji: "👍",
        title: "Nice effort!",
        subtitle: "Keep practicing!",
        bgGradient: "from-purple-400 via-purple-500 to-indigo-500",
        textColor: "text-purple-900",
        ringColor: "ring-purple-300",
      }
    } else {
      congratsData = {
        emoji: "💪",
        title: "Keep learning!",
        subtitle: "You'll improve!",
        bgGradient: "from-orange-400 via-orange-500 to-red-500",
        textColor: "text-orange-900",
        ringColor: "ring-orange-300",
      }
    }

    return (
      <div className="flex flex-col items-center justify-center space-y-8 py-12">
        <div
          className={`w-32 h-32 rounded-full bg-gradient-to-br ${congratsData.bgGradient} flex items-center justify-center shadow-2xl ring-8 ${congratsData.ringColor} animate-bounce`}
        >
          <span className="text-6xl">{congratsData.emoji}</span>
        </div>

        <div className="text-center space-y-4">
          <h2 className={`text-4xl font-bold ${congratsData.textColor} animate-pulse`}>{congratsData.title}</h2>
          <p className="text-xl text-gray-600 font-medium">{congratsData.subtitle}</p>
        </div>

        <div
          className={`bg-gradient-to-r ${congratsData.bgGradient} rounded-2xl p-8 shadow-xl ring-4 ${congratsData.ringColor} transform hover:scale-105 transition-all duration-300`}
        >
          <div className="text-center space-y-2">
            <div className="text-white text-lg font-medium">Your Score</div>
            <div className="text-white text-5xl font-bold">
              {Number(score || 0)}
              <span className="text-3xl">/{safeTotal}</span>
            </div>
            <div className="text-white text-xl font-semibold">{Math.round(percentage)}%</div>
          </div>
        </div>

      </div>
    )
  }

  return (
    <>
      <div className="w-full h-full flex flex-col">
        {/* Top half: Quizzes list - now takes full height */}
        <div className="h-full border-b border-border/30 bg-background/10 flex flex-col min-h-0">
          <div className="sticky top-0 z-0 flex items-center justify-between px-6 py-4 border-b border-border/30 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
            <div className="text-lg font-medium text-foreground">Quizzes</div>
            <Button
              onClick={handleOpenCreate}
              disabled={creating}
              size="sm"
              className="bg-black text-white hover:bg-gray-800 px-4 py-2 rounded-md font-medium"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {creating ? "Working..." : "Generate Quiz"}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-4">
              <div className="space-y-1">
                {/* Active */}
                <div>
                  <button
                    onClick={() => setExpandedFolders((p) => ({ ...p, active: !p.active }))}
                    className="flex items-center gap-2 w-full p-2 hover:bg-background/40 rounded-md transition-colors text-left"
                  >
                    {expandedFolders.active ? (
                      <ChevronDown className="h-4 w-4 text-black" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-black" />
                    )}
                    {expandedFolders.active ? (
                      <FolderOpen className="h-4 w-4 text-black" />
                    ) : (
                      <Folder className="h-4 w-4 text-black" />
                    )}
                    <span className="text-base font-medium text-foreground">
                      Active Quizzes ({activeQuizzes.length})
                    </span>
                  </button>

                  {expandedFolders.active && (
                    <div className="ml-6 space-y-1">
                      {loadingActive ? (
                        <div className="text-xs text-muted-foreground p-2 flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading active quizzes...
                        </div>
                      ) : activeQuizzes.length === 0 ? (
                        <div className="text-xs text-muted-foreground p-2">No active quizzes</div>
                      ) : (
                        activeQuizzes.map((q) => (
                          <div
                            key={q.id}
                            className="flex items-center gap-2 p-2 hover:bg-background/40 rounded-md transition-colors w-full cursor-pointer"
                            onDoubleClick={() => handleStartQuiz(q.id)} // start/resume
                            onClick={() => setSelectedQuizId(q.id)}
                          >
                            <FileText className="h-4 w-4 text-black" />
                            <div className="flex-1 min-w-0">
                              <div className="text-base font-medium text-foreground truncate">
                                {q.title ||
                                  `Quiz ${String.fromCharCode(65 + quizzes.findIndex((quiz) => quiz.id === q.id))}`}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {q.numQuestions} questions • {q.questionDurationSec}s each
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Completed */}
                <div>
                  <button
                    onClick={() => setExpandedFolders((p) => ({ ...p, completed: !p.completed }))}
                    className="flex items-center gap-2 w-full p-2 hover:bg-background/40 rounded-md transition-colors text-left"
                  >
                    {expandedFolders.completed ? (
                      <ChevronDown className="h-4 w-4 text-black" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-black" />
                    )}
                    {expandedFolders.completed ? (
                      <FolderOpen className="h-4 w-4 text-black" />
                    ) : (
                      <Folder className="h-4 w-4 text-black" />
                    )}
                    <span className="text-base font-medium text-foreground">
                      Completed Quizzes ({completedQuizzes.length})
                    </span>
                  </button>

                  {expandedFolders.completed && (
                    <div className="ml-6 space-y-1">
                      {loadingCompleted ? (
                        <div className="text-xs text-muted-foreground p-2 flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading completed quizzes...
                        </div>
                      ) : completedQuizzes.length === 0 ? (
                        <div className="text-xs text-muted-foreground p-2">No completed quizzes</div>
                      ) : (
                        completedQuizzes.map((q) => (
                          <div
                            key={q.id}
                            className="flex items-center gap-2 p-2 hover:bg-background/40 rounded-md transition-colors w-full cursor-pointer"
                            onClick={() => setSelectedQuizId(q.id)}
                            onDoubleClick={() => openReview(q.id)} // 👈 NEW: open review modal
                          >
                            <FileText className="h-4 w-4 text-black" />
                            <div className="flex-1 min-w-0">
                              <div className="text-base font-medium text-foreground truncate">
                                {q.title ||
                                  `Quiz ${String.fromCharCode(65 + quizzes.findIndex((quiz) => quiz.id === q.id))}`}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {q.numQuestions} questions • {q.questionDurationSec}s each
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {isClient &&
        createOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-black/35 backdrop-blur-[6px] flex items-center justify-center p-4"
            onClick={() => setCreateOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Card className="w-full max-w-5xl min-w-[1000px] h-[90vh] min-h-[700px] max-h-[900px] bg-background shadow-2xl flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between px-8 py-6 border-b shrink-0">
                  <CardTitle className="text-2xl">Create Quiz</CardTitle>
                  <Button
                    onClick={() => setCreateOpen(false)}
                    variant="outline"
                    size="sm"
                    className="h-10 w-10 p-0 shrink-0 hover:bg-accent bg-transparent"
                    aria-label="Close modal"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 min-h-0 px-8 pb-8">
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-base font-medium text-foreground">Number of questions</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="\d*"
                          value={String(createNumQuestions ?? "")}
                          onChange={(e) => {
                            const digitsOnly = e.target.value.replace(/[^\d]/g, "");
                            if (digitsOnly === "") {
                              setCreateNumQuestions(0 as any); // allow clearing while typing
                              return;
                            }
                            const n = parseInt(digitsOnly, 10);
                            setCreateNumQuestions(clamp(n, 1, 20));
                          }}
                          onBlur={() => {
                            if (!createNumQuestions || Number.isNaN(createNumQuestions)) {
                              setCreateNumQuestions(5); // default
                            } else {
                              setCreateNumQuestions(clamp(Number(createNumQuestions), 1, 20));
                            }
                          }}
                          className="w-full rounded-md border border-border/40 bg-background/40 px-4 py-3 text-base"
                          placeholder="5"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-base font-medium text-foreground">Seconds per question</label>
                        <input
                          type="number"
                          min={10}
                          max={300}
                          value={createDurationSec}
                          onChange={(e) => setCreateDurationSec(clamp(Number(e.target.value) || 10, 10, 300))}
                          className="w-full rounded-md border border-border/40 bg-background/40 px-4 py-3 text-base"
                        />
                      </div>
                    </div>

                    {!createPreview ? (
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={handleGenerateFromNote}
                          disabled={creating}
                          className="bg-black text-white hover:bg-gray-800 border border-white/20 px-6 py-3 text-base"
                        >
                          {creating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                          Generate from note
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-lg font-semibold">Preview ({createPreview.length})</div>
                        <div className="max-h-80 overflow-auto rounded-md border border-border/40">
                          <div className="p-4 space-y-4">
                            {createPreview.map((q, i) => (
                              <div key={i} className="rounded-md border border-border/30 bg-background/30 p-4">
                                <div className="text-base font-semibold mb-3">
                                  {i + 1}. {q.question}
                                </div>
                                <div className="space-y-2">
                                  {q.options.map((o, j) => (
                                    <div key={j} className="flex items-center gap-3">
                                      <span className="font-bold bg-gray-800 text-white px-3 py-1 rounded-full text-sm min-w-[32px] flex items-center justify-center">
                                        {String.fromCharCode(65 + j)}
                                      </span>
                                      <span className="text-base">{o}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              onClick={() => setCreatePreview(null)}
                              disabled={creating}
                              className="px-6 py-3 text-base"
                            >
                              Regenerate
                            </Button>
                            <Button
                              onClick={handleCreatePersonal}
                              disabled={creating}
                              className="bg-black text-white hover:bg-gray-800 border border-white/20 px-6 py-3 text-base"
                            >
                              {creating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                              Create & Start
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>,
          document.body,
        )}

      {/* Attempt Modal */}
      {isClient &&
        attemptOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-black/35 backdrop-blur-[6px] flex items-center justify-center p-4"
            onClick={finalizeIfPendingAndClose}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Card className="w-full max-w-5xl min-w-[1000px] h-[90vh] min-h-[700px] max-h-[900px] bg-background shadow-2xl flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between px-8 py-6 border-b shrink-0">
                  <CardTitle className="text-2xl">Quiz</CardTitle>
                  <Button
                    onClick={finalizeIfPendingAndClose}
                    variant="outline"
                    size="sm"
                    className="h-10 w-10 p-0 shrink-0 hover:bg-accent bg-transparent"
                    aria-label="Close modal"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 min-h-0 px-8 pb-8">
                  {attemptLoading ? (
                    <div className="flex-1 flex items-center justify-center text-lg text-muted-foreground">
                      <Loader2 className="h-6 w-6 mr-3 animate-spin" /> Loading quiz…
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 flex items-center justify-center">
                      <div className="w-full max-w-3xl">{renderQuestionCard()}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>,
          document.body,
        )}

      {/* Review Modal (NEW) */}
      {isClient &&
        reviewOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-black/35 backdrop-blur-[6px] flex items-center justify-center p-4"
            onClick={() => setReviewOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Card className="w-full max-w-5xl min-w-[1000px] h-[90vh] min-h-[700px] max-h-[900px] bg-background shadow-2xl flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between px-8 py-6 border-b shrink-0">
                  <CardTitle className="text-2xl">Quiz Review</CardTitle>
                  <Button
                    onClick={() => setReviewOpen(false)}
                    variant="outline"
                    size="sm"
                    className="h-10 w-10 p-0 shrink-0 hover:bg-accent bg-transparent"
                    aria-label="Close modal"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 min-h-0 px-8 pb-8">
                  {!reviewAttempt || !reviewQuizDetail ? (
                    <div className="flex-1 flex items-center justify-center text-lg text-muted-foreground">
                      <Loader2 className="h-6 w-6 mr-3 animate-spin" /> Loading review…
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-base font-medium">
                          Score: {reviewAttempt.score} / {Object.keys(reviewQuizDetail.questions).length}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Avg time: {fmtMs(reviewAttempt.stats?.avgTimeMs)} • Correct:{" "}
                          {reviewAttempt.stats?.correctCount}
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 flex items-center justify-center">
                        <div className="w-full max-w-3xl">{renderReviewCard()}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

/* ------------------------------ Main component --------------------------- */
export default function UserNotesSplitViewWithRibbon({
  notes,
  userID,
  selectedId,
  onSelect,
  initialSelectedId,
  loading,
  title,
  onTitleChange,
  onTitleCommit,
}: NotesSplitViewProps) {
  const [stateNotes, setStateNotes] = useState<Note[]>(notes)

  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectedId ?? initialSelectedId ?? notes[0]?.id ?? null,
  )
  const [currentOwnerId, setCurrentOwnerId] = useState<string>(userID)

  const [isRightContentHidden, setIsRightContentHidden] = useState(false)
  const [activeRibbonSection, setActiveRibbonSection] = useState<RibbonSection>("summary")

  useEffect(() => setStateNotes(() => notes), [notes])

  const currentSelectedNoteId = useMemo(
    () => (selectedId ? selectedId : internalSelectedId),
    [selectedId, internalSelectedId],
  )

  // keep selection valid if uncontrolled
  useEffect(() => {
    if (selectedId) return
    if (!internalSelectedId) {
      const first = notes[0]?.id ?? null
      setInternalSelectedId(first)
    } else {
      const exists = notes.some((n) => n.id === internalSelectedId)
      if (!exists) setInternalSelectedId(notes[0]?.id ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, selectedId])

  const selectedNote = useMemo(
    () => stateNotes.find((n) => n.id === currentSelectedNoteId) ?? null,
    [stateNotes, currentSelectedNoteId],
  )

  const [plain, setPlain] = useState<string>("")
  useEffect(() => {
    if (selectedNote?.content != null) setPlain(htmlToPlain(selectedNote.content))
    else setPlain("")
  }, [selectedNote?.id, selectedNote?.content])

  // Debounced autosave of content snapshots to users/{userID}/notes
  useEffect(() => {
    if (!selectedNote?.id) return
    const t = setTimeout(() => {
      const path = `users/${currentOwnerId || userID}/notes/${selectedNote.id}`
      callUpdateNote(path, { content: selectedNote.content, updatedAt: Date.now() })
    }, 1000)
    return () => clearTimeout(t)
  }, [selectedNote?.id, selectedNote?.content, userID, currentOwnerId])

  const showLoader = loading && stateNotes.length === 0

  // Right pane content
  const rightPane = (() => {
    switch (activeRibbonSection) {
      case "summary":
        return (
          <div className="min-h-0 h-full">
            {selectedNote ? (
              <SummaryPanel
                sourceText={plain}
                title="Summary"
                className="h-full"
                ownerId={currentOwnerId || userID}
                userId={userID}
                noteId={selectedNote.id}
                isPersonal
                autoGenerateIfMissing
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Select a note to summarize.</div>
            )}
          </div>
        )
      case "flashcards":
        return (
          <div className="min-h-0 h-full">
            {selectedNote ? (
              <FlashCardSection
                sourceText={plain}
                className="h-full"
                ownerId={currentOwnerId || userID}
                userId={userID}
                noteId={selectedNote.id}
                isPersonal
                autoGenerateIfMissing
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Select a note to generate flashcards.</div>
            )}
          </div>
        )
      case "notes":
        return (
          <div className="min-h-0 h-full">
            <RightNotesPanel
              userId={userID}
              onOpenNote={(noteId) => {
                if (onSelect) onSelect(noteId)
                else setInternalSelectedId(noteId)
              }}
              setOwnerId={(owner) => setCurrentOwnerId(owner)}
            />
          </div>
        )
      case "quiz":
        return (
          <div className="min-h-0 h-full">
            {selectedNote ? (
              <PersonalQuizBarInline
                userId={currentOwnerId || userID}
                noteId={selectedNote.id}
                displayName="You"
                defaultDurationSec={45}
                defaultNumQuestions={5}
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Select a note to quiz.</div>
            )}
          </div>
        )
      default:
        return null
    }
  })()

  return (
    <div className="relative h-[calc(100vh-2rem)] w-full">
      <div className="flex h-full min-h-0 gap-4 pr-4">
        {/* Editor pane */}
        <div
          className={`${
            isRightContentHidden ? "flex-1" : "flex-[3]"
      } border border-gray-200 dark:border-0 rounded-xl p-3 bg-white dark:bg-neutral-900 shadow flex flex-col min-h-0 transition-all duration-300`}

        >
          {/* Editor body */}
          <div className="flex-1 min-h-0 overflow-y-auto scroll-invisible">
            {showLoader ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground"></div>
            ) : selectedNote ? (
              <EditorMain
                searchParams={{
                  doc: currentSelectedNoteId as any,
                  ownerId: (currentOwnerId || userID) as any,
                  username: "You",
                }}
              />
            ) : (
              <div className="h-full grid place-items-center text-sm text-muted-foreground px-6 text-center">
                <div>
                  <div className="font-semibold mb-1">No note selected</div>
                  <div>Open the Notes tab on the ribbon to pick or create a note.</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {!isRightContentHidden && (
          <div className="max-w-md min-w-[20rem] w-[28rem] min-h-0 transition-all duration-300">
            <div className="h-full min-h-0 border border-gray-200 rounded-xl bg-white dark:bg-neutral-900 shadow">
              {rightPane}
            </div>
          </div>
        )}
      </div>

      {/* Fixed ribbon on the far right */}
      <div className="absolute top-0 right-0">
        <Ribbon
          activeSection={activeRibbonSection}
          onSectionChange={(sec) => {
            setActiveRibbonSection(sec)
            if ((sec as any) === null) setIsRightContentHidden(true)
            else setIsRightContentHidden(false)
          }}
          onCollapse={() => setIsRightContentHidden(true)}
        />
      </div>

      {/* Invisible scrollbar styles */}
      <style jsx>{`
        .scroll-invisible {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scroll-invisible::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
      `}</style>
    </div>
  )
}
