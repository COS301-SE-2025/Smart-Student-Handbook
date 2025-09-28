// components/quiz/PersonalQuizBar.tsx
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ChevronDown, ChevronRight, FileText, FolderOpen, Folder, X } from "lucide-react"
import { createPortal } from "react-dom"

// ------------------------------ Types ------------------------------

type QuizListItem = {
  id: string
  title: string
  numQuestions: number
  questionDurationSec: number
  createdAt?: number
}

type AttemptAnswer = {
  optionIdx: number
  timeMs: number
  correct: boolean
}

type AttemptLight = {
  quizId: string
  finished: boolean
  finishedAt: number | null
  score: number
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
  showCompletion?: boolean
  finalScore?: number
  totalQuestions?: number
}

type PersonalQuizBarProps = {
  noteId: string
  userId: string
  displayName: string
  defaultDurationSec?: number
  defaultNumQuestions?: number
}

type ClientQuizItem = {
  question: string
  options: string[]
  answerIndex: number
  explanation?: string
}

// ------------------------------ Mock Data & Functions ------------------------------

// Mock quiz generation
async function generateQuizQuestions(content: string, numQuestions: number): Promise<ClientQuizItem[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const mockQuestions: ClientQuizItem[] = [
    {
      question: "What is the main concept discussed in this content?",
      options: [
        "Basic principles and fundamentals",
        "Advanced technical details",
        "Historical background",
        "Future implications",
      ],
      answerIndex: 0,
      explanation: "The content focuses on foundational concepts and basic principles.",
    },
    {
      question: "Which approach is most effective for learning?",
      options: ["Memorization only", "Practice and application", "Reading theory only", "Watching videos only"],
      answerIndex: 1,
      explanation: "Active practice and application of concepts leads to better understanding.",
    },
    {
      question: "What is the key to successful implementation?",
      options: ["Perfect planning", "Iterative improvement", "Following instructions exactly", "Avoiding mistakes"],
      answerIndex: 1,
      explanation: "Iterative improvement allows for continuous learning and adaptation.",
    },
  ]

  return mockQuestions.slice(0, Math.min(numQuestions, mockQuestions.length))
}

// Local storage helpers
const getStorageKey = (noteId: string, key: string) => `quiz_${noteId}_${key}`

const getQuizzes = (noteId: string): QuizListItem[] => {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(getStorageKey(noteId, "quizzes"))
  return stored ? JSON.parse(stored) : []
}

const saveQuizzes = (noteId: string, quizzes: QuizListItem[]) => {
  if (typeof window === "undefined") return
  localStorage.setItem(getStorageKey(noteId, "quizzes"), JSON.stringify(quizzes))
}

const getAttempts = (noteId: string): AttemptLight[] => {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(getStorageKey(noteId, "attempts"))
  return stored ? JSON.parse(stored) : []
}

const saveAttempts = (noteId: string, attempts: AttemptLight[]) => {
  if (typeof window === "undefined") return
  localStorage.setItem(getStorageKey(noteId, "attempts"), JSON.stringify(attempts))
}

const getQuizDetail = (quizId: string): PersonalQuizDetail | null => {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem(`quiz_detail_${quizId}`)
  return stored ? JSON.parse(stored) : null
}

const saveQuizDetail = (quiz: PersonalQuizDetail) => {
  if (typeof window === "undefined") return
  localStorage.setItem(`quiz_detail_${quiz.id}`, JSON.stringify(quiz))
}

// ------------------------------ UI Helpers ------------------------------

function fmtMs(ms: number | undefined) {
  if (!ms) return "0s"
  return `${Math.round(ms / 1000)}s`
}

// ------------------------------ Component ------------------------------

