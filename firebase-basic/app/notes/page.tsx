"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderIcon,
  Trash2,
  Edit3,
  Save,
  FolderPlus,
  FilePlus,
} from "lucide-react"
import QuillEditor from "@/components/quilleditor"
import "react-quill/dist/quill.snow.css"
import { PageHeader } from "@/components/ui/page-header"

type Note = {
  id: string
  name: string
  content: string
  type: "note"
}

type Folder = {
  id: string
  name: string
  type: "folder"
  expanded: boolean
  children: FileNode[]
}

type FileNode = Note | Folder

const generateId = () => Math.random().toString(36).slice(2, 9)

export default function HardNotesPage() {
  const [tree, setTree] = useState<FileNode[]>([
    {
      id: "folder1",
      name: "Computer Science",
      type: "folder",
      expanded: true,
      children: [
        {
          id: "folder2",
          name: "Data Structures",
          type: "folder",
          expanded: false,
          children: [],
        },
        {
          id: "note1",
          name: "Algorithm Analysis",
          content: "<h1>Algorithm Analysis</h1><p>Big O notation and complexity analysis...</p>",
          type: "note",
        },
      ],
    },
    {
      id: "note2",
      name: "Study Notes",
      content: "<h1>General Study Notes</h1><p>Important concepts and formulas...</p>",
      type: "note",
    },
  ])

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)

  useEffect(() => {
    const savedTree = localStorage.getItem("hardNoteTree")
    if (savedTree) {
      try {
        setTree(JSON.parse(savedTree))
      } catch {}
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("hardNoteTree", JSON.stringify(tree))
  }, [tree])

  useEffect(() => {
    const savedSelectedFolderId = localStorage.getItem("hardSelectedFolderId")
    const savedSelectedNote = localStorage.getItem("hardSelectedNote")
    if (savedSelectedFolderId) setSelectedFolderId(savedSelectedFolderId)
    if (savedSelectedNote) {
      try {
        setSelectedNote(JSON.parse(savedSelectedNote))
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (selectedFolderId) {
      localStorage.setItem("hardSelectedFolderId", selectedFolderId)
    } else {
      localStorage.removeItem("hardSelectedFolderId")
    }
  }, [selectedFolderId])

  useEffect(() => {
    if (selectedNote) {
      localStorage.setItem("hardSelectedNote", JSON.stringify(selectedNote))
    } else {
      localStorage.removeItem("hardSelectedNote")
    }
  }, [selectedNote])

  const toggleExpand = (folder: Folder) => {
    const toggle = (nodes: FileNode[]): FileNode[] =>
      nodes.map((node) => {
        if (node.type === "folder") {
          if (node.id === folder.id) {
            return { ...node, expanded: !node.expanded }
          }
          return { ...node, children: toggle(node.children) }
        }
        return node
      })
    setTree((prev) => toggle(prev))
  }

  const handleFolderNameChange = (id: string, newName: string) => {
    const updateName = (nodes: FileNode[]): FileNode[] =>
      nodes.map((node) => {
        if (node.type === "folder") {
          if (node.id === id) {
            return { ...node, name: newName }
          }
          return { ...node, children: updateName(node.children) }
        }
        return node
      })
    setTree((prev) => updateName(prev))
  }

  const handleNoteChange = (id: string, field: "content" | "name", value: string) => {
    const updateNote = (nodes: FileNode[]): FileNode[] =>
      nodes.map((node) => {
        if (node.type === "note" && node.id === id) {
          return { ...node, [field]: value }
        } else if (node.type === "folder") {
          return { ...node, children: updateNote(node.children) }
        }
        return node
      })

    setTree((prev) => updateNote(prev))

    if (selectedNote && selectedNote.id === id) {
      setSelectedNote({ ...selectedNote, [field]: value })
    }
  }

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note)
    setSelectedFolderId(null)
  }

  const addFolder = () => {
    const newFolder: Folder = {
      id: generateId(),
      name: "New Folder",
      type: "folder",
      expanded: false,
      children: [],
    }

    if (selectedFolderId) {
      const addToFolder = (nodes: FileNode[]): FileNode[] =>
        nodes.map((node) => {
          if (node.type === "folder") {
            if (node.id === selectedFolderId) {
              return { ...node, children: [...node.children, newFolder] }
            }
            return { ...node, children: addToFolder(node.children) }
          }
          return node
        })
      setTree((prev) => addToFolder(prev))
    } else {
      setTree((prev) => [...prev, newFolder])
    }
  }

  const addNote = () => {
    const newNote: Note = {
      id: generateId(),
      name: "New Note",
      content: "",
      type: "note",
    }

    if (selectedFolderId) {
      const addToFolder = (nodes: FileNode[]): FileNode[] =>
        nodes.map((node) => {
          if (node.type === "folder") {
            if (node.id === selectedFolderId) {
              return { ...node, children: [...node.children, newNote] }
            }
            return { ...node, children: addToFolder(node.children) }
          }
          return node
        })
      setTree((prev) => addToFolder(prev))
    } else {
      setTree((prev) => [...prev, newNote])
    }
  }

  const removeNodeById = (nodes: FileNode[], id: string): FileNode[] =>
    nodes
      .filter((node) => node.id !== id)
      .map((node) => (node.type === "folder" ? { ...node, children: removeNodeById(node.children, id) } : node))

  const renderTree = (nodes: FileNode[], depth = 0) =>
    nodes.map((node) => {
      if (node.type === "folder") {
        const isSelected = selectedFolderId === node.id
        return (
          <div key={node.id} className="select-none">
            <div
              className={`flex items-center py-2.5 px-3 mx-1 rounded-lg text-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-200 group cursor-pointer ${
                isSelected ? "bg-primary text-primary-foreground border border-primary" : ""
              }`}
              style={{ marginLeft: depth * 16 }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-6 w-6 mr-2 hover:bg-muted rounded-md"
                onClick={() => toggleExpand(node)}
              >
                {node.expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>

              <div
                className="flex items-center flex-1 min-w-0"
                onClick={() => {
                  setSelectedFolderId(node.id)
                  setSelectedNote(null)
                }}
              >
                <FolderIcon className="h-4 w-4 text-primary mr-3 flex-shrink-0" />

                {isSelected ? (
                  <input
                    type="text"
                    value={node.name}
                    onChange={(e) => handleFolderNameChange(node.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border-none focus:outline-none focus:ring-0 w-full font-medium text-sm"
                    autoFocus
                  />
                ) : (
                  <span className="font-medium text-sm truncate">{node.name}</span>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="p-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 rounded-md"
                onClick={(e) => {
                  e.stopPropagation()
                  if (window.confirm(`Delete folder "${node.name}" and all its contents?`)) {
                    setTree((prev) => {
                      const newTree = removeNodeById(prev, node.id)
                      if (selectedFolderId === node.id) setSelectedFolderId(null)
                      if (selectedNote?.id === node.id) setSelectedNote(null)
                      return newTree
                    })
                  }
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            {node.expanded && <div className="mt-1">{renderTree(node.children, depth + 1)}</div>}
          </div>
        )
      } else {
        const isSelected = selectedNote?.id === node.id
        return (
          <div
            key={node.id}
            className={`flex items-center py-2.5 px-3 mx-1 rounded-lg transition-all duration-200 cursor-pointer select-none ${
              isSelected ? "bg-primary text-primary-foreground border border-primary" : "text-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
            style={{ marginLeft: (depth + 1) * 16 }}
            onClick={() => handleSelectNote(node)}
          >
            <div className="w-6 mr-2" />
            <FileText
              className={`h-4 w-4 mr-3 flex-shrink-0 ${
                isSelected ? "text-primary-foreground" : "text-muted-foreground"
              }`}
            />
            <span className={`flex-1 text-sm truncate font-medium ${isSelected ? "text-primary-foreground" : ""}`}>
              {node.name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 rounded-md"
              onClick={(e) => {
                e.stopPropagation()
                if (window.confirm(`Delete note "${node.name}"?`)) {
                  setTree((prev) => {
                    const newTree = removeNodeById(prev, node.id)
                    if (selectedNote?.id === node.id) setSelectedNote(null)
                    return newTree
                  })
                }
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )
      }
    })

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Library"
        description="Organize your folders and notes, then write or edit rich-text content seamlessly."
      />

      <div className="h-[calc(100vh-8rem)] flex">
        {/* Sidebar - Fixed width, no internal scroll */}
        <div className="w-80 bg-background border-r border-border flex flex-col">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-border bg-background flex-shrink-0">
            <div className="flex gap-2">
              <Button onClick={addFolder} size="sm" variant="outline" className="flex-1 gap-2 bg-transparent">
                <FolderPlus className="h-4 w-4" />
                Folder
              </Button>
              <Button onClick={addNote} size="sm" className="flex-1 gap-2">
                <FilePlus className="h-4 w-4" />
                Note
              </Button>
            </div>
          </div>

          {/* File Tree - Expandable content */}
          <div className="flex-1 p-2 overflow-y-auto">
            {tree.length > 0 ? (
              <div className="space-y-1">{renderTree(tree)}</div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-2">No notes yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Create your first note or folder to get started</p>
                <div className="flex gap-2">
                  <Button onClick={addNote} size="sm" className="gap-2">
                    <FilePlus className="h-4 w-4" />
                    Create Note
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-background">
          {selectedNote ? (
            <div className="w-full h-full flex flex-col">
              {/* Note Header */}
              <div className="p-6 border-b border-border bg-background">
                <div className="flex items-center gap-4">
                  <Edit3 className="h-5 w-5 text-primary" />
                  <input
                    type="text"
                    value={selectedNote.name}
                    onChange={(e) => handleNoteChange(selectedNote.id, "name", e.target.value)}
                    placeholder="Untitled Note"
                    className="text-2xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 flex-1 placeholder:text-muted-foreground"
                  />
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                    <Save className="h-4 w-4" />
                    Saved
                  </Button>
                </div>
              </div>

              {/* Editor Area */}
              <div className="flex-1 p-6 bg-muted/30 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-background rounded-lg border border-border min-h-[600px]">
                    <QuillEditor
                      key={selectedNote.id}
                      value={selectedNote.content}
                      onChange={(newContent) => handleNoteChange(selectedNote.id, "content", newContent)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full bg-muted/30">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                  <Edit3 className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Ready to take notes?</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Select a note from the sidebar or create a new one to start writing your thoughts, ideas, and
                  important information.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={addNote} className="gap-2">
                    <FilePlus className="h-4 w-4" />
                    Create Note
                  </Button>
                  <Button onClick={addFolder} variant="outline" className="gap-2 bg-transparent">
                    <FolderPlus className="h-4 w-4" />
                    Create Folder
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
