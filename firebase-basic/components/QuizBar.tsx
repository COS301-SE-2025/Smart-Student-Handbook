"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Loader2,
  ListChecks,
  Trophy,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Folder,
  Plus,
  X,
  AlertTriangle,
} from "lucide-react"
import { createPortal } from "react-dom"

import { httpsCallable } from "firebase/functions"
import { get, ref } from "firebase/database"
import { db, fns } from "@/lib/firebase"
import { generateQuizQuestions, type ClientQuizItem } from "@/lib/gemini"

// ------------------------------ Types ------------------------------

type QuizListItem = {
  id: string
  title: string
  numQuestions: number
  questionDurationSec: number
  createdAt?: number
}

type LeaderboardRow = {
  uid: string
  name: string
  score: number
  correctCount: number
  avgTimeMs: number
  finishedAt?: number | null
  totalQuestions?: number
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

type OrgQuizDetail = {
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

type QuizBarProps = {
  orgId?: string
  noteId: string
  userId: string
  displayName: string
  defaultDurationSec?: number
  defaultNumQuestions?: number
}

// ------------------------------ UI Helpers ------------------------------

function fmtMs(ms: number | undefined) {
  if (!ms) return "0s"
  return `${Math.round(ms / 1000)}s`
}

// ------------------------------ Component ------------------------------

export default function QuizBar({
  orgId,
  noteId,
  userId,
  displayName,
  defaultDurationSec = 45,
  defaultNumQuestions = 5,
}: QuizBarProps) {
  // folders
  const [expandedFolders, setExpandedFolders] = useState({ active: true, completed: true })

  const [loadingActiveQuizzes, setLoadingActiveQuizzes] = useState(false)
  const [loadingCompletedQuizzes, setLoadingCompletedQuizzes] = useState(false)
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)

  // data state
  const [orgQuizzes, setOrgQuizzes] = useState<QuizListItem[]>([]) 
  const [myAttempts, setMyAttempts] = useState<AttemptLight[]>([])
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])

  // creation modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createNumQuestions, setCreateNumQuestions] = useState<number>(defaultNumQuestions)
  const [createDurationSec, setCreateDurationSec] = useState<number>(defaultDurationSec)
  const [createPreview, setCreatePreview] = useState<ClientQuizItem[] | null>(null)
  const createdRef = useRef<{ createdQuizId?: string }>({}) 

  // attempt modal state
  const [attemptOpen, setAttemptOpen] = useState(false)
  const [attemptLoading, setAttemptLoading] = useState(false)
  const [attemptQuizDetail, setAttemptQuizDetail] = useState<OrgQuizDetail | null>(null)
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
  const [reviewQuizDetail, setReviewQuizDetail] = useState<OrgQuizDetail | null>(null)
  const [reviewIndex, setReviewIndex] = useState(0)

  const [isClient, setIsClient] = useState(false)

  useEffect(() => setIsClient(true), [])

  // ------------------------------ Load lists ------------------------------

  const activeQuizzes = useMemo(() => {
    if (!myAttempts.length) return orgQuizzes
    const finishedMap = new Map(myAttempts.map((a) => [a.quizId, a.finished]))
    return orgQuizzes.filter((q) => !finishedMap.get(q.id))
  }, [orgQuizzes, myAttempts])

  const completedQuizzes = useMemo(() => {
    if (!myAttempts.length) return []
    const finishedIds = new Set(myAttempts.filter((a) => a.finished).map((a) => a.quizId))
    return orgQuizzes.filter((q) => finishedIds.has(q.id))
  }, [orgQuizzes, myAttempts])

  async function refreshLists() {
    if (!orgId) return
    setLoadingActiveQuizzes(true)
    setLoadingCompletedQuizzes(true)
    try {
      const listFn = httpsCallable(fns, "listOrgAsyncQuizzes")
      const mineFn = httpsCallable(fns, "listMyOrgAsyncAttempts")
      const [{ data: ld }, { data: md }]: any = await Promise.all([
        listFn({ orgId, noteId }),
        mineFn({ orgId, noteId }),
      ])
      setOrgQuizzes((ld?.items || []) as QuizListItem[])
      setMyAttempts((md?.attempts || []) as AttemptLight[])
    } finally {
      setLoadingActiveQuizzes(false)
      setLoadingCompletedQuizzes(false)
    }
  }

  // auto-load
  useEffect(() => {
    if (orgId) {
      refreshLists()
    }
  }, [orgId, noteId])

  // ------------------------------ Leaderboard ------------------------------

  async function refreshLeaderboard(quizId: string | null) {
    if (!orgId || !quizId) {
      setLeaderboard([])
      return
    }
    setLoadingLeaderboard(true)
    try {
      const lbFn = httpsCallable(fns, "getOrgAsyncLeaderboard")
    
      const { data }: any = await lbFn({ orgId, noteId, quizId })

      let items: any[] = data?.items ?? []
      if (!Array.isArray(items)) items = Object.values(items || {})

   
      const quizMeta = orgQuizzes.find((q) => q.id === quizId)
      const fallbackTotal = quizMeta?.numQuestions

      const normalized: LeaderboardRow[] = (items || []).map((r: any) => ({
        uid: r.uid,
        name: r.name || (r.uid === userId ? displayName : "Member"),
        score: Number(r.score ?? 0),
        correctCount: Number(r.correctCount ?? 0),
        avgTimeMs: Number(r.avgTimeMs ?? 0),
        totalQuestions: Number(r.totalQuestions ?? fallbackTotal ?? 0),
        finishedAt: r.finishedAt ?? null,
      }))

      setLeaderboard(normalized)
    } catch (error) {
      console.error("Failed to load leaderboard:", error)
      setLeaderboard([])
    } finally {
      setLoadingLeaderboard(false)
    }
  }

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
    if (!orgId) return
    setCreating(true)
    setCreatePreview(null)
    try {
  
      const noteSnap = await get(ref(db, `organizations/${orgId}/notes/${noteId}/content`))
      const noteContent = noteSnap.exists() ? String(noteSnap.val() ?? "") : ""

      const items = await generateQuizQuestions(noteContent, createNumQuestions)
      setCreatePreview(items)
    } catch (e) {
      console.error("Quiz generation failed:", e)
      alert("Quiz generation failed. Check console/logs.")
    } finally {
      setCreating(false)
    }
  }

  async function handleCreateOrgAnytime() {
    if (!orgId || !createPreview || createPreview.length === 0) return
    setCreating(true)
    try {
      const createFn = httpsCallable(fns, "createOrgAsyncQuiz")
      const questions = createPreview.map((q, i) => ({
        id: String(i),
        question: q.question,
        options: q.options,
        correctIndex: q.answerIndex,
        explanation: q.explanation ?? "",
      }))

      const { data }: any = await createFn({
        orgId,
        noteId,
        questionDurationSec: createDurationSec,
        questions,
      })

      // refresh lists and prompt to start
      await refreshLists()
      createdRef.current.createdQuizId = data?.quizId as string
      await handleStartQuiz(createdRef.current.createdQuizId!) 
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

  async function loadQuizDetail(quizId: string) {
    const getFn = httpsCallable(fns, "getOrgQuizDetail")

    const { data }: any = await getFn({ orgId, noteId, quizId })
    return data?.quiz as OrgQuizDetail
  }

  async function handleStartQuiz(quizId: string) {
    if (!orgId) return
    setAttemptLoading(true)
    try {
   
      const startFn = httpsCallable(fns, "startOrResumeOrgAsyncAttempt")
    
      const { data }: any = await startFn({ orgId, noteId, quizId, displayName })

      
      const quiz = await loadQuizDetail(quizId)
      setAttemptQuizDetail(quiz || null)
      setAttemptIndex(Number(data?.currentIndex || 0))
      setSelectedQuizId(quizId)
      setAttemptOpen(true)
      setSelectedAnswerIndex(null)
      setAnswerFeedback(null)

     
    } catch (e) {
      console.error("Start attempt failed:", e)
      alert("Could not start the quiz. See console.")
    } finally {
      setAttemptLoading(false)
    }
  }

  async function submitAnswer(optionIdx: number) {
    if (!attemptQuizDetail || selectedQuizId == null || !orgId) return
    setSubmittingAnswer(true)

    const qArrSorted = Object.values(attemptQuizDetail.questions).sort((a, b) => Number(a.id) - Number(b.id))
    const currentQ = qArrSorted[attemptIndex]
    const isCorrect = optionIdx === currentQ.correctIndex
    setAnswerFeedback({ index: optionIdx, correct: isCorrect })

  
    await new Promise((resolve) => setTimeout(resolve, 1500))

    try {
      const submitFn = httpsCallable(fns, "submitOrgAsyncAnswer")
      
      const { data }: any = await submitFn({
        orgId,
        noteId,
        quizId: selectedQuizId,
        optionIdx,
      })

      const totalLocal = attemptQuizDetail.numQuestions

      if (data?.finishedNow) {
        // Prefer authoritative values from backend, with safe fallbacks
        const serverScore =
          typeof data?.score === "number" ? data.score : ((attemptQuizDetail as any)?.finalScore ?? currentQ) ? 0 : 0

        const serverTotal =
          typeof data?.totalQuestions === "number"
            ? data.totalQuestions
            : ((attemptQuizDetail as any)?.totalQuestions ?? totalLocal)

        setAttemptQuizDetail({
          ...attemptQuizDetail,
          showCompletion: true,
          finalScore: serverScore,
          totalQuestions: serverTotal,
        } as any)

        await refreshLists()
        await refreshLeaderboard(selectedQuizId)
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
    if (!orgId) return
    try {
      setReviewOpen(true)
      setReviewAttempt(null)
      setReviewQuizDetail(null)
      setReviewIndex(0)

      const detail = await loadQuizDetail(quizId)
      setReviewQuizDetail(detail || null)

      const mineFn = httpsCallable(fns, "getMyOrgAsyncAttempt")
      // 🔗 NOTE-SCOPED
      const { data }: any = await mineFn({ orgId, noteId, quizId })
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

      // Load leaderboard when opening review
      await refreshLeaderboard(quizId)
    } catch (e) {
      console.error("Open review failed:", e)
      alert("Could not load your attempt. See console.")
    }
  }

  // ------------------------------ Render helpers ------------------------------

  const wrapperClass = "w-full transition-all"

  function renderQuestionCard() {
    if (!attemptQuizDetail) return null
    const qArr = Object.values(attemptQuizDetail.questions).sort((a, b) => Number(a.id) - Number(b.id))
    const q = qArr[attemptIndex]
    const idxHuman = attemptIndex + 1
    const progress = (idxHuman / qArr.length) * 100

    return (
      <div className="space-y-6">
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

  // ------------------------------ UI ------------------------------

  return (
    <>
      <div className={`${wrapperClass} h-full flex flex-col`}>
        <div className="p-0 flex-1 min-h-0">
          <div className="h-full flex flex-col">
            {/* -------- Top Half: Quizzes (uniform header) -------- */}
            <div className="h-1/2 border-b border-border/30 bg-background/10 flex flex-col min-h-0">
              {/* Uniform section header */}
              <div className="sticky top-0 z-0 pr-[84px] flex items-center justify-between gap-2 px-4 py-2 border-b border-border/30 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ListChecks className="h-5 w-5 text-black" />
                  <span>Quizzes</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-4">
                  {!orgId ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <ListChecks className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Open this note inside an organization to access quizzes</p>
                      </div>
                    </div>
                  ) : (
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
                                  onClick={() => {
                                    setSelectedQuizId(q.id)
                                    refreshLeaderboard(q.id) // single-click => show leaderboard
                                  }}
                                  onDoubleClick={() => handleStartQuiz(q.id)} // double-click => open quiz attempt
                                >
                                  <FileText className="h-4 w-4 text-black" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-base font-medium text-foreground truncate">
                                      {q.title || "Anytime Quiz"}
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
                                  onClick={() => {
                                    setSelectedQuizId(q.id)
                                    refreshLeaderboard(q.id) // single-click => show leaderboard
                                  }}
                                  onDoubleClick={() => openReview(q.id)} // double-click => open review
                                >
                                  <FileText className="h-4 w-4 text-black" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-base font-medium text-foreground truncate">
                                      {q.title || "Anytime Quiz"}
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
                  )}
                </div>
              </div>

              {orgId && (
                <div className="shrink-0 p-4 border-t border-border/20 bg-background/5 flex justify-end">
                  <Button
                    onClick={handleOpenCreate}
                    disabled={creating}
                    size="sm"
                    className="gap-2 bg-black text-white hover:bg-gray-800 border border-white/20"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {creating ? "Working..." : "Create Quiz"}
                  </Button>
                </div>
              )}
            </div>

            {/* -------- Bottom Half: Leaderboard (uniform header) -------- */}
            <div className="h-1/2 bg-background/5 flex flex-col min-h-0">
              {/* Uniform section header */}
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-2 border-b border-border/30 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Trophy className="h-5 w-5 text-black" />
                  <span>Leaderboard</span>
                </div>
                {loadingLeaderboard && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-4 h-full flex flex-col">
                  <div className="flex-1 min-h-0">
                    {!selectedQuizId ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Click a quiz to view leaderboard</p>
                        </div>
                      </div>
                    ) : loadingLeaderboard ? (
                      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading leaderboard…
                      </div>
                    ) : leaderboard.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">No entries yet</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {leaderboard.map((entry, index) => {
                          // medal colors & shadows by rank
                          const rowRankShadow =
                            index === 0
                              ? "border-[#FFD700] shadow-[0_8px_20px_rgba(255,215,0,0.35)]"
                              : index === 1
                                ? "border-[#C0C0C0] shadow-[0_8px_20px_rgba(192,192,192,0.30)]"
                                : index === 2
                                  ? "border-[#CD7F32] shadow-[0_8px_20px_rgba(205,127,50,0.30)]"
                                  : "border-gray-200 hover:border-gray-300"

                          const selfHighlight = "bg-white text-black"
                          const medalClass =
                            index === 0
                              ? "bg-[#FFD700] text-black shadow-[0_6px_18px_rgba(255,215,0,0.6)]"
                              : index === 1
                                ? "bg-[#C0C0C0] text-black shadow-[0_6px_18px_rgba(192,192,192,0.6)]"
                                : index === 2
                                  ? "bg-[#CD7F32] text-black shadow-[0_6px_18px_rgba(205,127,50,0.55)]"
                                  : "bg-white text-black border-2 border-gray-300"

                          return (
                            <div
                              key={`${entry.uid ?? "row"}-${index}`}
                              className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 ${selfHighlight} ${rowRankShadow}`}
                            >
                              <div className="flex items-center gap-4">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${medalClass}`}
                                >
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-black flex items-center gap-2">
                                    <span>{entry.name || "Member"}</span>
                                    {entry.uid === userId && (
                                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-black text-white shadow-lg">
                                        YOU
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs flex items-center gap-2 text-gray-500">
                                    <span>⏱️ {fmtMs(entry.avgTimeMs)} avg</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-black">{entry.score}</div>
                                <div className="text-xs text-gray-500">/{entry.totalQuestions ?? "?"}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
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

                    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                      <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-800">
                        <strong>Disclaimer</strong>: The content used to generate the quiz is not fact-checked or verified. The quiz questions are generated from the contents in the note editor.
                      </p>
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
                              onClick={handleCreateOrgAnytime}
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
