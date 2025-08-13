"use client";

import { YDocProvider } from "@y-sweet/react";
import { YjsBlockNoteEditor } from "./YjsEditor";
import React from "react";

export default function Main({ searchParams }: { searchParams: { doc: string } }) {
  // Use the searchParams directly, fallback to random UUID
  const docID = searchParams.doc ?? crypto.randomUUID();

  console.log("Current docID:", docID);

  return (
    <YDocProvider
      key={docID}
      docId={docID}
      authEndpoint="/api/auth"
      showDebuggerLink={false}
    >
      <YjsBlockNoteEditor
        noteID={docID}
        username="Username"
        ownerID="ZdbGGf5OcRNQOJCrb0a3LXzVAIA3"
      />
    </YDocProvider>
  );
}
