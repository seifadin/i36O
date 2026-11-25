# hub — the i360 side tools, built into the i360إ app

The Reader, the i360 CSE and Daily Reflection are built here into the app's `public/`
(`../public/md/`, `../public/cse/`, `../public/day/`) and served with the app: inside it, at
`https://i36o.web.app/md|cse|day/` and in its OTA bundle (merge into the app, claude/i360-hub.md §10).

## Forwarding sites (Firebase project `i360-md`, display name «i36o»)
Since merge sprint 7 every site here only forwards (301, path and `?…` kept):
| Target | Site | Forwards to |
|---|---|---|
| `hub` | https://i360-hub.web.app/ | `https://i36o.web.app/<same path>`; `/md/books/<file>` → `lib.i36o.workers.dev/books/<file>` |
| `md`  | https://i360-md.web.app/  | `https://i36o.web.app/md/…`; `/books/<file>` → `lib.i36o.workers.dev/books/<file>` |
| `cse` | https://i360-cse.web.app/ | `https://i36o.web.app/cse/…` |
| `day` | https://i360-day.web.app/ | `https://i36o.web.app/day/…` |

`forward/404.html` is their fallback. They rarely change: `npm run deploy-forwarders` (here, in `hub/`).

**The app's site** is `i36o` in the same project (since 2026-10-23; the app deploys there from the repo root). Its old
address `i360-e.web.app` (project `i360-e`) only forwards too: target `e` in the same `firebase.json` (same rules and
`forward/` folder as `hub`; `.firebaserc` maps it to project `i360-e`), deployed by the same `npm run deploy-forwarders`.
A bare `firebase deploy --only hosting` here now stops at once ("target e not configured for project i360-md"): nothing
is deployed.

## Layout
```
src/reader.src.html + src/reader/*.js      the Reader        → ../public/md/index.html
                      (main.js wires its parts; fold.js: what its toolbar folds, in which order)
src/cse.src.html + src/cse/main.js         the i360 CSE      → ../public/cse/index.html
src/day.src.html + src/day/main.js         Daily Reflection «التأمل اليومي» → ../public/day/index.html
src/quran.src.html + src/quran/*.js        the quran page (tanzil + «تفسير») → quran/site/i360/index.html
                      (verse.js: which verse tanzil shows; served by the quran Worker at /i360/)
src/locales.js        every page's interface text and the app's (APP; alias @i360/locales), one section each, all its languages
src/page-chrome.css   every toolbar (the app's too: it imports this file), the pages' base, the keyboard
                      focus ring, every Lucide icon's style — inlined into each page by the build
src/page-chrome.js    shared by the pages: $, el(), setLabel(), in-app check, the ✕ back to the app, the theme
                      and numerals buttons, and fittingToolbar() (a bar that folds and widens its buttons by measurement)
src/storage.js        createStore(prefix): get / set / remove settings on the device, as JSON, never throwing —
                      also the app's store (@i360/storage); MD_READER_KEY, the key the app writes for the Reader
src/net.js            fetchWithTimeout(), fetchJson() (time limit, bounded retries), wait() — also used by
                      the app (@i360/net), the Hijri Worker, the CSE indexer and scripts/day-cities.js
src/frame.js          oncePerFrame(): layout work at most once per frame
src/dates.js          every date a page shows: numericDate() (year first, held in order in any direction and
                      with any digits), gregorianLong(), gregorianMonthNames(), hijriLong(), weekdayName(), listSep()
                      — Daily Reflection and the CSE
src/digits.js         the digit converter (0123 · ٠١٢٣ · ۰۱۲۳): writeNumerals(), toWestern() — used by the theme
                      loader (a link beside it on the theme site, like net.js), book-format.js and the Hijri Worker
src/sites.js          every i360 address (app site, forwarders, old book paths, lib, theme) and tanzil's — also
                      the app's (@i360/sites); test/sites.test.js checks firebase.json against it
src/exegesis.js       the exegesis lookup: exegesisRows(), findExegesisUrl() — the app (@i360/exegesis), the
                      quran page and the indexer
src/platform.js       detectOS(), isDesktop() — the app (@i360/platform) and the quran page
src/icons.js          ICON_SEMANTICS: each meaning's Lucide icon, decided once — the pages draw them inline
                      (data-icon + data-lucide, checked and redrawn by scripts/icons.js; page scripts import them
                      by meaning from 'i360:icons', drawn by the build), the app maps them in src/lib/icons.ts
                      (@i360/icons). Lucide's version: `npm run lucide -- <version>` at the root
src/components.js     the shared components (toolbar and label buttons, fields, chips, boxes, card headers…), each
                      written once: page HTML placeholders (scripts/placeholders.js) and page scripts call the same
                      builders; the app's twins in src/components/shared.tsx are parity-tested against them
library/books/        our own books     → lib.i36o.workers.dev/books/ (published by the CSE index workflow)
indexer/wrangler.jsonc  the lib Worker (lib.i36o.workers.dev: the CSE build, our books and quran/, files only)
indexer/quran-data.js tanzil's Quran texts and translations and the exegesis index → lib's quran/ (every CSE build)
indexer/science-icons.js  once a quarter, the science icons in Baserow checked against the pinned Lucide (report only)
indexer/map-limit.js  mapLimit(): many fetches or writes, a few at a time (every indexer step)
quran/                the quran Worker (quran.i36o.workers.dev): tanzil's Navigator from our address, its two
                      data scripts answered from lib (worker/data.js), the page (site/i360/) — i360-quran.md
forward/404.html      fallback for the forwarding sites
tools/compare/        dev-only old-vs-new checks (Playwright, not run by npm test); `node run.js` runs only
                      the ones a change needs — its README
```
Link to a book: `https://i36o.web.app/md/?file=books/NAME.md`
Link to a page: add `#p=45` (or `#p=2:45` for volume 2, page 45).

