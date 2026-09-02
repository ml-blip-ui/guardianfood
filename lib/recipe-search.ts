/**
 * Answers a search, index first.
 *
 * The index is a file on disk, so it answers instantly and it answers for
 * words the Guardian has no tag for — which was the whole point of building
 * it. Only when the index has nothing to say does this fall through to the
 * older route: a Guardian tag lookup, then Google.
 *
 * That fallback also covers the state before the first crawl has run, when
 * the committed index is empty and every search goes straight through.
 */

import indexData from "@/data/recipes.json";
import { searchAny, searchIndex, recipeUrl, type IndexedRecipe, type RecipeIndex } from "./recipe-index.ts";
import { search as remoteSearch, dateFromUrl, type Article, type SearchResult } from "./guardian.ts";

const index: RecipeIndex = indexData;

/** Matches a Guardian listing page, so scrolling feels the same either way. */
const PAGE_SIZE = 20;

function toArticle(recipe: IndexedRecipe): Article {
  return {
    title: recipe.t,
    link: recipeUrl(recipe),
    description: recipe.d,
    kicker: "",
    published: dateFromUrl(recipe.p),
    image: recipe.i,
  };
}

/**
 * What the index actually holds, for the diagnostics page.
 *
 * The index is bundled into the build, so this answers the question that
 * matters after a deploy: did the crawled file make it into what is running,
 * and how old is it?
 */
export function indexStatus() {
  const { recipes } = index;
  // Measured rather than read off the ends of the array: the crawler writes
  // newest first, but a report that quietly lies if that ever changes is worse
  // than no report at all.
  const dates = recipes.map((recipe) => recipe.w).filter(Boolean).sort();
  return {
    count: index.count,
    builtAt: index.builtAt,
    newest: dates[dates.length - 1] ?? "",
    oldest: dates[0] ?? "",
    withStandfirst: recipes.filter((recipe) => recipe.d).length,
    withImage: recipes.filter((recipe) => recipe.i).length,
  };
}

/**
 * A shelf whose contents come from the index rather than a Guardian tag.
 *
 * `indexed` comes back even when nothing matched, so the caller can tell an
 * index that holds nothing yet from one that simply has no pulses in it.
 */
export function shelfFromIndex(terms: string[], except: string[] | undefined, page: number) {
  // Newest first, like every other shelf. Relevance ranking is for a search,
  // where one hit really can beat another; on a shelf every recipe is equally
  // a pulse recipe, and scoring would only sort by how many words the matching
  // term happened to have.
  const matches = [...searchAny(index.recipes, terms, except ?? [])].sort((a, b) =>
    b.w.localeCompare(a.w),
  );
  const start = (page - 1) * PAGE_SIZE;
  return {
    items: matches.slice(start, start + PAGE_SIZE).map(toArticle),
    page,
    hasMore: matches.length > start + PAGE_SIZE,
    found: matches.length,
    indexed: index.count,
  };
}

export type IndexedSearchResult = SearchResult & {
  /** How many recipes the index holds, so the app can say what it searched. */
  indexed: number;
  /** Total index matches, of which this page is a slice. */
  found?: number;
};

export async function searchRecipes(query: string, page: number): Promise<IndexedSearchResult> {
  const matches = searchIndex(index.recipes, query);

  if (matches.length) {
    const start = (page - 1) * PAGE_SIZE;
    const items = matches.slice(start, start + PAGE_SIZE).map(toArticle);
    return {
      items,
      page,
      hasMore: matches.length > start + PAGE_SIZE,
      route: "index",
      tried: [],
      indexed: index.count,
      found: matches.length,
    };
  }

  // Nothing in the index. Either it has not been built yet, or the Guardian
  // has this ingredient under a tag but never in a headline.
  const remote = await remoteSearch(query, page);
  return { ...remote, indexed: index.count };
}
