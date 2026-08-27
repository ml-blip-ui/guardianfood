/**
 * Pings every Guardian path the app can ask for and reports the dead ones.
 *
 * Run with: npm run check:sources
 *
 * This needs real network access to theguardian.com. It is the way to answer
 * two questions the code cannot answer on its own:
 *
 *   1. Do the tag-intersection URLs (/tone/recipes+food/eggs) work?
 *   2. Do all the hand-written tag slugs still exist?
 *
 * Anything reported below is a shelf that will show an error in the app.
 */

import { ALL_SHELVES, listingPath } from "../lib/sources.ts";

const GUARDIAN = "https://www.theguardian.com";
const CONCURRENCY = 4;

type Result = { shelf: string; url: string; status: number | string; articles: number };

async function probe(shelf: string, path: string): Promise<Result> {
  const url = `${GUARDIAN}${path}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Guardian Recipe Finder/2.0 (personal index reader)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return { shelf, url, status: response.status, articles: 0 };
    const html = await response.text();
    const { parseListing } = await import("../lib/guardian.ts");
    return { shelf, url, status: 200, articles: parseListing(html).length };
  } catch (reason) {
    return { shelf, url, status: reason instanceof Error ? reason.name : "failed", articles: 0 };
  }
}

const jobs: { shelf: string; path: string }[] = [];
for (const shelf of ALL_SHELVES) {
  for (const path of shelf.paths) {
    jobs.push({ shelf: shelf.name, path: listingPath(path, shelf.recipesOnly) });
  }
}

console.log(`Checking ${jobs.length} Guardian paths across ${ALL_SHELVES.length} shelves…\n`);

const results: Result[] = [];
for (let i = 0; i < jobs.length; i += CONCURRENCY) {
  const batch = jobs.slice(i, i + CONCURRENCY);
  results.push(...(await Promise.all(batch.map((job) => probe(job.shelf, job.path)))));
  process.stdout.write(`\r  ${Math.min(i + CONCURRENCY, jobs.length)}/${jobs.length}`);
  await new Promise((resolve) => setTimeout(resolve, 250));
}
console.log("\n");

const broken = results.filter((r) => r.status !== 200);
const empty = results.filter((r) => r.status === 200 && r.articles === 0);
const thin = results.filter((r) => r.status === 200 && r.articles > 0 && r.articles < 5);

if (broken.length) {
  console.log(`${broken.length} path(s) did not load:`);
  for (const r of broken) console.log(`  [${r.status}] ${r.shelf} — ${r.url}`);
  console.log("");
}
if (empty.length) {
  console.log(`${empty.length} path(s) loaded but produced no articles:`);
  for (const r of empty) console.log(`  ${r.shelf} — ${r.url}`);
  console.log("");
}
if (thin.length) {
  console.log(`${thin.length} path(s) returned very few articles (worth a look):`);
  for (const r of thin) console.log(`  ${r.articles} articles — ${r.shelf} — ${r.url}`);
  console.log("");
}
if (!broken.length && !empty.length && !thin.length) {
  console.log("Every path loaded and returned articles.");
}

process.exit(broken.length || empty.length ? 1 : 0);
