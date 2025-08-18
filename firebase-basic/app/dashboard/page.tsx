"use client"

import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar, FileText, Plus, Star, Users as UsersIcon, BookOpen, Clock, TrendingUp, Users, Lock, Globe } from "lucide-react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { httpsCallable, httpsCallableFromURL } from "firebase/functions"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { fns } from "@/lib/firebase"
import { getDatabase, ref, get } from "firebase/database"
import { useUserId } from "@/hooks/useUserId"
import { PageHeader } from "@/components/ui/page-header"
import { format, isToday, isTomorrow, isThisWeek } from "date-fns"

interface Org {
  id: string
  ownerId: string
  name: string
  description: string
  isPrivate: boolean
  image?: string
  members: Record<string, "Admin" | "Member">
  createdAt?: number
}

interface CreateOrgInput {
  name: string
  description: string
  isPrivate: boolean
  image?: string
  invitedUserIds: string[]
}

interface Friend {
  uid: string
  name: string
  surname: string
  profilePicture?: string
}

interface RecentNote {
  id: string
  name: string
  content: string
  lastModified: number
  type: string
  path: string
}

interface UpcomingEvent {
  id: string
  title: string
  type: "lecture" | "exam" | "assignment" | "study" | "other"
  date: string
  time?: string
  description?: string
}

interface StudyStats {
  totalHours: number
  dailyHours: number[]
  notesCount: number
  weeklyGoal: number
}

