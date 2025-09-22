"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Maximize2, Minimize2, Play, ListChecks, UserRound } from "lucide-react"
import { httpsCallable } from "firebase/functions"
import { db, fns } from "@/lib/firebase"
import { ref, get, onValue } from "firebase/database"
import QuizPanel from "./QuizPanel"

// 👇 import the client-side Gemini generator (it already sanitizes the note)
import { generateQuizQuestions } from "@/lib/gemini"

type Role = "Admin" | "Member" | undefined

interface QuizBarProps {
  orgId?: string             // orgId optional now: self quizzes can be created anywhere
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
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [role, setRole] = useState<Role>(undefined)

  // Resolve role only when inside an org
  useEffect(() => {
    if (!orgId || !userId) return
    const unsub = onValue(ref(db, `organizations/${orgId}/members/${userId}`), (snap) =>
      setRole(snap.val() as Role),
    )
    return () => unsub()
  }, [orgId, userId])

  // Callables
  const createOrgAsyncQuiz = useMemo(() => httpsCallable(fns, "createOrgAsyncQuiz"), [])
  const createSelfAsyncQuiz = useMemo(() => httpsCallable(fns, "createSelfAsyncQuiz"), [])

  const [creatingOrg, setCreatingOrg] = useState(false)
  const [creatingSelf, setCreatingSelf] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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

      setIsPanelOpen(true)
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

      setIsPanelOpen(true)
    } catch (err: any) {
      console.error("Create Self Quiz failed:", err)
      setErrorMsg(err?.message ?? "Failed to create self quiz")
    } finally {
      setCreatingSelf(false)
    }
  }

  const wrapperClass = "w-full transition-all"

  return (
    <>
      <div className={wrapperClass}>
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">Quizzes</CardTitle>
              <span className="text-xs text-muted-foreground">
                {defaultNumQuestions} Q • {defaultDurationSec}s / Q
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {orgId ? (role === "Admin" ? "Admin" : role ? "Member" : "Guest") : "Personal"}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setExpanded((v) => !v)}>
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>

          {expanded && (
            <CardContent className="space-y-3">
              {errorMsg && (
                <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
                  {errorMsg}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {orgId && (
                  <Button onClick={handleCreateOrgAnytime} disabled={creatingOrg} className="gap-2">
                    {creatingOrg ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
                    {creatingOrg ? "Creating…" : "Create Org Quiz"}
                  </Button>
                )}
                <Button onClick={handleCreateSelfQuiz} disabled={creatingSelf} className="gap-2" variant="secondary">
                  {creatingSelf ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
                  {creatingSelf ? "Creating…" : "Create My Quiz"}
                </Button>

                <Button variant="outline" onClick={() => setIsPanelOpen((v) => !v)} className="gap-2 ml-auto">
                  <Play className="h-4 w-4" />
                  {isPanelOpen ? "Hide" : "Open"} Quiz Panel
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {isPanelOpen && (
        <div className="w-full mt-4">
          <QuizPanel
            orgId={orgId}
            noteId={noteId}
            userId={userId}
            displayName={displayName}
            defaultDurationSec={defaultDurationSec}
            defaultNumQuestions={defaultNumQuestions}
            onClose={() => setIsPanelOpen(false)}
          />
        </div>
      )}
    </>
  )
}
