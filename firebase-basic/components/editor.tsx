import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import React, { useEffect } from "react";

interface EditorProps {
    content: string;
    onContentChange: (content: string) => void;
}

const Editor: React.FC<EditorProps> = ({ content, onContentChange }) => {
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
                class: "outline-none list-disc list-decimal list-inside",
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
        <div className="space-y-2">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-1 bg-gray-100 p-2 rounded">
                <button onClick={() => editor.chain().focus().toggleBold().run()} className="px-2 py-1 bg-white rounded hover:bg-gray-200">Bold</button>
                <button onClick={() => editor.chain().focus().toggleItalic().run()} className="px-2 py-1 bg-white rounded hover:bg-gray-200">Italic</button>
                <button onClick={() => editor.chain().focus().toggleUnderline().run()} className="px-2 py-1 bg-white rounded hover:bg-gray-200">Underline</button>
                <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className="px-2 py-1 bg-white rounded hover:bg-gray-200">H1</button>
                <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="px-2 py-1 bg-white rounded hover:bg-gray-200">H2</button>
                <button onClick={() => editor.chain().focus().toggleBulletList().run()} className="px-2 py-1 bg-white rounded hover:bg-gray-200">Bullet List</button>
                <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className="px-2 py-1 bg-white rounded hover:bg-gray-200">Numbered List</button>
                <button onClick={() => editor.chain().focus().toggleHighlight().run()} className="px-2 py-1 bg-white rounded hover:bg-gray-200">Highlight</button>
                <button onClick={() => editor.chain().focus().setTextAlign("left").run()} className="px-2 py-1 bg-white rounded hover:bg-gray-200">Left</button>
                <button onClick={() => editor.chain().focus().setTextAlign("center").run()} className="px-2 py-1 bg-white rounded hover:bg-gray-200">Center</button>
                <button onClick={() => editor.chain().focus().setTextAlign("right").run()} className="px-2 py-1 bg-white rounded hover:bg-gray-200">Right</button>
            </div>
            <div className="border p-4 rounded bg-white shadow-sm min-h-[200px]">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

export default Editor;