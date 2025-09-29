"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

const QuillEditor = dynamic(() => import("@/components/quilleditor"), {
  ssr: false,
});


import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";
import { auth } from "firebase-admin";
import { summarizeNote } from "@/lib/gemini";

const functions = getFunctions(app);

const callCreateNote = httpsCallable(functions, "createNoteAtPath");
const callDeleteNote = httpsCallable(functions, "deleteNoteAtPath");

export async function callUpdateNote(path: string, note: Partial<Note>) {
  const fn = httpsCallable(functions, "updateNoteAtPath");
  await fn({ path, note });
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

const createNote = async (orgId: string, userId: string): Promise<Note> => {
  const id = generateId();

  const newNote: Note = {
    ownerId: userId,
    id,
    name: "Untitled Note",
    content: "",
    type: "note",
  };

  const path = `organizations/${orgId}/notes/${id}`;
  await callCreateNote({ path, note: newNote });
  return newNote;
};

const deleteNote = async (orgId: string, noteId: string): Promise<void> => {
  const path = `organizations/${orgId}/notes/${noteId}`;

  await callDeleteNote({ path });
};

type Note = {
  ownerId: string;
  id: string;
  name: string;
  content: string;
  type: "note";
};

type NotesSplitViewProps = {
  notes: Note[];
  orgID: any;
};

export default function NotesSplitView({ notes, orgID }: NotesSplitViewProps) {
  const [stateNotes, setStateNotes] = useState<Note[]>(notes);

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    stateNotes[0]?.id ?? null
  );

  const selectedNote = stateNotes.find((n) => n.id === selectedNoteId);
  const editableNote = selectedNote ? { ...selectedNote } : null;

  const orgId = orgID;
  const userId = "user987";

  useEffect(() => {
    setStateNotes(notes);
  }, [notes]);

  useEffect(() => {
    if (!selectedNote?.id) return;

    const timeout = setTimeout(() => {
      const path = `organizations/${orgId}/notes/${selectedNote.id}`;
      callUpdateNote(path, {
        content: selectedNote.content,
        name: selectedNote.name,
      });
    }, 1000);

    return () => clearTimeout(timeout);
  }, [selectedNote?.id, selectedNote?.content, selectedNote?.name]);

  const handleCreate = async () => {
    const newNote = await createNote(orgId, userId);
    setStateNotes((prev: any) => [newNote, ...prev]);
    setSelectedNoteId(newNote.id);
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    await deleteNote(orgId, noteId);
    setStateNotes((prev: any[]) =>
      prev.filter((n: { id: string }) => n.id !== noteId)
    );

    if (selectedNoteId === noteId) setSelectedNoteId(null);
  };

  const handleNoteChange = (noteId: string, updatedFields: Partial<Note>) => {
    setStateNotes((prevNotes) =>
      prevNotes.map((note) =>
        note.id === noteId ? { ...note, ...updatedFields } : note
      )
    );
  };

  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const handleSummarize = async () => {
    if (!selectedNote?.content) return;


    setLoadingSummary(true);
    const result = await summarizeNote(selectedNote.content);
    setSummary(result);
    setLoadingSummary(false);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] p-4 gap-4">
      <div className="flex-[2] border rounded-xl p-4 bg-white dark:bg-neutral-900 shadow overflow-hidden">
        {selectedNote ? (
          <>
            <div className="flex justify-between items-center mb-3">
              <input
                className="text-xl font-semibold bg-transparent border-none focus:outline-none w-full truncate"
                value={selectedNote.name}
                onChange={(e) =>
                  handleNoteChange(selectedNote.id, { name: e.target.value })
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedNoteId(null)}
              >
                Deselect
              </Button>
            </div>

            <div className="h-[calc(100%-3rem)] overflow-y-auto">
              <QuillEditor
                key={selectedNote.id}
                value={selectedNote.content}
                readOnly={false}
                onChange={(newContent) =>
                  handleNoteChange(selectedNote.id, { content: newContent })
                }
              />
            </div>
          </>
        ) : (
          <div className="text-muted-foreground">
            Select a note to begin editing
          </div>
        )}
      </div>

      <div className="w-80 border rounded-xl p-4 bg-white dark:bg-neutral-900 shadow flex flex-col">
        <h3 className="text-lg font-medium mb-2">Summary</h3>
        <Button onClick={handleSummarize} disabled={loadingSummary}>
          {loadingSummary ? "Summarizing..." : "Generate Summary"}
        </Button>

        {summary && (
          <div className="mt-4 p-4 border rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm whitespace-pre-wrap">
            <strong>Summary:</strong>
            <div className="mt-2">{summary}</div>
          </div>
        )}
      </div>

      <div className="w-72 border rounded-xl shadow bg-white dark:bg-neutral-900 flex flex-col">
        <div className="flex items-center justify-between p-2 border-b">
          <h3 className="text-sm font-medium">Your Notes</h3>
          <Button size="sm" variant="outline" onClick={handleCreate}>
            + New
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {stateNotes.map((note) => (
              <Card
                key={note.id}
                className={`cursor-pointer border ${
                  selectedNoteId === note.id
                    ? "border-blue-500 shadow"
                    : "hover:shadow-sm"
                }`}
                onClick={() => setSelectedNoteId(note.id)}
              >
                <CardHeader className="flex flex-row justify-between items-center">
                  <CardTitle className="text-sm truncate">
                    {note.name}
                  </CardTitle>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(note.id);
                    }}
                  >
                    ✕
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {note.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
