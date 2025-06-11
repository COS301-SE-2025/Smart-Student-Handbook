"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderIcon,
  Trash2,
  ArrowLeft,
  MoreHorizontal,
  Edit3,
  Save,
  FolderPlus,
  FilePlus,
} from "lucide-react"
import Link from "next/link"
import QuillEditor from "@/components/quilleditor"
import "react-quill/dist/quill.snow.css"

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
              className={`flex items-center py-2.5 px-3 mx-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group cursor-pointer ${
                isSelected ? "bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600" : ""
              }`}
              style={{ marginLeft: depth * 16 }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-6 w-6 mr-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"
                onClick={() => toggleExpand(node)}
              >
                {node.expanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                )}
              </Button>

              <div
                className="flex items-center flex-1 min-w-0"
                onClick={() => {
                  setSelectedFolderId(node.id)
                  setSelectedNote(null)
                }}
              >
                <FolderIcon className="h-4 w-4 text-gray-600 dark:text-gray-400 mr-3 flex-shrink-0" />

                {isSelected ? (
                  <input
                    type="text"
                    value={node.name}
                    onChange={(e) => handleFolderNameChange(node.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border-none focus:outline-none focus:ring-0 w-full font-medium text-sm text-black dark:text-white"
                    autoFocus
                  />
                ) : (
                  <span className="font-medium text-sm text-black dark:text-white truncate">{node.name}</span>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="p-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"
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
            className={`flex items-center py-2.5 px-3 mx-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group cursor-pointer select-none ${
              isSelected
                ? "bg-black dark:bg-white text-white dark:text-black border border-gray-300 dark:border-gray-600"
                : ""
            }`}
            style={{ marginLeft: (depth + 1) * 16 }}
            onClick={() => handleSelectNote(node)}
          >
            <div className="w-6 mr-2" />
            <FileText
              className={`h-4 w-4 mr-3 flex-shrink-0 ${
                isSelected ? "text-white dark:text-black" : "text-gray-500 dark:text-gray-400"
              }`}
            />
            <span
              className={`flex-1 text-sm truncate ${
                isSelected ? "font-medium text-white dark:text-black" : "text-black dark:text-white"
              }`}
            >
              {node.name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"
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
    <>
      <style jsx global>{`
        /* COMPLETELY REMOVE ALL INTERNAL SCROLLBARS */
        .ql-container {
          border: none !important;
          height: 100% !important;
          overflow: visible !important;
        }
        .ql-toolbar {
          border: none !important;
          border-bottom: 1px solid #d1d5db !important;
        }
        .dark .ql-toolbar {
          border-bottom: 1px solid #374151 !important;
        }
        .ql-editor {
          height: auto !important;
          min-height: 500px !important;
          border: none !important;
          overflow: visible !important;
        }
        /* Hide all scrollbars except browser scrollbar */
        .ql-editor::-webkit-scrollbar {
          display: none !important;
        }
        .ql-container .ql-editor {
          overflow: visible !important;
        }
      `}</style>

      <div className="min-h-[calc(100vh-3.5rem)] flex bg-white dark:bg-black">
        {/* Sidebar - Fixed width, no internal scroll */}
        <div className="w-80 bg-white dark:bg-black border-r border-gray-300 dark:border-gray-700 flex flex-col min-h-[calc(100vh-3.5rem)]">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-black flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Link href="/dashboard">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-black dark:text-white border-gray-300 dark:border-gray-600"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                </Link>
              </div>

              <Button variant="ghost" size="sm" className="text-gray-500 dark:text-gray-400">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={addFolder}
                size="sm"
                variant="outline"
                className="flex-1 gap-2 text-black dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <FolderPlus className="h-4 w-4" />
                Folder
              </Button>
              <Button
                onClick={addNote}
                size="sm"
                className="flex-1 gap-2 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
              >
                <FilePlus className="h-4 w-4" />
                Note
              </Button>
            </div>
          </div>

          {/* File Tree - Expandable content */}
          <div className="flex-1 p-2">
            {tree.length > 0 ? (
              <div className="space-y-1">{renderTree(tree)}</div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="font-medium text-black dark:text-white mb-2">No notes yet</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Create your first note or folder to get started
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={addNote}
                    size="sm"
                    className="gap-2 bg-black dark:bg-white text-white dark:text-black"
                  >
                    <FilePlus className="h-4 w-4" />
                    Create Note
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area - NO INTERNAL CONTAINERS */}
        <div className="flex-1 bg-white dark:bg-black">
          {selectedNote ? (
            <div className="w-full">
              {/* Note Header */}
              <div className="p-6 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-black">
                <div className="flex items-center gap-4">
                  <Edit3 className="h-5 w-5 text-black dark:text-white" />
                  <input
                    type="text"
                    value={selectedNote.name}
                    onChange={(e) => handleNoteChange(selectedNote.id, "name", e.target.value)}
                    placeholder="Untitled Note"
                    className="text-2xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 flex-1 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  <Button variant="ghost" size="sm" className="gap-2 text-gray-500 dark:text-gray-400">
                    <Save className="h-4 w-4" />
                    Saved
                  </Button>
                </div>
              </div>

              {/* Editor Area - NO CONTAINERS, NO FIXED HEIGHT */}
              <div className="p-6 bg-gray-50 dark:bg-gray-900">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-white dark:bg-black rounded-lg border border-gray-300 dark:border-gray-700">
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
            <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-gray-900">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Edit3 className="h-10 w-10 text-black dark:text-white" />
                </div>
                <h3 className="text-xl font-semibold text-black dark:text-white mb-3">Ready to take notes?</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                  Select a note from the sidebar or create a new one to start writing your thoughts, ideas, and
                  important information.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={addNote}
                    className="gap-2 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                  >
                    <FilePlus className="h-4 w-4" />
                    Create Note
                  </Button>
                  <Button
                    onClick={addFolder}
                    variant="outline"
                    className="gap-2 border-gray-300 dark:border-gray-600 text-black dark:text-white"
                  >
                    <FolderPlus className="h-4 w-4" />
                    Create Folder
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
