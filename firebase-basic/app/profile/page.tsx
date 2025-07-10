// src/app/settings/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import {
  getAuth,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth'
import { get, onValue, ref } from 'firebase/database'
import { db } from '@/lib/firebase'
import { saveUserSettings } from '@/utils/SaveUserSettings'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/ui/page-header'
import { MessageSquareIcon, MoreVertical, UserIcon, TrendingUp, Clock, BookOpen, Calendar } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

// Sample data for the chart
const studyData = [
  { day: 'Mon', hours: 3.5, notes: 5 },
  { day: 'Tue', hours: 4.2, notes: 8 },
  { day: 'Wed', hours: 2.8, notes: 3 },
  { day: 'Thu', hours: 5.1, notes: 12 },
  { day: 'Fri', hours: 3.9, notes: 7 },
  { day: 'Sat', hours: 6.2, notes: 15 },
  { day: 'Sun', hours: 4.5, notes: 9 },
]

export default function ProfilePage() {
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([])
  const [formData, setFormData] = useState({
    name:        '',
    surname:     '',
    degree:      '',
    occupation:  '',
    hobbies:     '',
    description: '',
  })
  const [initialData, setInitialData] = useState(formData)
  const [passwords, setPasswords] = useState({
    current: '',
    new:     '',
    confirm: '',
  })

  // ── Load friends ──
  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFriends([])
        return
      }
      const uid = user.uid
      onValue(ref(db, `users/${uid}/Friends`), async (snap) => {
        const data = snap.val() || {}
        const ids = Object.entries(data)
          .filter(([_, v]) => v === true)
          .map(([id]) => id)
        const list: { id: string; name: string }[] = []
        await Promise.all(
          ids.map(async (fid) => {
            const nameSnap = await get(ref(db, `users/${fid}/UserSettings/name`))
            list.push({ id: fid, name: nameSnap.exists() ? nameSnap.val() : 'Unknown' })
          })
        )
        setFriends(list)
      })
    })
    return () => unsubscribe()
  }, [])

  // ── Load settings ──
  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return
      const uid = user.uid
      onValue(ref(db, `users/${uid}/UserSettings`), (snap) => {
        const data = snap.val() || {}
        const loaded = {
          name:        data.name        || '',
          surname:     data.surname     || '',
          degree:      data.degree      || '',
          occupation:  data.occupation  || '',
          hobbies:     Array.isArray(data.hobbies)
                          ? data.hobbies.join(', ')
                          : data.hobbies || '',
          description: data.description || '',
        }
        setFormData(loaded)
        setInitialData(loaded)
      })
    })
    return () => unsubscribe()
  }, [])

  // ── Handlers for Profile info ──
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: value }))
  }

  const handleSave = async () => {
    const user = getAuth().currentUser
    if (!user) return

    if (JSON.stringify(formData) === JSON.stringify(initialData)) {
      toast('No changes to save.')
      return
    }

    const payload = {
      ...formData,
      hobbies: formData.hobbies
        .split(',')
        .map(h => h.trim())
        .filter(h => h),
    }

    await saveUserSettings(user.uid, payload)
    setInitialData(formData)
    toast.success('Your settings have been saved.')
  }

  // ── Handlers for Change Password ──
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setPasswords(prev => ({ ...prev, [id]: value }))
  }

  const handlePasswordUpdate = async () => {
    const auth = getAuth()
    const user = auth.currentUser
    if (!user) return

    const { current, new: newPwd, confirm } = passwords
    if (!current || !newPwd || !confirm) {
      toast.error('Please fill in all password fields.')
      return
    }
    if (newPwd !== confirm) {
      toast.error('New password and confirmation do not match.')
      return
    }
    if (newPwd === current) {
      toast.error('New password must be different from your current one.')
      return
    }

    try {
      const cred = EmailAuthProvider.credential(user.email!, current)
      await reauthenticateWithCredential(user, cred)
      await updatePassword(user, newPwd)
      toast.success('Password updated successfully.')
      setPasswords({ current: '', new: '', confirm: '' })
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Settings"
        description="Manage your account information, security, and preferences."
      />

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
                    <CardDescription>
                      Update your personal information and academic details
                    </CardDescription>
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

              {/* Security */}
              <TabsContent value="password">
                <Card>
                  <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>
                      Enter your current password and choose a new one.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current">Current Password</Label>
                      <Input
                        id="current"
                        type="password"
                        value={passwords.current}
                        onChange={handlePasswordChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new">New Password</Label>
                      <Input
                        id="new"
                        type="password"
                        value={passwords.new}
                        onChange={handlePasswordChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm">Confirm New Password</Label>
                      <Input
                        id="confirm"
                        type="password"
                        value={passwords.confirm}
                        onChange={handlePasswordChange}
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={handlePasswordUpdate} className="ml-auto">
                      Change Password
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar: Achievements & Study Buddies */}
          <div className="xl:col-span-1 space-y-6">
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

        {/* Analytics Section */}
        <div className="space-y-6">
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
                      content={({ active, payload, label }) =>
                        active && payload && payload.length ? (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col">
                                <span className="text-[0.70rem] uppercase text-muted-foreground">{label}</span>
                                <span className="font-bold text-muted-foreground">{payload[0].value}h studied</span>
                              </div>
                            </div>
                          </div>
                        ) : null
                      }
                    />
                    <Area type="monotone" dataKey="hours" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorHours)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
