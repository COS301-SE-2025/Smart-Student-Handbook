"use client";
import { useSearchParams } from "next/navigation";
import NotesGrid from "@/components/NotesGrid";

import { get, ref, set } from "firebase/database";
import { db } from "@/lib";

import { useEffect, useState } from "react";

type Note = {
  ownerId: string;
  id: string;
  name: string;
  content: string;
  type: "note";
};

const exampleNote: Note = {
  ownerId: "user123",
  id: "note567",
  name: "Example Note Title",
  content: "This is the content of the example note.",
  type: "note",
};

export default function OrgNotesPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId");
  const userId = searchParams.get("userId");

  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    const notesRef = ref(db, `organizations/${orgId}/notes`);

    get(notesRef).then((snapshot) => {
      if (snapshot.exists()) {
        const raw = snapshot.val();
        const loadedNotes: Note[] = Object.values(raw);
        setNotes(loadedNotes);
      }
    });
  }, []);

  return (
    <>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Organisation Notes</h1>
        <NotesGrid notes={notes} />
      </div>
    </>
  );
}
