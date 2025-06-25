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

 const callFn = <TReq, TRes>(name: string, data: TReq) => httpsCallable<TReq, TRes>(fns, name)(data).then((r) => r.data)


interface Event {
  id: string
  title: string
  description: string
  date: Date
  type: "exam" | "assignment" | "reminder" | "class"
  time?: string
  endTime?: string
}

interface LectureSlot {
  id: string
  subject: string
  lecturer: string
  room: string
  dayOfWeek: number
  timeSlot: string
  duration: number
  semesterId: string
}

interface Semester {
  id: string
  name: string
  startDate: Date
  endDate: Date
  isActive: boolean
}

function calculateLectureEndTime(startTime: string, duration: number): string {
  const [hours, minutes] = startTime.split(":").map(Number)
  const startMinutes = hours * 60 + minutes
  const endMinutes = startMinutes + duration
  const endHours = Math.floor(endMinutes / 60)
  const endMins = endMinutes % 60
  return `${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`
}

function CustomCalendarGrid({
  selectedDate,
  onDateClick,
  getEventsForDate,
  getLecturesForDay,
}: {
  selectedDate: Date
  onDateClick: (date: Date) => void
  getEventsForDate: (d: Date) => Event[]
  getLecturesForDay: (d: Date) => LectureSlot[]
}) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    const days = []

    const prevMonth = new Date(year, month - 1, 0)
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false,
      })
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true,
      })
    }

    const remainingDays = 42 - days.length
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false,
      })
    }
    return days
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const getDateClasses = (date: Date, isCurrentMonth: boolean) => {
    const baseClasses = "h-12 w-full flex items-center justify-center text-sm font-medium rounded-md transition-colors"

    if (!isCurrentMonth) {
      return `${baseClasses} text-gray-400`
    }

    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()
    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString()

    const events = getEventsForDate(date)
    const lectures = getLecturesForDay(date)
    const eventTypes = new Set([...events.map((e) => e.type), ...(lectures.length > 0 ? ["class"] : [])])

    let colorClasses = ""
    if (eventTypes.size > 1) {
      colorClasses = "bg-purple-100 border border-purple-300 text-purple-800"
    } else if (eventTypes.has("exam")) {
      colorClasses = "bg-red-100 border border-red-300 text-red-800"
    } else if (eventTypes.has("assignment")) {
      colorClasses = "bg-blue-100 border border-blue-300 text-blue-800"
    } else if (eventTypes.has("reminder")) {
      colorClasses = "bg-yellow-100 border border-yellow-300 text-yellow-800"
    } else if (eventTypes.has("class")) {
      colorClasses = "bg-green-100 border border-green-300 text-green-800"
    }

    const interactiveClasses = "cursor-pointer hover:bg-gray-50 hover:border-gray-200 border border-transparent"

    if (isSelected) {
      return `${baseClasses} ${interactiveClasses} bg-primary text-primary-foreground border-primary`
    }
    if (isToday) {
      return `${baseClasses} ${interactiveClasses} bg-accent text-accent-foreground font-semibold border-2 border-blue-400 ${colorClasses}`
    }
    if (colorClasses) {
      return `${baseClasses} ${interactiveClasses} ${colorClasses} font-semibold`
    }
    return `${baseClasses} ${interactiveClasses} text-gray-900`
  }

  const days = getDaysInMonth(currentMonth)

  return (
    <div className="w-full bg-white rounded-lg border">
      <div className="flex items-center justify-between p-4 border-b">
        <button onClick={() => navigateMonth("prev")} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
        <button onClick={() => navigateMonth("next")} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {daysOfWeek.map((day) => (
            <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => (
            <button
              key={index}
              onClick={() => day.isCurrentMonth && onDateClick(day.date)}
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
  const { userId, loading: authLoading } = useUserId()

  const [date, setDate] = React.useState<Date>(new Date())
  const [events, setEvents] = React.useState<Event[]>([])
  const [lectureSlots, setLectureSlots] = React.useState<LectureSlot[]>([])
  // Remove hardcoded semester data - start with empty array
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
    timeSlot: "",
    duration: 50,
  })
  const [newSemester, setNewSemester] = React.useState({
    name: "",
    startDate: "",
    endDate: "",
  })
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // Add separate loading state for initial data fetch
  const [initialLoading, setInitialLoading] = React.useState(true)

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

  // Update getActiveSemester function to handle null properly
  const getActiveSemester = () => semesters.find((s) => s.isActive) || null

  // Add new function to check if date has valid semester
  const getSemesterForDate = (date: Date) => {
    return semesters.find((s) => date >= s.startDate && date <= s.endDate) || null
  }

  const fetchLectures = React.useCallback(async () => {
    const active = getActiveSemester()
    if (!userId || !active) {
      setLectureSlots([])
      return
    }

    try {
      const data = await callFn<{ semesterId: string }, LectureSlot[]>("getLectures", { semesterId: active.id })
      setLectureSlots(data)
    } catch (err: any) {
      console.error("Failed to fetch lectures:", err)
      setLectureSlots([])
    }
  }, [userId, semesters])

  const fetchEvents = React.useCallback(async () => {
    const active = getActiveSemester()
    if (!userId || !active) {
      setEvents([])
      return
    }

    try {
      const data = await callFn<{ semesterId: string }, any[]>("getEvents", { semesterId: active.id })
      setEvents(data.map((e) => ({ ...e, date: new Date(e.date) })))
    } catch (err: any) {
      console.error("Failed to fetch events:", err)
      setEvents([])
    }
  }, [userId, semesters])

  const fetchSemesters = React.useCallback(async () => {
    if (!userId) return

    try {
      const data = await callFn<{}, any[]>("getSemesters", {})
      console.log("Fetched semesters from Firebase:", data)

      if (data && data.length > 0) {
        setSemesters(
          data.map((s) => ({
            ...s,
            startDate: new Date(s.startDate),
            endDate: new Date(s.endDate),
          })),
        )
      } else {
        // If no semesters exist, create a default one
        console.log("No semesters found, creating default semester")
        const defaultSemester = {
          name: "Semester 1 2025",
          startDate: "2025-02-10",
          endDate: "2025-06-21",
        }

        const addedSemester = await callFn<{ semester: any }, any>("addSemester", {
          semester: defaultSemester,
        })

        // Activate the newly created semester
        await callFn<{ semesterId: string }, { success: boolean }>("setActiveSemester", {
          semesterId: addedSemester.id,
        })

        setSemesters([
          {
            ...addedSemester,
            startDate: new Date(addedSemester.startDate),
            endDate: new Date(addedSemester.endDate),
            isActive: true,
          },
        ])
      }
      setError(null)
    } catch (err: any) {
      console.error("Failed to fetch semesters:", err)
      setError(err.message ?? "Failed to fetch semesters")
    }
  }, [userId])

  // Initial data fetch when component mounts
  React.useEffect(() => {
    const initializeData = async () => {
      if (!userId) {
        setInitialLoading(false)
        return
      }

      setInitialLoading(true)
      try {
        // Fetch semesters first
        await fetchSemesters()
      } catch (err) {
        console.error("Error initializing data:", err)
      } finally {
        setInitialLoading(false)
      }
    }

    initializeData()
  }, [userId, fetchSemesters])

  // Fetch lectures and events when semesters change
  React.useEffect(() => {
    if (!userId || semesters.length === 0) return

    fetchLectures()
    fetchEvents()
  }, [userId, semesters, fetchLectures, fetchEvents])

  const handleAddLecture = async () => {
    setError(null) // Clear any existing errors

    const semesterForDate = getSemesterForDate(timetableDate)
    if (!semesterForDate) {
      const errorMsg = `No semester covers ${format(timetableDate, "MMM d, yyyy")}. Please add a semester that includes this date.`
      setError(errorMsg)

      // Auto-clear error after 8 seconds
      setTimeout(() => {
        setError(null)
      }, 8000)
      return
    }
    if (!newLecture.subject || !newLecture.timeSlot || !userId) return

    setLoading(true)
    try {
      const res = await callFn<{ semesterId: string; lecture: typeof newLecture }, LectureSlot>("addLecture", {
        semesterId: semesterForDate.id,
        lecture: newLecture,
      })

      setLectureSlots((prev) => [...prev, res])
      setNewLecture({
        subject: "",
        lecturer: "",
        room: "",
        dayOfWeek: 0,
        timeSlot: "",
        duration: 50,
      })
      setIsLectureDialogOpen(false)
      setError(null)
    } catch (err: any) {
      setError(err.message ?? "Failed to add lecture")
    }
    setLoading(false)
  }

  const handleDeleteLecture = async (id: string) => {
    if (!userId) return
    setLoading(true)
    try {
      await callFn<{ lectureId: string }, { success: boolean }>("deleteLecture", { lectureId: id })
      setLectureSlots((prev) => prev.filter((l) => l.id !== id))
      setError(null)
    } catch (err: any) {
      setError(err.message ?? "Failed to delete lecture")
    }
    setLoading(false)
  }

  const handleAddEvent = async () => {
    if (!selectedDate) return
    setError(null) // Clear any existing errors

    const semesterForDate = getSemesterForDate(selectedDate)
    if (!semesterForDate) {
      const errorMsg = `No semester covers ${format(selectedDate, "MMM d, yyyy")}. Please add a semester that includes this date.`
      setError(errorMsg)

      // Auto-clear error after 8 seconds
      setTimeout(() => {
        setError(null)
      }, 8000)
      return
    }
    if (!newEvent.title || !userId) return

    setLoading(true)
    try {
      const payload = {
        semesterId: semesterForDate.id,
        event: { ...newEvent, date: selectedDate.toISOString() },
      }

      const res = await callFn<typeof payload, Event>("addEvent", payload)

      setEvents((prev) => [...prev, { ...res, date: new Date(res.date) }])
      setNewEvent({
        title: "",
        description: "",
        type: "reminder",
        time: "",
        endTime: "",
      })
      setIsDialogOpen(false)
      setError(null)
    } catch (err: any) {
      setError(err.message ?? "Failed to add event")
    }
    setLoading(false)
  }

  const handleDeleteEvent = async (id: string) => {
    if (!userId) return
    setLoading(true)
    try {
      await callFn<{ eventId: string }, { success: boolean }>("deleteEvent", { eventId: id })
      setEvents((prev) => prev.filter((e) => e.id !== id))
      setError(null)
    } catch (err: any) {
      setError(err.message ?? "Failed to delete event")
    }
    setLoading(false)
  }

  const getEventsForDate = (d: Date) => events.filter((e) => e.date.toDateString() === d.toDateString())

  const getLecturesForDay = (d: Date) => {
    const semesterForDate = getSemesterForDate(d)
    if (!semesterForDate) return []

    const dayOfWeek = d.getDay()
    const filtered = lectureSlots.filter((l) => l.dayOfWeek === dayOfWeek && l.semesterId === semesterForDate.id)
    return filtered
  }

  const isCurrentLectureSlot = (start: string) => {
    const today = new Date()
    if (format(today, "yyyy/MM/dd") !== format(timetableDate, "yyyy/MM/dd")) return false
    const slot = lectureTimeSlots.find((s) => s.start === start)
    if (!slot) return false
    const [sh, sm] = slot.start.split(":").map(Number)
    const [eh, em] = slot.end.split(":").map(Number)
    const begin = new Date(today)
    begin.setHours(sh, sm, 0, 0)
    const end = new Date(today)
    end.setHours(eh, em, 0, 0)
    return currentTime >= begin && currentTime <= end
  }

  const handleDateClick = (d?: Date) => {
    if (!d) return
    setSelectedDate(d)
    setDate(d)
    setTimetableDate(d)
    setIsDialogOpen(true)
  }

  const handleTimeSlotClick = (slotStart: string) => {
    // Clear any existing errors first
    setError(null)

    const semesterForDate = getSemesterForDate(timetableDate)
    if (!semesterForDate) {
      const errorMsg = `No semester covers ${format(timetableDate, "MMM d, yyyy")}. Please add a semester that includes this date in Manage Semesters.`
      setError(errorMsg)

      // Auto-clear error after 8 seconds
      setTimeout(() => {
        setError(null)
      }, 8000)
      return
    }

    setSelectedTimeSlot(slotStart)
    setNewLecture({ ...newLecture, timeSlot: slotStart, dayOfWeek: timetableDate.getDay() })
    setIsLectureDialogOpen(true)
  }

  const handleAddSemester = async () => {
    if (!newSemester.name || !newSemester.startDate || !newSemester.endDate || !userId) return

    setLoading(true)
    try {
      const addedSemester = await callFn<{ semester: any }, Semester>("addSemester", {
        semester: {
          name: newSemester.name,
          startDate: newSemester.startDate,
          endDate: newSemester.endDate,
        },
      })

      setSemesters((prev) => [
        ...prev,
        {
          ...addedSemester,
          startDate: new Date(addedSemester.startDate),
          endDate: new Date(addedSemester.endDate),
        },
      ])
      setNewSemester({ name: "", startDate: "", endDate: "" })
      setError(null)
    } catch (err: any) {
      setError(err.message ?? "Failed to add semester")
    }
    setLoading(false)
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
      // Pass the semester data with ID included
      const semesterData = {
        id: editingSemester.id,
        name: newSemester.name,
        startDate: newSemester.startDate,
        endDate: newSemester.endDate,
      }

      const response = await callFn<{ semester: any }, { success: boolean; semester: any }>("updateSemester", {
        semester: semesterData,
      })

      // Update the local state with the updated semester
      setSemesters((prev) =>
        prev.map((s) =>
          s.id === editingSemester.id
            ? {
                ...s,
                name: semesterData.name,
                startDate: new Date(semesterData.startDate),
                endDate: new Date(semesterData.endDate),
              }
            : s,
        ),
      )

      setEditingSemester(null)
      setNewSemester({ name: "", startDate: "", endDate: "" })
      setError(null)
    } catch (err: any) {
      setError(err.message ?? "Failed to update semester")
    }
    setLoading(false)
  }

  const handleDeleteSemester = async (id: string) => {
    if (!userId) return

    setLoading(true)
    try {
      await callFn<{ semesterId: string }, { success: boolean }>("deleteSemester", { semesterId: id })
      setSemesters((prev) => prev.filter((s) => s.id !== id))
      setError(null)
    } catch (err: any) {
      setError(err.message ?? "Failed to delete semester")
    }
    setLoading(false)
  }

  const handleActivateSemester = async (id: string) => {
    if (!userId) return

    setLoading(true)
    try {
      await callFn<{ semesterId: string }, { success: boolean }>("setActiveSemester", { semesterId: id })

      setSemesters((prev) => prev.map((s) => ({ ...s, isActive: s.id === id })))
      setError(null)
    } catch (err: any) {
      setError(err.message ?? "Failed to activate semester")
    }
    setLoading(false)
  }

  const navigateTimetableDate = (dir: "prev" | "next") =>
    setTimetableDate((d) => {
      const nd = new Date(d)
      nd.setDate(d.getDate() + (dir === "next" ? 1 : -1))
      return nd
    })

  if (authLoading || initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your calendar...</p>
        </div>
      </div>
    )
  }

  if (!userId) return <div className="text-center py-10">Please sign in to use the calendar.</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {loading && <div className="text-blue-600 text-sm">Loading...</div>}
        {error && (
          <div className="fixed top-4 right-4 z-50 max-w-md">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800 mb-1">Error</h3>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="bg-white rounded-lg border p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Student Calendar</h1>
            <p className="text-gray-600 mt-1">Manage your academic schedule and events</p>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "calendar" | "timetable")}
              className="w-full lg:w-auto"
            >
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
                <Button variant="outline" onClick={() => setIsLectureDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lecture
                </Button>
              )}
            </div>
          </div>
        </header>

        {activeTab === "calendar" && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3 space-y-6">
              <CustomCalendarGrid
                selectedDate={date}
                onDateClick={handleDateClick}
                getEventsForDate={getEventsForDate}
                getLecturesForDay={getLecturesForDay}
              />

              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3 text-sm">Event Types</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <LegendDot color="bg-red-100 border border-red-300" label="Exams" />
                    <LegendDot color="bg-blue-100 border border-blue-300" label="Assignments" />
                    <LegendDot color="bg-yellow-100 border border-blue-300" label="Reminders" />
                    <LegendDot color="bg-green-100 border border-green-300" label="Classes" />
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <LegendDot color="bg-purple-100 border border-purple-300" label="Multiple types" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Sidebar
              date={date}
              getEventsForDate={getEventsForDate}
              getLecturesForDay={getLecturesForDay}
              lectureTimeSlots={lectureTimeSlots}
              getEventTypeIcon={getEventTypeIcon}
              getEventTypeColor={getEventTypeColor}
              handleDeleteEvent={handleDeleteEvent}
              handleDeleteLecture={handleDeleteLecture}
              getActiveSemester={getActiveSemester}
              setIsSemesterDialogOpen={setIsSemesterDialogOpen}
            />
          </div>
        )}

        {activeTab === "timetable" && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {getActiveSemester()
                    ? `Lecture Timetable – ${getActiveSemester()!.name}`
                    : "Lecture Timetable – No Active Semester"}
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
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Semester</h3>
                  <p className="text-gray-600 mb-4">Please activate a semester to view and manage lectures.</p>
                  <Button onClick={() => setIsSemesterDialogOpen(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Semesters
                  </Button>
                </div>
              ) : (
                <div className="space-y-1 max-h-[600px] overflow-y-auto">
                  {lectureTimeSlots.map((slot, slotIndex) => {
                    const lecturesForDay = getLecturesForDay(timetableDate)
                    const lecturesAtTime = lecturesForDay.filter((l) => l.timeSlot === slot.start)
                    const currentSlot = isCurrentLectureSlot(slot.start)

                    const isCoveredByEarlierLecture = lecturesForDay.some((lecture) => {
                      const lectureStartIndex = lectureTimeSlots.findIndex((s) => s.start === lecture.timeSlot)
                      const currentSlotIndex = slotIndex
                      const slotsNeeded = Math.ceil(lecture.duration / 50)
                      const lectureEndIndex = lectureStartIndex + slotsNeeded - 1

                      return lectureStartIndex < currentSlotIndex && currentSlotIndex <= lectureEndIndex
                    })

                    if (isCoveredByEarlierLecture) {
                      return null
                    }

                    return (
                      <TimeSlotRow
                        key={slot.start}
                        slot={slot}
                        slotIndex={slotIndex}
                        isCurrent={currentSlot}
                        lectures={lecturesAtTime}
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
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-3 h-3 rounded ${color}`} />
      <span className="text-gray-700">{label}</span>
    </div>
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
                  <LectureChip
                    key={lec.id}
                    lecture={lec}
                    lectureTimeSlots={lectureTimeSlots}
                    handleDelete={() => handleDeleteLecture(lec.id)}
                  />
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
          <p className="text-sm text-gray-600">{getActiveSemester()?.name || "No active semester"}</p>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {getActiveSemester() ? (
            <>
              <div className="space-y-2">
                <InfoRow label="Start:" value={format(getActiveSemester()!.startDate, "MMM d, yyyy")} />
                <InfoRow label="End:" value={format(getActiveSemester()!.endDate, "MMM d, yyyy")} />
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-3">Today's Lectures</h4>
                <div className="min-h-[100px] max-h-[150px] overflow-y-auto space-y-2">
                  {getLecturesForDay(new Date()).length ? (
                    getLecturesForDay(new Date()).map((lec) => (
                      <LectureToday key={lec.id} lecture={lec} lectureTimeSlots={lectureTimeSlots} />
                    ))
                  ) : (
                    <EmptyState message="No lectures today" small />
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">No active semester selected</p>
              <Button variant="outline" size="sm" onClick={() => setIsSemesterDialogOpen(true)} className="text-xs">
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
    <span className="text-gray-600">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
)

const EmptyState = ({ message, small }: { message: string; small?: boolean }) => (
  <div
    className={
      small
        ? "flex items-center justify-center h-[100px] text-gray-500"
        : "flex items-center justify-center h-[200px] text-gray-500"
    }
  >
    <div className="text-center">
      <Clock className={small ? "h-6 w-6 mx-auto mb-1 text-gray-400" : "h-8 w-8 mx-auto mb-2 text-gray-400"} />
      <p className={small ? "text-xs" : "text-sm"}>{message}</p>
    </div>
  </div>
)

function LectureChip({
  lecture,
  lectureTimeSlots,
  handleDelete,
}: {
  lecture: LectureSlot
  lectureTimeSlots: { start: string; end: string }[]
  handleDelete: () => void
}) {
  const endTime = calculateLectureEndTime(lecture.timeSlot, lecture.duration)

  return (
    <div className="p-3 border rounded-lg bg-green-50 border-green-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-green-600" />
            <h4 className="font-medium text-sm truncate">{lecture.subject}</h4>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">
              {lecture.duration}min
            </Badge>
          </div>
          <p className="text-xs text-gray-600 mb-1">
            {lecture.timeSlot} – {endTime}
          </p>
          <p className="text-xs text-gray-600 truncate">
            {lecture.lecturer} • {lecture.room}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-red-600 hover:text-red-800 h-8 w-8 p-0"
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
    <div className="p-3 border rounded-lg bg-white">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {getEventTypeIcon(event.type)}
            <h4 className="font-medium text-sm truncate">{event.title}</h4>
            <Badge variant="outline" className={`${getEventTypeColor(event.type)} text-xs`}>
              {event.type}
            </Badge>
          </div>
          {event.time && (
            <p className="text-xs text-gray-600 mb-1">
              {event.time}
              {event.endTime && ` – ${event.endTime}`}
            </p>
          )}
          {event.description && <p className="text-xs text-gray-600 truncate">{event.description}</p>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-red-600 hover:text-red-800 h-8 w-8 p-0"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

function LectureToday({
  lecture,
  lectureTimeSlots,
}: { lecture: LectureSlot; lectureTimeSlots: { start: string; end: string }[] }) {
  const endTime = calculateLectureEndTime(lecture.timeSlot, lecture.duration)

  return (
    <div className="p-2 bg-green-50 rounded border border-green-200">
      <div className="font-medium text-sm truncate">{lecture.subject}</div>
      <div className="text-xs text-gray-600 truncate">
        {lecture.timeSlot} – {endTime} • {lecture.room}
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
      className={`flex items-start gap-4 border-l-4 cursor-pointer hover:bg-gray-50 transition-colors rounded-r-lg p-3 ${
        isCurrent ? "border-l-blue-500 bg-blue-50" : "border-l-gray-200 bg-white"
      }`}
      style={{ minHeight: `${baseHeight}px` }}
      onClick={onClick}
    >
      <div
        className={`text-sm font-mono w-16 text-center py-2 ${isCurrent ? "text-blue-700 font-semibold" : "text-gray-500"}`}
      >
        <div className="font-medium">{slot.start}</div>
        <div className="text-xs opacity-75">{slot.end}</div>
      </div>
      <div className="flex-1 py-2 flex items-start">
        {lectures.length ? (
          <div className="w-full space-y-2">
            {lectures.map((lec) => {
              const endTime = calculateLectureEndTime(lec.timeSlot, lec.duration)
              const slotsNeeded = Math.ceil(lec.duration / 50)
              const spanningHeight = slotsNeeded * baseHeight + (slotsNeeded - 1) * 4

              return (
                <div
                  key={lec.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border relative ${
                    isCurrent ? "bg-green-50 border-green-200" : "bg-white border-gray-200"
                  }`}
                  style={{ minHeight: `${spanningHeight}px` }}
                >
                  <div
                    className="absolute left-0 top-0 w-1 bg-green-500 rounded-r"
                    style={{ height: `${spanningHeight}px` }}
                  />

                  <BookOpen className="h-4 w-4 text-green-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-base">{lec.subject}</span>
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">
                        {lec.duration}min
                      </Badge>
                      {isCurrent && (
                        <Badge variant="default" className="bg-green-600 text-xs">
                          Live
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      {lec.lecturer} • {lec.room}
                    </p>
                    <p className="text-xs text-gray-500">
                      {lec.timeSlot} - {endTime}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteLecture(lec.id)
                    }}
                    className="text-red-600 hover:text-red-800 h-8 w-8 p-0 flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-sm italic py-4 text-gray-400">Click to add lecture</div>
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
      <div className="text-sm font-medium min-w-[140px] text-center px-3 py-2 bg-gray-50 rounded border">
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
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  selectedDate: Date | null
  newEvent: {
    title: string
    description: string
    type: Event["type"]
    time: string
    endTime: string
  }
  setNewEvent: React.Dispatch<
    React.SetStateAction<{
      title: string
      description: string
      type: Event["type"]
      time: string
      endTime: string
    }>
  >
  handleAddEvent: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Event</DialogTitle>
          <DialogDescription>
            Add a new event for {selectedDate && format(selectedDate, "MMMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <InputBlock
            label="Event Title"
            id="evt-title"
            value={newEvent.title}
            onChange={(v) => setNewEvent({ ...newEvent, title: v })}
          />
          <SelectBlock
            label="Event Type"
            value={newEvent.type}
            onChange={(v) => setNewEvent({ ...newEvent, type: v as Event["type"] })}
            items={["exam", "assignment", "reminder", "class"]}
          />
          <div className="grid grid-cols-2 gap-2">
            <InputBlock
              label="Start Time"
              id="evt-time"
              type="time"
              value={newEvent.time}
              onChange={(v) => setNewEvent({ ...newEvent, time: v })}
            />
            <InputBlock
              label="End Time"
              id="evt-end"
              type="time"
              value={newEvent.endTime}
              onChange={(v) => setNewEvent({ ...newEvent, endTime: v })}
            />
          </div>
          <TextareaBlock
            label="Description (Optional)"
            id="evt-desc"
            value={newEvent.description}
            onChange={(v) => setNewEvent({ ...newEvent, description: v })}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddEvent} disabled={!newEvent.title}>
            Add Event
          </Button>
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
  newLecture: {
    subject: string
    lecturer: string
    room: string
    dayOfWeek: number
    timeSlot: string
    duration: number
  }
  setNewLecture: React.Dispatch<
    React.SetStateAction<{
      subject: string
      lecturer: string
      room: string
      dayOfWeek: number
      timeSlot: string
      duration: number
    }>
  >
  selectedTimeSlot: string
  handleAddLecture: () => void
}) {
  const durationOptions = [
    { label: "50 minutes (1 slot)", value: "50" },
    { label: "100 minutes (2 slots)", value: "100" },
    { label: "150 minutes (3 slots)", value: "150" },
    { label: "200 minutes (4 slots)", value: "200" },
    { label: "Custom", value: "custom" },
  ]

  const [customDuration, setCustomDuration] = React.useState("")
  const [showCustom, setShowCustom] = React.useState(false)

  const handleDurationChange = (value: string) => {
    if (value === "custom") {
      setShowCustom(true)
    } else {
      setShowCustom(false)
      setNewLecture({ ...newLecture, duration: Number.parseInt(value) })
    }
  }

  const handleCustomDurationChange = (value: string) => {
    setCustomDuration(value)
    const duration = Number.parseInt(value)
    if (!isNaN(duration) && duration > 0) {
      setNewLecture({ ...newLecture, duration })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Lecture</DialogTitle>
          <DialogDescription>
            Add a new lecture for {daysOfWeek[newLecture.dayOfWeek]} at {selectedTimeSlot}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <InputBlock
            label="Subject"
            id="lec-subject"
            value={newLecture.subject}
            onChange={(v) => setNewLecture({ ...newLecture, subject: v })}
          />
          <InputBlock
            label="Lecturer"
            id="lec-lecturer"
            value={newLecture.lecturer}
            onChange={(v) => setNewLecture({ ...newLecture, lecturer: v })}
          />
          <InputBlock
            label="Room"
            id="lec-room"
            value={newLecture.room}
            onChange={(v) => setNewLecture({ ...newLecture, room: v })}
          />
          <SelectBlock
            label="Day of Week"
            value={newLecture.dayOfWeek.toString()}
            onChange={(v) => setNewLecture({ ...newLecture, dayOfWeek: Number(v) })}
            items={daysOfWeek.map((d, i) => ({ label: d, value: i.toString() }))}
          />
          <SelectBlock
            label="Time Slot"
            value={newLecture.timeSlot}
            onChange={(v) => setNewLecture({ ...newLecture, timeSlot: v })}
            items={lectureTimeSlots.map((s) => ({
              label: `${s.start} – ${s.end}`,
              value: s.start,
            }))}
          />
          <SelectBlock
            label="Duration"
            value={showCustom ? "custom" : newLecture.duration.toString()}
            onChange={handleDurationChange}
            items={durationOptions}
          />
          {showCustom && (
            <InputBlock
              label="Custom Duration (minutes)"
              id="custom-duration"
              type="number"
              value={customDuration}
              onChange={handleCustomDurationChange}
            />
          )}
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            <strong>Note:</strong> Lectures can span multiple time slots. A 150-minute lecture will occupy 3 consecutive
            slots.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddLecture} disabled={!newLecture.subject}>
            Add Lecture
          </Button>
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
            <h4 className="font-medium">Current Semesters</h4>
            {semesters.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-medium">{s.name}</span>
                  {s.isActive && <Badge className="ml-2">Active</Badge>}
                  <p className="text-sm text-gray-600">
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
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium">{editingSemester ? "Edit Semester" : "Add New Semester"}</h4>
            <InputBlock
              label="Semester Name"
              id="sem-name"
              value={newSemester.name}
              onChange={(v) => setNewSemester({ ...newSemester, name: v })}
            />
            <div className="grid grid-cols-2 gap-3">
              <InputBlock
                label="Start Date"
                id="sem-start"
                type="date"
                value={newSemester.startDate}
                onChange={(v) => setNewSemester({ ...newSemester, startDate: v })}
              />
              <InputBlock
                label="End Date"
                id="sem-end"
                type="date"
                value={newSemester.endDate}
                onChange={(v) => setNewSemester({ ...newSemester, endDate: v })}
              />
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
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
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
    exam: "bg-red-100 text-red-800 border-red-200",
    assignment: "bg-blue-100 text-blue-800 border-blue-200",
    reminder: "bg-yellow-100 text-yellow-800 border-yellow-200",
    class: "bg-green-100 text-green-800 border-green-200",
  }[t]
}
