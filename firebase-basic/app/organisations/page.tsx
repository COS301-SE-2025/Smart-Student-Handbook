"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"
import { getDatabase, ref, get, set, remove } from "firebase/database"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Heart, Users, Lock, Globe, Plus, Crown, UserCheck, SearchX } from "lucide-react"
import { CreateOrganizationModal } from "@/components/ui/create-organization-modal"
import { useUserId } from "@/hooks/useUserId"

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

type Filter = "all" | "joined" | "public" | "private"

interface JoinLeaveResult {
  success: boolean
  transferred?: boolean
}

interface CreateOrgInput {
  name: string
  description: string
  isPrivate: boolean
  image?: string
  invitedUserIds: string[]
}

export default function OrganisationsPage() {
  const { userId, loading: authLoading } = useUserId()
  const searchParams = useSearchParams()
  const [orgsData, setOrgsData] = useState<(Org & { joined: boolean; role?: string })[]>([])
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")
  const [showCreate, setShowCreate] = useState(false)

  // Get search query from URL params
  const searchQuery = searchParams.get("search") || ""

  // Callable functions
  const getPublicOrgs = useMemo(() => httpsCallable<{}, Org[]>(fns, "getPublicOrganizations"), [])
  const getMyOrgs = useMemo(() => httpsCallable<{}, Org[]>(fns, "getUserOrganizations"), [])
  const joinOrg = useMemo(() => httpsCallable<{ orgId: string }, JoinLeaveResult>(fns, "joinOrganization"), [])
  const leaveOrg = useMemo(() => httpsCallable<{ orgId: string }, JoinLeaveResult>(fns, "leaveOrganization"), [])
  const createOrg = useMemo(() => httpsCallable<{ organization: CreateOrgInput }, Org>(fns, "createOrganization"), [])

  const db = getDatabase()

  // Fetch organisations and favorites
  const fetchOrgs = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [pubRes, myRes] = await Promise.all([getPublicOrgs({}), getMyOrgs({})])

      // Load favorites
      const favSnap = await get(ref(db, `userFavorites/${userId}`))
      const favObj = (favSnap.val() as Record<string, boolean>) || {}

      // Merge public + my lists
      const publicList = pubRes.data.map((o) => ({ ...o, joined: false }))
      const myList = myRes.data.map((o) => ({ ...o, joined: true }))

      const map = new Map<string, Org & { joined: boolean; role?: string }>()
      publicList.forEach((o) => map.set(o.id, o))
      myList.forEach((o) => {
        map.set(o.id, {
          ...o,
          role: o.members[userId!],
        })
      })

      setOrgsData(Array.from(map.values()))
      setFavorites(favObj)
    } catch (e) {
      console.error("❌ Failed to load organisations", e)
    } finally {
      setLoading(false)
    }
  }, [userId, getPublicOrgs, getMyOrgs, db])

  useEffect(() => {
    fetchOrgs()
  }, [fetchOrgs])

  // Toggle favorite flag
  const handleToggleFav = async (orgId: string) => {
    if (!userId) return
    const favRef = ref(db, `userFavorites/${userId}/${orgId}`)
    const snap = await get(favRef)

    if (snap.exists()) {
      await remove(favRef)
    } else {
      await set(favRef, true)
    }
    // Refresh both orgs & favorites immediately
    await fetchOrgs()
  }

  // Join / Leave handlers
  const handleJoin = async (orgId: string) => {
    try {
      await joinOrg({ orgId })
      await fetchOrgs()
    } catch (e) {
      console.error(e)
    }
  }
  const handleLeave = async (orgId: string) => {
    try {
      await leaveOrg({ orgId })
      await fetchOrgs()
    } catch (e) {
      console.error(e)
    }
  }
  const handleCreate = async (data: {
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
      setShowCreate(false)
      await fetchOrgs()
    } catch (e) {
      console.error(e)
    }
  }

  // Filtered & sorted list using search from URL params
  const orgs = useMemo(() => {
    return orgsData
      .filter((o) => {
        // Apply search filter from global header
        const matches =
          o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.description.toLowerCase().includes(searchQuery.toLowerCase())
        if (!matches) return false

        // Apply category filter
        if (filter === "joined") return o.joined
        if (filter === "public") return !o.isPrivate
        if (filter === "private") return o.isPrivate && o.joined
        return true
      })
      .sort((a, b) => {
        // Favorites first, then by name
        if (favorites[a.id] && !favorites[b.id]) return -1
        if (!favorites[a.id] && favorites[b.id]) return 1
        return a.name.localeCompare(b.name)
      })
  }, [orgsData, searchQuery, filter, favorites])

  if (authLoading || loading) {
    return <div className="p-6 text-center">Loading organisations…</div>
  }

  return (
    <div className="min-h-screen pt-14">
      {/* Clean Header Section */}
      <div className="border-b bg-background">
        <div className="p-8">
          {/* Title, Description and Create Button */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-8">
            <div className="flex-1 space-y-4">
              <h1 className="text-5xl font-bold tracking-tight">Organisations</h1>
              <p className="text-muted-foreground text-xl max-w-3xl leading-relaxed">
                Discover and join study groups to collaborate with other students. Create your own organization or
                browse existing ones to find your perfect study community.
              </p>
              {/* Search indicator */}
              {searchQuery && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 w-fit">
                  <SearchX className="h-4 w-4" />
                  <span>
                    Searching for: <span className="font-medium text-foreground">"{searchQuery}"</span>
                  </span>
                </div>
              )}
            </div>
            <div className="flex-shrink-0">
              <Button onClick={() => setShowCreate(true)} size="lg" className="shadow-lg px-10 py-4 text-lg h-auto">
                <Plus className="h-6 w-6 mr-3" />
                Create Organisation
              </Button>
            </div>
          </div>

          {/* Filter Buttons - Centered and Prominent */}
          <div className="flex justify-center">
            <div className="inline-flex gap-2 p-2 bg-muted/50 rounded-2xl border">
              {(["all", "joined", "public", "private"] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "default" : "ghost"}
                  size="lg"
                  onClick={() => setFilter(f)}
                  className={`px-8 py-3 text-base font-medium min-w-[120px] rounded-xl transition-all ${
                    filter === f ? "shadow-sm" : "hover:bg-background/80"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === "joined" && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {orgsData.filter((o) => o.joined).length}
                    </Badge>
                  )}
                  {f === "public" && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {orgsData.filter((o) => !o.isPrivate).length}
                    </Badge>
                  )}
                  {f === "private" && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {orgsData.filter((o) => o.isPrivate && o.joined).length}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-8">
        <div className="min-h-[calc(100vh-400px)]">
          {orgs.length === 0 ? (
            <div className="flex items-center justify-center min-h-[500px]">
              <div className="text-center py-20 px-8 max-w-2xl mx-auto">
                <div className="bg-gradient-to-br from-muted/30 to-muted/50 rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-8 shadow-lg">
                  {searchQuery ? (
                    <SearchX className="h-16 w-16 text-muted-foreground" />
                  ) : (
                    <Users className="h-16 w-16 text-muted-foreground" />
                  )}
                </div>
                <h3 className="text-3xl font-bold mb-6">
                  {searchQuery ? "No matching organisations found" : "No organisations found"}
                </h3>
                <p className="text-muted-foreground text-xl mb-8 max-w-lg mx-auto leading-relaxed">
                  {searchQuery
                    ? `No organisations match your search for "${searchQuery}". Try different keywords or browse all organisations.`
                    : "Be the first to create an organisation for your study group and start collaborating"}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowCreate(true)} size="lg" className="px-10 py-4 text-lg shadow-lg h-auto">
                    <Plus className="h-6 w-6 mr-3" />
                    Create Your First Organisation
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Results Summary */}
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <p className="text-lg text-muted-foreground">
                    {searchQuery ? (
                      <>
                        Found <span className="font-semibold text-foreground">{orgs.length}</span> organisation
                        {orgs.length !== 1 ? "s" : ""} matching{" "}
                        <span className="font-semibold text-foreground">"{searchQuery}"</span>
                      </>
                    ) : (
                      <>
                        Showing <span className="font-semibold text-foreground">{orgs.length}</span> organisation
                        {orgs.length !== 1 ? "s" : ""}
                      </>
                    )}
                    {filter !== "all" && (
                      <span className="ml-1">
                        in <span className="font-semibold text-foreground">{filter}</span>
                      </span>
                    )}
                  </p>
                  <div className="text-sm text-muted-foreground">
                    {favorites && Object.keys(favorites).length > 0 && (
                      <span>
                        {Object.values(favorites).filter(Boolean).length} favorite
                        {Object.values(favorites).filter(Boolean).length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Organizations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {orgs.map((o) => {
                  const isFav = !!favorites[o.id]
                  const memberCount = Object.keys(o.members).length

                  // Modern gradient backgrounds
                  const gradients = [
                    "bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-800/30",
                    "bg-gradient-to-br from-purple-50 to-pink-100 border-purple-200 dark:from-purple-950/20 dark:to-pink-950/20 dark:border-purple-800/30",
                    "bg-gradient-to-br from-green-50 to-emerald-100 border-green-200 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-800/30",
                    "bg-gradient-to-br from-orange-50 to-red-100 border-orange-200 dark:from-orange-950/20 dark:to-red-950/20 dark:border-orange-800/30",
                    "bg-gradient-to-br from-teal-50 to-cyan-100 border-teal-200 dark:from-teal-950/20 dark:to-cyan-950/20 dark:border-teal-800/30",
                    "bg-gradient-to-br from-violet-50 to-purple-100 border-violet-200 dark:from-violet-950/20 dark:to-purple-950/20 dark:border-violet-800/30",
                  ]
                  const gradientClass =
                    gradients[Math.abs(o.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) % gradients.length]

                  return (
                    <div
                      key={o.id}
                      className={`border-2 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 ${gradientClass} relative min-h-[360px] group hover:scale-[1.02]`}
                    >
                      {/* Favorite Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-6 right-6 h-10 w-10 rounded-full bg-white/80 hover:bg-white shadow-sm"
                        onClick={() => handleToggleFav(o.id)}
                      >
                        <Heart
                          className={`h-5 w-5 transition-colors ${
                            isFav ? "fill-red-500 text-red-500" : "text-muted-foreground hover:text-red-500"
                          }`}
                        />
                      </Button>

                      {/* Organization Header */}
                      <div className="flex items-start gap-4 mb-6">
                        <div className="relative">
                          <Avatar className="h-16 w-16 border-4 border-white shadow-lg">
                            <AvatarFallback className="text-xl font-bold bg-white text-primary">
                              {o.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {o.joined && (
                            <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                              <UserCheck className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-xl truncate mb-2">{o.name}</h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1 bg-white/60 rounded-full px-3 py-1">
                              <Users className="h-4 w-4" />
                              <span className="font-medium">
                                {memberCount} {memberCount === 1 ? "member" : "members"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 bg-white/60 rounded-full px-3 py-1">
                              {o.isPrivate ? (
                                <>
                                  <Lock className="h-4 w-4" />
                                  <span className="font-medium">Private</span>
                                </>
                              ) : (
                                <>
                                  <Globe className="h-4 w-4" />
                                  <span className="font-medium">Public</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="mb-6">
                        <p className="text-muted-foreground leading-relaxed line-clamp-3 min-h-[72px]">
                          {o.description || "No description provided for this organization."}
                        </p>
                      </div>

                      {/* Status Badges */}
                      <div className="flex flex-wrap gap-2 mb-6">
                        {o.joined && (
                          <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white px-3 py-1">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Joined
                          </Badge>
                        )}
                        {isFav && (
                          <Badge variant="destructive" className="px-3 py-1">
                            <Heart className="h-3 w-3 mr-1 fill-current" />
                            Favorite
                          </Badge>
                        )}
                        {o.role === "Admin" && (
                          <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1">
                            <Crown className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/30">
                        <div className="flex gap-3">
                          {o.joined ? (
                            <Link href={`/organisations/${o.id}/notes`}>
                              <Button size="lg" className="shadow-md">
                                View Notes
                              </Button>
                            </Link>
                          ) : (
                            !o.isPrivate && (
                              <Button size="lg" onClick={() => handleJoin(o.id)} className="shadow-md">
                                Join Organisation
                              </Button>
                            )
                          )}

                          {o.joined && (
                            <Button
                              size="lg"
                              variant="outline"
                              onClick={() => handleLeave(o.id)}
                              className="bg-white/80 hover:bg-white"
                            >
                              Leave
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <CreateOrganizationModal open={showCreate} onOpenChange={setShowCreate} onCreateOrganization={handleCreate} />
    </div>
  )
}
