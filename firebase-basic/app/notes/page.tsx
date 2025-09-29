"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { onValue, ref } from "firebase/database"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { db, fns } from "@/lib/firebase"
import { httpsCallable } from "firebase/functions"
import UserNotesSplitViewWithRibbon, { type Note } from "@/components/notes/UserNotesSplitViewWithRibbon"

export const dynamic = "force-dynamic"

function PersonalNotesInner() {
  const [uid, setUid] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const auth = getAuth()
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null)
      setAuthReady(true)
    })
    return () => unsub()
  }, [])

  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  // Load user's notes live from RTDB
  useEffect(() => {
    if (!uid) return
    const notesRef = ref(db, `users/${uid}/notes`)
    const unsub = onValue(notesRef, (snap) => {
      const raw = (snap.val() as Record<string, Note> | null) ?? null
      let arr = raw ? Object.values(raw) : []
      arr.sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))
      setNotes(arr)
      setLoading(false)
    })
    return () => unsub()
  }, [uid])

  // initial active note (first / newest)
  const activeNoteId = useMemo(
    () => (notes.length > 0 ? notes[0].id : undefined),
    [notes],
  )

  // controlled selection
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (activeNoteId && !selectedId) setSelectedId(activeNoteId)
  }, [activeNoteId, selectedId])

  // title commit-on-finish
  const updateNoteAtPath = useMemo(() => httpsCallable(fns, "updateNoteAtPath"), [])
  const currentNote = useMemo(
    () => (selectedId ? (notes.find((n) => n.id === selectedId) ?? null) : null),
    [notes, selectedId],
  )

  const [pageTitle, setPageTitle] = useState<string>("")
  const lastCommittedRef = useRef<string>("")

  useEffect(() => {
    const nextTitle = currentNote?.name ?? ""
    setPageTitle(nextTitle)
    lastCommittedRef.current = nextTitle
  }, [currentNote?.id, currentNote?.name])

  async function commitTitleSave() {
    if (!uid || !selectedId || !currentNote) return
    if (pageTitle === lastCommittedRef.current) return
    try {
      await updateNoteAtPath({
        path: `users/${uid}/notes/${selectedId}`,
        note: { name: pageTitle, updatedAt: Date.now() },
      })
      lastCommittedRef.current = pageTitle
    } catch {
      // optional toast
    }
  }

  // Auth still resolving → show loader instead of blank
  if (!authReady) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  }

  if (!uid) {
    return <div className="p-6 text-sm text-muted-foreground">Please sign in to view your notes.</div>
  }

  return (
    <div className="px-4 md:px-6">
      <div className="mt-4">
        <UserNotesSplitViewWithRibbon
          notes={notes}
          userID={uid}
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

export default function PersonalNotesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground"></div>}>
      <PersonalNotesInner />
    </Suspense>
  )
}
