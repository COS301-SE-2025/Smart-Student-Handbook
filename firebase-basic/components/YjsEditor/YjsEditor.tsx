"use client";

import { useState, useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView, darkDefaultTheme, lightDefaultTheme, Theme } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

import { useYDoc, useYjsProvider } from "@y-sweet/react";
import { PartialBlock, Block } from "@blocknote/core";
import { loadFromStorage, saveToStorage } from "@/lib/storageFunctions";
import { Note } from "@/types/note";
import { fetchNoteById, fetchNoteWithOwner } from "@/lib/note/treeActions";
import { ref, set } from "@firebase/database";
import { db } from "@/lib";

import "./styles.css";

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
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(root.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    setTheme(root.classList.contains('dark') ? 'dark' : 'light');
    return () => observer.disconnect();
  }, []);

  const lightRedTheme = {
    colors: {
      editor: {
        text: "#222222",
        background: "blue",
      },
      menu: {
        text: "#751346",
        background: "#9b0000",
      },
      tooltip: {
        text: "#ffffff",
        background: "#b00000",
      },
      hovered: {
        text: "#ffffff",
        background: "#b00000",
      },
      selected: {
        text: "#ffffff",
        background: "#c50000",
      },
      disabled: {
        text: "#9b0000",
        background: "#7d0000",
      },
      shadow: "#640000",
      border: "#870000",
      sideMenu: "#bababa",
      highlights: lightDefaultTheme.colors!.highlights,
    },
    borderRadius: 4,
    fontFamily: "Helvetica Neue, sans-serif",
  } satisfies Theme;

  const darkRedTheme = {
    ...lightRedTheme,
    colors: {
      ...lightRedTheme.colors,
      editor: {
        text: "#ffffff",
        background: "green",
      },
      sideMenu: "#ffffff",
      highlights: darkDefaultTheme.colors!.highlights,
    },
  } satisfies Theme;

  const redTheme = {
    light: lightRedTheme,
    dark: darkRedTheme,
  };

  const doc = useYDoc();
  const provider: any = useYjsProvider();

  const [initialContent, setInitialContent] = useState<PartialBlock[] | null>(null);
  const [providerReady, setProviderReady] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const [noteName, setNoteName] = useState(selectedNote?.name ?? "");

  useEffect(() => {
    setNoteName(selectedNote?.name ?? "");
  }, [selectedNote]);

  async function handleNameUpdate(newName: string) {
    if (!selectedNote?.id) return;
    const noteRef = ref(db, `users/${ownerID}/notes/${selectedNote.id}/name`);
    await set(noteRef, newName);
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
      : {}
  );

  useEffect(() => {
    let mounted = true;
    setInitialContent(null);

    async function fetchNote() {
      try {
        const content = await loadFromStorage(noteID, ownerID);
        const note = await fetchNoteWithOwner(noteID, ownerID);
        setSelectedNote(note);

        if (mounted) setInitialContent(content as any);
      } catch (err) {
        console.error("Failed to load note", err);
        if (mounted) setInitialContent(undefined as any);
      }
    }

    fetchNote();
    return () => { mounted = false; };
  }, [noteID, ownerID]);

  useEffect(() => {
    if (!provider) return;

    const handleStatus = ({ status }: { status: string }) => {
      setProviderReady(status !== "connecting");
    };

    provider.on("status", handleStatus);
    return () => { provider.off("status", handleStatus); };
  }, [provider]);

  useEffect(() => {
    if (!providerReady || !editor || !Array.isArray(initialContent)) return;

    if (editor.document.length === 0) {
      editor.insertBlocks(initialContent, editor.getBlock("initialBlockId") as any);
      console.log("Inserted initial content after provider ready:", initialContent);
    }
  }, [providerReady, initialContent, editor]);

  useEffect(() => {
    if (!editor) return;

    const interval = setInterval(() => {
      try {
        const currentBlocks: Block[] = editor.document;
        saveToStorage(noteID, currentBlocks, ownerID);
      } catch (err) {
        console.error("Failed to save note:", err);
      }
    }, 5000); // every 5 seconds

    return () => clearInterval(interval);
  }, [editor, noteID, ownerID]);

  if (!provider || !providerReady || initialContent === null) {
    return <div>Loading editor…</div>;
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
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="border-b-4 text-2xl font-bold text-left 
                   text-gray-900 dark:text-gray-100 pb-4 pl-12 bg-transparent outline-none w-full"
        />
      </div>

      <div className="flex-1 overflow-auto h-[calc(100vh-16px)]">
        <BlockNoteView editor={editor} data-theming-css-variables-demo />
      </div>
    </div>
  );
}