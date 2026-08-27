import { NextResponse } from "next/server";
import { fetchFeedPage } from "@/lib/guardian";
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
