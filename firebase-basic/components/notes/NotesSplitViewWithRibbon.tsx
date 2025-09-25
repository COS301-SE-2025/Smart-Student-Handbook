// components/notes/NotesSplitViewWithRibbon.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"
import SummaryPanel from "@/components/ai/SummaryPanel"
import FlashCardSection from "@/components/flashcards/FlashCardSection"
import QuizBar from "../QuizBar"
import Ribbon, { type RibbonSection } from "../ribbon/Ribbon"
import { getAuth } from "firebase/auth"
import Main from "../YjsEditor/OrgMain"
import NotesBar from "../notes/NotesBar"
import { Loader2 } from "lucide-react"

/* --------------------------------- Types --------------------------------- */
export type Note = {
  ownerId: string
  id: string
  name: string
  content: string // HTML from Quill (legacy) or latest snapshot text
  type: "note"
  createdAt?: number
  updatedAt?: number
}

type NotesSplitViewProps = {
  notes: Note[]
  orgID: string
  /** New controlled selection props */
  selectedId?: string
  onSelect?: (noteId: string) => void
  /** Legacy: can still be passed, but ignored if selectedId is provided */
  initialSelectedId?: string | null
  /** ✅ Added so page can pass loading without TS error */
  loading?: boolean
}

/* ------------------------------ Utilities -------------------------------- */
function htmlToPlain(html: string): string {
  if (!html) return ""
  const doc = new DOMParser().parseFromString(html, "text/html")
  return (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim()
}

/* --------------------------- Firebase callables --------------------------- */
const callUpdateNoteFn = httpsCallable(fns, "updateNoteAtPath")
async function callUpdateNote(path: string, note: Partial<Note>) {
  await callUpdateNoteFn({ path, note })
}

/* ------------------------------ Main component --------------------------- */
export default function NotesSplitViewWithRibbon({
  notes,
  orgID,
  selectedId,
  onSelect,
  initialSelectedId,
  loading,
}: NotesSplitViewProps) {
  /**
   * We keep an internal copy for local edits (e.g., title input) so typing feels instant,
   * but the selected note id is controlled by the parent when `selectedId` is provided.
   */
  const [stateNotes, setStateNotes] = useState<Note[]>(notes)

  // If parent doesn't control selection, fall back to internal initial selection.
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectedId ?? initialSelectedId ?? notes[0]?.id ?? null,
  )

  // Compute the authoritative current selected id
  const currentSelectedNoteId = useMemo(() => {
    // Parent-controlled takes precedence
    if (selectedId) return selectedId
    return internalSelectedId
  }, [selectedId, internalSelectedId])

  // Hide only the right content area (not the ribbon). When hidden, the editor expands.
  const [isRightContentHidden, setIsRightContentHidden] = useState(false)
  const [activeRibbonSection, setActiveRibbonSection] = useState<RibbonSection>("summary")

  const ownerId = getAuth().currentUser?.uid ?? ""

  // Keep local notes in sync with incoming prop updates (but preserve in-flight title edits where possible)
  useEffect(() => {
    setStateNotes(() => notes)
  }, [notes])

  // If selection is uncontrolled and the incoming list changed (e.g., first load), ensure we have a valid selection.
  useEffect(() => {
    if (selectedId) return // parent controls; do nothing
    if (!internalSelectedId) {
      const first = notes[0]?.id ?? null
      setInternalSelectedId(first)
    } else {
      // ensure selected still exists; if not, select first
      const exists = notes.some((n) => n.id === internalSelectedId)
      if (!exists) setInternalSelectedId(notes[0]?.id ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, selectedId])

  const selectedNote = useMemo(
    () => stateNotes.find((n) => n.id === currentSelectedNoteId) ?? null,
    [stateNotes, currentSelectedNoteId],
  )

  const [plain, setPlain] = useState<string>("")
  useEffect(() => {
    if (selectedNote?.content != null) setPlain(htmlToPlain(selectedNote.content))
  }, [selectedNote?.id, selectedNote?.content])

  // Auto-save (debounced 1s) for simple fields we manage here (e.g., name/content snapshot)
  useEffect(() => {
    if (!selectedNote?.id) return
    const t = setTimeout(() => {
      const path = `organizations/${orgID}/notes/${selectedNote.id}`
      callUpdateNote(path, {
        content: selectedNote.content,
        name: selectedNote.name,
        updatedAt: Date.now(),
      })
    }, 1000)
    return () => clearTimeout(t)
  }, [selectedNote?.id, selectedNote?.content, selectedNote?.name, orgID])

  // ✅ nice loading state while first fetch is in-flight
  if (loading && (!selectedNote || !currentSelectedNoteId)) {
    return (
      <div className="min-h-[60vh] grid place-items-center p-6 text-muted-foreground">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading notes…
        </div>
      </div>
    )
  }

  if (!selectedNote || !currentSelectedNoteId) {
    return <div className="min-h-[60vh] grid place-items-center p-6 text-muted-foreground" />
  }

  const note: Note = selectedNote

  // Build the right-pane items as an array so we can place them into a uniform container:
  // - If only one item, it goes to the TOP half (row 1), bottom row stays empty (layout handled by container).
  const getRightPaneItems = () => {
    switch (activeRibbonSection) {
      case "summary":
        return [
          <div key="summary" className="min-h-0 h-full">
            <div className="h-full border rounded-xl bg-white dark:bg-neutral-900 shadow overflow-hidden">
              <SummaryPanel
                sourceText={plain}
                title="Summary"
                className="h-full"
                orgId={orgID}
                ownerId={ownerId}
                noteId={note.id}
              />
            </div>
          </div>,
        ]

      case "flashcards":
        return [
          <div key="flashcards" className="min-h-0 h-full">
            <div className="h-full border rounded-xl bg-white dark:bg-neutral-900 shadow overflow-hidden">
              <FlashCardSection
                sourceText={plain}
                className="h-full"
                orgId={orgID}
                ownerId={ownerId}
                noteId={note.id}
              />
            </div>
          </div>,
        ]

      case "quiz": {
        const quizComponent = (
          <div key="quizbar" className="min-h-0 h-full">
            <div className="h-full border rounded-xl bg-white dark:bg-neutral-900 shadow">
              <QuizBar
                orgId={orgID}
                noteId={note.id}
                userId={ownerId}
                displayName="User"
                defaultDurationSec={45}
                defaultNumQuestions={5}
              />
            </div>
          </div>
        )
        return [quizComponent]
      }

      case "notes": {
        // Show ALL org notes; double-click chooses a note and updates the controlled selection upstream.
        const notesList = (
          <div key="notesbar" className="min-h-0 h-full">
            <div className="h-full border rounded-xl bg-white dark:bg-neutral-900 shadow overflow-hidden">
              <NotesBar
                orgId={orgID}
                onOpenNote={(noteId) => {
                  // Prefer parent-controlled selection if provided
                  if (onSelect) {
                    onSelect(noteId)
                  } else {
                    setInternalSelectedId(noteId)
                  }
                }}
              />
            </div>
          </div>
        )
        return [notesList]
      }

      default:
        return []
    }
  }

  const items = getRightPaneItems()

  return (
    <div className="relative h-[calc(100vh-2rem)] w-full">
      {/* Main content area with editor and sections */}
      <div className="flex h-full gap-4 pr-12">
        {/* Editor pane — expands when right content is hidden */}
        <div
          className={`${
            isRightContentHidden ? "flex-1" : "flex-[3]"
          } border rounded-xl p-3 bg-white dark:bg-neutral-900 shadow overflow-hidden flex flex-col min-h-0 transition-all duration-300`}
        >
          <div className="flex items-center justify-between mb-2">
            <input
              className="text-xl font-semibold bg-transparent border-none focus:outline-none flex-1 truncate"
              value={note.name}
              onChange={(e) => {
                const name = e.target.value
                const id = note.id
                setStateNotes((prev) => prev.map((n) => (n.id === id ? { ...n, name } : n)))
              }}
            />
          </div>

          <div className="flex-1 min-h-0">
            {/* Yjs editor consumes the current selected note id */}
            <Main
              searchParams={{
                doc: currentSelectedNoteId as any,
                ownerId: orgID ?? undefined,
                username: "Organisation Member",
              }}
            />
          </div>
        </div>

        {/* Right content area - uniform width for all sections */}
        {!isRightContentHidden && (
          <div className="w-140 min-w-0 overflow-hidden transition-all duration-300">
            <div className="h-full">{items[0]}</div>
          </div>
        )}
      </div>

      {/* Ribbon pinned at the far right */}
      <div className="absolute top-0 right-0 h-full">
        <Ribbon
          activeSection={activeRibbonSection}
          onSectionChange={(sec) => {
            setActiveRibbonSection(sec)
            if ((sec as any) === null) {
              // collapse content, keep ribbon on the right, editor expands
              setIsRightContentHidden(true)
            } else {
              // reopen content with same width for all sections
              setIsRightContentHidden(false)
            }
          }}
          onCollapse={() => setIsRightContentHidden(true)}
          className="w-12 h-full"
        />
      </div>
    </div>
  )
}
