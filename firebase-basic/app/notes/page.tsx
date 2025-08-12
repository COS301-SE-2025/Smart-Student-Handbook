"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "@firebase/auth";
import { ref, update } from "@firebase/database";
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

export default function NotesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [sharedTree, setSharedTree] = useState<FileNode[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsub();
  }, []);

  // ✅ Only fetch tree after user is set
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

  // ✅ Fetch selected note once ID changes
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
    } else {
      newNode = await createNoteInDB(user.uid, "Untitled Note", null);
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

  return (
    <div className="flex h-screen">
      <div className="w-1/4 border-r p-2 space-y-2">
        <div className="flex gap-2">
          <button onClick={() => handleAdd("note")} className="...">+ Note</button>
          <button onClick={() => handleAdd("folder")} className="...">+ Folder</button>
        </div>

        <div onDragOver={(e) => e.preventDefault()} className="drop-root-zone">
          <NoteTree treeData={tree} onSelect={setSelectedNoteId} onRename={handleRename} onDelete={handleDelete} onDropNode={handleMove} />
          <NoteTree treeData={sharedTree} onSelect={setSelectedNoteId} onRename={handleRename} onDelete={handleDelete} onDropNode={handleMove} />
        </div>
      </div>

      <div className="flex-1 p-4">
        {selectedNoteId ? (
          <Main searchParams={{ doc: selectedNoteId }} />
        ) : (
          <div>Select a note or folder</div>
        )}
      </div>
    </div>
  );
}
