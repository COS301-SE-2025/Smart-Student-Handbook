"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"
import { getAuth } from "firebase/auth"
import { getDatabase, ref, onValue, off } from "firebase/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  UserPlus,
  UserCheck,
  UserX,
  Building2,
  FileText,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Users,
} from "lucide-react"
import { toast } from "sonner"

export default function FriendPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [friend, setFriend] = useState<any>(null)
  const [status, setStatus] = useState<"friends" | "sent" | "incoming" | "none">("none")
  const [mutualFriends, setMutualFriends] = useState<any[]>([])
  const [commonOrgs, setCommonOrgs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const currentUser = getAuth().currentUser
  const db = getDatabase()

  // Firebase Functions
  const sendFriendRequestFunc = httpsCallable<{ targetUserId: string }, { success: boolean, message: string }>(fns, "sendFriendRequest")
  const acceptFriendRequestFunc = httpsCallable<{ targetUserId: string }, { success: boolean, message: string }>(fns, "acceptFriendRequest")
  const rejectFriendRequestFunc = httpsCallable<{ targetUserId: string }, { success: boolean, message: string }>(fns, "rejectFriendRequest")
  const cancelFriendRequestFunc = httpsCallable<{ targetUserId: string }, { success: boolean, message: string }>(fns, "cancelFriendRequest")
  const removeFriendFunc = httpsCallable<{ targetUserId: string }, { success: boolean, message: string }>(fns, "removeFriend")

  useEffect(() => {
    if (!currentUser) return

    const friendRef = ref(db, `users/${id}/UserSettings`)
    const currentUserRef = ref(db, `users/${currentUser.uid}`)

    const unsubProfile = onValue(friendRef, (snapshot) => {
      if (snapshot.exists()) {
        setFriend(snapshot.val())
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

    return () => {
      off(friendRef)
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
          <Button variant="destructive" onClick={handleCancel}>
            <UserX className="h-4 w-4 mr-2" /> Cancel Request
          </Button>
        )
      case "incoming":
        return (
          <div className="flex gap-2">
            <Button onClick={handleAccept}>
              <UserCheck className="h-4 w-4 mr-2" /> Accept
            </Button>
            <Button variant="destructive" onClick={handleReject}>
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
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          {getActionButton()}
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage
                  src={friend?.profilePicture || "/placeholder.svg"}
                  alt={`${friend?.name} ${friend?.surname}`}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                  {getInitials(friend?.name ?? "?", friend?.surname ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">
                  {friend?.name} {friend?.surname}
                </h1>
                <p className="text-muted-foreground mb-2">{friend?.bio}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {friend?.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" /> <span>{friend.email}</span>
                    </div>
                  )}
                  {friend?.degree && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-4 w-4" /> <span>{friend.degree}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional cards for mutual friends, organizations, etc. can be added here */}
      </div>
    </div>
  )
}