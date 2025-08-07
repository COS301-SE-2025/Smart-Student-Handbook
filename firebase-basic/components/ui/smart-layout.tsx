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

/* ---------------------------------- */

const STANDALONE_PAGES = ["/", "/login", "/signup"]
const PROTECTED_PAGES = [
  "/dashboard",
  "/calendar",
  "/notes",
  "/hardnotes",
  "/profile",
  "/settings",
  "/organizations",
  "/friends",
]

interface SmartLayoutProps {
  children: React.ReactNode
}

export function SmartLayout({ children }: SmartLayoutProps) {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const isStandalonePage = STANDALONE_PAGES.includes(pathname)
  const isProtectedPage = PROTECTED_PAGES.some((p) => pathname.startsWith(p))

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  /* --------------- Loading spinner while auth resolves --------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  /* ---------------- Stand-alone routes (no layout) ------------------- */
  if (isStandalonePage) return <div className="min-h-screen bg-background">{children}</div>

  /* ---------------- Protected pages need login ----------------------- */
  if (isProtectedPage && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        {/* … (unchanged sign-in prompt block) … */}
        <div className="text-center space-y-6 max-w-sm mx-auto p-6">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2  
                   2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div className="space-y-3">
            <a
              href="/login"
              className="block w-full bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
            >
              Sign In
            </a>
            <a
              href="/signup"
              className="block w-full border border-border text-foreground px-4 py-2.5 rounded-lg hover:bg-muted transition-colors font-medium text-sm"
            >
              Create Account
            </a>
          </div>
        </div>
      </div>
    )
  }

  /* ---------------- Full app layout (with timer provider) ------------ */
  return (
    <SidebarProvider>
      <SessionTimerProvider>
        <div className="flex h-screen w-screen bg-background overflow-hidden">
          <AppSidebar />
          <div className="flex flex-col flex-1 relative">
            <SmartHeader />
            <main className="flex-1 overflow-auto pt-14">
              <div className="min-h-full bg-background">{children}</div>
            </main>
          </div>
        </div>
      </SessionTimerProvider>
    </SidebarProvider>
  )
}
