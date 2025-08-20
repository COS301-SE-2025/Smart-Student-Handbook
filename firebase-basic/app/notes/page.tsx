"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "@firebase/auth";
import { get, ref, update } from "@firebase/database";
import { db } from "@/lib";
import NoteTree from "@/components/notes/NoteTree";
import Main from "@/components/YjsEditor/EditorMain";
import { FileNode, Note } from "@/types/note";
import {
  addNode,
  moveNode,
  sortTree,
  fetchNoteById,
} from "@/lib/note/treeActions";
import {
  buildSharedTreeFromRealtimeDB,
  buildTreeFromRealtimeDB,
  createFolderInDB,
  createNoteInDB,
  deleteNodeInDB,
  renameNodeInDB,
} from "@/lib/DBTree";
import { extractNoteTextFromString } from "@/lib/note/BlockFormat";
import { Button } from "@/components/ui/button";

import SummaryPanel from "@/components/ai/SummaryPanel";
import FlashcardGenerator from "@/components/flashcards/FlashCardSection";
import { toast } from "sonner";

export default function NotesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayname, setDisplayName] = useState<string | null>(null);

  const [tree, setTree] = useState<FileNode[]>([]);
  const [sharedTree, setSharedTree] = useState<FileNode[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [currentOwnerId, setOwnerID] = useState<string | null>(null);

  /* -------------------- Organisation notes state (from v1 UI) -------------------- */
  const [orgTree, setOrgTree] = useState<FileNode[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  /* -------------------------------- Auth + name -------------------------------- */
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const namesRef = ref(db, `users/${firebaseUser.uid}/UserSettings`);
          const snapshot = await get(namesRef);
          const data = snapshot.val();
          setDisplayName(data?.name ?? null);
        } catch (e) {
          console.error("Failed to load user settings", e);
          setDisplayName(null);
        }
      } else {
        setDisplayName(null);
      }
    });
    return () => unsub();
  }, []);

  /* ------------------------------ Personal + shared ----------------------------- */
  useEffect(() => {
    if (!user) return;

    const fetchTree = async () => {
      const firebaseTree = await buildTreeFromRealtimeDB(user.uid);
      const sharedTreeData = await buildSharedTreeFromRealtimeDB(user.uid);
      setTree(firebaseTree);
      setSharedTree(sharedTreeData);
    };

    fetchTree();
  }, [user]);

  /* ----------------------------- Selected note load ----------------------------- */
  useEffect(() => {
    if (!selectedNoteId) {
      setSelectedNote(null);
      return;
    }

    (async () => {
      const note = await fetchNoteById(selectedNoteId);
      setSelectedNote(note);
    })();
  }, [selectedNoteId]);

  /* ------------------------- Organisation notes (from v1) ------------------------ */
  useEffect(() => {
    if (!user) return;

    (async () => {
      // Adjust if your schema for org membership differs
      const orgIdSnap = await get(ref(db, `users/${user.uid}/primaryOrgId`));
      const orgId = (orgIdSnap.val() as string | null) ?? null;
      setActiveOrgId(orgId);

      if (!orgId) {
        setOrgTree([]);
        return;
      }

      const notesSnap = await get(ref(db, `organizations/${orgId}/notes`));
      const raw = (notesSnap.val() as Record<string, any> | null) ?? null;

      const arr: FileNode[] = raw
        ? Object.values(raw).map((n: any) => ({
            id: n.id,
            name: n.name ?? "Untitled",
            type: "note",
            ownerId: n.ownerId ?? orgId,
            parentId: n.parentId ?? null,
            children: undefined,
          }))
        : [];

      setOrgTree(sortTree(arr));
    })();
  }, [user]);

  if (!user) {
    return <div>Loading...</div>;
  }

  /* --------------------------------- Handlers ---------------------------------- */
  const handleAdd = async (type: "note" | "folder") => {
    let newNode;
    if (type === "folder") {
      newNode = await createFolderInDB(user.uid, "New Folder", null);
      toast.success("Folder created!");
    } else {
      newNode = await createNoteInDB(user.uid, "Untitled Note", null);
      toast.success("Note created!");
    }
    setTree((prev) => addNode(prev, null, type, newNode.id, newNode.name));
  };

  const handleMove = (draggedId: string, targetFolderId: string | null) => {
    setTree((prev) => {
      const updatedTree = moveNode(prev, draggedId, targetFolderId);

      update(ref(db, `users/${user.uid}/notes/${draggedId}`), {
        parentId: targetFolderId ?? null,
      });

      return sortTree(updatedTree);
    });
  };

  const handleRename = async (id: string, newName: string) => {
    setTree((prevTree) =>
      sortTree(
        prevTree.map((node) =>
          node.id === id
            ? { ...node, name: newName }
            : { ...node, children: node.children ? rename(node.children) : undefined }
        )
      )
    );

    await renameNodeInDB(user.uid, id, newName);

    function rename(nodes: FileNode[]): FileNode[] {
      return nodes.map((node) =>
        node.id === id
          ? { ...node, name: newName }
          : { ...node, children: node.children ? rename(node.children) : undefined }
      );
    }
  };

  const handleDelete = async (id: string) => {
    setTree((prevTree) =>
      prevTree
        .filter((node) => node.id !== id)
        .map((node) => ({
          ...node,
          children: node.children ? handleDeleteChildren(node.children, id) : undefined,
        }))
    );

    if (selectedNoteId === id) setSelectedNoteId(null);
    await deleteNodeInDB(user.uid, id);

    function handleDeleteChildren(nodes: FileNode[], deleteId: string): FileNode[] {
      return nodes
        .filter((node) => node.id !== deleteId)
        .map((node) => ({
          ...node,
          children: node.children ? handleDeleteChildren(node.children, deleteId) : undefined,
        }));
    }
  };

  function findNodeById(nodes: FileNode[], id: string): FileNode | null {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  /* ----------------------------------- UI ------------------------------------- */
  return (
    <div className="flex h-screen">
      {/* LEFT: v1-style notes structure ONLY (buttons + 3 sections) */}
      <div
        className="
          w-1/4 border-r p-2
          grid gap-2
          grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]
          min-h-0
        "
      >
        {/* Row 1: buttons */}
        <div className="flex gap-3">
          <Button onClick={() => handleAdd("note")} variant="default" size="sm">
            + Note
          </Button>
          <Button onClick={() => handleAdd("folder")} variant="default" size="sm">
            + Folder
          </Button>
        </div>

        {/* Row 2: My Notes */}
        <div className="min-h-0 overflow-hidden rounded-lg border bg-card">
          <div className="px-3 py-2 border-b text-sm font-semibold">My Notes</div>
          <div
            onDragOver={(e) => e.preventDefault()}
            className="min-h-0 h-full overflow-auto no-scrollbar"
          >
            <NoteTree
              treeData={tree}
              onSelect={(id: string) => {
                setSelectedNoteId(id);
                const node = findNodeById(tree, id);
                setOwnerID(node?.ownerId ?? user.uid);
              }}
              onRename={handleRename}
              onDelete={handleDelete}
              onDropNode={handleMove}
            />
          </div>
        </div>

        {/* Row 3: Shared Notes */}
        <div className="min-h-0 overflow-hidden rounded-lg border bg-card">
          <div className="px-3 py-2 border-b text-sm font-semibold">Shared Notes</div>
          <div className="min-h-0 h-full overflow-auto no-scrollbar">
            <NoteTree
              treeData={sharedTree}
              onSelect={(id: string) => {
                setSelectedNoteId(id);
                const node = findNodeById(sharedTree, id);
                setOwnerID(node?.ownerId ?? user.uid);
              }}
              onRename={handleRename}
              onDelete={handleDelete}
              onDropNode={handleMove}
            />
          </div>
        </div>

        {/* Row 4: Organisation Notes */}
        <div className="min-h-0 overflow-hidden rounded-lg border bg-card">
          <div className="px-3 py-2 border-b text-sm font-semibold">
            Organisation Notes{activeOrgId ? ` – ${activeOrgId}` : ""}
          </div>
          <div className="min-h-0 h-full overflow-auto no-scrollbar">
            <NoteTree
              treeData={orgTree}
              onSelect={(id: string) => {
                setSelectedNoteId(id);
                const node = findNodeById(orgTree, id);
                // Prefer node.ownerId if present; otherwise fall back to activeOrgId
                setOwnerID(node?.ownerId ?? activeOrgId ?? user.uid);
              }}
              onRename={handleRename}
              onDelete={handleDelete}
              onDropNode={handleMove}
            />
          </div>
        </div>
      </div>

      {/* CENTER + RIGHT: keep v2 exactly (editor + sticky Summary/Flashcards) */}
      <div className="flex flex-1 gap-6 p-6">
        {/* Center: Editor */}
        <div className="flex-[3] flex flex-col gap-6 items-center">
          {selectedNoteId ? (
            <div className="flex flex-col w-full items-center">
              <div className="w-full max-w-6xl p-4 mb-6 border rounded-2xl bg-white dark:bg-gray-800 shadow">
                <h2 className="text-2xl font-bold text-left text-gray-900 dark:text-gray-100">
                  {selectedNote?.name}
                </h2>
              </div>
              <div className="flex-1 min-h-0 w-full max-w-6xl border rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow p-2">
                <Main
                  searchParams={{
                    doc: selectedNoteId,
                    ownerId: currentOwnerId ?? undefined,
                    username: displayname ?? undefined,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-20">
              Select a note or folder
            </div>
          )}
        </div>

        {/* Right: Sticky pane with Summary (top) + Flashcards (bottom) */}
        <div
          className="
            w-[420px] shrink-0
            sticky top-6 self-start
            h-[calc(100vh-1.5rem)]
          "
        >
          <div className="flex flex-col gap-6 h-full">
            {/* Top half: Summary */}
            <div className="h-[calc((100%-1.5rem)/2)] min-h-0 border rounded-2xl bg-white dark:bg-gray-900 shadow overflow-hidden">
              <div className="h-full overflow-auto [&>*]:h-full">
                <SummaryPanel
                  sourceText={extractNoteTextFromString(selectedNote?.content as any)}
                  title="Summary"
                  className="h-full"
                  orgId={user.uid}
                  ownerId={currentOwnerId ?? user.uid}
                  noteId={selectedNoteId ?? ""}
                  userId={user.uid}
                  isPersonal
                />
              </div>
            </div>

            {/* Bottom half: Flashcards */}
            <div className="h-[calc((100%-1.5rem)/2)] min-h-0 border rounded-2xl bg-white dark:bg-gray-900 shadow overflow-hidden">
              <div className="h-full overflow-auto [&>*]:h-full">
                <FlashcardGenerator
                  initialText={extractNoteTextFromString(selectedNote?.content as any)}
                  className="h-full"
                  userId={user.uid}
                  ownerId={user.uid}
                  noteId={selectedNoteId ?? ""}
                  isPersonal
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
