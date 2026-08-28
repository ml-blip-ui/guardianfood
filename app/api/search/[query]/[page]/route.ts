import { NextResponse } from "next/server";
import { searchRecipes } from "@/lib/recipe-search";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ query: string; page: string }> },
) {
  const { query: rawQuery, page: rawPage } = await params;
  const query = decodeURIComponent(rawQuery).trim();
  const page = Number(rawPage);

  if (query.length < 2 || query.length > 80 || !Number.isInteger(page) || page < 1 || page > 200) {
    return NextResponse.json({ error: "Try a slightly longer search term." }, { status: 400 });
  }

  const result = await searchRecipes(query, page);
  // `route`, `tried` and `indexed` are echoed so a search that finds nothing
  // can say what it actually looked in, rather than just shrugging.
  return NextResponse.json(
    { ...result, query },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } },
  );
}
