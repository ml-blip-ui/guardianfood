# Guardian Recipe Finder

A personal recipe browser for the Guardian's food writing. It reads the
Guardian's public listing pages on the server, presents them as a clean
scrolling feed, and links every result back to the original article.

No Guardian API key is required.

## What it does

Four shelves along the top:

- **Start here** — the main feeds (all recipes, The Feast, The Filter's food
  taste tests) plus weeknight staples and the bigger projects
- **Ingredients** — search the Guardian for whatever is in the fridge, plus
  one-tap shortcuts for the usual suspects
- **Cuisines** — meal type, world cuisines, and seasonal cooking
- **Writers** — the Guardian's food writers and recipe series. Star the ones
  you read and they pin to the top of the list

- **Saved** — your want-to-cook and have-cooked lists

The feed loads more as you scroll. The Feast is grouped into weekly issues
rather than shown as a flat feed, so it reads the way the print magazine does.

## Your lists

Every recipe carries two controls: a bookmark for **want to cook**, and a
one-to-five rating that marks it **have cooked**. A rating can be changed by
tapping a different score, and **Clear** takes a recipe off the list
altogether — the way back from a mis-tapped star.

The Saved tab toggles between the two lists and opens on want-to-cook. Have
cooked is sorted best first, so what you most enjoyed sits at the top. Either
list exports as plain text — stars, title, URL — into a box with a copy
button, which is more dependable on a phone than a download.

Lists currently live in the browser, which means they are per-device and can
be cleared by the browser. Moving them to Supabase is what makes them durable
and shared across phone and laptop; the storage layer in `lib/lists.ts` is
kept behind one interface so that swap does not touch the UI.

## Run it locally

You need Node.js 22 and npm.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Checking it still works

Open **`/check`** on the running site (there is a link in the footer). It loads
every shelf from the Guardian and reports which ones come back empty, with a
copyable summary of the failures. It needs no terminal, so it works against the
deployed site from a phone.

This matters because every shelf is a hand-written Guardian tag path, and the
app narrows most of them to recipes by intersecting with the Guardian's
`tone/recipes` tag — so the eggs shelf shows egg recipes rather than every
article ever tagged eggs. If the Guardian retires a tag or changes how those
intersections work, `/check` reports exactly which shelves broke.

The same checks are available from a terminal:

```bash
npm run check:parser    # offline, fast — checks the page parser and date logic
npm run check:sources   # needs the internet — pings every Guardian path
```

## Ingredient search

Searching an ingredient tries a Guardian tag first:
`/tone/recipes+food/eggs` returns a curated recipe listing, the same mechanism
the shelves use. Plurals are inconsistent across Guardian tags — eggs and
tomatoes, but chicken and pasta — so the obvious variants are tried in
parallel.

The Guardian has no tag for many ingredients (cauliflower among them) and
retired its own site search in favour of Google. So when no tag matches, the
search goes to Google's Programmable Search API and the results come back as
ordinary articles: same layout, same bookmark and rating controls.

This needs two environment variables, both server-side only — the key must
never reach the browser, so neither is prefixed `NEXT_PUBLIC_`:

| Variable | Where it comes from |
| --- | --- |
| `GOOGLE_SEARCH_KEY` | Custom Search JSON API key, Google Cloud console |
| `GOOGLE_SEARCH_CX` | Search engine ID, programmablesearchengine.google.com |

Without them the app offers a plain Google link instead, which is what it did
before. The free allowance is 100 searches a day, so results are cached for
24 hours: repeating a search does not spend another one.

## Deploy to Netlify

1. Push this repository to GitHub.
2. In Netlify, choose **Add new project** → **Import an existing project**.
3. Select the repository. Netlify detects Next.js automatically.
4. Deploy.

The included `netlify.toml` sets the build command, publish directory and
Node.js version.

## How it holds together

The browser talks to two server-side routes:

- `/api/feed/<shelf>/<page>` — fetches one or more Guardian listing pages and
  merges them. Shelves are resolved by id against `lib/sources.ts`, so the
  route can only ever fetch paths listed there.
- `/api/search/<term>/<page>` — looks the term up as a Guardian tag first, and
  falls through to Google when the Guardian has no tag for it.

The shelf travels in the path rather than a query string on purpose. When it
was `?id=…`, Netlify's CDN cached the response against the path alone and
served one shelf's articles for every shelf. Each response also echoes the
shelf it belongs to, and the app refuses to render one that does not match
what it asked for — a wrong list is worse than a visible error.

The routes are server-side because browsers cannot request Guardian pages
directly, and responses are cached for half an hour.

Article titles come from each link's `aria-label` and dates are read out of the
article URL, both of which survive a Guardian restyle. Images, kickers and
standfirsts are best-effort: if the Guardian changes its markup they come back
empty rather than breaking the page. If a shelf fails entirely, the app offers
a direct link to the same collection on the Guardian.

## Personal-use note

The app stores no Guardian article text. It shows listing metadata and links
every result to the original article. Review the Guardian's terms and
Netlify's acceptable-use rules before making a public or high-traffic
deployment.
