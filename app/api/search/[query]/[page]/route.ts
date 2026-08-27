import { NextResponse } from "next/server";
import { search } from "@/lib/guardian";

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

  const result = await search(query, page);
  return NextResponse.json(
    { ...result, query },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } },
  );
}
