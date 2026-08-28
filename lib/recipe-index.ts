/**
 * The searchable recipe index.
 *
 * The Guardian retired its own site search and Google's Custom Search JSON API
 * is closed to new projects, so the only durable way to search the archive is
 * to keep our own list of it. This is that list: one flat record per recipe,
 * built by scripts/crawl.ts and refreshed by a scheduled GitHub Action.
 *
 * Deliberately small per row — a few hundred kilobytes for the whole archive,
 * which is cheap enough to search without a round trip.
 */

export type IndexedRecipe = {
  /** Guardian path, without the host, which is the same for every row. */
  p: string;
  /** Title. */
  t: string;
  /** Standfirst, where the listing page offered one. */
  d: string;
  /** Publication date as YYYY-MM-DD, read from the path. */
  w: string;
  /** Image URL, where one was found. */
  i: string;
};

export type RecipeIndex = {
  builtAt: string;
  count: number;
  recipes: IndexedRecipe[];
};

const GUARDIAN = "https://www.theguardian.com";

export function recipeUrl(recipe: IndexedRecipe) {
  return `${GUARDIAN}${recipe.p}`;
}

/** Fold accents and case so "jalapeno" finds "jalapeño". */
function normalise(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Trim a plural back to a stem so a search matches either form: "walnuts"
 * should find "walnut and sage stuffing", and "anchovy" should find anchovies.
 * Matching is by prefix from the stem, so the stem does not need to be a real
 * word — "tomat" catching both tomato and tomatoes is the point.
 */
export function stem(word: string) {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3);
  if (word.length > 4 && /(?:s|x|z|ch|sh|o)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/**
 * Every word must appear somewhere in the row, so "chicken lemon" finds
 * recipes with both rather than either. Matching starts at a word boundary,
 * which keeps "pear" out of "spears".
 *
 * Returns every match, best first — the caller decides how many to show.
 */
export function searchIndex(recipes: IndexedRecipe[], query: string): IndexedRecipe[] {
  const words = normalise(query)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1)
    .map(stem);
  if (!words.length) return [];

  const scored: { recipe: IndexedRecipe; score: number }[] = [];
  for (const recipe of recipes) {
    const title = normalise(recipe.t);
    const body = `${title} ${normalise(recipe.d)}`;
    let score = 0;
    let matchedAll = true;
    for (const word of words) {
      const inTitle = new RegExp(`\\b${word}`).test(title);
      const inBody = new RegExp(`\\b${word}`).test(body);
      if (!inBody) {
        matchedAll = false;
        break;
      }
      // A word in the headline says far more than one in the standfirst.
      score += inTitle ? 10 : 1;
    }
    if (matchedAll) scored.push({ recipe, score });
  }

  // Best match first, then most recent.
  scored.sort((a, b) => b.score - a.score || b.recipe.w.localeCompare(a.recipe.w));
  return scored.map((entry) => entry.recipe);
}
