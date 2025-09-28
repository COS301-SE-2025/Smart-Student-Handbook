"use client"

import { useEffect, useState } from "react"
import { getAuth, onAuthStateChanged, type User } from "@firebase/auth"
import { ref, update } from "@firebase/database"
import { db } from "@/lib/firebase"

import { Button } from "@/components/ui/button"
import NoteTree from "@/components/notes/NoteTree"

import {
  FileText,
  FolderPlus,
  Loader2,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
} from "lucide-react"

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

  // UI state
  const [loadingMy, setLoadingMy] = useState(false)
  const [loadingShared, setLoadingShared] = useState(false)

  // Collapsibles per your structure
  const [expandedAll, setExpandedAll] = useState(true)
  const [expandedPersonal, setExpandedPersonal] = useState(true)
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
    if (!userId) return
    setSharedTree((prev) => {
      const updated = moveNode(prev, draggedId, targetFolderId)
      update(ref(db, `users/${userId}/notes/${draggedId}`), { parentId: targetFolderId ?? null })
      return sortTree(updated)
    })
  }

  // 👇 Add explicit type annotation to avoid TS7022
  const handleRename: (id: string, newName: string) => Promise<void> = async (id, newName) => {
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
      {/* Header (removed icon, slightly larger heading) */}
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="text-lg font-semibold">My Notes</span>
      </div>

      {/* Top-level: All Notes (no borders) */}
      <div className="flex-1 min-h-0">
        <div className="px-2">
          <button
            onClick={() => setExpandedAll((p) => !p)}
            className="flex items-center gap-2 w-full p-2 hover:bg-background/40 rounded-md transition-colors text-left"
          >
            {expandedAll ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {expandedAll ? <FolderOpen className="h-4 w-4 text-blue-600" /> : <Folder className="h-4 w-4 text-blue-600" />}
            <span className="text-base font-medium">All Notes</span>
          </button>
        </div>

        {expandedAll && (
          <div className="ml-6 pr-2 space-y-1">
            {/* Personal Notes folder */}
            <div>
              <div className="flex items-center gap-2 p-2 hover:bg-background/40 rounded-md transition-colors">
                <button
                  onClick={() => setExpandedPersonal((p) => !p)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  {expandedPersonal ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {expandedPersonal ? (
                    <FolderOpen className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Folder className="h-4 w-4 text-blue-600" />
                  )}
                  <span className="text-sm font-medium">Personal Notes</span>
                </button>

                {/* actions: ONLY new folder / new note kept */}
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    title="New folder"
                    aria-label="New folder"
                    onClick={() => handleAdd("my", "folder")}
                  >
                    <FolderPlus className="w-4 h-4 text-blue-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="New note"
                    aria-label="New note"
                    onClick={() => handleAdd("my", "note")}
                  >
                    <FileText className="w-4 h-4 text-blue-600" />
                  </Button>
                  {loadingMy && <Loader2 className="h-4 w-4 animate-spin ml-1" aria-label="Loading personal" />}
                </div>
              </div>

              {expandedPersonal && (
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

            {/* Shared Notes folder */}
            <div>
              <div className="flex items-center gap-2 p-2 hover:bg-background/40 rounded-md transition-colors">
                <button
                  onClick={() => setExpandedShared((p) => !p)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  {expandedShared ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {expandedShared ? (
                    <FolderOpen className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Folder className="h-4 w-4 text-blue-600" />
                  )}
                  <span className="text-sm font-medium">Shared Notes</span>
                </button>

                {/* actions: ONLY new folder / new note kept */}
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    title="New folder"
                    aria-label="New folder"
                    onClick={() => handleAdd("shared", "folder")}
                  >
                    <FolderPlus className="w-4 h-4 text-blue-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="New note"
                    aria-label="New note"
                    onClick={() => handleAdd("shared", "note")}
                  >
                    <FileText className="w-4 h-4 text-blue-600" />
                  </Button>
                  {loadingShared && <Loader2 className="h-4 w-4 animate-spin ml-1" aria-label="Loading shared" />}
                </div>
              </div>

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
          </div>
        )}
      </div>
    </div>
  )
}
