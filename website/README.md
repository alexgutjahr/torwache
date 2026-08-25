# torwache.com

The static Astro website for [torwache](https://torwache.com/).

## Commands

Run these from the repository root:

```sh
npm run website:dev       # start Astro in background mode
npm run website:check     # strict Astro and TypeScript checks
npm run website:build     # production build to website/dist
```

Stop or inspect the background development server from this directory with
`npm run dev:stop`, `npm run dev:status`, or `npm run dev:logs`.

## Deploying

`vercel.json` in this directory carries the deployment settings. In the Vercel project, set
**Root Directory** to `website`; the repository is an npm workspace, so installs still resolve
from the root.

Deploy the company-operated site from a Pro or Enterprise team. Vercel limits Hobby projects to
personal, non-commercial use, and its Data Processing Addendum covers Pro and Enterprise plans.

Three notes on what the config does and does not do:

- `middleware.ts` is Vercel Routing Middleware. It negotiates static HTML and Markdown documents
  from the request's `Accept` header and adds `Vary: Accept, Accept-Encoding`; it does not turn the
  Astro site into a server-rendered application. Static files are still served from the edge.
- The Content-Security-Policy permits scripts and analytics requests only from
  `cdn.usefathom.com`. The production build loads Fathom's deferred analytics script from that
  origin; the extension never does. If another client-side script or service is added, the header
  must be updated deliberately or the browser will block it.
- `scripts/generate-agent-content.mjs` creates a Markdown sibling for every HTML document after
  Astro builds. Keep `src/lib/content-negotiation.ts` in sync with the public Astro routes; direct
  `.md` URLs and negotiated responses are both public API.

In Fathom's site firewall settings, keep `torwache.com` as the only allowed domain so local,
preview, and copied deployments do not enter the production reports.

Astro is configured with `build.format: 'directory'`, so canonical URLs and the sitemap carry a
trailing slash, and internal document links use the same form. Vercel slash normalization is left
undefined on purpose: a platform-level redirect runs before Routing Middleware and would turn a
bare nonexistent path into `308` instead of the required `404`. Both forms of a real document are
served directly, while canonical metadata consistently points crawlers to the trailing-slash URL.

## Agent-facing documents

`/llms.txt` follows the llms.txt v2 section and link-list format. Its “When to use torwache” section
is operational guidance, not landing-page copy. Every HTML document advertises both its Markdown
alternate and `/llms.txt` in `<link>` metadata. A request such as
`curl -H 'Accept: text/markdown' https://torwache.com/` receives the same page as Markdown; an
unsupported `Accept` value receives `406 Not Acceptable`.

The custom `404.astro` is the recovery page for normal requests. Markdown clients receive a short
404 response from the routing middleware with links to the sitemap, guides, and agent guide.

## Shared product UI

The site imports product colour/radius tokens from `../shared/styles/tokens.css`, the actual
extension controls from `../extension/css/components.css`, and the extension's generated mark and
Instrument Sans asset from `../extension/public`. Keep product controls in those shared sources;
`src/styles/preview.css` should only arrange them inside the landing-page previews.

## Launch settings

Public values that cannot be inferred safely live in `src/config.ts`:

- `chromeWebStore.url` — the permanent ID-based listing URL.
- `chromeWebStore.published` — only enable after the anonymous listing resolves to torwache.
- `legal` — the operator details used by the imprint and the privacy policy.

The imprint stays `noindex` and labels missing fields until all legal details are present.
