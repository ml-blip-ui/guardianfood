/**
 * Offline regression test for the listing parser.
 *
 * Run with: npm run check:parser
 *
 * This does not talk to the Guardian. It checks that the parser still behaves
 * against a fixture shaped like a Guardian listing page, so that a change to
 * the parsing code cannot quietly break titles, dates or de-duplication.
 */

import { dateFromUrl, parseListing, slugify, tagCandidates } from "../lib/guardian.ts";
import { buildQuery, cleanSnippet, cleanTitle, fromOgTitle, toArticles } from "../lib/google-search.ts";
import { exportText, mergeEntries, parseImport } from "../lib/lists.ts";
import { recipeUrl, searchAny, searchIndex, stem, type IndexedRecipe } from "../lib/recipe-index.ts";
import { shelfById } from "../lib/sources.ts";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}\n         expected ${e}\n         actual   ${a}`);
  }
}

const fixture = `
<html><body>
  <nav><a href="/food" aria-label="Food">Food</a></nav>
  <a href="/food/2026/aug/01/roast-cauliflower-cheese" aria-label="Roast cauliflower cheese &amp; a green salad">
    <h3 class="card-headline"><div>Quick and easy</div><span>Roast cauliflower cheese</span></h3>
    <img src="https://i.guim.co.uk/img/one.jpg" />
  </a>
  <a href="/food/2026/jul/26/nigel-slater-tomatoes" aria-label="Nigel Slater&#x27;s tomato recipes">
    <h3 class="card-headline"><div>Midweek dinner</div><span>Tomatoes</span></h3>
    <img src="https://i.guim.co.uk/img/two.jpg" />
  </a>
  <a href="/food/2026/aug/01/roast-cauliflower-cheese" aria-label="Roast cauliflower cheese &amp; a green salad">duplicate</a>
  <a href="/help/terms-of-service" aria-label="Terms">Terms</a>
  <a href="/food/2026/jun/14/no-label-here">no aria-label</a>
