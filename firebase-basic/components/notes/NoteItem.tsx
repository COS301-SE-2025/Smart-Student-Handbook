import { useDraggable } from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";
import { FileNode } from "@/types/note";
import { FileText, Trash2, GripVertical, Share2, Users } from "lucide-react";
import ShareNoteDialog from "../noteitemscomp/ShareNoteDialog";
import ViewCollaboratorsDialog from "../noteitemscomp/ViewCollaboratorsDialog";
import { get, ref } from "@firebase/database";
import { db } from "@/lib";
import { User } from "@/types/note"

interface Props {
  node: FileNode;
  onSelect: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  activeDragId?: string;
  noteID: string;
}

export async function searchUsersByName(input: string): Promise<User[]> {
  const snap = await get(ref(db, "users"));
  if (!snap.exists()) return [];

  const users = snap.val();
  const matches: User[] = [];

  for (const uid in users) {
    const settings = users[uid]?.UserSettings;
    const fullName = `${settings?.name ?? ""} ${settings?.surname ?? ""}`.toLowerCase();
    if (fullName.includes(input.toLowerCase())) {
      matches.push({ uid, ...settings });
    }
  }

  return matches;
}

export default function NoteItem({ node, onSelect, onRename, onDelete }: Props) {
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setTheme(root.classList.contains('dark') ? 'dark' : 'light');
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const handleShare = (collaboratorId: string, permission: "read" | "write") => {
    console.log("Share with:", collaboratorId, "as", permission);
  };

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
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

  const hoverBgClass = theme === 'dark' ? 'group-hover:bg-gray-1000' : 'group-hover:bg-gray-100';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-1 rounded cursor-pointer group ${hoverBgClass}`}
    >
      <div
        {...listeners}
        {...attributes}
        className={`cursor-grab p-1 rounded ${theme === 'dark' ? 'hover:bg-gray-1000' : 'hover:bg-gray-300'}`}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label="Drag handle"
        role="button"
      >
        <GripVertical className="w-4 h-4 text-gray-500" />
      </div>

      <FileText className="w-4 h-4 text-blue-500 select-none" />

      {isRenaming ? (
        <input
          ref={inputRef}
          defaultValue={node.name}
          onBlur={handleRename}
          onKeyDown={(e) => e.key === "Enter" && handleRename()}
          autoFocus
          className={`border-b border-gray-300 outline-none text-sm bg-transparent ${theme === 'dark' ? 'text-white' : 'text-black'
            }`}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className={`text-sm select-none ${theme === 'dark' ? 'text-white' : 'text-black'}`}
          onClick={() => onSelect(node.id)}
          onDoubleClick={() => setIsRenaming(true)}
        >
          {node.name}
        </span>
      )}

      {/* Buttons */}
      <button
        onClick={(e) => { e.stopPropagation(); setIsShareOpen(true); }}
        className="ml-auto opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700"
        aria-label={`Share note ${node.name}`}
      >
        <Share2 className="w-4 h-4" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); setIsViewOpen(true); }}
        className="opacity-0 group-hover:opacity-100 text-green-500 hover:text-green-700"
        aria-label={`View collaborators for note ${node.name}`}
      >
        <Users className="w-4 h-4" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
        aria-label={`Delete note ${node.name}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <ShareNoteDialog
        open={isShareOpen}
        setOpen={setIsShareOpen}
        onShare={handleShare}
        searchUsers={searchUsersByName}
        noteId={node.id}
      />

      <ViewCollaboratorsDialog
        open={isViewOpen}
        setOpen={setIsViewOpen}
        noteId={node.id}
      />
    </div>
  );
}