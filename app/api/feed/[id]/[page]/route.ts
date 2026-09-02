import { NextResponse } from "next/server";
import { fetchFeedPage } from "@/lib/guardian";
import { shelfFromIndex } from "@/lib/recipe-search";
import { listingPath, shelfById } from "@/lib/sources";

/**
 * The shelf and page are path segments rather than query parameters on
 * purpose. A CDN that keys its cache on the path alone would otherwise serve
 * one shelf's articles for every shelf, which is exactly what happened when
 * this was /api/feed?id=… behind Netlify's edge cache.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; page: string }> },
) {
  const { id, page: rawPage } = await params;
  const page = Number(rawPage);

  // Shelves are resolved by id, so the only Guardian paths this route can
  // ever fetch are the ones listed in lib/sources.ts.
  const shelf = shelfById(decodeURIComponent(id));
  if (!shelf || !Number.isInteger(page) || page < 1 || page > 200) {
    return NextResponse.json({ error: "That shelf is not one I know about." }, { status: 400 });
  }

  // Some shelves are built from our own index because the Guardian never
  // tagged the thing they are about. Pulses is the first of them.
  if (shelf.anyOf?.length) {
    const result = shelfFromIndex(shelf.anyOf, shelf.except, page);
    if (!result.indexed) {
      return NextResponse.json(
        {
          id: shelf.id,
          error:
            "This shelf is built from the app’s own recipe index, which has not been built yet. Run the crawl from the Actions tab, then redeploy.",
        },
        { status: 503 },
      );
    }
    // A built index with nothing to say is an ordinary empty shelf, not an
    // error, so it falls through to the usual empty state.
    return NextResponse.json(
      { ...result, id: shelf.id, paths: [] },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200" } },
    );
  }

  const paths = shelf.paths.map((path) => listingPath(path, shelf.recipesOnly));
  const result = await fetchFeedPage(paths, page);

  if (!result.items.length && page === 1) {
    return NextResponse.json(
      {
        id: shelf.id,
        error: "The Guardian index could not be loaded just now. You can still open the collection directly.",
      },
      { status: 502 },
    );
  }

  // `id` is echoed so the client can prove the response belongs to the shelf
  // it asked for rather than silently rendering someone else's recipes.
  return NextResponse.json(
    { ...result, id: shelf.id, paths },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200" } },
  );
}
