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
  Maximize2,
  Minimize2,
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
  const [orgQuizzes, setOrgQuizzes] = useState<QuizListItem[]>([]) // all for note
  const [myAttempts, setMyAttempts] = useState<AttemptLight[]>([])
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])

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
  const [attemptQuizDetail, setAttemptQuizDetail] = useState<OrgQuizDetail | null>(null)
  const [attemptIndex, setAttemptIndex] = useState<number>(0)
  const [submittingAnswer, setSubmittingAnswer] = useState(false)
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null)

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
    if (!orgId || !quizId) return
    setLoadingLeaderboard(true)
    try {
      const lbFn = httpsCallable(fns, "getOrgAsyncLeaderboard")
      const { data }: any = await lbFn({ orgId, quizId })
      setLeaderboard((data?.items || []) as LeaderboardRow[])
    } catch (error) {
      console.error("Failed to load leaderboard:", error)
    } finally {
      setLoadingLeaderboard(false)
    }
  }

  // periodic LB refresh for selected quiz
  useEffect(() => {
    if (!selectedQuizId) return
    refreshLeaderboard(selectedQuizId)
    const t = setInterval(() => refreshLeaderboard(selectedQuizId), 5000)
    return () => clearInterval(t)
  }, [selectedQuizId])

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
      // 1) read note content (assumes content stored under .../content)
      const noteSnap = await get(ref(db, `organizations/${orgId}/notes/${noteId}/content`))
      const noteContent = noteSnap.exists() ? String(noteSnap.val() ?? "") : ""

      // 2) ask Gemini for questions
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
      await handleStartQuiz(createdRef.current.createdQuizId!, true) // open attempt modal right away
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
    const { data }: any = await getFn({ orgId, quizId })
    return data?.quiz as OrgQuizDetail
  }

  async function handleStartQuiz(quizId: string, openDirect = false) {
    if (!orgId) return
    setAttemptLoading(true)
    try {
      // start or resume
      const startFn = httpsCallable(fns, "startOrResumeOrgAsyncAttempt")
      const { data }: any = await startFn({ orgId, quizId, displayName })

      // load details
      const quiz = await loadQuizDetail(quizId)
      setAttemptQuizDetail(quiz || null)
      setAttemptIndex(Number(data?.currentIndex || 0))
      setSelectedQuizId(quizId)
      setAttemptOpen(true)
      setSelectedAnswerIndex(null)
      // ensure we have LB visible
      refreshLeaderboard(quizId)
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
    try {
      const submitFn = httpsCallable(fns, "submitOrgAsyncAnswer")
      const { data }: any = await submitFn({
        orgId,
        quizId: selectedQuizId,
        optionIdx,
      })
      // LB updates even for partial (backend changed)
      refreshLeaderboard(selectedQuizId)

      const total = attemptQuizDetail.numQuestions
      if (data?.finishedNow) {
        // finished — close attempt modal, refresh lists so quiz moves to "Completed"
        setAttemptOpen(false)
        setAttemptQuizDetail(null)
        setAttemptIndex(0)
        setSelectedAnswerIndex(null)
        await refreshLists()
      } else {
        setAttemptIndex((i) => Math.min(i + 1, total - 1))
        setSelectedAnswerIndex(null)
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
      const { data }: any = await mineFn({ orgId, quizId })
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
      refreshLeaderboard(quizId)
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

    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Question {idxHuman} / {qArr.length}
        </div>
        <div className="text-base font-medium text-foreground">{q.question}</div>
        <div className="grid gap-2">
          {q.options.map((opt, i) => (
            <Button
              key={i}
              variant={selectedAnswerIndex === i ? "default" : "outline"}
              className={`justify-start text-left transition-all ${
                selectedAnswerIndex === i
                  ? "bg-blue-500 text-white border-blue-500 shadow-md"
                  : "hover:bg-blue-50 hover:border-blue-300"
              }`}
              disabled={submittingAnswer}
              onClick={() => {
                setSelectedAnswerIndex(i)
                setTimeout(() => submitAnswer(i), 100)
              }}
            >
              <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </Button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          // Simplified instruction text for faster flow Each question: {attemptQuizDetail.questionDurationSec}s •
          Progress auto-saved
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
            const style =
              isCorrect && isChosen
                ? "bg-green-500/20 border-green-400/40"
                : isCorrect
                  ? "bg-green-500/10 border-green-400/30"
                  : isChosen
                    ? "bg-red-500/10 border-red-400/30"
                    : "bg-background/20 border-border/40"
            return (
              <div key={i} className={`rounded-lg border p-3 ${style}`}>
                <div className="text-sm">
                  {String.fromCharCode(65 + i)}. {opt}
                </div>
              </div>
            )
          })}
        </div>

        <div className="text-sm">
          {chosen === correct ? (
            <span className="text-green-500 font-medium">Correct.</span>
          ) : (
            <span className="text-red-500 font-medium">Incorrect.</span>
          )}{" "}
          <span className="text-muted-foreground">Time: {fmtMs(a?.timeMs)}</span>
        </div>

        {q.explanation && (
          <div className="rounded-lg border border-border/40 bg-background/20 p-3 text-sm">
            <div className="font-medium mb-1">Explanation</div>
            <div className="text-muted-foreground">{q.explanation}</div>
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
      <Card className={`${wrapperClass} h-full`}>
        <CardHeader className="flex flex-row items-center justify-between p-4 shrink-0">
          <CardTitle className="text-lg">Quizzes</CardTitle>
          <Button
            onClick={() => setAttemptOpen(true)}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 shrink-0 hover:bg-accent bg-transparent"
            aria-label="Expand"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-0 flex-1 min-h-0">
          <div className="h-full flex flex-col">
            <div className="h-1/2 border-b border-border/30 bg-background/10 flex flex-col min-h-0">
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
                            {loadingActiveQuizzes && <Loader2 className="ml-2 inline h-4 w-4 animate-spin" />}
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
                                  onClick={() => handleStartQuiz(q.id)}
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
                            {loadingCompletedQuizzes && <Loader2 className="ml-2 inline h-4 w-4 animate-spin" />}
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
                                  onClick={() => openReview(q.id)}
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
                <div className="shrink-0 p-4 border-t border-border/20 bg-background/5">
                  <Button
                    onClick={handleOpenCreate}
                    disabled={creating}
                    size="sm"
                    className="gap-2 bg-black text-white hover:bg-gray-800 border border-white/20"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {creating ? "Working..." : "Create"}
                  </Button>
                </div>
              )}
            </div>

            <div className="h-1/2 bg-background/5 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-4 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-4 shrink-0">
                    <Trophy className="h-5 w-5 text-black" />
                    <h3 className="text-sm font-medium text-foreground">Leaderboard</h3>
                    {loadingLeaderboard && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  </div>

                  <div className="flex-1 min-h-0">
                    {!selectedQuizId ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Click a quiz to view leaderboard</p>
                        </div>
                      </div>
                    ) : loadingLeaderboard ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" />
                          <p>Loading leaderboard...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 h-full overflow-y-auto">
                        {leaderboard.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            <div className="text-center">
                              <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-xs">No entries yet.</p>
                            </div>
                          </div>
                        ) : (
                          leaderboard.map((entry, index) => (
                            <div
                              key={entry.uid}
                              className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 ${
                                entry.uid === userId
                                  ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-400/60 shadow-lg"
                                  : "bg-gradient-to-r from-background/40 to-background/20 border-border/40 hover:border-border/60"
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-md ${
                                    index === 0
                                      ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black"
                                      : index === 1
                                        ? "bg-gradient-to-br from-gray-300 to-gray-500 text-black"
                                        : index === 2
                                          ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white"
                                          : "bg-gradient-to-br from-background/60 to-background/40 text-foreground border-2 border-border/40"
                                  }`}
                                >
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-foreground">
                                    {entry.name}
                                    {entry.uid === userId && (
                                      <span className="text-xs text-blue-500 ml-2 font-medium">(You)</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span>⏱️ {fmtMs(entry.avgTimeMs)} avg</span>
                                    <span>•</span>
                                    <span>✅ {entry.correctCount} correct</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-foreground">{entry.score}</div>
                                <div className="text-xs text-muted-foreground">/{entry.totalQuestions ?? "?"}</div>
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
        </CardContent>
      </Card>

      {/* Create Modal */}
      {createOpen &&
        isClient &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-black/35 backdrop-blur-[6px] flex items-center justify-center p-4"
            onClick={() => setCreateOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Card className="w-full max-w-4xl min-w-[900px] h-[90vh] min-h-[700px] max-h-[800px] bg-background shadow-2xl flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between px-6 py-4 border-b shrink-0">
                  <CardTitle className="text-xl">Create Anytime Quiz</CardTitle>
                  <Button
                    onClick={() => setCreateOpen(false)}
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0 hover:bg-accent bg-transparent"
                    aria-label="Close modal"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 min-h-0 px-6 pb-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Number of questions</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={createNumQuestions}
                          onChange={(e) =>
                            setCreateNumQuestions(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                          }
                          className="w-full rounded-md border border-border/40 bg-background/40 px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Seconds per question</label>
                        <input
                          type="number"
                          min={10}
                          max={300}
                          value={createDurationSec}
                          onChange={(e) =>
                            setCreateDurationSec(Math.max(10, Math.min(300, Number(e.target.value) || 10)))
                          }
                          className="w-full rounded-md border border-border/40 bg-background/40 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    {!createPreview ? (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleGenerateFromNote}
                          disabled={creating}
                          className="bg-black text-white hover:bg-gray-800 border border-white/20"
                        >
                          {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Generate from note
                        </Button>
                        <div className="text-xs text-muted-foreground">
                          We'll sanitize the note and ask Gemini to produce MCQs.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-sm font-medium">Preview ({createPreview.length})</div>
                        <div className="max-h-64 overflow-auto rounded-md border border-border/40">
                          <div className="p-3 space-y-3">
                            {createPreview.map((q, i) => (
                              <div key={i} className="rounded-md border border-border/30 bg-background/30 p-3">
                                <div className="text-sm font-medium">
                                  {i + 1}. {q.question}
                                </div>
                                <ul className="mt-2 text-sm list-disc pl-5">
                                  {q.options.map((o, j) => (
                                    <li key={j}>
                                      {String.fromCharCode(65 + j)}. {o}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Button variant="outline" onClick={() => setCreatePreview(null)} disabled={creating}>
                            Regenerate
                          </Button>
                          <Button
                            onClick={handleCreateOrgAnytime}
                            disabled={creating}
                            className="bg-black text-white hover:bg-gray-800 border border-white/20"
                          >
                            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Create & Start
                          </Button>
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
      {attemptOpen &&
        isClient &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-black/35 backdrop-blur-[6px] flex items-center justify-center p-4"
            onClick={() => setAttemptOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Card className="w-full max-w-4xl min-w-[900px] h-[90vh] min-h-[700px] max-h-[800px] bg-background shadow-2xl flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between px-6 py-4 border-b shrink-0">
                  <CardTitle className="text-xl">Quiz</CardTitle>
                  <Button
                    onClick={() => setAttemptOpen(false)}
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0 hover:bg-accent bg-transparent"
                    aria-label="Close modal"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 min-h-0 px-6 pb-6">
                  {attemptLoading ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading quiz…
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 flex items-center justify-center">
                      <div className="w-full max-w-2xl">{renderQuestionCard()}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>,
          document.body,
        )}

      {/* Review Modal */}
      {reviewOpen &&
        isClient &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-black/35 backdrop-blur-[6px] flex items-center justify-center p-4"
            onClick={() => setReviewOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Card className="w-full max-w-4xl min-w-[900px] h-[90vh] min-h-[700px] max-h-[800px] bg-background shadow-2xl flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between px-6 py-4 border-b shrink-0">
                  <CardTitle className="text-xl">Quiz Review</CardTitle>
                  <Button
                    onClick={() => setReviewOpen(false)}
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0 hover:bg-accent bg-transparent"
                    aria-label="Close modal"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 min-h-0 px-6 pb-6">
                  {!reviewAttempt || !reviewQuizDetail ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading review…
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
                        <div className="w-full max-w-2xl">{renderReviewCard()}</div>
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
