"use client";

import { useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDroppable } from "@dnd-kit/core";
import FolderItem from "./FolderItem";
import NoteItem from "./NoteItem";
import { FileNode } from "@/types/note";
import { FileText, Folder } from "lucide-react";

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
  const [activeDragNode, setActiveDragNode] = useState<FileNode | null>(null);

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
            noteID={node.id}
          />
        )}
      </div>
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    const draggedId = event.active.id as string;
    const draggedNode = findNodeById(treeData, draggedId);
    if (draggedNode) {
      setActiveDragNode(draggedNode);
      setIsDragging(true);
    }
  };


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveDragNode(null);
    setIsDragging(false);

    if (over && active.id !== over.id) {
      onDropNode(active.id as string, over.id as string);
    }
  };

  const { setNodeRef: setRootDropRef, isOver: isRootOver } = useDroppable({
    id: "root-drop-zone",
  });

  return (
    <>
      <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
        <div
          className={`dnd-context-container p-4 border rounded ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"
            }`}
          style={{ minHeight: 300 }}
        >
          <div>{treeData.map((node) => renderNode(node))}</div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDragNode && (
            <div className="px-3 py-1 rounded bg-white shadow-md opacity-70 flex items-center gap-2 pointer-events-none">
              {activeDragNode.type === "folder" ? (
                <Folder className="w-4 h-4 text-yellow-500" />
              ) : (
                <FileText className="w-4 h-4 text-blue-500" />
              )}
              <span className="text-sm truncate max-w-[150px]">{activeDragNode.name}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </>

  );
}
