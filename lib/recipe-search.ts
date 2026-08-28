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
import { searchIndex, recipeUrl, type IndexedRecipe, type RecipeIndex } from "./recipe-index.ts";
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
