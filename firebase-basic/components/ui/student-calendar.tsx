"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";

/* ------------------------------------------------------------------
 *  StudentCalendar – South-African academic model
 *  • 50-minute lecture slots (hh:30 – hh+1:20)
 *  • Default Semester 1 (10 Feb – 21 Jun 2025)
 * ----------------------------------------------------------------*/

interface Event {
  id: string;
  title: string;
  description: string;
  date: Date;
  type: "exam" | "assignment" | "reminder" | "class";
  time?: string;
  endTime?: string;
}

interface LectureSlot {
  id: string;
  subject: string;
  lecturer: string;
  room: string;
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  timeSlot: string;  // start time key, e.g. "07:30"
  semesterId: string;
}

interface Semester {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

function StudentCalendar() {
  /* ---------- state ----------------------------------------------------- */
  const [date, setDate] = React.useState<Date>(new Date());
  const [events, setEvents] = React.useState<Event[]>([]);
  const [lectureSlots, setLectureSlots] = React.useState<LectureSlot[]>([]);
  const [semesters, setSemesters] = React.useState<Semester[]>([
    {
      id: "sem1_2025",
      name: "Semester 1 2025",
      startDate: new Date("2025-02-10"),
      endDate: new Date("2025-06-21"),
      isActive: true,
    },
  ]);

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isLectureDialogOpen, setIsLectureDialogOpen] = React.useState(false);
  const [isSemesterDialogOpen, setIsSemesterDialogOpen] = React.useState(false);

  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = React.useState<string>("");
  const [timetableDate, setTimetableDate] = React.useState<Date>(new Date());
  const [currentTime, setCurrentTime] = React.useState<Date>(new Date());
  const [activeTab, setActiveTab] = React.useState<"calendar" | "timetable">(
    "calendar",
  );

  const [newEvent, setNewEvent] = React.useState({
    title: "",
    description: "",
    type: "reminder" as Event["type"],
    time: "",
    endTime: "",
  });

  const [newLecture, setNewLecture] = React.useState({
    subject: "",
    lecturer: "",
    room: "",
    dayOfWeek: 1,
    timeSlot: "",
  });

  const [newSemester, setNewSemester] = React.useState({
    name: "",
    startDate: "",
    endDate: "",
  });

