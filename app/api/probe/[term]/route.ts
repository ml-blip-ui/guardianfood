import { NextResponse } from "next/server";

/**
 * Diagnostics for ingredient search.
 *
 * Nothing here can reach theguardian.com, so when a search comes back empty
 * there is no way to tell a missing tag from a parser that cannot read the
 * page. This reports what the Guardian actually sends back — status, how many
 * article links are present, and a sample of the raw markup — so the parser
 * can be fixed against real HTML instead of guesswork.
 *
 * The term is only ever substituted into the fixed URL shapes below, so this
 * cannot be used to fetch arbitrary pages.
 */

const GUARDIAN = "https://www.theguardian.com";
const ARTICLE_PATH = /^(?:\/[a-z0-9-]+){1,3}\/\d{4}\/[a-z]{3}\/\d{1,2}\//i;

function slugify(query: string) {
  return query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function href(tag: string) {
  return tag.match(/\bhref=["']([^"']*)["']/i)?.[1] ?? "";
}

const READER_HEADERS = { "User-Agent": "Guardian Recipe Finder/2.0 (personal index reader)" };
/** What a browser sends. Used on one probe to test whether headers matter. */
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};

async function probe(label: string, path: string, headers: Record<string, string> = READER_HEADERS) {
  const url = `${GUARDIAN}${path}`;
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    const html = response.ok ? await response.text() : "";
    const anchors = [...html.matchAll(/<a\b[^>]*>/gi)].map((m) => m[0]);
    const articleAnchors = anchors.filter((tag) => ARTICLE_PATH.test(href(tag)));
    const withAriaLabel = articleAnchors.filter((tag) => /\baria-label=["'][^"']+["']/i.test(tag));

    return {
      label,
      url,
      status: response.status,
      redirectedTo: response.redirected ? response.url : null,
      bytes: html.length,
      articleLinks: articleAnchors.length,
      withAriaLabel: withAriaLabel.length,
      // Where a page holds article links but none carry an aria-label, these
      // show what the parser should key off instead.
      sampleArticleAnchors: articleAnchors.slice(0, 3).map((tag) => tag.slice(0, 260)),
      sampleHrefs: [...new Set(articleAnchors.map(href))].slice(0, 5),
    };
  } catch (reason) {
    return { label, url, error: reason instanceof Error ? `${reason.name}: ${reason.message}` : "failed" };
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ term: string }> },
) {
  const { term: rawTerm } = await params;
  const term = decodeURIComponent(rawTerm).trim().slice(0, 60);
  const slug = slugify(term);
  if (!slug) return NextResponse.json({ error: "Give me a word to probe." }, { status: 400 });

  // Controls first. The Eggs shelf is known to return 20 articles, so if these
  // fail too the probe itself is being refused and no candidate below means
  // anything.
  const probes = await Promise.all([
    probe("CONTROL known-good tag", "/food/eggs"),
    probe("CONTROL known-good intersection", "/tone/recipes+food/eggs"),

    probe("ingredient tag alone", `/food/${slug}`),
    probe("recipes + ingredient tag", `/tone/recipes+food/${slug}`),
    probe("ingredient + recipes, reversed", `/food/${slug}+tone/recipes`),

    probe("search", `/search?q=${encodeURIComponent(term)}`),
    probe("search, browser headers", `/search?q=${encodeURIComponent(term)}`, BROWSER_HEADERS),
    probe("search with section", `/search?q=${encodeURIComponent(term)}&section=food`),
    probe("uk search", `/uk/search?q=${encodeURIComponent(term)}`),
    probe("all sections search", `/all?q=${encodeURIComponent(term)}`),
  ]);

  return NextResponse.json({ term, slug, probes }, { headers: { "Cache-Control": "no-store" } });
}
