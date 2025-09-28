// =============================
// 1) Cloud Function: searchEverything
// =============================
// File: functions/src/searchEverything.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

// Types shared with the client
export type SearchSection =
  | "notes"
  | "organisations"
  | "lectures"
  | "events"
  | "users"
  | "flashcards";

export type SearchHit = {
  id: string;
  section: SearchSection;
  title: string;
  subtitle?: string;
  href: string; // client path to open
  score: number; // simple rank for now
};

export const searchEverything = onCall<{
  q?: string;
  limit?: number;
  sections?: SearchSection[];
}>(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  const qRaw = (req.data?.q ?? "").toString();
  const limit = Math.min(Number(req.data?.limit ?? 8) || 8, 25);
  const sections: SearchSection[] =
    Array.isArray(req.data?.sections) && req.data.sections.length
      ? (req.data.sections as SearchSection[])
      : ["notes", "organisations", "lectures", "events", "users", "flashcards"];

  const db = admin.database();

  // Helper: naive contains filter + score (prefix bonus)
  const scoreOf = (text: string) => {
    const t = (text || "").toLowerCase();
    if (!t.includes(qRaw)) return -1;
    if (t.startsWith(qRaw)) return 10; // prefix boost
    return 5; // contains
  };

  // For large datasets, consider creating a search_index per entity with concatenated `searchText`.
  // For now we fetch a reasonable subset and filter in memory.

  const hits: SearchHit[] = [];

  // NOTES (scoped to user)
  if (sections.includes("notes")) {
    const snap = await db.ref(`notes/${uid}`).limitToFirst(500).get();
    snap.forEach((c) => {
      const v = c.val() as { title?: string; body?: string };
      const s1 = scoreOf(v.title || "");
      const s2 = scoreOf(v.body || "");
      const best = Math.max(s1, s2);
      if (best >= 0)
        hits.push({
          id: c.key!,
          section: "notes",
          title: v.title || "Untitled note",
          subtitle: v.body?.slice(0, 120) || "",
          href: `/notes/${c.key}`,
          score: best,
        });
    });
  }

  // ORGANISATIONS (public + ones the user belongs to)
  if (sections.includes("organisations")) {
    const orgSnap = await db.ref("organisations").limitToFirst(500).get();
    orgSnap.forEach((c) => {
      const v = c.val() as { name?: string; description?: string; members?: Record<string, true> };
      const isMember = !!v.members?.[uid];
      const s1 = scoreOf(v.name || "");
      const s2 = scoreOf(v.description || "");
      const best = Math.max(s1, s2);
      if (best >= 0) {
        hits.push({
          id: c.key!,
          section: "organisations",
          title: v.name || "Organisation",
          subtitle: isMember ? "Member" : v.description?.slice(0, 120),
          href: `/organisations/${c.key}`,
          score: best + (isMember ? 2 : 0),
        });
      }
    });
  }

  // LECTURES (by active semester under /lectures/<semesterId> or user scoped)
  if (sections.includes("lectures")) {
    // Try by user scope; adjust path if your schema differs
    const snap = await db.ref(`lectures/${uid}`).limitToFirst(500).get();
    snap.forEach((c) => {
      const v = c.val() as { subject?: string; room?: string; lecturer?: string };
      const s = Math.max(scoreOf(v.subject || ""), scoreOf(v.lecturer || ""), scoreOf(v.room || ""));
      if (s >= 0)
        hits.push({
          id: c.key!,
          section: "lectures",
          title: v.subject || "Lecture",
          subtitle: [v.lecturer, v.room].filter(Boolean).join(" · "),
          href: `/calendar?focus=lecture:${c.key}`,
          score: s,
        });
    });
  }

  // EVENTS (by semester or user)
  if (sections.includes("events")) {
    const snap = await db.ref(`events/${uid}`).limitToFirst(500).get();
    snap.forEach((c) => {
      const v = c.val() as { title?: string; description?: string; type?: string };
      const s = Math.max(scoreOf(v.title || ""), scoreOf(v.description || ""), scoreOf(v.type || ""));
      if (s >= 0)
        hits.push({
          id: c.key!,
          section: "events",
          title: v.title || (v.type ? v.type.toUpperCase() : "Event"),
          subtitle: v.description?.slice(0, 120),
          href: `/calendar?focus=event:${c.key}`,
          score: s,
        });
    });
  }

  // USERS (friends or all users if you allow discovery)
  if (sections.includes("users")) {
    const snap = await db.ref("users").limitToFirst(500).get();
    snap.forEach((c) => {
      const v = c.val() as { displayName?: string; email?: string };
      const s = Math.max(scoreOf(v.displayName || ""), scoreOf(v.email || ""));
      if (s >= 0)
        hits.push({
          id: c.key!,
          section: "users",
          title: v.displayName || v.email || "User",
          subtitle: v.email,
          href: `/friends/${c.key}`,
          score: s,
        });
    });
  }

  // FLASHCARDS (if you have them under /flashcards/<uid>/<deck>/<card>)
  if (sections.includes("flashcards")) {
    const snap = await db.ref(`flashcards/${uid}`).limitToFirst(200).get();
    snap.forEach((deck) => {
      const deckName = (deck.child("name").val() as string) || "Deck";
      deck.child("cards").forEach((card) => {
        const v = card.val() as { front?: string; back?: string };
        const s = Math.max(scoreOf(v.front || ""), scoreOf(v.back || ""));
        if (s >= 0)
          hits.push({
            id: `${deck.key}:${card.key}`,
            section: "flashcards",
            title: v.front || "Card",
            subtitle: `${deckName} · ${(v.back || "").slice(0, 120)}`,
            href: `/flashcards/${deck.key}?card=${card.key}`,
            score: s,
          });
      });
    });
  }

  // Sort by score desc, then title asc, then section
  hits.sort((a, b) => (b.score - a.score) || a.section.localeCompare(b.section) || a.title.localeCompare(b.title));

  // Truncate per section and overall
  const perSection = limit;
  const grouped = new Map<SearchSection, SearchHit[]>();
  for (const h of hits) {
    const arr = grouped.get(h.section) || [];
    if (arr.length < perSection) {
      arr.push(h);
      grouped.set(h.section, arr);
    }
  }

  const finalHits = Array.from(grouped.values()).flat().slice(0, limit * sections.length);
  return { hits: finalHits };
});