  /* ---------- constants ------------------------------------------------- */
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
  ];

  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  /* ---------- effects --------------------------------------------------- */
  React.useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  /* ---------- helpers & computed --------------------------------------- */
  const getActiveSemester = () =>
    semesters.find((s) => s.isActive) || semesters[0];

  const getEventsForDate = (d: Date) =>
    events.filter((e) => e.date.toDateString() === d.toDateString());

  const getLecturesForDay = (d: Date) => {
    const active = getActiveSemester();
    if (d < active.startDate || d > active.endDate) return [];
    return lectureSlots.filter(
      (l) => l.dayOfWeek === d.getDay() && l.semesterId === active.id,
    );
  };

  const isCurrentLectureSlot = (start: string) => {
    const today = new Date();
    if (format(today, "yyyy/MM/dd") !== format(timetableDate, "yyyy/MM/dd"))
      return false;
    const slot = lectureTimeSlots.find((s) => s.start === start);
    if (!slot) return false;
    const [sh, sm] = slot.start.split(":").map(Number);
    const [eh, em] = slot.end.split(":").map(Number);
    const begin = new Date(today);
    begin.setHours(sh, sm, 0, 0);
    const end = new Date(today);
    end.setHours(eh, em, 0, 0);
    return currentTime >= begin && currentTime <= end;
  };

  /* ---------- handlers -------------------------------------------------- */
  const handleDateClick = (d?: Date) => {
    if (!d) return;
    setSelectedDate(d);
    setIsDialogOpen(true);
    setDate(d);
  };

  const handleAddEvent = () => {
    if (!selectedDate || !newEvent.title) return;
    setEvents((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        title: newEvent.title,
        description: newEvent.description,
        date: selectedDate,
        type: newEvent.type,
        time: newEvent.time,
        endTime: newEvent.endTime,
      },
    ]);
    setNewEvent({
      title: "",
      description: "",
      type: "reminder",
      time: "",
      endTime: "",
    });
    setIsDialogOpen(false);
  };

  const handleDeleteEvent = (id: string) =>
    setEvents((prev) => prev.filter((e) => e.id !== id));

  const handleTimeSlotClick = (slotStart: string) => {
    setSelectedTimeSlot(slotStart);
    setNewLecture({
      ...newLecture,
      timeSlot: slotStart,
      dayOfWeek: timetableDate.getDay(),
    });
    setIsLectureDialogOpen(true);
  };

  const handleAddLecture = () => {
    if (!newLecture.subject || !newLecture.timeSlot) return;
    const active = getActiveSemester();
    setLectureSlots((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        subject: newLecture.subject,
        lecturer: newLecture.lecturer,
        room: newLecture.room,
        dayOfWeek: newLecture.dayOfWeek,
        timeSlot: newLecture.timeSlot,
        semesterId: active.id,
      },
    ]);
    setNewLecture({
      subject: "",
      lecturer: "",
      room: "",
      dayOfWeek: 1,
      timeSlot: "",
    });
    setIsLectureDialogOpen(false);
  };

  const handleDeleteLecture = (id: string) =>
    setLectureSlots((prev) => prev.filter((l) => l.id !== id));

  const handleAddSemester = () => {
    if (!newSemester.name || !newSemester.startDate || !newSemester.endDate)
      return;
    setSemesters((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: newSemester.name,
        startDate: new Date(newSemester.startDate),
        endDate: new Date(newSemester.endDate),
        isActive: false,
      },
    ]);
    setNewSemester({ name: "", startDate: "", endDate: "" });
  };

  const handleActivateSemester = (id: string) => {
    setSemesters((prev) =>
      prev.map((s) => ({ ...s, isActive: s.id === id })),
    );
    setLectureSlots((prev) => prev.filter((l) => l.semesterId === id));
  };

  const navigateTimetableDate = (dir: "prev" | "next") =>
    setTimetableDate((d) => {
      const nd = new Date(d);
      nd.setDate(d.getDate() + (dir === "next" ? 1 : -1));
      return nd;
    });

  /* ---------- ui helper maps ------------------------------------------- */
  const getEventTypeIcon = (t: Event["type"]) =>
    ({
      exam: <BookOpen className="h-4 w-4" />,
      assignment: <CalendarDays className="h-4 w-4" />,
      reminder: <AlertCircle className="h-4 w-4" />,
      class: <Clock className="h-4 w-4" />,
    }[t]);

  const getEventTypeColor = (t: Event["type"]) =>
    ({
      exam: "bg-red-100 text-red-800 border-red-200",
      assignment: "bg-blue-100 text-blue-800 border-blue-200",
      reminder: "bg-yellow-100 text-yellow-800 border-yellow-200",
      class: "bg-green-100 text-green-800 border-green-200",
    }[t]);

  const modifiers = {
    hasEvents: (d: Date) =>
      getEventsForDate(d).length > 0 || getLecturesForDay(d).length > 0,
  };
  const modifiersStyles = {
    hasEvents: { backgroundColor: "#e0f2fe", fontWeight: "bold" },
  };

  /* ---------- render ---------------------------------------------------- */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* -------- header */}
        <header className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Student Calendar</h1>
            <p className="text-gray-600 mt-2">
              Manage your academic schedule and events
            </p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <Tabs
              value={activeTab}
              onValueChange={(v) =>
                setActiveTab(v as "calendar" | "timetable")
              }
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
              <Button
                variant="outline"
                onClick={() => setIsSemesterDialogOpen(true)}
                className="h-10 px-4"
              >
                <Settings className="h-4 w-4 mr-2" />
                Manage Semesters
              </Button>
              {activeTab === "timetable" && (
                <Button
                  variant="outline"
                  onClick={() => setIsLectureDialogOpen(true)}
                  className="h-10 px-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lecture
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* -------- calendar view */}
        {activeTab === "calendar" && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* calendar section */}
            <div className="xl:col-span-3 space-y-6">
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-center w-full">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={handleDateClick}
                      onDayClick={handleDateClick}
                      className="w-full max-w-none [&_table]:w-full [&_td]:h-14 [&_th]:h-12 [&_button]:h-12 [&_button]:w-12"
                      modifiers={modifiers}
                      modifiersStyles={modifiersStyles}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* legend */}
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <LegendDot color="bg-red-200" label="Exams" />
                    <LegendDot color="bg-blue-200" label="Assignments" />
                    <LegendDot color="bg-yellow-200" label="Reminders" />
                    <LegendDot color="bg-green-200" label="Classes" />
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

        {/* -------- timetable view */}
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
                  const lecturesAtTime = getLecturesForDay(
                    timetableDate,
                  ).filter((l) => l.timeSlot === slot.start);
                  const currentSlot = isCurrentLectureSlot(slot.start);
                  return (
                    <TimeSlotRow
                      key={slot.start}
                      slot={slot}
                      isCurrent={currentSlot}
                      lectures={lecturesAtTime}
                      onDeleteLecture={handleDeleteLecture}
                      onClick={() => handleTimeSlotClick(slot.start)}
                    />
                  );
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
  );
}

