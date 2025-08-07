import { getDatabase, ref, get, set, remove, update } from "firebase/database";
import { FileNode , Folder , Note } from "@/types/note";
import { v4 as uuidv4 } from "uuid";

export async function buildTreeFromRealtimeDB(userID: string): Promise<FileNode[]> {
    const db = getDatabase();
    const userNotesRef = ref(db, `users/${userID}/notes`);

    const snapshot = await get(userNotesRef);
    console.log(snapshot);

    if (!snapshot.exists()) return [];

    const data: Record<string, any> = snapshot.val();
    const flatNodes: FileNode[] = [];

    for (const id in data) {
        const item = data[id];

        if (!item.name || !item.type) continue;
        const node: FileNode = {
            id,
            name: item.name,
            type: item.type,
            parentId: item.parentId ?? null,
            ...(item.type === "folder" ? { children: [] } : {}),
        };

        flatNodes.push(node);
    }

    const nodeMap: Record<string, FileNode> = {};
    const tree: FileNode[] = [];

    for (const node of flatNodes) {
        nodeMap[node.id] = node;
    }

    for (const node of flatNodes) {
        if (node.parentId && nodeMap[node.parentId]) {
            const parent = nodeMap[node.parentId];
            if (parent.type === "folder" && parent.children) {
                parent.children.push(node);
            }
        } else {
            tree.push(node);
        }
    }

    return tree;
}

const SHARED_FOLDER_ID = "shared-root";
const SHARED_FOLDER_NAME = "Shared Notes";

export async function buildSharedTreeFromRealtimeDB(userID: string): Promise<FileNode[]> {
  const db = getDatabase();
  const sharedNotesRef = ref(db, `users/${userID}/sharedNotes`);
  const snapshot = await get(sharedNotesRef);

  if (!snapshot.exists()) return [];

  const sharedData: Record<string, { owner: string }> = snapshot.val();
  const flatNodes: FileNode[] = [];

  const sharedFolderNode: FileNode = {
    id: SHARED_FOLDER_ID,
    name: SHARED_FOLDER_NAME,
    type: "folder",
    parentId: null,
    children: [],
  };

  for (const noteId in sharedData) {
    const ownerId = sharedData[noteId].owner;
    if (!ownerId) continue;

    const ownerNoteRef = ref(db, `users/${ownerId}/notes/${noteId}`);
    const noteSnap = await get(ownerNoteRef);

    if (!noteSnap.exists()) continue;

    const noteData = noteSnap.val();
    if (!noteData.name || noteData.type !== "note") continue;

    const sharedNoteNode: FileNode = {
      id: noteId,
      name: noteData.name,
      type: "note",
      parentId: SHARED_FOLDER_ID,
    };

    sharedFolderNode.children!.push(sharedNoteNode);
  }

  return sharedFolderNode.children!.length > 0 ? [sharedFolderNode] : [];
}

export const createFolderInDB = async (
  userID: string,
  name: string,
  parentId: string | null
): Promise<Folder> => {
  const db = getDatabase();
  const id = uuidv4();

  const newFolder: Folder = {
    id,
    name,
    type: "folder",
    expanded: true,
    children: [], // this is for local use
    collaborators: {
      [userID]: "owner",
    },
    parentId: "" 
  };

  await set(ref(db, `users/${userID}/notes/${id}`), newFolder);
  return newFolder;
};

export const createNoteInDB = async (
  userID: string,
  name: string,
  parentId: string | null
): Promise<Note> => {
  const db = getDatabase();
  const id = uuidv4();

  const newNote: Note = {
    id,
    name,
    type: "note",
    content: "",
    collaborators: {
      [userID]: "owner",
    },
    ownerId: userID,
    parentId: "" 
  };

  await set(ref(db, `users/${userID}/notes/${id}`), newNote);
  return newNote;
};

export async function deleteNodeInDB(userID: string, nodeId: string): Promise<void> {
  const db = getDatabase();
  await remove(ref(db, `users/${userID}/notes/${nodeId}`));
}

export async function renameNodeInDB(
  userID: string,
  nodeId: string,
  newName: string
): Promise<void> {
  const db = getDatabase();
  await update(ref(db, `users/${userID}/notes/${nodeId}`), {
    name: newName,
  });
}
