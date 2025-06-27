"use client"

import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar, FileText, Heart, Plus, Share2, Star } from "lucide-react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { CreateOrganizationModal } from "@/components/ui/create-organization-modal"
import { Users, Lock, Globe } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { httpsCallable } from "firebase/functions"
import { getAuth, onAuthStateChanged } from "firebase/auth"
//import { db, functions } from "@/lib/firebase"
import { fns } from "@/lib/firebase"
import { getDatabase, ref, get } from "firebase/database"
import { useUserId } from "@/hooks/useUserId"
import { PageHeader } from "@/components/ui/page-header"


interface Org {
  id: string
  ownerId: string
  name: string
  description: string
  isPrivate: boolean
  image?: string
  members: Record<string, "Admin" | "Member">
  createdAt?: number
}

interface CreateOrgInput {
  name: string
  description: string
  isPrivate: boolean
  image?: string
  invitedUserIds: string[]
}

const notebooks = [
  {
    title: "COS301 Computer Science Fundamentals",
    tag: "LECTURE",
    tagType: "important",
    timestamp: "Today at 2:30PM",
    likes: 1,
  },
  {
    title: "COS701 AI & Machine Learning Concepts",
    tag: "RESEARCH",
    tagType: "",
    timestamp: "Yesterday",
    likes: 1,
  },
  {
    title: "COS221 Database System Architecture",
    tag: "LECTURE",
    tagType: "",
    timestamp: "2 days ago",
    likes: 1,
  },
  {
    title: "COS301 Software Engineering Principles",
    tag: "EXAM",
    tagType: "important",
    timestamp: "1 week ago",
    likes: 1,
  },
]

const friends = [
  { name: "Ndhlovu Tanaka", role: "Student" },
  { name: "Takudzwa Magunda", role: "Lecturer" },
]

const upcomingEvents = [
  { title: "COS301", type: "lecture", date: "Sat, 5 May", time: "08:00" },
  { title: "COS332", type: "exam", date: "Tue, 5 June", time: "08:00" },
]

const studyHours = [2, 5, 8] // Representing hours for 3 days

