"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getAuth } from "firebase/auth"
import { getDatabase, ref, get, set, remove } from "firebase/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  Building2,
  FileText,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Users,
} from "lucide-react"

type FriendProfile = {
  name: string
  surname: string
  email: string
  profilePicture?: string
  bio?: string
  phone?: string
  location?: string
  joinDate?: string
  organizations?: string[]
  sharedNotes?: string[]
}

export default function FriendPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [friend, setFriend] = useState<FriendProfile | null>(null)
  const [status, setStatus] = useState<"friends" | "sent" | "incoming" | "none">("none")
  const [loading, setLoading] = useState(true)

  const currentUser = getAuth().currentUser
  const db = getDatabase()

  useEffect(() => {
    const loadProfileAndStatus = async () => {
      if (!currentUser) return

      try {
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
      } catch (error) {
        console.error("Error loading profile:", error)
      } finally {
        setLoading(false)
      }
    }

    loadProfileAndStatus()
  }, [id, currentUser])

const handleSendRequest = async () => {
  if (!currentUser || !friend) return

  const requestData = {
    name: friend.name ?? "",
    surname: friend.surname ?? "",
    email: friend.email ?? "", // ✅ Ensure this is not undefined
  }

  // Add friend ID to your sentRequests
  await set(ref(db, `users/${currentUser.uid}/sentRequests/${id}`), requestData)

  // Add your ID to their incomingRequests
  await set(ref(db, `users/${id}/incomingRequests/${currentUser.uid}`), {
    name: currentUser.displayName ?? "",
    email: currentUser.email ?? "",
  })

//   toast.success("Friend request sent!")
//   setStatus("sent")
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

  const getInitials = (name: string, surname: string) => {
    return `${name.charAt(0)}${surname.charAt(0)}`.toUpperCase()
  }

  const getStatusBadge = () => {
    switch (status) {
      case "friends":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <UserCheck className="h-3 w-3 mr-1" />
            Friends
          </Badge>
        )
      case "sent":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            Request Sent
          </Badge>
        )
      case "incoming":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <Mail className="h-3 w-3 mr-1" />
            Incoming Request
          </Badge>
        )
      default:
        return null
    }
  }

  const getActionButton = () => {
    switch (status) {
      case "friends":
        return (
          <Button disabled className="bg-green-600 hover:bg-green-600">
            <UserCheck className="h-4 w-4 mr-2" />
            Friends
          </Button>
        )
      case "sent":
        return (
          <Button variant="destructive" onClick={handleCancel}>
            <UserX className="h-4 w-4 mr-2" />
            Cancel Request
          </Button>
        )
      case "incoming":
        return (
          <div className="flex gap-2">
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleAccept}>
              <UserCheck className="h-4 w-4 mr-2" />
              Accept
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              <UserX className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        )
      default:
        return (
          <Button className="bg-blue-500 hover:bg-blue-700" onClick={handleSendRequest}>
            <UserPlus className="h-4 w-4 mr-2" />
            Send Friend Request
          </Button>
        )
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-24 w-24 bg-gray-200 rounded-full mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (!friend) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="text-center py-12">
          <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile Not Found</h2>
          <p className="text-gray-500">This user profile could not be found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1" />
        {getStatusBadge()}
      </div>

      {/* Profile Header Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex flex-col items-center md:items-start">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage
                  src={friend.profilePicture || "/placeholder.svg"}
                  alt={`${friend.name} ${friend.surname}`}
                />
                <AvatarFallback className="bg-blue-100 text-blue-600 text-xl">
                  {getInitials(friend.name, friend.surname)}
                </AvatarFallback>
              </Avatar>
              {getActionButton()}
            </div>

            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {friend.name} {friend.surname}
              </h1>

              {friend.bio && <p className="text-gray-600 mb-4">{friend.bio}</p>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {friend.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span>{friend.email}</span>
                  </div>
                )}
                {friend.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{friend.phone}</span>
                  </div>
                )}
                {friend.location && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>{friend.location}</span>
                  </div>
                )}
                {friend.joinDate && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {friend.joinDate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Common Organizations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-green-600" />
              Common Organizations
              <Badge variant="secondary" className="ml-auto">
                {friend.organizations?.length || 2}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {friend.organizations && friend.organizations.length > 0 ? (
              <div className="space-y-3">
                {friend.organizations.map((org, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-100"
                  >
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="font-medium text-green-800">{org}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="font-medium text-green-800">Example Org A</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="font-medium text-green-800">Example Org B</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shared Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Shared Notes
              <Badge variant="secondary" className="ml-auto">
                {friend.sharedNotes?.length || 2}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {friend.sharedNotes && friend.sharedNotes.length > 0 ? (
              <div className="space-y-3">
                {friend.sharedNotes.map((note, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="font-medium text-blue-800">{note}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="font-medium text-blue-800">Mathematics Notes - Chapter 5</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="font-medium text-blue-800">Physics Lab Report</span>
                </div>
              </div>
            )}

            {(friend.sharedNotes?.length || 0) === 0 && (
              <div className="text-center py-6 text-gray-500 border-t mt-4">
                <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No shared notes yet</p>
                <p className="text-xs text-gray-400">Start collaborating to see shared notes here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
