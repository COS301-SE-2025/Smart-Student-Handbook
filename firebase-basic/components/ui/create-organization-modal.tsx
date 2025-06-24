"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { httpsCallable } from "firebase/functions"
import { fn } from "@/lib/firebase-connector"
import { getAuth } from "firebase/auth"
import { Search, UserPlus, Users, Camera, X, Check } from "lucide-react"

interface CreateOrganizationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateOrganization: (org: {
    name: string
    description: string
    isPrivate: boolean
    selectedFriends: string[]
    organizationImage?: string
  }) => void
}

type Friend = {
  id: string
  name: string
  email: string
  avatarUrl: string
}

export function CreateOrganizationModal({ open, onOpenChange, onCreateOrganization }: CreateOrganizationModalProps) {
  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [organizationImage, setOrganizationImage] = useState<string | null>(null)
  const [selectedFriends, setSelectedFriends] = useState<string[]>([])

  // Friends list state
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendQuery, setFriendQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Exclude the current user
  const authClient = getAuth()

  // Callable function for listing all users
  const listUsersFn = useMemo(() => httpsCallable<{}, Friend[]>(fn, "listUsers"), [])

  // Fetch users when modal opens, then exclude the current user
  useEffect(() => {
    if (!open) return
    setLoadingFriends(true)
    listUsersFn({})
      .then((res) => {
        const allUsers = res.data
        const me = authClient.currentUser?.uid
        const list = me ? allUsers.filter((u) => u.id !== me) : allUsers
        setFriends(list)
      })
      .catch((err) => {
        console.error("Failed to list users:", err)
        setFriends([])
      })
      .finally(() => setLoadingFriends(false))
  }, [open, listUsersFn, authClient])

  // Filter by search query
  const filtered = friends.filter((f) => {
    const q = friendQuery.toLowerCase()
    return f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q)
  })

  // Handlers
  const toggleFriend = (id: string) =>
    setSelectedFriends((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]))

  const removeFriend = (friendId: string) => {
    setSelectedFriends((prev) => prev.filter((id) => id !== friendId))
  }

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setOrganizationImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  const resetForm = () => {
    setName("")
    setDescription("")
    setIsPrivate(false)
    setOrganizationImage(null)
    setSelectedFriends([])
    setFriendQuery("")
    setShowSearch(false)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    await onCreateOrganization({
      name: name.trim(),
      description: description.trim(),
      isPrivate,
      selectedFriends,
      organizationImage: organizationImage || undefined,
    })

    resetForm()
    setIsSubmitting(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Create New Organisation
          </DialogTitle>
          <DialogDescription>
            Create a study group to collaborate with other students. You can make it public for everyone or private for
            invited members only.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Organization Image */}
          <div className="space-y-2">
            <Label>Organization Picture (Optional)</Label>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  {organizationImage ? (
                    <AvatarImage src={organizationImage || "/placeholder.svg"} alt="Organization" />
                  ) : (
                    <AvatarFallback className="text-2xl">
                      <Camera className="h-8 w-8 text-muted-foreground" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImage}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Click the circle to upload an image for your organization. This will help members identify your group.
                </p>
                {organizationImage && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setOrganizationImage(null)}
                  >
                    Remove Image
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., CS301 Study Group"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What's this organization about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Privacy Settings */}
          <div className="space-y-4">
            <Label>Privacy Settings</Label>
            <RadioGroup
              value={isPrivate ? "private" : "public"}
              onValueChange={(value) => setIsPrivate(value === "private")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="public" />
                <Label htmlFor="public" className="flex-1">
                  <div className="font-medium">Public</div>
                  <div className="text-sm text-muted-foreground">Anyone can discover and join this organization</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="private" id="private" />
                <Label htmlFor="private" className="flex-1">
                  <div className="font-medium">Private</div>
                  <div className="text-sm text-muted-foreground">Only invited members can see and join</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Add Friends Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Add Friends</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowSearch(!showSearch)}>
                <UserPlus className="h-4 w-4 mr-2" />
                {showSearch ? "Hide" : "Add Friends"}
              </Button>
            </div>

            {/* Selected Friends */}
            {selectedFriends.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Selected Friends ({selectedFriends.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedFriends.map((friendId) => {
                    const friend = friends.find((f) => f.id === friendId)
                    return (
                      <Badge key={friendId} variant="secondary" className="flex items-center gap-1">
                        {friend?.name}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() => removeFriend(friendId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Friend Search */}
            {showSearch && (
              <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search friends by name or email..."
                    value={friendQuery}
                    onChange={(e) => setFriendQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1">
                  {loadingFriends ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Loading users…</p>
                  ) : filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {friendQuery ? "No friends found" : "No friends available"}
                    </p>
                  ) : (
                    filtered.map((fr) => (
                      <div
                        key={fr.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                          selectedFriends.includes(fr.id)
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleFriend(fr.id)}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{fr.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{fr.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{fr.email}</p>
                        </div>
                        {selectedFriends.includes(fr.id) && <Check className="h-4 w-4 text-primary" />}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-2" />
                  Create Organisation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
