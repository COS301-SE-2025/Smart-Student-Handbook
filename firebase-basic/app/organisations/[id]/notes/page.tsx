
"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { onValue, ref } from "firebase/database"
import { db, fns } from "@/lib/firebase"
import { httpsCallable } from "firebase/functions"

// Controlled selection + split view
import NotesSplitViewWithRibbon, { type Note } from "@/components/notes/OrgNotesSplitViewWithRibbon"

export const dynamic = "force-dynamic"

function OrgNotesInner() {
  const { id: orgId } = useParams<{ id: string }>()
  const search = useSearchParams()
  const preselectId = search.get("noteId")

  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  // Sort / preselect logic
  const activeNoteId = useMemo(() => {
    if (preselectId) return preselectId
    return notes.length > 0 ? notes[0].id : undefined
  }, [preselectId, notes])

  // Controlled selection
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  useEffect(() => {
    setSelectedId(activeNoteId)
  }, [activeNoteId])

  // Live load notes
  useEffect(() => {
    if (!orgId) return
    const notesRef = ref(db, `organizations/${orgId}/notes`)
    const unsub = onValue(notesRef, (snap) => {
      const raw = (snap.val() as Record<string, Note> | null) ?? null
      let arr = raw ? Object.values(raw) : []
      arr.sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))
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

  // ---------- Page-level title state + commit-on-finish save ----------
  const updateNoteAtPath = useMemo(() => httpsCallable(fns, "updateNoteAtPath"), [])
  const currentNote = useMemo(
    () => (selectedId ? (notes.find((n) => n.id === selectedId) ?? null) : null),
    [notes, selectedId],
  )

  const [pageTitle, setPageTitle] = useState<string>("")
  const lastCommittedRef = useRef<string>("")

  // Sync pageTitle when selection or notes change
  useEffect(() => {
    const nextTitle = currentNote?.name ?? ""
    setPageTitle(nextTitle)
    lastCommittedRef.current = nextTitle
  }, [currentNote?.id, currentNote?.name])

  // Save only when the user is done typing (explicit commit)
  async function commitTitleSave() {
    if (!orgId || !selectedId) return
    if (!currentNote) return
    // Avoid unnecessary writes if nothing changed
    if (pageTitle === lastCommittedRef.current) return
    try {
      await updateNoteAtPath({
        path: `organizations/${orgId}/notes/${selectedId}`,
        note: { name: pageTitle, updatedAt: Date.now() },
      })
      lastCommittedRef.current = pageTitle
    } catch {
     
    }
  }

  if (!orgId) return <div className="p-6 text-sm text-muted-foreground">Missing org id.</div>

  return (
    <div className="px-4 md:px-6">
      <div className="mt-4">
        <NotesSplitViewWithRibbon
          notes={notes}
          orgID={orgId}
          selectedId={selectedId}
          onSelect={setSelectedId}
          initialSelectedId={activeNoteId ?? undefined}
          loading={loading}
          title={pageTitle}
          onTitleChange={setPageTitle}
          onTitleCommit={commitTitleSave}  
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
