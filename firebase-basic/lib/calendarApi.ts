// lib/calendarApi.ts
import { httpsCallable } from "firebase/functions"
import { fns } from "./firebase"    // ← use the renamed Functions instance

/* ─────────────── Local type declarations ─────────────── */

export interface LectureSlot {
  id: string
  subject: string
  lecturer: string
  room: string
  dayOfWeek: number
  timeSlot: string
  duration: number
  semesterId: string
}

export interface Event {
  id: string
  title: string
  description: string
  date: string
  type: "exam" | "assignment" | "reminder" | "class"
  time?: string
  endTime?: string
}

export interface Semester {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
}

/* ─────────────── Callable-based API ─────────────── */

export const calendarApi = {
  /* ----- Lectures ----- */
  getLectures: (semesterId: string) =>
    httpsCallable<{ semesterId: string }, LectureSlot[]>(fns, "getLectures")({
      semesterId,
    }).then((r) => r.data),

  addLecture: (lecture: Omit<LectureSlot, "id">, semesterId: string) =>
    httpsCallable<
      { semesterId: string; lecture: typeof lecture },
      LectureSlot
    >(fns, "addLecture")({ semesterId, lecture }).then((r) => r.data),

  deleteLecture: (lectureId: string) =>
    httpsCallable<{ lectureId: string }, { success: boolean }>(
      fns,
      "deleteLecture",
    )({ lectureId }).then((r) => r.data),

  /* ----- Events ----- */
  getEvents: (semesterId: string) =>
    httpsCallable<{ semesterId: string }, Event[]>(fns, "getEvents")({
      semesterId,
    }).then((r) => r.data),

  addEvent: (event: Omit<Event, "id"> & { date: string }, semesterId: string) =>
    httpsCallable<
      { semesterId: string; event: typeof event },
      Event
    >(fns, "addEvent")({ semesterId, event }).then((r) => r.data),

  deleteEvent: (eventId: string) =>
    httpsCallable<{ eventId: string }, { success: boolean }>(
      fns,
      "deleteEvent",
    )({ eventId }).then((r) => r.data),

  /* ----- Semesters ----- */
  getSemesters: () =>
    httpsCallable<{}, Semester[]>(fns, "getSemesters")({}).then(
      (r) => r.data,
    ),

  addSemester: (sem: { name: string; startDate: string; endDate: string }) =>
    httpsCallable<{ semester: typeof sem }, Semester>(fns, "addSemester")({
      semester: sem,
    }).then((r) => r.data),

  updateSemester: (
    semesterId: string,
    updates: Partial<{ name: string; startDate: string; endDate: string }>,
  ) =>
    httpsCallable<
      { semesterId: string; updates: typeof updates },
      Semester
    >(fns, "updateSemester")({ semesterId, updates }).then((r) => r.data),

  deleteSemester: (semesterId: string) =>
    httpsCallable<{ semesterId: string }, { success: boolean }>(
      fns,
      "deleteSemester",
    )({ semesterId }).then((r) => r.data),

  setActiveSemester: (semesterId: string) =>
    httpsCallable<{ semesterId: string }, { success: boolean }>(
      fns,
      "setActiveSemester",
    )({ semesterId }).then((r) => r.data),
}
