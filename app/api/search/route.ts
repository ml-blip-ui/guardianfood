import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/guardian";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");

  if (query.length < 2 || query.length > 80 || !Number.isInteger(page) || page < 1 || page > 200) {
    return NextResponse.json({ error: "Try a slightly longer search term." }, { status: 400 });
  }

  const result = await search(query, page);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
  });
}
