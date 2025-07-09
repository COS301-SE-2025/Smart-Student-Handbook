'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

const QuillEditor = dynamic(() => import('@/components/quilleditor'), { ssr: false });

type Note = {
  ownerId: string;
  id: string;
  name: string;
  content: string;
  type: 'note';
};

type NotesSplitViewProps = {
  notes: Note[];
};

export default function NotesSplitView({ notes }: NotesSplitViewProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    notes[0]?.id ?? null
  );

  const selectedNote = notes.find((n) => n.id === selectedNoteId);

  return (
    <div className="flex h-[calc(100vh-4rem)] p-4 gap-4">
      <div className="flex-[2] border rounded-xl p-4 bg-white dark:bg-neutral-900 shadow overflow-hidden">
        {selectedNote ? (
          <>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold truncate">{selectedNote.name}</h2>
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
                value={selectedNote.content}
                readOnly={false}
                onChange={(value: string) => {
                  selectedNote.content = value;
                }}
              />
            </div>
          </>
        ) : (
          <div className="text-muted-foreground">Select a note to begin editing</div>
        )}
      </div>

      <div className="w-80 border rounded-xl p-4 bg-white dark:bg-neutral-900 shadow flex flex-col">
        <h3 className="text-lg font-medium mb-2">Summary</h3>
        <div className="text-sm text-muted-foreground">
          Coming soon: summary & references
        </div>
      </div>

      <div className="w-72 border rounded-xl shadow bg-white dark:bg-neutral-900">
        <h3 className="text-center text-sm font-medium py-2 border-b">Organization Notes</h3>
        <ScrollArea className="h-full">
          <div className="p-2 space-y-2">
            {notes.map((note) => (
              <Card
                key={note.id}
                className={`cursor-pointer border ${
                  selectedNoteId === note.id
                    ? 'border-blue-500 shadow'
                    : 'hover:shadow-sm'
                }`}
                onClick={() => setSelectedNoteId(note.id)}
              >
                <CardHeader>
                  <CardTitle className="text-sm truncate">{note.name}</CardTitle>
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
