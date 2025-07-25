"use client";

import { useState } from "react";
import { DndContext, DragEndEvent, useDroppable } from "@dnd-kit/core";
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

  const { setNodeRef: setRootDropRef, isOver: isRootOver } = useDroppable({
    id: "root-drop-zone",
  });

  const toggleExpand = (id: string) => {
    setExpandedFolderIds((prev) => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  const renderNode = (node: FileNode) => {
    const isFolder = node.type === "folder";
    const isExpanded = expandedFolderIds.has(node.id);

    return (
      <div key={node.id} className="pl-4">
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
            {isExpanded &&
              node.children?.map((child) => renderNode(child))}
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

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active) return;

    const draggedId = String(active.id);
    const targetId = over ? String(over.id) : null;

    if (targetId === draggedId) return;

    if (targetId === "root-drop-zone") {
      // Move to root (parentId = null)
      onDropNode(draggedId, null);
    } else if (targetId) {
      onDropNode(draggedId, targetId);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div
        ref={setRootDropRef}
        className={`root-drop-zone p-2 ${isRootOver ? "bg-blue-100" : ""}`}
        style={{ minHeight: 50 }}
      >
        {treeData.map((node) => renderNode(node))}
      </div>
    </DndContext>
  );
}
