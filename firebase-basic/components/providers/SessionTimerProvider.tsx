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
import { ref, runTransaction } from "firebase/database"

/* ------------------------------------------------------------------ */
/* Config & helpers                                                   */
/* ------------------------------------------------------------------ */

const TICK_SECONDS = 1               // track precisely
const FLUSH_INTERVAL_SECONDS = 10    // persist frequently
const DAILY_STREAK_THRESHOLD_HOURS = 1

const nowISO = () => new Date().toISOString()

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
  // Monday = 0
  const dt = new Date(d)
  const dow = (dt.getDay() + 6) % 7
  dt.setHours(0, 0, 0, 0)
  dt.setDate(dt.getDate() - dow)
  return dt
}
function isSameWeek(a: Date, b: Date) {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime()
}
function round4(n: number) {
  return Math.round(n * 10_000) / 10_000
}

/* ------------------------------------------------------------------ */
/* Types                                                              */
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
  daily?: Record<string, number | { seconds?: number; hours?: number }>
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
  daily: {},
}

/* ------------------------------------------------------------------ */
/* LocalStorage fallback (protects against quick refresh/unload)      */
/* ------------------------------------------------------------------ */

const keyFor = (uid: string) => `ssh_timer_${uid}`

function readPending(uid: string): { pending: number; updatedAt: number } {
  try {
    const raw = localStorage.getItem(keyFor(uid))
    if (!raw) return { pending: 0, updatedAt: 0 }
    const parsed = JSON.parse(raw)
    return {
      pending: Number(parsed?.pending ?? 0),
      updatedAt: Number(parsed?.updatedAt ?? 0),
    }
  } catch {
    return { pending: 0, updatedAt: 0 }
  }
}

function writePending(uid: string, pending: number) {
  try {
    localStorage.setItem(keyFor(uid), JSON.stringify({ pending, updatedAt: Date.now() }))
  } catch {
    // ignore quota errors
  }
}

