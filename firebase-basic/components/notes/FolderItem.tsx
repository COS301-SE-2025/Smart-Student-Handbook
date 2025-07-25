import React, { useState, useEffect, useRef } from "react";
import { FileNode } from "@/types/note";
import { NoteItem } from "./NoteItem";

interface Props {
  node: FileNode;
  onSelect: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}

export function FolderItem({
  node,
  onSelect,
  onRename,
  onDelete,
  onDropNode,
}: Props) {
  const [open, setOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const saveRename = () => {
    const trimmed = tempName.trim();
    if (trimmed && trimmed !== node.name) {
      onRename(node.id, trimmed);
    }
    setIsEditing(false);
  };

  return (
    <div className="ml-2">
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/plain", node.id)}
        onDragOver={(e) => e.preventDefault()} // Allow drop
        onDrop={(e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData("text/plain");
          if (onDropNode && draggedId !== node.id) {
            onDropNode(draggedId, node.id);
          }
        }}
        className="flex items-center justify-between font-bold cursor-pointer select-none"
      >
        <div onClick={() => onSelect(node.id)} className="flex-grow">
          {isEditing ? (
            <input
              ref={inputRef}
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                else if (e.key === "Escape") {
                  setTempName(node.name);
                  setIsEditing(false);
                }
              }}
              className="w-full px-1 py-0.5 border rounded text-sm"
            />
          ) : (
            <span onDoubleClick={() => setIsEditing(true)}>📁 {node.name}</span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (
              window.confirm(
                `Delete folder "${node.name}" and all its contents?`
              )
            ) {
              onDelete(node.id);
            }
          }}
          className="ml-2 text-red-500 hover:text-red-700 text-sm"
          aria-label={`Delete folder ${node.name}`}
          type="button"
        >
          ×
        </button>

        <button
          className="ml-2 px-1 text-xs text-gray-500 hover:text-gray-700"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          aria-label={open ? "Collapse folder" : "Expand folder"}
          type="button"
        >
          {open ? "▼" : "▶"}
        </button>
      </div>

      {open &&
        node.children?.map((child) =>
          child.type === "folder" ? (
            <FolderItem
              key={child.id}
              node={child}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onDropNode={onDropNode}
            />
          ) : (
            <NoteItem
              key={child.id}
              node={child}
              selected={false}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onDropNode={onDropNode}
            />
          )
        )}
    </div>
  );
}
