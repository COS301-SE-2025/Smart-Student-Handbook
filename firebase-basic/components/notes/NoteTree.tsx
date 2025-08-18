"use client";

import { useState, useEffect } from "react";
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

export default function NodeTree({ treeData, onSelect, onRename, onDelete, onDropNode }: Props) {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [activeDragNode, setActiveDragNode] = useState<FileNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Watch for dark/light mode changes
  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setTheme(root.classList.contains('dark') ? 'dark' : 'light');
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedFolderIds(prev => {
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
      if (node.children?.some(c => c.id === childId)) return node;
      if (node.children) {
        const found = findParentNode(node.children, childId);
        if (found) return found;
      }
    }
    return null;
  };

  // ---------------- Highlight Logic ----------------
  const handleSelectNode = (id: string) => {
    setSelectedNodeId(id); // highlight selected
    onSelect(id); // pass to parent callback
  };

  const renderNode = (node: FileNode) => {
    const isFolder = node.type === "folder";
    const isExpanded = expandedFolderIds.has(node.id);
    const isSelected = selectedNodeId === node.id;

    return (
      <div key={node.id} className="pl-4 max-w-full overflow-hidden">
        {isFolder ? (
          <>
            <FolderItem
              node={node}
              onSelect={handleSelectNode}
              onRename={onRename}
              onDelete={onDelete}
              onDropNode={onDropNode}
              isExpanded={isExpanded}
              onToggleExpand={() => toggleExpand(node.id)}
            />
            {isExpanded && node.children?.map(child => renderNode(child))}
          </>
        ) : (
          <NoteItem
            node={node}
            onSelect={handleSelectNode}
            onRename={onRename}
            onDelete={onDelete}
            noteID={node.id}
            isSelected={isSelected} // <-- highlight
          />
        )}
      </div>
    );
  };

  // ---------------- Drag Logic (unchanged) ----------------
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
    setIsDragging(false);
    if (!active) return;

    const draggedId = String(active.id);
    const targetId = over ? String(over.id) : null;
    if (targetId === draggedId) return;

    const draggedNode = findNodeById(treeData, draggedId);
    const currentParent = findParentNode(treeData, draggedId);

    if (!treeData.some(node => node.id === targetId)) {
      if (currentParent && !currentParent.parentId) {
        onDropNode(draggedId, null);
        return;
      }
    }

    onDropNode(draggedId, targetId === "root-drop-zone" || !targetId ? null : targetId);
  };

  const { setNodeRef: setRootDropRef, isOver: isRootOver } = useDroppable({ id: "root-drop-zone" });

  return (
    <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
      <div
        ref={setRootDropRef}
        className={`dnd-context-container p-4 border rounded
          ${isDragging
            ? theme === 'dark' ? "border-blue-500 bg-gray-800" : "border-blue-500 bg-blue-50"
            : theme === 'dark' ? "border-gray-700 bg-gray-900 text-white" : "border-gray-300 bg-white text-black"}
          ${isRootOver ? (theme === 'dark' ? "bg-gray-700" : "bg-blue-100") : ""}`}
        style={{ minHeight: 300 }}
      >
        {treeData.map(node => renderNode(node))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragNode && (
          <div className={`px-3 py-1 rounded shadow-md opacity-70 flex items-center gap-2 pointer-events-none
            ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}
          >
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
  );
}
