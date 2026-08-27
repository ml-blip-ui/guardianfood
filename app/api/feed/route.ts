import { NextRequest, NextResponse } from "next/server";

const GUARDIAN = "https://www.theguardian.com";
const ARTICLE_PATH = /^(?:\/[a-z0-9-]+){1,3}\/\d{4}\/[a-z]{3}\/\d{1,2}\//i;

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;|&#x22;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"));
  return match ? decodeHtml(match[1].trim()) : "";
}

function plainText(value: string) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseListing(html: string) {
  const anchors = [...html.matchAll(/<a\b[^>]*>/gi)]
    .map((match) => ({
      index: match.index,
      tag: match[0],
      href: attribute(match[0], "href"),
      label: attribute(match[0], "aria-label"),
    }))
    .filter((anchor) => ARTICLE_PATH.test(anchor.href) && anchor.label);

  const seen = new Set<string>();
  return anchors.flatMap((anchor, index) => {
    if (seen.has(anchor.href)) return [];
    seen.add(anchor.href);

    const nextIndex = anchors[index + 1]?.index ?? Math.min(anchor.index + 12000, html.length);
    const card = html.slice(anchor.index, nextIndex);
    const timeTag = card.match(/<time\b[^>]*>/i)?.[0] ?? "";
    const imageTag = card.match(/<img\b[^>]*\bsrc=["'][^"']+["'][^>]*>/i)?.[0] ?? "";
    const headline = card.match(/<h3\b[^>]*class=["'][^"']*card-headline[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? "";
    const kicker = headline.match(/<div\b[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
    const description = card.match(/<div\b[^>]*class=["'][^"']*dcr-qda0hp[^"']*["'][^>]*>[\s\S]*?<div\b[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";

    return [{
      title: plainText(anchor.label),
      link: `${GUARDIAN}${anchor.href}`,
      creator: "The Guardian",
      description: plainText(description),
      categories: kicker ? [plainText(kicker)] : [],
      published: attribute(timeTag, "dateTime"),
      image: attribute(imageTag, "src"),
    }];
  }).slice(0, 20);
}

export async function GET(request: NextRequest) {
  const requestedPath = request.nextUrl.searchParams.get("path") ?? "";
  const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? "1");
  if (
    !requestedPath.startsWith("/") ||
    requestedPath.includes("..") ||
    /[?#]/.test(requestedPath) ||
    !Number.isInteger(requestedPage) ||
    requestedPage < 1 ||
    requestedPage > 500
  ) {
    return NextResponse.json({ error: "That Guardian page is not valid." }, { status: 400 });
  }

  const path = requestedPath.replace(/\/rss\/?$/, "").replace(/\/$/, "");
  const listingUrl = `${GUARDIAN}${path}?page=${requestedPage}`;
  try {
    const response = await fetch(listingUrl, {
      headers: { "User-Agent": "Guardian Recipe Finder/1.1 (personal index reader)" },
      next: { revalidate: 1800 },
    });
    if (!response.ok) throw new Error(`Guardian returned ${response.status}`);
    const items = parseListing(await response.text());
    return NextResponse.json(
      {
        items,
        page: requestedPage,
        hasMore: items.length === 20,
        listingUrl,
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200" } },
    );
  } catch {
    return NextResponse.json(
      { error: "The Guardian index could not be loaded just now. You can still open the collection directly." },
      { status: 502 },
    );
  }
}