function clearPending(uid: string) {
  try {
    localStorage.removeItem(keyFor(uid))
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ */
/* Context                                                            */
/* ------------------------------------------------------------------ */

const SessionTimerCtx = createContext(0)
/** Seconds accumulated since the last successful DB flush (for live UI). */
export const useSessionSeconds = () => useContext(SessionTimerCtx)

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export function SessionTimerProvider({ children }: { children: ReactNode }) {
  const [seconds, setSeconds] = useState(0)

  const secondsRef = useRef(0)
  const uidRef = useRef<string | null>(null)
  const persistingRef = useRef(false)
  const lastUidRef = useRef<string | null>(null)

  /* -------------------- Core accumulator (UI tick) ------------------ */
  useEffect(() => {
    const id = window.setInterval(() => {
      const uid = uidRef.current
      if (!uid) return
      const visible = document.visibilityState === "visible"
      const focused = document.hasFocus()
      if (visible && focused) {
        secondsRef.current += TICK_SECONDS
        setSeconds((s) => s + TICK_SECONDS)
        // mirror to localStorage to survive sudden refresh/close
        writePending(uid, secondsRef.current)
      }
    }, TICK_SECONDS * 1000)
    return () => clearInterval(id)
  }, [])

  /* -------------------- Periodic + lifecycle flush ----------------- */
  useEffect(() => {
    const interval = window.setInterval(() => flush(), FLUSH_INTERVAL_SECONDS * 1000)

    const onHidden = () => {
      if (document.visibilityState === "hidden") flush()
    }
    const onBlur = () => flush()
    const onBeforeUnload = () => {
      // best-effort — localStorage is our safety net if this doesn’t finish
      flush()
    }

    document.addEventListener("visibilitychange", onHidden)
    window.addEventListener("blur", onBlur)
    window.addEventListener("beforeunload", onBeforeUnload)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onHidden)
      window.removeEventListener("blur", onBlur)
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
  }, [])

  /* -------------------- Auth: start/stop & recover ------------------ */
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (u) => {
      const newUid = u?.uid ?? null
      const prevUid = uidRef.current

      // If someone was logged in and we have unflushed seconds, flush them to that user.
      if (prevUid && secondsRef.current > 0) {
        await flushAmount(prevUid, secondsRef.current)
        // Do not touch secondsRef here; flushAmount will clear the specific storage
        // We’ll reset below when switching users.
      }

      // Switch to new user
      lastUidRef.current = prevUid
      uidRef.current = newUid

      // Reset local counters for the new session
      secondsRef.current = 0
      setSeconds(0)

      // If we have pending seconds in localStorage for the new user (e.g., crash/quick refresh),
      // recover them and push to DB right away.
      if (newUid) {
        const { pending, updatedAt } = readPending(newUid)
        // If the previous tab is still running, updatedAt will be fresh; we only recover if stale.
        const isStale = Date.now() - updatedAt > 3000
        if (pending > 0 && isStale) {
          secondsRef.current = pending
          setSeconds(pending)
          await flush() // persist the recovered seconds
        }
      }
    })
    return unsub
  }, [])

  /* -------------------- DB transaction helper ---------------------- */
  function accumulate(prevRaw: Metrics | null, addSeconds: number, at: Date): Metrics {
    const prev = prevRaw ?? DEFAULT_METRICS
    if (addSeconds <= 0) {
      return { ...prev, lastUpdated: at.toISOString() }
    }

    const today = ymd(at)
    const lastUpdated = prev.lastUpdated ? new Date(prev.lastUpdated) : new Date(0)
    const addHours = addSeconds / 3600

    // week rollover (Mon-based)
    const baseWeek = isSameWeek(at, lastUpdated) ? (prev.thisWeekHours || 0) : 0

    // today seconds rollover
    const baseTodaySecs = prev.todayDate === today ? (prev.todaySeconds || 0) : 0
    const nextTodaySecs = baseTodaySecs + addSeconds
    const nextTodayHrs = nextTodaySecs / 3600

    // streak only after ≥ 1h on that day
    let nextStreak = prev.studyStreak || 0
    let nextStreakQual = prev.streakLastQualifiedDate || ""
    if (nextTodayHrs >= DAILY_STREAK_THRESHOLD_HOURS) {
      if (prev.streakLastQualifiedDate !== today) {
        const yest = yesterday(at)
        nextStreak = prev.streakLastQualifiedDate === yest ? nextStreak + 1 : 1
        nextStreakQual = today
      }
    }

    // daily series stored as seconds
    const daily = { ...(prev.daily || {}) }
    const existing = daily[today]
    let oldSecs = 0
    if (typeof existing === "number") {
      oldSecs = Math.max(0, Number(existing) * 3600 || 0)
    } else if (existing && typeof existing === "object") {
      oldSecs = Math.max(0, Number(existing.seconds ?? (existing.hours ?? 0) * 3600))
    }
    daily[today] = { seconds: oldSecs + addSeconds }

    return {
      ...prev,
      totalStudyHours: round4((prev.totalStudyHours || 0) + addHours),
      thisWeekHours: round4(baseWeek + addHours),
      notesCreated: prev.notesCreated || 0,
      lastUpdated: at.toISOString(),
      todayDate: today,
      todaySeconds: nextTodaySecs,
      studyStreak: nextStreak,
      streakLastQualifiedDate: nextStreakQual,
      daily,
    }
  }

  /* -------------------- Flush APIs --------------------------------- */
  async function flush() {
    const uid = uidRef.current
    if (!uid || persistingRef.current) return
    const addSeconds = secondsRef.current
    if (addSeconds <= 0) return

    persistingRef.current = true
    try {
      const metricsRef = ref(db, `users/${uid}/metrics`)
      await runTransaction(metricsRef, (prev: Metrics | null) =>
        accumulate(prev, addSeconds, new Date()),
      )
      // success → reset local bucket & storage
      secondsRef.current = 0
      setSeconds(0)
      clearPending(uid)
    } catch {
      // swallow; will retry on next flush
    } finally {
      persistingRef.current = false
    }
  }

  /** Flush a specific amount for a specific user (used on logout). */
  async function flushAmount(uid: string, addSeconds: number) {
    if (!uid || addSeconds <= 0) return
    // Prevent overlapping writes
    while (persistingRef.current) {
      await new Promise((r) => setTimeout(r, 25))
    }
    persistingRef.current = true
    try {
      const metricsRef = ref(db, `users/${uid}/metrics`)
      await runTransaction(metricsRef, (prev: Metrics | null) =>
        accumulate(prev, addSeconds, new Date()),
      )
      clearPending(uid)
    } catch {
      // ignore; storage still has pending to recover later
    } finally {
      persistingRef.current = false
    }
  }

  return <SessionTimerCtx.Provider value={seconds}>{children}</SessionTimerCtx.Provider>
}
