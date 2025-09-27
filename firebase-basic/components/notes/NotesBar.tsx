"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Notebook,
} from "lucide-react"

import { getDatabase, ref, get, onValue } from "@firebase/database"
import { getAuth } from "@firebase/auth"

/* ------------------------------ Types ------------------------------ */

type NoteListItem = {
  id: string
  title: string
  ownerId?: string
  updatedAt?: number
  createdAt?: number
}

/* ------------------------------ Helpers ------------------------------ */

/** Try to pull a human-friendly title from a BlockNote JSON array string. */
function titleFromContentJSON(jsonStr: string): string | null {
  try {
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed)) return null
    // walk top-level blocks; return first non-empty text-ish content
    for (const block of parsed) {
      if (block?.content && Array.isArray(block.content)) {
        for (const span of block.content) {
          const t = span?.text?.trim?.()
          if (t) return t
        }
      }
      const propText = block?.props?.text
      if (typeof propText === "string" && propText.trim().length > 0) {
        return propText.trim()
      }
    }
  } catch {
    /* ignore parse errors */
  }
  return null
}

function fmtWhen(n?: number): string {
  if (!n) return "No timestamp"
  try {
    return new Date(n).toLocaleString()
  } catch {
    return "No timestamp"
  }
}

/* ------------------------------ Loader (one-off helper, still used for fallback) ------------------------------ */
async function fetchOrgNotes(orgId: string): Promise<NoteListItem[]> {
  const db = getDatabase()
  const notesRef = ref(db, `organizations/${orgId}/notes`)
  const snap = await get(notesRef)
  if (!snap.exists()) return []

  const raw = snap.val() as Record<string, any>
  const items: NoteListItem[] = []

  for (const [id, n] of Object.entries(raw)) {
    const anyN: any = n ?? {}
    let title =
      (typeof anyN.title === "string" && anyN.title.trim()) ||
      (typeof anyN.name === "string" && anyN.name.trim()) ||
      ""

    if (!title) {
      const content = anyN.content
      if (typeof content === "string" && content.length > 0) {
        const t = titleFromContentJSON(content)
        if (t) title = t
      }
    }
    if (!title) title = "Untitled Note"

    items.push({
      id,
      title,
      ownerId: typeof anyN.ownerId === "string" ? anyN.ownerId : undefined,
      updatedAt: typeof anyN.updatedAt === "number" ? anyN.updatedAt : undefined,
      createdAt: typeof anyN.createdAt === "number" ? anyN.createdAt : undefined,
    })
  }

  items.sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))
  return items
}

/* ------------------------------ Component ------------------------------ */

type NotesBarProps = {
  orgId?: string
  /** Called when user chooses a note (double click row). */
  onOpenNote?: (noteId: string) => void
}

export default function NotesBar({ orgId, onOpenNote }: NotesBarProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<NoteListItem[]>([])
  const [expanded, setExpanded] = useState(true)

  const auth = useMemo(() => getAuth(), [])

  useEffect(() => {
    setError(null)
    setNotes([])

    if (!orgId) return

    const user = auth.currentUser
    if (!user) {
      setError("You must be signed in to view notes.")
      return
    }

    const db = getDatabase()
    const notesRef = ref(db, `organizations/${orgId}/notes`)

    setLoading(true)

    // Live subscription: keeps titles/timestamps in sync as they change
    const unsubscribe = onValue(
      notesRef,
      (snap) => {
        if (!snap.exists()) {
          setNotes([])
          setLoading(false)
          return
        }

        const raw = snap.val() as Record<string, any>
        const items: NoteListItem[] = []

        for (const [id, n] of Object.entries(raw)) {
          const anyN: any = n ?? {}
          // Prefer `name` (your org notes use `name`), fall back to `title`
          let title =
            (typeof anyN.name === "string" && anyN.name.trim()) ||
            (typeof anyN.title === "string" && anyN.title.trim()) ||
            ""

          if (!title) {
            // Optional: try to derive from content if it's BlockNote JSON string
            const content = anyN.content
            if (typeof content === "string" && content.length > 0) {
              const t = titleFromContentJSON(content)
              if (t) title = t
            }
          }
          if (!title) title = "Untitled Note"

          items.push({
            id,
            title,
            ownerId: typeof anyN.ownerId === "string" ? anyN.ownerId : undefined,
            updatedAt: typeof anyN.updatedAt === "number" ? anyN.updatedAt : undefined,
            createdAt: typeof anyN.createdAt === "number" ? anyN.createdAt : undefined,
          })
        }

        items.sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))
        setNotes(items)
        setExpanded(true)
        setLoading(false)
      },
      (err) => {
        console.error("[NotesBar] subscription error:", err)
        setError(err?.message || "Failed to load notes.")
        setLoading(false)
      },
    )

    return () => {
      // unsubscribe from onValue
      unsubscribe()
    }
  }, [orgId, auth])

  return (
    <Card className="h-full">
      <CardContent className="p-0 flex-1 min-h-0">
        <div className="h-full flex flex-col">
          {/* Fixed header so height never jumps */}
          <div className="sticky top-0 z-0 pr-[84px] flex items-center justify-between gap-2 px-4 py-2 border-b border-border/30 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
            <Notebook className="h-5 w-5 text-black" />
            <span className="text-sm font-medium text-foreground">Notes</span>
            <div className="ml-auto flex items-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" />}
            </div>
          </div>
          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-4">
              {!orgId ? (
                <div className="text-xs text-muted-foreground p-2">
                  Open this page inside an organization to view notes.
                </div>
              ) : error ? (
                <div className="text-xs text-red-700 p-2 border border-red-200 bg-red-50 rounded">{error}</div>
              ) : notes.length === 0 ? (
                <div className="text-xs text-muted-foreground p-2">This organisation has no notes yet.</div>
              ) : (
                <div className="space-y-2">
                  {/* Single â€œAll Notesâ€ folder (mirrors Quizzes section style) */}
                  <button
                    onClick={() => setExpanded((p) => !p)}
                    className="flex items-center gap-2 w-full p-2 hover:bg-background/40 rounded-md transition-colors text-left"
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-black" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-black" />
                    )}
                    {expanded ? (
                      <FolderOpen className="h-4 w-4 text-black" />
                    ) : (
                      <Folder className="h-4 w-4 text-black" />
                    )}
                    <span className="text-base font-medium text-foreground">All Notes ({notes.length})</span>
                  </button>

                  {expanded && (
                    <div className="ml-6 space-y-1">
                      {notes.map((n) => (
                        <div
                          key={n.id}
                          className="flex items-center gap-2 p-2 hover:bg-background/40 rounded-md transition-colors w-full cursor-pointer"
                          onDoubleClick={() => onOpenNote?.(n.id)} // open on double click
                          title="Double-click to open in editor"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") onOpenNote?.(n.id)
                          }}
                        >
                          <FileText className="h-4 w-4 text-black" />
                          <div className="flex-1 min-w-0">
                            <div className="text-base font-medium text-foreground truncate">{n.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {n.updatedAt
                                ? `Updated ${fmtWhen(n.updatedAt)}`
                                : n.createdAt
                                ? `Created ${fmtWhen(n.createdAt)}`
                                : "No timestamp"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}