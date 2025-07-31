/* -------------------------------------------------------------------------- */
/*  app/profile/page.tsx – full implementation                                */
/* -------------------------------------------------------------------------- */

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
import { onValue, ref, set } from "firebase/database"
import { saveUserSettings } from "@/utils/SaveUserSettings"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/ui/page-header"
import { TrendingUp, Clock, BookOpen, Calendar } from "lucide-react"
import { toast } from "sonner"

/* 🔑 NEW – live seconds from SessionTimerProvider */
import { useSessionSeconds } from "@/components/providers/SessionTimerProvider"

/* -------------------------------------------------------------------------- */
/*  Types & helpers                                                           */
/* -------------------------------------------------------------------------- */

type Metrics = {
  totalStudyHours: number
  thisWeekHours: number
  notesCreated: number
  studyStreak: number
  lastUpdated: string
}

type FormState = {
  name: string
  surname: string
  degree: string
  occupation: string
  hobbies: string
  description: string
}

const DEFAULT_METRICS: Metrics = {
  totalStudyHours: 0,
  thisWeekHours: 0,
  notesCreated: 0,
  studyStreak: 0,
  lastUpdated: new Date(0).toISOString(),
}

const DEFAULT_FORM: FormState = {
  name: "",
  surname: "",
  degree: "",
  occupation: "",
  hobbies: "",
  description: "",
}

