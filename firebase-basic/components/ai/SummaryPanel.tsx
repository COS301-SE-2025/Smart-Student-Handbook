"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Trash2 } from "lucide-react"
import { summarizeNote } from "@/lib/gemini"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"

type SummaryPanelProps = {
  /** Plain text to summarize (already stripped by the editor). */
  sourceText?: string | null
  title?: string
  disabled?: boolean
  initialSummary?: string
  className?: string
  buttonText?: string
  // New props to wire cloud functions
  orgId: string
  ownerId: string
  noteId: string
  allowDelete?: boolean
}

type LoadReq = { orgId: string; noteId: string }
type LoadRes = {
  success: boolean
  exists: boolean
  summary?: {
    id: string; orgId: string; noteId: string;
    ownerId: string | null; text: string; title: string;
    createdAt: number | null; updatedAt: number | null;
  }
}

type SaveReq = { orgId: string; noteId: string; ownerId: string; text: string; title?: string }
type SaveRes = { success: boolean; id: string; path: string }

type DeleteReq = { orgId: string; noteId: string }
type DeleteRes = { success: boolean }

const callLoad = httpsCallable<LoadReq, LoadRes>(fns, "loadSummary")
const callSave = httpsCallable<SaveReq, SaveRes>(fns, "saveSummary")
const callDelete = httpsCallable<DeleteReq, DeleteRes>(fns, "deleteSummary")

/* ---------------- Local helpers ------------------- */
const MAX_CHARS = 40_000
const CACHE_VERSION = "v3-plain"
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30

function clampPlain(input: string): string {
  const t = input.replace(/\s+/g, " ").trim()
  return t.length > MAX_CHARS ? t.slice(0, MAX_CHARS) : t
}
async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s)
  const hash = await crypto.subtle.digest("SHA-256", buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("")
}
const cacheKey = (h: string) => `summary:${CACHE_VERSION}:${h}`
function readCache(hash: string): string | null {
  try {
    const raw = localStorage.getItem(cacheKey(hash))
    if (!raw) return null
    const { at, value } = JSON.parse(raw) as { at: number; value: string }
    if (Date.now() - at > CACHE_TTL_MS) return null
    return typeof value === "string" ? value : null
  } catch { return null }
}
function writeCache(hash: string, value: string) {
  try { localStorage.setItem(cacheKey(hash), JSON.stringify({ at: Date.now(), value })) } catch {}
}

/* -------------------------------- Component ------------------------------- */
export default function SummaryPanel({
  sourceText,
  title = "Summary",
  disabled,
  initialSummary,
  className,
  buttonText = "Generate Summary",
  orgId,
  ownerId,
  noteId,
  allowDelete,
}: SummaryPanelProps) {
  const [summary, setSummary] = useState<string | null>(initialSummary ?? null)
  const [loading, setLoading] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(false)

  const runIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const lastTextRef = useRef<{ text: string; hash: string } | null>(null)

  const canSummarize = !!(sourceText && sourceText.trim()) && !disabled && !loading

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!orgId || !noteId) return
      setLoadingExisting(true)
      try {
        const res = await callLoad({ orgId, noteId })
        const data = res.data
        if (!cancelled && data?.exists && data.summary?.text) {
          setSummary(data.summary.text)
        } else if (!cancelled) {
          setSummary(null)
        }
      } catch (e) {
        console.error("Failed to load summary:", e)
      } finally {
        if (!cancelled) setLoadingExisting(false)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load()
    return () => { cancelled = true }
  }, [orgId, noteId])

  const handleSummarize = useCallback(async () => {
    if (!sourceText) return

    const plain = clampPlain(sourceText)
    if (!plain) return

    let hash: string
    if (lastTextRef.current?.text === plain) hash = lastTextRef.current.hash
    else {
      hash = await sha256Hex(plain)
      lastTextRef.current = { text: plain, hash }
    }

    const cached = readCache(hash)
    if (cached) {
      setSummary(cached)
      try { await callSave({ orgId, noteId, ownerId, text: cached }) } catch {}
      return
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    const myRun = ++runIdRef.current
    setLoading(true)

    try {
      const result = await (summarizeNote as unknown as (t: string, o?: { signal?: AbortSignal }) => Promise<string>)(
        plain, { signal: ctrl.signal }
      )

      if (runIdRef.current !== myRun) return
      writeCache(hash, result)
      setSummary(result)

      try { await callSave({ orgId, noteId, ownerId, text: result }) } catch (e) {
        console.error("Failed to save summary:", e)
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("Summarization failed:", err)
      }
    } finally {
      if (runIdRef.current === myRun) {
        setLoading(false)
        abortRef.current = null
      }
    }
  }, [sourceText, orgId, noteId, ownerId])

  const handleDelete = async () => {
    try {
      await callDelete({ orgId, noteId })
      setSummary(null)
    } catch (e) {
      console.error("Failed to delete summary:", e)
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{title}</CardTitle>
        <div className="flex items-center gap-2">
          <Button onClick={handleSummarize} disabled={!canSummarize || loadingExisting}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Summarizing…
              </>
            ) : (
              buttonText
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loadingExisting ? (
          <div className="text-sm text-muted-foreground flex items-center">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading summary…
          </div>
        ) : summary ? (
          <div className="p-4  rounded-lg bg-white text-base whitespace-pre-wrap">
            {summary}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {disabled ? "No summary yet. Generate one to see it here." : ""}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