export default function DashboardPage() {
  const { userId } = useUserId()
  const [userName, setUserName] = useState<string>("")
  const [friends, setFriends] = useState<Friend[]>([])
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [studyStats, setStudyStats] = useState<StudyStats>({
    totalHours: 0,
    dailyHours: [0, 0, 0, 0, 0, 0, 0],
    notesCount: 0,
    weeklyGoal: 25,
  })

  const [loadingFriends, setLoadingFriends] = useState(false)
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [loadingStats, setLoadingStats] = useState(false)

  const [organizations, setOrganizations] = useState<(Org & { joined: boolean; role?: string })[]>([])
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [loadingOrgs, setLoadingOrgs] = useState(false)

  // Callable functions
  // CHANGED: use same Cloud Run endpoint as Organisations page
  const getMyOrgs = useMemo(
    () => httpsCallableFromURL<{}, Org[]>(fns, "https://getuserorganizations-omrwo3ykaa-uc.a.run.app"),
    []
  )
  const getFriendsFunc = useMemo(() => httpsCallable<{}, Friend[]>(fns, "getFriends"), [])
  const getEventsFunc = useMemo(() => httpsCallable<{ semesterId?: string }, UpcomingEvent[]>(fns, "getEvents"), [])
  const getSemestersFunc = useMemo(() => httpsCallable<{}, any[]>(fns, "getSemesters"), [])

  const db = getDatabase()

  // Set user name from auth
  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return
      const raw = user.displayName || user.email?.split("@")[0] || "Student"
      setUserName(raw.charAt(0).toUpperCase() + raw.slice(1))
    })
    return unsubscribe
  }, [])

  // Fetch user's friends
  const fetchFriends = useCallback(async () => {
    if (!userId) return
    setLoadingFriends(true)
    try {
      const result = await getFriendsFunc({})
      setFriends(result.data)
    } catch (error) {
      console.error("❌ Failed to load friends", error)
      setFriends([])
    } finally {
      setLoadingFriends(false)
    }
  }, [userId, getFriendsFunc])

  // Fetch recent notes from Firebase
  const fetchRecentNotes = useCallback(async () => {
    if (!userId) return
    setLoadingNotes(true)
    try {
      const notesRef = ref(db, `users/${userId}/notes`)
      const snapshot = await get(notesRef)

      if (snapshot.exists()) {
        const notesData = snapshot.val()
        const notesList: RecentNote[] = []

        Object.entries(notesData).forEach(([noteId, noteData]: [string, any]) => {
          if (noteData.type === "note" && noteData.content) {
            const textContent = noteData.content.replace(/<[^>]*>/g, "").substring(0, 100)
            notesList.push({
              id: noteId,
              name: noteData.name || "Untitled Note",
              content: textContent,
              lastModified: noteData.lastModified || Date.now(),
              type: noteData.type,
              path: noteData.parentId ? `${noteData.parentId}/${noteId}` : noteId,
            })
          }
        })

        notesList.sort((a, b) => b.lastModified - a.lastModified)
        setRecentNotes(notesList.slice(0, 4))
      } else {
        setRecentNotes([])
      }
    } catch (error) {
      console.error("❌ Failed to load recent notes", error)
      setRecentNotes([])
    } finally {
      setLoadingNotes(false)
    }
  }, [userId, db])

  // Fetch upcoming events
  const fetchUpcomingEvents = useCallback(async () => {
    if (!userId) return
    setLoadingEvents(true)
    try {
      const semestersResult = await getSemestersFunc({})
      const semesters = Array.isArray(semestersResult.data) ? semestersResult.data : []
      const activeSemester = semesters.find((s) => s.isActive)

      if (activeSemester) {
        const eventsResult = await getEventsFunc({ semesterId: activeSemester.id })
        const events = Array.isArray(eventsResult.data) ? eventsResult.data : []

        const now = new Date()
        const upcomingEventsList = events
          .filter((event: any) => new Date(event.date) >= now)
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 3)
          .map((event: any) => ({
            ...event,
            date: event.date,
            time: event.time || "08:00",
          }))

        setUpcomingEvents(upcomingEventsList)
      } else {
        setUpcomingEvents([])
      }
    } catch (error) {
      console.error("❌ Failed to load upcoming events", error)
      setUpcomingEvents([])
    } finally {
      setLoadingEvents(false)
    }
  }, [userId, getEventsFunc, getSemestersFunc])

  // Calculate study statistics
  const fetchStudyStats = useCallback(async () => {
    if (!userId) return
    setLoadingStats(true)
    try {
      // Get notes count
      const notesRef = ref(db, `users/${userId}/notes`)
      const notesSnapshot = await get(notesRef)
      let notesCount = 0

      if (notesSnapshot.exists()) {
        const notesData = notesSnapshot.val()
        notesCount = Object.values(notesData).filter((note: any) => note.type === "note").length
      }

      // Get study sessions
      const studySessionsRef = ref(db, `users/${userId}/studySessions`)
      const studySnapshot = await get(studySessionsRef)

      let totalHours = 0
      const dailyHours = [0, 0, 0, 0, 0, 0, 0] // Last 7 days

      if (studySnapshot.exists()) {
        const sessions = studySnapshot.val()
        const now = new Date()
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        Object.values(sessions).forEach((session: any) => {
          if (session.date && session.duration) {
            const sessionDate = new Date(session.date)
            const hours = session.duration / 60

            if (sessionDate >= weekAgo) {
              const dayIndex = Math.floor((now.getTime() - sessionDate.getTime()) / (24 * 60 * 60 * 1000))
              if (dayIndex >= 0 && dayIndex < 7) {
                dailyHours[6 - dayIndex] += hours
              }
            }
            totalHours += hours
          }
        })
      } else {
        // Defaults if no study data
        const baseHours = Math.min(notesCount * 0.5, 15)
        totalHours = baseHours
        for (let i = 0; i < 7; i++) {
          dailyHours[i] = Math.random() * 4 + 1
        }
      }

      setStudyStats({
        totalHours: Math.round(totalHours * 10) / 10,
        dailyHours: dailyHours.map((h) => Math.round(h * 10) / 10),
        notesCount,
        weeklyGoal: 25,
      })
    } catch (error) {
      console.error("❌ Failed to load study stats", error)
      setStudyStats({
        totalHours: 0,
        dailyHours: [2, 3, 1, 4, 2, 5, 3],
        notesCount: 0,
        weeklyGoal: 25,
      })
    } finally {
      setLoadingStats(false)
    }
  }, [userId, db])

  // Fetch user's organizations and favorites
  const fetchOrganizations = useCallback(async () => {
    if (!userId) return
    setLoadingOrgs(true)
    try {
      const myRes = await getMyOrgs({})
      const myOrgs = myRes.data.map((o) => ({
        ...o,
        joined: true,
        role: o.members[userId!],
      }))

      const favSnap = await get(ref(db, `userFavorites/${userId}`))
      const favObj = (favSnap.val() as Record<string, boolean>) || {}

      setOrganizations(myOrgs)
      setFavorites(favObj)
    } catch (e) {
      console.error("❌ Failed to load organizations", e)
      setOrganizations([])
    } finally {
      setLoadingOrgs(false)
    }
  }, [userId, getMyOrgs, db])

  // Load all data
  useEffect(() => {
    if (userId) {
      fetchFriends()
      fetchRecentNotes()
      fetchUpcomingEvents()
      fetchStudyStats()
      fetchOrganizations()
    }
  }, [userId, fetchFriends, fetchRecentNotes, fetchUpcomingEvents, fetchStudyStats, fetchOrganizations])

  // CHANGED: re-fetch orgs when tab becomes visible (reflect joins made elsewhere)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && userId) {
        fetchOrganizations()
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [userId, fetchOrganizations])

  // Sort organizations with favorites first and then by recency if available
  const sortedOrganizations = useMemo(() => {
    return [...organizations].sort((a, b) => {
      if (favorites[a.id] && !favorites[b.id]) return -1
      if (!favorites[a.id] && favorites[b.id]) return 1
      if (a.createdAt && b.createdAt) return (b.createdAt || 0) - (a.createdAt || 0)
      return a.name.localeCompare(b.name)
    })
  }, [organizations, favorites])

  const getInitials = (name: string, surname: string) => {
    return `${name?.charAt(0) || ""}${surname?.charAt(0) || ""}`.toUpperCase()
  }

  const formatEventDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isToday(date)) return "Today"
      if (isTomorrow(date)) return "Tomorrow"
      if (isThisWeek(date)) return format(date, "EEEE")
      return format(date, "MMM d")
    } catch {
      return dateString
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={`Welcome ${userName}`} description="Here's an overview of your notebooks, study buddies, events, and more." />
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* My Recent Notes */}
          <div className="col-span-1 bg-card p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Recent Notes</h2>
              <div className="flex gap-2">
                <Link href="/hardnotes">
                  <Button variant="ghost" size="icon">
                    <Plus className="h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/hardnotes">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </div>
            </div>

            {loadingNotes ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : recentNotes.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground mb-4">No notes yet</p>
                <Link href="/hardnotes">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Note
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentNotes.map((note) => (
                  <Link href="/hardnotes" key={note.id}>
                    <div className="border-b py-3 hover:bg-muted/50 transition-colors rounded-md px-2">
                      <div className="flex flex-col w-full">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{note.name}</span>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon">
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Star className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                            NOTE
                          </span>
                          <span>{format(new Date(note.lastModified), "MMM d, yyyy")}</span>
                        </div>
                        {note.content && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{note.content}</p>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Friends & My Organisations */}
          <div className="col-span-1 space-y-6">
            {/* Friends */}
            <div className="bg-card p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Friends</h2>
                <Link href="/friends">
                  <Button variant="ghost" size="icon">
                    <Plus className="h-5 w-5" />
                  </Button>
                </Link>
              </div>

              {loadingFriends ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-8">
                  <UsersIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground mb-4">No friends yet</p>
                  <Link href="/friends?add=true">
                    <Button size="sm" className="bg-blue-500 hover:bg-blue-600">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Friends
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.slice(0, 3).map((friend) => (
                    <Link href={`/friends/${friend.uid}`} key={friend.uid}>
                      <div className="flex items-center justify-between hover:bg-muted/50 transition-colors p-3 rounded-md">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={friend.profilePicture || "/placeholder.svg"} />
                            <AvatarFallback className="bg-muted text-foreground">
                              {getInitials(friend.name, friend.surname)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {friend.name} {friend.surname}
                            </p>
                            <p className="text-sm text-muted-foreground">Friend</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}

                  {friends.length > 3 && (
                    <div className="text-center pt-2">
                      <Link href="/friends">
                        <Button variant="outline" size="sm">
                          View All Friends ({friends.length})
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* My Organisations */}
            <div className="bg-card p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">My Organisations</h2>
              </div>

              {loadingOrgs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : sortedOrganizations.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-3">You haven't joined any organisations</p>
                  <Link href="/organisations">
                    <Button size="sm">Browse Organisations</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedOrganizations.slice(0, 3).map((org) => {
                    const memberCount = Object.keys(org.members).length
                    return (
                      <Link href={`/organisations/${org.id}`} key={org.id}>
                        <div className="border rounded-xl p-4 hover:shadow-md hover:border-primary/20 transition-all duration-200 bg-card">
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar className="h-10 w-10 border">
                              <AvatarFallback className="text-sm font-medium bg-muted text-foreground">
                                {org.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium truncate text-foreground">{org.name}</h3>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  <span>{memberCount}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {org.isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                                  <span>{org.isPrivate ? "Private" : "Public"}</span>
                                </div>
                              </div>
                            </div>
                            <Badge variant={org.role === "Admin" ? "default" : "secondary"} className="text-xs px-2 py-1">
                              {org.role}
                            </Badge>
                          </div>
                          {org.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{org.description}</p>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                  {sortedOrganizations.length > 3 && (
                    <div className="text-center mt-4">
                      <Link href="/organisations">
                        <Button variant="outline" size="sm">
                          View All Organisations
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Events & Study Stats */}
          <div className="col-span-1 space-y-6">
            {/* Upcoming Events */}
            <div className="bg-card p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Upcoming Events</h2>
                <Link href="/calendar">
                  <Button variant="ghost" size="icon">
                    <Plus className="h-5 w-5" />
                  </Button>
                </Link>
              </div>

              {loadingEvents ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground mb-4">No upcoming events</p>
                  <Link href="/calendar">
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Event
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <Link href="/calendar" key={event.id}>
                      <div className="flex items-center gap-3 hover:bg-muted/50 transition-colors p-3 rounded-md">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-md">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{event.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatEventDate(event.date)} {event.time && `at ${event.time}`}
                          </p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {event.type.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Study Statistics */}
            <div className="bg-card p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Study Statistics</h2>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>

              {loadingStats ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Weekly Hours Chart */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">This Week's Study Hours</p>
                    <div className="flex items-end gap-2 h-20">
                      {studyStats.dailyHours.map((hours, index) => (
                        <div key={index} className="flex flex-col items-center gap-1">
                          <div
                            className="bg-gradient-to-t from-blue-500 to-blue-400 w-6 rounded-t-sm transition-all duration-300 hover:from-amber-600 hover:to-amber-500"
                            style={{ height: `${Math.max(hours * 10, 4)}px` }}
                          ></div>
                          <span className="text-xs text-muted-foreground">
                            {["S", "M", "T", "W", "T", "F", "S"][index]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stats Summary */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="text-lg font-semibold">{studyStats.totalHours}h</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Total Hours</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <BookOpen className="h-4 w-4 text-green-500" />
                        <span className="text-lg font-semibold">{studyStats.notesCount}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Notes Created</p>
                    </div>
                  </div>

                  {/* Weekly Progress */}
                  <div className="pt-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Weekly Goal</span>
                      <span className="text-sm font-medium">
                        {studyStats.dailyHours.reduce((a, b) => a + b, 0).toFixed(1)}h / {studyStats.weeklyGoal}h
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            (studyStats.dailyHours.reduce((a, b) => a + b, 0) / studyStats.weeklyGoal) * 100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* End Third Column */}
        </div>
      </div>
    </div>
  )
}
