"use client";
import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import React, { useEffect, useState } from "react";
import { Block, BlockNoteEditor, PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css"
import "@blocknote/react/style.css"

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { doc } from "@firebase/firestore";
import { EditorContent } from "@tiptap/react";

interface EditorProps {
  initContent?: string;
  editable?: boolean;
  noteID?: string
  noteContent?: string
}

async function saveToStorage(jsonBlocks: Block[]) {
  const jsonBl = JSON.stringify(jsonBlocks) ; 
  console.log(jsonBl)
}

async function loadFromStorage() {
  const storageString = localStorage.getItem("editorContent");
  return storageString
    ? (JSON.parse(storageString) as PartialBlock[])
    : undefined;
}

const Editor: React.FC<EditorProps> = ({ initContent, editable, noteID, noteContent }) => {

  const editor: BlockNoteEditor = useCreateBlockNote({
    initialContent: initContent ? (JSON.parse(initContent) as PartialBlock[]) : undefined,
  })

  const document: Block[] = editor.document;

  const [initialContent, setInitialContent] = useState<PartialBlock[] | undefined | "loading"
  >("loading");


  let saveTimeout: string | number | NodeJS.Timeout | undefined;

editor.onChange((editor, { getChanges }) => {
  console.log("Editor content has been changed");

  clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    saveToStorage(editor.document);
  }, 1500);
});

  useEffect(() => { // Simulates On Load Effects .
    console.log(`Loading Preset , now loading ${noteID}`);
  }, [document])

  return (
    <div className="my-4">
      <BlockNoteView editor={editor} editable={editable} theme="light" />
    </div>
  )
}

export default Editor