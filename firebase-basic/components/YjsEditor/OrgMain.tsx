"use client";

import { YDocProvider } from "@y-sweet/react";
import { YjsBlockNoteEditor } from "./OrgYjsEditor";
import React from "react";

interface MainProps {
  searchParams: {
    doc: string;
    ownerId?: string;
    username?: string;
  };
}

export default function Main({ searchParams }: MainProps) {

  const docID = searchParams.doc ?? crypto.randomUUID();
  const ownerID = searchParams.ownerId ?? "null";
  const username = searchParams.username ?? "Username";

  return (
    <YDocProvider
      key={docID}
      docId={docID}
      authEndpoint="/api/auth"
      showDebuggerLink={false}
    >
      <YjsBlockNoteEditor
        noteID={docID}
        ownerID={ownerID}
        username={username}
      />
    </YDocProvider>
  );
}
