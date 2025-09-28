// components/ai/SummaryPanel.tsx
"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Maximize2, X } from "lucide-react"
import { summarizeNote } from "@/lib/gemini"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"

type SummaryPanelProps = {
  sourceText?: string | null
  title?: string
  disabled?: boolean
  initialSummary?: string
  className?: string
  buttonText?: string

  /** Org context (shared notes) */
  orgId?: string

  /** Ownership & identity */
  ownerId: string
  noteId: string

  /** Personal context hint (optional); if provided we’ll infer scope automatically */
  userId?: string

  /** Force personal user-scope if true */
  isPersonal?: boolean

  /** NEW: only on personal page – load, and if missing, auto-generate & save once */
  autoGenerateIfMissing?: boolean
}

/* ---------------- Org callables (unchanged) ---------------- */
type OrgLoadReq = { orgId: string; noteId: string }
type OrgLoadRes = {
  success: boolean
  exists: boolean
  summary?: {
    id: string
    orgId: string
    noteId: string
    ownerId: string | null
    text: string
    title: string
    createdAt: number | null
    updatedAt: number | null
  }
}
type OrgSaveReq = { orgId: string; noteId: string; ownerId: string; text: string; title?: string }
type OrgSaveRes = { success: boolean; id: string; path: string }

const callLoadOrg = httpsCallable<OrgLoadReq, OrgLoadRes>(fns, "loadSummary")
const callSaveOrg = httpsCallable<OrgSaveReq, OrgSaveRes>(fns, "saveSummary")

/* ---------------- Personal callables (match your usercontents) ----------------
   NOTE: These functions rely on Firebase Auth; the callable picks up auth automatically.
   Payloads:
   - loadUserSummary:  { noteId }
   - saveUserSummary:  { noteId, summary }
   Returns:
   - loadUserSummary:  { summary: string | null }
------------------------------------------------------------------------------- */
type UserLoadSummaryRes = { summary: string | null }
type UserSaveSummaryReq = { noteId: string; summary: string }

