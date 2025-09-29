import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

// Types shared with the client
export type SearchSection =
  | "notes"
  | "organizations"
  | "friends"
  | "lectures"
  | "events"
  | "users"
  | "flashcards";

export type SearchHit = {
  id: string;
  section: SearchSection;
  title: string;
  subtitle?: string;
  href: string; 
  score: number; 
};

export const searchEverything = onCall<{
  q?: string;
  limit?: number;
  sections?: SearchSection[];
}>(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required");

  const q = (req.data?.q ?? "").toString().trim().toLowerCase();
  const limit = Math.min(Number(req.data?.limit ?? 8) || 8, 25);
  const sections: SearchSection[] =
    Array.isArray(req.data?.sections) && req.data.sections.length
      ? (req.data.sections as SearchSection[])
      : ["notes", "organizations", "friends", "events"];

  if (!q) return { hits: [] as SearchHit[] };

  const db = admin.database();
  const hits: SearchHit[] = [];

  // ------------ helpers ------------
  function stripHtml(s: string) {
    return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  function jsonToPlain(s: any): string {
    try {
      const v = typeof s === "string" ? JSON.parse(s) : s;
      // Array of blocks
      if (Array.isArray(v)) {
        return v
          .map((blk: any) =>
            typeof blk?.props?.text === "string"
              ? blk.props.text
              : blk?.text || blk?.content || ""
          )
          .join(" ");
      }
      // Quill delta
      if (v && Array.isArray(v.ops)) {
        return v.ops.map((op: any) => op.insert ?? "").join("");
      }
      // Editor.js style
      if (Array.isArray(v?.blocks)) {
        return v.blocks.map((b: any) => stripHtml(b?.data?.text || b?.data?.title || "")).join(" ");
      }
      // Generic object
      return JSON.stringify(v).replace(/["{}[\],]/g, " ");
    } catch {
      return typeof s === "string" ? s : "";
    }
  }

  function toPlainPreview(body: any, max = 240): string {
    if (body == null) return "";
    if (typeof body === "string") {
      const trimmed = body.trim();
      if (/^[\[{].*[\]}]$/.test(trimmed)) return jsonToPlain(trimmed).slice(0, max);
      if (/<[a-z][\s\S]*>/i.test(trimmed)) return stripHtml(trimmed).slice(0, max);
      return trimmed.slice(0, max);
    }
    return jsonToPlain(body).slice(0, max);
  }
  const scoreOf = (text?: string) => {
    const t = (text || "").toLowerCase();
    if (!t.includes(q)) return -1;
    return t.startsWith(q) ? 10 : 5;
  };


  // ------------ NOTES (users/{uid}/notes -> fallback notes/{uid}) ------------
  if (sections.includes("notes")) {
    const notePaths = [`users/${uid}/notes`, `notes/${uid}`];
    let noteSnap: admin.database.DataSnapshot | null = null;
    for (const p of notePaths) {
      const s = await db.ref(p).limitToFirst(500).get();
      if (s.exists()) { noteSnap = s; break; }
    }
    if (noteSnap) {
      noteSnap.forEach((c) => {
        const v = c.val() || {};
        const title = v.title || v.name || "Untitled note";
        const rawBody = v.searchText ?? v.plainText ?? v.body ?? v.content ?? v.data ?? v.blocks;
        const preview = toPlainPreview(rawBody);
        const s = Math.max(scoreOf(title), scoreOf(preview));
        if (s >= 0) {
          hits.push({
            id: c.key!,
            section: "notes",
            title,
            subtitle: preview,
            // open your editor at /notes with a query param
            href: `/notes?noteId=${c.key}`,
            score: s,
          });
        }
      });
    }
  }

  // ------------ ORGANIZATIONS (DB path uses 'organizations') ------------
  if (sections.includes("organizations")) {
    const orgSnap = await db.ref("organizations").limitToFirst(500).get();
    orgSnap.forEach((c) => {
      const v = c.val() || {};
      const isMember = !!v.members?.[uid];
      const isPublic = v.isPrivate === false || v.public === true;
      if (!isMember && !isPublic) return;

      const name = v.name || "Organization";
      const desc = v.description || "";
      const s = Math.max(scoreOf(name), scoreOf(desc));
      if (s >= 0) {
        hits.push({
          id: c.key!,
          section: "organizations",
          title: name,
          subtitle: isMember ? "Member" : desc.slice(0, 120),
          // your UI route uses UK spelling
          href: `/organisations/${c.key}`,
          score: s + (isMember ? 2 : 0),
        });
      }
    });
  }

  // ------------ FRIENDS (ids at users/{uid}/friends + profile at users/{fid}/UserSettings) ------------
  if (sections.includes("friends")) {
    const friendsSnap = await db.ref(`users/${uid}/friends`).get();
    const map = friendsSnap.exists() ? friendsSnap.val() : {};
    const friendIds: string[] = Object.keys(map);

    await Promise.all(
      friendIds.map(async (fid) => {
        const ps = await db.ref(`users/${fid}/UserSettings`).get();
        const p = ps.val() || {};
        const fullName = `${p.name || ""} ${p.surname || ""}`.trim();
        const email = p.email || "";
        const s = Math.max(scoreOf(fullName), scoreOf(email));
        if (s >= 0) {
          hits.push({
            id: fid,
            section: "friends",
            title: fullName || email || `User ${fid.slice(0, 6)}`,
            subtitle: email,
            href: `/friends/${fid}`,
            score: s,
          });
        }
      })
    );
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


  // ------------ EVENTS (match your other functions: users/{uid}/events) ------------
  if (sections.includes("events")) {
    const snap = await db.ref(`users/${uid}/events`).limitToFirst(500).get();
    snap.forEach((c) => {
      const v = c.val() as { title?: string; description?: string; type?: string };
      const s = Math.max(scoreOf(v.title || ""), scoreOf(v.description || ""), scoreOf(v.type || ""));
      if (s >= 0) {
        hits.push({
          id: c.key!,
          section: "events",
          title: v.title || (v.type ? v.type.toUpperCase() : "Event"),
          subtitle: (v.description || "").slice(0, 120),
          href: `/calendar?focus=event:${c.key}`,
          score: s,
        });
      }
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

  // ------------ sort & cap per-section ------------
  hits.sort((a, b) => (b.score - a.score) || a.section.localeCompare(b.section) || a.title.localeCompare(b.title));

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
