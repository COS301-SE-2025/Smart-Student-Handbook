// SmartHeader.tsx
"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Bell,
  User,
  Settings,
  LogOut,
  GraduationCap,
} from "lucide-react"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useState, useEffect, useCallback } from "react"

// Dynamic notifications imports
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"
import { isSameDay, parseISO } from "date-fns"

interface Notification {
  id: string
  title: string
  type: string
  time: string
  description: string
}

export function SmartHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [searchValue, setSearchValue] = useState("")

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)

  // Active semester
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null)

  // Initialize search from URL
  useEffect(() => {
    const q = searchParams.get("search") || ""
    setSearchValue(q)
  }, [searchParams])

  // Auth listener
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      setUser({ displayName: "Test User", email: "testuser@example.com" })
    }
    const unsub = auth.onAuthStateChanged((u) => setUser(u))
    return () => unsub()
  }, [])

  // Fetch active semester
  useEffect(() => {
    let mounted = true
    async function fetchActive() {
      try {
        const res = await httpsCallable(fns, "getSemesters")({})
        const sems: any[] = Array.isArray(res.data) ? res.data : []
        const active = sems.find((s) => s.isActive)
        if (mounted) setActiveSemesterId(active?.id || null)
      } catch (e) {
        console.error("Error fetching semesters", e)
      }
    }
    fetchActive()
    return () => { mounted = false }
  }, [])

  // Load today's events and lectures
  useEffect(() => {
    let mounted = true
    setLoadingNotifications(true)

    if (!activeSemesterId) {
      setNotifications([])
      setLoadingNotifications(false)
      return
    }

    const today = new Date()
    async function load() {
      try {
        const [evRes, lecRes] = await Promise.all([
          httpsCallable(fns, "getEvents")({ semesterId: activeSemesterId }),
          httpsCallable(fns, "getLectures")({ semesterId: activeSemesterId }),
        ])
        const events = Array.isArray(evRes.data) ? evRes.data : []
        const lectures = Array.isArray(lecRes.data) ? lecRes.data : []

        // format events: parseISO + locale time with AM/PM
        const todaysEvents = events
          .filter((e) => e.date && isSameDay(parseISO(e.date), today))
          .map((e) => ({
            id: e.id,
            title: e.title,
            type: e.type,
            time: parseISO(e.date).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            description: e.description,
          }))

        // format lectures: assume timeSlot is "HH:mm"
        const day = today.getDay()
        const todaysLectures = lectures
          .filter((l) => l.dayOfWeek === day)
          .map((l) => {
            // build a Date object at today with slot
            const [h, m] = l.timeSlot.split(":").map(Number)
            const dt = new Date(today)
            dt.setHours(h, m)
            return {
              id: l.id,
              title: l.subject,
              type: "lecture",
              time: dt.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              description: l.room,
            }
          })

        if (mounted) setNotifications([...todaysEvents, ...todaysLectures])
      } catch (e) {
        console.error("Error loading notifications", e)
      } finally {
        if (mounted) setLoadingNotifications(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [activeSemesterId])

  const handleSignOut = async () => {
    try {
      if (process.env.NODE_ENV === "development") {
        router.push("/")
        return
      }
      await signOut(auth)
      router.push("/")
    } catch (e) {
      console.error("Error signing out:", e)
    }
  }

  const handleSearchChange = useCallback(
    (v: string) => {
      setSearchValue(v)
      const pages = ["/organisations"]
      if (pages.includes(pathname)) {
        const p = new URLSearchParams(searchParams.toString())
        if (v.trim()) p.set("search", v.trim())
        else p.delete("search")
        router.replace(`${pathname}${p.toString() ? `?${p.toString()}` : ""}`, {
          scroll: false,
        })
      }
    },
    [pathname, router, searchParams]
  )

  const pageInfo = (() => {
    switch (pathname) {
      case "/dashboard":
      case "/calendar":
      case "/notes":
      case "/organisations":
      case "/hardnotes":
      case "/profile":
        return { title: "Smart Student Handbook", icon: <GraduationCap className="h-4 w-4" /> }
      default:
        return { title: "Smart Student Handbook", icon: <GraduationCap className="h-4 w-4" /> }
    }
  })()

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "lecture":
        return <div className="w-2 h-2 rounded-full bg-blue-500" />
      case "assignment":
        return <div className="w-2 h-2 rounded-full bg-red-500" />
      case "study":
        return <div className="w-2 h-2 rounded-full bg-green-500" />
      default:
        return <div className="w-2 h-2 rounded-full bg-muted-foreground" />
    }
  }

  const getSearchPlaceholder = () => {
    switch (pathname) {
      case "/organisations":
        return "Search organisations by name or description..."
      case "/notes":
        return "Search notes and documents..."
      case "/dashboard":
        return "Search notebooks, organisations..."
      default:
        return "Search notes, modules, flashcards..."
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex h-full items-center justify-between px-4">

        {/* Left: Sidebar trigger + title */}
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8" />
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">{pageInfo.icon}</div>
            <h1 className="font-semibold text-foreground">{pageInfo.title}</h1>
          </div>
        </div>

        {/* Center: Search */}
        <div className="flex-1 max-w-lg mx-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={getSearchPlaceholder()}
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-8 bg-muted/50 border-border focus:bg-background transition-colors"
            />
          </div>
        </div>

        {/* Right: Notifications & user menu */}
        <div className="flex items-center gap-1">

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative h-8 w-8">
                <Bell className="h-4 w-4" />
                {!loadingNotifications && notifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] bg-destructive">
                    {notifications.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 mr-2" align="end">
              <div className="p-3">
                <h4 className="font-medium mb-3 text-sm">
                  {loadingNotifications ? "Loading…" : "Today's Schedule"}
                </h4>
                {loadingNotifications ? (
                  <div className="animate-pulse space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-4 bg-muted rounded" />
                    ))}
                  </div>
                ) : notifications.length ? (
                  <div className="space-y-2">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start gap-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                      >
                        {getNotificationIcon(n.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1 space-x-2">
                            <p className="text-sm font-medium truncate">{n.title}</p>
                            <Badge variant="secondary" className="text-[10px]">
                              {n.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {n.time}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {n.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No events for today</p>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || "User"} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {user?.displayName?.charAt(0) || user?.email?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mr-2" align="end">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || "User"} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {user?.displayName?.charAt(0) || user?.email?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-1">
                  {user?.displayName && <p className="text-sm font-medium">{user.displayName}</p>}
                  {user?.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")} className="gap-2">
                <User className="h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/profile")} className="gap-2">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>
    </header>
  )
}