// Monday-as-start-of-week helpers (for live thisWeekHours calc)
function startOfWeek(d: Date) {
  const copy = new Date(d)
  const dow = (copy.getDay() + 6) % 7 // Mon=0 … Sun=6
  copy.setHours(0, 0, 0, 0)
  copy.setDate(copy.getDate() - dow)
  return copy
}
function isSameWeek(a: Date, b: Date) {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime()
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function ProfilePage() {
  /* ---------------- Live session seconds from provider ------------------ */
  const sessionSeconds = useSessionSeconds() // ⏱ whole-app timer

  /* ---------------- User & forms ---------------------------------------- */
  const [uid, setUid] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormState>(DEFAULT_FORM)
  const [savedForm, setSavedForm] = useState<FormState>(DEFAULT_FORM)

  const [baseMetrics, setBaseMetrics] = useState<Metrics>(DEFAULT_METRICS)
  const [notesCount, setNotesCount] = useState<number>(0)

  const [pwCurrent, setPwCurrent] = useState("")
  const [pwNew, setPwNew] = useState("")
  const [pwConfirm, setPwConfirm] = useState("")
  const pwConfirmOK = pwNew.length > 0 && pwNew === pwConfirm

  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(savedForm),
    [formData, savedForm],
  )

  const uidRef = useRef<string | null>(null)

  /* ---------------- Load user & realtime DB listeners ------------------- */
  useEffect(() => {
    const auth = getAuth()

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        /* ---------- logged in ---------- */
        setUid(user.uid)
        setUserEmail(user.email ?? null)
        uidRef.current = user.uid

        /* --- settings --- */
        onValue(ref(db, `users/${user.uid}/UserSettings`), (snap) => {
          const d = snap.val() || {}
          const upd: FormState = {
            name: d.name ?? "",
            surname: d.surname ?? "",
            degree: d.degree ?? "",
            occupation: d.occupation ?? "",
            hobbies: Array.isArray(d.hobbies) ? d.hobbies.join(", ") : d.hobbies ?? "",
            description: d.description ?? "",
          }
          setFormData(upd)
          setSavedForm(upd)
        })

        /* --- metrics --- */
        onValue(ref(db, `users/${user.uid}/metrics`), (snap) => {
          const v = snap.val()
          if (v) setBaseMetrics(v)
        })

        /* --- notes count --- */
        onValue(ref(db, `users/${user.uid}/notes`), (snap) => {
          const v = snap.val()
          setNotesCount(v ? Object.keys(v).length : 0)
        })
      } else {
        /* ---------- logged out ---------- */
        setUid(null)
        setUserEmail(null)
        uidRef.current = null
        setFormData(DEFAULT_FORM)
        setSavedForm(DEFAULT_FORM)
        setBaseMetrics(DEFAULT_METRICS)
        setNotesCount(0)
      }
    })

    return () => unsub()
  }, [])

  /* ---------------- Derived live metrics -------------------------------- */
  const live = useMemo(() => {
    const now = new Date()
    const last = new Date(baseMetrics.lastUpdated || 0)
    const thisWeekBase = isSameWeek(now, last) ? baseMetrics.thisWeekHours : 0

    return {
      totalStudyHours: baseMetrics.totalStudyHours + sessionSeconds / 3600,
      thisWeekHours: thisWeekBase + sessionSeconds / 3600,
      notesCreated: notesCount,
      studyStreak: baseMetrics.studyStreak,
    }
  }, [baseMetrics, sessionSeconds, notesCount])

  /* ---------------------------------------------------------------------- */
  /*  Handlers                                                              */
  /* ---------------------------------------------------------------------- */

  /* ----- account form updates ------------------------------------------ */
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { id, value } = e.target
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

  /* ----- save profile settings ----------------------------------------- */
  const handleSave = async () => {
    if (!uid) return
    if (!isDirty) {
      toast.info("No changes to save.")
      return
    }

    // canonicalize hobbies (trim + dedupe empty)
    const canonical = {
      ...formData,
      hobbies: formData.hobbies
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .join(", "),
    }

    const payload = {
      ...canonical,
      hobbies: canonical.hobbies.split(", ").filter(Boolean), // store array
    }

    await saveUserSettings(uid, payload)
    setSavedForm(canonical)
    toast.success("Your settings have been saved.")
  }

  /* ----- password change ------------------------------------------------ */
  async function handlePasswordUpdate() {
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
      const cred = EmailAuthProvider.credential(email, pwCurrent)
      await reauthenticateWithCredential(user, cred)
      await updatePassword(user, pwNew)
      toast.success("Password updated successfully.")
      setPwCurrent("")
      setPwNew("")
      setPwConfirm("")
    } catch (err: any) {
      const code = err?.code || ""
      if (code === "auth/wrong-password") toast.error("Your current password is incorrect.")
      else if (code === "auth/weak-password") toast.error("New password is too weak.")
      else if (code === "auth/too-many-requests") toast.error("Too many attempts. Please wait.")
      else if (code === "auth/requires-recent-login") toast.error("Please log out and try again.")
      else toast.error("Failed to update password.")
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-background">
      {/* header */}
      <PageHeader
        title="Settings"
        description="Manage your account information, security, and preferences."
      />

      <div className="container mx-auto max-w-7xl p-6 space-y-6">
        {/* ---------------------------------------------------------------------------- */}
        {/*  Tabs: Account / Security                                                   */}
        {/* ---------------------------------------------------------------------------- */}
        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="account" className="text-sm font-medium">
              Account Settings
            </TabsTrigger>
            <TabsTrigger value="password" className="text-sm font-medium">
              Security
            </TabsTrigger>
          </TabsList>

          {/* ---------------- Account tab ---------------- */}
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
                    placeholder="Tell us about yourself…"
                    rows={3}
                  />
                </div>
              </CardContent>

              <CardFooter className="flex gap-2">
                <Button onClick={handleSave} className="ml-auto" disabled={!uid}>
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* ---------------- Security tab ---------------- */}
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

        {/* ---------------------------------------------------------------------------- */}
        {/*  Analytics – stats cards                                                    */}
        {/* ---------------------------------------------------------------------------- */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* ---- Total Study Hours ---- */}
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

            {/* ---- Notes Created ---- */}
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

            {/* ---- Study Streak ---- */}
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

            {/* ---- This Week ---- */}
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
