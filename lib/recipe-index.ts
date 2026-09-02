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

/** Split a query into the stemmed words worth matching on. */
function queryWords(query: string) {
  return normalise(query)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1)
    .map(stem);
}

/**
 * How well a title and body answer a set of words. Zero means they do not:
 * every word has to appear, so "chicken lemon" means both rather than either.
 * Matching starts at a word boundary, which keeps "pear" out of "spears".
 */
function scoreText(title: string, body: string, words: string[]) {
  if (!words.length) return 0;
  let total = 0;
  for (const word of words) {
    const boundary = new RegExp(`\\b${word}`);
    if (!boundary.test(body)) return 0;
    // A word in the headline says far more than one in the standfirst.
    total += boundary.test(title) ? 10 : 1;
  }
  return total;
}

/** Punctuation flattened to spaces, so "bean-to-bar" contains "bean to bar". */
function flatten(value: string) {
  return normalise(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function textOf(recipe: IndexedRecipe) {
  const title = flatten(recipe.t);
  return { title, body: `${title} ${flatten(recipe.d)}` };
}

/** Best match first, then most recent. */
function rank(scored: { recipe: IndexedRecipe; score: number }[]) {
  return scored
    .sort((a, b) => b.score - a.score || b.recipe.w.localeCompare(a.recipe.w))
    .map((entry) => entry.recipe);
}

/**
 * One search term. Returns every match, best first — the caller decides how
 * many to show.
 */
export function searchIndex(recipes: IndexedRecipe[], query: string): IndexedRecipe[] {
  const words = queryWords(query);
  if (!words.length) return [];

  const scored: { recipe: IndexedRecipe; score: number }[] = [];
  for (const recipe of recipes) {
    const { title, body } = textOf(recipe);
    const score = scoreText(title, body, words);
    if (score) scored.push({ recipe, score });
  }
  return rank(scored);
}

/**
 * Any of several terms, for a shelf the Guardian never gave a tag to.
 *
 * Pulses is the case in point: there is no pulses tag, and no single word
 * covers beans, lentils, chickpeas and dal. Each term still has to match in
 * full — "split pea" needs both words — but matching any one of them is
 * enough. A recipe scores by its best term, so the strongest reason it
 * belongs is the one that ranks it.
 *
 * `exclude` blanks out a phrase before matching rather than throwing out the
 * whole recipe, which matters more than it sounds: "green bean and edamame
 * salad" should still be gathered on the strength of the edamame, even though
 * a green bean is not a pulse. So the phrase stops counting as a match; it
 * does not disqualify everything around it.
 */
export function searchAny(
  recipes: IndexedRecipe[],
  terms: string[],
  exclude: string[] = [],
): IndexedRecipe[] {
  const termWords = terms.map(queryWords).filter((words) => words.length);
  if (!termWords.length) return [];
  const blocked = exclude.map(flatten).filter(Boolean);

  const scored: { recipe: IndexedRecipe; score: number }[] = [];
  for (const recipe of recipes) {
    let { title, body } = textOf(recipe);
    for (const phrase of blocked) {
      title = title.split(phrase).join(" ");
      body = body.split(phrase).join(" ");
    }
    let best = 0;
    for (const words of termWords) best = Math.max(best, scoreText(title, body, words));
    if (best) scored.push({ recipe, score: best });
  }
  return rank(scored);
}
