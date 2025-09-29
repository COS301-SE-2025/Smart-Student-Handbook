"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"
import { getDatabase, ref, get, set, remove } from "firebase/database"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Heart, Users, Lock, Globe, Plus, Crown, UserCheck, SearchX, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreateOrganizationModal } from "@/components/ui/create-organization-modal"
import { useUserId } from "@/hooks/useUserId"
import { toast } from "sonner"

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */
interface Org {
  id: string
  ownerId: string
  name: string
  description: string
  isPrivate: boolean
  image?: string
  members: Record<string, "Admin" | "Member">
  createdAt?: number
  role?: "Admin" | "Member"
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

/* -------------------------------------------------------------------------- */
/*                               Component                                    */
/* -------------------------------------------------------------------------- */
export default function OrganisationsPage() {
  const { userId, loading: authLoading } = useUserId()
  const searchParams = useSearchParams()
  const [orgsData, setOrgsData] = useState<(Org & { joined: boolean })[]>([])
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")
  const [showCreate, setShowCreate] = useState(false)
  const [joiningOrgs, setJoiningOrgs] = useState<Set<string>>(new Set())
  const [leavingOrgs, setLeavingOrgs] = useState<Set<string>>(new Set())

  const searchQuery = searchParams.get("search") || ""


/* ---- callables -------------------------------------------------------- */
const getPublicOrgs = useMemo(
  () => httpsCallable<{}, Org[]>(fns, "getPublicOrganizations"),
  [fns],
)

const getPrivateOrgs = useMemo(
  () => httpsCallable<{}, Org[]>(fns, "getUserOrganizations"),
  [fns],
)

const joinOrg = useMemo(
  () => httpsCallable<{ orgId: string }, JoinLeaveResult>(fns, "joinOrganization"),
  [fns],
)

const leaveOrg = useMemo(
  () => httpsCallable<{ orgId: string }, JoinLeaveResult>(fns, "leaveOrganization"),
  [fns],
)

const createOrg = useMemo(
  () => httpsCallable<{ organization: CreateOrgInput }, Org>(fns, "createOrganization"),
  [fns],
)


  const db = getDatabase()

  /* ---------------------------------------------------------------------- */
  /*                         Fetch + merge lists                            */
  /* ---------------------------------------------------------------------- */
  const fetchOrgs = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      // Fetch public organizations
      let publicList: (Org & { joined: boolean })[] = []
      try {
        const pubRes = await getPublicOrgs({})
        publicList = pubRes.data.map((o) => ({
          ...o,
          joined: !!o.members?.[userId],
          role: o.members?.[userId] as "Admin" | "Member" | undefined,
        }))
      } catch (pubError) {
        console.warn("Failed to fetch public organizations:", pubError)
        // Continue execution, just with empty public list
      }

      // Fetch private organizations (user's joined orgs)
      let privateList: (Org & { joined: boolean })[] = []
      try {
        const privRes = await getPrivateOrgs({})
        privateList = privRes.data.map((o) => ({ ...o, joined: true }))
      } catch (privError: any) {
        console.warn("Failed to fetch user organizations:", privError)
        // If the error is "Organization not found", it just means the user has no organizations
        // This is normal for new users, so we don't show an error toast
        if (!privError.message?.includes("Organization not found")) {
          console.error("Unexpected error fetching user organizations:", privError)
        }
        // Continue execution with empty private list
      }

      // Fetch favorites
      let favObj: Record<string, boolean> = {}
      try {
        const favSnap = await get(ref(db, `userFavorites/${userId}`))
        favObj = (favSnap.val() as Record<string, boolean>) || {}
      } catch (favError) {
        console.warn("Failed to fetch favorites:", favError)
        // Continue with empty favorites
      }

      // Merge and deduplicate organizations
      const map = new Map<string, Org & { joined: boolean }>()
      ;[...publicList, ...privateList].forEach((o) => map.set(o.id, o))

      setOrgsData(Array.from(map.values()))
      setFavorites(favObj)
    } catch (e) {
      console.error("Failed to load organisations", e)
      toast.error("Failed to load organisations.")
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }, [userId, getPublicOrgs, getPrivateOrgs, db])

  useEffect(() => {
    fetchOrgs()
  }, [fetchOrgs])

  /* ---------------------------------------------------------------------- */
  /*                         Helpers (join / leave)                         */
  /* ---------------------------------------------------------------------- */
  const handleToggleFav = async (orgId: string) => {
    if (!userId) return
    const next = !favorites[orgId]
    setFavorites((prev) => ({ ...prev, [orgId]: next }))
    try {
      const favRef = ref(db, `userFavorites/${userId}/${orgId}`)
      next ? await set(favRef, true) : await remove(favRef)
    } catch {
      toast.error("Failed to update favorite.")
      setFavorites((prev) => ({ ...prev, [orgId]: !next }))
    }
  }

  const handleJoin = async (orgId: string) => {
    if (!userId || joiningOrgs.has(orgId)) return
    setJoiningOrgs((prev) => new Set(prev).add(orgId))
    setOrgsData((prev) =>
      prev.map((o) =>
        o.id === orgId ? { ...o, joined: true, role: "Member", members: { ...o.members, [userId]: "Member" } } : o,
      ),
    )
    try {
      await joinOrg({ orgId })
      toast.success("Successfully joined organization.")
    } catch (e: any) {
      toast.error(e.message || "Failed to join organization.")
      setOrgsData((prev) =>
        prev.map((o) =>
          o.id === orgId
            ? {
                ...o,
                joined: false,
                role: undefined,
                members: Object.fromEntries(Object.entries(o.members).filter(([id]) => id !== userId)),
              }
            : o,
        ),
      )
    } finally {
      setJoiningOrgs((p) => {
        const s = new Set(p)
        s.delete(orgId)
        return s
      })
    }
  }

  const handleLeave = async (orgId: string) => {
    if (!userId || leavingOrgs.has(orgId)) return
    setLeavingOrgs((prev) => new Set(prev).add(orgId))
    const original = orgsData.find((o) => o.id === orgId)

    setOrgsData((prev) =>
      prev.map((o) =>
        o.id === orgId
          ? {
              ...o,
              joined: false,
              role: undefined,
              members: Object.fromEntries(Object.entries(o.members).filter(([id]) => id !== userId)),
            }
          : o,
      ),
    )

    setFavorites((p) => {
      const { [orgId]: _ignore, ...rest } = p
      return rest
    })

    try {
      const res = await leaveOrg({ orgId })
      if (original?.isPrivate) setOrgsData((prev) => prev.filter((o) => o.id !== orgId))
      if (res.data.transferred) 
      toast.success("Successfully left organization.")
    } catch (e: any) {
      toast.error(e.message || "Failed to leave organization.")
      if (original) {
        setOrgsData((prev) => prev.map((o) => (o.id === orgId ? { ...original, joined: true } : o)))
        setFavorites((p) => ({ ...p, [orgId]: true }))
      }
    } finally {
      setLeavingOrgs((p) => {
        const s = new Set(p)
        s.delete(orgId)
        return s
      })
    }
  }

  /* ---------------------------------------------------------------------- */
  /*                  Filter + sort list for render                         */
  /* ---------------------------------------------------------------------- */
  const orgs = useMemo(() => {
    return orgsData
      .filter((o) => {
        const q = searchQuery.toLowerCase()
        const matches = o.name.toLowerCase().includes(q) || o.description.toLowerCase().includes(q)
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

  /* ---------------------------------------------------------------------- */
  /*                             JSX                                         */
  /* ---------------------------------------------------------------------- */
  if (authLoading) return null

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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

          {/* Filter Tabs */}
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

      {/* Organisation Cards */}
      <div className="p-8">
        {orgs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {orgs.map((o) => {
              const isFav = !!favorites[o.id]
              const memberCount = Object.keys(o.members).length
              const isJoining = joiningOrgs.has(o.id)
              const isLeaving = leavingOrgs.has(o.id)

              return (
                <div
                  key={o.id}
                  className={`border-2 bg-white dark:bg-card rounded-2xl p-8 hover:shadow-xl transition-all relative min-h-[360px] group ${
                    isJoining || isLeaving ? "opacity-75" : ""
                  }`}
                >
                  {/* fav button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-6 right-6 h-10 w-10 rounded-full bg-white/80 hover:bg-white shadow-sm dark:bg-muted/80 dark:hover:bg-muted z-10"
                    onClick={() => handleToggleFav(o.id)}
                    disabled={isJoining || isLeaving}
                  >
                    <Heart
                      className={`h-5 w-5 transition-colors ${
                        isFav ? "fill-red-500 text-red-500" : "text-muted-foreground hover:text-red-500"
                      }`}
                    />
                  </Button>

                  {/* header */}
                  <div className="flex items-start gap-4 mb-6">
                    <Avatar className="h-16 w-16 border-4 border-white shadow-lg dark:border-border">
                      <AvatarFallback className="text-xl font-bold bg-white text-primary dark:bg-background">
                        {o.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-xl truncate mb-2">{o.name}</h3>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge
                          variant="secondary"
                          className="px-2 py-1 bg-white/80 text-gray-700 border border-gray-200 rounded-full flex items-center gap-1 dark:bg-muted/80 dark:text-muted-foreground dark:border-border"
                        >
                          <Users className="h-3 w-3" />{" "}
                          <span>
                            {memberCount} member{memberCount !== 1 ? "s" : ""}
                          </span>
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="px-2 py-1 bg-white/80 text-gray-700 border border-gray-200 rounded-full flex items-center gap-1 dark:bg-muted/80 dark:text-muted-foreground dark:border-border"
                        >
                          {o.isPrivate ? (
                            <>
                              <Lock className="h-3 w-3" /> <span>Private</span>
                            </>
                          ) : (
                            <>
                              <Globe className="h-3 w-3" /> <span>Public</span>
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* description */}
                  <p className="text-muted-foreground leading-relaxed line-clamp-3 min-h-[72px]">
                    {o.description || "No description provided for this organization."}
                  </p>

                  {/* badges */}
                  <div className="flex flex-wrap gap-2 mb-6 mt-4">
                    {o.joined && !isLeaving && (
                      <Badge className="px-3 py-1 bg-green-700 text-white">
                        <UserCheck className="h-3 w-3 inline-block mr-1" /> Joined
                      </Badge>
                    )}
                    {isJoining && (
                      <Badge className="px-3 py-1 bg-blue-500 text-white">
                        <Loader2 className="h-3 w-3 inline-block mr-1 animate-spin" /> Joining...
                      </Badge>
                    )}
                    {isLeaving && (
                      <Badge className="px-3 py-1 bg-orange-500 text-white">
                        <Loader2 className="h-3 w-3 inline-block mr-1 animate-spin" /> Leaving...
                      </Badge>
                    )}
                    {isFav && (
                      <Badge className="px-3 py-1 bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        <Heart className="h-3 w-3 inline-block mr-1" /> Favorite
                      </Badge>
                    )}
                    {o.role === "Admin" && !isLeaving && (
                      <Badge className="px-3 py-1 bg-amber-700 text-white">
                        <Crown className="h-3 w-3 inline-block mr-1" /> Admin
                      </Badge>
                    )}
                  </div>

                  {/* actions */}
                  <div className="flex gap-3 mt-auto pt-4 border-t border-white/30 dark:border-border relative z-10">
                    {o.joined && !isLeaving ? (
                      <Button
                        size="lg"
                        className="shadow-md flex-1 basis-1/2"
                        asChild
                        disabled={isJoining || isLeaving}
                      >
                        <Link href={`/organisations/${o.id}`}>View Organisation</Link>
                      </Button>
                    ) : (
                      !o.isPrivate &&
                      !o.joined && (
                        <Button
                          size="lg"
                          onClick={() => handleJoin(o.id)}
                          className="shadow-md w-full"
                          disabled={isJoining || isLeaving}
                        >
                          {isJoining ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Joining...
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
                        className="flex-1 basis-1/2"
                        onClick={() => handleLeave(o.id)}
                        disabled={isJoining || isLeaving}
                      >
                        {isLeaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Leaving...
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
        ) : hasLoaded ? (
          <div className="flex items-center justify-center min-h-[500px]">
            <div className="text-center py-20 px-8 max-w-2xl mx-auto">
              <div className="bg-gradient-to-br from-muted/30 to-muted/50 rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-8 shadow-lg">
                {searchQuery ? <SearchX className="h-16 w-16 text-muted-foreground" /> : <Users className="h-16 w-16 text-muted-foreground" />}
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
          <div className="min-h-[300px]" />
        )}
      </div>

      {/* create-modal */}
      <CreateOrganizationModal
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreateOrganization={async (data) => {
          try {
            await createOrg({
              organization: {
                name: data.name,
                description: data.description,
                isPrivate: data.isPrivate,
                invitedUserIds: data.selectedFriends,
              },
            })
            toast.success("Organization created.")
            setShowCreate(false)
            fetchOrgs()
          } catch {
            toast.error("Failed to create organization.")
          }
        }}
      />
    </div>
  )
}