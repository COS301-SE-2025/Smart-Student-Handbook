"use client";
import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import React, { useEffect, useState } from "react";
import { Block, BlockNoteEditor, PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css"
import "@blocknote/react/style.css"

import { useMemo } from "react";
import { get, getDatabase, ref, set } from "@firebase/database";
import { getAuth } from "@firebase/auth";

interface EditorProps {
  initContent?: string;
  editable?: boolean;
  noteID: string
  ownerID: string
}

async function saveToStorage(noteId: string, jsonBlocks: Block[], ownerID: string) {
  const db = getDatabase();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error("User not authenticated");
    return;
  }

  const jsonBl = JSON.stringify(jsonBlocks);
  const noteRef = ref(db, `users/${ownerID}/notes/${noteId}/content`);
  try {
    await set(noteRef, jsonBl);
    console.log("Note saved successfully");
  } catch (error) {
    console.error("Error saving note:", error);
  }
}

async function loadFromStorage(noteId: string, ownerID: string): Promise<PartialBlock[] | undefined> {
  const db = getDatabase();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error("User not authenticated");
    return;
  }

  const noteRef = ref(db, `users/${ownerID}/notes/${noteId}/content`);

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

const Editor: React.FC<EditorProps> = ({ editable, noteID, ownerID }) => {
  const [initialContent, setInitialContent] = useState<PartialBlock[] | undefined | "loading"
  >("loading");

  useEffect(() => {
    console.log(`Loading Preset , now loading ${noteID}`);
    if (noteID) {
      loadFromStorage(noteID , ownerID).then((content) => {
        setInitialContent(content);
      });
    } else {
      console.log('Error occured while loading Note , Invalid NoteID');
    }

  }, [noteID]);

  const editor = useMemo(() => {
    if (initialContent === "loading") {
      return undefined;
    }
    return BlockNoteEditor.create({ initialContent });
  }, [initialContent]);
  
  if (editor === undefined) {
    return "Loading content...";
  }

  let saveTimeout: string | number | NodeJS.Timeout | undefined;

  editor.onChange((editor, { getChanges }) => {
    console.log("Editor content has been changed");
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (noteID)
        saveToStorage(noteID, editor.document , ownerID);
      else
        console.log('An error has occurred . No NoteID was entered');
    }, 1500);

  });

  return (
    <div className="my-4">
      <BlockNoteView editor={editor} editable={editable} theme="light" />
    </div>
  )
}

export default Editor