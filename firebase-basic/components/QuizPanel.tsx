"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { httpsCallable } from "firebase/functions"
import { db, fns } from "@/lib/firebase"
import { get, onValue, ref } from "firebase/database"
import { Trophy, X, ListChecks } from "lucide-react"

interface QuizPanelProps {
  orgId?: string
  noteId: string
  userId: string
  displayName: string
  defaultDurationSec?: number
  defaultNumQuestions?: number
  onClose: () => void
}

export default function QuizPanel({
  orgId,
  noteId,
  userId,
  displayName,
  defaultDurationSec = 45,
  defaultNumQuestions = 5,
  onClose,
}: QuizPanelProps) {
  // Callables — ORG only
  const listOrgAsyncQuizzes = useMemo(() => httpsCallable(fns, "listOrgAsyncQuizzes"), [])
  const startOrResumeOrgAsyncAttempt = useMemo(() => httpsCallable(fns, "startOrResumeOrgAsyncAttempt"), [])
  const submitOrgAsyncAnswer = useMemo(() => httpsCallable(fns, "submitOrgAsyncAnswer"), [])
  const getOrgAsyncLeaderboard = useMemo(() => httpsCallable(fns, "getOrgAsyncLeaderboard"), [])

  // Lists - only org quizzes
  const [orgQuizzes, setOrgQuizzes] = useState<any[]>([])

  // Active attempt - only org
  const [active, setActive] = useState<{
    quizId: string | null
    quizDoc: any | null
    currentIndex: number
    finished: boolean
  }>({ quizId: null, quizDoc: null, currentIndex: 0, finished: false })

  // Leaderboard for org quiz
  const [leaderboard, setLeaderboard] = useState<any[]>([])

  // ---------- Load org quizzes ----------
  useEffect(() => {
    if (!noteId || !orgId) return

    const load = async () => {
      try {
        const res: any = await listOrgAsyncQuizzes({ orgId, noteId })
        setOrgQuizzes(Array.isArray(res?.data?.items) ? res.data.items : [])
      } catch {
        setOrgQuizzes([])
      }
    }

    load()
  }, [orgId, noteId, listOrgAsyncQuizzes])

  // ---------- Start / resume org attempts ----------
  const startOrg = async (quizId: string) => {
    if (!orgId) return
    const res: any = await startOrResumeOrgAsyncAttempt({ orgId, quizId, displayName })
    const snap = await get(ref(db, `organizations/${orgId}/quizzes/${quizId}`))
    const q = snap.val()
    const me = q?.participants?.[userId]
    setActive({
      quizId,
      quizDoc: q,
      currentIndex: res?.data?.currentIndex ?? (typeof me?.currentIndex === "number" ? me.currentIndex : 0),
      finished: !!me?.finished,
    })

    // preload leaderboard
    const lb: any = await getOrgAsyncLeaderboard({ orgId, quizId })
    setLeaderboard(Array.isArray(lb?.data?.items) ? lb.data.items : [])
  }

  // Watch active quiz doc for live progress updates
  useEffect(() => {
    if (!active.quizId || !orgId) return
    const path = `organizations/${orgId}/quizzes/${active.quizId}`
    const unsub = onValue(ref(db, path), (snap) => {
      const q = snap.val()
      const me = q?.participants?.[userId]
      const idx = typeof me?.currentIndex === "number" ? me.currentIndex : 0
      const finished = !!me?.finished
      setActive((prev) => ({ ...prev, quizDoc: q, currentIndex: idx, finished }))
    })
    return () => unsub()
  }, [active.quizId, orgId, userId])

  // ---------- Submit answers ----------
  const handleAnswer = async (optionIdx: number) => {
    if (!active.quizId || !orgId) return

    await submitOrgAsyncAnswer({ orgId, quizId: active.quizId, optionIdx })
    // after submit, refresh leaderboard if finished
    const me = active.quizDoc?.participants?.[userId]
    if (me?.finished) {
      const lb: any = await getOrgAsyncLeaderboard({ orgId, quizId: active.quizId })
      setLeaderboard(Array.isArray(lb?.data?.items) ? lb.data.items : [])
    }
  }

  // ---------- Render ----------
  return (
    <div className="h-full flex flex-col bg-background/30 backdrop-blur-md border border-border/30 rounded-lg shadow-lg">
      <div className="flex items-center justify-between p-4 border-b border-border/30 bg-background/20">
        <div className="flex items-center gap-3">
          <ListChecks className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-foreground">Organization Quiz</h2>
          {!orgId && (
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
              Requires organization
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-background/40">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Quiz Section - Top Half */}
        <div className="flex-1 p-4 border-b border-border/30 bg-background/10">
          {!orgId ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <ListChecks className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Open this note inside an organization to access quizzes</p>
              </div>
            </div>
          ) : !active.quizId ? (
            // Quiz Selection
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Select an organization quiz to begin. Results will appear on the leaderboard below.
              </div>
              <div className="space-y-2">
                {orgQuizzes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListChecks className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No organization quizzes available yet</p>
                    <p className="text-xs mt-2">Create a quiz using the controls above</p>
                  </div>
                ) : (
                  orgQuizzes.map((q: any) => (
                    <div
                      key={q.id}
                      className="bg-background/40 backdrop-blur-sm border border-border/40 rounded-lg p-4 flex items-center justify-between hover:bg-background/60 transition-all duration-200"
                    >
                      <div>
                        <div className="font-medium text-foreground">{q.title || "Organization Quiz"}</div>
                        <div className="text-xs text-muted-foreground">
                          {q.numQuestions} questions • {q.questionDurationSec}s per question
                        </div>
                      </div>
                      <Button onClick={() => startOrg(q.id)} className="shrink-0 bg-blue-600 hover:bg-blue-700">
                        Start Quiz
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            // Active Quiz
            <QuizView quizDoc={active.quizDoc} userId={userId} onAnswer={handleAnswer} finished={active.finished} />
          )}
        </div>

        {/* Leaderboard Section - Bottom Half */}
        <div className="flex-1 p-4 bg-background/5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <h3 className="font-semibold text-foreground">Leaderboard</h3>
            {active.quizId && (
              <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-full">Live Results</span>
            )}
          </div>

          {!active.quizId ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a quiz to view leaderboard</p>
              </div>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No completed attempts yet</p>
                <p className="text-xs mt-2">Be the first to complete the quiz!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-full overflow-y-auto">
              {leaderboard.map((row: any, idx: number) => (
                <div
                  key={row.uid}
                  className={`flex items-center justify-between p-3 rounded-lg border backdrop-blur-sm transition-all duration-200 ${
                    row.uid === userId
                      ? "bg-blue-500/20 border-blue-400/40 shadow-md"
                      : "bg-background/40 border-border/40 hover:bg-background/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                        idx === 0
                          ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white"
                          : idx === 1
                            ? "bg-gradient-to-br from-gray-300 to-gray-500 text-white"
                            : idx === 2
                              ? "bg-gradient-to-br from-amber-500 to-amber-700 text-white"
                              : "bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Avg: {Math.round((row.avgTimeMs ?? 0) / 1000)}s per question
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground">{row.score} pts</div>
                    <div className="text-xs text-muted-foreground">
                      {row.correctCount}/{active.quizDoc?.questions ? Object.keys(active.quizDoc.questions).length : 0}{" "}
                      correct
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* Simplified quiz view component for active quiz display */
function QuizView({
  quizDoc,
  userId,
  onAnswer,
  finished,
}: {
  quizDoc: any
  userId: string
  onAnswer: (idx: number) => Promise<void>
  finished: boolean
}) {
  if (!quizDoc) return null

  const qArr: any[] = Object.values(quizDoc.questions ?? {}).sort((a: any, b: any) => Number(a.id) - Number(b.id))
  const me = quizDoc.participants?.[userId]
  const idx: number = typeof me?.currentIndex === "number" ? me.currentIndex : 0
  const current = qArr[idx]

  if (finished) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2 text-foreground">Quiz Complete!</h3>
          <p className="text-muted-foreground">Check the leaderboard below to see your results</p>
        </div>
      </div>
    )
  }

  if (!current) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Question {idx + 1} of {qArr.length}
        </div>
      </div>

      <div className="w-full bg-muted/30 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${((idx + 1) / qArr.length) * 100}%` }}
        />
      </div>

      <div className="bg-background/40 backdrop-blur-sm border border-border/40 rounded-lg p-6">
        <h3 className="text-xl font-medium mb-6 leading-relaxed text-foreground">{current.question}</h3>
        <div className="grid gap-3">
          {current.options.map((opt: string, i: number) => (
            <Button
              key={i}
              variant="outline"
              className="p-4 h-auto text-left justify-start hover:bg-blue-500/10 hover:border-blue-400/50 bg-background/20 backdrop-blur-sm border-border/40 transition-all duration-200"
              onClick={() => onAnswer(i)}
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-sm font-medium">
                  {String.fromCharCode(65 + i)}
                </div>
                <span className="text-base text-foreground">{opt}</span>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
