"use client"

import * as React from "react"
import { format } from "date-fns"
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
} from "lucide-react"
import { calendarApi } from "@/lib/calendarApi"
import { useUserId } from "@/hooks/useUserId" // <-- Make sure this path is correct

// --- Interfaces ---
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
  semesterId: string
}

interface Semester {
  id: string
  name: string
  startDate: Date
  endDate: Date
  isActive: boolean
}

// --- Custom Calendar Grid Component ---
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

    // Add previous month's trailing days
    const prevMonth = new Date(year, month - 1, 0)
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false,
      })
    }
    // Add current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true,
      })
    }
    // Add next month's leading days to complete the grid
    const remainingDays = 42 - days.length // 6 rows × 7 days
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
    const baseClasses =
      "h-12 w-full flex items-center justify-center text-sm font-medium rounded-md cursor-pointer transition-colors border border-transparent hover:border-gray-200 hover:bg-gray-50"
    if (!isCurrentMonth) {
      return `${baseClasses} text-gray-400 opacity-50`
    }
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()
    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString()
    // Check for events
    const events = getEventsForDate(date)
    const lectures = getLecturesForDay(date)
    const eventTypes = new Set([...events.map((e) => e.type), ...(lectures.length > 0 ? ["class"] : [])])
    let colorClasses = ""
    if (eventTypes.size > 1) {
      colorClasses = "bg-gradient-to-br from-red-100 via-blue-100 to-green-100 border-purple-300 text-purple-800"
    } else if (eventTypes.has("exam")) {
      colorClasses = "bg-red-100 border-red-300 text-red-800"
    } else if (eventTypes.has("assignment")) {
      colorClasses = "bg-blue-100 border-blue-300 text-blue-800"
    } else if (eventTypes.has("reminder")) {
      colorClasses = "bg-yellow-100 border-yellow-300 text-yellow-800"
    } else if (eventTypes.has("class")) {
      colorClasses = "bg-green-100 border-green-300 text-green-800"
    }
    if (isSelected) {
      return `${baseClasses} bg-primary text-primary-foreground border-primary ${colorClasses ? "ring-2 ring-primary ring-offset-2" : ""}`
    }
    if (isToday) {
      return `${baseClasses} bg-accent text-accent-foreground font-bold border-2 border-blue-400 ${colorClasses}`
    }
    if (colorClasses) {
      return `${baseClasses} ${colorClasses} font-bold border-2`
    }
    return `${baseClasses} text-gray-900`
  }

  const days = getDaysInMonth(currentMonth)

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigateMonth("prev")} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
        <button onClick={() => navigateMonth("next")} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {daysOfWeek.map((day) => (
          <div key={day} className="h-10 flex items-center justify-center text-sm font-medium text-gray-500">
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
  )
}

// --- Main Component ---
function StudentCalendar() {
  // --- Auth ---
  const { userId, loading: authLoading } = useUserId();

  // --- State ---
  const [date, setDate] = React.useState<Date>(new Date())
  const [events, setEvents] = React.useState<Event[]>([])
  const [lectureSlots, setLectureSlots] = React.useState<LectureSlot[]>([])
  const [semesters, setSemesters] = React.useState<Semester[]>([
    {
      id: "sem1_2025",
      name: "Semester 1 2025",
      startDate: new Date("2025-02-10"),
      endDate: new Date("2025-06-21"),
      isActive: true,
    },
  ])
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isLectureDialogOpen, setIsLectureDialogOpen] = React.useState(false)
  const [isSemesterDialogOpen, setIsSemesterDialogOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = React.useState<string>("")
  const [timetableDate, setTimetableDate] = React.useState<Date>(new Date())
  const [currentTime, setCurrentTime] = React.useState<Date>(new Date())
  const [activeTab, setActiveTab] = React.useState<"calendar" | "timetable">("calendar")
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
    dayOfWeek: 1,
    timeSlot: "",
  })
  const [newSemester, setNewSemester] = React.useState({
    name: "",
    startDate: "",
    endDate: "",
  })
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // --- Time slots ---
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

  // --- Effects ---
  React.useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // --- API HANDLERS ---
  const getActiveSemester = () => semesters.find((s) => s.isActive) || semesters[0]

  const fetchLectures = React.useCallback(async () => {
    if (!userId) return;
    const active = getActiveSemester()
    if (!active) return
    setLoading(true)
    try {
      const data = await calendarApi.getLectures(active.id)
      setLectureSlots(data)
      setError(null)
    } catch (e: any) {
      setError(e.message || "Failed to fetch lectures")
    }
    setLoading(false)
  }, [userId, semesters])

  const fetchEvents = React.useCallback(async () => {
    if (!userId) return;
    const active = getActiveSemester()
    if (!active) return
    setLoading(true)
    try {
      const data = await calendarApi.getEvents(active.id)
      setEvents(data.map((e: any) => ({ ...e, date: new Date(e.date) })))
      setError(null)
    } catch (e: any) {
      setError(e.message || "Failed to fetch events")
    }
    setLoading(false)
  }, [userId, semesters])

  React.useEffect(() => {
    if (!userId) return
    fetchLectures()
    fetchEvents()
  }, [userId, fetchLectures, fetchEvents])

  // --- Add, Delete, Update handlers (always require userId!) ---
  const handleAddLecture = async () => {
    const active = getActiveSemester()
    if (!active || !newLecture.subject || !newLecture.timeSlot || !userId) return
    setLoading(true)
    try {
      const res = await calendarApi.addLecture( newLecture, active.id)
      setLectureSlots((prev) => [...prev, res])
      setNewLecture({ subject: "", lecturer: "", room: "", dayOfWeek: 1, timeSlot: "" })
      setIsLectureDialogOpen(false)
      setError(null)
    } catch (e: any) {
      setError(e.message || "Failed to add lecture")
    }
    setLoading(false)
  }

  const handleDeleteLecture = async (id: string) => {
    if (!userId) return;
    setLoading(true)
    try {
      await calendarApi.deleteLecture(id)
      setLectureSlots((prev) => prev.filter((l) => l.id !== id))
      setError(null)
    } catch (e: any) {
      setError(e.message || "Failed to delete lecture")
    }
    setLoading(false)
  }

  const handleAddEvent = async () => {
    const active = getActiveSemester()
    if (!active || !selectedDate || !newEvent.title || !userId) return
    setLoading(true)
    try {
      const eventPayload = { ...newEvent, date: selectedDate.toISOString() }
      const res = await calendarApi.addEvent(eventPayload, active.id)
      setEvents((prev) => [...prev, { ...res, date: new Date(res.date) }])
      setNewEvent({ title: "", description: "", type: "reminder", time: "", endTime: "" })
      setIsDialogOpen(false)
      setError(null)
    } catch (e: any) {
      setError(e.message || "Failed to add event")
    }
    setLoading(false)
  }

  const handleDeleteEvent = async (id: string) => {
    if (!userId) return;
    setLoading(true)
    try {
      await calendarApi.deleteEvent(id)
      setEvents((prev) => prev.filter((e) => e.id !== id))
      setError(null)
    } catch (e: any) {
      setError(e.message || "Failed to delete event")
    }
    setLoading(false)
  }

  // --- UI Logic ---
  const getEventsForDate = (d: Date) => events.filter((e) => e.date.toDateString() === d.toDateString())

  const getLecturesForDay = (d: Date) => {
    const active = getActiveSemester()
    if (d < active.startDate || d > active.endDate) return []
    return lectureSlots.filter((l) => l.dayOfWeek === d.getDay() && l.semesterId === active.id)
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
    setIsDialogOpen(true)
    setDate(d)
  }

  const handleTimeSlotClick = (slotStart: string) => {
    setSelectedTimeSlot(slotStart)
    setNewLecture({ ...newLecture, timeSlot: slotStart, dayOfWeek: timetableDate.getDay() })
    setIsLectureDialogOpen(true)
  }

  const handleAddSemester = () => {
    if (!newSemester.name || !newSemester.startDate || !newSemester.endDate) return
    setSemesters((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: newSemester.name,
        startDate: new Date(newSemester.startDate),
        endDate: new Date(newSemester.endDate),
        isActive: false,
      },
    ])
    setNewSemester({ name: "", startDate: "", endDate: "" })
  }

  const handleActivateSemester = (id: string) => {
    setSemesters((prev) => prev.map((s) => ({ ...s, isActive: s.id === id })))
    setLectureSlots((prev) => prev.filter((l) => l.semesterId === id))
  }

  const navigateTimetableDate = (dir: "prev" | "next") =>
    setTimetableDate((d) => {
      const nd = new Date(d)
      nd.setDate(d.getDate() + (dir === "next" ? 1 : -1))
      return nd
    })

  // --- Render ---
  if (authLoading) return <div className="text-center py-10">Loading user...</div>
  if (!userId) return <div className="text-center py-10">Please sign in to use the calendar.</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {loading && <div className="text-blue-700">Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}

        {/* header */}
        <header className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Student Calendar</h1>
            <p className="text-gray-600 mt-2">Manage your academic schedule and events</p>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "calendar" | "timetable")}
              className="w-full lg:w-auto"
            >
              <TabsList className="grid w-full grid-cols-2 lg:w-auto h-10">
                <TabsTrigger value="calendar" className="h-8">
                  Calendar View
                </TabsTrigger>
                <TabsTrigger value="timetable" className="h-8">
                  Daily Timetable
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex gap-3 justify-center lg:justify-end">
              <Button variant="outline" onClick={() => setIsSemesterDialogOpen(true)} className="h-10 px-4">
                <Settings className="h-4 w-4 mr-2" />
                Manage Semesters
              </Button>
              {activeTab === "timetable" && (
                <Button variant="outline" onClick={() => setIsLectureDialogOpen(true)} className="h-10 px-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lecture
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* calendar view */}
        {activeTab === "calendar" && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* calendar section */}
            <div className="xl:col-span-3 space-y-6">
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-center w-full">
                    <div className="w-full max-w-2xl">
                      <CustomCalendarGrid
                        selectedDate={date}
                        onDateClick={handleDateClick}
                        getEventsForDate={getEventsForDate}
                        getLecturesForDay={getLecturesForDay}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* legend */}
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3 text-sm">Event Types</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <LegendDot color="bg-red-200 border border-red-300" label="Exams" />
                    <LegendDot color="bg-blue-200 border border-blue-300" label="Assignments" />
                    <LegendDot color="bg-yellow-200 border border-yellow-300" label="Reminders" />
                    <LegendDot color="bg-green-200 border border-green-300" label="Classes/Lectures" />
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <LegendDot
                      color="bg-gradient-to-r from-red-200 via-blue-200 to-green-200 border border-purple-300"
                      label="Multiple event types"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            {/* sidebar */}
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
              currentTime={currentTime}
            />
          </div>
        )}

        {/* timetable view */}
        {activeTab === "timetable" && (
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Clock className="h-5 w-5" />
                  Lecture Timetable – {getActiveSemester().name}
                </CardTitle>
                <NavigationBar
                  timetableDate={timetableDate}
                  navigate={navigateTimetableDate}
                  resetToday={() => setTimetableDate(new Date())}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {lectureTimeSlots.map((slot) => {
                  const lecturesAtTime = getLecturesForDay(timetableDate).filter((l) => l.timeSlot === slot.start)
                  const currentSlot = isCurrentLectureSlot(slot.start)
                  return (
                    <TimeSlotRow
                      key={slot.start}
                      slot={slot}
                      isCurrent={currentSlot}
                      lectures={lecturesAtTime}
                      onDeleteLecture={handleDeleteLecture}
                      onClick={() => handleTimeSlotClick(slot.start)}
                    />
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* dialogs */}
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
          handleAddSemester={handleAddSemester}
          handleActivateSemester={handleActivateSemester}
        />
      </div>
    </div>
  )
}



// ------ Helper components below (same as before, but all in this file) ------

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-4 h-4 rounded-md ${color}`} />
      <span className="font-medium text-xs">{label}</span>
    </div>
  )
}

interface SidebarProps {
  date: Date | undefined
  getEventsForDate: (d: Date) => Event[]
  getLecturesForDay: (d: Date) => LectureSlot[]
  lectureTimeSlots: { start: string; end: string }[]
  getEventTypeIcon: (t: Event["type"]) => React.ReactNode
  getEventTypeColor: (t: Event["type"]) => string
  handleDeleteEvent: (id: string) => void
  handleDeleteLecture: (id: string) => void
  getActiveSemester: () => Semester
  currentTime: Date
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
}: SidebarProps) {
  return (
    <div className="xl:col-span-1 space-y-6">
      {/* events card */}
      <Card className="shadow-sm h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5" />
            {date ? `Events for ${format(date, "yyyy/MM/dd")}` : "Select a date"}
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

      {/* semester card */}
      <Card className="shadow-sm h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Current Semester</CardTitle>
          <p className="text-sm text-gray-600">{getActiveSemester().name}</p>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="space-y-2">
            <InfoRow label="Start:" value={format(getActiveSemester().startDate, "yyyy/MM/dd")} />
            <InfoRow label="End:" value={format(getActiveSemester().endDate, "yyyy/MM/dd")} />
          </div>
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3">Today's Lectures</h4>
            <div className="min-h-[100px] max-h-[150px] overflow-y-auto">
              {getLecturesForDay(new Date()).length ? (
                getLecturesForDay(new Date()).map((lec) => (
                  <LectureToday key={lec.id} lecture={lec} lectureTimeSlots={lectureTimeSlots} />
                ))
              ) : (
                <EmptyState message="No lectures today" small />
              )}
            </div>
          </div>
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

const EmptyState = ({
  message,
  small,
}: {
  message: string
  small?: boolean
}) => (
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
  const end = lectureTimeSlots.find((s) => s.start === lecture.timeSlot)?.end
  return (
    <div className="p-3 border rounded-lg bg-green-50 border-green-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-green-600" />
            <h4 className="font-medium text-sm truncate">{lecture.subject}</h4>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">
              Lecture
            </Badge>
          </div>
          <p className="text-xs text-gray-600 mb-1 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {lecture.timeSlot} – {end}
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
            <p className="text-xs text-gray-600 mb-1 flex items-center">
              <Clock className="h-3 w-3 mr-1" />
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
}: {
  lecture: LectureSlot
  lectureTimeSlots: { start: string; end: string }[]
}) {
  const end = lectureTimeSlots.find((s) => s.start === lecture.timeSlot)?.end ?? ""
  return (
    <div className="p-2 bg-green-50 rounded border border-green-200">
      <div className="font-medium text-sm truncate">{lecture.subject}</div>
      <div className="text-xs text-gray-600 truncate">
        {lecture.timeSlot} – {end} • {lecture.room}
      </div>
    </div>
  )
}

function TimeSlotRow({
  slot,
  isCurrent,
  lectures,
  onDeleteLecture,
  onClick,
}: {
  slot: { start: string; end: string }
  isCurrent: boolean
  lectures: LectureSlot[]
  onDeleteLecture: (id: string) => void
  onClick: () => void
}) {
  return (
    <div
      className={`flex items-center gap-4 p-4 border-l-4 cursor-pointer hover:bg-gray-50 transition-colors rounded-r-lg ${
        isCurrent ? "border-l-blue-500 bg-blue-50" : "border-l-gray-200 bg-white"
      }`}
      onClick={onClick}
    >
      <div
        className={`text-sm font-mono w-20 text-center ${isCurrent ? "text-blue-700 font-semibold" : "text-gray-500"}`}
      >
        <div className="font-medium">{slot.start}</div>
        <div className="text-xs opacity-75">{slot.end}</div>
      </div>
      <div className="flex-1 min-h-[60px] flex items-center">
        {lectures.length ? (
          <div className="w-full space-y-2">
            {lectures.map((lec) => (
              <div
                key={lec.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  isCurrent ? "bg-green-50 border-green-200" : "bg-white border-gray-200"
                }`}
              >
                <BookOpen className="h-4 w-4 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{lec.subject}</span>
                    {isCurrent && (
                      <Badge variant="default" className="bg-green-600 text-xs">
                        Live
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {lec.lecturer} • {lec.room}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteLecture(lec.id)
                  }}
                  className="text-red-600 hover:text-red-800 h-8 w-8 p-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-400 text-sm italic">Click to add lecture</div>
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
      <Button variant="outline" size="sm" onClick={() => navigate("prev")} className="h-9">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="text-sm font-medium min-w-[140px] text-center px-3 py-2 bg-gray-50 rounded border">
        {format(timetableDate, "EEEE, MMM d")}
      </div>
      <Button variant="outline" size="sm" onClick={() => navigate("next")} className="h-9">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={resetToday} className="h-9">
        Today
      </Button>
    </div>
  )
}

