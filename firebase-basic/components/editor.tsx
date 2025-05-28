import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import React, { useEffect, useState } from "react";

interface EditorProps {
    content: string;
    onContentChange: (content: string) => void;
}

const Editor: React.FC<EditorProps> = ({ content, onContentChange }) => {
    const [activeTab, setActiveTab] = useState<"format" | "list" | "align">("format");

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Highlight,
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onContentChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                className: "outline-none",
            },
        },
    });

    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    if (!editor) return null;

    return (
        <div>
            <div className="toolbar mb-2">
                {["format", "list", "align"].map((tab) => (
                    <button
                        key={tab}
                        className={`px-3 py-1 rounded ${activeTab === tab ? "bg-black text-white" : "bg-gray-100"
                            }`}
                        onClick={() => setActiveTab(tab as "format" | "list" | "align")}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-1 bg-gray-100 p-2 rounded">
                {activeTab === "format" && (
                    <>
                        <button
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            className={`px-2 py-1 rounded ${editor.isActive("bold")
                                ? "bg-black text-white"
                                : "bg-white hover:bg-gray-200"
                                }`}
                        >
                            Bold
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            className={`px-2 py-1 rounded ${editor.isActive("italic")
                                ? "bg-black text-white"
                                : "bg-white hover:bg-gray-200"
                                }`}
                        >
                            Italic
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleUnderline().run()}
                            className={`px-2 py-1 rounded ${editor.isActive("underline")
                                ? "bg-black text-white"
                                : "bg-white hover:bg-gray-200"
                                }`}
                        >
                            Underline
                        </button>

                        <button
                            onClick={() => editor.chain().focus().toggleHighlight().run()}
                            className={`px-2 py-1 rounded 
                                ${editor.isActive("highlight")
                                    ? "bg-black text-white"
                                    : "bg-white hover:bg-gray-200"
                                }`
                            }
                        >
                            Highlight
                        </button>
                    </>
                )}

                {activeTab === "list" && (
                    <>
                        <button
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                            className={`px-2 py-1 rounded ${editor.isActive('bulletList') ? 'bg-black text-white' : 'bg-white hover:bg-gray-200'}`}
                        >
                            Bullet List
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleOrderedList().run()}
                            className={`px-2 py-1 rounded ${editor.isActive('orderedList') ? 'bg-black text-white' : 'bg-white hover:bg-gray-200'}`}
                        >
                            Numbered List
                        </button>
                    </>
                )}

                {activeTab === "align" && (
                    <>
                        <button
                            onClick={() => editor.chain().focus().setTextAlign("left").run()}
                            className={`px-2 py-1 rounded ${editor.isActive({ textAlign: "left" }) ? 'bg-black text-white' : 'bg-white hover:bg-gray-200'}`}
                        >
                            Left
                        </button>
                        <button
                            onClick={() => editor.chain().focus().setTextAlign("center").run()}
                            className={`px-2 py-1 rounded ${editor.isActive({ textAlign: "center" }) ? 'bg-black text-white' : 'bg-white hover:bg-gray-200'}`}
                        >
                            Center
                        </button>
                        <button
                            onClick={() => editor.chain().focus().setTextAlign("right").run()}
                            className={`px-2 py-1 rounded ${editor.isActive({ textAlign: "right" }) ? 'bg-black text-white' : 'bg-white hover:bg-gray-200'}`}
                        >
                            Right
                        </button>
                    </>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <EditorContent editor={editor} />
            </div>
        </div >
    );
};

export default Editor;
