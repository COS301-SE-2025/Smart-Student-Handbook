"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/ui/app-sidebar"
import { SmartHeader } from "./smart-header"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"

/* NEW 👇 */
import { SessionTimerProvider } from "@/components/providers/SessionTimerProvider"

const STANDALONE_PAGES = ["/", "/login", "/signup"]

// NOTE: include the actual route you use: `/organisations`
const PROTECTED_PAGES = [
  "/dashboard",
  "/calendar",
  "/notes",
  "/hardnotes",
  "/profile",
  "/settings",
  "/organisations", // ✅ fixed spelling
  "/friends",
]

interface SmartLayoutProps {
  children: React.ReactNode
}

export function SmartLayout({ children }: SmartLayoutProps) {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true) // this tracks ONLY auth readiness

  const isStandalonePage = STANDALONE_PAGES.includes(pathname)
  const isProtectedPage = PROTECTED_PAGES.some((p) => pathname.startsWith(p))

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false) // universal loader stops immediately when auth is known
    })
    return () => unsub()
  }, [])

  // Standalone: render page as-is, no sidebar/header, no universal loader
  if (isStandalonePage) {
    return <div className="min-h-screen bg-background">{children}</div>
  }

  // Protected: if auth resolved and no user, show sign-in prompt
  if (isProtectedPage && !loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 max-w-sm mx-auto p-6">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <p className="text-muted-foreground text-sm">Please sign in to access this page.</p>
        </div>
      </div>
    )
  }

  // Full app layout:
  // While auth is resolving, show the universal (inline) loader in the MAIN AREA ONLY.
  // Once auth resolves, children render immediately (even if pages are fetching their own data).
  return (
    <SidebarProvider>
      <SessionTimerProvider>
        <div className="flex h-screen w-screen bg-background overflow-hidden">
          <AppSidebar />
          <div className="flex flex-col flex-1 relative">
            <SmartHeader />
            <main className="flex-1 overflow-auto pt-14">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto" />
                    <p className="text-muted-foreground text-sm">Loading…</p>
                  </div>
                </div>
              ) : (
                <div className="min-h-full bg-background">{children}</div>
              )}
            </main>
          </div>
        </div>
      </SessionTimerProvider>
    </SidebarProvider>
  )
}
