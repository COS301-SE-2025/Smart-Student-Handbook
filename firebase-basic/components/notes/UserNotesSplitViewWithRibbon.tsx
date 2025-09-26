// components/notes/UserNotesSplitViewWithRibbon.tsx
"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import Ribbon, { type RibbonSection } from "@/components/ribbon/Ribbon"
import EditorMain from "@/components/YjsEditor/EditorMain"
import RightNotesPanel from "./RightNotesPanel"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"

/** Defensive dynamic panels to avoid hard crashes if a file is missing */
const SummaryPanel = dynamic(
  () =>
    import("@/components/ai/SummaryPanel")
      .then((m) => m.default)
      .catch(() => () => <div className="p-4 text-sm text-muted-foreground">Summary unavailable.</div>),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading summary…</div> },
)
const FlashCardSection = dynamic(
  () =>
    import("@/components/flashcards/FlashCardSection")
      .then((m) => m.default)
      .catch(() => () => <div className="p-4 text-sm text-muted-foreground">Flashcards unavailable.</div>),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading flashcards…</div> },
)

/* --------------------------------- Types --------------------------------- */
export type Note = {
  ownerId: string
  id: string
  name: string
  content: string
  type: "note"
  createdAt?: number
  updatedAt?: number
}

type NotesSplitViewProps = {
  notes: Note[]
  userID: string
  selectedId?: string
  onSelect?: (noteId: string) => void
  initialSelectedId?: string | null
  loading?: boolean
  title?: string
  onTitleChange?: (name: string) => void
  onTitleCommit?: () => void
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
export default function UserNotesSplitViewWithRibbon({
  notes,
  userID,
  selectedId,
  onSelect,
  initialSelectedId,
  loading,
  title,
  onTitleChange,
  onTitleCommit,
}: NotesSplitViewProps) {
  const [stateNotes, setStateNotes] = useState<Note[]>(notes)

  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectedId ?? initialSelectedId ?? notes[0]?.id ?? null,
  )
  const [currentOwnerId, setCurrentOwnerId] = useState<string>(userID)

  const [isRightContentHidden, setIsRightContentHidden] = useState(false)
  const [activeRibbonSection, setActiveRibbonSection] = useState<RibbonSection>("summary")

  useEffect(() => setStateNotes(() => notes), [notes])

  const currentSelectedNoteId = useMemo(
    () => (selectedId ? selectedId : internalSelectedId),
    [selectedId, internalSelectedId],
  )

  // keep selection valid if uncontrolled
  useEffect(() => {
    if (selectedId) return
    if (!internalSelectedId) {
      const first = notes[0]?.id ?? null
      setInternalSelectedId(first)
    } else {
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
    else setPlain("")
  }, [selectedNote?.id, selectedNote?.content])

  // Debounced autosave of content snapshots to users/{userID}/notes
  useEffect(() => {
    if (!selectedNote?.id) return
    const t = setTimeout(() => {
      const path = `users/${currentOwnerId || userID}/notes/${selectedNote.id}`
      callUpdateNote(path, { content: selectedNote.content, updatedAt: Date.now() })
    }, 1000)
    return () => clearTimeout(t)
  }, [selectedNote?.id, selectedNote?.content, userID, currentOwnerId])

  const showLoader = loading && stateNotes.length === 0

  // Right pane content
  const rightPane = (() => {
    switch (activeRibbonSection) {
      case "summary":
        return (
          <div className="min-h-0 h-full">
            {selectedNote ? (
              <SummaryPanel
                sourceText={plain}
                title="Summary"
                className="h-full"
                ownerId={currentOwnerId || userID}
                userId={userID}
                noteId={selectedNote.id}
                isPersonal
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Select a note to summarize.</div>
            )}
          </div>
        )
      case "flashcards":
        return (
          <div className="min-h-0 h-full">
            {selectedNote ? (
              <FlashCardSection
                sourceText={plain}
                className="h-full"
                ownerId={currentOwnerId || userID}
                userId={userID}
                noteId={selectedNote.id}
                isPersonal
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Select a note to generate flashcards.</div>
            )}
          </div>
        )
      case "notes":
        return (
          <div className="min-h-0 h-full">
            <RightNotesPanel
              userId={userID}
              onOpenNote={(noteId) => {
                if (onSelect) onSelect(noteId)
                else setInternalSelectedId(noteId)
              }}
              setOwnerId={(owner) => setCurrentOwnerId(owner)}
            />
          </div>
        )
      default:
        return null
    }
  })()

  return (
    <div className="relative h-[calc(100vh-2rem)] w-full">
      <div className="flex h-full min-h-0 gap-4 pr-4">
        {/* Editor pane */}
        <div
          className={`${
            isRightContentHidden ? "flex-1" : "flex-[3]"
          } border border-gray-200 rounded-xl p-3 bg-white dark:bg-neutral-900 shadow flex flex-col min-h-0 transition-all duration-300`}
        >
          {/* Title header */}
          <div className="mb-4 px-2">
            <input
              className="w-full text-3xl font-bold bg-transparent border-none focus:outline-none"
              placeholder="Untitled note"
              value={typeof title === "string" ? title : ""}
              onChange={(e) => onTitleChange?.(e.target.value)}
              onBlur={() => onTitleCommit?.()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  onTitleCommit?.()
                  ;(e.currentTarget as HTMLInputElement).blur()
                }
              }}
              disabled={!onTitleChange}
            />
            <div className="mt-2 border-b border-muted-foreground/30" />
          </div>

          {/* Editor body */}
          <div className="flex-1 min-h-0 overflow-y-auto scroll-invisible">
            {showLoader ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">Loading notes…</div>
            ) : selectedNote ? (
              <EditorMain
                searchParams={{
                  doc: currentSelectedNoteId as any,
                  ownerId: (currentOwnerId || userID) as any,
                  username: "You",
                }}
              />
            ) : (
              <div className="h-full grid place-items-center text-sm text-muted-foreground px-6 text-center">
                <div>
                  <div className="font-semibold mb-1">No note selected</div>
                  <div>Open the Notes tab on the ribbon to pick or create a note.</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {!isRightContentHidden && (
          <div className="max-w-md min-w-[20rem] w-[28rem] min-h-0 transition-all duration-300">
            <div className="h-full min-h-0 border border-gray-200 rounded-xl bg-white dark:bg-neutral-900 shadow">
              {rightPane}
            </div>
          </div>
        )}
      </div>

      {/* Fixed ribbon on the far right */}
      <div className="absolute top-0 right-0">
        <Ribbon
          activeSection={activeRibbonSection}
          onSectionChange={(sec) => {
            setActiveRibbonSection(sec)
            if ((sec as any) === null) setIsRightContentHidden(true)
            else setIsRightContentHidden(false)
          }}
          onCollapse={() => setIsRightContentHidden(true)}
        />
      </div>

      {/* Invisible scrollbar styles */}
      <style jsx>{`
        .scroll-invisible {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scroll-invisible::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
      `}</style>
    </div>
  )
}
