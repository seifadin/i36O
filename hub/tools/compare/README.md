# Comparison scripts (dev-only)

Old-vs-new checks for changes that should look and behave the same, or change only where intended:
the same steps run on two versions, and every difference is printed. Never built into a page, never
shipped; a push touching only this folder runs the hub tests and releases nothing (hub/ is outside
the release checks).

## Running

```
cd hub/tools/compare
node reader-steps.js                       # live (origin/vite) vs this working copy
node day-steps.js --old HEAD~1 --new HEAD  # any two git refs
node pixels.js --pages day --full          # options per script, see each file's header
```

- **Versions:** `--old` defaults to `origin/vite` (what is live), `--new` to `work`: this working copy
  as it is now. The hub pages are compared **as built**, so run `npm run build` in `hub/` first. A
  git ref (branch, tag, commit) is unpacked once into the temporary folder (`i360-compare/`) and
  reused; the app is built there with `vite build`, using this working copy's `node_modules`.
- **Results:** each script prints `DIFF case · step` with only the fields that changed, then
  `N identical, M different`. The exit code is 0 when identical, 1 otherwise. Full results (and the
  screenshots) go to `--out <folder>`, else `i360-compare/out/<script>/` in the temporary folder.
- **Needs Playwright with Chromium.** Deliberately **not** one of the repo's packages: about
  150 MB, and one more Dependabot source, for something run only occasionally. Claude's workspace
  has it ready. To run the scripts in the Codespace: `npm install -g playwright` then
  `npx playwright install --with-deps chromium` — installed globally, outside the repo, so nothing
  to commit; the scripts find a global install by themselves.
- `npm test` doesn't run them (they need a browser); ESLint checks them like any hub file.

## The scripts

| Script | Compares | Cases |
|---|---|---|
| `reader-steps.js` | the Reader step by step: open a book, End / Home / PageDown, type a page, the panel and a heading, search and next results, a bookmark, the bookmarks tab, larger text, reopening; and page links (`#p=`, `#n=`, volumes, the address following the reading) on books opened by link | Arabic and English book × 390 / 1280 px, 17 steps; linked books × 390 / 1280 px, 18 steps |
| `cse-steps.js` | the CSE on a small test library: search, expand / collapse, «more», the two options, a too-short search, a failed search and its retry, the theme button | 390 / 1280 px, up to 15 steps |
| `day-steps.js` | Daily Reflection, services faked, clock fixed at 2027-01-05 in Cairo (Isra "today"): languages, madhab, the date converter (both directions, a leap day, a missing 30th, a year out of range), city picker and search, numerals, theme | 390 / 1280 px, 20 steps |
| `app-sizes.js` | the app's title and the science list's three text sizes, with a major and an intermediate opened; also flags a level bigger than the title, or sideways scrolling | 85 widths, 260–1400 px |
| `sweep.js` | every page resized 260–1800 px: sideways scrolling, the toolbar running off, its level and what sits in ⋮, Day's columns and prayer rows | Reader (browser and app), CSE, Day, app |
| `pixels.js` | screenshots pixel by pixel; where they differ, a third image marks the changed pixels in red | Reader (display test), CSE, Day, app × light / sepia / dark × 390 / 1280 px |
| `safe-area.js` | text or a control inside a left or right safe-area inset (emulated by Chromium); full-width rows and ornaments are skipped, their text is still checked | the same pages × iPhone portrait / landscape and the Surface Duo's three layouts, inset on either side |

Every result also includes the page's uncaught errors, so a new error is a difference.

## Shared parts (`lib/`)

- `versions.js` — the two versions from git, the app's build, command-line options.
- `browser.js` — Playwright; pages served at their real addresses (`https://i36o.web.app/…`, the
  theme site) from local folders; every other request is cut off, so nothing reaches a real service.
- `fakes.js` — Baserow's tables (the app), and the verse, hadith and city search (Daily Reflection),
  the fixed clock.
- `fixtures.js` — the test books (also as the lib site's books, for links) and the CSE test library, made on the fly from a fixed seed (the
  library with this working copy's own indexer); the display test is `hub/library/books/display-test.md`.
- `report.js` — the old-vs-new comparison and its printout.

## Checking the scripts themselves

After changing a script: run it with `--new origin/vite` (the same version on both sides must come
out identical), then once against a deliberate change in the working copy (it must report it).
