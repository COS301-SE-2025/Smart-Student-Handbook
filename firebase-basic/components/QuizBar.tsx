"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Maximize2, Minimize2, Play, Users } from "lucide-react"
import { httpsCallable } from "firebase/functions"
import { onValue, ref, get, child } from "firebase/database"
import { db, fns } from "@/lib/firebase"
import QuizModal from "./QuizModal"

type QuizState = "lobby" | "countdown" | "active" | "ended" | "cancelled"
type Role = "Admin" | "Member" | undefined

interface QuizBarProps {
  orgId: string
  noteId: string
  userId: string
  displayName: string
  defaultDurationSec?: number
  defaultNumQuestions?: number
}

export default function QuizBar({
  orgId,
  noteId,
  userId,
  displayName,
  defaultDurationSec = 45,
  defaultNumQuestions = 5,
}: QuizBarProps) {
  const [quizId, setQuizId] = useState<string | null>(null) // live pointer
  const [lastQuizId, setLastQuizId] = useState<string | null>(null) // cache for ended review
  const docQuizId = quizId ?? lastQuizId // always try to show the last known quiz
  const [quiz, setQuiz] = useState<any>(null)
  const [quizLoading, setQuizLoading] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [creating, setCreating] = useState(false)
  const [role, setRole] = useState<Role>(undefined)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const isAdmin = role === "Admin"

  useEffect(() => {
    if (!orgId || !userId) return
    const roleRef = ref(db, `organizations/${orgId}/members/${userId}`)
    const unsub = onValue(roleRef, (snap) => setRole(snap.val() as Role))
    return () => unsub()
  }, [orgId, userId])

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

  const createQuiz = useMemo(() => httpsCallable(fns, "createQuiz"), [])
  const joinQuiz = useMemo(() => httpsCallable(fns, "joinQuiz"), [])
  const startQuiz = useMemo(() => httpsCallable(fns, "startQuiz"), [])
  const advanceIfReady = useMemo(() => httpsCallable(fns, "advanceIfReady"), [])
  const submitAnswer = useMemo(() => httpsCallable(fns, "submitAnswer"), [])
  const endQuiz = useMemo(() => httpsCallable(fns, "endQuiz"), [])

  const state: QuizState | undefined = quiz?.state as QuizState | undefined
  const questionsArray: any[] = quiz
    ? Object.values(quiz.questions ?? {}).sort((a: any, b: any) => Number(a.id) - Number(b.id))
    : []

  const me = quiz?.participants?.[userId]
  const iAmParticipant = !!me
  const myIndex: number = typeof me?.currentIndex === "number" ? me.currentIndex : 0
  const myFinished: boolean = !!me?.finished
  const currentQ = questionsArray[myIndex]

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

  const countdownEndAt = quiz?.countdownEndAt as number | undefined
  const countdownSecs = (() => {
    if (state !== "countdown" || !countdownEndAt) return 0
    const left = Math.max(0, countdownEndAt - Date.now())
    return Math.ceil(left / 1000)
  })()

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

  const participants = quiz?.participants ?? {}
  const connectedNames: string[] = Object.entries(participants)
    .filter(([_, p]: any) => p?.connected !== false)
    .map(([uid, p]: any) => p?.displayName || uid)

  const activeOrCountdown = state === "active" || state === "countdown"
  const wrapperClass = activeOrCountdown && expanded ? "w-full md:w-8/12 transition-all" : "w-full transition-all"

  const noActiveQuiz = !quizId
  const quizMissing = !!docQuizId && quiz == null
  const quizFinished = state === "ended" || state === "cancelled"

  const showCreate = isAdmin && (noActiveQuiz || quizMissing || quizFinished)
  const showJoin =
    !!docQuizId && !iAmParticipant && (quizMissing || state === "lobby" || state === "countdown" || state === "active")
  const showStart = !!docQuizId && isAdmin && (state === "lobby" || (quizMissing && !quizFinished))
  const showEnd = !!docQuizId && isAdmin && (state === "lobby" || state === "active" || state === "countdown")

  const myAnswers: Record<number, { optionIdx: number; timeMs: number; correct: boolean }> = (me?.answers as any) || {}

  return (
    <>
      <div className={wrapperClass}>
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Live Quiz</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{isAdmin ? "Admin" : role ? "Member" : "Guest"}</span>
              <Button variant="ghost" size="icon" onClick={() => setExpanded((v) => !v)}>
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>

          {expanded && (
            <CardContent className="space-y-3">
              {!docQuizId && <div className="text-sm text-muted-foreground">No active quiz for this note yet.</div>}

              {!!docQuizId && quizLoading && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Connecting to quiz…
                </div>
              )}

              {docQuizId && state === "lobby" && (
                <div className="flex flex-col gap-2">
                  <div className="text-sm text-muted-foreground">Quiz ready. Waiting for participants.</div>
                  {connectedNames.length > 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {connectedNames.length} joined: {connectedNames.slice(0, 3).join(", ")}
                      {connectedNames.length > 3 && ` +${connectedNames.length - 3} more`}
                    </div>
                  )}
                </div>
              )}

              {docQuizId && state === "countdown" && (
                <div className="space-y-2">
                  <div className="text-sm">
                    Starting in <span className="font-semibold">{countdownSecs}</span>…
                  </div>
                  {connectedNames.length > 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {connectedNames.length} participants ready
                    </div>
                  )}
                </div>
              )}

              {docQuizId && state === "active" && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-primary">Quiz in progress</div>
                  {iAmParticipant && !myFinished && (
                    <div className="text-xs text-muted-foreground">
                      Question {myIndex + 1} of {questionsArray.length} • {activeSecsLeft}s left
                    </div>
                  )}
                  {iAmParticipant && myFinished && (
                    <div className="text-xs text-green-600">You've finished! Waiting for others...</div>
                  )}
                </div>
              )}

              {docQuizId && state === "ended" && (
                <div className="text-sm text-green-600">Quiz completed! View results in the modal.</div>
              )}

              {docQuizId && state === "cancelled" && (
                <div className="text-sm text-muted-foreground">Quiz was cancelled.</div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {showCreate && (
                  <Button onClick={() => setIsModalOpen(true)} disabled={creating} className="gap-2">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Create Quiz
                  </Button>
                )}
                {showJoin && (
                  <Button variant="outline" onClick={() => setIsModalOpen(true)} className="gap-2">
                    <Users className="h-4 w-4" />
                    Join Quiz
                  </Button>
                )}
                {docQuizId && (state === "active" || state === "ended") && (
                  <Button variant="outline" onClick={() => setIsModalOpen(true)} className="gap-2">
                    <Play className="h-4 w-4" />
                    Open Quiz
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  {defaultNumQuestions} Q • {defaultDurationSec}s / Q
                </span>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      <QuizModal
        orgId={orgId}
        noteId={noteId}
        userId={userId}
        displayName={displayName}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultDurationSec={defaultDurationSec}
        defaultNumQuestions={defaultNumQuestions}
      />
    </>
  )
}
