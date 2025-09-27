"use client"

import { useEffect, useState } from "react"
import { getAuth, onAuthStateChanged, type User } from "@firebase/auth"
import { ref, update } from "@firebase/database"
import { db } from "@/lib/firebase"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import NoteTree from "@/components/notes/NoteTree"

import { Plus, FolderPlus, Loader2, Notebook, ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react"

import type { FileNode } from "@/types/note"
import { addNode, moveNode, sortTree } from "@/lib/note/treeActions"
import {
  buildSharedTreeFromRealtimeDB,
  buildTreeFromRealtimeDB,
  createFolderInDB,
  createNoteInDB,
  deleteNodeInDB,
  renameNodeInDB,
} from "@/lib/DBTree"

export default function RightNotesPanel({
  userId,
  onOpenNote,
  setOwnerId,
}: {
  userId: string
  onOpenNote: (noteId: string) => void
  setOwnerId: (ownerId: string) => void
}) {
  const [user, setUser] = useState<User | null>(null)

  // Trees
  const [myTree, setMyTree] = useState<FileNode[]>([])
  const [sharedTree, setSharedTree] = useState<FileNode[]>([])

  // UI state (org-style headers & collapsibles)
  const [loadingMy, setLoadingMy] = useState(false)
  const [loadingShared, setLoadingShared] = useState(false)
  const [expandedMy, setExpandedMy] = useState(true)
  const [expandedShared, setExpandedShared] = useState(true)

  /* ------------------------------- Auth bootstrap ------------------------------ */
  useEffect(() => {
    const auth = getAuth()
    const unsub = onAuthStateChanged(auth, (firebaseUser) => setUser(firebaseUser))
    return () => unsub()
  }, [])

  /* --------------------------- Load personal + shared --------------------------- */
  useEffect(() => {
    if (!userId) return
    ;(async () => {
      try {
        setLoadingMy(true)
        const personal = await buildTreeFromRealtimeDB(userId)
        setMyTree(personal)
      } finally {
        setLoadingMy(false)
      }
    })()
    ;(async () => {
      try {
        setLoadingShared(true)
        const shared = await buildSharedTreeFromRealtimeDB(userId)
        setSharedTree(shared)
      } finally {
        setLoadingShared(false)
      }
    })()
  }, [userId])

  /* --------------------------------- Handlers ---------------------------------- */
  const handleAdd = async (scope: "my" | "shared", type: "note" | "folder") => {
    if (!userId) return

    // Preserve existing create semantics: create under user's path,
    // let your sharing model expose into sharedTree.
    if (scope === "my") {
      const create =
        type === "folder"
          ? () => createFolderInDB(userId, "New Folder", null)
          : () => createNoteInDB(userId, "Untitled Note", null)
      const newNode = await create()
      setMyTree((prev) => addNode(prev, null, type, newNode.id, newNode.name))
      return
    }

    if (scope === "shared") {
      const create =
        type === "folder"
          ? () => createFolderInDB(userId, "New Shared Folder", null)
          : () => createNoteInDB(userId, "Untitled Shared Note", null)
      const newNode = await create()
      setSharedTree((prev) => addNode(prev, null, type, newNode.id, newNode.name))
      return
    }
  }

  const handleMoveMy = (draggedId: string, targetFolderId: string | null) => {
    if (!userId) return
    setMyTree((prev) => {
      const updated = moveNode(prev, draggedId, targetFolderId)
      update(ref(db, `users/${userId}/notes/${draggedId}`), { parentId: targetFolderId ?? null })
      return sortTree(updated)
    })
  }

  const handleMoveShared = (draggedId: string, targetFolderId: string | null) => {
    // Preserve your existing shared semantics — if your model writes under user path,
    // this mirrors the personal move. If shared is read-only, you can no-op here.
    if (!userId) return
    setSharedTree((prev) => {
      const updated = moveNode(prev, draggedId, targetFolderId)
      update(ref(db, `users/${userId}/notes/${draggedId}`), { parentId: targetFolderId ?? null })
      return sortTree(updated)
    })
  }

  const handleRename = async (id: string, newName: string) => {
    if (!userId) return
    // Update both trees optimistically (node might exist in either)
    setMyTree((prev) => renameInTree(prev, id, newName))
    setSharedTree((prev) => renameInTree(prev, id, newName))
    await renameNodeInDB(userId, id, newName)
  }

  const handleDelete = async (id: string) => {
    if (!userId) return
    setMyTree((prev) => deleteFrom(clone(prev), id))
    setSharedTree((prev) => deleteFrom(clone(prev), id))
    await deleteNodeInDB(userId, id)
  }

  function renameInTree(nodes: FileNode[], id: string, newName: string): FileNode[] {
    return sortTree(
      nodes.map((node) =>
        node.id === id
          ? { ...node, name: newName }
          : { ...node, children: node.children ? renameInTree(node.children, id, newName) : undefined },
      ),
    )
  }
  function clone(nodes: FileNode[]): FileNode[] {
    return nodes.map((n) => ({ ...n, children: n.children ? clone(n.children) : undefined }))
  }
  function deleteFrom(nodes: FileNode[], deleteId: string): FileNode[] {
    return nodes
      .filter((n) => n.id !== deleteId)
      .map((n) => ({ ...n, children: n.children ? deleteFrom(n.children, deleteId) : undefined }))
  }
  function findNodeById(nodes: FileNode[], id: string): FileNode | null {
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.children) {
        const found = findNodeById(node.children, id)
        if (found) return found
      }
    }
    return null
  }

  /* ----------------------------------- UI ------------------------------------- */
  return (
    <div className="h-full flex flex-col gap-3 p-2">
      {/* ------------------------------ MY NOTES ------------------------------ */}
      <Card className="h-[50%] rounded-xl bg-white dark:bg-neutral-900 border shadow flex flex-col">
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
          {/* org-style sticky header */}
          <div className="sticky top-0 z-0 pr-[84px] flex items-center justify-between gap-2 px-4 py-2 border-b border-border/30 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
            <div className="flex items-center gap-2">
              <Notebook className="h-5 w-5" />
              <span className="text-sm font-medium">My Notes</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="secondary" className="gap-2" onClick={() => handleAdd("my", "folder")}>
                <FolderPlus className="w-4 h-4" /> New folder
              </Button>
              <Button size="sm" className="gap-2" onClick={() => handleAdd("my", "note")}>
                <Plus className="w-4 h-4" /> New note
              </Button>
              {loadingMy && <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" />}
            </div>
          </div>

          {/* collapsible "All Notes" row (org notes style) */}
          <div className="px-4 pt-3">
            <button
              onClick={() => setExpandedMy((p) => !p)}
              className="flex items-center gap-2 w-full p-2 hover:bg-background/40 rounded-md transition-colors text-left"
            >
              {expandedMy ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {expandedMy ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
              <span className="text-base font-medium">All Notes</span>
            </button>
          </div>

          {/* tree area */}
          <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4">
            {expandedMy && (
              <div className="ml-6">
                <NoteTree
                  treeData={myTree}
                  onSelect={(id: string) => {
                    onOpenNote(id)
                    const node = findNodeById(myTree, id)
                    setOwnerId(node?.ownerId ?? userId)
                  }}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onDropNode={handleMoveMy}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------- SHARED NOTES ---------------------------- */}
      <Card className="h-[50%] rounded-xl bg-white dark:bg-neutral-900 border shadow flex flex-col">
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
          {/* org-style sticky header */}
          <div className="sticky top-0 z-0 pr-[84px] flex items-center justify-between gap-2 px-4 py-2 border-b border-border/30 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
            <div className="flex items-center gap-2">
              <Notebook className="h-5 w-5" />
              <span className="text-sm font-medium">Shared Notes</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="secondary" className="gap-2" onClick={() => handleAdd("shared", "folder")}>
                <FolderPlus className="w-4 h-4" /> New folder
              </Button>
              <Button size="sm" className="gap-2" onClick={() => handleAdd("shared", "note")}>
                <Plus className="w-4 h-4" /> New note
              </Button>
              {loadingShared && <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" />}
            </div>
          </div>

          {/* collapsible "All Notes" row (org notes style) */}
          <div className="px-4 pt-3">
            <button
              onClick={() => setExpandedShared((p) => !p)}
              className="flex items-center gap-2 w-full p-2 hover:bg-background/40 rounded-md transition-colors text-left"
            >
              {expandedShared ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {expandedShared ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
              <span className="text-base font-medium">All Notes</span>
            </button>
          </div>

          {/* tree area */}
          <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4">
            {expandedShared && (
              <div className="ml-6">
                <NoteTree
                  treeData={sharedTree}
                  onSelect={(id: string) => {
                    onOpenNote(id)
                    const node = findNodeById(sharedTree, id)
                    setOwnerId(node?.ownerId ?? userId)
                  }}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onDropNode={handleMoveShared}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