export default function DashboardPage() {
  const { userId, loading: authLoading } = useUserId()
  const [userName, setUserName] = useState<string>("")
  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return
      // take their displayName or fallback to email prefix
      const raw = user.displayName || user.email?.split("@")[0] || "Student"
      setUserName(raw.charAt(0).toUpperCase() + raw.slice(1))
    })
    return unsubscribe
  }, [])
  const [organizations, setOrganizations] = useState<(Org & { joined: boolean; role?: string })[]>([])
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Callable functions
  const getMyOrgs = useMemo(() => httpsCallable<{}, Org[]>(fns, "getUserOrganizations"), [])
  const createOrg = useMemo(() => httpsCallable<{ organization: CreateOrgInput }, Org>(fns, "createOrganization"), [])

  const db = getDatabase()

  // Fetch user's organizations and favorites
  const fetchOrganizations = useCallback(async () => {
    if (!userId) return
    setLoadingOrgs(true)
    try {
      // Get user's organizations
      const myRes = await getMyOrgs({})
      const myOrgs = myRes.data.map((o) => ({
        ...o,
        joined: true,
        role: o.members[userId!],
      }))

      // Load favorites
      const favSnap = await get(ref(db, `userFavorites/${userId}`))
      const favObj = (favSnap.val() as Record<string, boolean>) || {}

      setOrganizations(myOrgs)
      setFavorites(favObj)
    } catch (e) {
      console.error("❌ Failed to load organizations", e)
      setOrganizations([])
    } finally {
      setLoadingOrgs(false)
    }
  }, [userId, getMyOrgs, db])

  useEffect(() => {
    fetchOrganizations()
  }, [fetchOrganizations])

  const handleCreateOrganization = async (data: {
    name: string
    description: string
    isPrivate: boolean
    selectedFriends: string[]
    organizationImage?: string
  }) => {
    try {
      await createOrg({
        organization: {
          name: data.name,
          description: data.description,
          isPrivate: data.isPrivate,
          image: data.organizationImage,
          invitedUserIds: data.selectedFriends,
        },
      })
      setShowCreateModal(false)
      await fetchOrganizations() // Refresh the organizations list
    } catch (e) {
      console.error("Failed to create organization:", e)
    }
  }

  // Sort organizations with favorites first
  const sortedOrganizations = useMemo(() => {
    return organizations.sort((a, b) => {
      // Favorites first, then by name
      if (favorites[a.id] && !favorites[b.id]) return -1
      if (!favorites[a.id] && favorites[b.id]) return 1
      return a.name.localeCompare(b.name)
    })
  }, [organizations, favorites])

  // Generate gradient colors for organizations
  const getOrgGradient = (orgId: string) => {
    const gradients = [
      "bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-800/30",
      "bg-gradient-to-br from-purple-50 to-pink-100 border-purple-200 dark:from-purple-950/20 dark:to-pink-950/20 dark:border-purple-800/30",
      "bg-gradient-to-br from-green-50 to-emerald-100 border-green-200 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-800/30",
      "bg-gradient-to-br from-orange-50 to-red-100 border-orange-200 dark:from-orange-950/20 dark:to-red-950/20 dark:border-orange-800/30",
      "bg-gradient-to-br from-teal-50 to-cyan-100 border-teal-200 dark:from-teal-950/20 dark:to-cyan-950/20 dark:border-teal-800/30",
      "bg-gradient-to-br from-violet-50 to-purple-100 border-violet-200 dark:from-violet-950/20 dark:to-purple-950/20 dark:border-violet-800/30",
    ]
    return gradients[Math.abs(orgId.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) % gradients.length]
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Welcome banner */}
      <PageHeader
        title={`Welcome ${userName}`}
        description="Here’s an overview of your notebooks, study buddies, events, and more."
      />
    <div className="p-6">
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* My Notebooks Section */}
        <div className="col-span-1 bg-card p-6 rounded-lg shadow-sm border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">My Notebooks</h2>
            <div className="flex gap-2">
              <Link href="/notes">
                <Button variant="ghost" size="icon">
                  <Plus className="h-5 w-5" />
                </Button>
              </Link>
              <Button variant="ghost" size="sm">
                Filter
              </Button>
              <Button variant="ghost" size="sm">
                Sort
              </Button>
              <Button variant="ghost" size="sm">
                Tags
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {notebooks.map((notebook) => (
              <Link href="/notes" key={`${notebook.title}-${notebook.timestamp}`}>
                <div className="border-b py-3 hover:bg-muted/50 transition-colors rounded-md px-2">
                  <div className="flex flex-col w-full">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{notebook.title}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon">
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Star className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${notebook.tagType === "important" ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"}`}
                      >
                        {notebook.tag}
                      </span>
                      <span>{notebook.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Button variant="ghost" size="sm" className="text-muted-foreground h-8">
                        <Heart className="h-4 w-4 mr-1" />
                        {notebook.likes}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-muted-foreground h-8">
                        <Share2 className="h-4 w-4 mr-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Second Column - Friends and My Organisations */}
        <div className="col-span-1 space-y-6">
          {/* Friends Section */}
          <div className="bg-card p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Friends</h2>
              <Link href="#">
                <Button variant="ghost" size="icon">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>+</AvatarFallback>
                  </Avatar>
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {friends.map((friend) => (
                <Link href="#" key={friend.name}>
                  <div className="flex items-center justify-between hover:bg-muted/50 transition-colors p-3 rounded-md">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{friend.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{friend.name}</p>
                        <p className="text-sm text-muted-foreground">{friend.role}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon">
                      <div className="flex gap-1">
                        <span className="h-1 w-1 bg-muted-foreground rounded-full"></span>
                        <span className="h-1 w-1 bg-muted-foreground rounded-full"></span>
                        <span className="h-1 w-1 bg-muted-foreground rounded-full"></span>
                      </div>
                    </Button>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* My Organisations Section */}
          <div className="bg-card p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">My Organisations</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3">
              {sortedOrganizations.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-3">You haven't joined any organisations</p>
                  <Link href="/organisations">
                    <Button size="sm">Browse Organisations</Button>
                  </Link>
                </div>
              ) : (
                sortedOrganizations.slice(0, 3).map((org) => {
                  const memberCount = Object.keys(org.members).length

                  return (
                    <Link href={`/organisations/${org.id}/notes`} key={org.id}>
                      <div className="border rounded-xl p-4 hover:shadow-md hover:border-primary/20 transition-all duration-200 bg-card">
                        <div className="flex items-center gap-3 mb-3">
                          <Avatar className="h-10 w-10 border">
                            <AvatarFallback className="text-sm font-medium bg-muted text-foreground">
                              {org.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate text-foreground">{org.name}</h3>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>{memberCount}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {org.isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                                <span>{org.isPrivate ? "Private" : "Public"}</span>
                              </div>
                            </div>
                          </div>
                          <Badge variant={org.role === "Admin" ? "default" : "secondary"} className="text-xs px-2 py-1">
                            {org.role}
                          </Badge>
                        </div>
                        {org.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {org.description}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })
              )}
              {sortedOrganizations.length > 3 && (
                <div className="text-center mt-4">
                  <Link href="/organisations">
                    <Button variant="outline" size="sm">
                      View All Organisations
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Third Column - Upcoming Events and Study Hours */}
        <div className="col-span-1 space-y-6">
          {/* Upcoming Events Section */}
          <div className="bg-card p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Upcoming Events</h2>
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <Link href="/calendar" key={event.title}>
                  <div className="flex items-center gap-3 hover:bg-muted/50 transition-colors p-3 rounded-md">
                    <div className="p-2 bg-amber-100 text-amber-700 rounded-md">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {event.title} {event.type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {event.date} {event.time}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Total Study Hours Section */}
          <div className="bg-card p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Total Study Hours</h2>
            <div className="flex items-end gap-3 h-24">
              {studyHours.map((hours, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <div
                    className="bg-gradient-to-t from-amber-500 to-amber-400 w-8 rounded-t-md transition-all duration-300 hover:from-amber-600 hover:to-amber-500"
                    style={{ height: `${Math.max(hours * 8, 8)}px` }}
                  ></div>
                  <span className="text-xs text-muted-foreground">{hours}h</span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Total this week: {studyHours.reduce((a, b) => a + b, 0)} hours</p>
            </div>
          </div>
        </div>
      </div>

      <CreateOrganizationModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreateOrganization={handleCreateOrganization}
      />
    </div>
    </div>
  )
}
