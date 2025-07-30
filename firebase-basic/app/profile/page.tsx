"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  getAuth,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth"
import { get, onValue, ref, set } from "firebase/database"
import { db } from "@/lib/firebase"
import { saveUserSettings } from "@/utils/SaveUserSettings"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/ui/page-header"
import { MessageSquareIcon, MoreVertical, UserIcon, TrendingUp, Clock, BookOpen, Calendar, Plus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface UserMetrics {
  totalStudyHours: number
  notesCreated: number
  studyStreak: number
  thisWeekHours: number
  lastUpdated: string
}

export default function ProfilePage() {
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([])
  const [metrics, setMetrics] = useState<UserMetrics>({
    totalStudyHours: 0,
    notesCreated: 0,
    studyStreak: 0,
    thisWeekHours: 0,
    lastUpdated: new Date().toISOString(),
  })
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    degree: "",
    occupation: "",
    hobbies: "",
    description: 
    
  })
  const [initialData, setInitialData] = useState(formData)
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  })
  const [newMetric, setNewMetric] = useState({
    studyHours: "",
    notes: "",
  })
  const [isMetricDialogOpen, setIsMetricDialogOpen] = useState(false)

  // --- Load friends ---
  useEffect(() => {
    const auth = getAuth()

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setFriends([])
        return
      }

      const userID = user.uid
      const friendsRef = ref(db, `users/${userID}/Friends`)

      onValue(friendsRef, async (snapshot) => {
        const friendsData = snapshot.val()
        if (!friendsData) {
          setFriends([])
          return
        }

        const friendIDs = Object.entries(friendsData)
          .filter(([_, val]) => val === true)
          .map(([id]) => id)

        const friendsList: { id: string; name: string }[] = []

        await Promise.all(

          ids.map(async (fid) => {
            const nameSnap = await get(ref(db, `users/${fid}/UserSettings/name`))
            list.push({ id: fid, name: nameSnap.exists() ? nameSnap.val() : "Unknown" })
          }),
        )

        setFriends(friendsList)
      })
    })

    return () => unsubscribe()
  }, [])

  // --- Load settings ---
  useEffect(() => {
    const auth = getAuth()

    const unsubscribe = onAuthStateChanged(auth, (user) => {

      if (!user) return
      const uid = user.uid
      onValue(ref(db, `users/${uid}/UserSettings`), (snap) => {
        const data = snap.val() || {}
        const loaded = {
          name: data.name || "",
          surname: data.surname || "",
          degree: data.degree || "",
          occupation: data.occupation || "",
          hobbies: Array.isArray(data.hobbies) ? data.hobbies.join(", ") : data.hobbies || "",
          description: data.description || "",
        }
      })
    })

    return () => unsubscribe()
  }, [])

  // --- Load metrics in real-time ---
  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return
      const uid = user.uid
      onValue(ref(db, `users/${uid}/Metrics`), (snap) => {
        const data = snap.val()
        if (data) {
          setMetrics(data)
        } else {
          // Initialize metrics if missing
          const initialMetrics: UserMetrics = {
            totalStudyHours: 0,
            notesCreated: 0,
            studyStreak: 0,
            thisWeekHours: 0,
            lastUpdated: new Date().toISOString(),
          }
          setMetrics(initialMetrics)
          set(ref(db, `users/${uid}/Metrics`), initialMetrics)
        }
      })
    })
    return () => unsubscribe()
  }, [])

  // --- Handlers for Profile info ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

  const handleSave = async () => {
    const user = getAuth().currentUser
    if (!user) return

    if (JSON.stringify(formData) === JSON.stringify(initialData)) {
      toast("No changes to save.")
      return
    }

    const payload = {
      ...formData,
      hobbies: formData.hobbies
        .split(",")
        .map((h) => h.trim())
        .filter((h) => h),
    }

    await saveUserSettings(user.uid, payload)
    setInitialData(formData)
    toast.success("Your settings have been saved.")
  }

  // --- Handlers for Change Password ---
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setPasswords((prev) => ({ ...prev, [id]: value }))
  }

  const handlePasswordUpdate = async () => {
    const auth = getAuth()
    const user = auth.currentUser
    if (!user) return

    const { current, new: newPwd, confirm } = passwords

    if (!current || !newPwd || !confirm) {
      toast.error("Please fill in all password fields.")
      return
    }

    if (newPwd !== confirm) {
      toast.error("New password and confirmation do not match.")
      return
    }

    if (newPwd === current) {
      toast.error("New password must be different from your current one.")
      return
    }

    try {
      const cred = EmailAuthProvider.credential(user.email!, current)
      await reauthenticateWithCredential(user, cred)
      await updatePassword(user, newPwd)
      toast.success("Password updated successfully.")
      setPasswords({ current: "", new: "", confirm: "" })
    } catch (err: any) {
      toast.error(err.message)
    }

    await saveUserSettings(userID, formattedData)
    toast.success("Your settings have been saved.")
  }

  // --- Handlers for Metrics ---
  const handleMetricChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setNewMetric((prev) => ({ ...prev, [id]: value }))
  }

  const handleAddMetrics = async () => {
    const user = getAuth().currentUser
    if (!user) return

    const studyHours = Number.parseFloat(newMetric.studyHours) || 0
    const notes = Number.parseInt(newMetric.notes) || 0

    if (studyHours <= 0 && notes <= 0) {
      toast.error("Please enter valid values for study hours or notes.")
      return
    }

    try {
      const updatedMetrics: UserMetrics = {
        totalStudyHours: metrics.totalStudyHours + studyHours,
        notesCreated: metrics.notesCreated + notes,
        studyStreak: calculateStreak(metrics.lastUpdated),
        thisWeekHours: calculateThisWeekHours(metrics.thisWeekHours, studyHours, metrics.lastUpdated),
        lastUpdated: new Date().toISOString(),
      }

      await set(ref(db, `users/${user.uid}/Metrics`), updatedMetrics)
      setMetrics(updatedMetrics)
      setNewMetric({ studyHours: "", notes: "" })
      setIsMetricDialogOpen(false)
      toast.success("Metrics updated successfully!")
    } catch (error) {
      toast.error("Failed to update metrics.")
    }
  }

  const calculateStreak = (lastUpdated: string): number => {
    const lastDate = new Date(lastUpdated)
    const today = new Date()
    const diffTime = Math.abs(today.getTime() - lastDate.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    // If last update was today or yesterday, increment streak, else reset
    if (diffDays <= 1) {
      return metrics.studyStreak + 1
    } else if (diffDays === 2) {
      return metrics.studyStreak // same streak if updated yesterday
    } else {
      return 1 // reset streak
    }
  }

  const calculateThisWeekHours = (currentWeekHours: number, newHours: number, lastUpdated: string): number => {
    const lastDate = new Date(lastUpdated)
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())

    // If last update was this week, add to current week hours
    if (lastDate >= startOfWeek) {
      return currentWeekHours + newHours
    } else {
      return newHours // new week, start fresh
    }
  }

  const getDailyAverage = (): string => {
    return (metrics.thisWeekHours / 7).toFixed(1)
  }

  return (
    <div className="min-h-screen bg-background">

      <PageHeader title="Settings" description="Manage your account information, security, and preferences." />
      <div className="container mx-auto max-w-7xl p-6 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Profile & Security Tabs */}
          <div className="xl:col-span-3">
            <Tabs defaultValue="account" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="account" className="text-sm font-medium">
                  Account Settings
                </TabsTrigger>
                <TabsTrigger value="password" className="text-sm font-medium">
                  Security
                </TabsTrigger>
              </TabsList>

              {/* Account Settings */}
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
                      <Label htmlFor="name">First Name</Label>
                      <Input id="name" value={formData.name} onChange={handleChange} />
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
                  <CardFooter>
                    <Button onClick={handleSave} className="ml-auto">
                      Save Changes
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              {/* Security */}
              <TabsContent value="password">
                <Card>
                  <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Enter your current password and choose a new one.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current">Current Password</Label>
                      <Input id="current" type="password" value={passwords.current} onChange={handlePasswordChange} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">

                      <Label htmlFor="new">New Password</Label>
                      <Input id="new" type="password" value={passwords.new} onChange={handlePasswordChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm">Confirm New Password</Label>
                      <Input id="confirm" type="password" value={passwords.confirm} onChange={handlePasswordChange} />
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
                <CardFooter>
                  <Button onClick={handleSave} className="ml-auto">
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="password">
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>Update your password to keep your account secure</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current">Current Password</Label>
                    <Input id="current" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new">New Password</Label>
                    <Input id="new" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirm New Password</Label>
                    <Input id="confirm" type="password" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="ml-auto">Update Password</Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar Content - Takes up 1 column */}
        <div className="xl:col-span-1 space-y-6">
          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
              <CardDescription>Your academic badges and milestones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">🏆 Best Achiever</Badge>
                <Badge variant="outline">⚡ Fast Coder</Badge>
                <Badge variant="outline">🔬 Researcher</Badge>
                <Badge variant="outline">💻 GitHub Enthusiast</Badge>
                <Badge variant="outline">📚 Bookworm</Badge>
                <Badge variant="outline">🎯 Goal Setter</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Friends List */}
          <Card>
            <CardHeader>
              <CardTitle>Study Buddies</CardTitle>
              <CardDescription>Connect with your classmates and study partners</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {friends.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No study buddies yet. Start connecting with classmates!
                  </p>
                ) : (
                  friends.map(({ id, name }) => (
                    <div
                      key={id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserIcon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-sm">{name}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <MessageSquareIcon className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Profile</DropdownMenuItem>
                            <DropdownMenuItem>Send Message</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">Remove Friend</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analytics Section - Stats + Chart */}
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Study Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">127.5</div>
              <p className="text-xs text-muted-foreground">+12% from last month</p>
            </CardContent>
          </Card>

        {/* Analytics Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Study Analytics</h2>
              <p className="text-muted-foreground">Track your learning progress and achievements</p>
            </div>
            <Dialog open={isMetricDialogOpen} onOpenChange={setIsMetricDialogOpen}>
          
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Study Progress</DialogTitle>
                  <DialogDescription>Record your study hours and notes created today</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="studyHours">Study Hours</Label>
                    <Input
                      id="studyHours"
                      type="number"
                      step="0.5"
                      min="0"
                      value={newMetric.studyHours}
                      onChange={handleMetricChange}
                      placeholder="e.g., 2.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes Created</Label>
                    <Input
                      id="notes"
                      type="number"
                      min="0"
                      value={newMetric.notes}
                      onChange={handleMetricChange}
                      placeholder="e.g., 5"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsMetricDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddMetrics}>Add Progress</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Study Hours</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalStudyHours.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.totalStudyHours > 0 ? "Keep up the great work!" : "Start tracking your progress"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Notes Created</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.notesCreated}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.notesCreated > 0 ? "Great documentation!" : "Start creating notes"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Study Streak</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.studyStreak} days</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.studyStreak > 0 ? "Keep it up!" : "Start your streak today"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Week</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.thisWeekHours.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground">{getDailyAverage()}h daily average</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
