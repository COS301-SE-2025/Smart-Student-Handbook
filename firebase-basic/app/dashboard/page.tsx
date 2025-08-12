"use client"

import Link from "next/link"
import { useState, useEffect, useCallback, useMemo } from "react"
import { format, isSameDay } from "date-fns"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
import { CreateOrganizationModal } from "@/components/ui/create-organization-modal"
import { httpsCallable } from "firebase/functions"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { getDatabase, ref, get, onValue } from "firebase/database"
import { fns } from "@/lib/firebase"
import { useUserId } from "@/hooks/useUserId"
import { Calendar, FileText, Heart, Plus, Share2, Star, Users, Lock, Globe } from "lucide-react"
import { toast } from "sonner"

/* --------------------------- Shared types --------------------------- */

type Org = {
  id: string
  ownerId: string
  name: string
  description: string
  isPrivate: boolean
  image?: string
  members: Record<string, "Admin" | "Member">
  createdAt?: number
}

type CreateOrgInput = {
  name: string
  description: string
  isPrivate: boolean
  image?: string
  invitedUserIds: string[]
}

type EventType = "exam" | "assignment" | "reminder" | "class"

type Event = {
  id: string
  title: string
  description?: string
  date: string | Date
  type: EventType
  time?: string
  endTime?: string
  semesterId?: string
}

type LectureSlot = {
  id: string
  subject: string
  lecturer: string
  room: string
  dayOfWeek: number
  startTime: string
  endTime: string
  semesterId: string
  // legacy fields
  timeSlot?: string
  duration?: number
}

type Semester = {
  id: string
  name: string
  startDate: string | Date
  endDate: string | Date
  isActive: boolean
}

/* ---------------------- Utility helpers ---------------------- */

const callFn = <TReq, TRes>(name: string, data: TReq) =>
  httpsCallable<TReq, TRes>(fns, name)(data).then((r) => r.data)

