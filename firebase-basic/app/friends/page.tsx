"use client"

import { useEffect, useState } from "react"
import { httpsCallable } from "firebase/functions"
import { fns } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Users, Mail, Check, X } from "lucide-react"
import AddFriendModal from "@/components/ui/addfriendmodal"
import { PageHeader } from "@/components/ui/page-header"
import { useUserId } from "@/hooks/useUserId"
import { toast } from "sonner"

type UserProfile = {
  uid: string
  name: string
  surname: string
  profilePicture: string
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<UserProfile[]>([])
  const [incomingRequests, setIncomingRequests] = useState<UserProfile[]>([])
  const [sentRequests, setSentRequests] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const { userId } = useUserId()

  // Firebase Functions
  const getFriendsFunc = httpsCallable<{}, UserProfile[]>(fns, "getFriends")
  const getFriendRequestsFunc = httpsCallable<{}, { incoming: UserProfile[], sent: UserProfile[] }>(fns, "getFriendRequests")
  const acceptFriendRequestFunc = httpsCallable<{ targetUserId: string }, { success: boolean, message: string }>(fns, "acceptFriendRequest")
  const rejectFriendRequestFunc = httpsCallable<{ targetUserId: string }, { success: boolean, message: string }>(fns, "rejectFriendRequest")
  const cancelFriendRequestFunc = httpsCallable<{ targetUserId: string }, { success: boolean, message: string }>(fns, "cancelFriendRequest")

  const loadFriendsData = async () => {
    if (!userId) return
    
    try {
      setLoading(true)
      const [friendsResult, requestsResult] = await Promise.all([
        getFriendsFunc({}),
        getFriendRequestsFunc({})
      ])

      setFriends(friendsResult.data)
      setIncomingRequests(requestsResult.data.incoming)
      setSentRequests(requestsResult.data.sent)
    } catch (error) {
      console.error("Error loading friends data:", error)
      toast.error("Failed to load friends data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFriendsData()
  }, [userId])

  const handleAccept = async (uid: string) => {
    try {
      const result = await acceptFriendRequestFunc({ targetUserId: uid })
      toast.success(result.data.message)
      await loadFriendsData() // Refresh data
    } catch (error: any) {
      console.error("Error accepting friend request:", error)
      toast.error(error.message || "Failed to accept friend request")
    }
  }

  const handleReject = async (uid: string) => {
    try {
      const result = await rejectFriendRequestFunc({ targetUserId: uid })
      toast.success(result.data.message)
      await loadFriendsData() // Refresh data
    } catch (error: any) {
      console.error("Error rejecting friend request:", error)
      toast.error(error.message || "Failed to reject friend request")
    }
  }

  const handleCancel = async (uid: string) => {
    try {
      const result = await cancelFriendRequestFunc({ targetUserId: uid })
      toast.success(result.data.message)
      await loadFriendsData() // Refresh data
    } catch (error: any) {
      console.error("Error cancelling friend request:", error)
      toast.error(error.message || "Failed to cancel friend request")
    }
  }

  const getInitials = (name: string, surname: string) => `${name[0] || ''}${surname[0] || ''}`.toUpperCase()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading friends...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Friends"
        description="Connect with classmates and study partners to collaborate on your academic journey."
      />

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Friends Column */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  Your Friends
                  <Badge variant="secondary" className="ml-2">
                    {friends.length}
                  </Badge>
                </CardTitle>
              </div>
              <div className="pt-2">
                <AddFriendModal />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {friends.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground mb-4">No friends yet</p>
                  <p className="text-sm text-muted-foreground">Start connecting with classmates!</p>
                </div>
              ) : (
                friends.map((friend) => (
                  <Link key={friend.uid} href={`/friends/${friend.uid}`}>
                    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={friend.profilePicture || "/placeholder.svg"} />
                        <AvatarFallback className="bg-muted text-foreground">
                          {getInitials(friend.name, friend.surname)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {friend.name} {friend.surname}
                        </p>
                        <p className="text-xs text-muted-foreground">Friend</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Friend Requests */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                Friend Requests
                <Badge variant="secondary" className="ml-2">
                  {incomingRequests.length + sentRequests.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                  Incoming ({incomingRequests.length})
                </h3>
                {incomingRequests.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">No incoming requests</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {incomingRequests.map((req) => (
                      <div
                        key={req.uid}
                        className="flex items-center justify-between bg-muted/30 border p-3 rounded-lg"
                      >
                        <Link href={`/friends/${req.uid}`} className="flex items-center gap-3 flex-1">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={req.profilePicture || "/placeholder.svg"} />
                            <AvatarFallback className="bg-muted text-foreground text-xs">
                              {getInitials(req.name, req.surname)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {req.name} {req.surname}
                          </span>
                        </Link>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAccept(req.uid)} className="h-8 px-3">
                            <Check className="h-3 w-3 mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(req.uid)}
                            className="h-8 px-3"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Sent ({sentRequests.length})</h3>
                {sentRequests.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">No sent requests</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sentRequests.map((req) => (
                      <div
                        key={req.uid}
                        className="flex items-center justify-between border p-3 rounded-lg bg-muted/20"
                      >
                        <Link href={`/friends/${req.uid}`} className="flex items-center gap-3 flex-1">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={req.profilePicture || "/placeholder.svg"} />
                            <AvatarFallback className="bg-muted text-foreground text-xs">
                              {getInitials(req.name, req.surname)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {req.name} {req.surname}
                          </span>
                        </Link>
                        <Button size="sm" variant="outline" onClick={() => handleCancel(req.uid)} className="h-8 px-3">
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}