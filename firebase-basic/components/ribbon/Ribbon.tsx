"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileText, CreditCard, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type RibbonSection = "summary" | "flashcards" | "quiz" | null

interface RibbonProps {
  activeSection: RibbonSection
  onSectionChange: (section: RibbonSection) => void
  className?: string
  /** when user double-clicks an icon, collapse the content (editor remains + ribbon stays) */
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
      onSectionChange(null) // hide right content
      onCollapse?.() // expand editor
    } else {
      onSectionChange(section) // show that section
    }
    setLastClickTime({ ...lastClickTime, [section]: now })
  }

  const items = [
    { id: "summary" as const, icon: FileText, label: "Summary", active: activeSection === "summary" },
    { id: "flashcards" as const, icon: CreditCard, label: "Flash Cards", active: activeSection === "flashcards" },
    { id: "quiz" as const, icon: HelpCircle, label: "Quiz", active: activeSection === "quiz" },
  ]

  return (
    <div
      // moved ribbon toward the right: ml-auto (push in flex), sticky to keep it at top, right-0 as fallback
      className={cn(
        "flex flex-col bg-sidebar border-l border-sidebar-border h-full ml-auto sticky top-0 right-0",
        className,
      )}
    >
      {items.map(({ id, icon: Icon, label, active }) => (
        <Button
          key={id}
          variant="ghost"
          size="sm"
          className={cn(
            "h-12 w-12 p-0 rounded-none border-b border-sidebar-border hover:bg-sidebar-accent",
            active && "bg-sidebar-accent text-sidebar-accent-foreground",
          )}
          onClick={() => handleIconClick(id)}
          title={`${label} (double-click to collapse)`}
        >
          <Icon className="h-5 w-5" />
        </Button>
      ))}
      <div className="flex-1" />
    </div>
  )
}