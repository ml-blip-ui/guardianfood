/**
 * Guardian recipe search via Google's Programmable Search JSON API.
 *
 * The Guardian retired its own site search and hands off to Google, so this is
 * the only way to find a recipe the Guardian has no tag for — cauliflower being
 * the case that started it.
 *
 * The key is read server-side only and never reaches the browser. With no key
 * configured, this returns nothing and the caller falls back to offering a
 * plain Google link, exactly as the app behaves today.
 */

import { dateFromUrl } from "./guardian.ts";
import type { Article } from "./guardian.ts";

const ENDPOINT = "https://www.googleapis.com/customsearch/v1";
const PER_PAGE = 10;
/** Google's API will not page past 100 results. */
const MAX_START = 91;
const FETCH_TIMEOUT_MS = 8000;

type GoogleItem = {
  title?: string;
  link?: string;
  snippet?: string;
  pagemap?: {
    cse_image?: { src?: string }[];
    cse_thumbnail?: { src?: string }[];
    metatags?: Record<string, string>[];
  };
};

export function googleSearchConfigured() {
  return Boolean(process.env.GOOGLE_SEARCH_KEY && process.env.GOOGLE_SEARCH_CX);
}

/** Google appends the masthead to page titles; the app supplies its own. */
export function cleanTitle(title: string) {
  return title
    .replace(/\s*[|–—-]\s*The Guardian\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Snippets arrive with a leading date stamp and ellipses. Strip both. */
export function cleanSnippet(snippet: string) {
  return snippet
    .replace(/^\s*\w{3}\s+\d{1,2},\s+\d{4}\s*\.{3}\s*/i, "")
    .replace(/ /g, " ")
    .replace(/\s*\.{3}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function imageFrom(item: GoogleItem) {
  return (
    item.pagemap?.cse_image?.[0]?.src ??
    item.pagemap?.metatags?.[0]?.["og:image"] ??
    item.pagemap?.cse_thumbnail?.[0]?.src ??
    ""
  );
}

/** Only Guardian article URLs, which are the ones carrying a date. */
function isGuardianArticle(link: string) {
  return /^https?:\/\/(www\.)?theguardian\.com\//i.test(link) && Boolean(dateFromUrl(link));
}

export function toArticles(items: GoogleItem[]): Article[] {
  const seen = new Set<string>();
  const articles: Article[] = [];
  for (const item of items) {
    const link = item.link ?? "";
    const title = cleanTitle(item.title ?? "");
    if (!title || !isGuardianArticle(link) || seen.has(link)) continue;
    seen.add(link);
    articles.push({
      title,
      link,
      description: cleanSnippet(item.snippet ?? ""),
      kicker: "",
      published: dateFromUrl(link),
      image: imageFrom(item),
    });
  }
  return articles;
}

/** "cauliflower" searches better as "cauliflower recipe". */
export function buildQuery(term: string) {
  return /\brecipes?\b/i.test(term) ? term.trim() : `${term.trim()} recipe`;
}

export async function googleSearch(term: string, page: number): Promise<Article[]> {
  if (!googleSearchConfigured()) return [];
  const start = (page - 1) * PER_PAGE + 1;
  if (start > MAX_START) return [];

  const url = new URL(ENDPOINT);
  url.searchParams.set("key", process.env.GOOGLE_SEARCH_KEY!);
  url.searchParams.set("cx", process.env.GOOGLE_SEARCH_CX!);
  url.searchParams.set("q", buildQuery(term));
  url.searchParams.set("num", String(PER_PAGE));
  url.searchParams.set("start", String(start));
  url.searchParams.set("safe", "off");

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // A day's cache: the free allowance is 100 searches, and repeating a
      // search should not spend another one.
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      console.error(`[google] "${term}" returned ${response.status}`);
      return [];
    }
    const data = (await response.json()) as { items?: GoogleItem[] };
    return toArticles(data.items ?? []);
  } catch (reason) {
    console.error(`[google] "${term}" failed:`, reason);
    return [];
  }
}
