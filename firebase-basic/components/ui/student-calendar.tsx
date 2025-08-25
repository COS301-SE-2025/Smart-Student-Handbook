"use client"

import * as React from "react"
import { format } from "date-fns"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CalendarDays,
  Clock,
  BookOpen,
  AlertCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings,
  Edit,
} from "lucide-react"
import { useUserId } from "@/hooks/useUserId"
import { toast } from "sonner"

const callFn = <TReq, TRes>(name: string, data: TReq) =>
  httpsCallable<TReq, TRes>(fns, name)(data).then((r) => r.data)

interface Event {
  id: string
  title: string
  description: string
  date: Date
  type: "exam" | "assignment" | "reminder" | "class"
  time?: string
  endTime?: string
  semesterId?: string
}

interface LectureSlot {
  id: string
  subject: string
  lecturer: string
  room: string
  dayOfWeek: number
  // new model
  startTime: string
  endTime: string
  semesterId: string
  // legacy (compat)
  timeSlot?: string
  duration?: number
}

interface Semester {
  id: string
  name: string
  startDate: Date
  endDate: Date
  isActive: boolean
}

/* -------------------------- Time utilities -------------------------- */
function timeToMinutes(t: string): number | null {
  if (!t) return null
  const parts = t.split(":")
  if (parts.length !== 2) return null
  const [h, m] = parts.map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}
function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}
function addMinutesHHMM(start: string, delta: number): string {
  const m = timeToMinutes(start)
  if (m == null) return start
  return minutesToHHMM(m + delta)
}
function calculateLectureEndTimeFromStartAndDuration(startTime: string, duration: number): string {
  return addMinutesHHMM(startTime, duration)
}
function findSlotIndexForTime(time: string, slots: { start: string; end: string }[]): number {
  const t = timeToMinutes(time) ?? 0
  for (let i = 0; i < slots.length; i++) {
    const s = timeToMinutes(slots[i].start) ?? 0
    const e = timeToMinutes(slots[i].end) ?? 0
    if (t >= s && t < e) return i
  }
  if ((timeToMinutes(slots[0].start) ?? 0) > t) return 0
  return Math.max(0, slots.length - 1)
}
function countSlotsCovered(start: string, end: string, slots: { start: string; end: string }[], startIndex: number) {
  const startM = timeToMinutes(start) ?? 0
  const endM = timeToMinutes(end) ?? startM
  let count = 0
  for (let i = startIndex; i < slots.length; i++) {
    const sM = timeToMinutes(slots[i].start) ?? 0
    const eM = timeToMinutes(slots[i].end) ?? 0
    const overlaps = sM < endM && eM > startM
    if (overlaps) count++
    if (sM >= endM) break
  }
  return Math.max(1, count)
}
/* ------------------------------------------------------------------- */

