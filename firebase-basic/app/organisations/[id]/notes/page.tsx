"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { onValue, ref, get } from "firebase/database"
import { db } from "@/lib/firebase"
import NotesSplitView, { type Note } from "@/components/notes/NotesSplitView"
import QuizBar from "@/components/QuizBar"
import { useUserId } from "@/hooks/useUserId" // same hook you use elsewhere

export const dynamic = "force-dynamic"

function OrgNotesInner() {
  const { id: orgId } = useParams<{ id: string }>()
  const search = useSearchParams()
  const preselectId = search.get("noteId")

  const { userId } = useUserId()
  const [displayName, setDisplayName] = useState<string>("")

  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  // Determine the noteId to attach the quiz to:
  // 1) URL ?noteId
  // 2) fallback to first note in the current sorted list
  const activeNoteId = useMemo(() => {
    if (preselectId) return preselectId
    return notes.length > 0 ? notes[0].id : undefined
  }, [preselectId, notes])

  useEffect(() => {
    if (!orgId) return
    const notesRef = ref(db, `organizations/${orgId}/notes`)
    const unsub = onValue(notesRef, (snap) => {
      const raw = (snap.val() as Record<string, Note> | null) ?? null
      let arr = raw ? Object.values(raw) : []

      arr.sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))

      // keep preselect pinned to the top (your existing behavior)
      if (preselectId) {
        const idx = arr.findIndex((n) => n.id === preselectId)
        if (idx > 0) {
          const [picked] = arr.splice(idx, 1)
          arr = [picked, ...arr]
        }
      }

      setNotes(arr)
      setLoading(false)
    })

    return () => unsub()
  }, [orgId, preselectId])

  // Resolve display name (once)
  useEffect(() => {
    if (!userId) return
    get(ref(db, `users/${userId}/UserSettings`)).then((snap) => {
      const us = snap.val() || {}
      const name = us?.name ? (us?.surname ? `${us.name} ${us.surname}` : us.name) : "Anonymous"
      setDisplayName(name)
    })
  }, [userId])

  if (!orgId) return <div className="p-6 text-sm text-muted-foreground">Missing org id.</div>

  return (
    <>
      {/* QUIZ — only quiz-related change is adding a stable key */}
      {userId && activeNoteId && (
        <div className="px-4 md:px-6 mt-4">
          <QuizBar
            key={`${orgId}:${activeNoteId}`} // ✅ ensure QuizBar remounts on note change
            orgId={orgId}
            noteId={activeNoteId}
            userId={userId}
            displayName={displayName || "Anonymous"}
          />
        </div>
      )}

      <NotesSplitView notes={notes} orgID={orgId} initialSelectedId={preselectId ?? undefined} />
    </>
  )
}

export default function OrgNotesWorkspacePage() {
  return (
    <Suspense fallback={null}>
      <OrgNotesInner />
    </Suspense>
  )
}
