// app/notes/page.tsx (or wherever this lives)
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

// NEW: use the shared Button component
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

  if (!user) {
    return <div>Loading...</div>;
  }

  const handleAdd = async (type: "note" | "folder") => {
    let newNode;
    if (type === "folder") {
      newNode = await createFolderInDB(user.uid, "New Folder", null);
      toast.success(`Folder created!`);
    } else {
      newNode = await createNoteInDB(user.uid, "Untitled Note", null);
      toast.success(`Note created!`);
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

  return (
    <div className="flex h-screen">
      <div className="w-1/4 border-r p-2 space-y-2">
        <div className="flex gap-2">
          <div className="flex gap-2">
            {/* Use shared Button component for consistent styling */}
            <Button onClick={() => handleAdd("note")} variant="default" size="sm" className="px-3">
              + Note
            </Button>
            <Button onClick={() => handleAdd("folder")} variant="default" size="sm" className="px-3">
              + Folder
            </Button>
          </div>
        </div>

        <div onDragOver={(e) => e.preventDefault()} className="drop-root-zone">
          <NoteTree
            treeData={tree}
            onSelect={(id: string) => {
              setSelectedNoteId(id);
              const node = findNodeById(tree, id);
              setOwnerID(node?.ownerId ?? null);
            }}
            onRename={handleRename}
            onDelete={handleDelete}
            onDropNode={handleMove}
          />

          <NoteTree
            treeData={sharedTree}
            onSelect={(id: string) => {
              setSelectedNoteId(id);
              const node = findNodeById(sharedTree, id);
              setOwnerID(node?.ownerId ?? null);
            }}
            onRename={handleRename}
            onDelete={handleDelete}
            onDropNode={handleMove}
          />
        </div>
      </div>

      <div className="flex flex-1 gap-6 p-6">
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

        {/* RIGHT COLUMN: fixed (sticky) pane with two equal (50/50) sections */}
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
                  /** ensure user-scope save to users/{uid}/notes/{noteId}/summary */
                  userId={user.uid}
                  isPersonal={true}
                />
              </div>
            </div>

            {/* Bottom half: Flashcards */}
            <div className="h-[calc((100%-1.5rem)/2)] min-h-0 border rounded-2xl bg-white dark:bg-gray-900 shadow overflow-hidden">
              <div className="h-full overflow-auto [&>*]:h-full">
                <FlashcardGenerator
                  initialText={extractNoteTextFromString(selectedNote?.content as any)}
                  className="h-full"
                  /** ensure user-scope save to users/{uid}/notes/{noteId}/flashcards */
                  userId={user.uid}
                  ownerId={user.uid}
                  noteId={selectedNoteId ?? ""}
                  isPersonal={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
