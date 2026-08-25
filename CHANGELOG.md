# Changelog

Everything notable that changes in torwache gets written down here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

Nothing yet.

## 1.6.1 — 2026-08-25

### Added

- Agent-readable Markdown representations generated from the built HTML, `llms.txt` usage
  guidance, substantive About and Contact pages, organization schema, and recoverable HTML and
  Markdown 404 responses.
- A repository security-reporting policy and an archive test proving the release ZIP has the
  Chrome Web Store layout with `manifest.json` at its root.

### Changed

- The website now shares the extension's product tokens, controls, mark, and Instrument Sans
  asset while keeping its document layout and Instrument Serif display face site-specific.
- Website copy, navigation, comparison sources, sitemap coverage, licence notes, release
  instructions, and ignored Store submission material now match the current torwache extension.
- General, privacy, and vulnerability reports now use dedicated `torwache.com` role addresses,
  and public claims distinguish current behavior from future product decisions.
- Dependency updates separate shipped packages from development tooling and hold TypeScript on
  version 6 until Astro supports TypeScript 7's compiler API.
- The privacy policy documents Vercel's routing middleware as well as the separate, website-only
  Fathom integration.

### Fixed

- Vercel can install and build the website workspace independently without depending on generated
  WXT files.
- Shared product controls explicitly reset native appearance on the website and extension, and
  Chrome end-to-end tests launch reliably in CI.
- Unknown paths reach a real 404, negotiated responses vary safely on `Accept`, and generated
  Markdown no longer claims that every deployment is a content update.
- Privacy and Store copy now describe navigation handling precisely: full URLs are reduced to
  hostnames, used locally, and never persisted as browsing history or transmitted.
- Release checks now reject remote packaged resources or network clients. The unnecessary Vite
  `modulepreload` fetch fallback is disabled because the declared Chrome floor supports it natively.

## 1.6.0 — 2026-08-25

### Changed

- The extension now uses WXT's current Manifest V3 toolchain, real TypeScript entrypoints,
  generated manifests, Vite-powered Tailwind builds, automatic Chrome provisioning, and WXT
  release archives. WXT remains build tooling and adds no runtime framework to the extension.
- Blocklist storage now uses a validated, versioned format, and the manager disables mutations
  while a write is pending.
- Domain validation now uses the maintained Public Suffix List, preventing a broad entry such as
  `co.uk` or `github.io` from blocking unrelated sites.
- Node types and Astro are updated to their latest releases; TypeScript stays on the latest version
  supported by Astro's current checker.
- Release archives now use WXT's deterministic ZIP output and produce a SHA-256 checksum.

### Removed

- The hand-maintained manifest, committed generated stylesheet, JSDoc-only extension typing, and
  custom ZIP implementation superseded by WXT.

### Fixed

- Rule-sync messages now use the asynchronous response pattern supported by every declared Chrome
  version, validate their sender, and carry typed, actionable capacity errors.
- Failed storage reads expose a retry state instead of leaving an inert manager, and failed writes
  preserve the submitted domain instead of discarding it.
- Manager tabs now send small, typed mutations to the service worker, which serializes them against
  fresh storage so concurrent tabs cannot overwrite one another. Damaged storage has an explicit,
  confirmed reset path.
- Cached navigations fall back to Chrome's last-known dynamic rules when blocklist storage cannot
  be read, instead of failing open; rejected navigation checks are handled and logged.
- Destructive confirmations no longer expire on a timer, reduced-motion mode removes animation
  delays, and the SVG and PNG marks are generated from one shared design.

## 1.5.0 — 2026-08-25

### Added

- A privacy policy describing local blocklist storage and the transient navigation
  URLs delivered by Chrome's `webNavigation` API.
- A real-Chrome end-to-end test covering add, enforce, pause, theme-keyboard, and remove
  flows, including proof that sensitive URL components never reach the blocked page.
- A reproducible Chrome screenshot task for the four light/dark README images.
- Focused regression tests for stale navigations, deletion focus, fresh-state rule retries,
  exact rule comparison, and Chrome's dynamic-rule quotas.
- Website-only, cookie-free Fathom Analytics configured to honour Do Not Track.
- Search-focused website guides and source-linked blocker comparisons, with canonical URLs,
  social metadata, structured data, and sitemap entries.

