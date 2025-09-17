"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, X, Trophy, Clock, CheckCircle, XCircle } from "lucide-react"
import { httpsCallable } from "firebase/functions"
import { onValue, ref, get, child } from "firebase/database"
import { db, fns } from "@/lib/firebase"

type QuizState = "lobby" | "countdown" | "active" | "ended" | "cancelled"
type Role = "Admin" | "Member" | undefined

interface QuizModalProps {
  orgId: string
  noteId: string
  userId: string
  displayName: string
  isOpen: boolean
  onClose: () => void
  defaultDurationSec?: number
  defaultNumQuestions?: number
}

export default function QuizModal({
  orgId,
  noteId,
  userId,
  displayName,
  isOpen,
  onClose,
  defaultDurationSec = 45,
  defaultNumQuestions = 5,
}: QuizModalProps) {
  const [quizId, setQuizId] = useState<string | null>(null)
  const [lastQuizId, setLastQuizId] = useState<string | null>(null)
  const docQuizId = quizId ?? lastQuizId
  const [quiz, setQuiz] = useState<any>(null)
  const [quizLoading, setQuizLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [role, setRole] = useState<Role>(undefined)
  const [hoveredOption, setHoveredOption] = useState<number | null>(null)
  const isAdmin = role === "Admin"

  // Add overlay class to body when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overlay-open")
      return () => document.body.classList.remove("overlay-open")
    }
  }, [isOpen])

  // ---- role
  useEffect(() => {
    if (!orgId || !userId) return
    const roleRef = ref(db, `organizations/${orgId}/members/${userId}`)
    const unsub = onValue(roleRef, (snap) => setRole(snap.val() as Role))
    return () => unsub()
  }, [orgId, userId])

  // ---- active quiz pointer
  useEffect(() => {
    if (!orgId || !noteId) return
    const activeRef = ref(db, `organizationActiveQuiz/${orgId}/${noteId}`)
    const unsub = onValue(activeRef, (snap) => {
      const id = snap.val() || null
      setQuizId(id)
      if (id) setLastQuizId(id)
    })
    return () => unsub()
  }, [orgId, noteId])

  // ---- quiz doc subscription
  useEffect(() => {
    if (!orgId || !docQuizId) {
      setQuiz(null)
      setQuizLoading(false)
      return
    }
    const qRef = ref(db, `organizations/${orgId}/quizzes/${docQuizId}`)
    setQuizLoading(true)
    const unsub = onValue(qRef, (snap) => {
      setQuiz(snap.val() || null)
      setQuizLoading(false)
    })
    return () => unsub()
  }, [orgId, docQuizId])

  // ---- callables
  const createQuiz = useMemo(() => httpsCallable(fns, "createQuiz"), [])
  const joinQuiz = useMemo(() => httpsCallable(fns, "joinQuiz"), [])
  const startQuiz = useMemo(() => httpsCallable(fns, "startQuiz"), [])
  const advanceIfReady = useMemo(() => httpsCallable(fns, "advanceIfReady"), [])
  const submitAnswer = useMemo(() => httpsCallable(fns, "submitAnswer"), [])
  const endQuiz = useMemo(() => httpsCallable(fns, "endQuiz"), [])

  // ---- derived
  const state: QuizState | undefined = quiz?.state as QuizState | undefined
  const questionsArray: any[] = quiz
    ? Object.values(quiz.questions ?? {}).sort((a: any, b: any) => Number(a.id) - Number(b.id))
    : []

  // per-user progress from participants
  const me = quiz?.participants?.[userId]
  const iAmParticipant = !!me
  const myIndex: number = typeof me?.currentIndex === "number" ? me.currentIndex : 0
  const myFinished: boolean = !!me?.finished
  const currentQ = questionsArray[myIndex]

  // timers: per-user timer driven by me.questionStartAt
  const durationMs = (quiz?.questionDurationSec ?? defaultDurationSec) * 1000
  const myStartAt = me?.questionStartAt as number | undefined
  const [remainingMs, setRemainingMs] = useState<number>(durationMs)
  useEffect(() => {
    if (!docQuizId || !quiz || state !== "active" || !iAmParticipant || !myStartAt) return
    const tick = () => {
      setRemainingMs(Math.max(0, durationMs - (Date.now() - myStartAt)))
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [docQuizId, quiz, state, iAmParticipant, myStartAt, durationMs])
  const activeSecsLeft = Math.max(0, Math.ceil(remainingMs / 1000))

  // countdown
  const countdownEndAt = quiz?.countdownEndAt as number | undefined
  const countdownSecs = (() => {
    if (state !== "countdown" || !countdownEndAt) return 0
    const left = Math.max(0, countdownEndAt - Date.now())
    return Math.ceil(left / 1000)
  })()

  // ---- ping only during countdown to flip to active
  useEffect(() => {
    if (!docQuizId || !orgId) return
    if (state !== "countdown") return
    const id = setInterval(async () => {
      try {
        await advanceIfReady({ orgId, quizId: docQuizId })
      } catch {
        /* ignore */
      }
    }, 1000)
    return () => clearInterval(id)
  }, [state, orgId, docQuizId, advanceIfReady])

  // ---- actions
  const handleCreate = async () => {
    setCreating(true)
    try {
      const res: any = await createQuiz({
        orgId,
        noteId,
        questionDurationSec: defaultDurationSec,
        numQuestions: defaultNumQuestions,
      })
      if (!res?.data?.quizId) {
        const snap = await get(child(ref(db), `organizationActiveQuiz/${orgId}/${noteId}`))
        const id = snap.val() || null
        setQuizId(id)
        if (id) setLastQuizId(id)
      }
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = async () => {
    if (!docQuizId) return
    await joinQuiz({ orgId, quizId: docQuizId, displayName })
  }

  const handleStart = async () => {
    if (!docQuizId) return
    await startQuiz({ orgId, quizId: docQuizId })
  }

  const handleAnswer = async (i: number) => {
    if (!docQuizId) return
    await submitAnswer({ orgId, quizId: docQuizId, optionIdx: i })
  }

  const handleEnd = async () => {
    if (!docQuizId) return
    await endQuiz({ orgId, quizId: docQuizId })
  }

  // participants for small labels
  const participants = quiz?.participants ?? {}
  const connectedNames: string[] = Object.entries(participants)
    .filter(([_, p]: any) => p?.connected !== false)
    .map(([uid, p]: any) => p?.displayName || uid)

  // button visibility
  const noActiveQuiz = !quizId
  const quizMissing = !!docQuizId && quiz == null
  const quizFinished = state === "ended" || state === "cancelled"

  const showCreate = isAdmin && (noActiveQuiz || quizMissing || quizFinished)
  const showJoin =
    !!docQuizId && !iAmParticipant && (quizMissing || state === "lobby" || state === "countdown" || state === "active")
  const showStart = !!docQuizId && isAdmin && (state === "lobby" || (quizMissing && !quizFinished))
  const showEnd = !!docQuizId && isAdmin && (state === "lobby" || state === "active" || state === "countdown")

  // helper to pull my answer for each question index
  const myAnswers: Record<number, { optionIdx: number; timeMs: number; correct: boolean }> = (me?.answers as any) || {}

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Content - 3/4 of screen width */}
      <div className="relative w-3/4 max-w-6xl mx-4 h-3/4 max-h-[800px] bg-background border rounded-lg shadow-xl overflow-hidden">
        <Card className="h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle className="text-xl font-semibold">Live Quiz</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{isAdmin ? "Admin" : role ? "Member" : "Guest"}</span>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-6">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {showCreate && (
                <Button onClick={handleCreate} disabled={creating} className="gap-2">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Create Quiz on this Note
                </Button>
              )}
              {showJoin && (
                <Button variant="outline" onClick={handleJoin} className="gap-2 bg-transparent">
                  Join Quiz
                </Button>
              )}
              {showStart && (
                <Button variant="outline" onClick={handleStart} className="gap-2 bg-transparent">
                  Start Quiz (5s countdown)
                </Button>
              )}
              {showEnd && (
                <Button variant="destructive" onClick={handleEnd} className="gap-2">
                  End Quiz
                </Button>
              )}
              <div className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                {defaultNumQuestions} Questions • {defaultDurationSec}s per question
              </div>
            </div>

            {/* States */}
            {!docQuizId && (
              <div className="text-center py-12">
                <div className="text-lg text-muted-foreground mb-2">No active quiz for this note yet</div>
                <div className="text-sm text-muted-foreground">
                  {isAdmin ? "Create a quiz to get started" : "Wait for an admin to create a quiz"}
                </div>
              </div>
            )}

            {!!docQuizId && quizLoading && (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <div className="text-lg text-muted-foreground">Connecting to quiz...</div>
              </div>
            )}

            {docQuizId && state === "lobby" && (
              <div className="text-center py-12">
                <div className="text-lg font-medium mb-4">Quiz Ready!</div>
                <div className="text-muted-foreground mb-6">Waiting for participants to join</div>
                {connectedNames.length > 0 && (
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-sm font-medium mb-2">Participants ({connectedNames.length})</div>
                    <div className="text-sm text-muted-foreground">{connectedNames.join(", ")}</div>
                  </div>
                )}
              </div>
            )}

            {docQuizId && state === "countdown" && (
              <div className="text-center py-12">
                <div className="text-6xl font-bold mb-4 text-primary">{countdownSecs}</div>
                <div className="text-xl font-medium mb-2">Starting soon...</div>
                <div className="text-muted-foreground">Get ready!</div>
                {connectedNames.length > 0 && (
                  <div className="mt-6 bg-muted p-4 rounded-lg">
                    <div className="text-sm font-medium mb-2">Participants ({connectedNames.length})</div>
                    <div className="text-sm text-muted-foreground">{connectedNames.join(", ")}</div>
                  </div>
                )}
              </div>
            )}

            {/* ACTIVE — per-user progression */}
            {docQuizId && state === "active" && (
              <>
                {!iAmParticipant && (
                  <div className="text-center py-12">
                    <div className="text-lg text-muted-foreground mb-4">You are not participating in this quiz</div>
                    <Button onClick={handleJoin} className="gap-2">
                      Join Quiz
                    </Button>
                  </div>
                )}

                {iAmParticipant && !myFinished && currentQ && (
                  <div className="max-w-2xl mx-auto">
                    {/* Progress and Timer */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="text-sm text-muted-foreground">
                        Question {myIndex + 1} of {questionsArray.length}
                      </div>
                      <div className="flex items-center gap-2 text-lg font-semibold">
                        <Clock className="h-5 w-5" />
                        <span className={activeSecsLeft <= 10 ? "text-destructive" : "text-primary"}>
                          {activeSecsLeft}s
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-muted rounded-full h-2 mb-8">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((myIndex + 1) / questionsArray.length) * 100}%` }}
                      />
                    </div>

                    {/* Question */}
                    <div className="bg-card border rounded-lg p-6 mb-6">
                      <h3 className="text-xl font-medium mb-6 leading-relaxed">{currentQ.question}</h3>

                      {/* Answer Options */}
                      <div className="grid gap-3">
                        {currentQ.options.map((opt: string, i: number) => (
                          <Button
                            key={i}
                            variant="outline"
                            className={`p-4 h-auto text-left justify-start transition-all duration-200 ${
                              hoveredOption === i
                                ? "border-primary bg-primary/5 shadow-md transform scale-[1.02]"
                                : "hover:border-primary/50 hover:bg-primary/5"
                            }`}
                            onMouseEnter={() => setHoveredOption(i)}
                            onMouseLeave={() => setHoveredOption(null)}
                            onClick={() => handleAnswer(i)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-sm font-medium">
                                {String.fromCharCode(65 + i)}
                              </div>
                              <span className="text-base">{opt}</span>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {iAmParticipant && myFinished && (
                  <div className="text-center py-12">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <div className="text-xl font-medium mb-2">Great job!</div>
                    <div className="text-muted-foreground mb-4">
                      You've completed all questions. Waiting for others to finish...
                    </div>
                    <div className="text-sm text-muted-foreground">
                      The leaderboard will appear once everyone is done or an admin ends the quiz.
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ENDED — leaderboard + full review */}
            {docQuizId && state === "ended" && (
              <div className="space-y-8">
                {/* Leaderboard */}
                <div>
                  <div className="flex items-center gap-2 text-xl font-semibold mb-4">
                    <Trophy className="h-6 w-6 text-yellow-500" />
                    Leaderboard
                  </div>
                  <div className="bg-muted rounded-lg p-4">
                    {quiz?.endSummary?.leaderboard?.map((row: any, idx: number) => (
                      <div
                        key={row.uid}
                        className={`flex items-center justify-between p-3 rounded-lg mb-2 last:mb-0 ${
                          row.uid === userId ? "bg-primary/10 border border-primary/20" : "bg-background"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              idx === 0
                                ? "bg-yellow-500 text-white"
                                : idx === 1
                                  ? "bg-gray-400 text-white"
                                  : idx === 2
                                    ? "bg-amber-600 text-white"
                                    : "bg-muted-foreground/20"
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-medium">{row.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Avg: {Math.round((row.avgTimeMs ?? 0) / 1000)}s per question
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{row.score} pts</div>
                          <div className="text-sm text-muted-foreground">
                            {row.correctCount}/{questionsArray.length} correct
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Question Review */}
                <div>
                  <div className="text-xl font-semibold mb-4">Question Review</div>
                  <div className="space-y-6">
                    {questionsArray.map((q: any, i: number) => {
                      const mine = myAnswers[i]
                      const myIdx = mine?.optionIdx
                      const isCorrect = myIdx === q.correctIndex

                      return (
                        <div key={q.id} className="bg-card border rounded-lg p-6">
                          <div className="flex items-start gap-3 mb-4">
                            <div className="text-lg font-medium text-muted-foreground">{i + 1}.</div>
                            <div className="flex-1">
                              <h4 className="text-lg font-medium mb-4">{q.question}</h4>

                              <div className="space-y-2">
                                {q.options.map((option: string, idx: number) => {
                                  const isThisCorrect = idx === q.correctIndex
                                  const isMyAnswer = idx === myIdx

                                  return (
                                    <div
                                      key={idx}
                                      className={`p-3 rounded-lg border-2 ${
                                        isThisCorrect
                                          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                                          : isMyAnswer && !isThisCorrect
                                            ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                                            : "border-muted bg-muted/50"
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-sm font-medium">
                                            {String.fromCharCode(65 + idx)}
                                          </div>
                                          {isThisCorrect && <CheckCircle className="h-4 w-4 text-green-600" />}
                                          {isMyAnswer && !isThisCorrect && <XCircle className="h-4 w-4 text-red-600" />}
                                        </div>
                                        <span className="flex-1">{option}</span>
                                        <div className="flex items-center gap-2 text-sm">
                                          {isThisCorrect && <span className="text-green-600 font-medium">Correct</span>}
                                          {isMyAnswer && (
                                            <span className={isThisCorrect ? "text-green-600" : "text-red-600"}>
                                              Your answer
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              {q.explanation && (
                                <div className="mt-4 p-3 bg-muted rounded-lg">
                                  <div className="text-sm font-medium mb-1">Explanation:</div>
                                  <div className="text-sm text-muted-foreground">{q.explanation}</div>
                                </div>
                              )}

                              {mine && (
                                <div className="mt-3 text-sm text-muted-foreground">
                                  You answered in {Math.round(mine.timeMs / 1000)}s
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  {isAdmin && (
                    <Button onClick={handleCreate} variant="outline" className="gap-2 bg-transparent">
                      Create New Quiz
                    </Button>
                  )}
                  <Button onClick={onClose} variant="default" className="gap-2">
                    Close
                  </Button>
                </div>
              </div>
            )}

            {docQuizId && state === "cancelled" && (
              <div className="text-center py-12">
                <XCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <div className="text-xl font-medium mb-2">Quiz Cancelled</div>
                <div className="text-muted-foreground">This quiz was cancelled by an admin.</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
