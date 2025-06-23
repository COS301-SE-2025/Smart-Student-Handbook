// app/friends/[id]/page.tsx

"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getAuth } from "firebase/auth"
import { getDatabase, ref, get, set, remove } from "firebase/database"
import { Button } from "@/components/ui/button"

export default function FriendPage() {
  const params = useParams()
  const id = params.id as string
  const [friend, setFriend] = useState<any>(null)
  const [status, setStatus] = useState<"friends" | "sent" | "incoming" | "none">("none")

  const currentUser = getAuth().currentUser
  const db = getDatabase()

  useEffect(() => {
    const loadProfileAndStatus = async () => {
      if (!currentUser) return

      const profileSnap = await get(ref(db, `users/${id}/UserSettings`))
      if (profileSnap.exists()) {
        setFriend(profileSnap.val())
      }

      const userSnap = await get(ref(db, `users/${currentUser.uid}`))
      if (!userSnap.exists()) return

      const userData = userSnap.val()
      const friends = userData.friends || {}
      const incoming = userData.incomingRequests || {}
      const sent = userData.sentRequests || {}

      if (friends[id]) setStatus("friends")
      else if (incoming[id]) setStatus("incoming")
      else if (sent[id]) setStatus("sent")
      else setStatus("none")
    }

    loadProfileAndStatus()
  }, [id])

  const handleSendRequest = async () => {
    if (!currentUser || !friend) return
    const requestData = {
      name: friend.name,
      surname: friend.surname,
      email: friend.email,
    }

    await set(ref(db, `users/${currentUser.uid}/sentRequests/${id}`), requestData)
    await set(ref(db, `users/${id}/incomingRequests/${currentUser.uid}`), {
      name: currentUser.displayName ?? "",
      email: currentUser.email ?? "",
    })
    setStatus("sent")
  }

  const handleCancel = async () => {
    if (!currentUser) return
    await remove(ref(db, `users/${currentUser.uid}/sentRequests/${id}`))
    await remove(ref(db, `users/${id}/incomingRequests/${currentUser.uid}`))
    setStatus("none")
  }

  const handleAccept = async () => {
    if (!currentUser) return
    await set(ref(db, `users/${currentUser.uid}/friends/${id}`), true)
    await set(ref(db, `users/${id}/friends/${currentUser.uid}`), true)
    await remove(ref(db, `users/${currentUser.uid}/incomingRequests/${id}`))
    await remove(ref(db, `users/${id}/sentRequests/${currentUser.uid}`))
    setStatus("friends")
  }

  const handleReject = async () => {
    if (!currentUser) return
    await remove(ref(db, `users/${currentUser.uid}/incomingRequests/${id}`))
    await remove(ref(db, `users/${id}/sentRequests/${currentUser.uid}`))
    setStatus("none")
  }

  return (
    <div className="p-6">
      {friend ? (
        <>
          <h1 className="text-2xl font-bold mb-4">{friend.name} {friend.surname}</h1>
          <img src={friend.profilePicture || "/placeholder.jpg"} alt="Profile" className="w-24 h-24 rounded-full mb-4" />

          <div className="mb-4">
            {status === "friends" && <Button disabled>Friends</Button>}
            {status === "sent" && <Button variant="destructive" onClick={handleCancel}>Cancel Request</Button>}
            {status === "incoming" && (
              <>
                <Button className="mr-2" onClick={handleAccept}>Accept</Button>
                <Button variant="destructive" onClick={handleReject}>Reject</Button>
              </>
            )}
            {status === "none" && <Button onClick={handleSendRequest}>Send Friend Request</Button>}
          </div>

          <div>
            <h2 className="font-semibold text-lg">Common Organizations</h2>
            <ul className="list-disc pl-5">
              <li>Example Org A</li>
              <li>Example Org B</li>
            </ul>
          </div>

          <div className="mt-4">
            <h2 className="font-semibold text-lg">Shared Notes</h2>
            <ul className="list-disc pl-5">
              <li>Note 1</li>
              <li>Note 2</li>
            </ul>
          </div>
        </>
      ) : (
        <p>Loading profile...</p>
      )}
    </div>
  )
}
