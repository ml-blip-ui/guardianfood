import { NextResponse } from "next/server";
import { indexStatus } from "@/lib/recipe-search";

/**
 * What the deployed build knows about its own recipe index.
 *
 * The index is a file baked into the build, so after a deploy the only thing
 * worth asking is whether the crawled file actually travelled with it. This
 * says so, and the diagnostics page reads it.
 */
export async function GET() {
  return NextResponse.json(indexStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
