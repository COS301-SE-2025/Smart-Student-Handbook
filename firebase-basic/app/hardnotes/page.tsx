"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    ChevronDown,
    ChevronRight,
    FileText,
    FolderIcon,
    Trash2,
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";

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
    // Initial tree data
    const [tree, setTree] = useState<FileNode[]>([
        {
            id: "folder1",
            name: "Folder 1",
            type: "folder",
            expanded: true,
            children: [
                {
                    id: "note1",
                    name: "Note 1",
                    content: "Content for Note 1",
                    type: "note",
                },
                {
                    id: "folder2",
                    name: "Folder 2",
                    type: "folder",
                    expanded: false,
                    children: [],
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

    // Helper: toggle folder expanded state
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

    // Helper: update folder name
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

    // Helper: update note content or name
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

        // Also update selectedNote if editing currently selected one
        if (selectedNote && selectedNote.id === id) {
            setSelectedNote({ ...selectedNote, [field]: value });
        }
    };


    // Select note to edit
    const handleSelectNote = (note: Note) => {
        setSelectedNote(note);
        setSelectedFolderId(null);
    };

    // Add folder inside selected folder or root
    const addFolder = () => {
        const newFolder: Folder = {
            id: generateId(),
            name: "New Folder",
            type: "folder",
            expanded: false,
            children: [],
        };

        if (selectedFolderId) {
            // Add inside selected folder
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
            // Add to root
            setTree((prev) => [...prev, newFolder]);
        }
    };

    // Add note inside selected folder or root
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

    // Helper: remove a node (folder or note) by id (recursive)
    const removeNodeById = (nodes: FileNode[], id: string): FileNode[] =>
        nodes
            .filter((node) => node.id !== id)
            .map((node) =>
                node.type === "folder"
                    ? { ...node, children: removeNodeById(node.children, id) }
                    : node
            );

    // Render tree recursively with delete buttons and inline rename
    const renderTree = (nodes: FileNode[], depth = 0) =>
        nodes.map((node) => {
            if (node.type === "folder") {
                const isSelected = selectedFolderId === node.id;
                return (
                    <SidebarProvider>
                        <main className="">

                            <div key={node.id} style={{ marginLeft: depth * 12 }}>
                                {/* Folder row: flex horizontal */}
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

                                    {/* Delete button */}
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

                                {/* Children rendered BELOW the folder row, vertically stacked */}
                                {node.expanded && <div>{renderTree(node.children, depth + 1)}</div>}
                            </div>

                        </main>

                    </SidebarProvider>

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
            {/* Sidebar */}
            <div
                className="w-64 border-r border-muted overflow-y-auto"
                style={{ maxHeight: 'calc(100vh - 96px)' }} // Give room for header/buttons if any
            >

                <div className="flex gap-2 p-2">
                    <Button onClick={addFolder} size="sm">
                        Add Folder
                    </Button>
                    <Button onClick={addNote} size="sm">
                        Add Note
                    </Button>
                </div>

                <div className="p-2">{renderTree(tree)}</div>
            </div>

            {/* Main content */}
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
                        <textarea
                            value={selectedNote.content}
                            onChange={(e) =>
                                handleNoteChange(selectedNote.id, "content", e.target.value)
                            }
                            rows={20}
                            className="w-full p-2 border border-muted rounded resize-none focus:outline-none focus:border-primary"
                            placeholder="Write your note here..."
                        />
                    </>
                ) : (
                    <p className="text-muted-foreground">Select a note to view or edit</p>
                )}
            </div>
        </div>
    );
}