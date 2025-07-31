"use client";
import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import React, { useEffect } from "react";
import { Block, BlockNoteEditor, PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css"
import "@blocknote/react/style.css"

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { doc } from "@firebase/firestore";

interface EditorProps {
  onChange: (newContent: string) => void;
  initContent?: string;
  editable?: boolean;
  noteID?: string
  noteContent?: string
}

const Editor: React.FC<EditorProps> = ({ onChange, initContent, editable, noteID, noteContent }) => {
  const editor: BlockNoteEditor = useCreateBlockNote({
    initialContent: initContent ? (JSON.parse(initContent) as PartialBlock[]) : undefined,

  })

  const document: Block[] = editor.document;

  const Editor = useMemo(
    () => dynamic(() => import('@/components/notes/Editor'), { ssr: false }),
    []
  )

  useEffect(() => {
    console.log("File Was Changed " + noteContent + " NoteID " + noteID);
    const Block = editor.getBlock(document[0]);

    if (Block)
      editor.updateBlock(Block, { 
    content: noteContent ,
    props: {level : 2} ,  
  });
  console.log(document) ; 

  }, [document])

  return (
    <div className="my-4">
      <BlockNoteView editor={editor} editable={editable} theme="light" onChange={onChange} />
    </div>
  )
}

export default Editor