</body></html>`;

const items = parseListing(fixture);

console.log("parseListing");
check("keeps only real dated articles", items.length, 2);
check("decodes entities in the title", items[0]?.title, "Roast cauliflower cheese & a green salad");
check("decodes numeric entities", items[1]?.title, "Nigel Slater's tomato recipes");
check("builds an absolute link", items[0]?.link, "https://www.theguardian.com/food/2026/aug/01/roast-cauliflower-cheese");
check("reads the date from the URL", items[0]?.published, "2026-08-01T00:00:00.000Z");
check("picks up the kicker", items[0]?.kicker, "Quick and easy");
check("picks up the image", items[0]?.image, "https://i.guim.co.uk/img/one.jpg");
check("drops the duplicate link", items.filter((i) => i.link.includes("cauliflower")).length, 1);

console.log("dateFromUrl");
check("parses a normal article path", dateFromUrl("/thefilter/2026/aug/01/tinned-anchovies"), "2026-08-01T00:00:00.000Z");
check("parses a single-digit day", dateFromUrl("/food/2026/jan/5/something"), "2026-01-05T00:00:00.000Z");
check("returns empty for a dateless path", dateFromUrl("/food/pasta"), "");
check("returns empty for a bogus month", dateFromUrl("/food/2026/xyz/01/thing"), "");

/** Mirror of the grouping in recipe-browser.tsx. */
function issueOf(value: string) {
  const date = new Date(value);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  const saturday = new Date(date);
  saturday.setUTCDate(date.getUTCDate() - mondayOffset + 5);
  return saturday.toISOString().slice(0, 10);
}

// A Feast issue dated Saturday 1 August 2026 goes online across the days
// either side of it; every one of them must land on the same heading.
console.log("weekly grouping");
check("Thursday joins its Saturday", issueOf("2026-07-30T00:00:00.000Z"), "2026-08-01");
check("Friday joins its Saturday", issueOf("2026-07-31T00:00:00.000Z"), "2026-08-01");
check("Saturday is its own issue", issueOf("2026-08-01T00:00:00.000Z"), "2026-08-01");
check("Sunday joins the Saturday before", issueOf("2026-08-02T00:00:00.000Z"), "2026-08-01");
check("the next Monday starts a new issue", issueOf("2026-08-03T00:00:00.000Z"), "2026-08-08");

console.log("ingredient search terms");
check("lowercases and trims", slugify("  Cauliflower "), "cauliflower");
check("hyphenates multiple words", slugify("black beans"), "black-beans");
check("strips accents", slugify("jalapeño"), "jalapeno");
check("drops punctuation", slugify("chef's knife!"), "chef-s-knife");

// Guardian ingredient tags are inconsistently pluralised, so a typed word has
// to try the obvious variants before falling back to a text search.
check("cauliflower tries its plural", tagCandidates("cauliflower").includes("cauliflowers"), true);
check("eggs tries its singular", tagCandidates("eggs").includes("egg"), true);
check("tomatoes tries its singular", tagCandidates("tomatoes").includes("tomato"), true);
check("potato tries -es", tagCandidates("potato").includes("potatoes"), true);
check("the typed word is always tried first", tagCandidates("pasta")[0], "pasta");
check("an -es plural does not also try a stray -e", tagCandidates("tomatoes"), ["tomatoes", "tomato"]);
check("at most three paths are ever tried", Math.max(...["cauliflower","eggs","tomatoes","potato","pasta","squash"].map((w) => tagCandidates(w).length)) <= 3, true);

console.log("google results become ordinary articles");
check("strips the masthead from a title", cleanTitle("Roast cauliflower cheese | The Guardian"), "Roast cauliflower cheese");
// Real result: Google returned "… – recipe | Food - The Guardian".
check("strips a section sitting before the masthead", cleanTitle("How to turn a cauliflower into ‘risotto’ – recipe | Food - The Guardian"), "How to turn a cauliflower into ‘risotto’ – recipe");
check("leaves a clean title alone", cleanTitle("Roast cauliflower cheese"), "Roast cauliflower cheese");

// The series after the final pipe is the kicker the app shows above a headline.
check("splits the series off an og:title", fromOgTitle("Rachel Roddy’s recipe for pasta with cauliflower | A kitchen in Rome"),
  { title: "Rachel Roddy’s recipe for pasta with cauliflower", kicker: "A kitchen in Rome" });
check("copes with no series", fromOgTitle("Roast cauliflower cheese"), { title: "Roast cauliflower cheese", kicker: "" });
check("strips the date stamp from a snippet", cleanSnippet("Aug 1, 2026 ... A whole roasted cauliflower ..."), "A whole roasted cauliflower");
check("adds 'recipe' to a bare ingredient", buildQuery("cauliflower"), "cauliflower recipe");
check("does not double it up", buildQuery("cauliflower recipe"), "cauliflower recipe");
check("respects the plural", buildQuery("cauliflower recipes"), "cauliflower recipes");

const googleItems = [
  { title: "Roast cauliflower cheese | The Guardian",
    link: "https://www.theguardian.com/food/2026/aug/01/roast-cauliflower-cheese",
    snippet: "Aug 1, 2026 ... A whole roasted cauliflower ...",
    pagemap: { cse_image: [{ src: "https://i.guim.co.uk/img/one.jpg" }] } },
  // Google truncates long titles; the page's own metadata has the whole one.
  { title: "Christmas sides: Anna Jones' recipes for garlic cauliflower cheese ...",
    link: "https://www.theguardian.com/food/2019/dec/20/christmas-sides-anna-jones",
    snippet: "Dec 20, 2019 ... Confit garlic cauliflower cheese ...",
    pagemap: { metatags: [{ "og:title": "Christmas sides: Anna Jones’ recipes for garlic cauliflower cheese and the ultimate roast potatoes | The modern cook",
                            "og:description": "Getting everything perfect and hot all at once can be tricky" }] } },
  // A section front, not an article: no date in the URL, so it is dropped.
  { title: "Food | The Guardian", link: "https://www.theguardian.com/food", snippet: "Food" },
  // Somewhere else entirely: dropped.
  { title: "Cauliflower", link: "https://en.wikipedia.org/wiki/Cauliflower", snippet: "A vegetable" },
  // The same article twice: kept once.
  { title: "Roast cauliflower cheese", link: "https://www.theguardian.com/food/2026/aug/01/roast-cauliflower-cheese", snippet: "again" },
];
const mapped = toArticles(googleItems);
check("keeps only dated Guardian articles", mapped.length, 2);
check("title is cleaned", mapped[0]?.title, "Roast cauliflower cheese");
check("date comes from the URL, as elsewhere", mapped[0]?.published, "2026-08-01T00:00:00.000Z");
check("image is picked up when Google supplies one", mapped[0]?.image, "https://i.guim.co.uk/img/one.jpg");
check("snippet becomes the standfirst", mapped[0]?.description, "A whole roasted cauliflower");
check("a truncated title is replaced by the full one", mapped[1]?.title,
  "Christmas sides: Anna Jones’ recipes for garlic cauliflower cheese and the ultimate roast potatoes");
check("the series becomes the kicker", mapped[1]?.kicker, "The modern cook");
check("a written standfirst beats a keyword snippet", mapped[1]?.description,
  "Getting everything perfect and hot all at once can be tricky");

console.log("moving a list between devices");

// The exact text the Export button produces.
const cooked = `Have cooked, best first (2)

