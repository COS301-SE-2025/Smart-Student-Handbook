"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Maximize2, Minimize2, ListChecks, UserRound, Trophy } from "lucide-react"
import { httpsCallable } from "firebase/functions"
import { db, fns } from "@/lib/firebase"
import { ref, get, onValue } from "firebase/database"

// 👇 import the client-side Gemini generator (it already sanitizes the note)
import { generateQuizQuestions } from "@/lib/gemini"

type Role = "Admin" | "Member" | undefined

interface QuizBarProps {
  orgId?: string // orgId optional now: self quizzes can be created anywhere
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
  const [expanded, setExpanded] = useState(true)
  const [role, setRole] = useState<Role>(undefined)

  const [activeView, setActiveView] = useState<"create" | "quiz" | null>("create")

  // Quiz functionality states
  const [orgQuizzes, setOrgQuizzes] = useState<any[]>([])
  const [active, setActive] = useState<{
    quizId: string | null
    quizDoc: any | null
    currentIndex: number
    finished: boolean
  }>({ quizId: null, quizDoc: null, currentIndex: 0, finished: false })
  const [leaderboard, setLeaderboard] = useState<any[]>([])

  // Resolve role only when inside an org
  useEffect(() => {
    if (!orgId || !userId) return
    const unsub = onValue(ref(db, `organizations/${orgId}/members/${userId}`), (snap) => setRole(snap.val() as Role))
    return () => unsub()
  }, [orgId, userId])

  // Callables
  const createOrgAsyncQuiz = useMemo(() => httpsCallable(fns, "createOrgAsyncQuiz"), [])
  const createSelfAsyncQuiz = useMemo(() => httpsCallable(fns, "createSelfAsyncQuiz"), [])

  const listOrgAsyncQuizzes = useMemo(() => httpsCallable(fns, "listOrgAsyncQuizzes"), [])
  const startOrResumeOrgAsyncAttempt = useMemo(() => httpsCallable(fns, "startOrResumeOrgAsyncAttempt"), [])
  const submitOrgAsyncAnswer = useMemo(() => httpsCallable(fns, "submitOrgAsyncAnswer"), [])
  const getOrgAsyncLeaderboard = useMemo(() => httpsCallable(fns, "getOrgAsyncLeaderboard"), [])

