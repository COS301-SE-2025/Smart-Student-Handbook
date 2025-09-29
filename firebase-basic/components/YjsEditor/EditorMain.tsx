"use client"

import { YDocProvider } from "@y-sweet/react"
import { YjsBlockNoteEditor } from "./YjsEditor"
import React from "react"

interface MainProps {
  searchParams: {
    doc: string
    ownerId?: string
    username?: string
  }
}

export default function Main({ searchParams }: MainProps) {
  const docID = searchParams.doc ?? crypto.randomUUID()
  // ⬇️ Do NOT default to string "null"; use empty string so we don't hit users/null/...
  const ownerID = searchParams.ownerId || ""
  const username = searchParams.username ?? "Username"

  return (
    <YDocProvider
      // ⬇️ re-mount provider whenever either owner or doc changes (prevents stale rooms)
      key={`${ownerID}:${docID}`}
      docId={docID}
      authEndpoint="/api/auth"
      showDebuggerLink={false}
    >
      <YjsBlockNoteEditor noteID={docID} ownerID={ownerID} username={username} />
    </YDocProvider>
  )
}
