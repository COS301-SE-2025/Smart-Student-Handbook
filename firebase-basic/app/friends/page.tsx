"use client"

import { useEffect, useState } from "react"
import { getAuth } from "firebase/auth"
import { db } from "@/lib/firebase"
import { ref, get, onValue, remove, set } from "firebase/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Users, Mail, Check, X } from "lucide-react"
import AddFriendModal from "@/components/ui/addfriendmodal"

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
  const auth = getAuth()
  const user = auth.currentUser

  useEffect(() => {
    if (!user) return
    const uid = user.uid
    const userRef = ref(db, `users/${uid}`)

    const unsubscribe = onValue(userRef, async (snapshot) => {
      if (!snapshot.exists()) return
      const data = snapshot.val()

      const friendIds = Object.keys(data.friends || {})
      const incomingIds = Object.keys(data.incomingRequests || {})
      const sentIds = Object.keys(data.sentRequests || {})

      await loadUsers(friendIds, setFriends)
      await loadUsers(incomingIds, setIncomingRequests)
      await loadUsers(sentIds, setSentRequests)
    })

    return () => unsubscribe()
  }, [user])

  const loadUsers = async (ids: string[], setter: (users: UserProfile[]) => void) => {
    const profiles: UserProfile[] = []
    for (const id of ids) {
      const snap = await get(ref(db, `users/${id}/UserSettings`))
      if (snap.exists()) profiles.push({ uid: id, ...snap.val() })
    }
    setter(profiles)
  }

  const handleAccept = async (uid: string) => {
    if (!user) return
    await set(ref(db, `users/${user.uid}/friends/${uid}`), true)
    await set(ref(db, `users/${uid}/friends/${user.uid}`), true)
    await remove(ref(db, `users/${user.uid}/incomingRequests/${uid}`))
    await remove(ref(db, `users/${uid}/sentRequests/${user.uid}`))
  }

  const handleReject = async (uid: string) => {
    if (!user) return
    await remove(ref(db, `users/${user.uid}/incomingRequests/${uid}`))
    await remove(ref(db, `users/${uid}/sentRequests/${user.uid}`))
  }

  const handleCancel = async (uid: string) => {
    if (!user) return
    await remove(ref(db, `users/${user.uid}/sentRequests/${uid}`))
    await remove(ref(db, `users/${uid}/incomingRequests/${user.uid}`))
  }

  const getInitials = (name: string, surname: string) => `${name[0]}${surname[0]}`.toUpperCase()

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        {/* Friends Column */}
        <Card>
          <CardHeader className="pb-3 space-y-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Your Friends
              <Badge variant="secondary" className="ml-auto">
                {friends.length}
              </Badge>
            </CardTitle>
            <AddFriendModal />
          </CardHeader>
          <CardContent className="space-y-3">
            {friends.map((friend) => (
              <Link key={friend.uid} href={`/friends/${friend.uid}`}>
                <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={friend.profilePicture || "/placeholder.svg"} />
                    <AvatarFallback>{getInitials(friend.name, friend.surname)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">
                      {friend.name} {friend.surname}
                    </p>
                    <p className="text-sm text-muted-foreground">Friend</p>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Friend Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-primary" />
              Friend Requests
              <Badge variant="secondary" className="ml-auto">
                {incomingRequests.length + sentRequests.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">Incoming ({incomingRequests.length})</h3>
              {incomingRequests.map((req) => (
                <div key={req.uid} className="flex items-center justify-between bg-muted/50 border p-3 rounded mb-2">
                  <Link href={`/friends/${req.uid}`} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={req.profilePicture || "/placeholder.svg"} />
                      <AvatarFallback>{getInitials(req.name, req.surname)}</AvatarFallback>
                    </Avatar>
                    <span>
                      {req.name} {req.surname}
                    </span>
                  </Link>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAccept(req.uid)} className="flex items-center gap-1">
                      <Check className="h-4 w-4" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(req.uid)}
                      className="flex items-center gap-1"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Sent ({sentRequests.length})</h3>
              {sentRequests.map((req) => (
                <div key={req.uid} className="flex items-center justify-between border p-3 rounded bg-muted/30 mb-2">
                  <Link href={`/friends/${req.uid}`} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={req.profilePicture || "/placeholder.svg"} />
                      <AvatarFallback>{getInitials(req.name, req.surname)}</AvatarFallback>
                    </Avatar>
                    <span>
                      {req.name} {req.surname}
                    </span>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancel(req.uid)}
                    className="flex items-center gap-1"
                  >
                    <X className="h-4 w-4" />
                    Cancel Request
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
