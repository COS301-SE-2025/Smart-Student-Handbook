"use client"

import { useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { summarizeNote } from "@/lib/gemini"

type SimpleSummaryPanelProps = {
  /** Plain text to summarize (already stripped by the editor). */
  sourceText: string
  title?: string
  disabled?: boolean
  className?: string
  buttonText?: string
}

export default function SimpleSummaryPanel({
  sourceText,
  title = "Summary",
  disabled,
  className,
  buttonText = "Generate Summary",
}: SimpleSummaryPanelProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Prevent stale overwrites when user clicks multiple times
  const runIdRef = useRef(0)
  // Allow cancellation of in-flight request
  const abortRef = useRef<AbortController | null>(null)

  const canSummarize = !!(sourceText && sourceText.trim()) && !disabled && !loading

  const handleSummarize = useCallback(async () => {
    if (!sourceText) return

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    const myRun = ++runIdRef.current
    setLoading(true)

    try {
      const result = await (summarizeNote as unknown as (t: string, o?: { signal?: AbortSignal }) => Promise<string>)(
        sourceText,
        { signal: ctrl.signal }
      )

      if (runIdRef.current !== myRun) return
      setSummary(result)
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
  }, [sourceText])

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