// ----- Input/Select/Textarea blocks -----

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
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-10" />
    </div>
  )
}

function TextareaBlock({
  label,
  id,
  value,
  onChange,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
}) {
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
        <SelectTrigger className="h-10">
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

// ---- Dialogs: Event, Lecture, Semester ----

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
            Add a new event for {selectedDate && format(selectedDate, "yyyy/MM/dd")}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10">
            Cancel
          </Button>
          <Button onClick={handleAddEvent} disabled={!newEvent.title} className="h-10">
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
  }
  setNewLecture: React.Dispatch<
    React.SetStateAction<{
      subject: string
      lecturer: string
      room: string
      dayOfWeek: number
      timeSlot: string
    }>
  >
  selectedTimeSlot: string
  handleAddLecture: () => void
}) {
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10">
            Cancel
          </Button>
          <Button onClick={handleAddLecture} disabled={!newLecture.subject} className="h-10">
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
  handleAddSemester,
  handleActivateSemester,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  semesters: Semester[]
  newSemester: { name: string; startDate: string; endDate: string }
  setNewSemester: React.Dispatch<React.SetStateAction<{ name: string; startDate: string; endDate: string }>>
  handleAddSemester: () => void
  handleActivateSemester: (id: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Semesters</DialogTitle>
          <DialogDescription>Create new semesters and switch between them</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* list */}
          <div className="space-y-2">
            <h4 className="font-medium">Current Semesters</h4>
            {semesters.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-medium">{s.name}</span>
                  {s.isActive && <Badge className="ml-2">Active</Badge>}
                  <p className="text-sm text-gray-600">
                    {format(s.startDate, "yyyy/MM/dd")} – {format(s.endDate, "yyyy/MM/dd")}
                  </p>
                </div>
                {!s.isActive && (
                  <Button variant="outline" size="sm" onClick={() => handleActivateSemester(s.id)} className="h-9">
                    Activate
                  </Button>
                )}
              </div>
            ))}
          </div>
          {/* add */}
          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium">Add New Semester</h4>
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
            <Button
              onClick={handleAddSemester}
              disabled={!newSemester.name || !newSemester.startDate || !newSemester.endDate}
              className="h-10"
            >
              Add Semester
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Export ---
export default StudentCalendar

// ----- Helper: Event Icon/Color -----
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
