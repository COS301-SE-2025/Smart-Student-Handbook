"use client";
import { createYjsProvider, YDocProvider } from "@y-sweet/react";
import { YjsBlockNoteEditor } from "./YjsEditor";
import { getAuth } from "firebase/auth";
import React from "react";
import Editor from "@/components/notes/Editor";

export default function Main({ searchParams }: { searchParams: { doc: string } }) {
  const docIDRef = React.useRef(searchParams.doc ?? crypto.randomUUID());
  console.log(searchParams) ; 

  return (
    <YDocProvider docId={docIDRef.current} authEndpoint="/api/auth" showDebuggerLink={false}>
      <YjsBlockNoteEditor noteID={docIDRef.current} username={"Username"} ownerID={"ZdbGGf5OcRNQOJCrb0a3LXzVAIA3"} />
    </YDocProvider>
  );
}
