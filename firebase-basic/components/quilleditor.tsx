"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ script: "sub" }, { script: "super" }],
    [{ indent: "-1" }, { indent: "+1" }],
    [{ align: [] }],
    ["blockquote", "code-block"],
    ["link", "image", "video"],
    ["clean"],
  ],
};

const formats = [
  "header",
  "font",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "list",
  "indent",
  "script",
  "align",
  "blockquote",
  "code-block",
  "link",
  "image",
  "video",
];

export default function QuillEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [editor, setEditor] = useState<any>(null);

  // When ReactQuill calls onFocus, grab the editor instance
  const handleFocus = (range: any, source: any, editorInstance: any) => {
    setEditor(editorInstance);
  };

  // Sync editor content when `value` changes
  useEffect(() => {
    if (!editor || !editor.root) return; // <-- ADD THIS CHECK

    if (value !== editor.root.innerHTML) {
      editor.root.innerHTML = value;
    }
  }, [value, editor]);

  return (
    <ReactQuill
      value={value}
      onChange={onChange}
      onFocus={handleFocus} // gets editor instance on first focus
      theme="snow"
      modules={modules}
      formats={formats}
      className="h-full [&_.ql-container]:h-full [&_.ql-editor]:h-full [&_.ql-editor]:overflow-y-auto"
    />
  );
}
