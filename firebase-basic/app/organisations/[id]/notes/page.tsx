// app/organisations/[id]/notes/page.tsx
"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { onValue, ref } from "firebase/database"
import { db } from "@/lib/firebase"

// ⬇️ updated to support controlled selection
import NotesSplitViewWithRibbon, { type Note } from "@/components/notes/NotesSplitViewWithRibbon"

export const dynamic = "force-dynamic"

function OrgNotesInner() {
  const { id: orgId } = useParams<{ id: string }>()
  const search = useSearchParams()
  const preselectId = search.get("noteId")

  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  // Most-recent (or preselected) note id computed from the list
  const activeNoteId = useMemo(() => {
    if (preselectId) return preselectId
    return notes.length > 0 ? notes[0].id : undefined
  }, [preselectId, notes])

  // 🔹 Controlled selection lives here (page level)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  // Keep selectedId in sync when notes/preselect change
  useEffect(() => {
    setSelectedId(activeNoteId)
  }, [activeNoteId])

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
      <div className="mt-4">
        <NotesSplitViewWithRibbon
          notes={notes}
          orgID={orgId}
          // 🔹 Make the component controlled
          selectedId={selectedId}
          onSelect={setSelectedId}
          // (Optional) if your component still supports initialSelectedId internally,
          // keeping it here is harmless, but `selectedId` is the source of truth now.
          initialSelectedId={activeNoteId ?? undefined}
          loading={loading}
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
