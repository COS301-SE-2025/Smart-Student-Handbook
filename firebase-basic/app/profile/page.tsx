"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  getAuth,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth"
import { db } from "@/lib/firebase"
import { get, onValue, ref, set, update, type DataSnapshot } from "firebase/database"
import { saveUserSettings } from "@/utils/SaveUserSettings"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/ui/page-header"
import { TrendingUp, Clock, BookOpen, Calendar } from "lucide-react"
import { toast } from "sonner"

/* --------------------------- Types & Utilities --------------------------- */

type Metrics = {
  totalStudyHours: number
  thisWeekHours: number
  notesCreated: number
  studyStreak: number
  lastUpdated: string // ISO
  // Added to support strict "> 1 hour" daily streaks
  todayDate?: string // "YYYY-MM-DD" of the day we're accumulating
  todaySeconds?: number // cumulative seconds studied today (persists across autosaves)
  streakLastQualifiedDate?: string // last date (YYYY-MM-DD) where >1h was achieved
}

type FormState = {
  name: string
  surname: string
  degree: string
  occupation: string
  hobbies: string // comma separated in UI
  description: string
}

const DEFAULT_METRICS: Metrics = {
  totalStudyHours: 0,
  thisWeekHours: 0,
  notesCreated: 0,
  studyStreak: 0,
  lastUpdated: new Date(0).toISOString(),
  todayDate: "",
  todaySeconds: 0,
  streakLastQualifiedDate: "",
}

const DEFAULT_FORM: FormState = {
  name: "",
  surname: "",
  degree: "",
  occupation: "",
  hobbies: "",
  description: "",
}

