"use client";

import { useState } from "react";
import { DndContext, DragEndEvent, DragStartEvent, useDroppable } from "@dnd-kit/core";
import FolderItem from "./FolderItem";
import NoteItem from "./NoteItem";
import { FileNode } from "@/types/note";

interface Props {
  treeData: FileNode[];
  onSelect: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onDropNode: (draggedId: string, targetFolderId: string | null) => void;
}

export default function NodeTree({
  treeData,
  onSelect,
  onRename,
  onDelete,
  onDropNode,
}: Props) {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedFolderIds((prev) => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  const findNodeById = (nodes: FileNode[], id: string): FileNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const findParentNode = (nodes: FileNode[], childId: string): FileNode | null => {
    for (const node of nodes) {
      if (node.children?.some((c) => c.id === childId)) return node;
      if (node.children) {
        const found = findParentNode(node.children, childId);
        if (found) return found;
      }
    }
    return null;
  };

  const renderNode = (node: FileNode) => {
    const isFolder = node.type === "folder";
    const isExpanded = expandedFolderIds.has(node.id);

    return (
      <div key={node.id} className="pl-4 max-w-full overflow-hidden">
        {isFolder ? (
          <>
            <FolderItem
              node={node}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onDropNode={onDropNode}
              isExpanded={isExpanded}
              onToggleExpand={() => toggleExpand(node.id)}
            />
            {isExpanded && node.children?.map((child) => renderNode(child))}
          </>
        ) : (
          <NoteItem
            node={node}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
          />
        )}
      </div>
    );
  };

  const handleDragStart = (_event: DragStartEvent) => {
    setIsDragging(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDragging(false);

    const { active, over } = event;
    if (!active) return;

    const draggedId = String(active.id);
    const targetId = over ? String(over.id) : null;

    if (targetId === draggedId) return;

    const draggedNode = findNodeById(treeData, draggedId);
    const currentParent = findParentNode(treeData, draggedId);

    if (targetId === "root-drop-zone" || !targetId) {
      onDropNode(draggedId, null);
      return;
    }

    if (!treeData.some((node) => node.id === targetId)) {
      if (currentParent && !currentParent.parentId) {
        onDropNode(draggedId, null);
        return;
      }
    }

    onDropNode(draggedId, targetId);
  };

  return (
    <>
      <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
        <div
          className={`dnd-context-container p-4 border rounded ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"
            }`}
          style={{ minHeight: 300 }}
        >

          <div>
            {treeData.map((node) => renderNode(node))}
          </div>
        </div>
      </DndContext>
    </>
  );
}
