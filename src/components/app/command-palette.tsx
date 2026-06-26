"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Route } from "next";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import type { SearchResult } from "@/app/api/search/route";

const RECENT_KEY = "app-recent-pages";
const MAX_RECENT = 5;

type NavItem = { label: string; href: string };
type RecentPage = { label: string; href: string };

function pushRecentPage(entry: RecentPage): void {
  try {
    const existing: RecentPage[] = JSON.parse(
      localStorage.getItem(RECENT_KEY) ?? "[]"
    );
    const filtered = existing.filter((e) => e.href !== entry.href);
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify([entry, ...filtered].slice(0, MAX_RECENT))
    );
  } catch {}
}

function getRecentPages(): RecentPage[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function CommandPalette({ navItems }: { navItems: NavItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentPage[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track recent pages whenever pathname changes
  useEffect(() => {
    const match = navItems.find((item) => pathname.startsWith(item.href));
    if (match) pushRecentPage({ label: match.label, href: match.href });
  }, [pathname, navItems]);

  // Load recent pages when dialog opens
  useEffect(() => {
    if (open) {
      setRecent(getRecentPages());
      setQuery("");
      setSearchResults([]);
    }
  }, [open]);

  // Debounced record search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = (await res.json()) as { results: SearchResult[] };
          setSearchResults(data.results);
        }
      } catch {
        // silent — search is non-critical
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href as Route);
    },
    [router]
  );

  const filteredNav = query.length >= 2
    ? navItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      )
    : navItems;

  return (
    <>
      {/* Trigger button — visible in header on md+ */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 text-muted-foreground h-8 px-3"
        aria-label="Open search (⌘K)"
      >
        <Search className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="text-sm">Search...</span>
        <kbd className="ml-1 pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] opacity-60">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search pages and records..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {query.length < 2 ? (
              <>
                <CommandEmpty>Start typing to search…</CommandEmpty>
                {recent.length > 0 && (
                  <CommandGroup heading="Recent">
                    {recent.map((page) => (
                      <CommandItem
                        key={page.href}
                        value={page.href}
                        onSelect={() => navigate(page.href)}
                      >
                        {page.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {recent.length > 0 && navItems.length > 0 && (
                  <CommandSeparator />
                )}
                {navItems.length > 0 && (
                  <CommandGroup heading="Navigation">
                    {navItems.map((item) => (
                      <CommandItem
                        key={item.href}
                        value={item.href}
                        onSelect={() => navigate(item.href)}
                      >
                        {item.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            ) : (
              <>
                {searching && (
                  <CommandGroup heading="Records">
                    <CommandItem disabled value="__searching__">
                      <span className="text-muted-foreground text-sm">Searching…</span>
                    </CommandItem>
                  </CommandGroup>
                )}

                {!searching && searchResults.length > 0 && (
                  <CommandGroup heading="Records">
                    {searchResults.map((r) => (
                      <CommandItem
                        key={`${r.type}-${r.id}`}
                        value={`${r.type}-${r.id}`}
                        onSelect={() => navigate(r.href)}
                      >
                        <span className="text-xs text-muted-foreground w-24 shrink-0">
                          {r.type}
                        </span>
                        <span className="font-medium">{r.title}</span>
                        {r.subtitle && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {r.subtitle}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {!searching && searchResults.length > 0 && filteredNav.length > 0 && (
                  <CommandSeparator />
                )}

                {filteredNav.length > 0 && (
                  <CommandGroup heading="Navigation">
                    {filteredNav.map((item) => (
                      <CommandItem
                        key={item.href}
                        value={item.href}
                        onSelect={() => navigate(item.href)}
                      >
                        {item.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {!searching && searchResults.length === 0 && filteredNav.length === 0 && (
                  <CommandEmpty>No results found.</CommandEmpty>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