const callLoadUserSimple = httpsCallable<{ noteId: string }, UserLoadSummaryRes>(fns, "loadUserSummary")
const callSaveUserSimple = httpsCallable<UserSaveSummaryReq, { ok: true }>(fns, "saveUserSummary")

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
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
const cacheKey = (h: string) => `summary:${CACHE_VERSION}:${h}`
function readCache(hash: string): string | null {
  try {
    const raw = localStorage.getItem(cacheKey(hash))
    if (!raw) return null
    const { at, value } = JSON.parse(raw) as { at: number; value: string }
    if (Date.now() - at > CACHE_TTL_MS) return null
    return typeof value === "string" ? value : null
  } catch {
    return null
  }
}
function writeCache(hash: string, value: string) {
  try {
    localStorage.setItem(cacheKey(hash), JSON.stringify({ at: Date.now(), value }))
  } catch {}
}

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
  userId,
  isPersonal,
  autoGenerateIfMissing = false,
}: SummaryPanelProps) {
  const [summary, setSummary] = useState<string | null>(initialSummary ?? null)
  const [loading, setLoading] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(false)

  const [isExpanded, setIsExpanded] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [autoTried, setAutoTried] = useState(false) // ensure we auto-generate only once

  const runIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const lastTextRef = useRef<{ text: string; hash: string } | null>(null)

  // Decide storage scope:
  const useUserScope = ((): boolean => {
    if (typeof isPersonal === "boolean") return isPersonal
    if (!orgId) return true
    if (userId && ownerId && userId === ownerId) return true
    return false
  })()

  const canSummarize = !!(sourceText && sourceText.trim()) && !disabled && !loading

  useEffect(() => setIsClient(true), [])

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExpanded(false)
    }
    if (isExpanded) window.addEventListener("keydown", onEsc)
    return () => window.removeEventListener("keydown", onEsc)
  }, [isExpanded])

  useEffect(() => {
    const cls = "overlay-open"
    const el = document.documentElement
    if (isExpanded) {
      el.classList.add(cls)
      document.body.style.overflow = "hidden"
    } else {
      el.classList.remove(cls)
      document.body.style.overflow = ""
    }
    return () => {
      el.classList.remove(cls)
      document.body.style.overflow = ""
    }
  }, [isExpanded])

  // Load existing summary from the correct scope
  useEffect(() => {
    let cancelled = false
    setAutoTried(false) // reset when note/scope changes
    async function load() {
      if (!noteId) return
      setLoadingExisting(true)
      try {
        if (useUserScope) {
          // PERSONAL: uses your simple endpoints
          const res = await callLoadUserSimple({ noteId })
          const text = res?.data?.summary ?? null
          if (!cancelled) setSummary(text)
        } else {
          // ORG: unchanged
          if (!orgId) return
          const res = await callLoadOrg({ orgId, noteId })
          const data = res.data
          const text = data?.exists && data.summary?.text ? data.summary.text : null
          if (!cancelled) setSummary(text)
        }
      } catch (e) {
        console.error("Failed to load summary:", e)
        if (!cancelled) setSummary(null)
      } finally {
        if (!cancelled) setLoadingExisting(false)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load()
    return () => {
      cancelled = true
    }
  }, [useUserScope, orgId, userId, noteId])

  // If personal + missing + opt-in flag, auto-generate ONCE
  useEffect(() => {
    if (
      useUserScope &&
      autoGenerateIfMissing &&
      !loadingExisting &&
      !summary &&
      !autoTried &&
      canSummarize
    ) {
      setAutoTried(true)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      handleSummarize()
    }
  }, [useUserScope, autoGenerateIfMissing, loadingExisting, summary, autoTried, canSummarize])

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

    const persist = async (textToSave: string) => {
      try {
        if (useUserScope) {
          // PERSONAL: { noteId, summary }
          await callSaveUserSimple({ noteId, summary: textToSave })
        } else {
          if (!orgId) return
          await callSaveOrg({ orgId, noteId, ownerId, text: textToSave })
        }
      } catch (e) {
        console.error("Failed to save summary:", e)
      }
    }

    if (cached) {
      setSummary(cached)
      await persist(cached)
      return
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    const myRun = ++runIdRef.current
    setLoading(true)

    try {
      const result = await (summarizeNote as unknown as (t: string, o?: { signal?: AbortSignal }) => Promise<string>)(
        plain,
        { signal: ctrl.signal },
      )

      if (runIdRef.current !== myRun) return

      writeCache(hash, result)
      setSummary(result)
      await persist(result)
    } catch (err: any) {
      if (err?.name !== "AbortError") console.error("Summarization failed:", err)
    } finally {
      if (runIdRef.current === myRun) {
        setLoading(false)
        abortRef.current = null
      }
    }
  }, [sourceText, orgId, ownerId, noteId, useUserScope])

  return (
    <>
      <div className={`${className} h-full flex flex-col`}>
        <div className="flex flex-row items-center justify-between p-4 border-b border-border/30 bg-background/70 backdrop-blur">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="flex items-center gap-2">
            <Button onClick={handleSummarize} disabled={!canSummarize || loadingExisting} variant="default" size="sm">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Summarizing…
                </>
              ) : (
                buttonText
              )}
            </Button>
            <Button
              onClick={() => setIsExpanded(true)}
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 shrink-0 hover:bg-accent bg-transparent"
              aria-label="Expand"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-6 flex items-center justify-center">
          {loadingExisting ? (
            <div className="flex items-center justify-center text-lg text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            </div>
          ) : summary ? (
            <div className="w-full max-w-4xl h-full overflow-y-auto p-6 rounded-lg bg-white border border-gray-200 shadow-sm">
              <div className="text-base leading-relaxed whitespace-pre-wrap break-words text-gray-900">{summary}</div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <p className="text-lg text-muted-foreground text-center">
                {disabled ? "No summary yet. Generate one to see it here." : "No summary yet."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isExpanded &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-black/35 backdrop-blur-[6px] flex items-center justify-center p-4"
            onClick={() => setIsExpanded(false)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Card className="w-full max-w-4xl min-w-[900px] h-[90vh] min-h-[700px] max-h-[800px] bg-background shadow-2xl flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between px-6 py-4 border-b shrink-0">
                  <CardTitle className="text-xl">{title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSummarize}
                      disabled={!canSummarize}
                      variant="default"
                      size="sm"
                      className="shrink-0 px-4"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Summarizing…
                        </>
                      ) : (
                        buttonText
                      )}
                    </Button>
                    <Button
                      onClick={() => setIsExpanded(false)}
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0 hover:bg-accent bg-transparent"
                      aria-label="Close modal"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 min-h-0 px-6 pb-6">
                  {loadingExisting ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    </div>
                  ) : summary ? (
                    <div className="flex-1 min-h-0">
                      <div className="h-full w-full overflow-y-auto whitespace-pre-wrap leading-snug p-3 break-words text-xs md:text-sm">
                        {summary}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-muted-foreground text-lg text-center">No summary yet.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
