"use client";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { saveToStorage, loadFromStorage } from "@/lib/storageFunctions";

import { useYDoc, useYjsProvider } from '@y-sweet/react'
import { useEffect, useMemo, useState } from "react";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";

import * as Y from "yjs" ;
import {WebrtcProvider} from "y-webrtc"

interface YjsBlockNoteEditorProps {
  noteID: string;
  username: string;
}

export function YjsBlockNoteEditor({ noteID, username }: YjsBlockNoteEditorProps) {
  const [initialContent, setInitialContent] = useState<PartialBlock[] | undefined | "loading"
  >("loading");

  const doc = useYDoc(); 
  const provider = useYjsProvider();

  const editor = useCreateBlockNote({
    collaboration: {
      provider,
      fragment: doc.getXmlFragment("blocknote"),
      user: { name: "Your Username", color: "#ff0000" },
    },
  });

  return (
    <div className="flex-1  bg-white px-2 py-4 rounded-lg">
      <BlockNoteView editor={editor} theme="light" />
    </div>
  )
}