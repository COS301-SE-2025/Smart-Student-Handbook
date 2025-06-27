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
  readOnly = false,
}: {
  value: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
}) {
  const registered = useRef(false);

  useEffect(() => {
    if (!registered.current) {
      const Quill = require("react-quill-new");

      const Font = Quill.Quill.import("formats/font");
      Font.whitelist = [
        "sans-serif",
        "serif",
        "monospace",
        "roboto",
        "arial",
        "times-new-roman",
      ];
      Quill.Quill.register(Font, true);

      const List = Quill.Quill.import("formats/list");
      Quill.Quill.register(List, true);

      registered.current = true;
    }
  }, []);

  return (
    <ReactQuill
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      theme="snow"
      modules={readOnly ? { toolbar: false } : modules}
      formats={formats}
      className="w-full [&_.ql-container]:max-h-[600px] [&_.ql-container]:overflow-y-auto"
    />
  );
}
