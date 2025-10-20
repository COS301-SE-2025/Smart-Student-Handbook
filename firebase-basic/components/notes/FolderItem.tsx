import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useRef, useState } from "react";
import { FileNode } from "@/types/note";
import { ChevronRight, Folder, FolderOpen, Trash2, GripVertical } from "lucide-react";
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
  isExpanded,
  onToggleExpand,
}: Props) {
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    const newName = inputRef.current?.value?.trim();
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
        "flex items-center gap-2 rounded cursor-pointer group px-1 py-0.5",
        isOver && "bg-blue-100"
      )}
    >
      {/* Drag handle — fixed width for column alignment */}
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab p-1 rounded hover:bg-gray-200 w-6 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label="Drag handle"
        role="button"
      >
        <GripVertical className="w-4 h-4 text-black" />
      </div>

      {/* Chevron — fixed width so icons align in a column */}
      <span className="w-5 flex items-center justify-center select-none">
        <ChevronRight
          className={cn(
            "w-4 h-4 text-black transition-transform",
            isExpanded && "rotate-90"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        />
      </span>

      {/* Folder icon — BLUE; switches on open/close */}
      <span className="w-5 flex items-center justify-center select-none">
        {isExpanded ? (
          <FolderOpen
            className="w-4 h-4 text-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          />
        ) : (
          <Folder
            className="w-4 h-4 text-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          />
        )}
      </span>

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
          className="text-sm select-none truncate max-w-[140px] inline-block align-middle"
          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={node.name}
          onClick={() => onSelect(node.id)}
          onDoubleClick={() => setIsRenaming(true)}
        >
          {node.name}
        </span>
      )}

      {/* Delete — keep red */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(node.id);
        }}
        className="ml-auto opacity-0 group-hover:opacity-100 hover:opacity-100"
        aria-label={`Delete folder ${node.name}`}
      >
        <Trash2 className="w-4 h-4 text-red-500" />
      </button>
    </div>
  );
}