/* ======================================================================== */
/*  Re-usable helper components                                              */
/* ======================================================================== */

/* ---------- legend dot --------------------------------------------------- */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="font-medium">{label}</span>
    </div>
  );
}

/* ---------- sidebar ------------------------------------------------------ */
interface SidebarProps {
  date: Date | undefined;
  getEventsForDate: (d: Date) => Event[];
  getLecturesForDay: (d: Date) => LectureSlot[];
  lectureTimeSlots: { start: string; end: string }[];
  getEventTypeIcon: (t: Event["type"]) => React.ReactNode;
  getEventTypeColor: (t: Event["type"]) => string;
  handleDeleteEvent: (id: string) => void;
  handleDeleteLecture: (id: string) => void;
  getActiveSemester: () => Semester;
  currentTime: Date;
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
            {date &&
            (getEventsForDate(date).length || getLecturesForDay(date).length) ? (
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
              <EmptyState
                message={
                  date
                    ? "No events or lectures for this date"
                    : "Select a date to view events"
                }
              />
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
            <InfoRow
              label="Start:"
              value={format(getActiveSemester().startDate, "yyyy/MM/dd")}
            />
            <InfoRow
              label="End:"
              value={format(getActiveSemester().endDate, "yyyy/MM/dd")}
            />
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3">Today's Lectures</h4>
            <div className="min-h-[100px] max-h-[150px] overflow-y-auto">
              {getLecturesForDay(new Date()).length ? (
                getLecturesForDay(new Date()).map((lec) => (
                  <LectureToday
                    key={lec.id}
                    lecture={lec}
                    lectureTimeSlots={lectureTimeSlots}
                  />
                ))
              ) : (
                <EmptyState message="No lectures today" small />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---- small helpers used in Sidebar ------------------------------------ */
const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-sm">
    <span className="text-gray-600">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

const EmptyState = ({
  message,
  small,
}: {
  message: string;
  small?: boolean;
}) => (
  <div
    className={
      small
        ? "flex items-center justify-center h-[100px] text-gray-500"
        : "flex items-center justify-center h-[200px] text-gray-500"
    }
  >
    <div className="text-center">
      <Clock
        className={
          small
            ? "h-6 w-6 mx-auto mb-1 text-gray-400"
            : "h-8 w-8 mx-auto mb-2 text-gray-400"
        }
      />
      <p className={small ? "text-xs" : "text-sm"}>{message}</p>
    </div>
  </div>
);

function LectureChip({
  lecture,
  lectureTimeSlots,
  handleDelete,
}: {
  lecture: LectureSlot;
  lectureTimeSlots: { start: string; end: string }[];
  handleDelete: () => void;
}) {
  const end = lectureTimeSlots.find((s) => s.start === lecture.timeSlot)?.end;
  return (
    <div className="p-3 border rounded-lg bg-green-50 border-green-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-green-600" />
            <h4 className="font-medium text-sm truncate">{lecture.subject}</h4>
            <Badge
              variant="outline"
              className="bg-green-100 text-green-800 border-green-300 text-xs"
            >
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
  );
}

function EventChip({
  event,
  getEventTypeIcon,
  getEventTypeColor,
  handleDelete,
}: {
  event: Event;
  getEventTypeIcon: (t: Event["type"]) => React.ReactNode;
  getEventTypeColor: (t: Event["type"]) => string;
  handleDelete: () => void;
}) {
  return (
    <div className="p-3 border rounded-lg bg-white">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {getEventTypeIcon(event.type)}
            <h4 className="font-medium text-sm truncate">{event.title}</h4>
            <Badge
              variant="outline"
              className={`${getEventTypeColor(event.type)} text-xs`}
            >
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
          {event.description && (
            <p className="text-xs text-gray-600 truncate">
              {event.description}
            </p>
          )}
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
  );
}

function LectureToday({
  lecture,
  lectureTimeSlots,
}: {
  lecture: LectureSlot;
  lectureTimeSlots: { start: string; end: string }[];
}) {
  const end =
    lectureTimeSlots.find((s) => s.start === lecture.timeSlot)?.end ?? "";
  return (
    <div className="p-2 bg-green-50 rounded border border-green-200">
      <div className="font-medium text-sm truncate">{lecture.subject}</div>
      <div className="text-xs text-gray-600 truncate">
        {lecture.timeSlot} – {end} • {lecture.room}
      </div>
    </div>
  );
}

/* ---------- timetable rows --------------------------------------------- */
function TimeSlotRow({
  slot,
  isCurrent,
  lectures,
  onDeleteLecture,
  onClick,
}: {
  slot: { start: string; end: string };
  isCurrent: boolean;
  lectures: LectureSlot[];
  onDeleteLecture: (id: string) => void;
  onClick: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-4 p-4 border-l-4 cursor-pointer hover:bg-gray-50 transition-colors rounded-r-lg ${
        isCurrent ? "border-l-blue-500 bg-blue-50" : "border-l-gray-200 bg-white"
      }`}
      onClick={onClick}
    >
      <div
        className={`text-sm font-mono w-20 text-center ${
          isCurrent ? "text-blue-700 font-semibold" : "text-gray-500"
        }`}
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
                  isCurrent
                    ? "bg-green-50 border-green-200"
                    : "bg-white border-gray-200"
                }`}
              >
                <BookOpen className="h-4 w-4 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{lec.subject}</span>
                    {isCurrent && (
                      <Badge
                        variant="default"
                        className="bg-green-600 text-xs"
                      >
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
                    e.stopPropagation();
                    onDeleteLecture(lec.id);
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
  );
}

/* ---------- timetable nav bar ------------------------------------------ */
function NavigationBar({
  timetableDate,
  navigate,
  resetToday,
}: {
  timetableDate: Date;
  navigate: (dir: "prev" | "next") => void;
  resetToday: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate("prev")}
        className="h-9"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="text-sm font-medium min-w-[140px] text-center px-3 py-2 bg-gray-50 rounded border">
        {format(timetableDate, "EEEE, MMM d")}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate("next")}
        className="h-9"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={resetToday}
        className="h-9"
      >
        Today
      </Button>
    </div>
  );
}

/* ---------- small field blocks ----------------------------------------- */
function InputBlock({
  label,
  id,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10"
      />
    </div>
  );
}

function TextareaBlock({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="resize-none"
      />
    </div>
  );
}

function SelectBlock({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: (string | { label: string; value: string })[];
}) {
  const opts = items.map((i) =>
    typeof i === "string"
      ? { label: i.charAt(0).toUpperCase() + i.slice(1), value: i }
      : i,
  );
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
  );
}

/* ---------- dialogs ----------------------------------------------------- */
// Event dialog
function EventDialog({
  open,
  onOpenChange,
  selectedDate,
  newEvent,
  setNewEvent,
  handleAddEvent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selectedDate: Date | null;
  newEvent: {
    title: string;
    description: string;
    type: Event["type"];
    time: string;
    endTime: string;
  };
  setNewEvent: React.Dispatch<
    React.SetStateAction<{
      title: string;
      description: string;
      type: Event["type"];
      time: string;
      endTime: string;
    }>
  >;
  handleAddEvent: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Event</DialogTitle>
          <DialogDescription>
            Add a new event for{" "}
            {selectedDate && format(selectedDate, "yyyy/MM/dd")}
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
            onChange={(v) =>
              setNewEvent({ ...newEvent, type: v as Event["type"] })
            }
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddEvent}
            disabled={!newEvent.title}
            className="h-10"
          >
            Add Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Lecture dialog
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
  open: boolean;
  onOpenChange: (o: boolean) => void;
  daysOfWeek: string[];
  lectureTimeSlots: { start: string; end: string }[];
  newLecture: {
    subject: string;
    lecturer: string;
    room: string;
    dayOfWeek: number;
    timeSlot: string;
  };
  setNewLecture: React.Dispatch<
    React.SetStateAction<{
      subject: string;
      lecturer: string;
      room: string;
      dayOfWeek: number;
      timeSlot: string;
    }>
  >;
  selectedTimeSlot: string;
  handleAddLecture: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Lecture</DialogTitle>
          <DialogDescription>
            Add a new lecture for {daysOfWeek[newLecture.dayOfWeek]} at{" "}
            {selectedTimeSlot}
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
            onChange={(v) =>
              setNewLecture({ ...newLecture, dayOfWeek: Number(v) })
            }
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddLecture}
            disabled={!newLecture.subject}
            className="h-10"
          >
            Add Lecture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Semester dialog
function SemesterDialog({
  open,
  onOpenChange,
  semesters,
  newSemester,
  setNewSemester,
  handleAddSemester,
  handleActivateSemester,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  semesters: Semester[];
  newSemester: { name: string; startDate: string; endDate: string };
  setNewSemester: React.Dispatch<
    React.SetStateAction<{ name: string; startDate: string; endDate: string }>
  >;
  handleAddSemester: () => void;
  handleActivateSemester: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Semesters</DialogTitle>
          <DialogDescription>
            Create new semesters and switch between them
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* list */}
          <div className="space-y-2">
            <h4 className="font-medium">Current Semesters</h4>
            {semesters.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <span className="font-medium">{s.name}</span>
                  {s.isActive && <Badge className="ml-2">Active</Badge>}
                  <p className="text-sm text-gray-600">
                    {format(s.startDate, "yyyy/MM/dd")} –{" "}
                    {format(s.endDate, "yyyy/MM/dd")}
                  </p>
                </div>
                {!s.isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleActivateSemester(s.id)}
                    className="h-9"
                  >
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
                onChange={(v) =>
                  setNewSemester({ ...newSemester, startDate: v })
                }
              />
              <InputBlock
                label="End Date"
                id="sem-end"
                type="date"
                value={newSemester.endDate}
                onChange={(v) =>
                  setNewSemester({ ...newSemester, endDate: v })
                }
              />
            </div>

            <Button
              onClick={handleAddSemester}
              disabled={
                !newSemester.name ||
                !newSemester.startDate ||
                !newSemester.endDate
              }
              className="h-10"
            >
              Add Semester
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export default StudentCalendar;
