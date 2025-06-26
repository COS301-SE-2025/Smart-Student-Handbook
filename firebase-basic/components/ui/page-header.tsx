import type React from "react"

interface PageHeaderProps {
  title: string
  description: string
  children?: React.ReactNode
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="p-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex-1 space-y-4">
            <h1 className="text-5xl font-bold tracking-tight text-foreground">{title}</h1>
            <p className="text-muted-foreground text-xl max-w-3xl leading-relaxed">{description}</p>
          </div>
          {children && <div className="flex-shrink-0">{children}</div>}
        </div>
      </div>
    </div>
  )
}
