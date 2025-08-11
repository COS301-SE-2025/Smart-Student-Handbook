"use client";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";

import YPartyKitProvider from "y-partykit/provider";
import * as Y from "yjs";

interface YjsBlockNoteEditorProps {
  roomName: string;
  userName: string;
}

export default function YjsBlockNoteEditor({
  roomName,
  userName,
}: YjsBlockNoteEditorProps) {
  const doc = new Y.Doc();
  const provider = new YPartyKitProvider(
    "blocknote-dev.yousefed.partykit.dev",
    roomName,
    doc
  );

  const editor = useCreateBlockNote({
    collaboration: {
      provider,
      fragment: doc.getXmlFragment("document-store"),
      user: {
        name: userName,
        color: "#ff0000",
      },

      showCursorLabels: 'activity'
    },
  });

  return <BlockNoteView editor={editor} />;
}