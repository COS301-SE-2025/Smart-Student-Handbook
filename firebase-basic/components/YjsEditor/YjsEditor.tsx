"use client";

import { useState, useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

import { useYDoc, useYjsProvider } from "@y-sweet/react";
import { PartialBlock } from "@blocknote/core";
import { loadFromStorage } from "@/lib/storageFunctions";
import * as Y from "yjs" ; 

interface YjsBlockNoteEditorProps {
  noteID: string;
  ownerID: string;
  username: string;
}

export function YjsBlockNoteEditor({
  noteID,
  ownerID,
  username,
}: YjsBlockNoteEditorProps) {
  const doc = useYDoc();
  const provider = useYjsProvider();

  const [initialContent, setInitialContent] = useState<
    PartialBlock[] | undefined | null
  >(null);

  const editor = useCreateBlockNote(
    provider
      ? {
          collaboration: {
            provider,
            fragment: doc.getXmlFragment("blocknote"),
            user: { name: username, color: "#ff0000" },
          },
        }
      : {}
  );

  // Load initial content from storage
  useEffect(() => {
    let mounted = true;
    async function fetchNote() {
      try {
        const content = await loadFromStorage(noteID, ownerID);
        if (mounted) {
          console.log("Fetched initial content:", content);
          setInitialContent(content);
        }
      } catch (err) {
        console.error("Failed to load note", err);
        if (mounted) setInitialContent(undefined);
      }
    }
    fetchNote();
    return () => {
      mounted = false;
    };
  }, [noteID, ownerID]);

  // Insert initial content after both provider + initial content are ready
  useEffect(() => {
    if (provider && Array.isArray(initialContent)) {
      editor.insertBlocks(initialContent, editor.getBlock("initialBlockId") as any);
      console.log("Inserted initial content:", initialContent);
    }
  }, [provider, initialContent, editor]);

  // Only show editor once both are ready
  if (!provider || initialContent === null) {
    return <div>Loading editor…</div>;
  }

  return <BlockNoteView editor={editor} />;
}
