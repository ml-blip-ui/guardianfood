import { NextRequest, NextResponse } from "next/server";
import { fetchFeedPage } from "@/lib/guardian";
import { listingPath, shelfById } from "@/lib/sources";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");

  // Shelves are resolved by id, so the only Guardian paths this route can
  // ever fetch are the ones listed in lib/sources.ts.
  const shelf = shelfById(id);
  if (!shelf || !Number.isInteger(page) || page < 1 || page > 200) {
    return NextResponse.json({ error: "That shelf is not one I know about." }, { status: 400 });
  }

  const paths = shelf.paths.map((path) => listingPath(path, shelf.recipesOnly));
  const result = await fetchFeedPage(paths, page);

  if (!result.items.length && page === 1) {
    return NextResponse.json(
      { error: "The Guardian index could not be loaded just now. You can still open the collection directly." },
      { status: 502 },
    );
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200" },
  });
}