export default function PersonalQuizBar({
  noteId,
  userId,
  displayName,
  defaultDurationSec = 45,
  defaultNumQuestions = 5,
}: PersonalQuizBarProps) {
  // folders
  const [expandedFolders, setExpandedFolders] = useState({ active: true, completed: true })

  const [loadingActiveQuizzes, setLoadingActiveQuizzes] = useState(false)
  const [loadingCompletedQuizzes, setLoadingCompletedQuizzes] = useState(false)

  // data state
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]) // all for note
  const [myAttempts, setMyAttempts] = useState<AttemptLight[]>([])
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null)

  // creation modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createNumQuestions, setCreateNumQuestions] = useState<number>(defaultNumQuestions)
  const [createDurationSec, setCreateDurationSec] = useState<number>(defaultDurationSec)
  const [createPreview, setCreatePreview] = useState<ClientQuizItem[] | null>(null)
  const createdRef = useRef<{ createdQuizId?: string }>({}) // keep track if we just created a quiz

  // attempt modal state
  const [attemptOpen, setAttemptOpen] = useState(false)
  const [attemptLoading, setAttemptLoading] = useState(false)
  const [attemptQuizDetail, setAttemptQuizDetail] = useState<PersonalQuizDetail | null>(null)
  const [attemptIndex, setAttemptIndex] = useState<number>(0)
  const [submittingAnswer, setSubmittingAnswer] = useState(false)
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null)
  const [answerFeedback, setAnswerFeedback] = useState<{ index: number; correct: boolean } | null>(null)

  // review modal state (for completed quizzes)
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

  // ★ NEW: track pending result so we only finalize/save when the quiz modal closes
  const [pendingResult, setPendingResult] = useState<{ score: number; total: number } | null>(null)
  const prevAttemptOpen = useRef<boolean>(false)

  // ★ NEW: bump to force a brand-new session mount after retake (avoids stale state)
  const [attemptSession, setAttemptSession] = useState(0) // ★ FIX

  // ★ NEW: watch modal close -> if we have a finished result, save it "officially" now
  useEffect(() => {
    if (prevAttemptOpen.current && !attemptOpen && pendingResult && selectedQuizId) {
      const currentAttempts = getAttempts(noteId)
      const newAttempt: AttemptLight = {
        quizId: selectedQuizId,
        finished: true,
        finishedAt: Date.now(),
        score: pendingResult.score,
      }
      const updatedAttempts = (() => {
        const existing = currentAttempts.find((a) => a.quizId === selectedQuizId)
        if (existing) {
          return currentAttempts.map((a) => (a.quizId === selectedQuizId ? newAttempt : a))
        }
        return [...currentAttempts, newAttempt]
      })()
      saveAttempts(noteId, updatedAttempts)
      setPendingResult(null)
      refreshLists()
    }
    prevAttemptOpen.current = attemptOpen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptOpen])

  // ------------------------------ Load lists ------------------------------

  const activeQuizzes = useMemo(() => {
    if (!myAttempts.length) return quizzes
    const finishedMap = new Map(myAttempts.map((a) => [a.quizId, a.finished]))
    return quizzes.filter((q) => !finishedMap.get(q.id))
  }, [quizzes, myAttempts])

  const completedQuizzes = useMemo(() => {
    if (!myAttempts.length) return []
    const finishedIds = new Set(myAttempts.filter((a) => a.finished).map((a) => a.quizId))
    return quizzes.filter((q) => finishedIds.has(q.id))
  }, [quizzes, myAttempts])

  async function refreshLists() {
    setLoadingActiveQuizzes(true)
    setLoadingCompletedQuizzes(true)
    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      const loadedQuizzes = getQuizzes(noteId)
      const loadedAttempts = getAttempts(noteId)

      setQuizzes(loadedQuizzes)
      setMyAttempts(loadedAttempts)
    } finally {
      setLoadingActiveQuizzes(false)
      setLoadingCompletedQuizzes(false)
    }
  }

  // auto-load
  useEffect(() => {
    refreshLists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId])

  // ------------------------------ Folder toggle ------------------------------

  function toggleFolderExpansion(folder: "active" | "completed") {
    setExpandedFolders((p) => ({ ...p, [folder]: !p[folder] }))
  }

  // ------------------------------ Create quiz flow ------------------------------

  async function handleOpenCreate() {
    setCreateOpen(true)
    setCreatePreview(null)
    setCreateNumQuestions(defaultNumQuestions)
    setCreateDurationSec(defaultDurationSec)
  }

  async function handleGenerateFromNote() {
    setCreating(true)
    setCreatePreview(null)
    try {
      // Mock note content
      const noteContent =
        "This is sample note content for generating quiz questions. It covers basic concepts and principles that are important to understand."

      const items = await generateQuizQuestions(noteContent, createNumQuestions)
      setCreatePreview(items)
    } catch (e) {
      console.error("Quiz generation failed:", e)
      alert("Quiz generation failed. Check console/logs.")
    } finally {
      setCreating(false)
    }
  }

  async function handleCreatePersonalAnytime() {
    if (!createPreview || createPreview.length === 0) return
    setCreating(true)
    try {
      const currentQuizzes = getQuizzes(noteId)
      const quizLetter = String.fromCharCode(65 + currentQuizzes.length) // A, B, C, etc.
      const quizTitle = `Quiz ${quizLetter}`
      const quizId = `quiz_${Date.now()}`

      const questions: { [id: string]: any } = {}
      createPreview.forEach((q, i) => {
        questions[String(i)] = {
          id: String(i),
          question: q.question,
          options: q.options,
          correctIndex: q.answerIndex,
          explanation: q.explanation ?? "",
        }
      })

      const newQuiz: QuizListItem = {
        id: quizId,
        title: quizTitle,
        numQuestions: createPreview.length,
        questionDurationSec: createDurationSec,
        createdAt: Date.now(),
      }

      const quizDetail: PersonalQuizDetail = {
        id: quizId,
        title: quizTitle,
        numQuestions: createPreview.length,
        questionDurationSec: createDurationSec,
        questions,
      }

      // Save to localStorage
      const updatedQuizzes = [...currentQuizzes, newQuiz]
      saveQuizzes(noteId, updatedQuizzes)
      saveQuizDetail(quizDetail)

      await refreshLists()
      createdRef.current.createdQuizId = quizId
      await handleStartQuiz(quizId) // open attempt modal right away
      setCreateOpen(false)
      setCreatePreview(null)
    } catch (e) {
      console.error("Create quiz failed:", e)
      alert("Create quiz failed. See console.")
    } finally {
      setCreating(false)
    }
  }

  // ------------------------------ Attempt flow ------------------------------

  // ★ FIX: optional forceReset flag, and always strip any completion flags from detail
  async function handleStartQuiz(quizId: string, forceResetIndex?: boolean) {
    setAttemptLoading(true)
    try {
      const quiz = getQuizDetail(quizId)

      // Clean any stale completion fields to guarantee a fresh run
      const cleanedQuiz = quiz
        ? ({
            ...quiz,
            showCompletion: false,
            finalScore: undefined,
            totalQuestions: undefined,
          } as PersonalQuizDetail)
        : null

      setAttemptQuizDetail(cleanedQuiz)
      setAttemptIndex(0) // ensure first question
      if (forceResetIndex) {
        // extra safety in case any effect tries to restore progress
        setAttemptIndex(0) // ★ FIX
      }
      setSelectedQuizId(quizId)
      setAttemptOpen(true)
      setSelectedAnswerIndex(null)
      setAnswerFeedback(null)
      setPendingResult(null)
    } catch (e) {
      console.error("Start attempt failed:", e)
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

    await new Promise((resolve) => setTimeout(resolve, 800))

    try {
      const totalLocal = attemptQuizDetail.numQuestions
      const isLastQuestion = attemptIndex >= totalLocal - 1

      if (isLastQuestion) {
        // Calculate final score (mock)
        const currentAttempts = getAttempts(noteId)
        const existingAttempt = currentAttempts.find((a) => a.quizId === selectedQuizId)
        const score = Math.floor(Math.random() * (totalLocal + 1)) // Mock score

        // Preserve original save (kept intact)
        const newAttempt: AttemptLight = {
          quizId: selectedQuizId,
          finished: true,
          finishedAt: Date.now(),
          score,
        }
        const updatedAttempts = existingAttempt
          ? currentAttempts.map((a) => (a.quizId === selectedQuizId ? newAttempt : a))
          : [...currentAttempts, newAttempt]
        saveAttempts(noteId, updatedAttempts)

        // Stash for finalize-on-close as well
        setPendingResult({ score, total: totalLocal })

        // Show completion UI
        setAttemptQuizDetail({
          ...attemptQuizDetail,
          showCompletion: true,
          finalScore: score,
          totalQuestions: totalLocal,
        } as any)

        await refreshLists()
      } else {
        setAttemptIndex((i) => Math.min(i + 1, totalLocal - 1))
        setSelectedAnswerIndex(null)
        setAnswerFeedback(null)
      }
    } catch (e) {
      console.error("Submit answer failed:", e)
      alert("Could not submit answer. See console.")
    } finally {
      setSubmittingAnswer(false)
    }
  }

  // ------------------------------ Review flow ------------------------------

  async function openReview(quizId: string) {
    try {
      setReviewOpen(true)
      setReviewAttempt(null)
      setReviewQuizDetail(null)
      setReviewIndex(0)

      const detail = getQuizDetail(quizId)
      setReviewQuizDetail(detail)

      const attempts = getAttempts(noteId)
      const attempt = attempts.find((a) => a.quizId === quizId)

      if (attempt) {
        // Mock review data
        const qArr = detail ? Object.values(detail.questions) : []
        const mockAnswers: AttemptAnswer[] = qArr.map((_, i) => ({
          optionIdx: Math.floor(Math.random() * 4),
          timeMs: 10000 + Math.random() * 20000,
          correct: Math.random() > 0.5,
        }))

        setReviewAttempt({
          score: attempt.score,
          finished: attempt.finished,
          finishedAt: attempt.finishedAt,
          answers: mockAnswers,
          stats: {
            avgTimeMs: 15000,
            correctCount: attempt.score,
          },
        })
      }
      setSelectedQuizId(quizId)
    } catch (e) {
      console.error("Open review failed:", e)
      alert("Could not load your attempt. See console.")
    }
  }

  // ------------------------------ Retake function ------------------------------

  async function handleRetakeQuiz() {
    if (!selectedQuizId) return

    // Ask for time (seconds per question) for the retake.
    const currentDetail = getQuizDetail(selectedQuizId)
    const defaultSec = currentDetail?.questionDurationSec ?? createDurationSec
    const input = window.prompt("Seconds per question for retake:", String(defaultSec))
    let sec = Number(input)
    if (!Number.isFinite(sec) || sec < 10) sec = defaultSec // basic guard

    // Remove the completed attempt (so it moves back to Active)
    const currentAttempts = getAttempts(noteId)
    const updatedAttempts = currentAttempts.filter((a) => a.quizId !== selectedQuizId)
    saveAttempts(noteId, updatedAttempts)

    // Update stored quiz detail to reflect chosen per-question time and clear completion flags
    if (currentDetail) {
      const updatedDetail: PersonalQuizDetail = {
        ...currentDetail,
        questionDurationSec: sec,
        showCompletion: false,
        finalScore: undefined,
        totalQuestions: undefined,
      }
      saveQuizDetail(updatedDetail)
    }

    // ★ FIX: wipe any hypothetical progress cache key if one existed (defensive)
    try {
      localStorage.removeItem(`quiz_progress_${selectedQuizId}`) // harmless if not used
    } catch {}

    // ★ FIX: hard reset all local attempt state
    setSelectedAnswerIndex(null)
    setAnswerFeedback(null)
    setAttemptIndex(0)
    setPendingResult(null)

    // Close current modal and refresh lists
    setAttemptOpen(false)
    await refreshLists()

    // ★ FIX: bump session to force a brand-new render/mount of the attempt view
    setAttemptSession((s) => s + 1)

    // Start fresh from question 1 after a short delay
    setTimeout(() => {
      handleStartQuiz(selectedQuizId!, true) // forceResetIndex
    }, 100)
  }

  // ------------------------------ Render helpers ------------------------------

  const wrapperClass = "w-full transition-all"

  function renderQuestionCard() {
    if (!attemptQuizDetail) return null
    const qArrSorted = Object.values(attemptQuizDetail.questions).sort((a, b) => Number(a.id) - Number(b.id))
    const q = qArrSorted[attemptIndex]
    const idxHuman = attemptIndex + 1
    const progress = (idxHuman / qArrSorted.length) * 100

    return (
      <div key={attemptSession} className="space-y-6">{/* ★ FIX: key ensures full subtree remount on retake */}
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, #3b82f6, #2563eb)" }}
          />
        </div>

        <div className="text-lg text-muted-foreground font-medium">
          Question {idxHuman} of {qArrSorted.length}
        </div>

        <div className="text-2xl font-semibold text-foreground leading-relaxed">{q.question}</div>

        <div className="grid gap-4">
          {q.options.map((opt, i) => {
            let buttonClass =
              "justify-start text-left transition-all duration-200 p-6 text-lg min-h-[80px] relative overflow-hidden"

            if (answerFeedback && answerFeedback.index === i) {
              buttonClass += answerFeedback.correct
                ? " bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-emerald-600 shadow-xl transform scale-[1.02] ring-4 ring-emerald-200"
                : " bg-gradient-to-r from-red-500 to-red-600 text-white border-red-600 shadow-xl transform scale-[1.02] ring-4 ring-red-200"
            } else if (selectedAnswerIndex === i) {
              buttonClass +=
                " bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-lg transform scale-[1.01] ring-2 ring-blue-200"
            } else {
              buttonClass +=
                " hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 hover:border-blue-500 hover:shadow-lg hover:transform hover:scale-[1.01] hover:ring-2 hover:ring-blue-200 bg-white text-gray-900 border-gray-300"
            }

            return (
              <Button
                key={i}
                variant="outline"
                className={buttonClass}
                disabled={submittingAnswer || answerFeedback !== null}
                onClick={() => {
                  setSelectedAnswerIndex(i)
                  setTimeout(() => submitAnswer(i), 100)
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

  function renderCompletionScreen(score: number, total: number) {
    const safeTotal = Math.max(1, Number(total || 0)) // prevent divide-by-zero
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
      congratsData = {
        emoji: "🎉",
        title: "Outstanding!",
        subtitle: "Perfect performance!",
        bgGradient: "from-yellow-400 via-yellow-500 to-amber-500",
        textColor: "text-yellow-900",
        ringColor: "ring-yellow-300",
      }
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

        <div className="flex gap-4">
        </div>
      </div>
    )
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
    const isCorrectAnswer = chosen === correct

    return (
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground font-medium">
          Review {idxHuman} / {qArr.length}
        </div>

        <div className="text-xl font-semibold text-foreground leading-relaxed">{q.question}</div>

        <div className="space-y-3">
          {q.options.map((opt, i) => {
            const isCorrect = i === correct
            const isChosen = i === chosen

            let optionClass = "flex items-center gap-4 p-4 rounded-lg border transition-all"

            if (isChosen && !isCorrect) {
              optionClass += " bg-red-100 border-red-200"
            } else if (isCorrect) {
              optionClass += " bg-green-100 border-green-200"
            } else {
              optionClass += " bg-white border-gray-200"
            }

            return (
              <div key={i} className={optionClass}>
                <span className="font-bold bg-gray-800 text-white px-3 py-1 rounded-full text-sm min-w-[32px] flex items-center justify-center">
                  {String.fromCharCode(65 + i)}
                </span>
                <div className="flex-1 text-base">{opt}</div>
                {isChosen && !isCorrect && <span className="text-red-600 font-bold text-lg">✗</span>}
                {isCorrect && <span className="text-green-600 font-bold text-lg">✓</span>}
              </div>
            )
          })}
        </div>

        <div className="text-sm font-medium">
          {isCorrectAnswer ? (
            <span className="text-green-600">✓ Correct Time: {fmtMs(a?.timeMs)}</span>
          ) : (
            <span className="text-red-600">✗ Incorrect Time: {fmtMs(a?.timeMs)}</span>
          )}
        </div>

        {q.explanation && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="font-medium text-gray-900 mb-1">Explanation</div>
            <div className="text-gray-700 text-sm">{q.explanation}</div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            disabled={reviewIndex <= 0}
            onClick={() => setReviewIndex((i) => Math.max(0, i - 1))}
            className="px-6 py-2"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setReviewIndex((i) => Math.min(qArr.length - 1, i + 1))}
            disabled={reviewIndex >= qArr.length - 1}
            className="px-6 py-2"
          >
            Next
          </Button>
        </div>
      </div>
    )
  }

  // ------------------------------ UI ------------------------------

  return (
    <>
      <div className={`${wrapperClass} h-full flex flex-col`}>
        <div className="p-0 flex-1 min-h-0">
          <div className="h-full flex flex-col">
            {/* -------- Top Half: Quizzes (uniform header) -------- */}
            <div className="h-full bg-background/10 flex flex-col min-h-0">
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
                <div className="p-4 pt-6">
                  <div className="space-y-1">
                    <div>
                      <button
                        onClick={() => toggleFolderExpansion("active")}
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
                          {loadingActiveQuizzes ? (
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
                                onClick={() => setSelectedQuizId(q.id)} // single click = select
                                onDoubleClick={() => handleStartQuiz(q.id)} // double click = start
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

                    <div>
                      <button
                        onClick={() => toggleFolderExpansion("completed")}
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
                          {loadingCompletedQuizzes ? (
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
                                // FIX: single-click opens Review (not resume)
                                onClick={() => openReview(q.id)}
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

              {/* Removed the Generate Quiz button from here */}
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
                          type="number"
                          min={1}
                          max={20}
                          value={createNumQuestions}
                          onChange={(e) =>
                            setCreateNumQuestions(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                          }
                          className="w-full rounded-md border border-border/40 bg-background/40 px-4 py-3 text-base"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-base font-medium text-foreground">Seconds per question</label>
                        <input
                          type="number"
                          min={10}
                          max={300}
                          value={createDurationSec}
                          onChange={(e) =>
                            setCreateDurationSec(Math.max(10, Math.min(300, Number(e.target.value) || 10)))
                          }
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
                              onClick={handleCreatePersonalAnytime}
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
            onClick={() => setAttemptOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Card className="w-full max-w-5xl min-w-[1000px] h-[90vh] min-h-[700px] max-h-[900px] bg-background shadow-2xl flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between px-8 py-6 border-b shrink-0">
                  <CardTitle className="text-2xl">Quiz</CardTitle>
                  <Button
                    onClick={() => setAttemptOpen(false)}
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
                      <div className="w-full max-w-3xl">
                        {(attemptQuizDetail as any)?.showCompletion
                          ? renderCompletionScreen(
                              (attemptQuizDetail as any).finalScore,
                              (attemptQuizDetail as any).totalQuestions,
                            )
                          : renderQuestionCard()}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>,
          document.body,
        )}

      {/* Review Modal */}
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
                      <div className="flex items-center justify-between mb-6">
                        <div className="text-lg font-medium">
                          Score: {reviewAttempt.score} / {Object.keys(reviewQuizDetail.questions).length}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Avg time: {fmtMs(reviewAttempt.stats?.avgTimeMs)} • Correct: {reviewAttempt.stats?.correctCount}
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