★★★★★  Roast chicken
https://www.theguardian.com/food/2026/aug/2/roast-chicken
★★★☆☆  Lemon pasta
https://www.theguardian.com/food/2026/aug/3/lemon-pasta`;

const want = `Want to cook (1)

Cauliflower cheese
https://www.theguardian.com/food/2026/aug/1/cauliflower-cheese`;

const fromCooked = parseImport(cooked);
check("reads both cooked recipes", fromCooked.length, 2);
check("keeps the title", fromCooked[0]?.title, "Roast chicken");
check("keeps the rating", fromCooked[0]?.rating, 5);
check("counts a partial star row", fromCooked[1]?.rating, 3);
check("marks them cooked", fromCooked.every((e) => e.status === "cooked"), true);

const fromWant = parseImport(want);
check("reads the want list", fromWant.length, 1);
check("no stars means want-to-cook", fromWant[0]?.status, "want");
check("and no rating", fromWant[0]?.rating, undefined);

// A round trip must survive: export, import, export again.
const roundTrip = exportText(parseImport(cooked), "cooked");
check("survives a round trip unchanged", roundTrip, exportText(fromCooked, "cooked"));

// Merging must never clobber a rating already on this device.
const mine = [{ url: "https://www.theguardian.com/food/2026/aug/2/roast-chicken", title: "Roast chicken", image: "", published: "", status: "cooked" as const, rating: 2, updatedAt: "2026-08-02T00:00:00.000Z" }];
const merged = mergeEntries(mine, fromCooked);
check("adds only what is missing", merged.added, 1);
check("leaves the one already here alone", merged.skipped, 1);
check("and does not overwrite its rating", merged.merged.find((e) => e.url.endsWith("roast-chicken"))?.rating, 2);

// A hand-mangled paste should still work.
const messy = `  Cauliflower cheese

   https://www.theguardian.com/food/2026/aug/1/cauliflower-cheese   `;
check("copes with stray whitespace", parseImport(messy).length, 1);
check("ignores text with no links at all", parseImport("just some notes").length, 0);


// --------------------------------------------------------------- recipe index

console.log("stem");
check("trims a plain plural", stem("walnuts"), "walnut");
check("trims an -ies plural", stem("anchovies"), "anchov");
check("trims an -oes plural", stem("tomatoes"), "tomato");
check("leaves a double s alone", stem("cress"), "cress");
check("leaves a short word alone", stem("figs"), "fig");
check("leaves a singular alone", stem("cauliflower"), "cauliflower");
// The stem does not have to be a real word — it only has to be a prefix that
// catches both forms. "cheese" must not become "chees" and lose the match.
check("does not maul a singular ending in -ese", stem("cheese"), "cheese");

const shelf: IndexedRecipe[] = [
  { p: "/food/2026/aug/01/roast-cauliflower-cheese", t: "Roast cauliflower cheese", d: "A whole cauliflower, roasted.", w: "2026-08-01", i: "" },
  { p: "/food/2025/dec/20/perfect-roast-turkey", t: "The perfect roast turkey with walnut and sage stuffing", d: "", w: "2025-12-20", i: "" },
  { p: "/food/2026/mar/02/pasta-with-anchovy", t: "Pasta with cauliflower, onion and anchovy", d: "", w: "2026-03-02", i: "" },
  { p: "/food/2026/jan/09/pear-and-almond-tart", t: "Pear and almond tart", d: "", w: "2026-01-09", i: "" },
  { p: "/food/2026/feb/11/asparagus-spears", t: "Griddled asparagus spears", d: "", w: "2026-02-11", i: "" },
  { p: "/food/2024/may/05/jalapeno-cornbread", t: "Jalapeño cornbread", d: "", w: "2024-05-05", i: "" },
  { p: "/food/2026/apr/18/midweek-greens", t: "Midweek greens", d: "Uses up the cauliflower in the fridge.", w: "2026-04-18", i: "" },
];

