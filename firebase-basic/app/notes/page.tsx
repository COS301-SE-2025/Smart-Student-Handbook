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
import { extractNoteTextFromString } from "@/lib/note/BlockFormat"

import SimpleSummaryPanel from "@/components/ai/SimpleSummary";
import SimpleFlashCardSection from "@/components/flashcards/SimpleFlashcardPanel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button"

export default function NotesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayname , setDisplayName] = useState<string | null>(null) ; 
  const [tree, setTree] = useState<FileNode[]>([]);
  const [sharedTree, setSharedTree] = useState<FileNode[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [currentOwnerId, setOwnerID] = useState<string | null>(null);

  /****************************
  organisation tree
  ****************************/
  const [orgTree, setOrgTree] = useState<FileNode[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null); // optional, pick org

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {

    setUser(firebaseUser);

    const names = ref(db , `users/${user?.uid}/UserSettings`) ; 
    const snapshot = await get(names) ; 

    const data = snapshot.val() ; 
    setDisplayName(data.name) ; 


    console.log("User Names:" , displayname) ; 

    
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

  /***************************************
  Test organisation shared notes
  ***************************************/
  useEffect(() => {
  if (!user) return;

  // Example: get the user’s first/primary org id.
  // Adjust this to your schema (e.g. users/${uid}/orgMemberships)
  (async () => {
    const orgIdSnap = await get(ref(db, `users/${user.uid}/primaryOrgId`));
    const orgId = orgIdSnap.val() as string | null;
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

    // If you support folders under orgs, build the tree (or reuse sortTree)
    setOrgTree(sortTree(arr));
  })();
}, [user]);


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

  /***************************************
  Logic for split grids
  ***************************************/
  return (
    <div className="flex h-screen">
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

        {/* Row 2: Personal */}
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
                setOwnerID(node?.ownerId ?? null);
              }}
              onRename={handleRename}
              onDelete={handleDelete}
              onDropNode={handleMove}
            />
          </div>
        </div>

        {/* Row 3: Shared */}
        <div className="min-h-0 overflow-hidden rounded-lg border bg-card">
          <div className="px-3 py-2 border-b text-sm font-semibold">Share Notes</div>
          <div className="min-h-0 h-full overflow-auto no-scrollbar">
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

        {/* Row 4: Organisation */}
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
                setOwnerID(node?.ownerId ?? null);
              }}
              onRename={handleRename}
              onDelete={handleDelete}
              onDropNode={handleMove}
            />
          </div>
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

        <div className="flex-[2] flex flex-col gap-6 items-center">
          <div className="w-full max-w-md border rounded-2xl bg-white dark:bg-gray-900 shadow overflow-hidden">
            <SimpleSummaryPanel
              sourceText={extractNoteTextFromString(selectedNote?.content as any)}
              title="Summary"
              className="h-full"
            />
          </div>

          <div className="w-full max-w-md border rounded-2xl bg-white dark:bg-gray-900 shadow overflow-hidden">
            <SimpleFlashCardSection
              initialText={extractNoteTextFromString(selectedNote?.content as any)}
            />
          </div>
        </div>
      </div>
    </div>

  );
}
