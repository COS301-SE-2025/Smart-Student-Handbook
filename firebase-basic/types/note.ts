// types/note.ts
export type FileNode = {
  id: string
  name: string
  type: "folder" | "note"
  parentId?: string | null
  children?: FileNode[]
}

