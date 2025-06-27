"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderIcon,
  Trash2,
  Plus,
  ArrowLeft,
  Share2,
  Users,
  User,
} from "lucide-react";
import Link from "next/link";
import QuillEditor from "@/components/quilleditor";
import "react-quill/dist/quill.snow.css";

import { db } from "../../lib/firebase";
import { getAuth } from "firebase/auth";
import { toast } from "sonner";

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

const user = getAuth().currentUser;

import { child, get, getDatabase, onValue, ref, set } from "firebase/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Note = {
  ownerId: string;
  id: string;
  name: string;
  content: string;
  type: "note";
  collaborators: {
    [userId: string]: boolean;
  };
};

type Folder = {
  id: string;
  name: string;
  type: "folder";
  expanded: boolean;
  children: FileNode[];
  collaborators: {
    [userId: string]: boolean;
  };
};

type FileNode = Note | Folder;

const generateId = () => Math.random().toString(36).slice(2, 9);

export default function NotePage() {
  const [testTree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharedTree, setSharedTree] = useState<FileNode[]>([]);

  const functions = getFunctions(app);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const [showCollaboratorsDialog, setShowCollaboratorsDialog] = useState(false);
  const [permission, setPermission] = useState<"read" | "write" | "none">(
    "none"
  );
  const [open, setOpen] = useState(false);
  const [collaboratorId, setCollaboratorId] = useState("");

  const handleShare = async (
    e: React.MouseEvent,
    noteId: string,
    permission: string
  ) => {
    e.stopPropagation();

    if (!noteId || !collaboratorId || !permission) {
      toast.error("Missing note or collaborator ID");
      return;
    }

    try {
      const functions = getFunctions(app);
      const shareNote = httpsCallable(functions, "shareNote");

      const result = await shareNote({ collaboratorId, noteId, permission });
      console.log(`Shared note ${noteId} with ${collaboratorId}`, result);

      toast.success("Note shared successfully!");
      setOpen(false);
      setCollaboratorId("");
    } catch (error: any) {
      console.error("Error sharing note:", error);
      toast.error("Failed to share note.");
    }
  };

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    const notesRef = ref(db, `users/${user.uid}/notes`);

    const unsubscribe = onValue(notesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const items = Object.values(data);
        const tree = buildTree(items);
        setTree(tree);
      } else {
        setTree([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (testTree.length > 0) {
      saveTreeToRealtimeDB(testTree);
    }
  }, [testTree]);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    const sharedNotesRef = ref(db, `users/${user.uid}/sharedNotes`);

    const noteListeners: (() => void)[] = [];
    const sharedItemsMap = new Map<string, any>();

    const unsubscribe = onValue(sharedNotesRef, (snapshot) => {
      if (!snapshot.exists()) {
        setSharedTree([]);
        setLoading(false);
        return;
      }

      const sharedNotes: Record<string, { owner: string; noteId: string }> =
        snapshot.val();

      noteListeners.forEach((unsub) => unsub());
      noteListeners.length = 0;
      sharedItemsMap.clear();

      Object.entries(sharedNotes).forEach(([noteId, { owner }]) => {
        const path = `users/${owner}/notes/${noteId}`;
        const noteRef = ref(db, path);
        console.log(path);
        const noteUnsub = onValue(noteRef, (noteSnap) => {
          if (noteSnap.exists()) {
            const raw = noteSnap.val();
            const item = {
              id: raw.id,
              name: raw.name ?? "",
              content: raw.content ?? "",
              type: "note",
              collaborators: raw.collaborators ?? {},
              parentId: "__shared__",
              ownerId: owner,
            };

            sharedItemsMap.set(raw.id, item);

            const sharedItems = Array.from(sharedItemsMap.values());
            const built = buildTree(sharedItems, "__shared__");
            setSharedTree(built);
          }
        });

        noteListeners.push(noteUnsub);
      });

      setLoading(false);
    });

    return () => {
      unsubscribe();
      noteListeners.forEach((unsub) => unsub());
    };
  }, []);

  useEffect(() => {
    const fetchPermission = async () => {
      const user = getAuth().currentUser;
      if (!user || !selectedNote) return;

      const noteRef = ref(
        db,
        `users/${selectedNote.ownerId}/notes/${selectedNote.id}/collaborators/${user.uid}`
      );
      const snapshot = await get(noteRef);
      if (snapshot.exists()) {
        setPermission(snapshot.val()); // "read" or "write"
      } else {
        setPermission("none");
      }
    };

    fetchPermission();
  }, [selectedNote]);

  const toggleExpand = (folder: Folder) => {
    const toggle = (nodes: FileNode[]): FileNode[] =>
      nodes.map((node) => {
        if (node.type === "folder") {
          if (node.id === folder.id) {
            return { ...node, expanded: !node.expanded };
          }
          return { ...node, children: toggle(node.children) };
        }
        return node;
      });
    setTree((prev) => toggle(prev));
  };

  async function addSharedNoteToCurrentUser({
    noteId,
    ownerId,
  }: {
    noteId: string;
    ownerId: string;
  }) {
    const user = getAuth().currentUser;
    if (!user) throw new Error("User not logged in");

    const collaboratorId = user.uid;
    const db = getDatabase();

    const sharedNoteRef = ref(
      db,
      `users/${collaboratorId}/sharedNotes/${noteId}`
    );

    const data = {
      owner: ownerId,
      noteId: noteId,
    };

    try {
      await set(sharedNoteRef, data);
      console.log(
        `Shared note ${noteId} (owner: ${ownerId}) added to user ${collaboratorId}`
      );
    } catch (error) {
      console.error("Error adding shared note:", error);
      throw error;
    }
  }

  async function loadSharedNotesTreeFromRealtimeDB(): Promise<Folder[]> {
    const user = getAuth().currentUser;
    if (!user) throw new Error("User not logged in");

    const collaboratorId = user.uid;
    const db = getDatabase();
    const sharedNotesRef = ref(db, `users/${collaboratorId}/sharedNotes`);
    const snapshot = await get(sharedNotesRef);

    if (!snapshot.exists()) {
      console.log("No shared notes found.");
      return [];
    }

    const sharedNotes: Record<string, { owner: string; noteId: string }> =
      snapshot.val();
    const sharedItems: any[] = [];

    for (const [noteId, { owner }] of Object.entries(sharedNotes)) {
      const noteRef = ref(db, `users/${owner}/notes/${noteId}`);
      try {
        const noteSnap = await get(noteRef);
        if (noteSnap.exists()) {
          const raw = noteSnap.val();
          sharedItems.push({
            id: raw.id,
            name: raw.name ?? "",
            content: raw.content ?? "",
            type: "note",
            collaborators: raw.collaborators ?? {},
            parentId: "__shared__",
            ownerId: owner,
          });
        }
      } catch (err) {
        console.error(
          `Failed to fetch shared note ${noteId} from ${owner}:`,
          err
        );
      }
    }

    async function updateSharedNoteContent({
      ownerId,
      noteId,
      field,
      value,
    }: {
      ownerId: string;
      noteId: string;
      field: "name" | "content";
      value: string;
    }) {
      const user = getAuth().currentUser;
      if (!user) throw new Error("User not logged in");

      const db = getDatabase();
      const noteRef = ref(db, `users/${ownerId}/notes/${noteId}/${field}`);

      try {
        await set(noteRef, value);
        console.log(`Updated shared note ${noteId} (${field}) to:`, value);
      } catch (error) {
        console.error("Error updating shared note:", error);
        throw error;
      }
    }

    const sharedFolder: Folder = {
      id: "__shared__",
      name: "Shared With Me",
      type: "folder",
      expanded: true,
      collaborators: {},
      children: buildTree(sharedItems, "__shared__"),
    };

    return [sharedFolder];
  }

  async function loadTreeFromRealtimeDB(): Promise<FileNode[]> {
    const user = getAuth().currentUser;
    if (!user) throw new Error("User not logged in");

    const path = `users/${user.uid}/notes`;

    console.log("Accessing path: ", `users/${user.uid}/notes`);

    const dbRef = ref(db, path);
    const snapshot = await get(dbRef);

    if (!snapshot.exists()) {
      console.warn("No data exists for this user.");
      return [];
    }

    const data = snapshot.val();
    const items = Object.values(data);

    console.log("Items : ", items);

    return buildTree(items);
  }

  function buildTree(items: any[], parentId: string | null = null): FileNode[] {
    return items
      .filter((item) => (item.parentId ?? null) === parentId)
      .map((item) => {
        if (item.type === "note") {
          return {
            id: item.id,
            name: item.name,
            content: item.content,
            type: "note",
            collaborators: item.collaborators ?? {},
            ownerId: item.ownerId ?? "",
          };
        } else {
          return {
            id: item.id,
            name: item.name,
            type: "folder",
            expanded: item.expanded ?? false,
            children: buildTree(items, item.id),
            collaborators: item.collaborators ?? {},
            ownerId: item.ownerId ?? "",
          };
        }
      });
  }

  function flattenTree(
    nodes: FileNode[],
    parentId: string | null = null
  ): Record<string, any> {
    const result: Record<string, any> = {};
    nodes.forEach((node) => {
      if (node.type === "note") {
        result[node.id] = {
          ...node,
          parentId,
        };
      } else {
        const { children, ...folderData } = node;
        result[node.id] = {
          ...folderData,
          parentId,
        };
        Object.assign(result, flattenTree(children, node.id));
      }
    });

    return result;
  }

  async function saveTreeToRealtimeDB(tree: FileNode[]) {
    const user = getAuth().currentUser;
    if (!user) {
      throw new Error("User not logged in");
    }

    const userPath = `users/${user.uid}/notes`;
    const flatTree = flattenTree(tree);

    await set(ref(db, userPath), flatTree);
  }

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
    setSelectedFolderId(null);
  };

  const handleFolderNameChange = (id: string, newName: string) => {
    const updateName = (nodes: FileNode[]): FileNode[] =>
      nodes.map((node) => {
        if (node.type === "folder") {
          if (node.id === id) {
            return { ...node, name: newName };
          }
          return { ...node, children: updateName(node.children) };
        }
        return node;
      });

    setTree((prev) => {
      const updatedTree = updateName(prev);
      return updatedTree;
    });
  };

  const handleNoteChange = (
    id: string,
    field: "content" | "name",
    value: string
  ) => {
    const updateNote = (nodes: FileNode[]): FileNode[] =>
      nodes.map((node) => {
        if (node.type === "note" && node.id === id) {
          return { ...node, [field]: value };
        } else if (node.type === "folder") {
          return { ...node, children: updateNote(node.children) };
        }
        return node;
      });

    setTree((prev) => {
      const updatedTree = updateNote(prev);
      return updatedTree;
    });

    if (selectedNote && selectedNote.id === id) {
      setSelectedNote({ ...selectedNote, [field]: value });

      const db = getDatabase();
      const user = getAuth().currentUser;
      if (!user) return;

      const ownerId = selectedNote.ownerId || user.uid;
      const noteRef = ref(db, `users/${ownerId}/notes/${id}/${field}`);

      set(noteRef, value).catch((err) => {
        console.error("Failed to update note in Firebase:", err);
      });
    }
  };

  const addFolder = () => {
    const newFolder: Folder = {
      id: generateId(),
      name: "New Folder",
      type: "folder",
      expanded: false,
      children: [],
      collaborators: {
        placeholder: false,
      },
    };

    if (selectedFolderId) {
      const addToFolder = (nodes: FileNode[]): FileNode[] =>
        nodes.map((node) => {
          if (node.type === "folder") {
            if (node.id === selectedFolderId) {
              return { ...node, children: [...node.children, newFolder] };
            }
            return { ...node, children: addToFolder(node.children) };
          }
          return node;
        });
      setTree((prev) => {
        const updatedTree = addToFolder(prev);
        return updatedTree;
      });
    } else {
      setTree((prev) => {
        const updatedTree = [...prev, newFolder];
        return updatedTree;
      });
    }
  };

  const addNote = () => {
    const user = getAuth().currentUser;
    if (!user) throw new Error("User not logged in");

    const newNote: Note = {
      id: generateId(),
      name: "New Note",
      content: "",
      type: "note",
      collaborators: {
        placeholder: false,
      },
      ownerId: user.uid,
    };

    if (selectedFolderId) {
      const addToFolder = (nodes: FileNode[]): FileNode[] =>
        nodes.map((node) => {
          if (node.type === "folder") {
            if (node.id === selectedFolderId) {
              return { ...node, children: [...node.children, newNote] };
            }
            return { ...node, children: addToFolder(node.children) };
          }
          return node;
        });
      setTree((prev) => {
        const updatedTree = addToFolder(prev);
        return updatedTree;
      });
    } else {
      setTree((prev) => {
        const updatedTree = [...prev, newNote];
        return updatedTree;
      });
    }
  };

  const removeNodeById = (nodes: FileNode[], id: string): FileNode[] => {
    return nodes
      .map((node) => {
        if (node.id === id) return null;

        if (node.type === "folder") {
          const updatedChildren = removeNodeById(node.children, id);
          return { ...node, children: updatedChildren };
        }

        return node;
      })
      .filter((node): node is FileNode => node !== null);
  };

  const renderTree = (nodes: FileNode[], depth = 0) =>
    nodes.map((node) => {
      if (node.type === "folder") {
        const isSelected = selectedFolderId === node.id;
        return (
          <div key={node.id} className="mb-1">
            <div
              className={`flex items-center py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors group ${
                isSelected ? "bg-muted" : ""
              }`}
              style={{ marginLeft: depth * 20 }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-auto mr-2 hover:bg-transparent"
                onClick={() => {
                  toggleExpand(node);
                  setSelectedFolderId(node.id);
                  setSelectedNote(null);
                }}
              >
                {node.expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>

              <FolderIcon className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />

              <div className="flex-1 min-w-0">
                {isSelected ? (
                  <input
                    type="text"
                    value={node.name}
                    onChange={(e) =>
                      handleFolderNameChange(node.id, e.target.value)
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border-none focus:outline-none focus:ring-0 w-full font-medium text-sm"
                    autoFocus
                  />
                ) : (
                  <span
                    className="font-medium text-sm truncate cursor-pointer"
                    onClick={() => {
                      setSelectedFolderId(node.id);
                      setSelectedNote(null);
                    }}
                  >
                    {node.name}
                  </span>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    window.confirm(
                      `Delete folder "${node.name}" and all its contents?`
                    )
                  ) {
                    setTree((prev) => {
                      const newTree = removeNodeById(prev, node.id);

                      if (selectedFolderId === node.id)
                        setSelectedFolderId(null);
                      if (selectedNote?.id === node.id) setSelectedNote(null);
                      return newTree;
                    });
                  }
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            {node.expanded && (
              <div className="mt-1">{renderTree(node.children, depth + 1)}</div>
            )}
          </div>
        );
      } else {
        const isSelected = selectedNote?.id === node.id;
        return (
          <div
            key={node.id}
            className={`flex items-center py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer mb-1 ${
              isSelected ? "bg-blue-50 border border-blue-200" : ""
            }`}
            style={{ marginLeft: (depth + 1) * 20 }}
            onClick={() => handleSelectNote(node)}
          >
            <FileText className="h-4 w-4 text-gray-500 mr-2 flex-shrink-0" />

            <span
              className={`flex-1 text-sm truncate ${
                isSelected ? "font-medium text-blue-700" : ""
              }`}
            >
              {node.name}
            </span>

            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete note "${node.name}"?`)) {
                  setTree((prev) => {
                    const newTree = removeNodeById(prev, node.id);
                    if (selectedNote?.id === node.id) setSelectedNote(null);
                    return newTree;
                  });
                }
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700 hover:bg-blue-50"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
            >
              <Share2 className="h-3 w-3" />
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent
                className="sm:max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <DialogHeader>
                  <DialogTitle>Share Note</DialogTitle>
                </DialogHeader>

                <Input
                  placeholder="Enter collaborator's User ID"
                  value={collaboratorId}
                  onChange={(e) => setCollaboratorId(e.target.value)}
                />

                <Label className="mt-4">Permissions</Label>
                <RadioGroup
                  value={permission}
                  onValueChange={(value) =>
                    setPermission(value as "read" | "write")
                  }
                  className="flex space-x-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="read" id="read" />
                    <Label htmlFor="read">Read</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="write" id="write" />
                    <Label htmlFor="write">Write</Label>
                  </div>
                </RadioGroup>

                <DialogFooter className="mt-4">
                  <Button
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={(e) => handleShare(e, selectedNote?.id, permission)}
                    disabled={!collaboratorId.trim()}
                  >
                    Share
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700 hover:bg-blue-50"
              onClick={(e) => {
                e.stopPropagation();
                setShowCollaboratorsDialog(true);
              }}
            >
              <Users className="h-3 w-3" />
            </Button>

            <Dialog
              open={showCollaboratorsDialog}
              onOpenChange={setShowCollaboratorsDialog}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Manage Collaborators</DialogTitle>
                </DialogHeader>

                {selectedNote &&
                Object.keys(selectedNote.collaborators || {}).length > 0 ? (
                  <ul className="space-y-2">
                    {Object.entries(selectedNote.collaborators).map(
                      ([uid, isActive]) =>
                        isActive && (
                          <li
                            key={uid}
                            className="flex items-center justify-between"
                          >
                            <span className="flex items-center gap-2 text-sm">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {uid}
                            </span>

                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const functions = getFunctions();
                                  const removeCollaborator = httpsCallable(
                                    functions,
                                    "removeCollaborator"
                                  );

                                  await removeCollaborator({
                                    noteId: selectedNote?.id,
                                    collaboratorId: uid,
                                  });

                                  toast.success(`Removed collaborator ${uid}`);
                                  setShowCollaboratorsDialog(false);

                                  setSelectedNote((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          collaborators: {
                                            ...prev.collaborators,
                                            [uid]: false,
                                          },
                                        }
                                      : null
                                  );
                                } catch (err) {
                                  console.error(
                                    "Error removing collaborator:",
                                    err
                                  );
                                  toast.error("Failed to remove collaborator");
                                }
                              }}
                            >
                              Remove
                            </Button>
                          </li>
                        )
                    )}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No collaborators yet.
                  </p>
                )}
              </DialogContent>
            </Dialog>
          </div>
        );
      }
    });

  return (
    <div className="h-[calc(100vh-3.5rem)] flex bg-background overflow-hidden">
      <div className="w-80 border-r border-border bg-card/30 flex flex-col">
        <div className="p-4 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={addFolder}
              size="sm"
              variant="outline"
              className="flex-1 gap-2"
            >
              <Plus className="h-4 w-4" />
              Folder
            </Button>
            <Button onClick={addNote} size="sm" className="flex-1 gap-2">
              <Plus className="h-4 w-4" />
              Note
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {testTree.length > 0 ? (
              renderTree(testTree)
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notes yet</p>
                <p className="text-xs">Create your first note or folder</p>
              </div>
            )}

            {sharedTree.length > 0 && (
              <>
                <h4 className="text-sm text-muted-foreground pl-2 mb-1">
                  Shared
                </h4>
                {renderTree(sharedTree)}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedNote ? (
          <>
            <div className="p-6 border-b border-border bg-background/80 backdrop-blur-sm">
              <input
                type="text"
                value={selectedNote.name}
                onChange={(e) =>
                  handleNoteChange(selectedNote.id, "name", e.target.value)
                }
                placeholder="Untitled Note"
                className="text-2xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 w-full placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex-1 overflow-hidden">
              <div className="h-full p-6">
                <div className="h-full max-w-4xl mx-auto">
                  <div className="h-full [&_.ql-container]:h-[calc(100%-42px)] [&_.ql-editor]:h-full">
                    <QuillEditor
                      key={selectedNote.id}
                      value={selectedNote.content}
                      readOnly={permission === "read"}
                      onChange={(newContent) =>
                        handleNoteChange(selectedNote.id, "content", newContent)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/20">
            <div className="text-center max-w-md">
              <FileText className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Select a note to start writing
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Choose a note from the sidebar or create a new one to begin
                taking notes
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={addNote} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Note
                </Button>
                <Button onClick={addFolder} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Folder
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
