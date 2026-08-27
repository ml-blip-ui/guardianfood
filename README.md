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

The feed loads more as you scroll. The Feast is grouped into weekly issues
rather than shown as a flat feed, so it reads the way the print magazine does.

## Run it locally

You need Node.js 22 and npm.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Checking it still works

```bash
npm run check:parser    # offline, fast — checks the page parser and date logic
npm run check:sources   # needs the internet — pings every Guardian path
```

`check:sources` is the important one. Every shelf is a hand-written Guardian
tag path, and the app narrows most of them to recipes by intersecting with the
Guardian's `tone/recipes` tag (so the eggs shelf shows egg recipes rather than
every article ever tagged eggs). If the Guardian retires a tag or changes how
those intersections work, this script reports exactly which shelves broke.

## Deploy to Netlify

1. Push this repository to GitHub.
2. In Netlify, choose **Add new project** → **Import an existing project**.
3. Select the repository. Netlify detects Next.js automatically.
4. Deploy.

The included `netlify.toml` sets the build command, publish directory and
Node.js version.

## How it holds together

The browser talks to two server-side routes:

- `/api/feed?id=<shelf>` — fetches one or more Guardian listing pages and
  merges them. Shelves are resolved by id against `lib/sources.ts`, so the
  route can only ever fetch paths listed there.
- `/api/search?q=<term>` — passes a search through to the Guardian and keeps
  the food results.

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
