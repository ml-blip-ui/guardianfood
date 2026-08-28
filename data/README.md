# data/recipes.json

The app's own index of Guardian recipes: one row per recipe, holding the path,
title, standfirst, date and image.

It exists because there is nowhere else to search. The Guardian retired its
site search and hands off to Google, and Google's Custom Search JSON API is
closed to new projects. Tag lookups (`/tone/recipes+food/eggs`) work, but only
where the Guardian has a tag — it tags eggs and tomatoes, not cauliflower or
walnuts. Keeping our own list is the only way "I have a cauliflower in the
fridge" gets an answer.

## How it is built

`scripts/crawl.ts` walks `/tone/recipes` page by page until the pages come
back empty, and writes the result here.

    npm run crawl          full crawl, as deep as the Guardian will page
    npm run crawl -- 3     only the newest few pages, merged into what exists

Rows are keyed by path and merged, so a top-up only adds what is new and never
loses what came before.

`.github/workflows/crawl.yml` runs the top-up every Monday and commits any
change, which is what keeps the index roughly a week fresh. The full crawl is
the same workflow run by hand with a larger page count.

The file starts empty. Until the first crawl commits a real one, searching
falls back to Guardian tag lookup, exactly as it did before.
