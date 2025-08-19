"use client"

import { useMemo, useState } from "react"
import faqs from "../../faqs.json"
import { PageHeader } from "@/components/ui/page-header"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"

type Faq = {
  id: string
  question: string
  answer: string   // HTML string
  category: string
  tags?: string[]
}

/** naive highlighter for the search term */
function highlight(html: string, term: string) {
  if (!term) return html
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return html.replace(new RegExp(`(${esc})`, "ig"), "<mark>$1</mark>")
}

export default function FaqIndex() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string | null>(null)

  const categories = useMemo(
    () => Array.from(new Set((faqs as Faq[]).map(f => f.category))).sort(),
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (faqs as Faq[])
      .filter(f => (category ? f.category === category : true))
      .filter(f => {
        if (!q) return true
        const hay = (f.question + " " + f.answer + " " + (f.tags || []).join(" ")).toLowerCase()
        return hay.includes(q)
      })
  }, [query, category])

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="FAQs" description="Find quick answers to common questions." />

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Search + categories */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Search FAQs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:w-96"
          />
          <div className="flex gap-2 flex-wrap">
            <Badge
              onClick={() => setCategory(null)}
              variant={category === null ? "default" : "outline"}
              className="cursor-pointer"
            >
              All
            </Badge>
            {categories.map(c => (
              <Badge
                key={c}
                onClick={() => setCategory(c)}
                variant={category === c ? "default" : "outline"}
                className="cursor-pointer"
              >
                {c}
              </Badge>
            ))}
          </div>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground border rounded-lg p-6">
            No results. Try different keywords or clear filters.
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {filtered.map((f) => (
              <AccordionItem key={f.id} value={f.id}>
                <AccordionTrigger className="text-left">
                  <span dangerouslySetInnerHTML={{ __html: highlight(f.question, query) }} />
                </AccordionTrigger>
                <AccordionContent>
                  <div
                    className="prose dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: highlight(f.answer, query) }}
                  />
                  {/* Helpful buttons (local only) */}
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Was this helpful?</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => localStorage.setItem(`faq-${f.id}-helpful`, "1")}
                    >
                      Yes
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => localStorage.setItem(`faq-${f.id}-helpful`, "0")}
                    >
                      No
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  )
}

// Optional SEO (Next app router will pick this up)
export const metadata = {
  title: "FAQs • Smart Student Handbook",
  description: "Answers to common questions about the Smart Student Handbook.",
}
