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

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
