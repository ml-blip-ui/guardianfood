# Guardian Recipe Finder — Netlify edition

A personal recipe browser for verified Guardian food topics, collections and writers. It reads the Guardian's public listing pages on the server, presents a clean list of article titles, and can load older pages in batches of 20.

No Guardian API key is required.

## Run it locally

You need Node.js 22 and npm.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Deploy to Netlify

### Recommended: GitHub or another Git provider

1. Create an empty repository on your Git provider.
2. Put the contents of this folder at the repository root, commit them and push.
3. In Netlify, choose **Add new project** → **Import an existing project**.
4. Select the repository. Netlify should detect Next.js automatically.
5. Confirm the build command is `npm run build` and the publish directory is `.next`.
6. Deploy.

The included `netlify.toml` supplies those settings and selects Node.js 22.

### Netlify CLI

If you already use the Netlify CLI:

```bash
npm install
npx netlify init
npx netlify deploy --build
```

Use `npx netlify deploy --build --prod` when you are ready to publish the production version.

## How the archive works

The browser sends requests to `/api/feed`. That server-side route retrieves a Guardian category or writer listing page and extracts its article links, titles, dates and available images. The **Load 20 older recipes** control requests the next numbered listing page.

The server-side route is important: browsers cannot reliably request the Guardian pages directly because of cross-origin restrictions.

## Maintenance note

This project depends on the HTML structure of public Guardian listing pages. If the Guardian redesigns those pages, the parser in `app/api/feed/route.ts` may need updating. The site fails safely: the user is offered a direct link to the corresponding Guardian collection.

## Personal-use note

The app stores no Guardian article bodies. It displays listing metadata and links every result to the original Guardian article. Review the Guardian's terms and Netlify's acceptable-use rules before making a public or high-traffic deployment.
