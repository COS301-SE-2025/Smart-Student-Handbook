"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"
import { getAuth } from "firebase/auth"
import { getDatabase, ref, onValue, off, get } from "firebase/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
  ArrowLeft,
  UserPlus,
  UserCheck,
  UserX,
  Building2,
  FileText,
  Mail,
  Phone,
  Users,
  GraduationCap,
  Globe,
  Lock,
} from "lucide-react"
import { toast } from "sonner"

interface Friend {
  uid: string
  name: string
  surname: string
  profilePicture?: string
  email?: string
}

interface Organization {
  id: string
  name: string
  description: string
  isPrivate: boolean
  members: Record<string, string>
}

export default function FriendPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [friend, setFriend] = useState<any>(null)
  const [status, setStatus] = useState<"friends" | "sent" | "incoming" | "none">("none")
  const [mutualFriends, setMutualFriends] = useState<Friend[]>([])
  const [mutualOrganizations, setMutualOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMutuals, setLoadingMutuals] = useState(false)

  const currentUser = getAuth().currentUser
  const db = getDatabase()

  // Firebase Functions
  const sendFriendRequestFunc = httpsCallable<{ targetUserId: string }, { success: boolean, message: string }>(fns, "sendFriendRequest")
  const acceptFriendRequestFunc = httpsCallable<{ targetUserId: string }, { success: boolean, message: string }>(fns, "acceptFriendRequest")
  const rejectFriendRequestFunc = httpsCallable<{ targetUserId: string }, { success: boolean, message: string }>(fns, "rejectFriendRequest")
  const cancelFriendRequestFunc = httpsCallable<{ targetUserId: string }, { success: boolean, message: string }>(fns, "cancelFriendRequest")
  const removeFriendFunc = httpsCallable<{ targetUserId: string }, { success: boolean, message: string }>(fns, "removeFriend")

  // Load mutual friends and organizations
  const loadMutualData = async () => {
    if (!currentUser) return
    setLoadingMutuals(true)
    
    try {
      // Get current user's friends and organizations
      const [currentUserSnapshot, friendUserSnapshot, organizationsSnapshot] = await Promise.all([
        get(ref(db, `users/${currentUser.uid}`)),
        get(ref(db, `users/${id}`)),
        get(ref(db, `organizations`))
      ])

      const currentUserData = currentUserSnapshot.val()
      const friendUserData = friendUserSnapshot.val()
      const organizationsData = organizationsSnapshot.val()

      const currentUserFriends = Object.keys(currentUserData?.friends || {})
      const friendUserFriends = Object.keys(friendUserData?.friends || {})
      
      // Find mutual friends
      const mutualFriendIds = currentUserFriends.filter(friendId => friendUserFriends.includes(friendId))
      const mutualFriendsData: Friend[] = []

      for (const friendId of mutualFriendIds) {
        // Get full user data, not just UserSettings
        const friendSnapshot = await get(ref(db, `users/${friendId}`))
        if (friendSnapshot.exists()) {
          const friendData = friendSnapshot.val()
          const userSettings = friendData.UserSettings || {}
          
          // Try to get email from different possible locations
          const email = friendData.email || userSettings.email || ""
          
          mutualFriendsData.push({
            uid: friendId,
            name: userSettings.name || "",
            surname: userSettings.surname || "",
            profilePicture: userSettings.profilePicture || "",
            email: email
          })
        }
      }

      // Find mutual organizations - FIXED LOGIC
      const mutualOrgsData: Organization[] = []
      if (organizationsData) {
        // Check all organizations where both users are members
        Object.entries(organizationsData).forEach(([orgId, orgData]: [string, any]) => {
          const members = orgData.members || {}
          const currentUserIsMember = !!members[currentUser.uid]
          const friendIsMember = !!members[id]
          
          if (currentUserIsMember && friendIsMember) {
            mutualOrgsData.push({
              id: orgId,
              name: orgData.name || "",
              description: orgData.description || "",
              isPrivate: !!orgData.isPrivate,
              members: members
            })
          }
        })
      }
      setMutualFriends(mutualFriendsData)
      setMutualOrganizations(mutualOrgsData)
    } catch (error) {
      console.error("Error loading mutual data:", error)
    } finally {
      setLoadingMutuals(false)
    }
  }

  useEffect(() => {
    if (!currentUser) return

    // Try to get email from the user's root data first, then fallback to UserSettings
    const friendRootRef = ref(db, `users/${id}`)
    const currentUserRef = ref(db, `users/${currentUser.uid}`)

    const unsubProfile = onValue(friendRootRef, async (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.val()
        
        // Try to get email from root level first
        let friendData = userData.UserSettings || {}
        let friendEmail = userData.email || friendData.email || ""
        
        // If no email found, try different paths
        if (!friendEmail && userData.UserSettings?.email) {
          friendEmail = userData.UserSettings.email
        }
        
        // Combine the data
        const combinedFriendData = {
          ...friendData,
          email: friendEmail
        }
        
        setFriend(combinedFriendData)
      }
      setLoading(false)
    })

    const unsubStatus = onValue(currentUserRef, (snapshot) => {
      if (!snapshot.exists()) return
      const userData = snapshot.val()
      const friends = userData.friends || {}
      const incoming = userData.incomingRequests || {}
      const sent = userData.sentRequests || {}

      if (friends[id]) setStatus("friends")
      else if (incoming[id]) setStatus("incoming")
      else if (sent[id]) setStatus("sent")
      else setStatus("none")
    })

    // Load mutual data when component mounts
    loadMutualData()

    return () => {
      off(friendRootRef)
      off(currentUserRef)
    }
  }, [id, currentUser])

  const handleSendRequest = async () => {
    try {
      const result = await sendFriendRequestFunc({ targetUserId: id })
      toast.success(result.data.message)
      setStatus("sent")
    } catch (error: any) {
      console.error("Error sending friend request:", error)
      toast.error(error.message || "Failed to send friend request")
    }
  }

  const handleCancel = async () => {
    try {
      const result = await cancelFriendRequestFunc({ targetUserId: id })
      toast.success(result.data.message)
      setStatus("none")
    } catch (error: any) {
      console.error("Error cancelling friend request:", error)
      toast.error(error.message || "Failed to cancel friend request")
    }
  }

  const handleAccept = async () => {
    try {
      const result = await acceptFriendRequestFunc({ targetUserId: id })
      toast.success(result.data.message)
      setStatus("friends")
      // Reload mutual data since they're now friends
      loadMutualData()
    } catch (error: any) {
      console.error("Error accepting friend request:", error)
      toast.error(error.message || "Failed to accept friend request")
    }
  }

  const handleReject = async () => {
    try {
      const result = await rejectFriendRequestFunc({ targetUserId: id })
      toast.success(result.data.message)
      setStatus("none")
    } catch (error: any) {
      console.error("Error rejecting friend request:", error)
      toast.error(error.message || "Failed to reject friend request")
    }
  }

  const handleUnfriend = async () => {
    try {
      const result = await removeFriendFunc({ targetUserId: id })
      toast.success(result.data.message)
      setStatus("none")
    } catch (error: any) {
      console.error("Error removing friend:", error)
      toast.error(error.message || "Failed to remove friend")
    }
  }

  const getInitials = (name: string, surname: string) => {
    return `${name?.charAt(0) || ''}${surname?.charAt(0) || ''}`.toUpperCase()
  }

  const getActionButton = () => {
    switch (status) {
      case "friends":
        return (
          <Button variant="destructive" onClick={handleUnfriend}>
            <UserX className="h-4 w-4 mr-2" /> Remove Friend
          </Button>
        )
      case "sent":
        return (
          <Button variant="outline" onClick={handleCancel}>
            <UserX className="h-4 w-4 mr-2" /> Cancel Request
          </Button>
        )
      case "incoming":
        return (
          <div className="flex gap-2">
            <Button onClick={handleAccept}>
              <UserCheck className="h-4 w-4 mr-2" /> Accept
            </Button>
            <Button variant="outline" onClick={handleReject}>
              <UserX className="h-4 w-4 mr-2" /> Reject
            </Button>
          </div>
        )
      default:
        return (
          <Button onClick={handleSendRequest}>
            <UserPlus className="h-4 w-4 mr-2" /> Send Friend Request
          </Button>
        )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          {getActionButton()}
        </div>

        {/* Main Profile Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <Avatar className="h-24 w-24 mx-auto md:mx-0">
                <AvatarImage
                  src={friend?.profilePicture || "/placeholder.svg"}
                  alt={`${friend?.name} ${friend?.surname}`}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                  {getInitials(friend?.name ?? "?", friend?.surname ?? "?")}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 text-center md:text-left">
                <div className="mb-3">
                  <h1 className="text-3xl font-bold mb-2">
                    {friend?.name} {friend?.surname}
                  </h1>
                </div>
                
                {friend?.description && (
                  <p className="text-muted-foreground mb-4">{friend.description}</p>
                )}
                
                {/* Additional profile info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {/* Email should be displayed here with the other info */}
                  {friend?.email && (
                    <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" /> 
                      <span>{friend.email}</span>
                    </div>
                  )}
                  {friend?.degree && (
                    <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground">
                      <GraduationCap className="h-4 w-4" /> 
                      <span>{friend.degree}</span>
                    </div>
                  )}
                  {friend?.occupation && (
                    <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground">
                      <Building2 className="h-4 w-4" /> 
                      <span>{friend.occupation}</span>
                    </div>
                  )}
                  {friend?.phone && (
                    <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" /> 
                      <span>{friend.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mutual Friends Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Mutual Friends
                <Badge variant="secondary">{mutualFriends.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMutuals ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : mutualFriends.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No mutual friends</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mutualFriends.slice(0, 5).map((mutualFriend) => (
                    <Link key={mutualFriend.uid} href={`/friends/${mutualFriend.uid}`}>
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={mutualFriend.profilePicture || "/placeholder.svg"} />
                          <AvatarFallback className="bg-muted text-foreground">
                            {getInitials(mutualFriend.name, mutualFriend.surname)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {mutualFriend.name} {mutualFriend.surname}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {mutualFriend.email || 'Mutual friend'}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {mutualFriends.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center pt-2">
                      and {mutualFriends.length - 5} more mutual friends
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mutual Organizations Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Mutual Organizations
                <Badge variant="secondary">{mutualOrganizations.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMutuals ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : mutualOrganizations.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No mutual organizations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mutualOrganizations.slice(0, 5).map((org) => (
                    <Link key={org.id} href={`/organisations/${org.id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-muted text-foreground">
                            {org.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{org.name}</p>
                            {org.isPrivate ? (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <Globe className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {Object.keys(org.members).length} members
                          </p>
                          {org.description && (
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {org.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {mutualOrganizations.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center pt-2">
                      and {mutualOrganizations.length - 5} more organizations
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}