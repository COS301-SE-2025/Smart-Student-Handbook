"use client";

import { useState, useEffect } from "react";
import { DefaultReactSuggestionItem, SuggestionMenuController, SuggestionMenuProps, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

import { useYDoc, useYjsProvider } from "@y-sweet/react";
import { PartialBlock, Block } from "@blocknote/core";
import { loadFromStorage, saveToStorage } from "@/lib/OrgStorageFunctions";

interface YjsBlockNoteEditorProps {
  noteID: string;
  ownerID: string;
  username: string;
}


function CustomSlashMenu(
  props: SuggestionMenuProps<DefaultReactSuggestionItem>
) {
  const filteredItems = props.items.filter(
    (item) =>
      ![
        "Image",
        "Video",
        "File",
        "Embed",
        "Audio",
        "GIF",
        "Attachment",
        "Media",
      ].includes(item.title)
  );

  return (
    <div className="bn-suggestion-menu">
      {filteredItems.map((item, index) => (
        <div
          key={item.title}
          className={`bn-suggestion-menu-item ${props.selectedIndex === index ? "selected" : ""
            }`}
          onClick={() => props.onItemClick?.(item)}
        >
          {item.title}
        </div>
      ))}
    </div>
  );
}


export function YjsBlockNoteEditor({
  noteID,
  ownerID,
  username,
}: YjsBlockNoteEditorProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(root.classList.contains("dark") ? "dark" : "light");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    setTheme(root.classList.contains("dark") ? "dark" : "light");
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
    return () => {
      mounted = false;
    };
  }, [noteID, ownerID]);

  useEffect(() => {
    if (!provider) return;

    const handleStatus = ({ status }: { status: string }) => {
      setProviderReady(status !== "connecting");
    };

    provider.on("status", handleStatus);
    return () => {
      provider.off("status", handleStatus);
    };
  }, [provider]);

  useEffect(() => {
    if (!providerReady || !editor || !Array.isArray(initialContent)) return;

    if (editor.document.length === 0) {
      editor.insertBlocks(initialContent, editor.getBlock("initialBlockId") as any);
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

  // Centered loader (same vibe as dashboard)
  if (!provider || !providerReady || initialContent === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <BlockNoteView editor={editor} theme={theme} slashMenu={false}
  >
    <SuggestionMenuController
      triggerCharacter={"/"}
      suggestionMenuComponent={CustomSlashMenu}
    />
  </BlockNoteView>;
}
