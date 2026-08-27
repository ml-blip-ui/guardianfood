"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpenText,
  ChefHat,
  Clock3,
  ExternalLink,
  Feather,
  LoaderCircle,
  Search,
  SlidersHorizontal,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { collections, SOURCE_COUNT, topics, writers } from "./data";
import type { Source } from "./data";

type FeedItem = {
  title: string;
  link: string;
  creator: string;
  description: string;
  categories: string[];
  published: string;
  image: string;
};

const GUARDIAN = "https://www.theguardian.com";
const sourceSets = { collections, topics, writers };
type View = keyof typeof sourceSets;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function SourceList({
  sources,
  active,
  onSelect,
}: {
  sources: Source[];
  active: Source;
  onSelect: (source: Source) => void;
}) {
  const grouped = useMemo(() => {
    return sources.reduce<Record<string, Source[]>>((result, source) => {
      (result[source.group] ??= []).push(source);
      return result;
    }, {});
  }, [sources]);

  if (!sources.length) {
    return <p className="empty-copy">No matching sources. Try a broader search.</p>;
  }

  return (
    <div className="source-groups">
      {Object.entries(grouped).map(([group, items]) => (
        <section key={group} className="source-group">
          <h3>{group}</h3>
          <div>
            {items.map((source) => (
              <button
                type="button"
                key={source.path}
                className="source-row"
                data-active={active.path === source.path}
                onClick={() => onSelect(source)}
                aria-pressed={active.path === source.path}
              >
                <span>{source.name}</span>
                <ArrowUpRight aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
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

export function RecipeBrowser() {
  const [view, setView] = useState<View>("collections");
  const [sourceSearch, setSourceSearch] = useState("");
  const [articleSearch, setArticleSearch] = useState("");
  const [active, setActive] = useState<Source>(collections[2]);
  const [feed, setFeed] = useState<{
    path: string;
    items: FeedItem[];
    error: string;
    page: number;
    hasMore: boolean;
  }>({
    path: "",
    items: [],
    error: "",
    page: 0,
    hasMore: true,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");

  const loading = feed.path !== active.path;
  const items = loading ? [] : feed.items;
  const error = loading ? "" : feed.error;

  const currentSources = sourceSets[view];
  const filteredSources = useMemo(() => {
    const term = sourceSearch.trim().toLowerCase();
    if (!term) return currentSources;
    return currentSources.filter((source) =>
      `${source.name} ${source.group}`.toLowerCase().includes(term),
    );
  }, [currentSources, sourceSearch]);

  const filteredItems = useMemo(() => {
    const term = articleSearch.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      `${item.title} ${item.creator} ${item.description} ${item.categories.join(" ")}`
        .toLowerCase()
        .includes(term),
    );
  }, [items, articleSearch]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/feed?path=${encodeURIComponent(active.path)}&page=1`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load this feed.");
        return data;
      })
      .then((data) => setFeed({
        path: active.path,
        items: data.items ?? [],
        error: "",
        page: data.page ?? 1,
        hasMore: data.hasMore ?? false,
      }))
      .catch((reason) => {
        if (reason.name !== "AbortError") {
          setFeed({ path: active.path, items: [], error: reason.message, page: 0, hasMore: false });
        }
      });
    return () => controller.abort();
  }, [active.path]);

  function chooseSource(source: Source) {
    setArticleSearch("");
    setLoadMoreError("");
    setActive(source);
  }

  async function loadOlder() {
    const requestedPath = active.path;
    const nextPage = feed.page + 1;
    setLoadingMore(true);
    setLoadMoreError("");
    try {
      const response = await fetch(
        `/api/feed?path=${encodeURIComponent(requestedPath)}&page=${nextPage}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load older recipes.");
      setFeed((current) => {
        if (current.path !== requestedPath) return current;
        const links = new Set(current.items.map((item) => item.link));
        const older = (data.items ?? []).filter((item: FeedItem) => !links.has(item.link));
        return {
          ...current,
          items: [...current.items, ...older],
          page: data.page ?? nextPage,
          hasMore: (data.hasMore ?? false) && older.length > 0,
        };
      });
    } catch (reason) {
      setLoadMoreError(reason instanceof Error ? reason.message : "Could not load older recipes.");
    } finally {
      setLoadingMore(false);
    }
  }

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
        <div className="source-tally" aria-label={`${SOURCE_COUNT} verified sources`}>
          <strong>{SOURCE_COUNT}</strong>
          <span>verified sources</span>
        </div>
      </header>

      <section className="workspace" aria-label="Recipe browser">
        <aside className="source-panel">
          <div className="panel-intro">
            <div>
              <p className="section-kicker">Browse by</p>
              <h2>Choose a shelf</h2>
            </div>
            <SlidersHorizontal aria-hidden="true" />
          </div>

          <Tabs
            value={view}
            onValueChange={(value) => {
              const nextView = value as View;
              setView(nextView);
              setSourceSearch("");
              setArticleSearch("");
              setLoadMoreError("");
              setActive(sourceSets[nextView][0]);
            }}
          >
            <TabsList className="view-tabs" aria-label="Source type">
              <TabsTrigger value="collections"><Clock3 />Quick</TabsTrigger>
              <TabsTrigger value="topics"><UtensilsCrossed />Topics</TabsTrigger>
              <TabsTrigger value="writers"><ChefHat />Writers</TabsTrigger>
            </TabsList>
          </Tabs>

          <label className="search-field">
            <span className="sr-only">Search sources</span>
            <Search aria-hidden="true" />
            <Input
              value={sourceSearch}
              onChange={(event) => setSourceSearch(event.target.value)}
              placeholder={view === "writers" ? "Find a writer…" : "Find a topic…"}
            />
          </label>

          <ScrollArea className="source-scroll">
            <SourceList sources={filteredSources} active={active} onSelect={chooseSource} />
          </ScrollArea>
        </aside>

        <section className="feed-panel" aria-live="polite">
          <div className="feed-heading">
            <div>
              <p className="section-kicker">Latest from</p>
              <h2>{active.name}</h2>
              <p className="feed-note">
                {loading ? "Loading the archive…" : `${items.length} articles loaded · keep loading older pages as far back as you like.`}
              </p>
            </div>
            <Button asChild variant="outline" className="collection-link">
              <a href={`${GUARDIAN}${active.path}`} target="_blank" rel="noreferrer">
                Open collection <ExternalLink />
              </a>
            </Button>
          </div>

          <label className="article-search search-field">
            <span className="sr-only">Filter these articles</span>
            <Search aria-hidden="true" />
            <Input
              value={articleSearch}
              onChange={(event) => setArticleSearch(event.target.value)}
              placeholder="Filter these titles…"
              disabled={loading || !!error}
            />
          </label>

          <ScrollArea className="feed-scroll">
            {loading ? <ArticleSkeleton /> : null}

            {!loading && error ? (
              <div className="feed-message">
                <BookOpenText aria-hidden="true" />
                <h3>The list is taking a break</h3>
                <p>{error}</p>
                <Button asChild>
                  <a href={`${GUARDIAN}${active.path}`} target="_blank" rel="noreferrer">
                    Open on the Guardian <ExternalLink />
                  </a>
                </Button>
              </div>
            ) : null}

            {!loading && !error && !filteredItems.length ? (
              <div className="feed-message compact">
                <Search aria-hidden="true" />
                <h3>No matching titles</h3>
                <p>Try a shorter or broader phrase.</p>
              </div>
            ) : null}

            {!loading && !error ? (
              <div className="article-list">
                {filteredItems.map((item) => (
                  <article className="article-row" key={item.link}>
                    <a className="article-main" href={item.link} target="_blank" rel="noreferrer">
                      <div className="article-meta">
                        {item.categories[0] ? <span>{item.categories[0]}</span> : null}
                        {item.published ? <time>{formatDate(item.published)}</time> : null}
                      </div>
                      <h3>{item.title}</h3>
                      {item.description ? <p>{item.description}</p> : null}
                      <div className="article-byline">
                        <span>{item.creator || "The Guardian"}</span>
                        <span className="read-link">Read on the Guardian <ArrowUpRight /></span>
                      </div>
                    </a>
                    {item.image ? (
                      <a className="article-image" href={item.link} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden="true">
                        {/* RSS images are supplied by the Guardian and link back to the source article. */}
                        <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      </a>
                    ) : null}
                  </article>
                ))}
                {!articleSearch && (feed.hasMore || loadingMore || loadMoreError) ? (
                  <div className="load-more-row">
                    {loadMoreError ? <p>{loadMoreError}</p> : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={loadOlder}
                      disabled={loadingMore}
                    >
                      {loadingMore ? <LoaderCircle className="spin" /> : <Clock3 />}
                      {loadingMore ? "Loading older recipes…" : "Load 20 older recipes"}
                    </Button>
                    <span>Currently showing {items.length}</span>
                  </div>
                ) : null}
                {!articleSearch && !feed.hasMore && items.length ? (
                  <p className="archive-end">You’ve reached the end of this Guardian archive.</p>
                ) : null}
              </div>
            ) : null}
          </ScrollArea>
        </section>
      </section>

      <footer>
        <p>Personal-use index · Titles and images come from public Guardian listing pages · Articles always open on the Guardian</p>
        <a href="https://www.theguardian.com/help/terms-of-service" target="_blank" rel="noreferrer">Guardian terms <ArrowUpRight /></a>
      </footer>
    </main>
  );
}
