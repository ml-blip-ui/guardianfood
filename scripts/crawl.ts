/**
 * Builds the searchable recipe index.
 *
 * Walks the Guardian's own recipes tag page by page until it runs out, and
 * writes one flat record per recipe to data/recipes.json.
 *
 *   npm run crawl          full crawl, as deep as the Guardian will page
 *   npm run crawl -- 3     only the newest 3 pages, merged into what exists
 *
 * The second form is the scheduled refresh: new recipes appear at the front,
 * so a handful of requests keeps the index current. Needs real network access
 * to theguardian.com, so it runs on GitHub Actions rather than here.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseListing, dateFromUrl } from "../lib/guardian.ts";
import type { IndexedRecipe, RecipeIndex } from "../lib/recipe-index.ts";

const GUARDIAN = "https://www.theguardian.com";
const SOURCE = "/tone/recipes";
const OUT = "data/recipes.json";
/** Be a polite guest: one page at a time, with a pause between. */
const PAUSE_MS = 400;
/** A stop, not a target — the loop ends when pages come back empty. */
const MAX_PAGES = 900;
/** Two empty pages in a row means the end, rather than one odd blank. */
const EMPTY_RUN_TO_STOP = 2;

async function fetchPage(page: number) {
  const url = `${GUARDIAN}${SOURCE}?page=${page}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Guardian Recipe Finder/2.0 (personal index reader)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return parseListing(await response.text());
}

function readExisting(): IndexedRecipe[] {
  try {
    return (JSON.parse(readFileSync(OUT, "utf8")) as RecipeIndex).recipes ?? [];
  } catch {
    return [];
  }
}

const pageLimit = Number(process.argv[2]) || MAX_PAGES;
const existing = readExisting();
const byPath = new Map(existing.map((recipe) => [recipe.p, recipe]));
console.log(existing.length ? `Starting from ${existing.length} known recipes.` : "Starting fresh.");
console.log(`Reading ${GUARDIAN}${SOURCE}, up to ${pageLimit} pages.\n`);

let added = 0;
let empties = 0;
let lastPage = 0;

for (let page = 1; page <= pageLimit; page += 1) {
  let items;
  try {
    items = await fetchPage(page);
  } catch (reason) {
    console.log(`\npage ${page}: ${reason instanceof Error ? reason.message : "failed"} — stopping here`);
    break;
  }

  if (!items.length) {
    empties += 1;
    if (empties >= EMPTY_RUN_TO_STOP) {
      console.log(`\nTwo empty pages at ${page}. That is the end of the archive.`);
      break;
    }
    continue;
  }
  empties = 0;
  lastPage = page;

  for (const item of items) {
    const path = item.link.replace(GUARDIAN, "");
    const published = dateFromUrl(path).slice(0, 10);
    if (!published || byPath.has(path)) continue;
    byPath.set(path, {
      p: path,
      t: item.title,
      d: item.description,
      w: published,
      i: item.image,
    });
    added += 1;
  }

  if (page % 10 === 0 || page === 1) {
    process.stdout.write(`\r  page ${page} · ${byPath.size} recipes · ${added} new`);
  }
  await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
}

const recipes = [...byPath.values()].sort((a, b) => b.w.localeCompare(a.w));
const index: RecipeIndex = {
  builtAt: new Date().toISOString(),
  count: recipes.length,
  recipes,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(index));

const bytes = JSON.stringify(index).length;
const withStandfirst = recipes.filter((recipe) => recipe.d).length;
const withImage = recipes.filter((recipe) => recipe.i).length;

console.log(`\n\nWrote ${OUT}`);
console.log(`  ${recipes.length} recipes (${added} new this run), read to page ${lastPage}`);
console.log(`  ${(bytes / 1024).toFixed(0)} KB · ${withStandfirst} with a standfirst · ${withImage} with an image`);
if (recipes.length) {
  console.log(`  oldest ${recipes[recipes.length - 1].w} · newest ${recipes[0].w}`);
}

// The point of the whole exercise: does searching it actually find things?
const { searchIndex } = await import("../lib/recipe-index.ts");
console.log("\nSample searches:");
for (const term of ["cauliflower", "walnuts", "turkey", "anchovies", "rhubarb", "chicken thighs"]) {
  const hits = searchIndex(recipes, term);
  const top = hits[0] ? ` — top: ${hits[0].t.slice(0, 62)}` : "";
  console.log(`  ${String(hits.length).padStart(3)} for "${term}"${top}`);
}
