"use client"

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import dynamic from "next/dynamic"
import "react-quill-new/dist/quill.snow.css"

type ReactQuillInstance = {
  getEditor: () => any
  focus?: () => void
  blur?: () => void
}
type ReactQuillProps = {
  value: string
  // Note: react-quill's real signature is (content, delta, source, editor)
  onChange: (content: string, delta?: any, source?: any, editor?: any) => void
  readOnly?: boolean
  theme?: string
  modules?: any
  formats?: string[]
  placeholder?: string
  style?: React.CSSProperties
  className?: string
}

const ReactQuill = dynamic(async () => (await import("react-quill-new")).default, {
  ssr: false,
}) as unknown as React.ComponentType<ReactQuillProps & { ref?: React.Ref<ReactQuillInstance | null> }>

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
}

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
]

export type QuillEditorHandle = ReactQuillInstance & {
  /** Plain text snapshot from the editor */
  getPlainText: () => string
}

type QuillEditorProps = {
  value: string
  /** HTML string (unchanged from your current API) */
  onChange: (html: string) => void
  /** NEW: plain text mirror, trimmed */
  onPlainChange?: (plain: string) => void
  readOnly?: boolean
  height?: string
  placeholder?: string
}

const QuillEditor = forwardRef<QuillEditorHandle | null, QuillEditorProps>(
  function QuillEditor(
    { value, onChange, onPlainChange, readOnly = false, height = "400px", placeholder = "Start writing..." },
    ref
  ) {
    const registered = useRef(false)
    const innerRef = useRef<ReactQuillInstance | null>(null)

    // Expose getPlainText() to parents
    useImperativeHandle(ref, () => ({
      ...(innerRef.current || ({} as any)),
      getPlainText: () => {
        const ed = innerRef.current?.getEditor?.()
        return (ed?.getText?.() ?? "").trim()
      },
    }))

    // bridge internal + forwarded refs
    const setRefs = (instance: ReactQuillInstance | null) => {
      innerRef.current = instance
      if (typeof ref === "function") ref(instance as any)
      else if (ref && typeof ref === "object") (ref as any).current = instance as any
    }

    useEffect(() => {
      const registerQuillFormats = async () => {
        if (!registered.current && typeof window !== "undefined") {
          try {
            const QuillModule = await import("react-quill-new")
            const Q: any = (QuillModule as any).default?.Quill || (QuillModule as any).Quill
            if (Q && Q.import) {
              const Font = Q.import("formats/font")
              if (Font && typeof Font === "function" && Font.prototype) {
                Font.whitelist = ["sans-serif", "serif", "monospace", "roboto", "arial", "times-new-roman"]
                Q.register("formats/font", Font, true)
              }
            }
            registered.current = true
          } catch (error) {
            console.warn("Failed to register Quill formats:", error)
            registered.current = true
          }
        }
      }
      registerQuillFormats()
    }, [])

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const editorApi = innerRef.current?.getEditor?.()
        if (!editorApi) return
        const container: HTMLElement | null = editorApi.container?.querySelector?.(".ql-editor") ?? null
        if (!container) return

        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          setTimeout(() => {
            const selection = editorApi.getSelection()
            if (selection) {
              const bounds = editorApi.getBounds(selection.index)
              const containerRect = container.getBoundingClientRect()
              const boundsTop = bounds.top
              const boundsBottom = bounds.top + bounds.height

              if (boundsTop < 0) {
                container.scrollTop += boundsTop - 20
              } else if (boundsBottom > containerRect.height) {
                container.scrollTop += boundsBottom - containerRect.height + 20
              }
            }
          }, 0)
        }
      }

      const editorElement = innerRef.current?.getEditor?.()?.container as HTMLElement | undefined
      if (editorElement) {
        editorElement.addEventListener("keydown", handleKeyDown)
        return () => editorElement.removeEventListener("keydown", handleKeyDown)
      }
    }, [])

    return (
      <div className="quill-editor-wrapper h-full">
        <ReactQuill
          ref={setRefs}
          value={value}
          onChange={(content, _delta, _source, editor) => {
            // HTML to parent (unchanged)
            onChange(content)
            // Plain text mirror
            const plain = (editor?.getText?.() ?? "").trim()
            if (onPlainChange) onPlainChange(plain)
          }}
          readOnly={readOnly}
          theme="snow"
          modules={readOnly ? { toolbar: false } : modules}
          formats={formats}
          placeholder={placeholder}
          style={{ height: height === "100%" ? "100%" : height }}
          className="w-full h-full [&_.ql-container]:h-full [&_.ql-editor]:h-full [&_.ql-editor]:overflow-y-auto [&_.ql-editor]:scroll-smooth"
        />

        <style jsx global>{`
          .quill-editor-wrapper .ql-container {
            height: ${height === "100%" ? "calc(100% - 42px)" : `calc(${height} - 42px)`} !important;
          }
          .quill-editor-wrapper .ql-editor {
            height: 100% !important;
            overflow-y: auto !important;
            scroll-behavior: smooth;
            padding: 12px 15px;
            padding-bottom: 3rem !important;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
          }
          .quill-editor-wrapper .ql-editor::-webkit-scrollbar { width: 8px; }
          .quill-editor-wrapper .ql-editor::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
          .quill-editor-wrapper .ql-editor::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; transition: background-color 0.2s ease; }
          .quill-editor-wrapper .ql-editor::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
          .quill-editor-wrapper .ql-editor:focus { outline: none; }
        `}</style>
      </div>
    )
  }
)

export default QuillEditor
