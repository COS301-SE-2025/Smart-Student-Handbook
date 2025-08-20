"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { get, ref } from "firebase/database";
// If your DB export is in "@/lib/firebase", use that path:
import { db } from "@/lib/firebase";
import NotesGrid from "@/components/NotesGrid";

export const dynamic = "force-dynamic";

type Note = {
  ownerId: string;
  id: string;
  name: string;
  content: string;
  type: "note";
};

function OrgNotesInner() {
  // ✅ safe inside Suspense
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId");
  const _userId = searchParams.get("userId"); // if you need it later

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    const notesRef = ref(db, `organizations/${orgId}/notes`);
    get(notesRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const raw = snapshot.val() as Record<string, Note>;
          setNotes(Object.values(raw));
        } else {
          setNotes([]);
        }
      })
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [orgId]);

  if (!orgId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Missing <code>orgId</code> in the URL.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading organization notes…
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Organisation Notes</h1>
      {/* NotesGrid typically accepts a string; pass orgId as non-null */}
      <NotesGrid notes={notes} orgID={orgId} />
    </div>
  );
}

export default function OrgNotesPage() {
  return (
    <Suspense fallback={null}>
      <OrgNotesInner />
    </Suspense>
  );
}