const hits = (query: string) => searchIndex(shelf, query).map((recipe) => recipe.p);

console.log("searchIndex");
check("finds the plural in a singular headline", hits("walnuts"), ["/food/2025/dec/20/perfect-roast-turkey"]);
check("finds the singular in a plural search", hits("anchovies"), ["/food/2026/mar/02/pasta-with-anchovy"]);
check("finds an untagged ingredient", hits("cauliflower").length, 3);
check("ranks a headline above a standfirst", hits("cauliflower")[2], "/food/2026/apr/18/midweek-greens");
check("newest first among equal scores", hits("cauliflower")[0], "/food/2026/aug/01/roast-cauliflower-cheese");
check("needs every word to match", hits("cauliflower anchovy"), ["/food/2026/mar/02/pasta-with-anchovy"]);
check("returns nothing when one word misses", hits("cauliflower rhubarb"), []);
check("matches at a word boundary only", hits("pear"), ["/food/2026/jan/09/pear-and-almond-tart"]);
check("folds accents", hits("jalapeno"), ["/food/2024/may/05/jalapeno-cornbread"]);
check("ignores a one-letter query", hits("a"), []);
check("ignores punctuation-only input", hits("!!"), []);
check("an empty index simply finds nothing", searchIndex([], "cauliflower"), []);

console.log("recipeUrl");
check("rebuilds the full Guardian link", recipeUrl(shelf[0]), "https://www.theguardian.com/food/2026/aug/01/roast-cauliflower-cheese");


// ------------------------------------------------- shelves built from search

// The pulses shelf has no Guardian tag behind it, so these titles stand in for
// the archive: the ones it should gather, and the ones it must leave alone.
const pulseShelf: IndexedRecipe[] = [
  { p: "/food/2026/jan/02/lentil-ragu", t: "Lentil ragu", d: "", w: "2026-01-02", i: "" },
  { p: "/food/2026/jan/03/chickpea-stew", t: "Chickpea and spinach stew", d: "", w: "2026-01-03", i: "" },
  { p: "/food/2026/jan/04/tarka-dal", t: "Tarka dal", d: "", w: "2026-01-04", i: "" },
  { p: "/food/2026/jan/05/butter-bean-gratin", t: "Butter bean gratin", d: "", w: "2026-01-05", i: "" },
  { p: "/food/2026/jan/06/split-pea-soup", t: "Split pea and ham soup", d: "", w: "2026-01-06", i: "" },
  { p: "/food/2026/jan/07/black-eyed-peas", t: "Black-eyed peas with greens", d: "", w: "2026-01-07", i: "" },
  { p: "/food/2026/jan/08/falafel", t: "Proper falafel", d: "", w: "2026-01-08", i: "" },
  { p: "/food/2026/jan/09/hearty-stew", t: "A hearty winter stew", d: "Thickened with cannellini.", w: "2026-01-09", i: "" },
  // Real Guardian headlines, from the first crawl. The green bean salads are
  // the reason the exclusion list exists: they were most of the shelf when it
  // was first run against the archive.
  { p: "/food/2026/aug/29/mozzarella-green-bean-edamame", t: "Meera Sodha\u2019s recipe for spicy mozzarella, green bean and edamame salad", d: "", w: "2026-08-29", i: "" },
  { p: "/food/2026/aug/24/black-bean-nachos", t: "Georgina Hayden\u2019s quick and easy recipe for charred corn, jalape\u00f1o and black bean nachos", d: "", w: "2026-08-24", i: "" },
  { p: "/food/2026/aug/15/black-rice-salad", t: "Meera Sodha\u2019s vegan black rice salad with tomatoes, tamarind and green beans \u2013 recipe", d: "", w: "2026-08-15", i: "" },
  { p: "/food/2026/aug/05/italian-summer", t: "Angela Hartnett\u2019s Italian summer recipes: grilled peaches, green beans and mozzarella, and gnudi in tomato sauce", d: "", w: "2026-08-05", i: "" },
  // Must not be gathered.
  { p: "/food/2026/jan/10/vanilla-ice-cream", t: "Vanilla bean ice cream", d: "", w: "2026-01-10", i: "" },
  { p: "/food/2026/jan/11/coffee-cake", t: "Coffee bean and walnut cake", d: "", w: "2026-01-11", i: "" },
  { p: "/food/2026/jan/12/pea-risotto", t: "Garden pea risotto", d: "", w: "2026-01-12", i: "" },
  { p: "/food/2026/jan/13/roast-chicken", t: "Sunday roast chicken", d: "", w: "2026-01-13", i: "" },
];

