"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    ChevronDown,
    ChevronRight,
    FileText,
    FolderIcon,
    Trash2,
} from "lucide-react";

import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";

import QuillEditor from "@/components/quilleditor";
import { useRouter } from "next/router";

type EditorProps = {
    content: string;
    onContentChange: (content: string) => void;
};
import Link from "next/link";
const toolbarOptions = [
    ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
    ['blockquote', 'code-block'],

    [{ header: 1 }, { header: 2 }],                   // custom button values
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ script: 'sub' }, { script: 'super' }],         // superscript/subscript
    [{ indent: '-1' }, { indent: '+1' }],             // outdent/indent
    [{ direction: 'rtl' }],                            // text direction

    [{ size: ['small', false, 'large', 'huge'] }],    // custom dropdown
    [{ header: [1, 2, 3, 4, 5, 6, false] }],

    [{ color: [] }, { background: [] }],              // dropdown with defaults from theme
    [{ font: [] }],
    [{ align: [] }],

    ['clean'],                                        // remove formatting button
];

const modules = {
    toolbar: toolbarOptions,
};

type Note = {
    id: string;
    name: string;
    content: string;
    type: "note";
};

type Folder = {
    id: string;
    name: string;
    type: "folder";
    expanded: boolean;
    children: FileNode[];
};

type FileNode = Note | Folder;

const generateId = () => Math.random().toString(36).slice(2, 9);

