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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  Clock,
  BookOpen,
  AlertCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Event {
  id: string;
  title: string;
  description: string;
  date: Date;
  type: "exam" | "assignment" | "reminder" | "class";
  time?: string;
  endTime?: string;
}

export default function StudentCalendar() {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [events, setEvents] = React.useState<Event[]>([]);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [timetableDate, setTimetableDate] = React.useState<Date>(new Date());
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [newEvent, setNewEvent] = React.useState({
    title: "",
    description: "",
    type: "reminder" as Event["type"],
    time: "",
    endTime: "",
  });

  /* live clock */
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  /* helpers */
  const getEventsForDate = (d: Date) =>
    events.filter((e) => e.date.toDateString() === d.toDateString());

  const getTimetableEvents = (d: Date) =>
    events
      .filter((e) => e.date.toDateString() === d.toDateString() && e.time)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  const handleDateClick = (d?: Date) => {
    if (!d) return;
    setSelectedDate(d);
    setIsDialogOpen(true);
    setDate(d);
  };

  const handleAddEvent = () => {
    if (!selectedDate || !newEvent.title) return;
    const evt: Event = {
      id: Date.now().toString(),
      title: newEvent.title,
      description: newEvent.description,
      date: selectedDate,
      type: newEvent.type,
      time: newEvent.time,
      endTime: newEvent.endTime,
    };
    setEvents([...events, evt]);
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
    setEvents(events.filter((e) => e.id !== id));

  const navigateTimetableDate = (dir: "prev" | "next") => {
    const d = new Date(timetableDate);
    d.setDate(d.getDate() + (dir === "next" ? 1 : -1));
    setTimetableDate(d);
  };

  const timeSlots = Array.from({ length: 24 }, (_, i) =>
    `${i.toString().padStart(2, "0")}:00`
  );

  /* UI helpers */
  const getEventTypeIcon = (t: Event["type"]) =>
    ({
      exam: <BookOpen className="h-5 w-5" />,
      assignment: <CalendarDays className="h-5 w-5" />,
      reminder: <AlertCircle className="h-5 w-5" />,
      class: <Clock className="h-5 w-5" />,
    }[t]);

  const getEventTypeColor = (t: Event["type"]) =>
    ({
      exam: "bg-red-100 text-red-800 border-red-200",
      assignment: "bg-blue-100 text-blue-800 border-blue-200",
      reminder: "bg-yellow-100 text-yellow-800 border-yellow-200",
      class: "bg-green-100 text-green-800 border-green-200",
    }[t]);

  /* Calendar modifiers */
  const modifiers = {
    hasEvents: (d: Date) => getEventsForDate(d).length > 0,
  };
  const modifiersStyles = {
    hasEvents: { backgroundColor: "#e0f2fe", fontWeight: "bold" },
  };

  return (
    <div className="space-y-10">
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-2 text-lg">
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="timetable">Daily Timetable</TabsTrigger>
        </TabsList>

        {/* Calendar tab */}
        <TabsContent value="calendar" className="space-y-10">
          <div className="flex flex-col lg:flex-row gap-10">
            {/* Calendar picker */}
            <div className="flex-1 min-w-[28rem]">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateClick}
                onDayClick={handleDateClick}
                className="w-full max-w-2xl lg:max-w-4xl rounded-md border shadow-xl"
                style={{ "--rdp-cell-size": "3rem" } as React.CSSProperties}
                modifiers={modifiers}
                modifiersStyles={modifiersStyles}
              />

              {/* Legend */}
              <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4 text-base">
                <LegendDot color="bg-red-200" label="Exams" />
                <LegendDot color="bg-blue-200" label="Assignments" />
                <LegendDot color="bg-yellow-200" label="Reminders" />
                <LegendDot color="bg-green-200" label="Classes" />
              </div>
            </div>

            {/* Events for selected day & upcoming */}
            <div className="flex-1 min-w-[28rem] space-y-6">
              {/* Events of the selected date */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <CalendarDays className="h-6 w-6" />
                    {date
                      ? `Events for ${format(date, "yyyy-MM-dd")}`
                      : "Select a date"}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4 p-4">
                  {date && getEventsForDate(date).length ? (
                    <div className="space-y-4">
                      {getEventsForDate(date).map((evt) => (
                        <EventRow
                          key={evt.id}
                          event={evt}
                          currentTime={currentTime}
                          getEventTypeIcon={getEventTypeIcon}
                          getEventTypeColor={getEventTypeColor}
                          onDelete={() => handleDeleteEvent(evt.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-6 text-base">
                      {date
                        ? "No events for this date"
                        : "Select a date to view events"}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming events */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Upcoming Events</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {events.length ? (
                    events
                      .slice()
                      .sort((a, b) => a.date.getTime() - b.date.getTime())
                      .slice(0, 5)
                      .map((evt) => (
                        <UpcomingEvent
                          key={evt.id}
                          event={evt}
                          getEventTypeIcon={getEventTypeIcon}
                          getEventTypeColor={getEventTypeColor}
                        />
                      ))
                  ) : (
                    <p className="text-gray-500 text-center py-6 text-base">
                      No upcoming events
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Timetable tab */}
        <TabsContent value="timetable" className="space-y-10">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <Clock className="h-6 w-6" />
                  Daily Timetable
                </CardTitle>
                <NavigationBar
                  timetableDate={timetableDate}
                  navigateTimetableDate={navigateTimetableDate}
                  resetToday={() => setTimetableDate(new Date())}
                />
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="space-y-2 max-h-[36rem] overflow-y-auto">
                {timeSlots.map((slot) => {
                  const eventsAtTime = getTimetableEvents(
                    timetableDate
                  ).filter((e) => e.time === slot);
                  const isCurrentHour =
                    timetableDate.toDateString() ===
                      new Date().toDateString() &&
                    Number(slot.split(":")[0]) === currentTime.getHours();

                  return (
                    <TimeSlotRow
                      key={slot}
                      slot={slot}
                      isCurrentHour={isCurrentHour}
                      eventsAtTime={eventsAtTime}
                      currentTime={currentTime}
                      getEventTypeIcon={getEventTypeIcon}
                      getEventTypeColor={getEventTypeColor}
                      onDelete={handleDeleteEvent}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add-event dialog */}
      <AddEventDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedDate={selectedDate}
        newEvent={newEvent}
        setNewEvent={setNewEvent}
        handleAddEvent={handleAddEvent}
      />
    </div>
  );
}



function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-base">
      <div className={`w-3 h-3 rounded ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function EventRow({
  event,
  currentTime,
  getEventTypeIcon,
  getEventTypeColor,
  onDelete,
}: {
  event: Event;
  currentTime: Date;
  getEventTypeIcon: (t: Event["type"]) => React.ReactNode;
  getEventTypeColor: (t: Event["type"]) => string;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between p-4 border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          {getEventTypeIcon(event.type)}
          <h4 className="font-medium text-base">{event.title}</h4>
          <Badge
            variant="outline"
            className={`${getEventTypeColor(event.type)} text-sm`}
          >
            {event.type}
          </Badge>
        </div>
        {event.time && (
          <p className="text-base text-gray-600 mb-1">
            <Clock className="h-4 w-4 inline mr-1" />
            {event.time}
            {event.endTime && ` - ${event.endTime}`}
          </p>
        )}
        {event.description && (
          <p className="text-base text-gray-600">{event.description}</p>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="text-red-600 hover:text-red-800"
      >
        <Trash2 className="h-5 w-5" />
      </Button>
    </div>
  );
}

function UpcomingEvent({
  event,
  getEventTypeIcon,
  getEventTypeColor,
}: {
  event: Event;
  getEventTypeIcon: (t: Event["type"]) => React.ReactNode;
  getEventTypeColor: (t: Event["type"]) => string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      {getEventTypeIcon(event.type)}
      <div className="flex-1">
        <p className="font-medium text-base">{event.title}</p>
        <p className="text-sm text-gray-600">
          {format(event.date, "yyyy-MM-dd")}
          {event.time && ` at ${event.time}`}
        </p>
      </div>
      <Badge
        variant="outline"
        className={`${getEventTypeColor(event.type)} text-sm`}
      >
        {event.type}
      </Badge>
    </div>
  );
}

function NavigationBar({
  timetableDate,
  navigateTimetableDate,
  resetToday,
}: {
  timetableDate: Date;
  navigateTimetableDate: (dir: "prev" | "next") => void;
  resetToday: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigateTimetableDate("prev")}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <div className="text-base font-medium min-w-[150px] text-center">
        {format(timetableDate, "EEEE, MMM d")}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigateTimetableDate("next")}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
      <Button variant="outline" size="sm" onClick={resetToday}>
        Today
      </Button>
    </div>
  );
}

function TimeSlotRow({
  slot,
  isCurrentHour,
  eventsAtTime,
  currentTime,
  getEventTypeIcon,
  getEventTypeColor,
  onDelete,
}: {
  slot: string;
  isCurrentHour: boolean;
  eventsAtTime: Event[];
  currentTime: Date;
  getEventTypeIcon: (t: Event["type"]) => React.ReactNode;
  getEventTypeColor: (t: Event["type"]) => string;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={`flex items-center gap-6 p-4 border-l-4 ${
        isCurrentHour ? "border-l-blue-500 bg-blue-50" : "border-l-gray-200"
      }`}
    >
      <div
        className={`text-base font-mono w-20 ${
          isCurrentHour ? "text-blue-700 font-semibold" : "text-gray-500"
        }`}
      >
        {slot}
      </div>
      <div className="flex-1">
        {eventsAtTime.length ? (
          <div className="space-y-2">
            {eventsAtTime.map((evt) => {
              const live =
                currentTime >=
                  new Date(`${format(evt.date, "yyyy-MM-dd")} ${evt.time}`) &&
                currentTime <=
                  new Date(
                    `${format(evt.date, "yyyy-MM-dd")} ${
                      evt.endTime || evt.time
                    }`
                  );

              return (
                <div
                  key={evt.id}
                  className={`flex items-center gap-3 p-3 rounded-md border ${
                    live ? "bg-green-50 border-green-200" : "bg-white"
                  }`}
                >
                  {getEventTypeIcon(evt.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-base">
                        {evt.title}
                      </span>
                      <Badge
                        variant="outline"
                        className={`${getEventTypeColor(evt.type)} text-sm`}
                      >
                        {evt.type}
                      </Badge>
                      {live && (
                        <Badge
                          variant="default"
                          className="bg-green-600 text-xs"
                          suppressHydrationWarning
                        >
                          Live
                        </Badge>
                      )}
                    </div>
                    {evt.endTime && (
                      <p className="text-sm text-gray-600">
                        Until {evt.endTime}
                      </p>
                    )}
                    {evt.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {evt.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(evt.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-gray-400 text-base">No events</div>
        )}
      </div>
    </div>
  );
}

function AddEventDialog({
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
            {selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              value={newEvent.title}
              onChange={(e) =>
                setNewEvent({ ...newEvent, title: e.target.value })
              }
              placeholder="Enter event title"
            />
          </div>

          {/* Type */}
          <div className="grid gap-2">
            <Label htmlFor="type">Event Type</Label>
            <Select
              value={newEvent.type}
              onValueChange={(v: Event["type"]) =>
                setNewEvent({ ...newEvent, type: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exam">Exam</SelectItem>
                <SelectItem value="assignment">Assignment</SelectItem>
                <SelectItem value="reminder">Reminder</SelectItem>
                <SelectItem value="class">Class</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="time">Start Time</Label>
              <Input
                id="time"
                type="time"
                value={newEvent.time}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, time: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={newEvent.endTime}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, endTime: e.target.value })
                }
              />
            </div>
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              rows={3}
              value={newEvent.description}
              onChange={(e) =>
                setNewEvent({ ...newEvent, description: e.target.value })
              }
              placeholder="Enter event description"
            />
          </div>
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
  );
}
