/* -------------------------------------------------------------------------- */
/*          Dynamic Organisation Details Page – edits now persist             */
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
  Activity,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  noteCount?: number
  lastActivity?: number
  notes: Note[]
}
interface JoinLeaveResult {
  success: boolean
  transferred?: boolean
}

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
  const [error, setError] = useState<string | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editIsPrivate, setEditIsPrivate] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const [deletingMembers, setDeletingMembers] = useState<Set<string>>(
    new Set(),
  )

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
    []
  )

  /* ---------------------------------------------------------------------- */
  /*                       Helper: mock notes generator                      */
  /* ---------------------------------------------------------------------- */
  const generateMockNotes = (members: Member[]): Note[] =>
    Array.from({ length: Math.floor(Math.random() * 12) + 3 }, (_, i) => ({
      id: `note-${i}`,
      title: `Study Note ${i + 1}`,
      content: `This is the content of study note ${i + 1}. It contains important information about the topic.`,
      author: members[Math.floor(Math.random() * members.length)]?.name ?? "Unknown",
      createdAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
    }))

  /* ---------------------------------------------------------------------- */
  /*                           Fetch organisation                           */
  /* ---------------------------------------------------------------------- */
  const fetchOrg = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await getOrganizationDetails({ orgId })
      const mockNotes = generateMockNotes(data.memberDetails)

      setOrganization({ ...data, notes: mockNotes })
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
  }, [orgId, userId, db, getOrganizationDetails])

  useEffect(() => {
    if (!authLoading) fetchOrg()
  }, [fetchOrg, authLoading])

  /* ---------------------------------------------------------------------- */
  /*                             Helpers                                    */
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
      setOrganization((prev) =>
        prev ? { ...prev, ...data, notes: prev.notes } : prev,
      )
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
      res.data.transferred &&
        toast.success("Ownership transferred to another admin")
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

    const confirmed = window.confirm(
      "Are you sure you want to remove this member from the organisation?"
    )
    if (!confirmed) return

    setDeletingMembers((p) => new Set(p).add(memberId))
    try {
      await removeMemberFn({ orgId, userId: memberId })

      /* refresh organisation data so UI & refresh stay correct */
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

  /* ---------------------------------------------------------------------- */
  /*                         Derived values                                 */
  /* ---------------------------------------------------------------------- */
  const isOwner = organization?.ownerId === userId
  const isAdmin = organization?.members[userId ?? ""] === "Admin"
  const isMember = !!organization?.members[userId ?? ""]
  const memberCount = organization
    ? Object.keys(organization.members).length
    : 0

  const gradients = [
    "bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200 dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-800/30",
    "bg-gradient-to-br from-purple-50 to-pink-100 border-purple-200 dark:from-purple-950/20 dark:to-pink-950/20 dark:border-purple-800/30",
    "bg-gradient-to-br from-green-50 to-emerald-100 border-green-200 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-800/30",
  ]
  const gradientClass = organization
    ? gradients[
        Math.abs(
          organization.id
            .split("")
            .reduce((a, b) => a + b.charCodeAt(0), 0),
        ) % gradients.length
      ]
    : gradients[0]

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
            {error ??
              "The organisation you are looking for does not exist or you do not have access to it."}
          </p>
          <Button onClick={() => router.push("/organisations")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Organisations
          </Button>
        </div>
      </div>
    )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className={`border-b-2 ${gradientClass}`}>
        <div className="p-8">
          <div className="mb-8"></div>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="flex items-start gap-6 flex-1">
              <Avatar className="h-24 w-24 border-4 border-white shadow-lg dark:border-black">
                <AvatarFallback className="text-3xl font-bold bg-white text-primary dark:bg-black">
                  {organization.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="text-4xl font-bold mb-2">
                    {organization.name}
                  </h1>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    {organization.description ||
                      "No description provided for this organisation."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Badge
                    variant="secondary"
                    className="px-3 py-1 bg-white/80 text-gray-700 border border-gray-200 rounded-full flex items-center gap-1 dark:bg-black/80 dark:text-gray-300 dark:border-gray-700"
                  >
                    <Users className="h-4 w-4" />
                    <span>
                      {memberCount} member{memberCount !== 1 ? "s" : ""}
                    </span>
                  </Badge>

                  <Badge
                    variant="secondary"
                    className="px-3 py-1 bg-white/80 text-gray-700 border border-gray-200 rounded-full flex items-center gap-1 dark:bg-black/80 dark:text-gray-300 dark:border-gray-700"
                  >
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

                  <Badge
                    variant="secondary"
                    className="px-3 py-1 bg-white/80 text-gray-700 border border-gray-200 rounded-full flex items-center gap-1 dark:bg-black/80 dark:text-gray-300 dark:border-gray-700"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>
                      Created {new Date(organization.createdAt).toLocaleDateString()}
                    </span>
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

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 min-w-[200px]">
              {!isMember && !organization.isPrivate && (
                <Button
                  size="lg"
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="w-full shadow-md"
                >
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
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleLeave}
                  disabled={isLeaving}
                  className="w-full bg-transparent"
                >
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

              <Button
                size="lg"
                variant="ghost"
                onClick={handleToggleFavorite}
                className="w-full"
              >
                <Heart
                  className={`h-5 w-5 mr-2 ${
                    isFavorite ? "fill-red-500 text-red-500" : ""
                  }`}
                />
                {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      {isMember && (
        <div className="p-8">
          <Tabs defaultValue="notes" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
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
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Activity
              </TabsTrigger>
            </TabsList>

            {/* Details Tab */}
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
                  {/* Name */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Organisation Name
                    </label>
                    {isEditing ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-2"
                        placeholder="Enter organisation name"
                      />
                    ) : (
                      <p className="mt-2 text-lg font-semibold">
                        {organization.name}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Description
                    </label>
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

                  {/* Privacy */}
                  {isEditing && (
                    <div className="mt-6">
                      <label className="text-sm font-medium text-muted-foreground">
                        Privacy
                      </label>
                      <div className="flex items-center gap-2 mt-2">
                        <div
                          className={`px-4 py-2 rounded-md cursor-pointer flex items-center gap-2 ${
                            !editIsPrivate
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80"
                          }`}
                          onClick={() => setEditIsPrivate(false)}
                        >
                          <Globe className="h-4 w-4" />
                          <span>Public</span>
                        </div>
                        <div
                          className={`px-4 py-2 rounded-md cursor-pointer flex items-center gap-2 ${
                            editIsPrivate
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80"
                          }`}
                          onClick={() => setEditIsPrivate(true)}
                        >
                          <Lock className="h-4 w-4" />
                          <span>Private</span>
                        </div>
                        <div className="ml-2 text-sm text-muted-foreground">
                          {editIsPrivate
                            ? "Only members can see this organisation"
                            : "Anyone can see and join this organisation"}
                        </div>
                      </div>
                    </div>
                  )}

                  {isEditing && (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveEdit}
                        disabled={savingEdit}
                        className="flex items-center gap-2"
                      >
                        {savingEdit ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  )}

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Created
                      </label>
                      <p className="mt-1">
                        {new Date(organization.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Privacy
                      </label>
                      <p className="mt-1">
                        {organization.isPrivate ? "Private" : "Public"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Total Members
                      </label>
                      <p className="mt-1">{memberCount}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Total Notes
                      </label>
                      <p className="mt-1">{organization.notes.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Members Tab */}
            <TabsContent value="members" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Members ({memberCount})</CardTitle>
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
                            <Badge
                              variant={member.role === "Admin" ? "default" : "secondary"}
                              className={member.role === "Admin" ? "bg-amber-500" : ""}
                            >
                              {member.role === "Admin" && (
                                <Crown className="h-3 w-3 mr-1" />
                              )}
                              {member.role}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Joined {new Date(member.joinedAt).toLocaleDateString()}
                            </span>
                            {isAdmin &&
                              member.id !== userId &&
                              member.id !== organization.ownerId && (
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
                        {index < organization.memberDetails.length - 1 && (
                          <Separator className="mt-4" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {organization.activities.map((activity, index) => (
                      <div key={activity.id}>
                        <div className="flex items-start gap-3">
                          <div className="bg-muted rounded-full p-2 mt-1">
                            <Activity className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm">{activity.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(activity.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {index < organization.activities.length - 1 && (
                          <Separator className="mt-4" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {organization.notes.map((note) => (
                  <Card
                    key={note.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardHeader>
                      <CardTitle className="text-lg line-clamp-2">
                        {note.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm line-clamp-3 mb-4">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>By {note.author}</span>
                        <span>
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