export default function NotePage() {
    const [tree, setTree] = useState<FileNode[]>([
        {
            id: "folder1",
            name: "Folder 1",
            type: "folder",
            expanded: true,
            children: [
                {
                    id: "folder2",
                    name: "Folder 2",
                    type: "folder",
                    expanded: false,
                    children: [],
                }, {
                    id: "note1",
                    name: "Note 1",
                    content: "Content for Note 1",
                    type: "note",
                },
            ],
        },
        {
            id: "note2",
            name: "Note 2",
            content: "Content for Note 2",
            type: "note",
        },
    ]);

    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
        "folder1"
    );
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);

    useEffect(() => {
        const savedTree = localStorage.getItem("noteTree");
        if (savedTree) {
            try {
                setTree(JSON.parse(savedTree));
            } catch {
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("noteTree", JSON.stringify(tree));
    }, [tree]);

    useEffect(() => {
        const savedSelectedFolderId = localStorage.getItem("selectedFolderId");
        const savedSelectedNote = localStorage.getItem("selectedNote");
        if (savedSelectedFolderId) setSelectedFolderId(savedSelectedFolderId);
        if (savedSelectedNote) {
            try {
                setSelectedNote(JSON.parse(savedSelectedNote));
            } catch { }
        }
    }, []);

    useEffect(() => {
        if (selectedFolderId) {
            localStorage.setItem("selectedFolderId", selectedFolderId);
        } else {
            localStorage.removeItem("selectedFolderId");
        }
    }, [selectedFolderId]);

    useEffect(() => {
        if (selectedNote) {
            localStorage.setItem("selectedNote", JSON.stringify(selectedNote));
        } else {
            localStorage.removeItem("selectedNote");
        }
    }, [selectedNote]);

    const toggleExpand = (folder: Folder) => {
        const toggle = (nodes: FileNode[]): FileNode[] =>
            nodes.map((node) => {
                if (node.type === "folder") {
                    if (node.id === folder.id) {
                        return { ...node, expanded: !node.expanded };
                    }
                    return { ...node, children: toggle(node.children) };
                }
                return node;
            });
        setTree((prev) => toggle(prev));
    };

    const handleFolderNameChange = (id: string, newName: string) => {
        const updateName = (nodes: FileNode[]): FileNode[] =>
            nodes.map((node) => {
                if (node.type === "folder") {
                    if (node.id === id) {
                        return { ...node, name: newName };
                    }
                    return { ...node, children: updateName(node.children) };
                }
                return node;
            });
        setTree((prev) => updateName(prev));
    };

    const handleNoteChange = (
        id: string,
        field: "content" | "name",
        value: string
    ) => {
        const updateNote = (nodes: FileNode[]): FileNode[] =>
            nodes.map((node) => {
                if (node.type === "note" && node.id === id) {
                    return { ...node, [field]: value };
                } else if (node.type === "folder") {
                    return { ...node, children: updateNote(node.children) };
                }
                return node;
            });

        setTree((prev) => updateNote(prev));

        if (selectedNote && selectedNote.id === id) {
            setSelectedNote({ ...selectedNote, [field]: value });
        }
    };

    const handleSelectNote = (note: Note) => {
        setSelectedNote(note);
        setSelectedFolderId(null);
    };

    const addFolder = () => {
        const newFolder: Folder = {
            id: generateId(),
            name: "New Folder",
            type: "folder",
            expanded: false,
            children: [],
        };

        if (selectedFolderId) {
            const addToFolder = (nodes: FileNode[]): FileNode[] =>
                nodes.map((node) => {
                    if (node.type === "folder") {
                        if (node.id === selectedFolderId) {
                            return { ...node, children: [...node.children, newFolder] };
                        }
                        return { ...node, children: addToFolder(node.children) };
                    }
                    return node;
                });
            setTree((prev) => addToFolder(prev));
        } else {
            setTree((prev) => [...prev, newFolder]);
        }
    };

    const addNote = () => {
        const newNote: Note = {
            id: generateId(),
            name: "New Note",
            content: "",
            type: "note",
        };

        if (selectedFolderId) {
            const addToFolder = (nodes: FileNode[]): FileNode[] =>
                nodes.map((node) => {
                    if (node.type === "folder") {
                        if (node.id === selectedFolderId) {
                            return { ...node, children: [...node.children, newNote] };
                        }
                        return { ...node, children: addToFolder(node.children) };
                    }
                    return node;
                });
            setTree((prev) => addToFolder(prev));
        } else {
            setTree((prev) => [...prev, newNote]);
        }
    };

    const removeNodeById = (nodes: FileNode[], id: string): FileNode[] =>
        nodes
            .filter((node) => node.id !== id)
            .map((node) =>
                node.type === "folder"
                    ? { ...node, children: removeNodeById(node.children, id) }
                    : node
            );

    const renderTree = (nodes: FileNode[], depth = 0) =>
        nodes.map((node) => {
            if (node.type === "folder") {
                const isSelected = selectedFolderId === node.id;
                return (
                    <div key={node.id} style={{ marginLeft: depth * 12 }}>
                        <div className="flex items-center py-0.5">
                            <Button
                                variant="ghost"
                                className="flex-grow justify-start text-sm py-0.5"
                                onClick={() => {
                                    toggleExpand(node);
                                    setSelectedFolderId(node.id);
                                    setSelectedNote(null);
                                }}
                            >
                                {node.expanded ? (
                                    <ChevronDown className="mr-2" />
                                ) : (
                                    <ChevronRight className="mr-2" />
                                )}
                                <FolderIcon className="mr-2" size={16} />
                                {isSelected ? (
                                    <input
                                        type="text"
                                        value={node.name}
                                        onChange={(e) => handleFolderNameChange(node.id, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-transparent border-b border-muted focus:outline-none focus:border-primary w-full max-w-xs"
                                    />
                                ) : (
                                    node.name
                                )}
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                className="ml-1 text-red-600 hover:text-red-800 p-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Delete folder "${node.name}" and all its contents?`)) {
                                        setTree((prev) => {
                                            const newTree = removeNodeById(prev, node.id);
                                            if (selectedFolderId === node.id) setSelectedFolderId(null);
                                            if (selectedNote?.id === node.id) setSelectedNote(null);
                                            return newTree;
                                        });
                                    }
                                }}
                                aria-label={`Delete folder ${node.name}`}
                            >
                                <Trash2 size={12} />
                            </Button>
                        </div>

                        {node.expanded && <div>{renderTree(node.children, depth + 1)}</div>}
                    </div>

                );

            } else {
                return (
                    <div
                        key={node.id}
                        style={{ marginLeft: depth * 16 }}
                        className="flex items-center"
                    >
                        <Button
                            variant={selectedNote?.id === node.id ? "secondary" : "ghost"}
                            className="flex-grow justify-start pl-8"
                            onClick={() => handleSelectNote(node)}
                        >
                            <FileText className="mr-2" size={16} />
                            {node.name}
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete note "${node.name}"?`)) {
                                    setTree((prev) => {
                                        const newTree = removeNodeById(prev, node.id);
                                        if (selectedNote?.id === node.id) setSelectedNote(null);
                                        return newTree;
                                    });
                                }
                            }}
                            className="ml-1 text-red-600 hover:text-red-800"
                            aria-label={`Delete note ${node.name}`}
                        >
                            <Trash2 size={14} />
                        </Button>
                    </div>
                );
            }
        });

    return (
        <div className="flex h-screen p-6 gap-6">
            <div
                className="w-64 border-r border-muted overflow-y-auto"
                style={{ maxHeight: 'calc(100vh - 96px)' }}
            >

                <div className="flex gap-2 p-2">
                    <Link href="/dashboard" className="btn btn-primary">
                        Back
                    </Link>

                    <Button onClick={addFolder} size="sm">
                        Add Folder
                    </Button>
                    <Button onClick={addNote} size="sm">
                        Add Note
                    </Button>
                </div>

                <div className="p-2">{renderTree(tree)}</div>
            </div>
            <div className="flex-1 flex flex-col p-4">
                {selectedNote ? (
                    <>
                        <input
                            type="text"
                            value={selectedNote.name}
                            onChange={(e) =>
                                handleNoteChange(selectedNote.id, "name", e.target.value)
                            }
                            placeholder="Note Title"
                            className="text-2xl font-bold mb-4 border-b border-muted focus:outline-none focus:border-primary"
                        />
                        <QuillEditor
                            key={selectedNote.id}
                            value={selectedNote.content}
                            onChange={(newContent) => handleNoteChange(selectedNote.id, "content", newContent)}
                        />
                    </>
                ) : (
                    <p className="text-muted-foreground">Select a note to view or edit</p>
                )}
            </div>
        </div>
    );
}