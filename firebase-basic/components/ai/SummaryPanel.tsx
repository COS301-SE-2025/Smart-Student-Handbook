"use client"

import { useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { summarizeNote } from "@/lib/gemini"

type SummaryPanelProps = {
  /** Plain text to summarize (already stripped by the editor). */
  sourceText?: string | null
  title?: string
  onSummary?: (summary: string) => void
  disabled?: boolean
  initialSummary?: string
  className?: string
  buttonText?: string
}

type SummarizeOptions = { signal?: AbortSignal }

const MAX_CHARS = 40_000               // hard cap to control cost
const CACHE_VERSION = "v3-plain"       // bump if prompt/format changes
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

function clampPlain(input: string): string {
  // Input is already plain text. Just normalize minimal whitespace and cap length.
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

function cacheKey(hash: string) {
  return `summary:${CACHE_VERSION}:${hash}`
}
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
  } catch {
    /* ignore quota errors */
  }
}

/* Optional: typed wrapper that accepts AbortSignal even if the impl ignores it */
async function callSummarize(
  text: string,
  opts?: SummarizeOptions
): Promise<string> {
  const fn = summarizeNote as unknown as (t: string, o?: SummarizeOptions) => Promise<string>
  return fn(text, opts)
}

/* ────────────────────────────────────────────────────────────── */
/* Component                                                      */
/* ────────────────────────────────────────────────────────────── */
export default function SummaryPanel({
  sourceText,
  title = "Summary",
  onSummary,
  disabled,
  initialSummary,
  className,
  buttonText = "Generate Summary",
}: SummaryPanelProps) {
  const [summary, setSummary] = useState<string | null>(initialSummary ?? null)
  const [loading, setLoading] = useState(false)

  // Prevent stale overwrites when user clicks multiple times
  const runIdRef = useRef(0)
  // Allow cancellation of in-flight request
  const abortRef = useRef<AbortController | null>(null)
  // Micro-optimization: avoid recomputing the hash when text hasn't changed
  const lastTextRef = useRef<{ text: string; hash: string } | null>(null)

  const canSummarize = !!(sourceText && sourceText.trim()) && !disabled && !loading

  const handleSummarize = useCallback(async () => {
    if (!sourceText) return

    // Treat input as plain text; collapse whitespace + cap length
    const plain = clampPlain(sourceText)
    if (!plain) return

    // Reuse last hash if text unchanged; else compute once
    let hash: string
    if (lastTextRef.current?.text === plain) {
      hash = lastTextRef.current.hash
    } else {
      hash = await sha256Hex(plain)
      lastTextRef.current = { text: plain, hash }
    }

    // Cache hit: instant return, zero tokens
    const cached = readCache(hash)
    if (cached) {
      setSummary(cached)
      onSummary?.(cached)
      return
    }

    // Cancel any in-flight run
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    const myRun = ++runIdRef.current
    setLoading(true)

    try {
      const result = await callSummarize(plain, { signal: ctrl.signal })

      // Ignore outdated results
      if (runIdRef.current !== myRun) return

      writeCache(hash, result)
      setSummary(result)
      onSummary?.(result)
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("Summarization failed:", err)
      }
    } finally {
      // Only clear loading if we're still the latest run
      if (runIdRef.current === myRun) {
        setLoading(false)
        abortRef.current = null
      }
    }
  }, [sourceText, onSummary])

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{title}</CardTitle>
        <Button onClick={handleSummarize} disabled={!canSummarize}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Summarizing…
            </>
          ) : (
            buttonText
          )}
        </Button>
      </CardHeader>

      <CardContent>
        {summary ? (
          <div className="p-4 border rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm whitespace-pre-wrap">
            {summary}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {disabled ? "Summary unavailable." : "No summary yet. Generate one to see it here."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
