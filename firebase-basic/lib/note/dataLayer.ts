// lib/notes/dataLayer.ts
import { FileNode } from "@/types/note"

let testTree: FileNode[] = [
  {
    id: "folder1",
    name: "Projects",
    type: "folder",
    children: [
      { id: "note1", name: "App Idea", type: "note" },
      {
        id: "folder2",
        name: "Designs",
        type: "folder",
        children: [{ id: "note2", name: "Wireframes", type: "note" }],
      },
    ],
  },
  { id: "note3", name: "Personal Todo", type: "note" },
]

export function getTestTree(): FileNode[] {
  return structuredClone(testTree)
}

export function updateTestTree(newTree: FileNode[]) {
  testTree = newTree
}
