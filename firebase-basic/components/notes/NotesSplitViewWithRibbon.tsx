// components/notes/NotesSplitViewWithRibbon.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"
import SummaryPanel from "@/components/ai/SummaryPanel"
import FlashCardSection from "@/components/flashcards/FlashCardSection"
import QuizBar from "../QuizBar"
import QuizPanel from "../QuizPanel"
import Ribbon, { type RibbonSection } from "../ribbon/Ribbon"
import { getAuth } from "firebase/auth"
import Main from "../YjsEditor/OrgMain"

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
export default function NotesSplitViewWithRibbon({ notes, orgID, initialSelectedId }: NotesSplitViewProps) {
  const [stateNotes, setStateNotes] = useState<Note[]>(notes)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(initialSelectedId ?? notes[0]?.id ?? null)

  // Hide only the content area (not the ribbon). When hidden, the editor expands.
  const [isRightContentHidden, setIsRightContentHidden] = useState(false)

  const [activeRibbonSection, setActiveRibbonSection] = useState<RibbonSection>("summary")
  const [isQuizPanelOpen, setIsQuizPanelOpen] = useState(false)

  const ownerId = getAuth().currentUser?.uid ?? ""

  useEffect(() => {
    setStateNotes(notes)
    if (initialSelectedId) setSelectedNoteId(initialSelectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, initialSelectedId])

  const selectedNote = useMemo(
    () => stateNotes.find((n) => n.id === selectedNoteId) ?? null,
    [stateNotes, selectedNoteId],
  )

  const [plain, setPlain] = useState<string>("")
  useEffect(() => {
    if (selectedNote?.content != null) setPlain(htmlToPlain(selectedNote.content))
  }, [selectedNote?.id, selectedNote?.content])

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
    return <div className="min-h-[60vh] grid place-items-center p-6 text-muted-foreground" />
  }

  const note: Note = selectedNote

  // Build the right-pane items as an array so we can place them into a 2-row grid:
  // - If only one item, it goes to the TOP half (row 1), bottom row stays empty.
  // - If two, they split evenly (row 1 & row 2).
  const getRightPaneItems = () => {
    switch (activeRibbonSection) {
      case "summary":
        return [
          <div key="summary" className="min-h-0">
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
          <div key="flashcards" className="min-h-0">
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
        const top = (
          <div key="quizbar" className="min-h-0">
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

        const bottom = isQuizPanelOpen ? (
          <div key="quizpanel" className="min-h-0">
            <div className="h-full border rounded-xl bg-white dark:bg-neutral-900 shadow overflow-hidden">
              <QuizPanel
                orgId={orgID}
                noteId={note.id}
                userId={ownerId}
                displayName="User"
                defaultDurationSec={45}
                defaultNumQuestions={5}
                onClose={() => setIsQuizPanelOpen(false)}
              />
            </div>
          </div>
        ) : null

        return bottom ? [top, bottom] : [top]
      }

      default:
        return []
    }
  }

  const items = getRightPaneItems()
  const hasTwo = items.length === 2

  return (
    <div className="relative h-[calc(100vh-2rem)] w-full">
      {/* Main content area with editor and sections */}
      <div className="flex h-full gap-4 pr-12">
        {" "}
        {/* Added right padding for ribbon space */}
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
            <Main
              searchParams={{
                doc: selectedNoteId as any,
                ownerId: orgID ?? undefined,
                username: "Organisation Member",
              }}
            />
          </div>
        </div>
        {/* Right content area - uniform width for all sections */}
        {!isRightContentHidden && (
          <div className="w-140 min-w-0 overflow-hidden transition-all duration-300">
            {/* Uniform layout: 2 equal rows; single-panel sections sit in the TOP half. */}
            <div className="h-full grid grid-rows-2 gap-4">
              {/* Row 1 (top half) */}
              <div className="min-h-0">{items[0] ?? null}</div>
              {/* Row 2 (bottom half) */}
              <div className="min-h-0">{hasTwo ? items[1] : null}</div>
            </div>
          </div>
        )}
      </div>

      <div className="absolute top-0 right-0 h-full">
        <Ribbon
          activeSection={activeRibbonSection}
          onSectionChange={(sec) => {
            setActiveRibbonSection(sec)
            if (sec === null) {
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
