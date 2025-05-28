// components/QuillEditor.tsx
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

export default function QuillEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="editor-content border p-4 rounded bg-white shadow-sm h-[400px] overflow-y-auto">
      <ReactQuill
        value={value}
        onChange={onChange}
        theme="snow"
        className="h-full"
      />
    </div>
  );
}
