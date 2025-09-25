"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileText, CreditCard, HelpCircle, Notebook } from "lucide-react"
import { cn } from "@/lib/utils"

export type RibbonSection = "summary" | "flashcards" | "quiz" | "notes" | null

interface RibbonProps {
  activeSection: RibbonSection
  onSectionChange: (section: RibbonSection) => void
  className?: string
  onCollapse?: () => void
}

export default function Ribbon({ activeSection, onSectionChange, className, onCollapse }: RibbonProps) {
  const [lastClickTime, setLastClickTime] = useState<Record<string, number>>({})

  const handleIconClick = (section: RibbonSection) => {
    if (!section) return
    const now = Date.now()
    const last = lastClickTime[section] || 0
    const dbl = now - last < 300

    if (dbl) {
      onSectionChange(null)
      onCollapse?.()
    } else {
      onSectionChange(section)
    }
    setLastClickTime({ ...lastClickTime, [section]: now })
  }

  const items = [
    { id: "notes" as const, icon: Notebook, label: "Notes", active: activeSection === "notes" },
    { id: "summary" as const, icon: FileText, label: "Summary", active: activeSection === "summary" },
    { id: "flashcards" as const, icon: CreditCard, label: "Flashcards", active: activeSection === "flashcards" },
    { id: "quiz" as const, icon: HelpCircle, label: "Quiz", active: activeSection === "quiz" },
  ]

  return (
    <div
      className={cn(
        // fixed, offset below header and nudged left of the viewport edge so it doesn't cover scrollbar
        "fixed top-[var(--app-header-height,56px)] bottom-0 right-4 z-50",
        // increased width to better fit larger icons and text
        "w-[80px] min-w-[80px] flex flex-col bg-sidebar border-l border-sidebar-border",
        className,
      )}
      aria-hidden={false}
    >
      {items.map(({ id, icon: Icon, label, active }) => (
        <Button
          key={id}
          variant="ghost"
          size="sm"
          className={cn(
            // taller buttons and more spacing for readability
            "h-20 w-full p-0 rounded-none border-b border-sidebar-border hover:bg-sidebar-accent",
            "flex flex-col items-center justify-center gap-2 px-1",
            active && "bg-sidebar-accent text-sidebar-accent-foreground",
          )}
          onClick={() => handleIconClick(id)}
          title={`${label} (double-click to collapse)`}
          aria-pressed={active}
          aria-label={label}
        >
          <Icon className="h-7 w-7" />
          <span className="text-sm font-semibold leading-none mt-1 text-center truncate">{label}</span>
        </Button>
      ))}
      <div className="flex-1" />
    </div>
  )
}