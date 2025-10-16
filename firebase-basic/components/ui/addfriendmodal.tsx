"use client"

import { useEffect, useState } from "react"
import { getDatabase, ref, get } from "firebase/database"
import { getAuth } from "firebase/auth"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"

interface UserProfile {
  uid: string
  name: string
  surname: string
  email: string
}

export default function AddFriendModal() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserProfile[]>([])
  const [allUsers, setAllUsers] = useState<UserProfile[]>([])
  const [open, setOpen] = useState(false)
  const currentUser = getAuth().currentUser
  const router = useRouter()

  const db = getDatabase()

  useEffect(() => {
    if (!open) return
    const fetchUsers = async () => {
      const snapshot = await get(ref(db, "users"))
      const usersData = snapshot.val()
      if (!usersData) return

      const users: UserProfile[] = Object.entries(usersData)
        .filter(([uid]) => uid !== currentUser?.uid)
        .map(([uid, data]: any) => {
          return {
            uid,
            name: data.UserSettings?.name || "",
            surname: data.UserSettings?.surname || "",
            email: data.UserSettings?.email || "",
          }
        })
      setAllUsers(users)
    }
    fetchUsers()
  }, [open])

  const handleSearch = (text: string) => {
    setQuery(text)
    if (!text) {
      setResults([])
      return
    }

    const filtered = allUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(text.toLowerCase()) ||
        user.surname.toLowerCase().includes(text.toLowerCase()) ||
        user.email.toLowerCase().includes(text.toLowerCase())
    )
    setResults(filtered)
  }

  const handleViewProfile = (uid: string) => {
    router.push(`/friends/${uid}`)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-500 hover:bg-blue-700">Add Friend</Button>
      </DialogTrigger>
      <DialogContent className="space-y-4">
        <DialogHeader>
          <DialogTitle>Search for a Friend</DialogTitle>
        </DialogHeader>

        <Input
          type="text"
          placeholder="Search by name, surname or email"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />

        <ul className="space-y-2">
          {results.map((user) => (
            <li
              key={user.uid}
              className="flex justify-between items-center border p-2 rounded-md cursor-pointer hover:bg-muted/50"
              onClick={() => handleViewProfile(user.uid)}
            >
              <div>
                <p className="font-medium">{user.name} {user.surname}</p>
              
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

