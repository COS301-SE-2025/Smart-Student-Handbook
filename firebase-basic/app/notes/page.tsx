// app/notes/page.tsx
"use client";

import { useState } from "react";
import { NoteTree } from "@/components/notes/NoteTree";
import { FileNode } from "@/types/note";
import { testTree as initialTree } from "@/mock/testTree";
import {
  addNode,
  deleteNode,
  renameNode,
  moveNode,
} from "@/lib/note/treeActions";

export default function NotesPage() {
  const [tree, setTree] = useState<FileNode[]>(initialTree);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedNode = findNodeById(tree, selectedNoteId);

  const handleAdd = (type: "note" | "folder") => {
    const parentId =
      selectedNode?.type === "folder"
        ? selectedNode.id
        : selectedNode?.parentId || null;
    const newTree = addNode(tree, parentId, type);
    setTree(newTree);
  };

  const handleMove = (draggedId: string, targetId: string) => {
    const updatedTree = moveNode(tree, draggedId, targetId);
    setTree(updatedTree);
  };

  const handleRename = (id: string, newName: string) => {
    setTree((prevTree) => {
      function rename(nodes: FileNode[]): FileNode[] {
        return nodes.map((node) => {
          if (node.id === id) {
            return { ...node, name: newName };
          }
          if (node.children) {
            return { ...node, children: rename(node.children) };
          }
          return node;
        });
      }
      return rename(prevTree);
    });
  };

  return (
    <div className="flex h-screen">
      <div className="w-1/3 border-r p-2 space-y-2">
        <div className="flex gap-2">
          <button onClick={() => handleAdd("note")} className="...">
            + Note
          </button>
          <button onClick={() => handleAdd("folder")} className="...">
            + Folder
          </button>
          <button
            disabled={!selectedNoteId}
            onClick={() => {
              if (
                selectedNode &&
                window.confirm(`Delete "${selectedNode.name}"?`)
              ) {
                const newTree = deleteNode(tree, selectedNode.id);
                setTree(newTree);
                setSelectedNoteId(null);
              }
            }}
            className="..."
          >
            🗑 Delete
          </button>
          <button
            disabled={!selectedNoteId}
            onClick={() => {
              if (!selectedNode) return;
              const newName = window.prompt(
                "Enter new name:",
                selectedNode.name
              );
              if (newName && newName.trim() !== "") {
                const updatedTree = renameNode(
                  tree,
                  selectedNode.id,
                  newName.trim()
                );
                setTree(updatedTree);
              }
            }}
            className="..."
          >
            ✏ Rename
          </button>
        </div>

        <NoteTree
          tree={tree}
          selectedNoteId={selectedNoteId}
          onSelect={setSelectedNoteId}
          onRename={handleRename}
        />
      </div>
      <div className="flex-1 p-4">
        {selectedNoteId ? (
          <div>Selected Note ID: {selectedNoteId}</div>
        ) : (
          <div>Select a note or folder</div>
        )}
      </div>
    </div>
  );
}

function findNodeById(tree: FileNode[], id: string | null): FileNode | null {
  if (!id) return null;
  const stack = [...tree];
  while (stack.length) {
    const node = stack.pop();
    if (node?.id === id) return node;
    if (node?.children) stack.push(...node.children);
  }
  return null;
}
