"use client";
import { createYjsProvider, YDocProvider } from "@y-sweet/react";
import { YjsBlockNoteEditor } from "./YjsEditor";
import { getAuth } from "firebase/auth";
import { saveToStorage, loadFromStorage } from "@/lib/storageFunctions";

export default function Main({ searchParams }: { searchParams: { doc: string } }) {
  const docID = searchParams.doc ?? crypto.randomUUID();

  console.log( "Search Parameters : " , searchParams) ; 

  return (
    <YDocProvider docId={docID} authEndpoint="/api/auth" showDebuggerLink={false}>
      <YjsBlockNoteEditor noteID={docID} username={"Username"} />
    </YDocProvider> 
  );
}
