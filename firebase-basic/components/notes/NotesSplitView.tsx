// components/notes/NotesSplitView.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"
import SummaryPanel from "@/components/ai/SummaryPanel"
import FlashCardSection from "@/components/flashcards/FlashCardSection"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAuth } from "firebase/auth"

export type Note = {
  ownerId: string
  id: string
  name: string
  content: string
  type: "note" | string
  createdAt?: number
  updatedAt?: number
}

type NotesSplitViewProps = {
  notes: Note[]
  /** Keep orgID to stay compatible; used only when storageScope === "org" */
  orgID: string
  initialSelectedId?: string | null

  /** NEW: where the note content autosaves. Default "user" preserves existing behavior. */
  storageScope?: "user" | "org"

  /**
   * NEW: where Summary/Flashcards save+load.
   * Defaults to storageScope to keep things predictable.
   * Set to "org" on the org page, leave as default elsewhere.
   */
  aiScope?: "user" | "org"
}

type QuillProps = {
  value: string
  onChange: (val: string) => void
  readOnly?: boolean
  height?: string
}

const QuillEditor = dynamic<QuillProps>(
  () => import("@/components/quilleditor").then((m: any) => m.default ?? m.QuillEditor),
  { ssr: false }
)

/* ------------------------------ Utilities -------------------------------- */
function htmlToPlain(html: string): string {
  if (!html) return ""
  const doc = new DOMParser().parseFromString(html, "text/html")
  return (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim()
}

// Extract plain text from Block/JSON structures (e.g., BlockNote/Yjs) or fallback
function jsonToPlain(input: unknown): string {
  const out: string[] = []
  const walk = (v: any) => {
    if (v == null) return
    if (typeof v === "string") { out.push(v); return }
    if (Array.isArray(v)) { for (const x of v) walk(x); return }
    if (typeof v === "object") {
      for (const key of Object.keys(v)) {
        const val = (v as any)[key]
        if (key === "text" && typeof val === "string") out.push(val)
        else if (key === "content" || key === "children" || key === "props") walk(val)
        else if (typeof val === "string") {
          if (!/^[A-Za-z0-9\-_]{8,}$/.test(val)) out.push(val)
        } else if (Array.isArray(val) || typeof val === "object") {
          walk(val)
        }
      }
    }
  }
  walk(input)
  return out.join(" ").replace(/\s+/g, " ").trim()
}

function toPlain(content: string): string {
  if (!content) return ""
  const s = content.trim()
  // HTML-ish?
  if (s.startsWith("<")) return htmlToPlain(s)
  // JSON-ish?
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s)
      return jsonToPlain(parsed)
    } catch {
      // fall through
    }
  }
  // Plain text fallback
  return s.replace(/\s+/g, " ").trim()
}

/* --------------------------- Firebase callables --------------------------- */
const callUpdateNoteFn = httpsCallable(fns, "updateNoteAtPath")
async function callUpdateNote(path: string, note: Partial<Note>) {
  await callUpdateNoteFn({ path, note })
}

/* ------------------------------ Main component --------------------------- */
export default function NotesSplitView({
  notes,
  orgID,
  initialSelectedId,
  storageScope = "user",         // 🔒 default keeps existing user implementation intact
  aiScope,                       // if undefined, will default to storageScope below
}: NotesSplitViewProps) {
  const [stateNotes, setStateNotes] = useState<Note[]>(notes)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    initialSelectedId ?? notes[0]?.id ?? null
  )
  const [isRightPaneCollapsed, setIsRightPaneCollapsed] = useState(false)

  const auth = getAuth()
  const userId = auth.currentUser?.uid ?? "" // used for user scope paths

  const effectiveAIScope: "user" | "org" = aiScope ?? storageScope

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
    if (selectedNote?.content != null) setPlain(toPlain(selectedNote.content))
  }, [selectedNote?.id, selectedNote?.content])

  // Auto-save (debounced 1s) for the note itself (user- or org-scoped storage)
  useEffect(() => {
    if (!selectedNote?.id) return
    const t = setTimeout(() => {
      const path =
        storageScope === "org"
          ? `organizations/${orgID}/notes/${selectedNote.id}`
          : userId
          ? `users/${userId}/notes/${selectedNote.id}`
          : null

      if (!path) return // no-op if user not available in user scope
      void callUpdateNote(path, {
        content: selectedNote.content,
        name: selectedNote.name,
        updatedAt: Date.now(),
      })
    }, 1000)
    return () => clearTimeout(t)
  }, [selectedNote?.id, selectedNote?.content, selectedNote?.name, orgID, storageScope, userId])

  if (!selectedNote) {
    return <div className="min-h-[60vh] grid place-items-center p-6 text-muted-foreground" />
  }

  const note: Note = selectedNote

  return (
    <div className="flex h-[calc(100vh-2rem)] p-2 gap-4 min-h-0">
      {/* Editor pane */}
      <div
        className={`${
          isRightPaneCollapsed ? "flex-1" : "flex-[3]"
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsRightPaneCollapsed(!isRightPaneCollapsed)}
            className="ml-2 h-8 w-8 p-0"
            aria-label={isRightPaneCollapsed ? "Expand right pane" : "Collapse right pane"}
          >
            {isRightPaneCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex-1 min-h-0">
          <QuillEditor
            key={note.id}
            value={note.content}
            readOnly={false}
            height="100%"
            onChange={(newContent: string) => {
              const id = note.id
              setStateNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content: newContent } : n)))
              setPlain(toPlain(newContent))
            }}
          />
        </div>
      </div>

      {/* Right pane: AI assistants */}
      {!isRightPaneCollapsed && (
        <div className="flex-[2] min-w-0 flex flex-col gap-4 overflow-hidden transition-all duration-300">
          {/* Summary */}
          <div className="flex-1 min-h-0 border rounded-xl bg-white dark:bg-neutral-900 shadow overflow-hidden">
            {effectiveAIScope === "org" ? (
              <SummaryPanel
                sourceText={plain}
                title="Summary"
                className="h-full"
                /** ORG SCOPE */
                orgId={orgID}
                ownerId={note.ownerId || userId}
                noteId={note.id}
                isPersonal={false} // hard-force org scope (prevents fallback to user)
              />
            ) : (
              <SummaryPanel
                sourceText={plain}
                title="Summary"
                className="h-full"
                /** USER SCOPE */
                userId={userId}
                ownerId={userId}
                noteId={note.id}
                isPersonal={true}
                /** do NOT pass orgId so it won’t default to org scope */
              />
            )}
          </div>

          {/* Flashcards */}
          <div className="flex-1 min-h-0 border rounded-xl bg-white dark:bg-neutral-900 shadow overflow-hidden">
            {effectiveAIScope === "org" ? (
              <FlashCardSection
                sourceText={plain}
                className="h-full"
                /** ORG SCOPE */
                orgId={orgID}
                ownerId={note.ownerId || userId}
                noteId={note.id}
                isPersonal={false}
              />
            ) : (
              <FlashCardSection
                sourceText={plain}
                className="h-full"
                /** USER SCOPE */
                userId={userId}
                ownerId={userId}
                noteId={note.id}
                isPersonal={true}
                /** do NOT pass orgId */
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}