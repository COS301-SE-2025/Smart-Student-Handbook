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
import { PageHeader } from "@/components/ui/page-header"

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

  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);

  const handleSearch = async () => {
    const snap = await get(ref(db, "users"));
    if (snap.exists()) {
      const users = snap.val();
      const matches: UserProfile[] = [];

      for (const uid in users) {
        const settings = users[uid]?.UserSettings;
        const fullName = `${settings?.name ?? ""} ${settings?.surname ?? ""}`.toLowerCase();
        if (fullName.includes(searchName.toLowerCase())) {
          matches.push({ uid, ...settings });
        }
      }

      setSearchResults(matches);
    }
  };

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
