// app/notes/page.tsx
"use client";

import { use, useEffect, useState } from "react";
import NoteTree from "@/components/notes/NoteTree";
import { FileNode, Note } from "@/types/note";
import { addNode, moveNode, sortTree, fetchNoteById } from "@/lib/note/treeActions";
import { buildTreeFromRealtimeDB, createFolderInDB, createNoteInDB, deleteNodeInDB, renameNodeInDB } from "@/lib/DBTree";
import { getAuth } from "@firebase/auth";
import { db } from "@/lib";
import { ref, update } from "@firebase/database";

import Editor from "@/components/notes/Editor"

export default function NotesPage() {
  const auth = getAuth();
  const user = auth.currentUser;

  if (user) {
    const userID = user.uid;
  }
  else {
    return;
  }

  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

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

  function findNoteById(tree: FileNode[], id: string): FileNode | null {
    for (const node of tree) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNoteById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }


  const handleAdd = async (type: "note" | "folder") => {
    let newNode;
    if (type === "folder") {
      newNode = await createFolderInDB(user.uid, "New Folder", null);
    } else {
      newNode = await createNoteInDB(user.uid, "Untitled Note", null);
    }

    const newTree = addNode(tree, null, type, newNode.id, newNode.name);
    setTree(newTree);
  };

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    const fetchTree = async () => {
      console.log(user.uid)
      const firebaseTree = await loadTree(user.uid);
      setTree(firebaseTree);
    };

    fetchTree();
  }, []);


  const loadTree = async (userID: string): Promise<FileNode[]> => {
    try {
      const tree = await buildTreeFromRealtimeDB(userID);
      console.log(tree)
      return tree;
    } catch (error) {
      console.error("Error loading tree:", error);
      return [];
    }
  };

  const handleMove = (draggedId: string, targetFolderId: string | null) => {
    setTree((prev) => {
      const updatedTree = moveNode(prev, draggedId, targetFolderId);

      const userID = getAuth().currentUser?.uid;
      if (!userID) return updatedTree;

      const itemRef = ref(db, `users/${userID}/notes/${draggedId}`);
      update(itemRef, {
        parentId: targetFolderId ?? null,
      });

      const sortedTree = sortTree(updatedTree);
      return sortedTree;
    });
  };

  const handleRename = async (id: string, newName: string) => {
    setTree((prevTree) => {
      function rename(nodes: FileNode[]): FileNode[] {
        return nodes.map((node) => {
          if (node.id === id) {
            return { ...node, name: newName };
          }
          if (node.children) {
            return { ...node, children: rename(node.children) };
          }
          return node;
        });
      }
      const renamedTree = rename(prevTree);

      return sortTree(renamedTree);
    });

    try {
      await renameNodeInDB(user.uid, id, newName);
    } catch (error) {
      console.error("Failed to rename node in DB:", error);
    }
  };


  const handleDelete = async (id: string) => {
    setTree((prevTree) => {
      function deleteNode(nodes: FileNode[]): FileNode[] {
        return nodes
          .filter((node) => node.id !== id)
          .map((node) => ({
            ...node,
            children: node.children ? deleteNode(node.children) : undefined,
          }));
      }
      return deleteNode(prevTree);
    });

    if (selectedNoteId === id) setSelectedNoteId(null);

    try {
      await deleteNodeInDB(user.uid, id);
    } catch (error) {
      console.error("Failed to delete node in DB:", error);
    }
  };

  return (
    <div className="flex h-screen">
      <div className="w-1/4 border-r p-2 space-y-2">
        <div className="flex gap-2">
          <button onClick={() => handleAdd("note")} className="...">
            + Note
          </button>
          <button onClick={() => handleAdd("folder")} className="...">
            + Folder
          </button>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          className="drop-root-zone"
        >
          <NoteTree
            treeData={tree}
            onSelect={setSelectedNoteId}
            onRename={handleRename}
            onDelete={handleDelete}
            onDropNode={handleMove}
          />
        </div>

      </div>

      <div className="flex-1 p-4">
        {selectedNoteId ? (
          <div>

            <Editor
              onChange={() => {
                console.log("The File is Changing");
              }}
              noteContent={selectedNote?.content}
              noteID={selectedNoteId} />
          </div>

        ) : (
          <div>Select a note or folder</div>
        )}
      </div>

    </div>
  );
}