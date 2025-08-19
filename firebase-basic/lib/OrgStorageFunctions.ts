import { Block, PartialBlock } from "@blocknote/core";
import { get, getDatabase, ref, set } from "@firebase/database";
import { getAuth } from "@firebase/auth";

export async function saveToStorage(noteId: string, jsonBlocks: Block[], ownerID: string) {
  const db = getDatabase();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error("User not authenticated");
    return;
  }

  const jsonBl = JSON.stringify(jsonBlocks);
  const path = `organizations/${ownerID}/notes/${noteId}/content`;
  const noteRef = ref(db, path);
  try {
    await set(noteRef, jsonBl);
    console.log("Note saved successfully");
  } catch (error) {
    console.error("Error saving note:", error);
  }
}

export async function loadFromStorage(noteId: string, orgId: string): Promise<PartialBlock[] | undefined> {
  const db = getDatabase();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error("User not authenticated");
    return;
  }
  const path = `organizations/${orgId}/notes/${noteId}/content`;
  const noteRef = ref(db, path);

  try {
    const snapshot = await get(noteRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      return JSON.parse(data) as PartialBlock[];
    } else {
      console.warn("No note content found for ID:", noteId);
      return undefined;
    }
  } catch (error) {
    console.error("Error loading note:", error);
    return undefined;
  }
}