## Build
```
npm test && npm run build
```
`npm test` runs ESLint first (`eslint.config.js`; `npm run lint` alone), then the tests.
Every `.js` here is an ES module (`"type": "module"`, like the app). The build bundles each
page's `main.js` with what it imports (shared files, marked, adhan, the theme loader) into
one inline script, with esbuild (pinned).
Then commit the app's `public/md|cse|day/index.html` (they reach users with the app's web + OTA release) and
`quran/site/i360/index.html` (published with the quran Worker).

Never edit the built pages in `../public/` by hand: edit `src/`, then build. The pages'
security policy allows only the exact scripts they were built with, so a hand edit makes
the browser block them.

## Shared theme (theme.i36o.workers.dev)
The colours and fonts of every i360 app, from one place (`theme/`):
```
theme/site/theme.css         variables (--i360-…) for light, sepia, dark; @font-face (written by fonts.js)
theme/site/theme-loader.js   the loader: applies the shared choice, refreshes theme.css
theme/site/fonts/<font>/<version>/   Amiri, Amiri Quran (.woff2) and their licence (OFL.txt)
theme/site/_headers          CORS everywhere; theme files no-cache; fonts immutable
theme/early.js               built into each page's <head> (no flash on a repeat visit)
theme/fallbacks.js           plain colours for color-mix values; each page's built-in colours
theme/fonts.js, woff2.js     font check and update (from the @fontsource npm packages)
theme/wrangler.jsonc         the theme Worker (files only)
```
- **The pages** (Daily Reflection, Reader, CSE) build in the built-in colours, `early.js`
  and the loader (bundled into each page's script), so the theme button also works offline. New colours
  and fonts on the theme site reach them without a rebuild; a change to the loader needs one.
  One theme choice is shared by all of them.
- **Publishing:** the i360 pre-push hook, on every push to `vite` that changes `hub/theme/`
  (colour check first; or by hand: `npm run publish-theme` with the Cloudflare values from
  `.env`). The Hijri Worker (`hub/hijri/`) and the quran Worker (`hub/quran/`, `npm run publish-quran`) are
  published the same way.
- **Colours:** after changing a colour that a `color-mix` is made from,
  `node theme/fallbacks.js --write` (`npm test` and the hook's colour check stop while one is stale).

## Font updates: `npm run update-fonts`
When the monthly fonts check reports a newer font (or `npm run check-fonts` does), run it here:
1. asks npm whether Amiri or Amiri Quran has a newer version;
2. if so: downloads it into a new version folder, checks that every character of the
   current font is still there (every Quranic mark), rewrites the Fonts section of
   `theme.css`, runs `npm test` and commits it on its own ("Fonts: …"). Anything that goes
   wrong is shown with its cause, and a half-done update is undone.

Then push as usual (`git push` from the repo root): the pre-push hook publishes the theme
Worker with the new fonts.

`npm run check-fonts` only reports. `.github/workflows/check-fonts.yml` runs the check on
the 1st of each month and fails on purpose when a newer font exists (GitHub emails you).

## Book file names
Use plain Latin letters, digits and hyphens (e.g. `fatawa-v5.md`): they appear in links.