function CustomCalendarGrid({
  selectedDate,
  onDaySelect,
  onDayDoubleClick,
  getEventsForDate,
  getLecturesForDay,
}: {
  selectedDate: Date
  onDaySelect: (date: Date) => void
  onDayDoubleClick: (date: Date) => void
  getEventsForDate: (d: Date) => Event[]
  getLecturesForDay: (d: Date) => LectureSlot[]
}) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    const days: { date: Date; isCurrentMonth: boolean }[] = []

    const prevMonth = new Date(year, month - 1, 0)
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonth.getDate() - i), isCurrentMonth: false })
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ date: new Date(year, month, day), isCurrentMonth: true })
    }
    const remainingDays = 42 - days.length
    for (let day = 1; day <= remainingDays; day++) {
      days.push({ date: new Date(year, month + 1, day), isCurrentMonth: false })
    }
    return days
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") newDate.setMonth(prev.getMonth() - 1)
      else newDate.setMonth(prev.getMonth() + 1)
      return newDate
    })
  }

  const getDateClasses = (date: Date, isCurrentMonth: boolean) => {
    const base =
      "h-12 w-full flex items-center justify-center text-sm font-medium rounded-md transition-colors"
    if (!isCurrentMonth) return `${base} text-muted-foreground`

    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()
    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString()

    const events = getEventsForDate(date)
    const lectures = getLecturesForDay(date)
    const eventTypes = new Set([...events.map((e) => e.type), ...(lectures.length > 0 ? ["class"] : [])])

    let color = ""
    if (eventTypes.size > 1) {
      color = "bg-purple-100 border border-purple-300 text-purple-800 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300"
    } else if (eventTypes.has("exam")) {
      color = "bg-red-100 border border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300"
    } else if (eventTypes.has("assignment")) {
      color = "bg-blue-100 border border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300"
    } else if (eventTypes.has("reminder")) {
      color = "bg-yellow-100 border border-yellow-300 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700"
    } else if (eventTypes.has("class")) {
      color = "bg-green-100 border border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300"
    }

    const interactive = "cursor-pointer hover:bg-muted/50 hover:border-border border border-transparent"

    if (isSelected) return `${base} ${interactive} bg-primary text-primary-foreground border-primary`
    if (isToday)
      return `${base} ${interactive} bg-accent text-accent-foreground font-semibold border-2 border-primary ${color}`
    if (color) return `${base} ${interactive} ${color} font-semibold`
    return `${base} ${interactive} text-foreground`
  }

  const days = getDaysInMonth(currentMonth)

  return (
    <div className="w-full bg-card rounded-lg border border-border">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button onClick={() => navigateMonth("prev")} className="p-2 hover:bg-muted rounded-md transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">{format(currentMonth, "MMMM yyyy")}</h2>
        <button onClick={() => navigateMonth("next")} className="p-2 hover:bg-muted rounded-md transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => (
            <button
              key={index}
              onClick={() => day.isCurrentMonth && onDaySelect(day.date)}
              onDoubleClick={() => day.isCurrentMonth && onDayDoubleClick(day.date)}
              className={getDateClasses(day.date, day.isCurrentMonth)}
              disabled={!day.isCurrentMonth}
            >
              {day.date.getDate()}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StudentCalendar() {
  const { userId } = useUserId()

  const [date, setDate] = React.useState<Date>(new Date())
  const [events, setEvents] = React.useState<Event[]>([])
  const [lectureSlots, setLectureSlots] = React.useState<LectureSlot[]>([])
  const [semesters, setSemesters] = React.useState<Semester[]>([])
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isLectureDialogOpen, setIsLectureDialogOpen] = React.useState(false)
  const [isSemesterDialogOpen, setIsSemesterDialogOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = React.useState<string>("")
  const [timetableDate, setTimetableDate] = React.useState<Date>(new Date())
  const [currentTime, setCurrentTime] = React.useState<Date>(new Date())
  const [activeTab, setActiveTab] = React.useState<"calendar" | "timetable">("calendar")
  const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null)
  const [newEvent, setNewEvent] = React.useState({
    title: "",
    description: "",
    type: "reminder" as Event["type"],
    time: "",
    endTime: "",
  })
  const [newLecture, setNewLecture] = React.useState({
    subject: "",
    lecturer: "",
    room: "",
    dayOfWeek: 0,
    startTime: "",
    endTime: "",
  })
  const [newSemester, setNewSemester] = React.useState({
    name: "",
    startDate: "",
    endDate: "",
  })
  const [loading, setLoading] = React.useState(false)

  const lectureTimeSlots = [
    { start: "07:30", end: "08:20" },
    { start: "08:30", end: "09:20" },
    { start: "09:30", end: "10:20" },
    { start: "10:30", end: "11:20" },
    { start: "11:30", end: "12:20" },
    { start: "12:30", end: "13:20" },
    { start: "13:30", end: "14:20" },
    { start: "14:30", end: "15:20" },
    { start: "15:30", end: "16:20" },
    { start: "16:30", end: "17:20" },
    { start: "17:30", end: "18:20" },
  ]
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  React.useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const getActiveSemester = () => semesters.find((s) => s.isActive) || null
  const getSemesterForDate = (d: Date) => semesters.find((s) => d >= s.startDate && d <= s.endDate) || null

  const normalizeLecture = (raw: any): LectureSlot => {
    if (raw.startTime && raw.endTime) return raw as LectureSlot
    const start = raw.timeSlot as string
    const dur = (raw.duration as number) ?? 50
    const end = calculateLectureEndTimeFromStartAndDuration(start, dur)
    return { ...raw, startTime: start, endTime: end } as LectureSlot
  }

  const fetchLectures = React.useCallback(async () => {
    const active = getActiveSemester()
    if (!userId || !active) {
      setLectureSlots([])
      return
    }
    try {
      const data = await callFn<{ semesterId: string }, LectureSlot[]>("getLectures", { semesterId: active.id })
      setLectureSlots((data ?? []).map(normalizeLecture))
    } catch (err: any) {
      console.error("Failed to fetch lectures:", err)
      toast.error(err?.message ?? "Failed to fetch lectures")
      setLectureSlots([])
    }
  }, [userId, semesters])

  const fetchEvents = React.useCallback(async () => {
    if (!userId) {
      setEvents([])
      return
    }
    try {
      const active = getActiveSemester()
      const calls: Promise<any[]>[] = []
      calls.push(callFn<{ semesterId: string }, any[]>("getEvents", { semesterId: "personal" }))
      if (active) {
        calls.push(callFn<{ semesterId: string }, any[]>("getEvents", { semesterId: active.id }))
      }
      const results = await Promise.all(calls)
      const merged = results.flat().map((e) => ({ ...e, date: new Date(e.date) }))
      setEvents(merged)
    } catch (err: any) {
      console.error("Failed to fetch events:", err)
      toast.error(err?.message ?? "Failed to fetch events")
      setEvents([])
    }
  }, [userId, semesters])

  const fetchSemesters = React.useCallback(async () => {
    if (!userId) return
    try {
      const data = await callFn<{}, any[]>("getSemesters", {})
      if (data && data.length > 0) {
        setSemesters(data.map((s) => ({ ...s, startDate: new Date(s.startDate), endDate: new Date(s.endDate) })))
      } else {
        const defaultSemester = { name: "Semester 1 2025", startDate: "2025-02-10", endDate: "2025-06-21" }
        const addedSemester = await callFn<{ semester: any }, any>("addSemester", { semester: defaultSemester })
        await callFn<{ semesterId: string }, { success: boolean }>("setActiveSemester", { semesterId: addedSemester.id })
        setSemesters([
          { ...addedSemester, startDate: new Date(addedSemester.startDate), endDate: new Date(addedSemester.endDate), isActive: true },
        ])
        toast.success("Default semester created and activated")
      }
    } catch (err: any) {
      console.error("Failed to fetch semesters:", err)
      toast.error(err?.message ?? "Failed to fetch semesters")
    }
  }, [userId])

  React.useEffect(() => {
    const init = async () => {
      if (!userId) return
      await fetchSemesters()
    }
    init()
  }, [userId, fetchSemesters])

  React.useEffect(() => {
    if (!userId || semesters.length === 0) {
      if (userId) fetchEvents()
      return
    }
    fetchLectures()
    fetchEvents()
  }, [userId, semesters, fetchLectures, fetchEvents])

  /** Tabs change: show toast if timetable has no active semester */
  const handleTabChange = (v: "calendar" | "timetable") => {
    setActiveTab(v)
    if (v === "timetable" && !getActiveSemester()) {
      toast.info("No active semester. Activate one in Manage Semesters.")
    }
  }

  const handleAddLecture = async () => {
    const semesterForDate = getSemesterForDate(timetableDate)
    if (!semesterForDate) {
      toast.error(`No semester covers ${format(timetableDate, "MMM d, yyyy")}. Please add one first.`)
      return
    }
    if (!newLecture.subject || !newLecture.startTime || !newLecture.endTime || !userId) return

    const startM = timeToMinutes(newLecture.startTime)
    const endM = timeToMinutes(newLecture.endTime)
    if (startM == null || endM == null) {
      toast.error("Invalid time format. Please use HH:MM.")
      return
    }
    if (startM >= endM) {
      toast.error("End time must be after the start time.")
      return
    }

    setLoading(true)
    try {
      const payload = {
        semesterId: semesterForDate.id,
        lecture: {
          subject: newLecture.subject,
          lecturer: newLecture.lecturer,
          room: newLecture.room,
          dayOfWeek: newLecture.dayOfWeek,
          // legacy
          timeSlot: newLecture.startTime,
          duration: endM - startM,
          // new
          startTime: newLecture.startTime,
          endTime: newLecture.endTime,
        },
      }
      const res = await callFn<typeof payload, LectureSlot>("addLecture", payload)
      const normalized = normalizeLecture(res)
      setLectureSlots((prev) => [...prev, normalized])
      setNewLecture({ subject: "", lecturer: "", room: "", dayOfWeek: 0, startTime: "", endTime: "" })
      setIsLectureDialogOpen(false)
      toast.success("Lecture added")
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add lecture")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLecture = async (id: string) => {
    if (!userId) return
    setLoading(true)
    try {
      await callFn<{ lectureId: string }, { success: boolean }>("deleteLecture", { lectureId: id })
      setLectureSlots((prev) => prev.filter((l) => l.id !== id))
      toast.success("Lecture deleted")
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete lecture")
    } finally {
      setLoading(false)
    }
  }

  const handleAddEvent = async () => {
    if (!selectedDate || !userId) return
    const hasStart = Boolean(newEvent.time)
    const hasEnd = Boolean(newEvent.endTime)
    if (hasEnd && !hasStart) {
      toast.error("Please set a start time before the end time.")
      return
    }
    if (hasStart && hasEnd) {
      const startM = timeToMinutes(newEvent.time!)
      const endM = timeToMinutes(newEvent.endTime!)
      if (startM == null || endM == null) {
        toast.error("Invalid time format. Please use HH:MM.")
        return
      }
      if (startM >= endM) {
        toast.error("End time must be after the start time.")
        return
      }
    }

    const semesterForDate = getSemesterForDate(selectedDate)
    const targetSemesterId = semesterForDate ? semesterForDate.id : "personal"

    if (!newEvent.title) return
    setLoading(true)
    try {
      const payload = { semesterId: targetSemesterId, event: { ...newEvent, date: selectedDate.toISOString() } }
      const res = await callFn<typeof payload, Event>("addEvent", payload)
      setEvents((prev) => [...prev, { ...res, date: new Date(res.date) }])
      setNewEvent({ title: "", description: "", type: "reminder", time: "", endTime: "" })
      setIsDialogOpen(false)
      toast.success("Event added")
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add event")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEvent = async (id: string) => {
    if (!userId) return
    setLoading(true)
    try {
      await callFn<{ eventId: string }, { success: boolean }>("deleteEvent", { eventId: id })
      setEvents((prev) => prev.filter((e) => e.id !== id))
      toast.success("Event deleted")
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete event")
    } finally {
      setLoading(false)
    }
  }

  const getEventsForDate = (d: Date) => events.filter((e) => e.date.toDateString() === d.toDateString())

  const getLecturesForDay = (d: Date) => {
    const semesterForDate = getSemesterForDate(d)
    if (!semesterForDate) return []
    const dayOfWeek = d.getDay()
    return lectureSlots
      .filter((l) => l.dayOfWeek === dayOfWeek && l.semesterId === semesterForDate.id)
      .map(normalizeLecture)
  }

  const isCurrentLectureSlot = (slotStart: string) => {
    const today = new Date()
    if (format(today, "yyyy/MM/dd") !== format(timetableDate, "yyyy/MM/dd")) return false
    const slot = lectureTimeSlots.find((s) => s.start === slotStart)
    if (!slot) return false
    const [sh, sm] = slot.start.split(":").map(Number)
    const [eh, em] = slot.end.split(":").map(Number)
    const begin = new Date(today)
    begin.setHours(sh, sm, 0, 0)
    const end = new Date(today)
    end.setHours(eh, em, 0, 0)
    return currentTime >= begin && currentTime <= end
  }

  const handleSelectDate = (d: Date) => {
    setSelectedDate(d)
    setDate(d)
    setTimetableDate(d)
  }

  const handleAddEventForDate = (d: Date) => {
    setSelectedDate(d)
    setDate(d)
    setTimetableDate(d)
    setIsDialogOpen(true)
  }

  const handleTimeSlotClick = (slotStart: string) => {
    const semesterForDate = getSemesterForDate(timetableDate)
    if (!semesterForDate) {
      toast.error(
        `No semester covers ${format(timetableDate, "MMM d, yyyy")}. Please add a semester in Manage Semesters.`,
      )
      return
    }
    setSelectedTimeSlot(slotStart)
    setNewLecture({
      ...newLecture,
      startTime: slotStart,
      endTime: addMinutesHHMM(slotStart, 50),
      dayOfWeek: timetableDate.getDay(),
    })
    setIsLectureDialogOpen(true)
  }

  const handleAddSemester = async () => {
    if (!newSemester.name || !newSemester.startDate || !newSemester.endDate || !userId) return
    setLoading(true)
    try {
      const addedSemester = await callFn<{ semester: any }, Semester>("addSemester", {
        semester: { name: newSemester.name, startDate: newSemester.startDate, endDate: newSemester.endDate },
      })
      setSemesters((prev) => [
        ...prev,
        { ...addedSemester, startDate: new Date(addedSemester.startDate), endDate: new Date(addedSemester.endDate) },
      ])
      setNewSemester({ name: "", startDate: "", endDate: "" })
      toast.success("Semester added")
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add semester")
    } finally {
      setLoading(false)
    }
  }

  const handleEditSemester = (semester: Semester) => {
    setEditingSemester(semester)
    setNewSemester({
      name: semester.name,
      startDate: format(semester.startDate, "yyyy-MM-dd"),
      endDate: format(semester.endDate, "yyyy-MM-dd"),
    })
  }

  const handleUpdateSemester = async () => {
    if (!editingSemester || !newSemester.name || !newSemester.startDate || !newSemester.endDate || !userId) return
    setLoading(true)
    try {
      const semesterData = {
        id: editingSemester.id,
        name: newSemester.name,
        startDate: newSemester.startDate,
        endDate: newSemester.endDate,
      }
      await callFn<{ semester: any }, { success: boolean; semester: any }>("updateSemester", { semester: semesterData })
      setSemesters((prev) =>
        prev.map((s) =>
          s.id === editingSemester.id
            ? { ...s, name: semesterData.name, startDate: new Date(semesterData.startDate), endDate: new Date(semesterData.endDate) }
            : s,
        ),
      )
      setEditingSemester(null)
      setNewSemester({ name: "", startDate: "", endDate: "" })
      toast.success("Semester updated")
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update semester")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSemester = async (id: string) => {
    if (!userId) return
    setLoading(true)
    try {
      await callFn<{ semesterId: string }, { success: boolean }>("deleteSemester", { semesterId: id })
      setSemesters((prev) => prev.filter((s) => s.id !== id))
      toast.success("Semester deleted")
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete semester")
    } finally {
      setLoading(false)
    }
  }

  const handleActivateSemester = async (id: string) => {
    if (!userId) return
    setLoading(true)
    try {
      await callFn<{ semesterId: string }, { success: boolean }>("setActiveSemester", { semesterId: id })
      setSemesters((prev) => prev.map((s) => ({ ...s, isActive: s.id === id })))
      toast.success("Semester activated")
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to activate semester")
    } finally {
      setLoading(false)
    }
  }

  const navigateTimetableDate = (dir: "prev" | "next") =>
    setTimetableDate((d) => {
      const nd = new Date(d)
      nd.setDate(d.getDate() + (dir === "next" ? 1 : -1))
      return nd
    })


  const isPersonalSelectedDate = selectedDate != null && !getSemesterForDate(selectedDate as Date)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {loading && <div className="text-primary text-sm">Loading...</div>}

        <header className="bg-card rounded-lg border border-border p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground">Student Calendar</h1>
            <p className="text-muted-foreground mt-1">Manage your academic schedule and events</p>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as "calendar" | "timetable")} className="w-full lg:w-auto">
              <TabsList className="grid w-full grid-cols-2 lg:w-auto">
                <TabsTrigger value="calendar">Calendar View</TabsTrigger>
                <TabsTrigger value="timetable">Daily Timetable</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex gap-3 justify-center lg:justify-end">
              <Button variant="outline" onClick={() => setIsSemesterDialogOpen(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Manage Semesters
              </Button>
              {activeTab === "timetable" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!getActiveSemester()) {
                      toast.info("No active semester. Activate one in Manage Semesters.")
                      return
                    }
                    setIsLectureDialogOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lecture
                </Button>
              )}
            </div>
          </div>
        </header>

        {activeTab === "calendar" && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* LEFT: calendar + EVENTS FOR SELECTED DAY */}
            <div className="xl:col-span-3 space-y-6">
              <CustomCalendarGrid
                selectedDate={date}
                onDaySelect={handleSelectDate}
                onDayDoubleClick={handleAddEventForDate}
                getEventsForDate={getEventsForDate}
                getLecturesForDay={getLecturesForDay}
              />

              {/* Moved here: Events grid (selected day details) */}
              <DateEventsCard
                date={date}
                getEventsForDate={getEventsForDate}
                getLecturesForDay={getLecturesForDay}
                lectureTimeSlots={lectureTimeSlots}
                getEventTypeIcon={getEventTypeIcon}
                getEventTypeColor={getEventTypeColor}
                handleDeleteEvent={handleDeleteEvent}
                handleDeleteLecture={handleDeleteLecture}
              />
            </div>

            {/* RIGHT: Event Types legend + Current Semester */}
            <div className="space-y-6">
              <EventTypesCard />
              <CurrentSemesterCard
                getActiveSemester={getActiveSemester}
                getLecturesForDay={getLecturesForDay}
                setIsSemesterDialogOpen={setIsSemesterDialogOpen}
              />
            </div>
          </div>
        )}

        {activeTab === "timetable" && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {getActiveSemester() ? `Lecture Timetable – ${getActiveSemester()!.name}` : "Lecture Timetable – No Active Semester"}
                </CardTitle>
                <NavigationBar
                  timetableDate={timetableDate}
                  navigate={navigateTimetableDate}
                  resetToday={() => setTimetableDate(new Date())}
                />
              </div>
            </CardHeader>
            <CardContent>
              {!getActiveSemester() ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Active Semester</h3>
                  <p className="text-muted-foreground mb-4">Please activate a semester to view and manage lectures.</p>
                  <Button onClick={() => setIsSemesterDialogOpen(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Semesters
                  </Button>
                </div>
              ) : (
                <div className="space-y-1 max-h-[600px] overflow-y-auto">
                  {lectureTimeSlots.map((slot, slotIndex) => {
                    const lecturesForDay = getLecturesForDay(timetableDate)
                    const lecturesStartingHere = lecturesForDay.filter((l) => findSlotIndexForTime(l.startTime, lectureTimeSlots) === slotIndex)
                    const isCoveredByEarlierLecture = lecturesForDay.some((lecture) => {
                      const startIdx = findSlotIndexForTime(lecture.startTime, lectureTimeSlots)
                      if (startIdx >= slotIndex) return false
                      const slotStartM = timeToMinutes(slot.start) ?? 0
                      const slotEndM = timeToMinutes(slot.end) ?? 0
                      const lectureStartM = timeToMinutes(lecture.startTime) ?? 0
                      const lectureEndM = timeToMinutes(lecture.endTime) ?? 0
                      return lectureStartM < slotEndM && lectureEndM > slotStartM
                    })
                    const currentSlot = isCurrentLectureSlot(slot.start)
                    if (isCoveredByEarlierLecture) return null
                    return (
                      <TimeSlotRow
                        key={slot.start}
                        slot={slot}
                        slotIndex={slotIndex}
                        isCurrent={currentSlot}
                        lectures={lecturesStartingHere}
                        onDeleteLecture={handleDeleteLecture}
                        onClick={() => handleTimeSlotClick(slot.start)}
                        lectureTimeSlots={lectureTimeSlots}
                      />
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <EventDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          selectedDate={selectedDate}
          newEvent={newEvent}
          setNewEvent={setNewEvent}
          handleAddEvent={handleAddEvent}
          isPersonalDate={isPersonalSelectedDate}
        />

        <LectureDialog
          open={isLectureDialogOpen}
          onOpenChange={setIsLectureDialogOpen}
          daysOfWeek={daysOfWeek}
          lectureTimeSlots={lectureTimeSlots}
          newLecture={newLecture}
          setNewLecture={setNewLecture}
          selectedTimeSlot={selectedTimeSlot}
          handleAddLecture={handleAddLecture}
        />

        <SemesterDialog
          open={isSemesterDialogOpen}
          onOpenChange={setIsSemesterDialogOpen}
          semesters={semesters}
          newSemester={newSemester}
          setNewSemester={setNewSemester}
          editingSemester={editingSemester}
          setEditingSemester={setEditingSemester}
          handleAddSemester={handleAddSemester}
          handleUpdateSemester={handleUpdateSemester}
          handleEditSemester={handleEditSemester}
          handleDeleteSemester={handleDeleteSemester}
          handleActivateSemester={handleActivateSemester}
        />
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm min-w-0">
      <div className={`w-3 h-3 rounded ${color} flex-shrink-0`} />
      <span className="text-foreground whitespace-normal break-words leading-tight">{label}</span>
    </div>
  )
}

function EventTypesCard() {
  return (
    <Card>
      <CardContent className="p-4">
        <h4 className="font-medium mb-3 text-sm text-foreground">Event Types</h4>
        <div className="flex flex-col gap-2">
          <LegendDot color="bg-red-100 border border-red-300 dark:bg-red-900/30 dark:border-red-700" label="Exams" />
          <LegendDot color="bg-blue-100 border border-blue-300 dark:bg-blue-900/30 dark:border-blue-700" label="Assignments" />
          <LegendDot color="bg-yellow-100 border border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700" label="Reminders" />
          <LegendDot color="bg-green-100 border border-green-300 dark:bg-green-900/30 dark:border-green-700" label="Classes" />
        </div>
        <div className="mt-3 pt-3 border-t border-border">
          <LegendDot color="bg-purple-100 border border-purple-300 dark:bg-purple-900/30 dark:border-purple-700" label="Multiple types" />
        </div>
      </CardContent>
    </Card>
  )
}

function DateEventsCard({
  date,
  getEventsForDate,
  getLecturesForDay,
  lectureTimeSlots,
  getEventTypeIcon,
  getEventTypeColor,
  handleDeleteEvent,
  handleDeleteLecture,
}: {
  date: Date | undefined
  getEventsForDate: (d: Date) => Event[]
  getLecturesForDay: (d: Date) => LectureSlot[]
  lectureTimeSlots: { start: string; end: string }[]
  getEventTypeIcon: (t: Event["type"]) => React.ReactNode
  getEventTypeColor: (t: Event["type"]) => string
  handleDeleteEvent: (id: string) => void
  handleDeleteLecture: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="h-5 w-5" />
          {date ? format(date, "MMM d, yyyy") : "Select a date"}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="min-h-[200px] max-h-[300px] overflow-y-auto">
          {date && (getEventsForDate(date).length || getLecturesForDay(date).length) ? (
            <div className="space-y-3">
              {getLecturesForDay(date).map((lec) => (
                <LectureChip key={lec.id} lecture={lec} handleDelete={() => handleDeleteLecture(lec.id)} />
              ))}
              {getEventsForDate(date).map((evt) => (
                <EventChip
                  key={evt.id}
                  event={evt}
                  getEventTypeIcon={getEventTypeIcon}
                  getEventTypeColor={getEventTypeColor}
                  handleDelete={() => handleDeleteEvent(evt.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState message={date ? "No events or lectures for this date" : "Select a date to view events"} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CurrentSemesterCard({
  getActiveSemester,
  getLecturesForDay,
  setIsSemesterDialogOpen,
}: {
  getActiveSemester: () => Semester | null
  getLecturesForDay: (d: Date) => LectureSlot[]
  setIsSemesterDialogOpen: (open: boolean) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Current Semester</CardTitle>
        <p className="text-sm text-muted-foreground">{getActiveSemester()?.name || "No active semester"}</p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {getActiveSemester() ? (
          <>
            <div className="space-y-2">
              <InfoRow label="Start:" value={format(getActiveSemester()!.startDate, "MMM d, yyyy")} />
              <InfoRow label="End:" value={format(getActiveSemester()!.endDate, "MMM d, yyyy")} />
            </div>
            <div className="border-t border-border pt-4">
              <h4 className="font-medium text-sm mb-3 text-foreground">Today's Lectures</h4>
              <div className="min-h-[100px] max-h-[150px] overflow-y-auto space-y-2">
                {getLecturesForDay(new Date()).length ? (
                  getLecturesForDay(new Date()).map((lec) => <LectureToday key={lec.id} lecture={lec} />)
                ) : (
                  <EmptyState message="No lectures today" small />
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">No active semester selected</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsSemesterDialogOpen(true)
                toast.info("Open Manage Semesters to create or activate a semester.")
              }}
              className="text-xs"
            >
              Manage Semesters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


function Sidebar({
  date,
  getEventsForDate,
  getLecturesForDay,
  lectureTimeSlots,
  getEventTypeIcon,
  getEventTypeColor,
  handleDeleteEvent,
  handleDeleteLecture,
  getActiveSemester,
  setIsSemesterDialogOpen,
}: {
  date: Date | undefined
  getEventsForDate: (d: Date) => Event[]
  getLecturesForDay: (d: Date) => LectureSlot[]
  lectureTimeSlots: { start: string; end: string }[]
  getEventTypeIcon: (t: Event["type"]) => React.ReactNode
  getEventTypeColor: (t: Event["type"]) => string
  handleDeleteEvent: (id: string) => void
  handleDeleteLecture: (id: string) => void
  getActiveSemester: () => Semester | null
  setIsSemesterDialogOpen: (open: boolean) => void
}) {
  return (
    <div className="xl:col-span-1 space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5" />
            {date ? format(date, "MMM d, yyyy") : "Select a date"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="min-h-[200px] max-h-[300px] overflow-y-auto">
            {date && (getEventsForDate(date).length || getLecturesForDay(date).length) ? (
              <div className="space-y-3">
                {getLecturesForDay(date).map((lec) => (
                  <LectureChip key={lec.id} lecture={lec} handleDelete={() => handleDeleteLecture(lec.id)} />
                ))}
                {getEventsForDate(date).map((evt) => (
                  <EventChip
                    key={evt.id}
                    event={evt}
                    getEventTypeIcon={getEventTypeIcon}
                    getEventTypeColor={getEventTypeColor}
                    handleDelete={() => handleDeleteEvent(evt.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message={date ? "No events or lectures for this date" : "Select a date to view events"} />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Current Semester</CardTitle>
          <p className="text-sm text-muted-foreground">{getActiveSemester()?.name || "No active semester"}</p>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {getActiveSemester() ? (
            <>
              <div className="space-y-2">
                <InfoRow label="Start:" value={format(getActiveSemester()!.startDate, "MMM d, yyyy")} />
                <InfoRow label="End:" value={format(getActiveSemester()!.endDate, "MMM d, yyyy")} />
              </div>
              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-sm mb-3 text-foreground">Today's Lectures</h4>
                <div className="min-h-[100px] max-h-[150px] overflow-y-auto space-y-2">
                  {getLecturesForDay(new Date()).length ? (
                    getLecturesForDay(new Date()).map((lec) => <LectureToday key={lec.id} lecture={lec} />)
                  ) : (
                    <EmptyState message="No lectures today" small />
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">No active semester selected</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsSemesterDialogOpen(true)
                  toast.info("Open Manage Semesters to create or activate a semester.")
                }}
                className="text-xs"
              >
                Manage Semesters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-foreground">{value}</span>
  </div>
)

const EmptyState = ({ message, small }: { message: string; small?: boolean }) => (
  <div className={small ? "flex items-center justify-center h-[100px] text-muted-foreground" : "flex items-center justify-center h-[200px] text-muted-foreground"}>
    <div className="text-center">
      <Clock className={small ? "h-6 w-6 mx-auto mb-1 text-muted-foreground/50" : "h-8 w-8 mx-auto mb-2 text-muted-foreground/50"} />
      <p className={small ? "text-xs" : "text-sm"}>{message}</p>
    </div>
  </div>
)

function LectureChip({ lecture, handleDelete }: { lecture: LectureSlot; handleDelete: () => void }) {
  return (
    <div className="p-3 border rounded-lg bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-green-600 dark:text-green-400" />
            <h4 className="font-medium text-sm truncate text-foreground">{lecture.subject}</h4>
            <Badge
              variant="outline"
              className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700 text-xs"
            >
              {Math.max(1, (timeToMinutes(lecture.endTime)! - timeToMinutes(lecture.startTime)!))}min
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-1">
            {lecture.startTime} – {lecture.endTime}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {lecture.lecturer} • {lecture.room}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            handleDelete()
          }}
          className="text-destructive hover:text-destructive h-8 w-8 p-0"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

function EventChip({
  event,
  getEventTypeIcon,
  getEventTypeColor,
  handleDelete,
}: {
  event: Event
  getEventTypeIcon: (t: Event["type"]) => React.ReactNode
  getEventTypeColor: (t: Event["type"]) => string
  handleDelete: () => void
}) {
  return (
    <div className="p-3 border border-border rounded-lg bg-card">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {getEventTypeIcon(event.type)}
            <h4 className="font-medium text-sm truncate text-foreground">{event.title}</h4>
            <Badge variant="outline" className={`${getEventTypeColor(event.type)} text-xs`}>
              {event.type}
            </Badge>
            {/* Personal indicator removed */}
          </div>
          {event.time && (
            <p className="text-xs text-muted-foreground mb-1">
              {event.time}
              {event.endTime && ` – ${event.endTime}`}
            </p>
          )}
          {event.description && <p className="text-xs text-muted-foreground truncate">{event.description}</p>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            handleDelete()
          }}
          className="text-destructive hover:text-destructive h-8 w-8 p-0"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

function LectureToday({ lecture }: { lecture: LectureSlot }) {
  return (
    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
      <div className="font-medium text-sm truncate text-foreground">{lecture.subject}</div>
      <div className="text-xs text-muted-foreground truncate">
        {lecture.startTime} – {lecture.endTime} • {lecture.room}
      </div>
    </div>
  )
}

function TimeSlotRow({
  slot,
  slotIndex,
  isCurrent,
  lectures,
  onDeleteLecture,
  onClick,
  lectureTimeSlots,
}: {
  slot: { start: string; end: string }
  slotIndex: number
  isCurrent: boolean
  lectures: LectureSlot[]
  onDeleteLecture: (id: string) => void
  onClick: () => void
  lectureTimeSlots: { start: string; end: string }[]
}) {
  const baseHeight = 60

  return (
    <div
      className={`flex items-start gap-4 border-l-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-r-lg p-3 ${
        isCurrent ? "border-l-primary bg-primary/10" : "border-l-border bg-card"
      }`}
      style={{ minHeight: `${baseHeight}px` }}
      onClick={onClick}
    >
      <div className={`text-sm font-mono w-16 text-center py-2 ${isCurrent ? "text-primary font-semibold" : "text-muted-foreground"}`}>
        <div className="font-medium">{slot.start}</div>
        <div className="text-xs opacity-75">{slot.end}</div>
      </div>
      <div className="flex-1 py-2 flex items-start">
        {lectures.length ? (
          <div className="w-full space-y-2">
            {lectures.map((lec) => {
              const slotsNeeded = countSlotsCovered(lec.startTime, lec.endTime, lectureTimeSlots, slotIndex)
              const spanningHeight = slotsNeeded * baseHeight + (slotsNeeded - 1) * 4
              const nowM = timeToMinutes(format(new Date(), "HH:mm")) ?? -1
              const sM = timeToMinutes(lec.startTime) ?? Infinity
              const eM = timeToMinutes(lec.endTime) ?? -Infinity
              const live = nowM >= sM && nowM <= eM

              return (
                <div
                  key={lec.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border border-border relative ${isCurrent ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-card"}`}
                  style={{ minHeight: `${spanningHeight}px` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute left-0 top-0 w-1 bg-green-500 rounded-r" style={{ height: `${spanningHeight}px` }} />
                  <BookOpen className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-base text-foreground">{lec.subject}</span>
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700 text-xs"
                      >
                        {Math.max(1, (timeToMinutes(lec.endTime)! - timeToMinutes(lec.startTime)!))}min
                      </Badge>
                      {live && <Badge variant="default" className="bg-green-600 text-xs">Live</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {lec.lecturer} • {lec.room}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lec.startTime} - {lec.endTime}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteLecture(lec.id)}
                    className="text-destructive hover:text-destructive h-8 w-8 p-0 flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-sm italic py-4 text-muted-foreground">Click to add lecture</div>
        )}
      </div>
    </div>
  )
}

function NavigationBar({
  timetableDate,
  navigate,
  resetToday,
}: {
  timetableDate: Date
  navigate: (dir: "prev" | "next") => void
  resetToday: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => navigate("prev")}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="text-sm font-medium min-w-[140px] text-center px-3 py-2 bg-muted rounded border border-border">
        {format(timetableDate, "EEEE, MMM d")}
      </div>
      <Button variant="outline" size="sm" onClick={() => navigate("next")}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={resetToday}>
        Today
      </Button>
    </div>
  )
}

function InputBlock({
  label,
  id,
  type = "text",
  value,
  onChange,
}: {
  label: string
  id: string
  type?: string
  value: string | number
  onChange: (v: string) => void
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function TextareaBlock({
  label,
  id,
  value,
  onChange,
}: { label: string; id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className="resize-none" />
    </div>
  )
}

function SelectBlock({
  label,
  value,
  onChange,
  items,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  items: (string | { label: string; value: string })[]
}) {
  const opts = items.map((i) =>
    typeof i === "string" ? { label: i.charAt(0).toUpperCase() + i.slice(1), value: i } : i,
  )
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {opts.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function EventDialog({
  open,
  onOpenChange,
  selectedDate,
  newEvent,
  setNewEvent,
  handleAddEvent,
  isPersonalDate = false,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  selectedDate: Date | null
  newEvent: { title: string; description: string; type: Event["type"]; time: string; endTime: string }
  setNewEvent: React.Dispatch<React.SetStateAction<{ title: string; description: string; type: Event["type"]; time: string; endTime: string }>>
  handleAddEvent: () => void
  isPersonalDate?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Event</DialogTitle>
          <DialogDescription>
            Add a new event for {selectedDate && format(selectedDate, "MMMM d, yyyy")}
            {isPersonalDate && <span className="ml-1 inline-flex items-center gap-1">•</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <InputBlock label="Event Title" id="evt-title" value={newEvent.title} onChange={(v) => setNewEvent({ ...newEvent, title: v })} />
          <SelectBlock
            label="Event Type"
            value={newEvent.type}
            onChange={(v) => setNewEvent({ ...newEvent, type: v as Event["type"] })}
            items={["exam", "assignment", "reminder", "class"]}
          />
          <div className="grid grid-cols-2 gap-2">
            <InputBlock label="Start Time" id="evt-time" type="time" value={newEvent.time} onChange={(v) => setNewEvent({ ...newEvent, time: v })} />
            <InputBlock label="End Time" id="evt-end" type="time" value={newEvent.endTime} onChange={(v) => setNewEvent({ ...newEvent, endTime: v })} />
          </div>
          <TextareaBlock label="Description (Optional)" id="evt-desc" value={newEvent.description} onChange={(v) => setNewEvent({ ...newEvent, description: v })} />
          <div className="text-xs text-muted-foreground">Tip: If you set an end time, it must be after the start time.</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAddEvent} disabled={!newEvent.title}>Add Event</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LectureDialog({
  open,
  onOpenChange,
  daysOfWeek,
  lectureTimeSlots,
  newLecture,
  setNewLecture,
  selectedTimeSlot,
  handleAddLecture,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  daysOfWeek: string[]
  lectureTimeSlots: { start: string; end: string }[]
  newLecture: { subject: string; lecturer: string; room: string; dayOfWeek: number; startTime: string; endTime: string }
  setNewLecture: React.Dispatch<React.SetStateAction<{ subject: string; lecturer: string; room: string; dayOfWeek: number; startTime: string; endTime: string }>>
  selectedTimeSlot: string
  handleAddLecture: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Lecture</DialogTitle>
          <DialogDescription>
            {selectedTimeSlot ? `Prefilled start: ${selectedTimeSlot}` : "Enter a start and end time"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <InputBlock label="Subject" id="lec-subject" value={newLecture.subject} onChange={(v) => setNewLecture({ ...newLecture, subject: v })} />
          <InputBlock label="Lecturer" id="lec-lecturer" value={newLecture.lecturer} onChange={(v) => setNewLecture({ ...newLecture, lecturer: v })} />
          <InputBlock label="Room" id="lec-room" value={newLecture.room} onChange={(v) => setNewLecture({ ...newLecture, room: v })} />
          <SelectBlock
            label="Day of Week"
            value={newLecture.dayOfWeek.toString()}
            onChange={(v) => setNewLecture({ ...newLecture, dayOfWeek: Number(v) })}
            items={daysOfWeek.map((d, i) => ({ label: d, value: i.toString() }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <InputBlock label="Start Time" id="lec-start" type="time" value={newLecture.startTime} onChange={(v) => setNewLecture({ ...newLecture, startTime: v })} />
            <InputBlock label="End Time" id="lec-end" type="time" value={newLecture.endTime} onChange={(v) => setNewLecture({ ...newLecture, endTime: v })} />
          </div>
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
            <strong>Note:</strong> The lecture will stretch across the timetable rows according to the duration between the start and end times.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAddLecture} disabled={!newLecture.subject || !newLecture.startTime || !newLecture.endTime}>Add Lecture</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SemesterDialog({
  open,
  onOpenChange,
  semesters,
  newSemester,
  setNewSemester,
  editingSemester,
  setEditingSemester,
  handleAddSemester,
  handleUpdateSemester,
  handleEditSemester,
  handleDeleteSemester,
  handleActivateSemester,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  semesters: Semester[]
  newSemester: { name: string; startDate: string; endDate: string }
  setNewSemester: React.Dispatch<React.SetStateAction<{ name: string; startDate: string; endDate: string }>>
  editingSemester: Semester | null
  setEditingSemester: React.Dispatch<React.SetStateAction<Semester | null>>
  handleAddSemester: () => void
  handleUpdateSemester: () => void
  handleEditSemester: (semester: Semester) => void
  handleDeleteSemester: (id: string) => void
  handleActivateSemester: (id: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Semesters</DialogTitle>
          <DialogDescription>Create new semesters, edit existing ones, and switch between them</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-foreground">Current Semesters</h4>
            {semesters.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div>
                  <span className="font-medium text-foreground">{s.name}</span>
                  {s.isActive && <Badge className="ml-2">Active</Badge>}
                  <p className="text-sm text-muted-foreground">
                    {format(s.startDate, "MMM d, yyyy")} – {format(s.endDate, "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditSemester(s)}>
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  {!s.isActive && (
                    <Button variant="outline" size="sm" onClick={() => handleActivateSemester(s.id)}>
                      Activate
                    </Button>
                  )}
                  {semesters.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteSemester(s.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <h4 className="font-medium text-foreground">{editingSemester ? "Edit Semester" : "Add New Semester"}</h4>
            <InputBlock label="Semester Name" id="sem-name" value={newSemester.name} onChange={(v) => setNewSemester({ ...newSemester, name: v })} />
            <div className="grid grid-cols-2 gap-3">
              <InputBlock label="Start Date" id="sem-start" type="date" value={newSemester.startDate} onChange={(v) => setNewSemester({ ...newSemester, startDate: v })} />
              <InputBlock label="End Date" id="sem-end" type="date" value={newSemester.endDate} onChange={(v) => setNewSemester({ ...newSemester, endDate: v })} />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={editingSemester ? handleUpdateSemester : handleAddSemester}
                disabled={!newSemester.name || !newSemester.startDate || !newSemester.endDate}
                className="flex-1"
              >
                {editingSemester ? "Update Semester" : "Add Semester"}
              </Button>
              {editingSemester && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingSemester(null)
                    setNewSemester({ name: "", startDate: "", endDate: "" })
                    toast.info("Edit cancelled")
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default StudentCalendar

function getEventTypeIcon(t: Event["type"]) {
  return {
    exam: <BookOpen className="h-4 w-4" />,
    assignment: <CalendarDays className="h-4 w-4" />,
    reminder: <AlertCircle className="h-4 w-4" />,
    class: <Clock className="h-4 w-4" />,
  }[t]
}
function getEventTypeColor(t: Event["type"]) {
  return {
    exam: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
    assignment: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
    reminder: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
    class: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
  }[t]
}