// Get YYYY-MM-DD in the user's local time
function ymd(d: Date) {
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  const day = String(dt.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function yesterday(d: Date) {
  const y = new Date(d)
  y.setDate(y.getDate() - 1)
  return ymd(y)
}

// Monday as start of week
function startOfWeek(d: Date) {
  const dt = new Date(d)
  const day = (dt.getDay() + 6) % 7 // convert Sun=0..Sat=6 to Mon=0..Sun=6
  dt.setHours(0, 0, 0, 0)
  dt.setDate(dt.getDate() - day)
  return dt
}

function isSameWeek(a: Date, b: Date) {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime()
}

/** Strict daily threshold: must be > 1 hour (not "≥ 1") */
const DAILY_STREAK_THRESHOLD_HOURS = 1.0

// Convert DB settings payload to UI form (string fields)
function toFormStateFromDB(data: any): FormState {
  return {
    name: (data?.name ?? "").toString(),
    surname: (data?.surname ?? "").toString(),
    degree: (data?.degree ?? "").toString(),
    occupation: (data?.occupation ?? "").toString(),
    hobbies: Array.isArray(data?.hobbies) ? data.hobbies.join(", ") : (data?.hobbies ?? "").toString(),
    description: (data?.description ?? "").toString(),
  }
}

// Canonicalize form for equality comparison (trim + normalize hobbies)
function canonicalizeForm(form: FormState): FormState {
  const normHobbies = form.hobbies
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean)
    .join(", ")

  return {
    name: form.name.trim(),
    surname: form.surname.trim(),
    degree: form.degree.trim(),
    occupation: form.occupation.trim(),
    hobbies: normHobbies,
    description: form.description.trim(),
  }
}

function formsEqual(a: FormState, b: FormState) {
  const ca = canonicalizeForm(a)
  const cb = canonicalizeForm(b)
  return JSON.stringify(ca) === JSON.stringify(cb)
}

/* ------------------------------- Component ------------------------------ */

export default function ProfilePage() {
  const [uid, setUid] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Settings form
  const [formData, setFormData] = useState<FormState>(DEFAULT_FORM)
  // Last-saved form snapshot (for change detection)
  const [savedForm, setSavedForm] = useState<FormState>(DEFAULT_FORM)

  // Metrics state loaded from DB
  const [baseMetrics, setBaseMetrics] = useState<Metrics>(DEFAULT_METRICS)
  // Notes live count
  const [notesCount, setNotesCount] = useState<number>(0)
  // Track live session seconds while the tab is visible
  const [sessionSeconds, setSessionSeconds] = useState<number>(0)

  // Password form
  const [pwCurrent, setPwCurrent] = useState("")
  const [pwNew, setPwNew] = useState("")
  const [pwConfirm, setPwConfirm] = useState("")
  const pwConfirmOK = pwNew.length > 0 && pwNew === pwConfirm

  // Derived: is there anything to save for Account tab?
  const isDirty = useMemo(() => !formsEqual(formData, savedForm), [formData, savedForm])

  // Refs to use inside listeners/cleanup
  const uidRef = useRef<string | null>(null)
  const baseMetricsRef = useRef<Metrics>(DEFAULT_METRICS)
  const sessionSecondsRef = useRef<number>(0)
  const notesCountRef = useRef<number>(0)
  const autosaveTimerRef = useRef<number | null>(null)
  const persistLockRef = useRef<boolean>(false)

  // Keep refs in sync
  useEffect(() => {
    baseMetricsRef.current = baseMetrics
  }, [baseMetrics])
  useEffect(() => {
    sessionSecondsRef.current = sessionSeconds
  }, [sessionSeconds])
  useEffect(() => {
    notesCountRef.current = notesCount
  }, [notesCount])

  /* ------------------------- Load user + settings ------------------------ */

  useEffect(() => {
    const auth = getAuth()
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUid(user.uid)
        setUserEmail(user.email ?? null)
        uidRef.current = user.uid

        // Load settings (listen realtime)
        const settingsRef = ref(db, `users/${user.uid}/UserSettings`)
        const offSettings = onValue(settingsRef, (snapshot) => {
          const data = snapshot.val()
          const form = toFormStateFromDB(data ?? {})
          setFormData(form)
          setSavedForm(form) // reset "dirty" baseline to the latest from DB
        })

        // Load metrics (listen realtime)
        const metricsRef = ref(db, `users/${user.uid}/metrics`)
        const offMetrics = onValue(metricsRef, (snap) => {
          const val = snap.val() as Partial<Metrics> | null
          if (val) {
            const merged = { ...DEFAULT_METRICS, ...val }
            setBaseMetrics(merged)
          } else {
            setBaseMetrics(DEFAULT_METRICS)
          }
        })

        // Live notes count
        const notesRef = ref(db, `users/${user.uid}/notes`)
        const offNotes = onValue(notesRef, (snap: DataSnapshot) => {
          const v = snap.val()
          const count = v ? Object.keys(v).length : 0
          setNotesCount(count)
        })

        // Reset session timer on login
        setSessionSeconds(0)

        // Start autosave every 60s
        if (autosaveTimerRef.current == null) {
          autosaveTimerRef.current = window.setInterval(async () => {
            if (uidRef.current && sessionSecondsRef.current > 0) {
              await persistMetrics(uidRef.current)
            }
          }, 60_000)
        }

        // Cleanups on auth change
        return () => {
          offSettings()
          offMetrics()
          offNotes()
        }
      } else {
        // User signed out -> persist last session using last known uid
        if (uidRef.current) {
          try {
            await persistMetrics(uidRef.current)
          } catch {}
        }
        setUid(null)
        setUserEmail(null)
        uidRef.current = null
        setSessionSeconds(0)
        setBaseMetrics(DEFAULT_METRICS)
        setNotesCount(0)
        setFormData(DEFAULT_FORM)
        setSavedForm(DEFAULT_FORM)
      }
    })

    // Beforeunload safeguard (refresh/close)
    const handleBeforeUnload = () => {
      if (!uidRef.current) return
      void persistMetrics(uidRef.current)
    }
    window.addEventListener("beforeunload", handleBeforeUnload)

    // Flush when tab is hidden (background)
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && uidRef.current) {
        void persistMetrics(uidRef.current)
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      unsubAuth()
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibility)
      if (autosaveTimerRef.current != null) {
        window.clearInterval(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [])

  /* ---------------------- Lightweight session tracker -------------------- */

  useEffect(() => {
    // Tick every 5s only when tab is visible
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && uidRef.current) {
        setSessionSeconds((s) => s + 5)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  /* ----------------------------- Save settings --------------------------- */

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

  const handleSave = async () => {
    const auth = getAuth()
    const user = auth.currentUser
    if (!user) return

    // Edge case: No changes to save -> inform with sonner
    if (!isDirty) {
      toast.info("No changes to save.")
      return
    }

    // Prepare data for DB
    const canonical = canonicalizeForm(formData)
    const formattedData = {
      ...canonical,
      hobbies: canonical.hobbies.split(", ").filter(Boolean), // store as array
    }

    await saveUserSettings(user.uid, formattedData)
    setSavedForm(canonical) // reset dirty baseline
    toast.success("Your settings have been saved.")
  }

  /* -------------------------- Derived live metrics ----------------------- */

  const live = useMemo(() => {
    const now = new Date()
    const today = ymd(now)
    const last = new Date(baseMetrics.lastUpdated || 0)

    // Hours for session and week
    const sessionHours = sessionSeconds / 3600
    const thisWeekBase = isSameWeek(now, last) ? baseMetrics.thisWeekHours : 0

    // Today's cumulative (persisted + current session), for *live* streak preview
    const baseTodaySecs = baseMetrics.todayDate === today ? (baseMetrics.todaySeconds ?? 0) : 0
    const nextTodaySecs = baseTodaySecs + sessionSeconds
    const nextTodayHours = nextTodaySecs / 3600

    // Predict streak display if user crosses >1h today but hasn't persisted yet
    let displayStreak = baseMetrics.studyStreak
    if (nextTodayHours > DAILY_STREAK_THRESHOLD_HOURS) {
      if (baseMetrics.streakLastQualifiedDate !== today) {
        const yest = yesterday(now)
        displayStreak = baseMetrics.streakLastQualifiedDate === yest ? (baseMetrics.studyStreak || 0) + 1 : 1
      }
    }

    return {
      totalStudyHours: baseMetrics.totalStudyHours + sessionHours,
      thisWeekHours: thisWeekBase + sessionHours,
      notesCreated: notesCount,
      studyStreak: displayStreak,
      todayHours: nextTodayHours,
    }
  }, [baseMetrics, sessionSeconds, notesCount])

  /* ----------------------- Persist metrics (core fn) --------------------- */

  async function persistMetrics(userId: string) {
    if (persistLockRef.current) return
    persistLockRef.current = true

    try {
      const metricsAtStart = baseMetricsRef.current
      const sessionSecs = sessionSecondsRef.current
      const sessionHours = sessionSecs / 3600

      if (sessionSecs <= 0) {
        persistLockRef.current = false
        return
      }

      const now = new Date()
      const nowISO = now.toISOString()
      const today = ymd(now)
      const last = new Date(metricsAtStart.lastUpdated || 0)

      // Week rollover for thisWeekHours
      const thisWeekBase = isSameWeek(now, last) ? metricsAtStart.thisWeekHours || 0 : 0
      const nextThisWeekHours = thisWeekBase + sessionHours

      // Accumulate today's seconds for streak logic
      const baseTodaySecs = metricsAtStart.todayDate === today ? metricsAtStart.todaySeconds || 0 : 0
      const nextTodaySecs = baseTodaySecs + sessionSecs
      const nextTodayHours = nextTodaySecs / 3600

      // Streak logic: strictly > 1.0h to qualify for the day
      let nextStreak = metricsAtStart.studyStreak || 0
      let nextStreakQualifiedDate = metricsAtStart.streakLastQualifiedDate || ""

      if (nextTodayHours > DAILY_STREAK_THRESHOLD_HOURS) {
        if (metricsAtStart.streakLastQualifiedDate !== today) {
          const yest = yesterday(now)
          nextStreak = metricsAtStart.streakLastQualifiedDate === yest ? nextStreak + 1 : 1
          nextStreakQualifiedDate = today
        }
      }

      const nextTotal = (metricsAtStart.totalStudyHours || 0) + sessionHours
      const nextNotesCreated = notesCountRef.current

      const next: Metrics = {
        totalStudyHours: Number(nextTotal.toFixed(4)),
        thisWeekHours: Number(nextThisWeekHours.toFixed(4)),
        notesCreated: nextNotesCreated,
        studyStreak: nextStreak,
        lastUpdated: nowISO,
        todayDate: today,
        todaySeconds: nextTodaySecs,
        streakLastQualifiedDate: nextStreakQualifiedDate,
      }

      const metricsRef = ref(db, `users/${userId}/metrics`)
      const snap = await get(metricsRef)
      if (snap.exists()) {
        await update(metricsRef, next)
      } else {
        await set(metricsRef, { ...DEFAULT_METRICS, ...next })
      }

      // Reset session seconds after persist
      setSessionSeconds(0)
    } catch {
      // ignore best-effort background write errors
    } finally {
      persistLockRef.current = false
    }
  }

  /* --------------------------- Password Handlers ------------------------- */

  const handlePasswordUpdate = async () => {
    const auth = getAuth()
    const user = auth.currentUser
    if (!user) {
      toast.error("You need to be logged in to change your password.")
      return
    }

    if (!pwCurrent || !pwNew || !pwConfirm) {
      toast.error("Please fill in all password fields.")
      return
    }

    if (!pwConfirmOK) {
      toast.error("New password and confirmation do not match.")
      return
    }

    // Enforce: new password cannot be the same as the previous/current
    if (pwNew === pwCurrent) {
      toast.error("New password cannot be the same as your current password.")
      return
    }

    const email = userEmail || user.email
    if (!email) {
      toast.error("Your account has no email. Please re-login and try again.")
      return
    }

    try {
      // Reauthenticate with current password
      const cred = EmailAuthProvider.credential(email, pwCurrent)
      await reauthenticateWithCredential(user, cred)

      // Update password (Firebase will enforce its own minimum strength)
      await updatePassword(user, pwNew)

      toast.success("Password updated successfully.")
      setPwCurrent("")
      setPwNew("")
      setPwConfirm("")
    } catch (err: any) {
      const code = err?.code || ""
      if (code === "auth/wrong-password") {
        toast.error("Your current password is incorrect.")
      } else if (code === "auth/weak-password") {
        toast.error("New password is too weak. Please choose a stronger one.")
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please wait and try again.")
      } else if (code === "auth/requires-recent-login") {
        toast.error("Please log out and log back in, then try again.")
      } else {
        toast.error("Failed to update password.")
      }
    }
  }

  /* -------------------------------- Render ------------------------------- */

  return (
    <div className="min-h-screen bg-background">
      {/* page header */}
      <PageHeader title="Settings" description="Manage your account information, security, and preferences." />

      <div className="container mx-auto max-w-7xl p-6 space-y-6">
        {/* Main Content Grid */}
        <div className="w-full">
          {/* Profile Settings */}
          <div className="w-full">
            <Tabs defaultValue="account" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="account" className="text-sm font-medium">
                  Account Settings
                </TabsTrigger>
                <TabsTrigger value="password" className="text-sm font-medium">
                  Security
                </TabsTrigger>
              </TabsList>

              {/* Account tab */}
              <TabsContent value="account">
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Update your personal information and academic details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">First Name</Label>
                        <Input id="name" value={formData.name} onChange={handleChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="surname">Last Name</Label>
                        <Input id="surname" value={formData.surname} onChange={handleChange} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="degree">Degree Program</Label>
                        <Input id="degree" value={formData.degree} onChange={handleChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="occupation">Occupation</Label>
                        <Input id="occupation" value={formData.occupation} onChange={handleChange} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hobbies">Interests & Hobbies</Label>
                      <Input
                        id="hobbies"
                        value={formData.hobbies}
                        onChange={handleChange}
                        placeholder="Separate with commas"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Bio</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Tell us about yourself..."
                        rows={3}
                      />
                    </div>
                  </CardContent>
                  {/* Updated: button uses sonner for "no changes" notice, no inline text */}
                  <CardFooter className="flex gap-2">
                    <Button onClick={handleSave} className="ml-auto" disabled={!uid}>
                      Save Changes
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              {/* Security / Password tab */}
              <TabsContent value="password">
                <Card>
                  <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Enter your current password and your new password.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current">Current Password</Label>
                      <Input
                        id="current"
                        type="password"
                        value={pwCurrent}
                        onChange={(e) => setPwCurrent(e.target.value)}
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new">New Password</Label>
                      <Input
                        id="new"
                        type="password"
                        value={pwNew}
                        onChange={(e) => setPwNew(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm">Confirm New Password</Label>
                      <Input
                        id="confirm"
                        type="password"
                        value={pwConfirm}
                        onChange={(e) => setPwConfirm(e.target.value)}
                        autoComplete="new-password"
                      />
                      {!pwConfirmOK && pwConfirm.length > 0 && (
                        <p className="text-xs text-destructive mt-1">Passwords do not match.</p>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="ml-auto"
                      onClick={handlePasswordUpdate}
                      disabled={!pwCurrent || !pwNew || !pwConfirm || !pwConfirmOK}
                    >
                      Update Password
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Analytics Section - Stats Cards Only */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total Study Hours */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Study Hours</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{live.totalStudyHours.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">All your study time combined</p>
              </CardContent>
            </Card>

            {/* Notes Created */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Notes Created</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{live.notesCreated}</div>
                <p className="text-xs text-muted-foreground">Total notes you've written</p>
              </CardContent>
            </Card>

            {/* Study Streak */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Study Streak</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {live.studyStreak} {live.studyStreak === 1 ? "day" : "days"}
                </div>
                <p className="text-xs text-muted-foreground">Study 1+ hours daily to keep your streak</p>
              </CardContent>
            </Card>

            {/* This Week */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Week</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{live.thisWeekHours.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground">Hours studied this week</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
