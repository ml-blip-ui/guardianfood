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

async function probe(label: string, path: string) {
  const url = `${GUARDIAN}${path}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Guardian Recipe Finder/2.0 (personal index reader)" },
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
      anchors: anchors.length,
      articleLinks: articleAnchors.length,
      articleLinksWithAriaLabel: withAriaLabel.length,
      // The parser keys off aria-label. Where that count is zero but there are
      // article links, these samples show what it should key off instead.
      sampleArticleAnchors: articleAnchors.slice(0, 4).map((tag) => tag.slice(0, 300)),
      sampleHrefs: [...new Set(articleAnchors.map(href))].slice(0, 6),
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

  const probes = await Promise.all([
    probe("recipes + ingredient tag", `/tone/recipes+food/${slug}`),
    probe("ingredient tag alone", `/food/${slug}`),
    probe("guardian text search", `/search?q=${encodeURIComponent(term)}`),
    probe("text search, food filtered", `/food/search?q=${encodeURIComponent(term)}`),
  ]);

  return NextResponse.json({ term, slug, probes }, { headers: { "Cache-Control": "no-store" } });
}
