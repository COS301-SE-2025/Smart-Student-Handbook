// app/organisations/[id]/notes/page.tsx (or your route file)
"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { onValue, ref } from "firebase/database"
import { db } from "@/lib/firebase"

// ⬇️ use the ribbon version
import NotesSplitViewWithRibbon, { type Note } from "@/components/notes/NotesSplitViewWithRibbon"

export const dynamic = "force-dynamic"

function OrgNotesInner() {
  const { id: orgId } = useParams<{ id: string }>()
  const search = useSearchParams()
  const preselectId = search.get("noteId")

  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  // If a noteId is in the URL, prefer it; otherwise use the newest note
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
      // newest first by updatedAt or createdAt
      arr.sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))
      // if preselectId exists, move that note to the front
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

  if (!orgId) return <div className="p-6 text-sm text-muted-foreground">Missing org id.</div>

  return (
    <div className="px-4 md:px-6">
      {/* The ribbon component renders Summary / Flashcards / Quiz on the right */}
      <div className="mt-4">
        <NotesSplitViewWithRibbon
          notes={notes}
          orgID={orgId}
          initialSelectedId={activeNoteId ?? undefined}
        />
      </div>
    </div>
  )
}

export default function OrgNotesWorkspacePage() {
  return (
    <Suspense fallback={null}>
      <OrgNotesInner />
    </Suspense>
  )
}