const timeToMinutes = (t?: string) => {
  if (!t) return null
  const [h, m] = t.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

const normalizeLecture = (raw: any): LectureSlot => {
  if (raw.startTime && raw.endTime) return raw as LectureSlot
  const start = raw.timeSlot as string
  const dur = (raw.duration as number) ?? 50
  const startM = timeToMinutes(start) ?? 0
  const end = `${String(Math.floor((startM + dur) / 60)).padStart(2, "0")}:${String((startM + dur) % 60).padStart(2, "0")}`
  return { ...raw, startTime: start, endTime: end } as LectureSlot
}

/* ---------------------- Static placeholders ---------------------- */

const notebooks = [
  { title: "COS301 Computer Science Fundamentals", tag: "LECTURE", tagType: "important", timestamp: "Today at 2:30PM", likes: 1 },
  { title: "COS701 AI & Machine Learning Concepts", tag: "RESEARCH", tagType: "", timestamp: "Yesterday", likes: 1 },
  { title: "COS221 Database System Architecture", tag: "LECTURE", tagType: "", timestamp: "2 days ago", likes: 1 },
  { title: "COS301 Software Engineering Principles", tag: "EXAM", tagType: "important", timestamp: "1 week ago", likes: 1 },
]

const friends = [
  { name: "Ndhlovu Tanaka", role: "Student" },
  { name: "Takudzwa Magunda", role: "Lecturer" },
]

/* ---------------------------------------------------------------- */

export default function DashboardPage() {
  const { userId } = useUserId()

  /* ---------------- Welcome name ---------------- */
  const [userName, setUserName] = useState<string>("")
  useEffect(() => {
    const auth = getAuth()
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return
      const raw = user.displayName || user.email?.split("@")[0] || "Student"
      setUserName(raw.charAt(0).toUpperCase() + raw.slice(1))
    })
    return unsub
  }, [])

  /* --------------- Organisations --------------- */
  const [organizations, setOrganizations] = useState<(Org & { joined: boolean; role?: string })[]>([])
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const getMyOrgs = useMemo(() => httpsCallable<{}, Org[]>(fns, "getUserOrganizations"), [])
  const createOrg = useMemo(
    () => httpsCallable<{ organization: CreateOrgInput }, Org>(fns, "createOrganization"),
    [],
  )
  const db = getDatabase()

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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load organisations"
      toast.error(msg)
      setOrganizations([])
    } finally {
      setLoadingOrgs(false)
    }
  }, [userId, getMyOrgs, db])

  useEffect(() => {
    fetchOrganizations()
  }, [fetchOrganizations])

  const sortedOrganizations = useMemo(() => {
    return [...organizations].sort((a, b) => {
      if (favorites[a.id] && !favorites[b.id]) return -1
      if (!favorites[a.id] && favorites[b.id]) return 1
      return a.name.localeCompare(b.name)
    })
  }, [organizations, favorites])

  /* --------------- Upcoming events --------------- */
  const [upcoming, setUpcoming] = useState<Array<{ id: string; title: string; type: EventType | "lecture"; date: string; time?: string }>>([])

  const fetchTodayAgenda = useCallback(async () => {
    if (!userId) return
    const today = new Date()
    try {
      const sems = await callFn<{}, Semester[]>("getSemesters", {})
      const semesters = (sems || []).map((s) => ({
        ...s,
        startDate: new Date(s.startDate as any),
        endDate: new Date(s.endDate as any),
      }))
      const active = semesters.find((s) => s.isActive) || null

      const calls: Array<Promise<any>> = [
        callFn<{ semesterId: string }, Event[]>("getEvents", { semesterId: "personal" }),
      ]
      if (active) {
        calls.push(callFn<{ semesterId: string }, Event[]>("getEvents", { semesterId: active.id }))
        calls.push(callFn<{ semesterId: string }, LectureSlot[]>("getLectures", { semesterId: active.id }))
      }

      const [personalEvents, semEvents = [], lectures = []] = await Promise.all(calls)

      const allEvents: Event[] = [...(personalEvents || []), ...(semEvents as Event[])].map((ev) => ({
        ...ev,
        date: new Date(ev.date),
      }))

      const todaysEvents = allEvents.filter((ev) => isSameDay(ev.date as Date, today))
      const todaysLectures: LectureSlot[] = (lectures as LectureSlot[]).map(normalizeLecture).filter((l) => l.dayOfWeek === today.getDay())

      const merged: typeof upcoming = []
      todaysEvents.forEach((ev) => {
        merged.push({
          id: `evt-${ev.id}`,
          title: ev.title,
          type: ev.type,
          date: format(today, "EEE, d MMM"),
          time: ev.time,
        })
      })
      todaysLectures.forEach((lec) => {
        merged.push({
          id: `lec-${lec.id}`,
          title: lec.subject,
          type: "lecture",
          date: format(today, "EEE, d MMM"),
          time: lec.startTime,
        })
      })

      merged.sort((a, b) => {
        const am = timeToMinutes(a.time) ?? 1e9
        const bm = timeToMinutes(b.time) ?? 1e9
        return am - bm
      })

      setUpcoming(merged)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load today's events"
      toast.error(msg)
      setUpcoming([])
    }
  }, [userId])

  useEffect(() => {
    fetchTodayAgenda()
  }, [fetchTodayAgenda])

  /* --------------- Study hours (metrics) --------------- */
  const [totalStudyHours, setTotalStudyHours] = useState(0)
  const [thisWeekHours, setThisWeekHours] = useState(0)
  const [dailyBars, setDailyBars] = useState<number[]>([])

  useEffect(() => {
    if (!userId) return
    const db = getDatabase()
    const metricsRef = ref(db, `users/${userId}/metrics`)
    const dailyRef = ref(db, `users/${userId}/metrics/daily`)

    let latestTodayDate = ""
    let latestTodaySeconds = 0

    const offMetrics = onValue(metricsRef, (snap) => {
      const v = snap.val() || {}
      setTotalStudyHours(Number(v.totalStudyHours || 0))
      setThisWeekHours(Number(v.thisWeekHours || 0))
      latestTodayDate = v.todayDate || ""
      latestTodaySeconds = Number(v.todaySeconds || 0)
      // fallback if no daily series yet
      setDailyBars((prev) => {
        if (prev.length === 7) return prev
        return [0, 0, 0, 0, 0, 0, Number((latestTodaySeconds / 3600).toFixed(2))]
      })
    })

    const offDaily = onValue(dailyRef, (snap) => {
      const obj = snap.val() as Record<string, number | { seconds?: number; hours?: number }> | null
      const days: number[] = []
      const today = new Date()
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        const key = format(d, "yyyy-MM-dd")
        let hours = 0
        if (obj && obj[key] != null) {
          const v = obj[key] as any
          hours = typeof v === "number" ? v : v.hours ?? (v.seconds ?? 0) / 3600
        } else if (key === latestTodayDate) {
          hours = latestTodaySeconds / 3600
        }
        days.push(Number(hours.toFixed(2)))
      }
      setDailyBars(days)
    })

    return () => {
      offMetrics()
      offDaily()
    }
  }, [userId])

  /* --------------- Create organisation --------------- */
  const handleCreateOrganization = async (data: {
    name: string
    description: string
    isPrivate: boolean
    selectedFriends: string[]
    organizationImage?: string
  }) => {
    try {
      await createOrg({
        organization: {
          name: data.name,
          description: data.description,
          isPrivate: data.isPrivate,
          image: data.organizationImage,
          invitedUserIds: data.selectedFriends,
        },
      })
      setShowCreateModal(false)
      await fetchOrganizations()
      toast.success("Organization created")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create organization"
      toast.error(msg)
    }
  }

  /* ------------------------ Render ------------------------ */

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={`Welcome ${userName}`} description="Here’s an overview of your notebooks, study buddies, events, and more." />

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Notebooks */}
          <div className="col-span-1 bg-card p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">My Notebooks</h2>
              <div className="flex gap-2">
                <Link href="/notes"><Button variant="ghost" size="icon"><Plus className="h-5 w-5" /></Button></Link>
                <Button variant="ghost" size="sm">Filter</Button>
                <Button variant="ghost" size="sm">Sort</Button>
                <Button variant="ghost" size="sm">Tags</Button>
              </div>
            </div>

            <div className="space-y-4">
              {notebooks.map((nb) => (
                <Link href="/notes" key={`${nb.title}-${nb.timestamp}`}>
               <div className="border-b py-3 hover:bg-muted/50 transition-colors rounded-md px-2">
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{nb.title}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon"><FileText className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon"><Star className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${nb.tagType === "important" ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"}`}>{nb.tag}</span>
                        <span>{nb.timestamp}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Button variant="ghost" size="sm" className="text-muted-foreground h-8"><Heart className="h-4 w-4 mr-1" />{nb.likes}</Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground h-8"><Share2 className="h-4 w-4 mr-1" /></Button>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Friends & Organisations */}
          <div className="col-span-1 space-y-6">
            {/* Friends */}
            <div className="bg-card p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Friends</h2>
                <Link href="#"><Button variant="ghost" size="icon"><Avatar className="h-6 w-6"><AvatarFallback>+</AvatarFallback></Avatar></Button></Link>
              </div>
              <div className="space-y-3">
                {friends.map((f) => (
                  <Link href="#" key={f.name}>
                    <div className="flex items-center justify-between hover:bg-muted/50 transition-colors p-3 rounded-md">
                      <div className="flex items-center gap-3">
                        <Avatar><AvatarFallback>{f.name.charAt(0)}</AvatarFallback></Avatar>
                        <div>
                          <p className="font-medium">{f.name}</p>
                          <p className="text-sm text-muted-foreground">{f.role}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon"><div className="flex gap-1"><span className="h-1 w-1 bg-muted-foreground rounded-full" /><span className="h-1 w-1 bg-muted-foreground rounded-full" /><span className="h-1 w-1 bg-muted-foreground rounded-full" /></div></Button>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Organisations */}
            <div className="bg-card p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">My Organisations</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(true)}><Plus className="h-5 w-5" /></Button>
              </div>

              <div className="space-y-3">
                {sortedOrganizations.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-3">You haven't joined any organisations</p>
                    <Link href="/organisations"><Button size="sm">Browse Organisations</Button></Link>
                  </div>
                ) : (
                  sortedOrganizations.slice(0, 3).map((org) => {
                    const memberCount = Object.keys(org.members).length
                    return (
                      <Link href={`/organisations/${org.id}`} key={org.id}>
                        <div className="border rounded-xl p-4 hover:shadow-md hover:border-primary/20 transition-all duration-200 bg-card">
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar className="h-10 w-10 border"><AvatarFallback className="text-sm font-medium bg-muted text-foreground">{org.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium truncate text-foreground">{org.name}</h3>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1"><div className="flex items-center gap-1"><Users className="h-3 w-3" /><span>{memberCount}</span></div><div className="flex items-center gap-1">{org.isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}<span>{org.isPrivate ? "Private" : "Public"}</span></div></div>
                            </div>
                            <Badge variant={org.role === "Admin" ? "default" : "secondary"} className="text-xs px-2 py-1">{org.role}</Badge>
                          </div>
                          {org.description && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{org.description}</p>}
                        </div>
                      </Link>
                    )
                  })
                )}
                {sortedOrganizations.length > 3 && (
                  <div className="text-center mt-4"><Link href="/organisations"><Button variant="outline" size="sm">View All Organisations</Button></Link></div>
                )}
              </div>
            </div>
          </div>

          {/* Upcoming & Study hours */}
          <div className="col-span-1 space-y-6">
            {/* Upcoming */}
            <div className="bg-card p-6 rounded-lg shadow-sm border">
              <h2 className="text-lg font-semibold mb-4">Upcoming Events</h2>
              <div className="space-y-3">
                {upcoming.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No items for today.</div>
                ) : (
                  upcoming.map((it) => (
                    <Link href="/calendar" key={it.id}>
                      <div className="flex items-center gap-3 hover:bg-muted/50 transition-colors p-3 rounded-md">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-md"><Calendar className="h-5 w-5" /></div>
                        <div><p className="font-medium">{it.title} {it.type}</p><p className="text-sm text-muted-foreground">{it.date}{it.time ? ` ${it.time}` : ""}</p></div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Study hours */}
            <div className="bg-card p-6 rounded-lg shadow-sm border">
              <h2 className="text-lg font-semibold mb-4">Total Study Hours</h2>
              <div className="flex items-end gap-3 h-24">
                {(dailyBars.length ? dailyBars : [0, 0, 0, 0, 0, 0, 0]).map((h, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2">
                    <div
                      className="bg-gradient-to-t from-blue-500 to-blue-400 w-8 rounded-t-md transition-all duration-300 hover:from-amber-600 hover:to-amber-500"
                      style={{ height: `${Math.max(h * 8, 8)}px` }}
                      title={`${h.toFixed(2)}h`}
                    />
                    <span className="text-xs text-muted-foreground">{h.toFixed(1)}h</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                {/* Prefer the daily series (7-day) so it's always consistent with the chart */}
                <p>Total this week: {dailyBars.reduce((a, b) => a + b, 0).toFixed(1)} hours</p>
                <p className="text-xs mt-1">All-time total: {totalStudyHours.toFixed(1)} hours</p>
              </div>
            </div>
          </div>
        </div>

        <CreateOrganizationModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onCreateOrganization={handleCreateOrganization}
        />
      </div>
    </div>
  )
}
