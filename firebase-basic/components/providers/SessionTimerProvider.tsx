"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { db } from "@/lib/firebase"
import { get, ref, set, update } from "firebase/database"

/* ------------------------------------------------------------------ */
/* Helpers (same logic your Profile page was using)                   */
/* ------------------------------------------------------------------ */

function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
function yesterday(d: Date) {
  const y = new Date(d)
  y.setDate(y.getDate() - 1)
  return ymd(y)
}
function startOfWeek(d: Date) {
  const dt = new Date(d)
  const dow = (dt.getDay() + 6) % 7
  dt.setHours(0, 0, 0, 0)
  dt.setDate(dt.getDate() - dow)
  return dt
}
function isSameWeek(a: Date, b: Date) {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime()
}

const DAILY_STREAK_THRESHOLD_HOURS = 1

/* ------------------------------------------------------------------ */
/* Types & defaults (copied from Profile page)                        */
/* ------------------------------------------------------------------ */

export type Metrics = {
  totalStudyHours: number
  thisWeekHours: number
  notesCreated: number
  studyStreak: number
  lastUpdated: string
  todayDate?: string
  todaySeconds?: number
  streakLastQualifiedDate?: string
}
export const DEFAULT_METRICS: Metrics = {
  totalStudyHours: 0,
  thisWeekHours: 0,
  notesCreated: 0,
  studyStreak: 0,
  lastUpdated: new Date(0).toISOString(),
  todayDate: "",
  todaySeconds: 0,
  streakLastQualifiedDate: "",
}

/* ------------------------------------------------------------------ */
/* Context & hook                                                     */
/* ------------------------------------------------------------------ */

const SessionTimerCtx = createContext(0)
export const useSessionSeconds = () => useContext(SessionTimerCtx)

/* ------------------------------------------------------------------ */
/* Provider                                                           */
/* ------------------------------------------------------------------ */

export function SessionTimerProvider({ children }: { children: ReactNode }) {
  const [seconds, setSeconds] = useState(0)

  const secondsRef = useRef(0)
  const uidRef = useRef<string | null>(null)
  const persistLock = useRef(false)

  /* -------------------- Auth change → reset local counter ---------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (u) => {
      uidRef.current = u?.uid ?? null
      secondsRef.current = 0
      setSeconds(0)
    })
    return unsub
  }, [])

  /* -------------------- Tick every 5 s while tab visible ----------- */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && uidRef.current) {
        secondsRef.current += 5
        setSeconds((s) => s + 5)
      }
    }, 5_000)
    return () => clearInterval(id)
  }, [])

  /* -------------------- Persist every minute + on unload ----------- */
  useEffect(() => {
    const persistInterval = window.setInterval(flush, 60_000)

    window.addEventListener("beforeunload", flush)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush()
    })

    return () => {
      clearInterval(persistInterval)
      window.removeEventListener("beforeunload", flush)
    }
  }, [])

  /* -------------------- Flush helper ------------------------------- */
  async function flush() {
    if (!uidRef.current || secondsRef.current === 0 || persistLock.current) return
    persistLock.current = true

    try {
      const userId = uidRef.current
      const sessionSecs = secondsRef.current
      const sessionHrs = sessionSecs / 3600

      const metricsRef = ref(db, `users/${userId}/metrics`)
      const snap = await get(metricsRef)
      const prev: Partial<Metrics> = snap.exists() ? snap.val() : {}

      const now = new Date()
      const nowISO = now.toISOString()
      const today = ymd(now)
      const last = new Date(prev.lastUpdated ?? 0)

      const thisWeekBase = isSameWeek(now, last) ? prev.thisWeekHours ?? 0 : 0
      const nextThisWeekHrs = thisWeekBase + sessionHrs

      const baseTodaySecs = prev.todayDate === today ? prev.todaySeconds ?? 0 : 0
      const nextTodaySecs = baseTodaySecs + sessionSecs
      const nextTodayHrs = nextTodaySecs / 3600

      let nextStreak = prev.studyStreak ?? 0
      let nextStreakQual = prev.streakLastQualifiedDate ?? ""

      if (nextTodayHrs > DAILY_STREAK_THRESHOLD_HOURS) {
        if (prev.streakLastQualifiedDate !== today) {
          const yest = yesterday(now)
          nextStreak = prev.streakLastQualifiedDate === yest ? nextStreak + 1 : 1
          nextStreakQual = today
        }
      }

      const next: Metrics = {
        totalStudyHours: Number(((prev.totalStudyHours ?? 0) + sessionHrs).toFixed(4)),
        thisWeekHours: Number(nextThisWeekHrs.toFixed(4)),
        notesCreated: prev.notesCreated ?? 0, // notes update elsewhere
        studyStreak: nextStreak,
        lastUpdated: nowISO,
        todayDate: today,
        todaySeconds: nextTodaySecs,
        streakLastQualifiedDate: nextStreakQual,
      }

      if (snap.exists()) await update(metricsRef, next)
      else await set(metricsRef, { ...DEFAULT_METRICS, ...next })

      /* reset local session counter */
      secondsRef.current = 0
      setSeconds(0)
    } catch {
      /* silent on purpose */
    } finally {
      persistLock.current = false
    }
  }

  /* -------------------- Provider value ----------------------------- */
  return <SessionTimerCtx.Provider value={seconds}>{children}</SessionTimerCtx.Provider>
}
