"use client"

import { useState, useEffect } from "react"
import { useCreateBlockNote } from "@blocknote/react"
import { BlockNoteView } from "@blocknote/mantine"
import "@blocknote/mantine/style.css"

import { useYDoc, useYjsProvider } from "@y-sweet/react"
import { PartialBlock, Block } from "@blocknote/core"
import { loadFromStorage, saveToStorage } from "@/lib/storageFunctions"
import { Note } from "@/types/note"
import { fetchNoteWithOwner } from "@/lib/note/treeActions"
import { ref, set } from "@firebase/database"
import { db } from "@/lib"

import "./styles.css"

interface YjsBlockNoteEditorProps {
  noteID: string
  ownerID: string
  username: string
}

export function YjsBlockNoteEditor({ noteID, ownerID, username }: YjsBlockNoteEditorProps) {
  const doc = useYDoc()
  const provider: any = useYjsProvider()

  const [initialContent, setInitialContent] = useState<PartialBlock[] | null>(null)
  const [providerReady, setProviderReady] = useState(false)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)

  const [noteName, setNoteName] = useState(selectedNote?.name ?? "")
  useEffect(() => setNoteName(selectedNote?.name ?? ""), [selectedNote])

  async function handleNameUpdate(newName: string) {
    if (!selectedNote?.id || !ownerID) return
    const noteRef = ref(db, `users/${ownerID}/notes/${selectedNote.id}/name`)
    await set(noteRef, newName)
  }

  const editor = useCreateBlockNote(
    provider
      ? {
          collaboration: {
            provider,
            fragment: doc.getXmlFragment("blocknote"),
            user: { name: username, color: "#005ac2ff" },
          },
        }
      : {},
  )

  // Load initial content (guard missing ownerID)
  useEffect(() => {
    let mounted = true
    setInitialContent(null)

    async function fetchNote() {
      try {
        if (!ownerID) {
          // Guard: render empty doc and skip fetch until ownerID arrives
          setSelectedNote(null)
          if (mounted) setInitialContent([] as any)
          return
        }
        const content = await loadFromStorage(noteID, ownerID)
        const note = await fetchNoteWithOwner(noteID, ownerID)
        setSelectedNote(note)
        if (mounted) setInitialContent((content as any) ?? ([] as any))
      } catch (err) {
        console.error("Failed to load note", err)
        if (mounted) setInitialContent([] as any) // fall back to empty
      }
    }

    fetchNote()
    return () => {
      mounted = false
    }
  }, [noteID, ownerID])

  // Wait for provider connection
  useEffect(() => {
    if (!provider) return
    const handleStatus = ({ status }: { status: string }) => setProviderReady(status !== "connecting")
    provider.on("status", handleStatus)
    return () => {
      provider.off("status", handleStatus)
    }
  }, [provider])

  // Insert initial content once provider is ready and editor is empty
  useEffect(() => {
    if (!providerReady || !editor || !Array.isArray(initialContent)) return
    if (editor.document.length === 0) {
      editor.insertBlocks(initialContent, editor.getBlock("initialBlockId") as any);
    }
  }, [providerReady, initialContent, editor])

  // Periodic autosave
  useEffect(() => {
    if (!editor || !ownerID) return
    const interval = setInterval(() => {
      try {
        const currentBlocks: Block[] = editor.document
        saveToStorage(noteID, currentBlocks, ownerID)
      } catch (err) {
        console.error("Failed to save note:", err)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [editor, noteID, ownerID])

  if (!provider || !providerReady || initialContent === null) {
    return <div />
  }

  return (
    <div>
      <div>
        <input
          type="text"
          value={noteName}
          onChange={(e) => setNoteName(e.target.value)}
          onBlur={() => handleNameUpdate(noteName)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
          }}
          className="border-b-4 text-2xl font-bold text-left 
                   text-gray-900 dark:text-gray-100 pb-4 pl-12 bg-transparent outline-none w-full"
        />
      </div>

      <div className="flex-1 overflow-auto h-[calc(100vh-16px)]">
        <BlockNoteView editor={editor} data-theming-css-variables-demo />
      </div>
    </div>
  )
}
