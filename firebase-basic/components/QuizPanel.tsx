"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { httpsCallable } from "firebase/functions"
import { db, fns } from "@/lib/firebase"
import { get, onValue, ref } from "firebase/database"
import { Trophy, X, ListChecks, UserRound } from "lucide-react"

type QuizType = "org-async" | "personal-async"

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
  // Tabs: Organization (anyone in org) vs My Quizzes (self)
  const [tab, setTab] = useState<"org" | "self">("org")

  // Callables — ORG
  const listOrgAsyncQuizzes = useMemo(() => httpsCallable(fns, "listOrgAsyncQuizzes"), [])
  const startOrResumeOrgAsyncAttempt = useMemo(() => httpsCallable(fns, "startOrResumeOrgAsyncAttempt"), [])
  const submitOrgAsyncAnswer = useMemo(() => httpsCallable(fns, "submitOrgAsyncAnswer"), [])
  const getOrgAsyncLeaderboard = useMemo(() => httpsCallable(fns, "getOrgAsyncLeaderboard"), [])

  // Callables — SELF
  const listPersonalAsyncQuizzes = useMemo(() => httpsCallable(fns, "listPersonalAsyncQuizzes"), [])
  const startOrResumePersonalAsyncAttempt = useMemo(() => httpsCallable(fns, "startOrResumePersonalAsyncAttempt"), [])
  const submitPersonalAsyncAnswer = useMemo(() => httpsCallable(fns, "submitPersonalAsyncAnswer"), [])

  // Lists
  const [orgQuizzes, setOrgQuizzes] = useState<any[]>([])
  const [selfQuizzes, setSelfQuizzes] = useState<any[]>([])

  // Active attempt (org or self)
  const [active, setActive] = useState<{
    scope: "org" | "self" | null
    quizId: string | null
    quizDoc: any | null
    currentIndex: number
    finished: boolean
  }>({ scope: null, quizId: null, quizDoc: null, currentIndex: 0, finished: false })

  // Leaderboard for org quiz (computed on backend per finished user)
  const [leaderboard, setLeaderboard] = useState<any[]>([])

  // ---------- Load lists ----------
  useEffect(() => {
    if (!noteId) return

    const load = async () => {
      try {
        if (orgId) {
          const res: any = await listOrgAsyncQuizzes({ orgId, noteId })
          setOrgQuizzes(Array.isArray(res?.data?.items) ? res.data.items : [])
        } else {
          setOrgQuizzes([])
        }

        const resSelf: any = await listPersonalAsyncQuizzes({ noteId })
        setSelfQuizzes(Array.isArray(resSelf?.data?.items) ? resSelf.data.items : [])
      } catch {
        setOrgQuizzes([])
        setSelfQuizzes([])
      }
    }

    load()
  }, [orgId, noteId, listOrgAsyncQuizzes, listPersonalAsyncQuizzes])

  // ---------- Start / resume attempts ----------
  const startOrg = async (quizId: string) => {
    if (!orgId) return
    const res: any = await startOrResumeOrgAsyncAttempt({ orgId, quizId, displayName })
    const snap = await get(ref(db, `organizations/${orgId}/quizzes/${quizId}`))
    const q = snap.val()
    const me = q?.participants?.[userId]
    setActive({
      scope: "org",
      quizId,
      quizDoc: q,
      currentIndex: res?.data?.currentIndex ?? (typeof me?.currentIndex === "number" ? me.currentIndex : 0),
      finished: !!me?.finished,
    })

    // preload leaderboard (may be empty until someone finishes)
    const lb: any = await getOrgAsyncLeaderboard({ orgId, quizId })
    setLeaderboard(Array.isArray(lb?.data?.items) ? lb.data.items : [])
  }

  const startSelf = async (quizId: string) => {
    const res: any = await startOrResumePersonalAsyncAttempt({ quizId })
    const snap = await get(ref(db, `users/${userId}/quizzes/${quizId}`))
    const q = snap.val()
    const me = q?.participants?.[userId]
    setActive({
      scope: "self",
      quizId,
      quizDoc: q,
      currentIndex: res?.data?.currentIndex ?? (typeof me?.currentIndex === "number" ? me.currentIndex : 0),
      finished: !!me?.finished,
    })
  }

  // Watch active quiz doc for live progress updates
  useEffect(() => {
    if (!active.quizId || !active.scope) return
    const path =
      active.scope === "org"
        ? `organizations/${orgId}/quizzes/${active.quizId}`
        : `users/${userId}/quizzes/${active.quizId}`
    const unsub = onValue(ref(db, path), (snap) => {
      const q = snap.val()
      const me = active.scope === "org" ? q?.participants?.[userId] : q?.participants?.[userId]
      const idx = typeof me?.currentIndex === "number" ? me.currentIndex : 0
      const finished = !!me?.finished
      setActive((prev) => ({ ...prev, quizDoc: q, currentIndex: idx, finished }))
    })
    return () => unsub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.quizId, active.scope, orgId, userId])

  // ---------- Submit answers ----------
  const handleAnswer = async (optionIdx: number) => {
    if (!active.quizId || !active.scope) return

    if (active.scope === "org" && orgId) {
      await submitOrgAsyncAnswer({ orgId, quizId: active.quizId, optionIdx })
      // after submit, refresh leaderboard if finished
      const me = active.quizDoc?.participants?.[userId]
      if (me?.finished) {
        const lb: any = await getOrgAsyncLeaderboard({ orgId, quizId: active.quizId })
        setLeaderboard(Array.isArray(lb?.data?.items) ? lb.data.items : [])
      }
    } else {
      await submitPersonalAsyncAnswer({ quizId: active.quizId, optionIdx })
    }
  }

  // ---------- Render ----------
  return (
    <Card className="border rounded-lg">
      <CardHeader className="flex items-center justify-between flex-row border-b">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">Quiz Panel</CardTitle>
          <div className="inline-flex rounded-md border overflow-hidden">
            <button
              className={`px-3 py-1 text-sm flex items-center gap-1 ${tab === "org" ? "bg-primary text-white" : "bg-background"}`}
              onClick={() => setTab("org")}
              disabled={!orgId}
              title={orgId ? "Organization quizzes" : "Open inside an organization to use"}
            >
              <ListChecks className="h-3.5 w-3.5" /> Org
            </button>
            <button
              className={`px-3 py-1 text-sm flex items-center gap-1 ${tab === "self" ? "bg-primary text-white" : "bg-background"}`}
              onClick={() => setTab("self")}
            >
              <UserRound className="h-3.5 w-3.5" /> My Quizzes
            </button>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="p-6">
        {/* ---------------- ORG TAB ---------------- */}
        {tab === "org" && (
          <div className="grid md:grid-cols-12 gap-6">
            <div className="md:col-span-5 space-y-3">
              {!orgId && (
                <div className="text-sm text-muted-foreground">
                  Open this note inside an organization to view org quizzes.
                </div>
              )}

              {orgId && (
                <>
                  <div className="text-sm text-muted-foreground">
                    Choose an organization quiz and start or resume. The leaderboard updates after each member finishes.
                  </div>

                  <div className="space-y-2">
                    {orgQuizzes.length === 0 && (
                      <div className="text-sm text-muted-foreground">No org quizzes yet.</div>
                    )}
                    {orgQuizzes.map((q: any) => (
                      <div key={q.id} className="border rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{q.title || "Anytime Quiz"}</div>
                          <div className="text-xs text-muted-foreground">
                            {q.numQuestions} Q • {q.questionDurationSec}s / Q
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => startOrg(q.id)}>
                            Start / Resume
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="md:col-span-7">
              {!active.quizId || active.scope !== "org" ? (
                <div className="text-center py-10 text-muted-foreground">Select an org quiz to begin.</div>
              ) : (
                <AttemptView
                  quizDoc={active.quizDoc}
                  userId={userId}
                  onAnswer={handleAnswer}
                  finished={active.finished}
                  leaderboard={leaderboard}
                />
              )}
            </div>
          </div>
        )}

        {/* ---------------- SELF TAB ---------------- */}
        {tab === "self" && (
          <div className="grid md:grid-cols-12 gap-6">
            <div className="md:col-span-5 space-y-3">
              <div className="text-sm text-muted-foreground">
                Your personal quizzes for this note. These are private and have no leaderboards.
              </div>
              <div className="space-y-2">
                {selfQuizzes.length === 0 && (
                  <div className="text-sm text-muted-foreground">No personal quizzes yet.</div>
                )}
                {selfQuizzes.map((q: any) => (
                  <div key={q.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{q.title || "Self Quiz"}</div>
                      <div className="text-xs text-muted-foreground">
                        {q.numQuestions} Q • {q.questionDurationSec}s / Q
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => startSelf(q.id)}>
                        Start / Resume
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-7">
              {!active.quizId || active.scope !== "self" ? (
                <div className="text-center py-10 text-muted-foreground">Select a personal quiz to begin.</div>
              ) : (
                <AttemptView
                  quizDoc={active.quizDoc}
                  userId={userId}
                  onAnswer={handleAnswer}
                  finished={active.finished}
                  // no leaderboard for self
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ---------------- Attempt renderer (shared) ---------------- */
function AttemptView({
  quizDoc,
  userId,
  onAnswer,
  finished,
  leaderboard,
}: {
  quizDoc: any
  userId: string
  onAnswer: (idx: number) => Promise<void>
  finished: boolean
  leaderboard?: any[]
}) {
  if (!quizDoc) return null
  const qArr: any[] = Object.values(quizDoc.questions ?? {}).sort((a: any, b: any) => Number(a.id) - Number(b.id))
  const me = quizDoc.participants?.[userId]
  const idx: number = typeof me?.currentIndex === "number" ? me.currentIndex : 0
  const current = qArr[idx]

  if (!finished && current) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-muted-foreground">
            Question {idx + 1} of {qArr.length}
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2 mb-8">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${((idx + 1) / qArr.length) * 100}%` }}
          />
        </div>
        <div className="bg-card border rounded-lg p-6 mb-6">
          <h3 className="text-xl font-medium mb-6 leading-relaxed">{current.question}</h3>
          <div className="grid gap-3">
            {current.options.map((opt: string, i: number) => (
              <Button
                key={i}
                variant="outline"
                className="p-4 h-auto text-left justify-start hover:bg-primary/5 hover:border-primary/50 bg-transparent"
                onClick={() => onAnswer(i)}
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
    )
  }

  // finished → show leaderboard if provided
  return (
    <div className="space-y-6">
      {Array.isArray(leaderboard) ? (
        <>
          <div className="flex items-center gap-2 text-xl font-semibold mb-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Leaderboard
          </div>
          <div className="bg-muted rounded-lg p-4">
            {leaderboard.length === 0 && (
              <div className="text-sm text-muted-foreground">No completed attempts yet.</div>
            )}
            {leaderboard.map((row: any, idx2: number) => (
              <div
                key={row.uid}
                className={`flex items-center justify-between p-3 rounded-lg mb-2 last:mb-0 ${
                  row.uid === userId ? "bg-primary/10 border border-primary/20" : "bg-background"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      idx2 === 0
                        ? "bg-yellow-500 text-white"
                        : idx2 === 1
                          ? "bg-gray-400 text-white"
                          : idx2 === 2
                            ? "bg-amber-600 text-white"
                            : "bg-muted-foreground/20"
                    }`}
                  >
                    {idx2 + 1}
                  </div>
                  <div>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Avg: {Math.round((row.avgTimeMs ?? 0) / 1000)}s / Q
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{row.score} pts</div>
                  <div className="text-sm text-muted-foreground">
                    {row.correctCount}/{qArr.length} correct
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-10 text-muted-foreground">You finished this quiz.</div>
      )}
    </div>
  )
}
