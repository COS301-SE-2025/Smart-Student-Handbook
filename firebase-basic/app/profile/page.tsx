"use client"

import { saveUserSettings } from "@/utils/SaveUserSettings"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquareIcon, MoreVertical, UserIcon, TrendingUp, Clock, BookOpen, Calendar } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import type React from "react"
import { useEffect, useState } from "react"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { db } from "@/lib/firebase"
import { get, onValue, ref } from "firebase/database"
import { toast } from "sonner"

// Sample data for the chart
const studyData = [
  { day: "Mon", hours: 3.5, notes: 5 },
  { day: "Tue", hours: 4.2, notes: 8 },
  { day: "Wed", hours: 2.8, notes: 3 },
  { day: "Thu", hours: 5.1, notes: 12 },
  { day: "Fri", hours: 3.9, notes: 7 },
  { day: "Sat", hours: 6.2, notes: 15 },
  { day: "Sun", hours: 4.5, notes: 9 },
]

export default function ProfilePage() {
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([])
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    degree: "",
    occupation: "",
    hobbies: "",
    description: "",
  })

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
          friendIDs.map(async (fid) => {
            const nameRef = ref(db, `users/${fid}/UserSettings/name`)
            const nameSnap = await get(nameRef)
            const friendName = nameSnap.exists() ? nameSnap.val() : "Unknown"
            friendsList.push({ id: fid, name: friendName })
          }),
        )

        setFriends(friendsList)
      })
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const auth = getAuth()

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        return
      }

      const userID = user.uid
      const settingsRef = ref(db, `${userID}/UserSettings`)

      onValue(settingsRef, (snapshot) => {
        const data = snapshot.val()

        if (data) {
          setFormData({
            name: data.name || "",
            surname: data.surname || "",
            degree: data.degree || "",
            occupation: data.occupation || "",
            hobbies: Array.isArray(data.hobbies) ? data.hobbies.join(", ") : data.hobbies || "",
            description: data.description || "",
          })
        }
      })
    })

    return () => unsubscribe()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }))
  }

  const handleSave = async () => {
    const auth = getAuth()
    const user = auth.currentUser
    if (!user) {
      return
    }

    const userID = user.uid
    const formattedData = {
      ...formData,
      hobbies: formData.hobbies.split(",").map((h: string) => h.trim()),
    }

    await saveUserSettings(userID, formattedData)
    toast.success("Your settings have been saved.")
  }

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Profile Settings - Takes up 3 columns */}
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Notes Created</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">89</div>
              <p className="text-xs text-muted-foreground">+7 this week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Study Streak</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">23 days</div>
              <p className="text-xs text-muted-foreground">Keep it up!</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">29.2h</div>
              <p className="text-xs text-muted-foreground">4.2h daily average</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Study Progress</CardTitle>
            <CardDescription>Your daily study hours and notes created this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={studyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs fill-muted-foreground" axisLine={false} tickLine={false} />
                  <YAxis className="text-xs fill-muted-foreground" axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col">
                                <span className="text-[0.70rem] uppercase text-muted-foreground">{label}</span>
                                <span className="font-bold text-muted-foreground">{payload[0].value}h studied</span>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="hours"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorHours)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
