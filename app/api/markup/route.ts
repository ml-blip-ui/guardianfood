import { NextResponse } from "next/server";

/**
 * Reports where images actually sit in a Guardian listing page.
 *
 * The parser slices a card from one headline anchor to the next and takes the
 * first <img> it finds. That is right only if a card's image comes after its
 * headline link. If it comes before, the slice picks up the *next* recipe's
 * photo — which would be worse than no photo at all. Nothing here can reach
 * theguardian.com, so this asks the deployed site instead.
 *
 * Fetches one fixed URL and takes no input, so it cannot be pointed anywhere.
 */

const URL_TO_READ = "https://www.theguardian.com/tone/recipes";
const ARTICLE_PATH = /^(?:\/[a-z0-9-]+){1,3}\/\d{4}\/[a-z]{3}\/\d{1,2}\//i;
/** How far either side of an anchor counts as "near" it. */
const WINDOW = 1500;

function attr(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] ?? "";
}

/** Trim a long srcset or data URI to something readable in a pasted report. */
function short(value: string, limit = 150) {
  return value.length > limit ? `${value.slice(0, limit)}…(+${value.length - limit})` : value;
}

function describe(tag: string) {
  const bits = ["src", "srcset", "data-src", "data-srcset", "loading", "class"]
    .map((name) => [name, attr(tag, name)] as const)
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}="${short(value)}"`);
  return `<${tag.match(/^<(\w+)/)?.[1] ?? "?"} ${bits.join(" ")}>`;
}

export async function GET() {
  try {
    const response = await fetch(URL_TO_READ, {
      headers: { "User-Agent": "Guardian Recipe Finder/2.0 (personal index reader)" },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: `${URL_TO_READ} returned ${response.status}` }, { status: 502 });
    }
    const html = await response.text();

    const anchors = [...html.matchAll(/<a\b[^>]*>/gi)]
      .map((m) => ({ index: m.index ?? 0, tag: m[0], href: attr(m[0], "href"), label: attr(m[0], "aria-label") }))
      .filter((a) => ARTICLE_PATH.test(a.href) && a.label);

    const imageTags = /<(?:img|source)\b[^>]*>/gi;
    const cards = anchors.slice(0, 6).map((anchor, i) => {
      const next = anchors[i + 1]?.index ?? html.length;
      const after = html.slice(anchor.index, Math.min(next, anchor.index + WINDOW));
      const before = html.slice(Math.max(0, anchor.index - WINDOW), anchor.index);
      return {
        href: anchor.href,
        gapToNextAnchor: next - anchor.index,
        // What the parser currently takes.
        imagesAfterAnchor: (after.match(imageTags) ?? []).slice(0, 3).map(describe),
        // What it would take if a card's image precedes its headline link.
        imagesBeforeAnchor: (before.match(imageTags) ?? []).slice(-3).map(describe),
      };
    });

    const withImgAfter = cards.filter((c) => c.imagesAfterAnchor.length).length;
    const withImgBefore = cards.filter((c) => c.imagesBeforeAnchor.length).length;

    return NextResponse.json(
      {
        url: URL_TO_READ,
        bytes: html.length,
        articleAnchors: anchors.length,
        sampled: cards.length,
        withImagesAfterAnchor: withImgAfter,
        withImagesBeforeAnchor: withImgBefore,
        totalImgTagsOnPage: (html.match(/<img\b/gi) ?? []).length,
        totalSourceTagsOnPage: (html.match(/<source\b/gi) ?? []).length,
        cards,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (reason) {
    return NextResponse.json(
      { error: reason instanceof Error ? `${reason.name}: ${reason.message}` : "failed" },
      { status: 502 },
    );
  }
}
