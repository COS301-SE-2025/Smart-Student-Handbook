// lib/notes/buildTree.ts
import { FileNode } from "@/types/note"

export function buildTree(flatList: FileNode[]): FileNode[] {
  const lookup: Record<string, FileNode> = {}
  const root: FileNode[] = []

  flatList.forEach((node) => {
    lookup[node.id] = { ...node, children: [] }
  })

  flatList.forEach((node) => {
    if (node.parentId) {
      lookup[node.parentId]?.children?.push(lookup[node.id])
    } else {
      root.push(lookup[node.id])
    }
  })

  return root
}
