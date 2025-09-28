"use client"

import { useState } from "react"
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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

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
        "fixed top-[var(--app-header-height,56px)] bottom-0 right-6 z-50",
        "w-[50px] min-w-[50px] flex flex-col bg-background/95 backdrop-blur-md rounded-lg shadow-sm border border-border",
        className,
      )}
      aria-hidden={false}
    >
      <div className="flex flex-col py-2">
        {items.map(({ id, icon: Icon, label, active }) => (
          <div
            key={id}
            className="relative group"
            onMouseEnter={() => setHoveredItem(id)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <div
              className={cn(
                "h-12 w-full flex items-center justify-center cursor-pointer",
                "transition-all duration-200 ease-in-out",
                "hover:bg-accent hover:scale-105",
                active && "bg-accent/80 shadow-sm",
                "mx-1 my-0.5 rounded-md",
              )}
              onClick={() => handleIconClick(id)}
              title={`${label} (double-click to collapse)`}
              aria-pressed={active}
              aria-label={label}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors duration-200",
                  active ? "text-primary" : "text-muted-foreground",
                  "group-hover:text-primary",
                )}
              />
            </div>

            {hoveredItem === id && (
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-60">
                <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg border border-border">
                  {label}
                  <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-popover"></div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}