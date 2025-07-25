import React, { useState, useEffect, useRef } from "react"
import { FileNode } from "@/types/note"

interface Props {
  node: FileNode
  selected: boolean
  onSelect: (id: string) => void
  onRename: (id: string, newName: string) => void
}

export function NoteItem({ node, selected, onSelect, onRename }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempName, setTempName] = useState(node.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const saveRename = () => {
    const trimmed = tempName.trim()
    if (trimmed && trimmed !== node.name) {
      onRename(node.id, trimmed)
    }
    setIsEditing(false)
  }

  return (
    <div
      onClick={() => onSelect(node.id)}
      className={`cursor-pointer p-2 rounded ${
        selected ? "bg-blue-100" : "hover:bg-gray-100"
      }`}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onBlur={saveRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveRename()
            else if (e.key === "Escape") {
              setTempName(node.name)
              setIsEditing(false)
            }
          }}
          className="w-full px-1 py-0.5 border rounded text-sm"
        />
      ) : (
        <span onDoubleClick={() => setIsEditing(true)}>📝 {node.name}</span>
      )}
    </div>
  )
}
