"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpenText,
  ChevronDown,
  ExternalLink,
  Feather,
  LoaderCircle,
  Search,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ALL_SHELVES,
  DEFAULT_SHELF_ID,
  TAB_SHELVES,
  TABS,
  shelfById,
  tabOf,
} from "@/lib/sources";
import type { Shelf, TabKey } from "@/lib/sources";

const GUARDIAN = "https://www.theguardian.com";
const STARRED_KEY = "grf.starred";
const RECENT_KEY = "grf.recent";
const RECENT_LIMIT = 5;

type Article = {
  title: string;
  link: string;
  description: string;
  kicker: string;
  published: string;
  image: string;
};

type Feed = {
  key: string;
  items: Article[];
  page: number;
  hasMore: boolean;
  error: string;
};

const EMPTY_FEED: Feed = { key: "", items: [], page: 0, hasMore: false, error: "" };

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/**
 * The Saturday of the week an article belongs to. Feast pieces go online
 * across Thursday to Sunday around the printed issue, so bucketing by week
 * gathers one issue under one heading.
 */
function issueOf(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  const saturday = new Date(date);
  saturday.setUTCDate(date.getUTCDate() - mondayOffset + 5);
  return saturday;
}

function issueLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function readStore(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function writeStore(key: string, value: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A private window or blocked storage just means no pinning this session.
  }
}

function ArticleSkeleton() {
  return (
    <div className="article-skeleton" aria-label="Loading articles">
      {[0, 1, 2, 3].map((item) => (
        <div className="skeleton-row" key={item}>
          <div className="skeleton-copy">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-4/5" />
            <Skeleton className="mt-2 h-3 w-44" />
          </div>
          <Skeleton className="skeleton-image" />
        </div>
      ))}
    </div>
  );
}

