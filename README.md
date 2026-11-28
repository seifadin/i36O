# i360إ — الموسوعة الإسلامية

إi360 تطبيق إسلامي موسوعي للعلوم الإسلامية الأساسية بشكل متكامل مختصر بسيط

An Arabic-only Islamic knowledge app: apps, websites and books organised by Islamic science, in one right-to-left interface. One codebase for the web and the Android, iOS and Huawei apps.

- **Web:** https://i36o.web.app/ — with the Markdown Reader (`/md/`), the book search (`/cse/`) and the Daily Reflection (`/day/`), also inside the installed app
- **Support:** https://i36o.wordpress.com
- **Release notes:** [CHANGELOG.md](CHANGELOG.md) (from v0.13.0, the React rewrite); the SAP Build Apps (AppGyver) history up to v0.12.4: [README-AppGyver.md](README-AppGyver.md)

## What's here

| Folder | What |
|---|---|
| `src/` | the app: React + TypeScript, Vite, Tailwind; its tests beside the code (`*.test.ts`) |
| `public/` | static files; `md/`, `cse/`, `day/` are the hub pages **as built** from `hub/` (never edited here) |
| `hub/` | the side tools (Reader, book search, Daily Reflection), the shared theme, the Hijri date Worker, the book-search indexer — its own `package.json` and [README](hub/README.md) |
| `android/`, `ios/` | the native apps (Capacitor), with Fastlane for store submission |
| `scripts/` | the git hooks (tests, deploys, releases) and release helpers |
| `.github/workflows/` | the hub's two scheduled jobs (book-search index, font check) |

Data comes from Baserow; hosting is Firebase; over-the-air updates go through OtaKit; the theme, Hijri and library sites are Cloudflare Workers.

## Working on it

Node 24 or newer.

```
npm ci                 # the app's packages
npm run dev            # the app, locally
npm test               # the app's tests (Vitest)
npm run lint           # ESLint
npm run build          # type check + production build into dist/
npm run lucide -- <v>  # Lucide's version, for the app and the hub together

cd hub && npm ci       # the hub's packages
npm test               # ESLint, then the hub's tests
npm run build          # writes public/md, public/cse, public/day, the quran page (hub/quran/site/i360/),
                       # hub/COMPONENTS.md and the components' catalogue — the commit hook runs it for you
```

Pushes to `vite` (the one permanent branch) go through `scripts/pre-push-hook.sh`, which runs the tests, publishes the hub's Workers when they change, deploys a preview and asks before releasing to the web and, over the air, to phones. Commits go through `scripts/pre-commit-hook.sh`: when a `hub/` or `src/` file is in the commit it runs the hub build and adds what it wrote (skipped, with a warning, while those folders have changes left out of the commit; a failing build stops the commit), and it asks for a version when a native file is. Install the hooks once per clone:

```
printf '#!/usr/bin/env bash\nexec bash "$(git rev-parse --show-toplevel)/scripts/pre-push-hook.sh" "$@"\n' > .git/hooks/pre-push && chmod +x .git/hooks/pre-push
printf '#!/usr/bin/env bash\nexec bash "$(git rev-parse --show-toplevel)/scripts/pre-commit-hook.sh" "$@"\n' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

Secrets live in `.env` (see `.env.example`); never give a secret a `VITE_` prefix, which would put it into the app's bundle.

## Licence notes

Fonts: Amiri and Amiri Quran (SIL Open Font License 1.1, licence beside each version on the theme site). Icons: Lucide (ISC) and Simple Icons (CC0). Qur'an text in the library's books (from the OCR engine): Tanzil (CC BY 3.0).
