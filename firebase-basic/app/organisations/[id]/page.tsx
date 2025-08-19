/* -------------------------------------------------------------------------- */
/*          Organisation Details Page – activity tab removed (DYNAMIC)       */
/* -------------------------------------------------------------------------- */

"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { httpsCallableFromURL } from "firebase/functions"
import { fns } from "@/lib/firebase"
import {
  getDatabase,
  ref,
  get,
  set,
  remove,
} from "firebase/database"
import {
  ArrowLeft,
  Users,
  Lock,
  Globe,
  Crown,
  UserCheck,
  Calendar,
  Heart,
  Loader2,
  Mail,
  UserPlus,
  UserMinus,
  Edit3,
  Save,
  X,
  Trash2,
  FileText,
  Info,
  Plus,
  Search,
  Check,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useUserId } from "@/hooks/useUserId"
import { toast } from "sonner"

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */
interface Member {
  id: string
  name: string
  email: string
  role: "Admin" | "Member"
  joinedAt: number
}

interface Note {
  id: string
  title: string
  content: string
  author: string
  ownerId?: string
  createdAt: number
  updatedAt: number
}

interface OrgActivity {
  id: string
  type:
    | "member_joined"
    | "member_left"
    | "note_created"
    | "note_updated"
    | "org_updated"
  description: string
  user: string
  timestamp: number
}
interface OrganizationDetails {
  id: string
  ownerId: string
  name: string
  description: string
  isPrivate: boolean
  image?: string
  members: Record<string, "Admin" | "Member">
  createdAt: number
  memberDetails: Member[]
  activities: OrgActivity[]
  notes: Note[]
}
interface JoinLeaveResult {
  success: boolean
  transferred?: boolean
}
type Friend = { id: string; name: string; email: string }

