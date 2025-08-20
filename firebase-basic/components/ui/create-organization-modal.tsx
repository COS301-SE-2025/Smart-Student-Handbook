'use client'

import * as React from "react"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getAuth } from "firebase/auth"
import { getDatabase, ref, get } from "firebase/database"
import { Search, UserPlus, Users, X, Check } from "lucide-react"

interface CreateOrganizationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateOrganization: (org: {
    name: string
    description: string
    isPrivate: boolean
    selectedFriends: string[]
  }) => Promise<void> | void
}

type Friend = {
  id: string
  name: string
  email: string
}

export function CreateOrganizationModal({
  open,
  onOpenChange,
  onCreateOrganization,
}: CreateOrganizationModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [selectedFriends, setSelectedFriends] = useState<string[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendQuery, setFriendQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authClient = getAuth()
  const me = authClient.currentUser?.uid

  useEffect(() => {
    if (!open) return
    setLoadingFriends(true)
    ;(async () => {
      try {
        const db = getDatabase()
        const snap = await get(ref(db, "users"))
        const data = snap.val() as Record<string, any> | null
        if (!data) {
          setFriends([])
          return
        }
        const list: Friend[] = Object.entries(data)
          .flatMap(([uid, node]) => {
            const settings = node.UserSettings
            if (!settings?.name) return []
            const fullName =
              settings.name +
              (settings.surname ? ` ${settings.surname}` : "")
            return [{
              id: uid,
              name: fullName,
              email: settings.email || "",
            }]
          })
          .filter(u => u.id !== me)
        setFriends(list)
      } catch {
        setFriends([])
      } finally {
        setLoadingFriends(false)
      }
    })()
  }, [open, me])

  const filtered = useMemo(() => {
    const q = friendQuery.toLowerCase()
    return friends.filter(
      f =>
        f.name.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q)
    )
  }, [friends, friendQuery])

  const toggleFriend = (id: string) =>
    setSelectedFriends(curr =>
      curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id]
    )
  const removeFriend = (fid: string) =>
    setSelectedFriends(prev => prev.filter(id => id !== fid))

  const resetForm = () => {
    setName("")
    setDescription("")
    setIsPrivate(false)
    setSelectedFriends([])
    setFriendQuery("")
    setShowSearch(false)
    setError(null)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return

    if (isPrivate && selectedFriends.length === 0) {
      setError("Please invite at least one friend for a private organisation.")
      return
    }

    setIsSubmitting(true)
    try {
      await new Promise(res => setTimeout(res, 500))
      await onCreateOrganization({
        name: name.trim(),
        description: description.trim(),
        isPrivate,
        selectedFriends,
      })
      resetForm()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
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
            Create a study group to collaborate with other students.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., CS301 Study Group"
              value={name}
              onChange={e => setName(e.target.value)}
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
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Privacy */}
          <div className="space-y-4">
            <Label>Privacy Settings</Label>
            <RadioGroup
              value={isPrivate ? "private" : "public"}
              onValueChange={v => {
                const priv = v === "private"
                setIsPrivate(priv)
                setShowSearch(priv)
                if (!priv) setSelectedFriends([])
              }}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="public" />
                <Label htmlFor="public" className="flex-1">
                  <div className="font-medium">Public</div>
                  <div className="text-sm text-muted-foreground">
                    Anyone can discover and join
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="private" id="private" />
                <Label htmlFor="private" className="flex-1">
                  <div className="font-medium">Private</div>
                  <div className="text-sm text-muted-foreground">
                    Only invited members
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Friend picker */}
          {isPrivate && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Add Friends</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSearch(s => !s)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {showSearch ? "Hide" : "Add Friends"}
                </Button>
              </div>

              {selectedFriends.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">
                    Selected Friends ({selectedFriends.length})
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedFriends.map(fid => {
                      const fr = friends.find(f => f.id === fid)
                      return (
                        <Badge key={fid} variant="secondary" className="flex items-center gap-1">
                          {fr?.name}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => removeFriend(fid)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}

              {showSearch && (
                <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search friends..."
                      value={friendQuery}
                      onChange={e => setFriendQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {loadingFriends ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Loading users…
                      </p>
                    ) : filtered.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {friendQuery ? "No friends found" : "No friends available"}
                      </p>
                    ) : (
                      filtered.map(fr => (
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
                            <AvatarFallback className="text-xs">
                              {fr.name.charAt(0)}
                            </AvatarFallback>
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
          )}

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-4">
              <span className="font-semibold text-red-700">Error:</span>
              <span className="text-red-700 truncate">{error}</span>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? "Creating..." : "Create Organisation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
