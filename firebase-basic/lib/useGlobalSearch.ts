"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { fns } from "@/lib/firebase";
import type { SearchHit, SearchSection } from "../../functions/src/searchEverything";

export function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useGlobalSearch() {
    const sections = ["notes", "organizations", "friends"] as const;

    const [query, setQuery] = useState("");
    const debounced = useDebouncedValue(query, 300);
    const [loading, setLoading] = useState(false);
    const [hits, setHits] = useState<SearchHit[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const lastQ = useRef("");

   useEffect(() => {
    if (!debounced.trim()) {
      setHits([]);
      setError(null);
      return;
    }
    let cancelled = false;
    async function go() {
      setLoading(true);
      setError(null);
      try {
        const fn = httpsCallable(fns, "searchEverything");
        const res = await fn({ q: debounced, limit: 6, sections });
        if (cancelled) return;
        setHits((res as any)?.data?.hits ?? []);
      } catch (e: any) {
        if (!cancelled) {
          const msg =
            e?.code?.includes?.("unauth") ? "Please sign in to search."
            : e?.code?.includes?.("not-found") ? "Search service not found (check deploy/region)."
            : "Search failed. See console.";
          setError(msg);
          setHits([]);
        }
        console.error("searchEverything error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (debounced !== lastQ.current) {
      lastQ.current = debounced;
      go();
    }
    return () => { cancelled = true; };
  }, [debounced]);

  const grouped = useMemo(() => {
    const g = new Map<SearchSection, SearchHit[]>();
    for (const h of hits) {
      g.set(h.section, [...(g.get(h.section) || []), h]);
    }
    return g;
  }, [hits]);

  return { query, setQuery, hits, grouped, loading, error, open, setOpen, sections };
}