  const [creatingOrg, setCreatingOrg] = useState(false)
  const [creatingSelf, setCreatingSelf] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!noteId || !orgId || activeView !== "quiz") return

    const load = async () => {
      try {
        const res: any = await listOrgAsyncQuizzes({ orgId, noteId })
        setOrgQuizzes(Array.isArray(res?.data?.items) ? res.data.items : [])
      } catch {
        setOrgQuizzes([])
      }
    }

    load()
  }, [orgId, noteId, activeView, listOrgAsyncQuizzes])

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

  // Helper: fetch the raw note content from RTDB
  const fetchNoteContent = async (sourceOrgId: string | undefined, nId: string) => {
    const path = sourceOrgId
      ? `organizations/${sourceOrgId}/notes/${nId}/content`
      : `users/${userId}/notes/${nId}/content`
    const snap = await get(ref(db, path))
    return snap.exists() ? (snap.val() as string) : ""
  }

  // ORG quiz: generate questions first, then create
  const handleCreateOrgAnytime = async () => {
    if (!orgId) return
    setCreatingOrg(true)
    setErrorMsg(null)
    try {
      // 1) get latest note JSON/string from DB
      const noteRaw = await fetchNoteContent(orgId, noteId)

      // 2) generate MCQs client-side (includes sanitization)
      const questions = await generateQuizQuestions(noteRaw, defaultNumQuestions)

      // 3) call function WITH questions
      await createOrgAsyncQuiz({
        orgId,
        noteId,
        questionDurationSec: defaultDurationSec,
        questions, // <-- required by backend now
      })

      setActiveView("quiz")
    } catch (err: any) {
      console.error("Create Org Quiz failed:", err)
      setErrorMsg(err?.message ?? "Failed to create org quiz")
    } finally {
      setCreatingOrg(false)
    }
  }

  // SELF quiz: same flow; source is org note if orgId present, else personal note
  const handleCreateSelfQuiz = async () => {
    setCreatingSelf(true)
    setErrorMsg(null)
    try {
      // 1) fetch note content (org or personal)
      const noteRaw = await fetchNoteContent(orgId, noteId)

      // 2) generate MCQs client-side
      const questions = await generateQuizQuestions(noteRaw, defaultNumQuestions)

      // 3) call function WITH questions
      await createSelfAsyncQuiz({
        orgId: orgId ?? undefined,
        noteId,
        questionDurationSec: defaultDurationSec,
        questions, // <-- required
      })

      setActiveView("quiz")
    } catch (err: any) {
      console.error("Create Self Quiz failed:", err)
      setErrorMsg(err?.message ?? "Failed to create self quiz")
    } finally {
      setCreatingSelf(false)
    }
  }

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

  const wrapperClass = "w-full transition-all"

  return (
    <div className={wrapperClass}>
      <Card className="mt-4 bg-background/30 backdrop-blur-md border border-border/30 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between bg-background/20 border-b border-border/30">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base text-foreground">Quizzes</CardTitle>
            <span className="text-xs text-muted-foreground">
              {defaultNumQuestions} Q • {defaultDurationSec}s / Q
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {orgId ? (role === "Admin" ? "Admin" : role ? "Member" : "Guest") : "Personal"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded((v) => !v)}
              className="hover:bg-background/40"
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="p-0">
            <div className="flex border-b border-border/30 bg-background/10">
              <Button
                variant={activeView === "create" ? "default" : "ghost"}
                onClick={() => setActiveView("create")}
                className="flex-1 rounded-none border-r border-border/30 bg-transparent hover:bg-background/40"
              >
                Create Quiz
              </Button>
              <Button
                variant={activeView === "quiz" ? "default" : "ghost"}
                onClick={() => setActiveView("quiz")}
                className="flex-1 rounded-none bg-transparent hover:bg-background/40"
              >
                Take Quiz
              </Button>
            </div>

            {activeView === "create" && (
              <div className="p-4 space-y-3 bg-background/5">
                {errorMsg && (
                  <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
                    {errorMsg}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {orgId && (
                    <Button
                      onClick={handleCreateOrgAnytime}
                      disabled={creatingOrg}
                      className="gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      {creatingOrg ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
                      {creatingOrg ? "Creating…" : "Create Org Quiz"}
                    </Button>
                  )}
                  <Button onClick={handleCreateSelfQuiz} disabled={creatingSelf} className="gap-2" variant="secondary">
                    {creatingSelf ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
                    {creatingSelf ? "Creating…" : "Create My Quiz"}
                  </Button>
                </div>
              </div>
            )}

            {activeView === "quiz" && (
              <div className="h-96 flex flex-col">
                {/* Quiz Section - Top Half */}
                <div className="flex-1 p-4 border-b border-border/30 bg-background/10 overflow-y-auto">
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
                    <QuizView
                      quizDoc={active.quizDoc}
                      userId={userId}
                      onAnswer={handleAnswer}
                      finished={active.finished}
                    />
                  )}
                </div>

                {/* Leaderboard Section - Bottom Half */}
                <div className="flex-1 p-4 bg-background/5 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    <h3 className="font-semibold text-foreground">Leaderboard</h3>
                    {active.quizId && (
                      <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-full">
                        Live Results
                      </span>
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
                    <div className="space-y-2">
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
                              {row.correctCount}/
                              {active.quizDoc?.questions ? Object.keys(active.quizDoc.questions).length : 0} correct
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}

/* Moved QuizView component from QuizPanel to QuizBar */
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
