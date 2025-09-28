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
import { Search, Bell, User, Settings, LogOut, GraduationCap, X } from "lucide-react"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useState, useEffect, useCallback } from "react"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"
import { isSameDay, parseISO, format } from "date-fns"
import Link from "next/link"
import Image from "next/image"
import { getDatabase, ref as dbRef, onValue, push as dbPush, set as dbSet, update as dbUpdate, remove as dbRemove } from "firebase/database"
import { getAuth } from "firebase/auth" //adjust real-time db
import dynamic from "next/dynamic";


interface Notification {
  id: string
  title: string
  type: string
  time: string
  description: string
  fromUserId?: string 
  requestId?: string 
  orgId?: string // Add this for organization notifications
}

export function SmartHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [searchValue, setSearchValue] = useState("")

  // Calendar & lecture notifications
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)

  // Organisation-related notifications (invites & new public orgs)
  const [orgNotifications, setOrgNotifications] = useState<Notification[]>([])

  // Active semester ID
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null)

  // Dismissed calendar notifications for today
  const [dismissedCalendarNotifications, setDismissedCalendarNotifications] = useState<Set<string>>(new Set())

  // Get today's date key for localStorage
  const getTodayKey = () => format(new Date(), "yyyy-MM-dd")

  // Load dismissed notifications from localStorage
  useEffect(() => {
    const todayKey = getTodayKey()
    const dismissed = localStorage.getItem(`dismissed-notifications-${todayKey}`)
    if (dismissed) {
      try {
        const dismissedIds = JSON.parse(dismissed)
        setDismissedCalendarNotifications(new Set(dismissedIds))
      } catch (e) {
        console.error("Error parsing dismissed notifications:", e)
      }
    }
  }, [])

  // Save dismissed notifications to localStorage
  const saveDismissedNotifications = (dismissedIds: Set<string>) => {
    const todayKey = getTodayKey()
    localStorage.setItem(`dismissed-notifications-${todayKey}`, JSON.stringify([...dismissedIds]))
  }

  // Format notification title to remove quotes and improve readability
  const formatNotificationTitle = (title: string, type: string) => {
    const formattedTitle = title.replace(/["'"]/g, "")
    if (type === "new_public_org") {
      const match = formattedTitle.match(/A new organisation (.+?) has been/i)
      if (match) {
        const orgName = match[1]
        return `New organization: ${orgName}`
      }
    }
    if (type === "added_to_group") {
      const match = formattedTitle.match(/You were added to "(.+)"/)
      if (match) {
        return `Added to: ${match[1]}`
      }
    }
    return formattedTitle
  }

  // Update the dismissNotification function
  const dismissNotification = useCallback(
    (id: string, type?: string) => {
      if (type === "added_to_group" || 
          type === "new_public_org" || 
          type === "friend_request" || 
          type === "friend_request_accepted") {
        // For organization and friend notifications, remove from Firebase
        if (!user?.uid) return
        const db = getDatabase()
        dbRemove(dbRef(db, `users/${user.uid}/notifications/${id}`))
      } else {
        // For calendar notifications (events and lectures), add to dismissed list
        const newDismissed = new Set(dismissedCalendarNotifications)
        newDismissed.add(id)
        setDismissedCalendarNotifications(newDismissed)
        saveDismissedNotifications(newDismissed)
      }
    },
    [user, dismissedCalendarNotifications],
  )

  // Initialize search from URL
  useEffect(() => {
    setSearchValue(searchParams.get("search") || "")
  }, [searchParams])

  // Auth listener
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      setUser({
        uid: "dev",
        displayName: "Test User",
        email: "test@example.com",
      })
    }
    const unsub = auth.onAuthStateChanged((u) => setUser(u))
    return () => unsub()
  }, [])

  // Listen for notifications (including friend requests)
  useEffect(() => {
    if (!user?.uid) {
      console.log(`❌ No user ID for notifications`);
      return;
    }
    
    console.log(`👂 Setting up notification listener for user: ${user.uid}`);
    const db = getDatabase()
    const notifRef = dbRef(db, `users/${user.uid}/notifications`)
    
    const off = onValue(notifRef, (snap) => {
      console.log(`📨 Raw notification snapshot:`, snap.val())
      const raw = snap.val() as Record<string, any> | null
      
      if (!raw) {
        console.log(`📭 No notifications found`)
        setOrgNotifications([])
        return
      }
      
      const filtered: Notification[] = []
      snap.forEach((childSnap) => {
        const n = childSnap.val() as any
        const key = childSnap.key!
        
        console.log(`🔍 Processing notification:`, { key, type: n.type, data: n })
        
        if (n.type === "added_to_group" || 
            n.type === "new_public_org" || 
            n.type === "friend_request" || 
            n.type === "friend_request_accepted") {
          
          const notification = {
            id: key,
            title: n.message,
            type: n.type,
            time: formatDate(n.timestamp),
            description: getNotificationDescription(n.type, n.message),
            fromUserId: n.fromUserId,
            orgId: n.orgId,
            requestId: n.requestId, 
          }
          
          console.log(`✅ Adding notification to list:`, notification)
          filtered.push(notification)
        } else {
          console.log(`❌ Notification type not matching:`, n.type)
        }
      })
      
      console.log(`📊 Total filtered notifications:`, filtered.length)
      setOrgNotifications(filtered)
    })
    
    return () => {
      console.log(`🛑 Cleaning up notification listener`)
      off()
    }
  }, [user?.uid])

  // Fetch active semester
  useEffect(() => {
    let mounted = true
    async function fetchSem() {
      if (!user?.uid) return
      const res = await httpsCallable(fns, "getSemesters")({})
      const sems: any[] = Array.isArray(res.data) ? res.data : []
      const active = sems.find((s) => s.isActive)
      if (mounted) setActiveSemesterId(active?.id || null)
    }
    fetchSem()
    return () => {
      mounted = false
    }
  }, [user])

  // Load calendar events, lectures, and org notifications
  useEffect(() => {
    let mounted = true
    setLoadingNotifications(true)
    if (!activeSemesterId) {
      if (mounted) {
        setNotifications(orgNotifications)
        setLoadingNotifications(false)
      }
      return
    }

    const today = new Date()
    async function loadAll() {
      const [evRes, lecRes] = await Promise.all([
        httpsCallable(fns, "getEvents")({ semesterId: activeSemesterId }),
        httpsCallable(fns, "getLectures")({ semesterId: activeSemesterId }),
      ])

      const events = Array.isArray(evRes.data) ? evRes.data : []
      const lectures = Array.isArray(lecRes.data) ? lecRes.data : []

      const todaysEvents: Notification[] = events
        .filter((e: any) => e.date && isSameDay(parseISO(e.date), today))
        .map((e: any) => ({
          id: e.id,
          title: e.title,
          type: e.type,
          time: parseISO(e.date).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          description: e.description,
        }))
        .filter((e) => !dismissedCalendarNotifications.has(e.id)) // Filter out dismissed events

      const day = today.getDay()
      const todaysLectures: Notification[] = lectures
        .filter((l: any) => l.dayOfWeek === day)
        .map((l: any) => {
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
        .filter((l) => !dismissedCalendarNotifications.has(l.id)) // Filter out dismissed lectures

      if (mounted) {
        setNotifications([...todaysEvents, ...todaysLectures, ...orgNotifications])
      }
      if (mounted) setLoadingNotifications(false)
    }
    loadAll()
    return () => {
      mounted = false
    }
  }, [activeSemesterId, orgNotifications, dismissedCalendarNotifications])

  // Sign out
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

  // Search handler
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
    [pathname, router, searchParams],
  )

  // Page info
  type PageInfo = {
    title: string
    icon: React.ReactNode
    href: string
  }

  const pageInfo = (() => {
    switch (pathname) {
      case "/dashboard":
      case "/calendar":
      case "/notes":
      case "/organisations":
      case "/hardnotes":
      case "/profile":
        return {
          title: "Smart Student Handbook",
          icon: <GraduationCap className="h-4 w-4" />,
          href: "../../dashboard",
        }
      default:
        return {
          title: "Smart Student Handbook",
          icon: <GraduationCap className="h-4 w-4" />,
          href: "../../dashboard",
        }
    }
  })()

    // Get notification description
  const getNotificationDescription = (type: string, message: string) => {
    switch (type) {
      case "friend_request":
        return "Click to view and respond to the friend request"
      case "friend_request_accepted":
        return "Your friend request was accepted"
      case "added_to_group":
        return "You've been added to a private organization"
      case "new_public_org":
        return "A new public organization has been created"
      default:
        return message
    }
  }

  const getNotificationTitle = (type: string, formattedTitle: string) => {
    if (type === "new_public_org") {
      const match = formattedTitle.match(/New organization "(.+)" was created/)
      if (match) {
        const orgName = match[1]
        return `New organization: ${orgName}`
      }
    }
    if (type === "added_to_group") {
      const match = formattedTitle.match(/You were added to "(.+)"/)
      if (match) {
        return `Added to: ${match[1]}`
      }
    }
    if (type === "friend_request") {
      const match = formattedTitle.match(/(.+) sent you a friend request/)
      if (match) {
        return `Friend request from ${match[1]}`
      }
    }
    if (type === "friend_request_accepted") {
      const match = formattedTitle.match(/(.+) accepted your friend request/)
      if (match) {
        return `${match[1]} accepted your request`
      }
    }
    return formattedTitle
  }
  // Add this function near your other utility functions
  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), "MMM d, h:mm a")
  }
  // Update the notification icon function to include friend icons
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "lecture":
        return <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
      case "assignment":
        return <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
      case "study":
        return <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
      case "added_to_group":
        return <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
      case "new_public_org":
        return <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
      case "friend_request":
        return <div className="w-2 h-2 rounded-full bg-pink-500 flex-shrink-0" />
      case "friend_request_accepted":
        return <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
      default:
        return <div className="w-2 h-2 rounded-full bg-muted-foreground flex-shrink-0" />
    }
  }
  // Get notification type display name
  const getNotificationTypeDisplay = (type: string) => {
    switch (type) {
      case "lecture":
        return "LECTURE"
      case "assignment":
        return "ASSIGNMENT"
      case "study":
        return "STUDY"
      case "added_to_group":
        return "INVITE"
      case "new_public_org":
        return "NEW ORG"
      case "friend_request":
        return "FRIEND REQ"
      case "friend_request_accepted":
        return "ACCEPTED"
      default:
        return type.replace("_", " ").toUpperCase()
    }
  }

  // Update the handleNotificationClick function
  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      // Mark as read - IMPORTANT: Pass the type parameter
      dismissNotification(notification.id, notification.type)
      
      // Navigate based on notification type
      if (notification.type === "friend_request" && notification.fromUserId) {
        // Navigate to the friend's profile page to accept/reject
        router.push(`/friends/${notification.fromUserId}`)
      } else if (notification.type === "friend_request_accepted" && notification.fromUserId) {
        // Navigate to the friend's profile page
        router.push(`/friends/${notification.fromUserId}`)
      } else if (notification.type === "added_to_group") {
        // Navigate to organisations page (correct spelling)
        router.push("/organisations")
      } else if (notification.type === "new_public_org") {
        // Navigate to organisations page (correct spelling)
        router.push("/organisations")
      }
    },
    [dismissNotification, router]
  )
  // Search placeholder
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

  async function sendFriendRequest(toUid: string, fromName?: string) {
  const auth = getAuth()
  const user = auth.currentUser
  if (!user) throw new Error("Not authenticated")

  const db = getDatabase()
  const reqRef = dbPush(dbRef(db, "friendRequests"))
  const requestId = reqRef.key!

  // 1) Create request
  await dbSet(reqRef, {
    fromUid: user.uid,
    toUid,
    status: "pending",
    createdAt: Date.now(),
  })

  // 2) Notify receiver
  const notifRef = dbPush(dbRef(db, `users/${toUid}/notifications`))
  await dbSet(notifRef, {
    type: "friend_request",
    message: `${fromName || "Someone"} sent you a friend request`,
    fromUserId: user.uid,
    requestId,
    timestamp: Date.now(),
  })

  return requestId
}

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-sidebar border-b border-sidebar-border text-sidebar-foreground">
      <div className="flex h-full items-center justify-between px-4">
        {/* Left: Sidebar + Title */}
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8" />
          <div className="flex items-center gap-2">
            <Link
              href={pageInfo.href}
              className="flex items-center gap-2 font-semibold hover:underline underline-offset-4"
            >
              <Image
                src="/header-logo.png"        
                alt="Smart Student Handbook"
                width={60}                 
                height={40}
                priority
                className="h-10 w-auto"
              />
              <span className="hidden sm:inline">Smart Student Handbook</span>
            </Link>
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

        {/* Right: Notifications & User */}
        <div className="flex items-center gap-1">
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative h-8 w-8">
                <Bell className="h-4 w-4" />
                {!loadingNotifications && notifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] bg-blue-500 text-white">
                    {notifications.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-96 mr-2" align="end">
              <div className="p-3">
                <h4 className="font-medium mb-3 text-sm">
                  {loadingNotifications ? "Loading…" : "Today's Schedule & Updates"}
                </h4>

                {loadingNotifications ? (
                  <div className="animate-pulse space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-4 bg-muted rounded" />
                    ))}
                  </div>
                ) : notifications.length ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start gap-3 p-3 hover:bg-muted rounded-md border border-border/50 cursor-pointer transition-colors"
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div className="mt-1">{getNotificationIcon(n.type)}</div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-tight">
                              {getNotificationTitle(n.type, formatNotificationTitle(n.title, n.type))}
                            </p>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation() // Prevent triggering the notification click
                                dismissNotification(n.id, n.type)
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                              {getNotificationTypeDisplay(n.type)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{n.time}</span>
                          </div>

                          {n.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed">{n.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Bell className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No notifications today</p>
                  </div>
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
                    {user?.displayName?.[0] || user?.email?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mr-2" align="end">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || "User"} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {user?.displayName?.[0] || user?.email?.[0] || "U"}
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
              <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive">
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
