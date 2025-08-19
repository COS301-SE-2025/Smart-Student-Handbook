"use client";

import { useState, useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

import { useYDoc, useYjsProvider } from "@y-sweet/react";
import { PartialBlock, Block } from "@blocknote/core";
import { loadFromStorage, saveToStorage } from "@/lib/storageFunctions";

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


  const doc = useYDoc();
  const provider: any = useYjsProvider();

  const [initialContent, setInitialContent] = useState<PartialBlock[] | null>(null);
  const [providerReady, setProviderReady] = useState(false);

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

  // Load initial content from storage
  useEffect(() => {
    let mounted = true;
    setInitialContent(null);

    async function fetchNote() {
      try {
        const content = await loadFromStorage(noteID, ownerID);
        if (mounted) setInitialContent(content as any);
      } catch (err) {
        console.error("Failed to load note", err);
        if (mounted) setInitialContent(undefined as any);
      }
    }

    fetchNote();
    return () => { mounted = false; };
  }, [noteID, ownerID]);

  // Track provider status
  useEffect(() => {
    if (!provider) return;

    const handleStatus = ({ status }: { status: string }) => {
      setProviderReady(status !== "connecting");
    };

    provider.on("status", handleStatus);
    return () => { provider.off("status", handleStatus); };
  }, [provider]);

  // Insert initial content once provider is ready
  useEffect(() => {
    if (!providerReady || !editor || !Array.isArray(initialContent)) return;

    if (editor.document.length === 0) {
      editor.insertBlocks(initialContent, editor.getBlock("initialBlockId") as any);
      console.log("Inserted initial content after provider ready:", initialContent);
    }
  }, [providerReady, initialContent, editor]);

  // Auto-save every 5 seconds
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

  return <BlockNoteView editor={editor} theme={theme} />;
}
