// hooks/useNotes.ts
import { useEffect, useState } from "react"
import { getNotesFromDB } from "@/lib/notes/firebase"
import { buildTree } from "@/lib/note/buildTree"
import { FileNode } from "@/types/note"

export function useNotes() {
  const [tree, setTree] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const flat = await getNotesFromDB()
      setTree(buildTree(flat))
      setLoading(false)
    }
    load()
  }, [])

  return { tree, loading }
}
