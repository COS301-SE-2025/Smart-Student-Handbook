"use client"

import { usePathname } from "next/navigation"
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
import { Search, Bell, User, Settings, LogOut, BarChart3, Calendar, BookOpen, Edit3, GraduationCap } from "lucide-react"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

export function SmartHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  // Today's academic notifications
  const [notifications] = useState([
    {
      id: 1,
      title: "COS301 Software Engineering",
      type: "lecture",
      time: "10:00 AM",
      description: "Design Patterns lecture in Room 2-14",
    },
    {
      id: 2,
      title: "Database Assignment Due",
      type: "assignment",
      time: "11:59 PM",
      description: "Submit ER diagram and SQL queries",
    },
    {
      id: 3,
      title: "Study Group: Machine Learning",
      type: "study",
      time: "2:00 PM",
      description: "Library study room B-12",
    },
  ])

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
        // Simulate user for development
        setUser({
            displayName: "Test User",
            email: "testuser@example.com"
        })
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user)
    })
    return () => unsubscribe()
  }, [])

  const handleSignOut = async () => {
    try {
      if (process.env.NODE_ENV === "development") {
        router.push("/")
        return
      }
      await signOut(auth)
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const getPageInfo = () => {
    switch (pathname) {
      case "/dashboard":
        return { title: "Dashboard", icon: <BarChart3 className="h-4 w-4" /> }
      case "/calendar":
        return { title: "Calendar", icon: <Calendar className="h-4 w-4" /> }
      case "/notes":
        return { title: "Library", icon: <BookOpen className="h-4 w-4" /> }
      case "/hardnotes":
        return { title: "Note Editor", icon: <Edit3 className="h-4 w-4" /> }
      case "/profile":
        return { title: "Settings", icon: <Settings className="h-4 w-4" /> }
      default:
        return { title: "Smart Student Handbook", icon: <GraduationCap className="h-4 w-4" /> }
    }
  }

  const pageInfo = getPageInfo()

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

  return (
    <header style={{backgroundColor : '#00c4fd'}} className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#07ccec] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex h-full items-center justify-between px-4">
        {/* Left: Sidebar trigger and page title */}
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8" />
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">{pageInfo.icon}</div>
            <h1 className="font-semibold text-foreground">{pageInfo.title}</h1>
          </div>
        </div>

        {/* Center: Search */}
        <div className="flex-1 max-w-md mx-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes, modules, flashcards..."
              className="pl-9 h-8 bg-muted/50 border-border focus:bg-background transition-colors"
            />
          </div>
        </div>

        {/* Right: Notifications and user */}
        <div className="flex items-center gap-1">
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative h-8 w-8">
                <Bell className="h-4 w-4" />
                {notifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] bg-destructive">
                    {notifications.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 mr-2" align="end">
              <div className="p-3">
                <h4 className="font-medium mb-3 text-sm">Today's Schedule</h4>
                <div className="space-y-2">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-start gap-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                    >
                      <div className="mt-2">{getNotificationIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium truncate">{notification.title}</p>
                          <span className="text-xs text-muted-foreground ml-2">{notification.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{notification.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
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
