"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getAuth } from "firebase/auth"
import { getDatabase, ref, get, onValue, set, remove, off } from "firebase/database"
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

export default function FriendPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [friend, setFriend] = useState<any>(null)
  const [status, setStatus] = useState<"friends" | "sent" | "incoming" | "none">("none")
  const [mutualFriends, setMutualFriends] = useState<any[]>([])
  const [commonOrgs, setCommonOrgs] = useState<string[]>([])

  const currentUser = getAuth().currentUser
  const db = getDatabase()

  useEffect(() => {
    if (!currentUser) return

    const friendRef = ref(db, `users/${id}/UserSettings`)
    const currentUserRef = ref(db, `users/${currentUser.uid}`)
    const friendFriendsRef = ref(db, `users/${id}/friends`)
    const currentFriendsRef = ref(db, `users/${currentUser.uid}/friends`)

    const unsubProfile = onValue(friendRef, (snapshot) => {
      if (snapshot.exists()) setFriend(snapshot.val())
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

      const myOrgs = new Set<string>(userData.organizations || [])
      const theirOrgs = new Set<string>(friend?.organizations || [])
      const common = [...myOrgs].filter((org) => theirOrgs.has(org))
      setCommonOrgs(common)
    })

    const unsubMutuals = onValue(currentFriendsRef, (snap1) => {
      const currentList = snap1.exists() ? Object.keys(snap1.val()) : []
      onValue(friendFriendsRef, (snap2) => {
        const friendList = snap2.exists() ? Object.keys(snap2.val()) : []
        const mutuals = currentList.filter((uid) => friendList.includes(uid))
        Promise.all(
          mutuals.map(async (uid) => {
            const s = await get(ref(db, `users/${uid}/UserSettings`))
            return { uid, ...s.val() }
          }),
        ).then(setMutualFriends)
      })
    })

    return () => {
      off(friendRef)
      off(currentUserRef)
      off(friendFriendsRef)
      off(currentFriendsRef)
    }
  }, [id, currentUser, friend])

  const handleSendRequest = async () => {
    if (!currentUser || !friend) return
    const requestData = {
      name: friend.name ?? "",
      surname: friend.surname ?? "",
      email: friend.email ?? "",
    }
    await set(ref(db, `users/${currentUser.uid}/sentRequests/${id}`), requestData)
    await set(ref(db, `users/${id}/incomingRequests/${currentUser.uid}`), {
      name: currentUser.displayName ?? "",
      email: currentUser.email ?? "",
    })
  }

  const handleCancel = async () => {
    if (!currentUser) return
    await remove(ref(db, `users/${currentUser.uid}/sentRequests/${id}`))
    await remove(ref(db, `users/${id}/incomingRequests/${currentUser.uid}`))
  }

  const handleAccept = async () => {
    if (!currentUser) return
    await set(ref(db, `users/${currentUser.uid}/friends/${id}`), true)
    await set(ref(db, `users/${id}/friends/${currentUser.uid}`), true)
    await remove(ref(db, `users/${currentUser.uid}/incomingRequests/${id}`))
    await remove(ref(db, `users/${id}/sentRequests/${currentUser.uid}`))
  }

  const handleReject = async () => {
    if (!currentUser) return
    await remove(ref(db, `users/${currentUser.uid}/incomingRequests/${id}`))
    await remove(ref(db, `users/${id}/sentRequests/${currentUser.uid}`))
  }

  const handleUnfriend = async () => {
    if (!currentUser) return
    await remove(ref(db, `users/${currentUser.uid}/friends/${id}`))
    await remove(ref(db, `users/${id}/friends/${currentUser.uid}`))
  }

  const getInitials = (name: string, surname: string) => {
    return `${name.charAt(0)}${surname.charAt(0)}`.toUpperCase()
  }

  const getActionButton = () => {
    switch (status) {
      case "friends":
        return (
          <Button variant="destructive" onClick={handleUnfriend}>
            <UserX className="h-4 w-4 mr-2" /> Cancel Friendship
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
                  {friend?.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" /> <span>{friend.phone}</span>
                    </div>
                  )}
                  {friend?.location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" /> <span>{friend.location}</span>
                    </div>
                  )}
                  {friend?.joinDate && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" /> <span>Joined {friend.joinDate}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mutual Friends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Mutual Friends
              <Badge variant="secondary" className="ml-auto">
                {mutualFriends.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mutualFriends.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {mutualFriends.map((f) => (
                  <div key={f.uid} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={f.profilePicture || ""} alt={f.name} />
                      <AvatarFallback>
                        {f.name.charAt(0)}
                        {f.surname?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">
                      {f.name} {f.surname}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No mutual friends found</p>
            )}
          </CardContent>
        </Card>

        {/* Common Organizations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Common Organizations
              <Badge variant="secondary" className="ml-auto">
                {commonOrgs.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {commonOrgs.length > 0 ? (
              <ul className="space-y-2">
                {commonOrgs.map((org, i) => (
                  <li key={i} className="bg-muted/50 px-3 py-2 rounded-md border">
                    {org}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No common organizations found.</p>
            )}
          </CardContent>
        </Card>

        {/* Shared Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Shared Notes
              <Badge variant="secondary" className="ml-auto">
                0
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Shared and public notes from this user will appear here once available.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
