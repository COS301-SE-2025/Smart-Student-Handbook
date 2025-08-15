// mock/testTree.ts
import { FileNode } from "@/types/note"

export const testTree: FileNode[] = [
  {
    id: "folder1",
    name: "Projects",
    type: "folder",
    children: [
      {
        id: "note1",
        name: "App Idea",
        type: "note",
      },
      {
        id: "folder2",
        name: "Designs",
        type: "folder",
        children: [
          {
            id: "note2",
            name: "Wireframes",
            type: "note",
          },
        ],
      },
    ],
  },
  {
    id: "note3",
    name: "Personal Todo",
    type: "note",
  },
]