/* -------------------------------------------------------------------------- */
/*                               Component                                    */
/* -------------------------------------------------------------------------- */
export default function OrganizationDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { userId, loading: authLoading } = useUserId()

  const [organization, setOrganization] =
    useState<OrganizationDetails | null>(null)
  const [loading, setLoading] = useState(true)

  const [isFavorite, setIsFavorite] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [deletingNoteIds, setDeletingNoteIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editIsPrivate, setEditIsPrivate] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingOrg, setDeletingOrg] = useState(false)

  const [deletingMembers, setDeletingMembers] = useState<Set<string>>(new Set())
  const [showAddDlg, setShowAddDlg] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendQuery, setFriendQuery] = useState("")
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [selectedFriends, setSelectedFriends] = useState<string[]>([])

  const orgId = params.id as string
  const db = getDatabase()

  /* ---------------------------------------------------------------------- */
  /*                              Callables                                 */
  /* ---------------------------------------------------------------------- */
  const getOrganizationDetails = useMemo(
    () =>
      httpsCallableFromURL<{ orgId: string }, OrganizationDetails>(
        fns,
        "https://getorganizationdetails-omrwo3ykaa-uc.a.run.app",
      ),
    [],
  )
  const updateOrganization = useMemo(
    () =>
      httpsCallableFromURL<
        { orgId: string; organization: Partial<{ name: string; description: string; isPrivate: boolean }> },
        OrganizationDetails
      >(fns, "https://updateorganization-omrwo3ykaa-uc.a.run.app"),
    [],
  )
  const joinOrg = useMemo(
    () =>
      httpsCallableFromURL<{ orgId: string }, JoinLeaveResult>(
        fns,
        "https://joinorganization-omrwo3ykaa-uc.a.run.app",
      ),
    [],
  )
  const leaveOrg = useMemo(
    () =>
      httpsCallableFromURL<{ orgId: string }, JoinLeaveResult>(
        fns,
        "https://leaveorganization-omrwo3ykaa-uc.a.run.app",
      ),
    [],
  )
  const removeMemberFn = useMemo(
    () =>
      httpsCallableFromURL<
        { orgId: string; userId: string },
        { success: boolean }
      >(fns, "https://removemember-omrwo3ykaa-uc.a.run.app"),
    [],
  )
  const addMemberFn = useMemo(
    () =>
      httpsCallableFromURL<
        { orgId: string; userId: string },
        { success: boolean }
      >(fns, "https://addmember-omrwo3ykaa-uc.a.run.app"),
    [],
  )
  const deleteOrganization = useMemo(
    () =>
      httpsCallableFromURL<{ orgId: string }, { success: boolean }>(
        fns,
        "https://deleteorganization-omrwo3ykaa-uc.a.run.app",
      ),
    [],
  )

  /* ---------------------------------------------------------------------- */
  /*                    Enrich member names if placeholder                   */
  /* ---------------------------------------------------------------------- */
  const enrichMemberNames = async (members: Member[]) => {
    const out: Member[] = []
    for (const m of members) {
      if (!m.name.startsWith("User ")) {
        out.push(m)
        continue
      }
      try {
        const snap = await get(ref(db, `users/${m.id}/UserSettings`))
        if (snap.exists()) {
          const us = snap.val()
          if (us?.name) {
            const full = us.name + (us.surname ? ` ${us.surname}` : "")
            out.push({ ...m, name: full, email: us.email ?? m.email })
            continue
          }
        }
      } catch {/* ignore */}
      out.push(m)
    }
    return out
  }

  /* ---------------------------------------------------------------------- */
  /*                       Notes loader (from RTDB)                          */
  /* ---------------------------------------------------------------------- */

  const stripHtml = (html: string) =>
    (html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()

  const resolveName = async (uid?: string, members?: Member[]) => {
    if (!uid) return ""
    const m = members?.find((mm) => mm.id === uid)
    if (m) return m.name
    try {
      const snap = await get(ref(db, `users/${uid}/UserSettings`))
      if (snap.exists()) {
        const us = snap.val()
        if (us?.name) return us.surname ? `${us.name} ${us.surname}` : us.name
      }
    } catch {/* ignore */}
    return ""
  }

  const loadOrgNotes = async (orgId: string, members: Member[]): Promise<Note[]> => {
    const snap = await get(ref(db, `organizations/${orgId}/notes`))
    if (!snap.exists()) return []
    const raw = snap.val() as Record<string, any>

    const uniqueOwners = Array.from(new Set(Object.values(raw).map((n: any) => n.ownerId).filter(Boolean)))
    const nameCache = new Map<string, string>()
    await Promise.all(
      uniqueOwners.map(async (uid: string) => {
        nameCache.set(uid, await resolveName(uid, members))
      }),
    )

    const arr: Note[] = Object.values(raw).map((n: any) => ({
      id: n.id,
      title: n.name || "Untitled",
      content: stripHtml(n.content || ""),
      author: n.ownerId ? (nameCache.get(n.ownerId) ?? "Unknown") : "Unknown",
      ownerId: n.ownerId,
      createdAt: Number(n.createdAt ?? Date.now()),
      updatedAt: Number(n.updatedAt ?? n.createdAt ?? Date.now()),
    }))

    arr.sort((a, b) => b.updatedAt - a.updatedAt)
    return arr
  }

  /* ---------------------------------------------------------------------- */
  /*                           Fetch organisation                            */
  /* ---------------------------------------------------------------------- */
  const fetchOrg = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await getOrganizationDetails({ orgId })
      const memberDetails = await enrichMemberNames(data.memberDetails)
      const dynamicNotes = await loadOrgNotes(orgId, memberDetails)

      setOrganization({ ...data, memberDetails, notes: dynamicNotes })
      setEditName(data.name)
      setEditDescription(data.description)
      setEditIsPrivate(data.isPrivate)

      if (userId) {
        const favSnap = await get(ref(db, `userFavorites/${userId}/${orgId}`))
        setIsFavorite(!!favSnap.val())
      }
    } catch (e: any) {
      console.error("❌ Failed to load organisation", e)
      setError(e.message ?? "Failed to load organisation")
    } finally {
      setLoading(false)
    }
  }, [orgId, userId, getOrganizationDetails])

  useEffect(() => {
    if (!authLoading) fetchOrg()
  }, [fetchOrg, authLoading])

  /* ---------------------------------------------------------------------- */
  /*                Friend-picker logic (same as before)                     */
  /* ---------------------------------------------------------------------- */
  const loadFriends = async () => {
    if (!organization) return
    setLoadingFriends(true)
    try {
      const snap = await get(ref(db, "users"))
      const data = snap.val() as Record<string, any> | null
      if (!data) {
        setFriends([])
        return
      }
      const list: Friend[] = Object.entries(data).map(([uid, node]) => {
        const settings = node.UserSettings ?? node.userSettings ?? node.profile ?? node
        const full = settings?.name ? settings.name + (settings.surname ? ` ${settings.surname}` : "") : "Unnamed user"
        return { id: uid, name: full, email: settings?.email ?? "" }
      }).filter((f) => f.id !== userId && !organization.members[f.id])
      setFriends(list)
    } finally {
      setLoadingFriends(false)
    }
  }

  useEffect(() => {
    if (showAddDlg) loadFriends()
  }, [showAddDlg]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredFriends = useMemo(() => {
    const q = friendQuery.toLowerCase()
    return friends.filter((f) => f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q))
  }, [friends, friendQuery])

  const toggleFriend = (id: string) =>
    setSelectedFriends((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]))

  const handleAddMembers = async () => {
    if (selectedFriends.length === 0) return
    try {
      await Promise.all(selectedFriends.map((uid) => addMemberFn({ orgId, userId: uid })))
      toast.success("Members added")
      setShowAddDlg(false)
      setSelectedFriends([])
      setFriendQuery("")
      fetchOrg()
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add members")
    }
  }

  /* ---------------------------------------------------------------------- */
  /*                             Other helpers                              */
  /* ---------------------------------------------------------------------- */
  const handleToggleFavorite = async () => {
    if (!userId || !organization) return
    const next = !isFavorite
    setIsFavorite(next)
    try {
      const favRef = ref(db, `userFavorites/${userId}/${orgId}`)
      next ? await set(favRef, true) : await remove(favRef)
    } catch {
      toast.error("Failed to update favourite")
      setIsFavorite(!next)
    }
  }

  const handleSaveEdit = async () => {
    if (!organization || !isAdmin || savingEdit) return
    setSavingEdit(true)
    try {
      const { data } = await updateOrganization({
        orgId,
        organization: {
          name: editName.trim(),
          description: editDescription.trim(),
          isPrivate: editIsPrivate,
        },
      })
      setOrganization((prev) => (prev ? { ...prev, ...data, notes: prev.notes } : prev))
      toast.success("Organisation updated")
      setIsEditing(false)
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update organisation")
    } finally {
      setSavingEdit(false)
    }
  }

  const handleJoin = async () => {
    if (!userId || isJoining) return
    setIsJoining(true)
    try {
      await joinOrg({ orgId })
      toast.success("Joined organisation")
      window.location.reload()
    } catch (e: any) {
      toast.error(e.message ?? "Failed to join organisation")
    } finally {
      setIsJoining(false)
    }
  }

  const handleLeave = async () => {
    if (!userId || isLeaving) return
    setIsLeaving(true)
    try {
      const res = await leaveOrg({ orgId })
      res.data.transferred && toast.success("Ownership transferred to another admin")
      toast.success("Left organisation")
      router.push("/organisations")
    } catch (e: any) {
      toast.error(e.message ?? "Failed to leave organisation")
    } finally {
      setIsLeaving(false)
    }
  }

  const handleDeleteMember = async (memberId: string) => {
    if (!organization || !isAdmin || memberId === userId) return
    const confirmed = window.confirm("Are you sure you want to remove this member from the organisation?")
    if (!confirmed) return
    setDeletingMembers((p) => new Set(p).add(memberId))
    try {
      await removeMemberFn({ orgId, userId: memberId })
      await fetchOrg()
      toast.success("Member removed")
    } catch (e: any) {
      toast.error(e.message ?? "Failed to remove member")
    } finally {
      setDeletingMembers((p) => {
        const s = new Set(p)
        s.delete(memberId)
        return s
      })
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!organization || !isAdmin) {
      toast.error("Only admins can delete notes.")
      return
    }
    const confirmed = window.confirm("Delete this note? This cannot be undone.")
    if (!confirmed) return
    setDeletingNoteIds((prev) => new Set(prev).add(noteId))
    try {
      await remove(ref(db, `organizations/${orgId}/notes/${noteId}`))
      setOrganization((prev) => (prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== noteId) } : prev))
      toast.success("Note deleted.")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete note.")
    } finally {
      setDeletingNoteIds((prev) => {
        const s = new Set(prev)
        s.delete(noteId)
        return s
      })
    }
  }

  const handleDeleteOrganisation = async () => {
    if (!isOwner) return
    const confirmed = window.confirm("Delete this organisation and all its data? This cannot be undone.")
    if (!confirmed) return
    setDeletingOrg(true)
    try {
      await deleteOrganization({ orgId })
      toast.success("Organisation deleted.")
      router.push("/organisations")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete organisation.")
    } finally {
      setDeletingOrg(false)
    }
  }

  /* ---------------------------------------------------------------------- */
  /*                         Derived values                                 */
  /* ---------------------------------------------------------------------- */
  const isOwner = organization?.ownerId === userId
  const isAdmin = organization?.members[userId ?? ""] === "Admin"
  const isMember = !!organization?.members[userId ?? ""]
  const memberCount = organization ? Object.keys(organization.members).length : 0

  /* ---------------------------------------------------------------------- */
  /*                           UI rendering                                 */
  /* ---------------------------------------------------------------------- */
  if (authLoading || loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading organisation…</p>
        </div>
      </div>
    )

  if (error || !organization)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md">
          <div className="bg-destructive/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
            <Users className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold">Organisation Not Found</h2>
          <p className="text-muted-foreground">
            {error ?? "The organisation you are looking for does not exist or you do not have access to it."}
          </p>
          <Button onClick={() => router.push("/organisations")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Organisations
          </Button>
        </div>
      </div>
    )

  return (
    <>
      {/* ------------------ Add-Members dialog ------------------ */}
      <Dialog open={showAddDlg} onOpenChange={setShowAddDlg}>
        <DialogContent aria-describedby="add-dlg-desc" className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <p id="add-dlg-desc" className="sr-only">Choose users to add to this organisation</p>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Members
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users…" value={friendQuery} onChange={(e) => setFriendQuery(e.target.value)} className="pl-10" />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {loadingFriends ? (
                <p className="text-center text-sm text-muted-foreground py-6">Loading users…</p>
              ) : filteredFriends.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">
                  {friendQuery ? "No users found" : "No users available"}
                </p>
              ) : (
                filteredFriends.map((fr) => (
                  <div
                    key={fr.id}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                      selectedFriends.includes(fr.id)
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleFriend(fr.id)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{fr.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fr.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{fr.email || ""}</p>
                    </div>
                    {selectedFriends.includes(fr.id) && <Check className="h-4 w-4 text-primary" />}
                  </div>
                ))
              )}
            </div>

            <Button disabled={selectedFriends.length === 0} onClick={handleAddMembers} className="w-full">
              Add {selectedFriends.length} member{selectedFriends.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------ Main page ------------------ */}
      <div className="min-h-screen bg-background">
        {/* Fixed, neutral header (no per-org colors) */}
        <div className="border-b bg-muted/30">
          <div className="p-8">
            <div className="mb-8"></div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <div className="flex items-start gap-6 flex-1">
                <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                  <AvatarFallback className="text-3xl font-bold">{organization.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-4">
                  <div>
                    <h1 className="text-4xl font-bold mb-2">{organization.name}</h1>
                    <p className="text-muted-foreground text-lg leading-relaxed">
                      {organization.description || "No description provided for this organisation."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Badge variant="secondary" className="px-3 py-1 rounded-full flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{memberCount} member{memberCount !== 1 ? "s" : ""}</span>
                    </Badge>

                    <Badge variant="secondary" className="px-3 py-1 rounded-full flex items-center gap-1">
                      {organization.isPrivate ? (
                        <>
                          <Lock className="h-4 w-4" />
                          <span>Private</span>
                        </>
                      ) : (
                        <>
                          <Globe className="h-4 w-4" />
                          <span>Public</span>
                        </>
                      )}
                    </Badge>

                    <Badge variant="secondary" className="px-3 py-1 rounded-full flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Created {new Date(organization.createdAt).toLocaleDateString()}</span>
                    </Badge>

                    {isMember && (
                      <Badge className="px-3 py-1 bg-green-500 text-white">
                        <UserCheck className="h-4 w-4 mr-1" />
                        {isAdmin ? "Admin" : "Member"}
                      </Badge>
                    )}

                    {isFavorite && (
                      <Badge className="px-3 py-1 bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        <Heart className="h-4 w-4 mr-1" />
                        Favorite
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Right-side actions: consistent sizes + alignment */}
              <div className="flex flex-col gap-2 min-w-[240px]">
                {!isMember && !organization.isPrivate && (
                  <Button size="lg" onClick={handleJoin} disabled={isJoining} className="w-full">
                    {isJoining ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Joining…
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-5 w-5 mr-2" />
                        Join Organisation
                      </>
                    )}
                  </Button>
                )}

                {isMember && (
                  <Button size="lg" variant="outline" onClick={handleLeave} disabled={isLeaving} className="w-full">
                    {isLeaving ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Leaving…
                      </>
                    ) : (
                      <>
                        <UserMinus className="h-5 w-5 mr-2" />
                        Leave Organisation
                      </>
                    )}
                  </Button>
                )}

                {/* Make favorite toggle match sizing + alignment */}
                <Button size="lg" variant="outline" onClick={handleToggleFavorite} className="w-full">
                  <Heart className={`h-5 w-5 mr-2 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
                  {isFavorite ? "Remove Favorite" : "Add Favorite"}
                </Button>

                {isOwner && (
                  <Button size="lg" variant="destructive" disabled={deletingOrg} onClick={handleDeleteOrganisation} className="w-full">
                    {deletingOrg ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Deleting…
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-5 w-5 mr-2" />
                        Delete Organisation
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        {isMember && (
          <div className="p-8">
            <Tabs defaultValue="notes" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="notes" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </TabsTrigger>
                <TabsTrigger value="details" className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="members" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Members
                </TabsTrigger>
              </TabsList>

              {/* Details */}
              <TabsContent value="details" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Organisation Details</CardTitle>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (isEditing) {
                            setEditName(organization.name)
                            setEditDescription(organization.description)
                          }
                          setIsEditing(!isEditing)
                        }}
                      >
                        {isEditing ? (
                          <>
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </>
                        ) : (
                          <>
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit
                          </>
                        )}
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Organisation Name</label>
                      {isEditing ? (
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-2" placeholder="Enter organisation name" />
                      ) : (
                        <p className="mt-2 text-lg font-semibold">{organization.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Description</label>
                      {isEditing ? (
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="mt-2"
                          placeholder="Enter organisation description"
                          rows={4}
                        />
                      ) : (
                        <p className="mt-2 text-muted-foreground leading-relaxed">
                          {organization.description || "No description provided"}
                        </p>
                      )}
                    </div>

                    {isEditing && (
                      <div className="mt-6">
                        <label className="text-sm font-medium text-muted-foreground">Privacy</label>
                        <div className="flex items-center gap-2 mt-2">
                          <div
                            className={`px-4 py-2 rounded-md cursor-pointer flex items-center gap-2 ${
                              !editIsPrivate ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                            }`}
                            onClick={() => setEditIsPrivate(false)}
                          >
                            <Globe className="h-4 w-4" />
                            <span>Public</span>
                          </div>
                          <div
                            className={`px-4 py-2 rounded-md cursor-pointer flex items-center gap-2 ${
                              editIsPrivate ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                            }`}
                            onClick={() => setEditIsPrivate(true)}
                          >
                            <Lock className="h-4 w-4" />
                            <span>Private</span>
                          </div>
                          <div className="ml-2 text-sm text-muted-foreground">
                            {editIsPrivate ? "Only members can see this organisation" : "Anyone can see and join this organisation"}
                          </div>
                        </div>
                      </div>
                    )}

                    {isEditing && (
                      <div className="flex gap-2">
                        <Button onClick={handleSaveEdit} disabled={savingEdit} className="flex items-center gap-2">
                          {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save Changes
                        </Button>
                      </div>
                    )}

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Created</label>
                        <p className="mt-1">{new Date(organization.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Privacy</label>
                        <p className="mt-1">{organization.isPrivate ? "Private" : "Public"}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Total Members</label>
                        <p className="mt-1">{memberCount}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Total Notes</label>
                        <p className="mt-1">{organization.notes.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Members */}
              <TabsContent value="members" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row justify-between">
                    <CardTitle>Members ({memberCount})</CardTitle>
                    {isAdmin && organization.isPrivate && (
                      <Button size="sm" variant="outline" onClick={() => setShowAddDlg(true)} className="gap-1">
                        <Plus className="h-4 w-4" />
                        Add Members
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {organization.memberDetails.map((member, index) => (
                        <div key={member.id}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-muted">
                                  {member.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{member.name}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {member.email}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={member.role === "Admin" ? "default" : "secondary"} className={member.role === "Admin" ? "bg-amber-500" : ""}>
                                {member.role === "Admin" && <Crown className="h-3 w-3 mr-1" />}
                                {member.role}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Joined {new Date(member.joinedAt).toLocaleDateString()}
                              </span>
                              {isAdmin && member.id !== userId && member.id !== organization.ownerId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteMember(member.id)}
                                  disabled={deletingMembers.has(member.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  {deletingMembers.has(member.id) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                          {index < organization.memberDetails.length - 1 && <Separator className="mt-4" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notes */}
              <TabsContent value="notes" className="mt-6">
                {organization.notes.length === 0 ? (
                  <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                      No notes yet. 
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {organization.notes.map((note) => {
                      const isDeleting = deletingNoteIds.has(note.id)
                      return (
                        <Card
                          key={note.id}
                          className="hover:shadow-md transition-shadow cursor-pointer group"
                          onClick={() => router.push(`/organisations/${orgId}/notes?noteId=${note.id}`)}
                        >
                          <CardHeader className="flex flex-row items-start justify-between gap-3">
                            <CardTitle className="text-lg line-clamp-2">{note.title}</CardTitle>

                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-70 group-hover:opacity-100"
                                disabled={isDeleting}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleDeleteNote(note.id)
                                }}
                                title="Delete note"
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            )}
                          </CardHeader>

                          <CardContent>
                            <p className="text-muted-foreground text-sm line-clamp-3 mb-4">{note.content}</p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              {/* author name here */}
                              <span> {note.author}</span>
                              <span>{new Date(note.updatedAt || note.createdAt).toLocaleDateString()}</span>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </>
  )
}
