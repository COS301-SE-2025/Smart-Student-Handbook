// =============================
// 4) UI: Command Palette (shadcn/ui)
// =============================
// File: components/SearchCommand.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Loader2 } from "lucide-react";
import { useGlobalSearch } from "@/lib/useGlobalSearch";

export default function SearchCommand() {
  const router = useRouter();
  const { query, setQuery, grouped, hits, loading, open, setOpen } = useGlobalSearch();

  // Keyboard: Ctrl/Cmd + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "/") {
        // quick open when slash pressed and not inside input
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const onSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search notes, organisations, lectures, events, users, flashcards…"
      />
      <CommandList>
        {loading && (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching…
          </div>
        )}
        {!loading && <CommandEmpty>No results found.</CommandEmpty>}

        {/* Groups in a fixed order */}
        {["notes", "organisations", "lectures", "events", "users", "flashcards"].map((section, idx) => {
          const items = grouped.get(section as any) || [];
          if (!items.length) return null;
          return (
            <div key={section}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={section.toUpperCase()}>
                {items.map((h) => (
                  <CommandItem key={`${h.section}:${h.id}`} value={`${h.title} ${h.subtitle || ""}`} onSelect={() => onSelect(h.href)}>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium leading-tight">{h.title}</span>
                      {h.subtitle && (
                        <span className="text-xs text-muted-foreground line-clamp-1">{h.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