function ArticleRow({ item }: { item: Article }) {
  return (
    <article className="article-row">
      <a className="article-main" href={item.link} target="_blank" rel="noreferrer">
        <div className="article-meta">
          {item.kicker ? <span>{item.kicker}</span> : null}
          {item.published ? <time dateTime={item.published}>{formatDate(item.published)}</time> : null}
        </div>
        <h3>{item.title}</h3>
        {item.description ? <p>{item.description}</p> : null}
        <div className="article-byline">
          <span className="read-link">Read on the Guardian <ArrowUpRight /></span>
        </div>
      </a>
      {item.image ? (
        <a className="article-image" href={item.link} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden="true">
          {/* Images are served by the Guardian and every one links back to the source article.
              Kept as a plain img so there is no remote-host allowlist to maintain. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
        </a>
      ) : null}
    </article>
  );
}

export function RecipeBrowser() {
  const [tab, setTab] = useState<TabKey>("start");
  const [shelfId, setShelfId] = useState(DEFAULT_SHELF_ID);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState("");
  const [jump, setJump] = useState("");
  const [shelfOpen, setShelfOpen] = useState(false);
  const [feed, setFeed] = useState<Feed>(EMPTY_FEED);
  const [loadingMore, setLoadingMore] = useState(false);
  const [starred, setStarred] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  const inFlight = useRef(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const shelf = shelfById(shelfId) ?? ALL_SHELVES[0];
  const searching = Boolean(searchTerm);
  const feedKey = searching ? `search:${searchTerm}` : `shelf:${shelfId}`;
  const loading = feed.key !== feedKey;
  const error = loading ? "" : feed.error;
  const items = useMemo(() => (loading ? [] : feed.items), [loading, feed.items]);

  const heading = searching ? `“${searchTerm}”` : shelf.name;
  const openHref = searching
    ? `${GUARDIAN}/search?q=${encodeURIComponent(searchTerm)}`
    : `${GUARDIAN}${shelf.paths[0]}`;

  // ------------------------------------------------------------- stored state

  useEffect(() => {
    setStarred(readStore(STARRED_KEY));
    setRecent(readStore(RECENT_KEY));
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("shelf");
    if (wanted && shelfById(wanted)) {
      setShelfId(wanted);
      setTab(tabOf(wanted));
    }
  }, []);

  const toggleStar = useCallback((id: string) => {
    setStarred((current) => {
      const next = current.includes(id) ? current.filter((entry) => entry !== id) : [id, ...current];
      writeStore(STARRED_KEY, next);
      return next;
    });
  }, []);

  const rememberVisit = useCallback((id: string) => {
    setRecent((current) => {
      const next = [id, ...current.filter((entry) => entry !== id)].slice(0, RECENT_LIMIT);
      writeStore(RECENT_KEY, next);
      return next;
    });
  }, []);

  // ------------------------------------------------------------------ loading

  const requestUrl = useCallback(
    (page: number) =>
      searching
        ? `/api/search?q=${encodeURIComponent(searchTerm)}&page=${page}`
        : `/api/feed?id=${encodeURIComponent(shelfId)}&page=${page}`,
    [searching, searchTerm, shelfId],
  );

  useEffect(() => {
    const controller = new AbortController();
    inFlight.current = false;
    fetch(requestUrl(1), { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load this list.");
        return data;
      })
      .then((data) =>
        setFeed({
          key: feedKey,
          items: data.items ?? [],
          page: data.page ?? 1,
          hasMore: data.hasMore ?? false,
          error: "",
        }),
      )
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") {
          setFeed({ key: feedKey, items: [], page: 0, hasMore: false, error: reason.message });
        }
      });
    return () => controller.abort();
  }, [feedKey, requestUrl]);

  const loadMore = useCallback(async () => {
    if (inFlight.current || loading || !feed.hasMore || feed.error) return;
    inFlight.current = true;
    setLoadingMore(true);
    const nextPage = feed.page + 1;
    try {
      const response = await fetch(requestUrl(nextPage));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load older recipes.");
      setFeed((current) => {
        if (current.key !== feedKey) return current;
        const links = new Set(current.items.map((item) => item.link));
        const older = (data.items ?? []).filter((item: Article) => !links.has(item.link));
        return {
          ...current,
          items: [...current.items, ...older],
          page: data.page ?? nextPage,
          hasMore: (data.hasMore ?? false) && older.length > 0,
        };
      });
    } catch {
      setFeed((current) => (current.key === feedKey ? { ...current, hasMore: false } : current));
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }, [feed.error, feed.hasMore, feed.page, feedKey, loading, requestUrl]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || loading || !feed.hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [feed.hasMore, loadMore, loading]);

  // ----------------------------------------------------------------- shelves

  function chooseShelf(next: Shelf) {
    setShelfId(next.id);
    setSearchTerm("");
    setShelfOpen(false);
    rememberVisit(next.id);
    window.history.replaceState(null, "", `?shelf=${encodeURIComponent(next.id)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changeTab(next: TabKey) {
    setTab(next);
    setJump("");
    setShelfOpen(true);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const term = draft.trim();
    if (term.length < 2) return;
    setSearchTerm(term);
    setShelfOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const tabShelves = TAB_SHELVES[tab];

  const visibleShelves = useMemo(() => {
    const term = jump.trim().toLowerCase();
    if (!term) return tabShelves;
    return tabShelves.filter((entry) => `${entry.name} ${entry.group}`.toLowerCase().includes(term));
  }, [tabShelves, jump]);

  const pinned = useMemo(() => {
    if (tab !== "writers" || jump.trim()) return [];
    const inTab = (id: string) => tabShelves.some((entry) => entry.id === id);
    const starredHere = starred.filter(inTab);
    const recentHere = recent.filter((id) => inTab(id) && !starredHere.includes(id));
    const groups: { group: string; shelves: Shelf[] }[] = [];
    if (starredHere.length) {
      groups.push({ group: "Starred", shelves: starredHere.map((id) => shelfById(id)!).filter(Boolean) });
    }
    if (recentHere.length) {
      groups.push({ group: "Recently viewed", shelves: recentHere.map((id) => shelfById(id)!).filter(Boolean) });
    }
    return groups;
  }, [tab, jump, tabShelves, starred, recent]);

  const grouped = useMemo(() => {
    const map = new Map<string, Shelf[]>();
    for (const entry of visibleShelves) {
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    }
    return [...map.entries()].map(([group, shelves]) => ({ group, shelves }));
  }, [visibleShelves]);

  // -------------------------------------------------------------- feed shape

  const weeks = useMemo(() => {
    if (searching || !shelf.weekly) return null;
    const map = new Map<string, { label: string; items: Article[] }>();
    for (const item of items) {
      const saturday = issueOf(item.published);
      const key = saturday ? saturday.toISOString().slice(0, 10) : "undated";
      const label = saturday ? issueLabel(saturday) : "Undated";
      const bucket = map.get(key) ?? { label, items: [] };
      bucket.items.push(item);
      map.set(key, bucket);
    }
    return [...map.values()];
  }, [items, searching, shelf.weekly]);

  const showSearch = tab === "ingredients";

  return (
    <main className="site-shell">
      <header className="masthead">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><Feather /></div>
          <div>
            <p className="eyebrow">A personal cooking index</p>
            <h1>Guardian recipe finder</h1>
          </div>
        </div>
      </header>

      <div className="workspace">
        <button
          type="button"
          className="shelf-toggle"
          onClick={() => setShelfOpen((open) => !open)}
          aria-expanded={shelfOpen}
        >
          <span>{shelfOpen ? "Close the shelves" : heading}</span>
          <ChevronDown aria-hidden="true" data-open={shelfOpen} />
        </button>

        <aside className="source-panel" data-open={shelfOpen}>
          <Tabs value={tab} onValueChange={(value) => changeTab(value as TabKey)}>
            <TabsList className="view-tabs" aria-label="Browse by">
              {TABS.map((entry) => (
                <TabsTrigger key={entry.key} value={entry.key}>{entry.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {showSearch ? (
            <form className="ingredient-search" onSubmit={submitSearch}>
              <label className="search-field">
                <span className="sr-only">Search all Guardian recipes</span>
                <Search aria-hidden="true" />
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Search all Guardian recipes…"
                  enterKeyHint="search"
                />
              </label>
              <Button type="submit" disabled={draft.trim().length < 2}>Search</Button>
              <p>Whatever is in the fridge — cauliflower, anchovies, a glut of courgettes.</p>
            </form>
          ) : (
            <label className="search-field jump-field">
              <span className="sr-only">Jump to a shelf</span>
              <Search aria-hidden="true" />
              <Input
                value={jump}
                onChange={(event) => setJump(event.target.value)}
                placeholder={tab === "writers" ? "Jump to a writer…" : "Jump to a topic…"}
              />
            </label>
          )}

          <div className="source-groups">
            {[...pinned, ...grouped].map(({ group, shelves }) => (
              <section key={group} className="source-group">
                <h3>{group}</h3>
                <div>
                  {shelves.map((entry) => (
                    <div className="source-item" key={`${group}-${entry.id}`}>
                      <button
                        type="button"
                        className="source-row"
                        data-active={!searching && shelf.id === entry.id}
                        aria-pressed={!searching && shelf.id === entry.id}
                        onClick={() => chooseShelf(entry)}
                      >
                        <span>{entry.name}</span>
                        <ArrowUpRight aria-hidden="true" />
                      </button>
                      {tab === "writers" ? (
                        <button
                          type="button"
                          className="star-button"
                          data-starred={starred.includes(entry.id)}
                          aria-label={starred.includes(entry.id) ? `Unstar ${entry.name}` : `Star ${entry.name}`}
                          aria-pressed={starred.includes(entry.id)}
                          onClick={() => toggleStar(entry.id)}
                        >
                          <Star aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {!visibleShelves.length ? <p className="empty-copy">Nothing matches that. Try a broader word.</p> : null}
          </div>
        </aside>

        <section className="feed-panel">
          <div className="feed-heading">
            <div>
              <p className="section-kicker">{searching ? "Searching for" : "Latest from"}</p>
              <h2>{heading}</h2>
              <p className="feed-note" aria-live="polite">
                {loading
                  ? "Loading…"
                  : searching
                    ? `${items.length} results${feed.hasMore ? ", more as you scroll" : ""}`
                    : shelf.note ?? `${items.length} articles${feed.hasMore ? ", more as you scroll" : ""}`}
              </p>
            </div>
            <Button asChild variant="outline" className="collection-link">
              <a href={openHref} target="_blank" rel="noreferrer">
                Open on the Guardian <ExternalLink />
              </a>
            </Button>
          </div>

          {loading ? <ArticleSkeleton /> : null}

          {!loading && error ? (
            <div className="feed-message">
              <BookOpenText aria-hidden="true" />
              <h3>The list is taking a break</h3>
              <p>{error}</p>
              <Button asChild>
                <a href={openHref} target="_blank" rel="noreferrer">
                  Open on the Guardian <ExternalLink />
                </a>
              </Button>
            </div>
          ) : null}

          {!loading && !error && !items.length ? (
            <div className="feed-message compact">
              <Search aria-hidden="true" />
              <h3>Nothing here</h3>
              <p>{searching ? "No Guardian food articles matched that." : "This shelf came back empty."}</p>
            </div>
          ) : null}

          {!loading && !error && items.length ? (
            <div className="article-list">
              {weeks
                ? weeks.map((week) => (
                    <section className="issue" key={week.label}>
                      <h3 className="issue-heading">The Feast — {week.label}</h3>
                      {week.items.map((item) => <ArticleRow item={item} key={item.link} />)}
                    </section>
                  ))
                : items.map((item) => <ArticleRow item={item} key={item.link} />)}

              <div ref={sentinel} className="feed-sentinel" aria-hidden="true" />

              {loadingMore ? (
                <p className="feed-status"><LoaderCircle className="spin" aria-hidden="true" /> Loading more…</p>
              ) : null}
              {!feed.hasMore && !loadingMore ? (
                <p className="feed-status">That is as far back as this list goes.</p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <footer>
        <p>Personal-use index · Titles and images come from public Guardian pages · Articles always open on the Guardian</p>
        <a href="https://www.theguardian.com/help/terms-of-service" target="_blank" rel="noreferrer">Guardian terms <ArrowUpRight /></a>
      </footer>
    </main>
  );
}
