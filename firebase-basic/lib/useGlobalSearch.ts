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
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const lastQ = useRef("");
  const sections = ["notes", "organizations", "friends"] as const;

  useEffect(() => {
    if (!debounced.trim()) {
      setHits([]);
      return;
    }
    let cancelled = false;
    async function go() {
      setLoading(true);
      try {
        const fn = httpsCallable(fns, "searchEverything");
        const res = (await fn({ q: debounced, limit: 6, sections: ["notes", "organizations", "friends"] })) as any;
        if (cancelled) return;
        setHits(res?.data?.hits ?? []);
      } catch (e) {
        console.error("searchEverything error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (debounced !== lastQ.current) {
      lastQ.current = debounced;
      go();
    }
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const grouped = useMemo(() => {
    const g = new Map<SearchSection, typeof hits>();
    for (const h of hits) {
      g.set(h.section, [...(g.get(h.section) || []), h]);
    }
    return g;
  }, [hits]);

  return { query, setQuery, hits, grouped, loading, open, setOpen };
}

