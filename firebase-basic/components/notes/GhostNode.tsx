import { FileNode } from "@/types/note";
import { FileText, FolderIcon } from "lucide-react";

export function GhostNode({ node }: { node: FileNode }) {
  return (
    <div className="px-3 py-1 rounded bg-white shadow-md opacity-70 flex items-center gap-2 pointer-events-none">
      {node.type === "folder" ? (
        <FolderIcon className="w-4 h-4 text-yellow-500" />
      ) : (
        <FileText className="w-4 h-4 text-blue-500" />
      )}
      <span className="text-sm truncate max-w-[150px]">{node.name}</span>
    </div>
  );
}