const pulses = shelfById("ingredient-pulses");
const gathered = searchAny(pulseShelf, pulses?.anyOf ?? [], pulses?.except).map((r) => r.p);

console.log("the pulses shelf");
check("the shelf exists", Boolean(pulses?.anyOf?.length), true);
check("has no Guardian tag behind it", pulses?.paths, []);
check("gathers lentils", gathered.includes("/food/2026/jan/02/lentil-ragu"), true);
check("gathers chickpeas", gathered.includes("/food/2026/jan/03/chickpea-stew"), true);
check("gathers dal", gathered.includes("/food/2026/jan/04/tarka-dal"), true);
check("gathers beans", gathered.includes("/food/2026/jan/05/butter-bean-gratin"), true);
check("gathers split peas", gathered.includes("/food/2026/jan/06/split-pea-soup"), true);
check("gathers black-eyed peas", gathered.includes("/food/2026/jan/07/black-eyed-peas"), true);
check("gathers falafel", gathered.includes("/food/2026/jan/08/falafel"), true);
check("gathers a pulse named only in the standfirst", gathered.includes("/food/2026/jan/09/hearty-stew"), true);
// The reason for the exclusion list, and for leaving "pea" out of the terms.
check("leaves vanilla bean alone", gathered.includes("/food/2026/jan/10/vanilla-ice-cream"), false);
check("leaves coffee bean alone", gathered.includes("/food/2026/jan/11/coffee-cake"), false);
check("leaves garden peas alone", gathered.includes("/food/2026/jan/12/pea-risotto"), false);
check("leaves a roast chicken alone", gathered.includes("/food/2026/jan/13/roast-chicken"), false);
// A green bean is a pod, not a pulse — but the edamame in the same headline is,
// so that one stays. This is the case that whole-recipe exclusion would lose.
check("drops a green bean salad", gathered.includes("/food/2026/aug/15/black-rice-salad"), false);
check("drops green beans and mozzarella", gathered.includes("/food/2026/aug/05/italian-summer"), false);
check("keeps green bean AND edamame, on the edamame", gathered.includes("/food/2026/aug/29/mozzarella-green-bean-edamame"), true);
check("keeps black beans, which are a pulse", gathered.includes("/food/2026/aug/24/black-bean-nachos"), true);
check("gathers exactly the ten pulse dishes", gathered.length, 10);
// A headline beats a standfirst here too, so the stew comes last.
check("ranks headline pulses above a standfirst one", gathered[gathered.length - 1], "/food/2026/jan/09/hearty-stew");

console.log("searchAny");
check("no terms finds nothing", searchAny(pulseShelf, []), []);
check("an empty index finds nothing", searchAny([], ["lentil"]), []);
check("a multi-word term needs both words", searchAny(pulseShelf, ["split pea"]).length, 1);
// Excluding "green bean" drops the three green-bean titles but leaves butter,
// black, vanilla and coffee beans, which this call does not exclude.
check("a blanked phrase stops matching", searchAny(pulseShelf, ["bean"], ["green bean"]).length, 4);
// The distinction from throwing out the whole recipe: the rest of the headline
// still counts, so the edamame in a green bean salad is still found.
check(
  "but the rest of the recipe still counts",
  searchAny(pulseShelf, ["bean", "edamame"], ["green bean"]).some((r) => r.p.endsWith("edamame")),
  true,
);
check("exclusions are phrases, not words", searchAny(pulseShelf, ["vanilla"], ["vanilla bean"]).length, 0);
check("so a term matching elsewhere survives", searchAny(pulseShelf, ["walnut"], ["vanilla bean"]).length, 1);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
