"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import NotesSplitView, { type Note } from "@/components/notes/NotesSplitView";

// Avoid prerender issues for client-only router hooks
export const dynamic = "force-dynamic";

function OrgNotesInner() {
  const { id: orgId } = useParams<{ id: string }>();
  const search = useSearchParams();
  const preselectId = search.get("noteId");

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;

    const notesRef = ref(db, `organizations/${orgId}/notes`);
    const unsub = onValue(notesRef, (snap) => {
      const raw = (snap.val() as Record<string, Note> | null) ?? null;
      let arr = raw ? Object.values(raw) : [];

      arr.sort(
        (a, b) =>
          (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
      );

      if (preselectId) {
        const idx = arr.findIndex((n) => n.id === preselectId);
        if (idx > 0) {
          const [picked] = arr.splice(idx, 1);
          arr = [picked, ...arr];
        }
      }

      setNotes(arr);
      setLoading(false);
    });

    return () => unsub();
  }, [orgId, preselectId]);

  if (!orgId)
    return (
      <div className="p-6 text-sm text-muted-foreground">Missing org id.</div>
    );

  // Optional loading UI:
  // if (loading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-background">
  //       <div className="text-center space-y-3">
  //         <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
  //         <p className="text-muted-foreground">Loading notes…</p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <NotesSplitView
      notes={notes}
      orgID={orgId}
      initialSelectedId={preselectId ?? undefined}
    />
  );
}

export default function OrgNotesWorkspacePage() {
  return (
    <Suspense fallback={null}>
      <OrgNotesInner />
    </Suspense>
  );
}
