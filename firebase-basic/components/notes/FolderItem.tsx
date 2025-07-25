import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";
import { FileNode } from "@/types/note";
import { ChevronRight, Folder, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  node: FileNode;
  onSelect: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onDropNode: (draggedId: string, targetFolderId: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export default function FolderItem({
  node,
  onSelect,
  onRename,
  onDelete,
  onDropNode,
  isExpanded,
  onToggleExpand,
}: Props) {
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Draggable only on handle
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: node.id,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const handleRename = () => {
    const newName = inputRef.current?.value.trim();
    if (newName && newName !== node.name) {
      onRename(node.id, newName);
    }
    setIsRenaming(false);
  };

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        setDropRef(el);
      }}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-1 rounded cursor-pointer group",
        isOver && "bg-blue-100"
      )}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab p-1 rounded hover:bg-gray-200"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label="Drag handle"
        role="button"
      >
        <GripVertical className="w-4 h-4 text-gray-500" />
      </div>

      {/* Expand/collapse icon */}
      <ChevronRight
        className={cn(
          "w-3 h-3 transition-transform select-none",
          isExpanded && "rotate-90"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
      />
      <Folder
        className="w-4 h-4 text-yellow-500 select-none"
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
      />

      {/* Name or renaming input */}
      {isRenaming ? (
        <input
          ref={inputRef}
          defaultValue={node.name}
          onBlur={handleRename}
          onKeyDown={(e) => e.key === "Enter" && handleRename()}
          autoFocus
          className="border-b border-gray-300 outline-none text-sm bg-transparent"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="text-sm select-none"
          onClick={() => onSelect(node.id)}
          onDoubleClick={() => setIsRenaming(true)}
        >
          {node.name}
        </span>
      )}

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(node.id);
        }}
        className="ml-auto opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
        aria-label={`Delete folder ${node.name}`}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}
