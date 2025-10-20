import { useEffect, useMemo, useState } from "react"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"
import SummaryPanel from "@/components/ai/SummaryPanel"
import FlashCardSection from "@/components/flashcards/FlashCardSection"
import QuizBar from "../QuizBar"
import Ribbon, { type RibbonSection } from "../ribbon/Ribbon"
import { getAuth } from "firebase/auth"
import Main from "../YjsEditor/OrgMain"
import NotesBar from "./NotesBar"


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
  orgID: string


  selectedId?: string
  onSelect?: (noteId: string) => void
  initialSelectedId?: string | null

  loading?: boolean

  title?: string
  onTitleChange?: (name: string) => void
  onTitleCommit?: () => void
}

function htmlToPlain(html: string): string {
  if (!html) return ""
  const doc = new DOMParser().parseFromString(html, "text/html")
  return (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim()
}

const callUpdateNoteFn = httpsCallable(fns, "updateNoteAtPath")
async function callUpdateNote(path: string, note: Partial<Note>) {
  await callUpdateNoteFn({ path, note })
}

export default function NotesSplitViewWithRibbon({
  notes,
  orgID,
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
  const [isRightContentHidden, setIsRightContentHidden] = useState(false)
  const [activeRibbonSection, setActiveRibbonSection] = useState<RibbonSection>("summary")

  const ownerId = getAuth().currentUser?.uid ?? ""
  useEffect(() => {
    setStateNotes(() => notes)
  }, [notes])
  const currentSelectedNoteId = useMemo(() => {
    if (selectedId) return selectedId
    return internalSelectedId
  }, [selectedId, internalSelectedId])
  useEffect(() => {
    if (selectedId) return 
    if (!internalSelectedId) {
      const first = notes[0]?.id ?? null
      setInternalSelectedId(first)
    } else {
      const exists = notes.some((n) => n.id === internalSelectedId)
      if (!exists) setInternalSelectedId(notes[0]?.id ?? null)
    }
  
  }, [notes, selectedId])

  const selectedNote = useMemo(
    () => stateNotes.find((n) => n.id === currentSelectedNoteId) ?? null,
    [stateNotes, currentSelectedNoteId],
  )

  const [plain, setPlain] = useState<string>("")
  useEffect(() => {
    if (selectedNote?.content != null) setPlain(htmlToPlain(selectedNote.content))
  }, [selectedNote?.id, selectedNote?.content])


  useEffect(() => {
    if (!selectedNote?.id) return
    const t = setTimeout(() => {
      const path = `organizations/${orgID}/notes/${selectedNote.id}`
      callUpdateNote(path, {
        content: selectedNote.content,
        updatedAt: Date.now(),
      })
    }, 1000)
    return () => clearTimeout(t)
  }, [selectedNote?.id, selectedNote?.content, orgID])

  if (!selectedNote || !currentSelectedNoteId) {
    return <div className="min-h-[60vh] grid place-items-center p-6 text-muted-foreground" />
  }

  const note: Note = selectedNote

  
  const getRightPaneItems = () => {
    switch (activeRibbonSection) {
      case "summary":
        return [
          <div key="summary" className="min-h-0 h-full">
            <SummaryPanel
              sourceText={plain}
              title="Summary"
              className="h-full"
              orgId={orgID}
              ownerId={ownerId}
              noteId={note.id}
            />
          </div>,
        ]
      case "flashcards":
        return [
          <div key="flashcards" className="min-h-0 h-full">
            <FlashCardSection sourceText={plain} className="h-full" orgId={orgID} ownerId={ownerId} noteId={note.id} />
          </div>,
        ]
      case "quiz":
        return [
          <div key="quizbar" className="min-h-0 h-full">
            <QuizBar
              orgId={orgID}
              noteId={note.id}
              userId={ownerId}
              displayName="User"
              defaultDurationSec={45}
              defaultNumQuestions={5}
            />
          </div>,
        ]
      case "notes":
        return [
          <div key="notesbar" className="min-h-0 h-full">
            <NotesBar
              orgId={orgID}
              onOpenNote={(noteId) => {
                if (onSelect) onSelect(noteId)
                else setInternalSelectedId(noteId)
              }}
            />
          </div>,
        ]
      default:
        return []
    }
  }

  const items = getRightPaneItems()

  return (
    <div className="relative h-[calc(100vh-2rem)] w-full">
 
      <div className="flex h-full min-h-0 gap-4 pr-4">

        <div
          className={`${
            isRightContentHidden ? "flex-1" : "flex-[3]"
          } border border-gray-200 rounded-xl p-3 bg-white dark:bg-neutral-900 shadow flex flex-col min-h-0 transition-all duration-300`}
        >

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

  
          <div className="flex-1 min-h-0 overflow-y-auto scroll-invisible">
            <Main
              searchParams={{
                doc: currentSelectedNoteId as any,
                ownerId: orgID ?? undefined,
                username: "Organisation Member",
              }}
            />
          </div>
        </div>

        {!isRightContentHidden && (
          <div className="w-140 min-w-0 min-h-0 transition-all duration-300">
            <div className="h-full min-h-0 border border-gray-200 rounded-xl bg-white dark:bg-neutral-900 shadow">
              {items[0]}
            </div>
          </div>
        )}
      </div>

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
      <style jsx>{`
        .scroll-invisible {
          scrollbar-width: none;        /* Firefox */
          -ms-overflow-style: none;     /* IE/Edge legacy */
        }
        .scroll-invisible::-webkit-scrollbar { /* Chrome/Safari/Edge (Chromium) */
          width: 0;
          height: 0;
        }
      `}</style>
    </div>
  )
}