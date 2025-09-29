"use client";


import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useGlobalSearch } from "@/lib/useGlobalSearch";


export default function GlobalSearchInline() {
  const { query, setQuery, grouped, hits, loading } = useGlobalSearch();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();


  // Mirror to /organisations?search=... (keeps your old behavior there)
  useEffect(() => {
    if (pathname !== "/organisations") return;
    const p = new URLSearchParams(searchParams.toString());
    if (query.trim()) p.set("search", query.trim());
    else p.delete("search");
    router.replace(`${pathname}${p.toString() ? `?${p.toString()}` : ""}`, { scroll: false });
  }, [query, pathname, router, searchParams]);


  // Close when clicking outside / pressing Esc
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);


  // Sections render order
  const sections = ["notes", "organisations", "lectures", "events", "users", "flashcards"] as const;


  return (
    <div ref={wrapRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search notes, organisations, lectures, events, users, flashcards…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        className="pl-9 h-8 bg-muted/50 border-border focus:bg-background transition-colors"
      />


      {open && (query.length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-full mt-1 max-h-80 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md z-50">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          )}


          {!loading && hits.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No results found.</div>
          )}


          {!loading &&
            hits.length > 0 &&
            sections.map((section) => {
              const items = (grouped as Map<string, any>).get(section) || [];
              if (!items.length) return null;
              return (
                <div key={section} className="py-1">
                  <div className="px-3 pb-1 text-[11px] font-medium uppercase text-muted-foreground">{section}</div>
                  {items.map((h: any) => (
                    <button
                      type="button"
                      key={`${h.section}:${h.id}`}
                      onClick={() => {
                        setOpen(false);
                        router.push(h.href);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-muted/60 focus:bg-muted/60 focus:outline-none"
                    >
                      <div className="text-sm font-medium leading-tight">{h.title}</div>
                      {h.subtitle && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{h.subtitle}</div>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