### Changed

- The project is now torwache across the Chrome extension, Astro website, documentation,
  privacy policy, package metadata, and release archives. The official domain is
  `torwache.com`.
- Extension toolbar icons and both extension pages now use the arched-gate brand mark.
- Repository and support links now follow the project to `github.com/alexgutjahr/torwache`.
- The service worker is now the sole, serialized writer of dynamic rules. Failed writes
  rebuild from current storage before retrying, and the manager reports failures visibly.
- Navigation checks are cached for performance and sequenced per tab, so a slow check can
  never redirect a newer allowed navigation. The redundant committed-navigation read is gone.
- Blocked-page URLs contain only the hostname; paths, queries, fragments, and credentials are
  discarded before the internal page is opened.
- Theme selection uses native radio controls with built-in arrow-key behavior. Faint text and
  inactive controls now meet contrast requirements in both themes.
- CSS colors, shadows, radii, and full-round shapes now resolve through global tokens. Dead
  tokens and false-positive generated Tailwind utilities were removed; the bundled font uses
  `font-display: swap`.
- Biome's recommended rules and TypeScript's unused-code checks now cover extension, test, and
  tooling code. Packaging gates on the complete check suite, and CI actions use immutable SHAs.
- Rule status compares complete rule signatures instead of counts, and rule quota failures are
  reported before Chrome receives an invalid update.
- The shared privacy policy now has separate, stable anchors for the analytics-free extension and
  the Fathom-enabled website.

### Removed

- The unused `createdAt` field from blocklist entries.

## 1.4.0 — 2026-08-24

### Changed

- The footer is a colophon rather than a panel. The permissions table is gone: by the time
  you are looking at the blocklist you have already granted them, so that argument belongs
  in the store listing. What is left is a live status line, one sentence on what the
  extension cannot do, the source and author links, and the build id. The card became a
  hairline rule.
- "Chrome is enforcing N block rules" now carries a status dot, teal when the list and
  Chrome agree and red when they do not.

## 1.3.0 — 2026-08-24

### Added

- A "Built by Alex Gutjahr" credit in the blocklist footer, linking to
  [alexgutjahr.com](https://www.alexgutjahr.com/).
- A test proving the extension cannot block its own pages. Only `http` and `https` are
  ever considered, and an extension id has no dot so it cannot be entered as a domain
  either, but locking someone out of their own blocklist is bad enough to pin down.

### Changed

- The manifest description now leads with "Simple website blocker", which is what people
  actually search for and what the store uses as the default short description.
- Copy updated for Web Store publication: the "not in the Web Store" note is gone, install
  covers both routes, and the rate-us FAQ went with it.

## 1.2.0 — 2026-08-24

### Added

- A "Read the source on GitHub" link in the blocklist footer, using the GitHub mark from
  [Octicons](https://github.com/primer/octicons) (MIT). Its address comes from the
  manifest's `homepage_url`, so it is not a second copy of the URL.

### Changed

- Comments pruned throughout. What is left explains something the code cannot say for
  itself: third-party behaviour, an empty `catch`, a deliberate absence, or the intent
  behind a regular expression. Narration of past bugs is gone.

## 1.1.2 — 2026-08-24

### Added

- An explicit `content_security_policy` stating the Manifest V3 default, an explicit
  `incognito: "spanning"`, and `homepage_url`, all per current Chrome guidance.
- Tests for storage, rule sync, the blocked-page URL contract and the typed element
  lookup, plus a manifest test that fails the build if the extension ever gains a host
  permission, a content script, a web-accessible resource, or an unrecognised key.

### Changed

- The service worker no longer caches the blocklist in a module-level variable, per
  Chrome's guidance against globals in a worker that can be terminated at any point.

## 1.1.1 — 2026-08-24

### Fixed

- **A site you had already visited could still open, even with its rule correctly
  registered.** Network rules "won't affect responses generated by the service worker or
  retrieved from CacheStorage", so a site answering its own navigation from its service
  worker cache never becomes a request they can match. YouTube does this.

  Blocking now also watches navigations through `webNavigation`, one layer above the
  service worker. Verified against a site built to serve its navigations purely from a
  service worker cache.
