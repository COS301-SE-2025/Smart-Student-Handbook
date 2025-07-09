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
import { Heart, Users, Lock, Globe, Plus, Crown, UserCheck, SearchX, Loader2 } from "lucide-react"
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

  const [joiningOrgs, setJoiningOrgs] = useState<Set<string>>(new Set())
  const [leavingOrgs, setLeavingOrgs] = useState<Set<string>>(new Set())

  const searchQuery = searchParams.get("search") || ""

  const getPublicOrgs = useMemo(() => httpsCallable<{}, Org[]>(fns, "getPublicOrganizations"), [])
  const getMyOrgs = useMemo(() => httpsCallable<{}, Org[]>(fns, "getUserOrganizations"), [])
  const joinOrg = useMemo(() => httpsCallable<{ orgId: string }, JoinLeaveResult>(fns, "joinOrganization"), [])
  const leaveOrg = useMemo(() => httpsCallable<{ orgId: string }, JoinLeaveResult>(fns, "leaveOrganization"), [])
  const createOrg = useMemo(() => httpsCallable<{ organization: CreateOrgInput }, Org>(fns, "createOrganization"), [])

  const db = getDatabase()

  const fetchOrgs = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [pubRes, myRes] = await Promise.all([getPublicOrgs({}), getMyOrgs({})])

      const favSnap = await get(ref(db, `userFavorites/${userId}`))
      const favObj = (favSnap.val() as Record<string, boolean>) || {}

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

  const handleToggleFav = async (orgId: string) => {
    if (!userId) return

    const newFavState = !favorites[orgId]
    setFavorites((prev) => ({
      ...prev,
      [orgId]: newFavState,
    }))

    try {
      const favRef = ref(db, `userFavorites/${userId}/${orgId}`)
      if (newFavState) {
        await set(favRef, true)
      } else {
        await remove(favRef)
      }
    } catch (e) {
      console.error("Failed to update favorite:", e)
      setFavorites((prev) => ({
        ...prev,
        [orgId]: !newFavState,
      }))
    }
  }

  const handleJoin = async (orgId: string) => {
    if (!userId || joiningOrgs.has(orgId)) return

    setJoiningOrgs((prev) => new Set(prev).add(orgId))

    setOrgsData((prev) =>
      prev.map((org) =>
        org.id === orgId
          ? {
              ...org,
              joined: true,
              role: "Member",
              members: { ...org.members, [userId]: "Member" },
            }
          : org,
      ),
    )

    try {
      await joinOrg({ orgId })
      console.log(`Successfully joined organization: ${orgId}`)
    } catch (e) {
      console.error("Failed to join organization:", e)
      setOrgsData((prev) =>
        prev.map((org) =>
          org.id === orgId
            ? {
                ...org,
                joined: false,
                role: undefined,
                members: Object.fromEntries(Object.entries(org.members).filter(([id]) => id !== userId)),
              }
            : org,
        ),
      )
    } finally {
      setJoiningOrgs((prev) => {
        const newSet = new Set(prev)
        newSet.delete(orgId)
        return newSet
      })
    }
  }

  const handleLeave = async (orgId: string) => {
    if (!userId || leavingOrgs.has(orgId)) return

    setLeavingOrgs((prev) => new Set(prev).add(orgId))

    const originalOrg = orgsData.find((org) => org.id === orgId)

    setOrgsData((prev) =>
      prev.map((org) =>
        org.id === orgId
          ? {
              ...org,
              joined: false,
              role: undefined,
              members: Object.fromEntries(Object.entries(org.members).filter(([id]) => id !== userId)),
            }
          : org,
      ),
    )

    try {
      const result = await leaveOrg({ orgId })

      if (result.data.transferred) {
        console.log("Organization ownership was transferred")
      }

      console.log(`Successfully left organization: ${orgId}`)
    } catch (e) {
      console.error("Failed to leave organization:", e)
      if (originalOrg) {
        setOrgsData((prev) =>
          prev.map((org) =>
            org.id === orgId
              ? {
                  ...originalOrg,
                  joined: true,
                }
              : org,
          ),
        )
      }
    } finally {
      setLeavingOrgs((prev) => {
        const newSet = new Set(prev)
        newSet.delete(orgId)
        return newSet
      })
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

  const orgs = useMemo(() => {
    return orgsData
      .filter((o) => {
        const matches =
          o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.description.toLowerCase().includes(searchQuery.toLowerCase())
        if (!matches) return false
        if (filter === "joined") return o.joined
        if (filter === "public") return !o.isPrivate
        if (filter === "private") return o.isPrivate && o.joined
        return true
      })
      .sort((a, b) => {
        if (favorites[a.id] && !favorites[b.id]) return -1
        if (!favorites[a.id] && favorites[b.id]) return 1
        return a.name.localeCompare(b.name)
      })
  }, [orgsData, searchQuery, filter, favorites])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background">
        <div className="p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-8">
            <div className="flex-1 space-y-4">
              <h1 className="text-5xl font-bold tracking-tight">Organisations</h1>
              <p className="text-muted-foreground text-xl max-w-3xl leading-relaxed">
                Discover and join study groups to collaborate with other students. Create your own organization or
                browse existing ones.
              </p>
              {searchQuery && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 w-fit">
                  <SearchX className="h-4 w-4" />
                  <span>
                    Searching for: <span className="font-medium text-foreground">"{searchQuery}"</span>
                  </span>
                </div>
              )}
            </div>
            <Button onClick={() => setShowCreate(true)} className="shadow-lg h-10 px-4 py-2 text-base">
              <Plus className="h-5 w-5 mr-2" />
              Create Organisation
            </Button>
          </div>

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
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {
                      {
                        all: orgsData.length,
                        joined: orgsData.filter((o) => o.joined).length,
                        public: orgsData.filter((o) => !o.isPrivate).length,
                        private: orgsData.filter((o) => o.isPrivate && o.joined).length,
                      }[f]
                    }
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

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
                    ? `No organisations match "${searchQuery}". Try different keywords.`
                    : "Be the first to create an organisation."}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowCreate(true)} className="shadow-lg h-10 px-4 py-2 text-base">
                    <Plus className="h-5 w-5 mr-2" />
                    Create Your First Organisation
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {orgs.map((o) => {
                const isFav = !!favorites[o.id]
                const memberCount = Object.keys(o.members).length
                const isJoining = joiningOrgs.has(o.id)
                const isLeaving = leavingOrgs.has(o.id)
                const gradients = [
                  "bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-800/30",
                  "bg-gradient-to-br from-purple-50 to-pink-100 border-purple-200 dark:from-purple-950/20 dark:to-pink-950/20 dark:border-purple-800/30",
                  "bg-gradient-to-br from-green-50 to-emerald-100 border-green-200 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-800/30",
                ]
                const gradientClass =
                  gradients[Math.abs(o.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) % gradients.length]

                return (
                  <div
                    key={o.id}
                    className={`border-2 rounded-2xl p-8 hover:shadow-xl transition-all ${gradientClass} relative min-h-[360px] group hover:scale-[1.02] ${
                      isJoining || isLeaving ? "opacity-75" : ""
                    }`}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-6 right-6 h-10 w-10 rounded-full bg-white/80 hover:bg-white shadow-sm dark:bg-black/80 dark:hover:bg-black"
                      onClick={() => handleToggleFav(o.id)}
                      disabled={isJoining || isLeaving}
                    >
                      <Heart
                        className={`h-5 w-5 transition-colors ${
                          isFav ? "fill-red-500 text-red-500" : "text-muted-foreground hover:text-red-500"
                        }`}
                      />
                    </Button>

                    <div className="flex items-start gap-4 mb-6">
                      <Avatar className="h-16 w-16 border-4 border-white shadow-lg dark:border-black">
                        <AvatarFallback className="text-xl font-bold bg-white text-primary dark:bg-black">
                          {o.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-xl truncate mb-2">{o.name}</h3>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge
                            variant="secondary"
                            className="px-2 py-1 bg-white/80 text-gray-700 border border-gray-200 rounded-full flex items-center gap-1 dark:bg-black/80 dark:text-gray-300 dark:border-gray-700"
                          >
                            <Users className="h-3 w-3" />
                            <span>
                              {memberCount} member{memberCount !== 1 ? "s" : ""}
                            </span>
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="px-2 py-1 bg-white/80 text-gray-700 border border-gray-200 rounded-full flex items-center gap-1 dark:bg-black/80 dark:text-gray-300 dark:border-gray-700"
                          >
                            {o.isPrivate ? (
                              <>
                                <Lock className="h-3 w-3" />
                                <span>Private</span>
                              </>
                            ) : (
                              <>
                                <Globe className="h-3 w-3" />
                                <span>Public</span>
                              </>
                            )}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <p className="text-muted-foreground leading-relaxed line-clamp-3 min-h-[72px]">
                      {o.description || "No description provided for this organization."}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-6 mt-4">
                      {o.joined && !isLeaving && (
                        <Badge className="px-3 py-1 bg-green-500 text-white">
                          <UserCheck className="h-3 w-3 inline-block mr-1" />
                          Joined
                        </Badge>
                      )}
                      {isJoining && (
                        <Badge className="px-3 py-1 bg-blue-500 text-white">
                          <Loader2 className="h-3 w-3 inline-block mr-1 animate-spin" />
                          Joining...
                        </Badge>
                      )}
                      {isLeaving && (
                        <Badge className="px-3 py-1 bg-orange-500 text-white">
                          <Loader2 className="h-3 w-3 inline-block mr-1 animate-spin" />
                          Leaving...
                        </Badge>
                      )}
                      {isFav && (
                        <Badge className="px-3 py-1 bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                          <Heart className="h-3 w-3 inline-block mr-1" />
                          Favorite
                        </Badge>
                      )}
                      {o.role === "Admin" && !isLeaving && (
                        <Badge className="px-3 py-1 bg-amber-500 text-white">
                          <Crown className="h-3 w-3 inline-block mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-3 mt-auto pt-4 border-t border-white/30 dark:border-black/30">
                      {o.joined && !isLeaving ? (
                        <Link href={`/orgNotes?orgId=${o.id}&userId=${userId}`}>
                          <Button size="lg" className="shadow-md" disabled={isJoining || isLeaving}>
                            View Notes
                          </Button>
                        </Link>
                      ) : (
                        !o.isPrivate &&
                        !o.joined && (
                          <Button
                            size="lg"
                            onClick={() => handleJoin(o.id)}
                            className="shadow-md"
                            disabled={isJoining || isLeaving}
                          >
                            {isJoining ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Joining...
                              </>
                            ) : (
                              "Join Organisation"
                            )}
                          </Button>
                        )
                      )}
                      {o.joined && !isLeaving && (
                        <Button
                          size="lg"
                          variant="outline"
                          onClick={() => handleLeave(o.id)}
                          disabled={isJoining || isLeaving}
                        >
                          {isLeaving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Leaving...
                            </>
                          ) : (
                            "Leave"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <CreateOrganizationModal open={showCreate} onOpenChange={setShowCreate} onCreateOrganization={handleCreate} />
    </div>
  )
}
