"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"
import SummaryPanel from "@/components/ai/SummaryPanel"
import FlashCardSection from "@/components/flashcards/FlashCardSection"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

/* --------------------------------- Types --------------------------------- */
export type Note = {
  ownerId: string
  id: string
  name: string
  content: string // HTML from Quill
  type: "note"
  createdAt?: number
  updatedAt?: number
}

type NotesSplitViewProps = {
  notes: Note[]
  orgID: string
  initialSelectedId?: string | null
}

/* --------------------- Typed dynamic import for Quill --------------------- */
type QuillProps = {
  value: string
  onChange: (val: string) => void
  readOnly?: boolean
  height?: string
}

const QuillEditor = dynamic<QuillProps>(
  () => import("@/components/quilleditor").then((m: any) => m.default ?? m.QuillEditor),
  { ssr: false },
)

/* ------------------------------ Utilities -------------------------------- */
function htmlToPlain(html: string): string {
  // Fast browser-safe HTML → text (decodes entities via DOMParser)
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
export default function NotesSplitView({ notes, orgID, initialSelectedId }: NotesSplitViewProps) {
  const [stateNotes, setStateNotes] = useState<Note[]>(notes)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(initialSelectedId ?? notes[0]?.id ?? null)
  const [isRightPaneCollapsed, setIsRightPaneCollapsed] = useState(false)

  useEffect(() => {
    setStateNotes(notes)
    if (initialSelectedId) setSelectedNoteId(initialSelectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, initialSelectedId])

  const selectedNote = useMemo(
    () => stateNotes.find((n) => n.id === selectedNoteId) ?? null,
    [stateNotes, selectedNoteId],
  )

  // Keep a plain-text mirror of the selected note's content
  const [plain, setPlain] = useState<string>("")
  useEffect(() => {
    // when switching notes, refresh the plain text once
    if (selectedNote?.content != null) setPlain(htmlToPlain(selectedNote.content))
  }, [selectedNote?.id]) // switch-based; avoids recomputing on each keystroke

  // Auto-save (debounced 1s)
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

  if (!selectedNote) {
    return <div className="min-h-[60vh] grid place-items-center p-6 text-muted-foreground">{/* blank */}</div>
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] p-2 gap-4 min-h-0">
      {/* Editor pane */}
      <div
        className={`${isRightPaneCollapsed ? "flex-1" : "flex-[3]"} border rounded-xl p-3 bg-white dark:bg-neutral-900 shadow overflow-hidden flex flex-col min-h-0 transition-all duration-300`}
      >
        <div className="flex items-center justify-between mb-2">
          <input
            className="text-xl font-semibold bg-transparent border-none focus:outline-none flex-1 truncate"
            value={selectedNote.name}
            onChange={(e) => {
              const name = e.target.value
              const id = selectedNote.id
              setStateNotes((prev) => prev.map((n) => (n.id === id ? { ...n, name } : n)))
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsRightPaneCollapsed(!isRightPaneCollapsed)}
            className="ml-2 h-8 w-8 p-0"
          >
            {isRightPaneCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {/* Quill gets a fixed-height flex region */}
        <div className="flex-1 min-h-0">
          <QuillEditor
            key={selectedNote.id}
            value={selectedNote.content}
            readOnly={false}
            height="100%"
            onChange={(newContent: string) => {
              const id = selectedNote.id
              // Update HTML content in state
              setStateNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content: newContent } : n)))
              // Update plain text mirror (for Summary/Flashcards)
              setPlain(htmlToPlain(newContent))
            }}
          />
        </div>
      </div>

      {/* Right pane: AI assistants */}
      {!isRightPaneCollapsed && (
        <div className="flex-[2] min-w-0 flex flex-col gap-4 overflow-hidden transition-all duration-300">
          {/* Summary section */}
          <div className="flex-1 min-h-0 border rounded-xl bg-white dark:bg-neutral-900 shadow overflow-hidden">
            <SummaryPanel sourceText={plain} title="Summary" className="h-full" />
          </div>

          {/* Flashcards section */}
          <div className="flex-1 min-h-0 border rounded-xl bg-white dark:bg-neutral-900 shadow overflow-hidden">
            <FlashCardSection sourceText={plain} className="h-full" />
          </div>
        </div>
      )}
    </div>
  )
}
