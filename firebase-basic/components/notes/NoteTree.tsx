import { FileNode } from "@/types/note";
import { FolderItem } from "./FolderItem";
import { NoteItem } from "./NoteItem";

interface Props {
  tree: FileNode[];
  selectedNoteId?: string;
  onSelect: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

export function NoteTree({
  tree,
  selectedNoteId,
  onSelect,
  onRename,
  onDelete,
  onDropNode,
}: Props) {
  return (
    <div>
      {tree.map((node) =>
        node.type === "folder" ? (
          <FolderItem
            key={node.id}
            node={node}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
            onDropNode={onDropNode}
          />
        ) : (
          <NoteItem
            key={node.id}
            node={node}
            selected={selectedNoteId === node.id}
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
