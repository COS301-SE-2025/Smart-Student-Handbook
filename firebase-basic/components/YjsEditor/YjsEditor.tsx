"use client";

import { useEffect, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { Block, PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

import * as Y from "yjs";
import { useYDoc, useYjsProvider } from "@y-sweet/react";
import { loadFromStorage } from "@/lib/storageFunctions"; // adjust path

interface YjsBlockNoteEditorProps {
  noteID: string;
  ownerID: string;
  username: string;
}

/**
 * Parent: fetches data first, then mounts the child that calls the hook.
 */
export function YjsBlockNoteEditor({
  noteID,
  ownerID,
  username,
}: YjsBlockNoteEditorProps) {
  const doc = useYDoc();
  const provider = useYjsProvider();

  const [initialContent, setInitialContent] = useState<PartialBlock[] | undefined | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchNote() {
      try {
        const content = await loadFromStorage(noteID, ownerID);
        if (!mounted) return;
        setInitialContent(content);
        console.log("fetched content:", content);
      } catch (err) {
        console.error("failed to load note", err);
        if (mounted) setInitialContent(undefined);
      }
    }
    fetchNote();
    return () => {
      mounted = false;
    };
  }, [noteID, ownerID]);

  useEffect(() => {
    console.log("initialContent changed:", initialContent);
  }, [initialContent]);

  if (initialContent === null || !provider) {
    return <div>Loading editor…</div>;
  }

  return (
    <EditorInner
      initialContent={initialContent}
      doc={doc}
      provider={provider}
      username={username}
    />
  );
}

function EditorInner({
  initialContent,
  doc,
  provider,
  username,
}: {
  initialContent: PartialBlock[] | undefined;
  doc: Y.Doc;
  provider: any;
  username: string;
}) {
  const editor = useCreateBlockNote({
    initialContent: initialContent,
    collaboration: {
      provider,
      fragment: doc.getXmlFragment("blocknote"),
      user: { name: username, color: "#ff0000" },
    },
  });

  if (!editor) return <div>Initializing editor…</div>;

  return (
    <div className="flex-1 bg-white px-2 py-4 rounded-lg">
      <BlockNoteView editor={editor} theme="light" />
    </div>
  );
}
