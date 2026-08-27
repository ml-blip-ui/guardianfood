/**
 * Reads public Guardian listing pages and turns them into article records.
 *
 * Deliberately conservative about what it trusts in the markup: the title
 * comes from the link's aria-label and the date from the URL itself, both of
 * which survive a restyle. Images, kickers and descriptions are best-effort
 * and simply come back empty if the Guardian changes its markup.
 */

const GUARDIAN = "https://www.theguardian.com";
const ARTICLE_PATH = /^(?:\/[a-z0-9-]+){1,3}\/\d{4}\/[a-z]{3}\/\d{1,2}\//i;
const FETCH_TIMEOUT_MS = 8000;

export type Article = {
  title: string;
  link: string;
  description: string;
  kicker: string;
  /** ISO date, derived from the article URL. */
  published: string;
  image: string;
};

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Guardian article URLs carry their own date (/2026/aug/01/), which is far
 * more dependable than the markup around them.
 */
export function dateFromUrl(href: string): string {
  const match = href.match(/\/(\d{4})\/([a-z]{3})\/(\d{1,2})\//i);
  if (!match) return "";
  const month = MONTHS[match[2].toLowerCase()];
  if (month === undefined) return "";
  return new Date(Date.UTC(Number(match[1]), month, Number(match[3]))).toISOString();
}

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;|&#x22;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"));
  return match ? decodeHtml(match[1].trim()) : "";
}

/** Strip markup first, then decode entities, so encoded angle brackets survive. */
function plainText(value: string) {
  const withoutTags = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeHtml(withoutTags).replace(/\s+/g, " ").trim();
}

export function parseListing(html: string): Article[] {
  const anchors = [...html.matchAll(/<a\b[^>]*>/gi)]
    .map((match) => ({
      index: match.index ?? 0,
      href: attribute(match[0], "href"),
      label: attribute(match[0], "aria-label"),
    }))
    .filter((anchor) => ARTICLE_PATH.test(anchor.href) && anchor.label);

  const seen = new Set<string>();
  const articles: Article[] = [];

  anchors.forEach((anchor, index) => {
    if (seen.has(anchor.href)) return;
    seen.add(anchor.href);

    const nextIndex = anchors[index + 1]?.index ?? Math.min(anchor.index + 12000, html.length);
    const card = html.slice(anchor.index, nextIndex);

    const imageTag = card.match(/<img\b[^>]*\bsrc=["'][^"']+["'][^>]*>/i)?.[0] ?? "";
    const headline = card.match(/<h3\b[^>]*class=["'][^"']*card-headline[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? "";
    const kicker = headline.match(/<div\b[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
    // Generated class name, so this is the first thing to break on a Guardian
    // deploy. Losing it costs a description, nothing more.
    const description = card.match(/<div\b[^>]*class=["'][^"']*dcr-[a-z0-9]+[^"']*["'][^>]*>[\s\S]*?<div\b[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";

    articles.push({
      title: plainText(anchor.label),
      link: `${GUARDIAN}${anchor.href}`,
      description: plainText(description),
      kicker: plainText(kicker),
      published: dateFromUrl(anchor.href),
      image: attribute(imageTag, "src"),
    });
  });

  return articles;
}

async function fetchListing(path: string, page: number): Promise<Article[]> {
  const url = `${GUARDIAN}${path}?page=${page}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Guardian Recipe Finder/2.0 (personal index reader)" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: 1800 },
    });
    if (!response.ok) {
      console.error(`[guardian] ${url} returned ${response.status}`);
      return [];
    }
    return parseListing(await response.text());
  } catch (reason) {
    console.error(`[guardian] ${url} failed:`, reason);
    return [];
  }
}

export type FeedPage = {
  items: Article[];
  page: number;
  hasMore: boolean;
};

/**
 * Fetch one page from each path and merge them.
 *
 * Merged pages are sorted internally but appended whole by the client rather
 * than re-sorted across pages: for a blended shelf like Drinks that keeps the
 * feed from reshuffling under the reader mid-scroll, at the cost of slightly
 * ragged ordering where one page meets the next.
 */
export async function fetchFeedPage(paths: string[], page: number): Promise<FeedPage> {
  const results = await Promise.all(paths.map((path) => fetchListing(path, page)));

  const seen = new Set<string>();
  const items: Article[] = [];
  for (const result of results) {
    for (const article of result) {
      if (seen.has(article.link)) continue;
      seen.add(article.link);
      items.push(article);
    }
  }

  items.sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : 0));

  return { items, page, hasMore: items.length > 0 };
}

/**
 * Ingredient search, by Guardian tag.
 *
 * The Guardian retired its own site search and hands off to Google, so
 * /search?q= is a 404 and there is nothing to scrape. What does work is the
 * tag system: /tone/recipes+food/eggs returns a proper recipe listing, the
 * same mechanism the shelves use.
 *
 * So a search is a tag lookup. When the Guardian has no tag for a word — it
 * tags eggs and tomatoes but not cauliflower — there is no in-app answer, and
 * the caller offers a Google site search instead.
 */

export type SearchResult = FeedPage & {
  /** Whether a Guardian tag answered this, and which paths were tried. */
  route: "tag" | "none";
  tried: string[];
};

export function slugify(query: string) {
  return query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Guardian ingredient tags are inconsistently pluralised — "eggs" and
 * "tomatoes" but "chicken" and "pasta" — so try the obvious variants.
 */
export function tagCandidates(slug: string) {
  const variants = new Set([slug]);
  if (slug.endsWith("es")) {
    variants.add(slug.slice(0, -2));
  } else if (slug.endsWith("s")) {
    variants.add(slug.slice(0, -1));
  } else {
    variants.add(`${slug}s`);
    if (/(?:o|ch|sh|s|x|z)$/.test(slug)) variants.add(`${slug}es`);
  }
  return [...variants].filter(Boolean);
}

export async function search(query: string, page: number): Promise<SearchResult> {
  const slug = slugify(query);
  if (!slug) return { items: [], page, hasMore: false, route: "none", tried: [] };

  const tagPaths = tagCandidates(slug).map((candidate) => `/tone/recipes+food/${candidate}`);
  const tagResults = await Promise.all(tagPaths.map((path) => fetchListing(path, page)));
  const fromTag = tagResults.find((result) => result.length > 0);
  if (fromTag) {
    return { items: fromTag, page, hasMore: fromTag.length > 0, route: "tag", tried: tagPaths };
  }

  return { items: [], page, hasMore: false, route: "none", tried: tagPaths };
}

/** Where to send someone when the Guardian has no tag for what they typed. */
export function googleSiteSearch(term: string) {
  const query = `site:theguardian.com/food ${term} recipe`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
