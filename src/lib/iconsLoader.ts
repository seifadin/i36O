import { createElement, ReactElement } from 'react'
import type { LucideIcon } from 'lucide-react'

// The one place icons are loaded while the app runs: any Lucide icon, by the name data gives it
// (today the science icons named in Baserow). The fixed icons the code draws are bundled through
// icons.ts and loaded by nothing. Kept apart from icons.ts on purpose: the build can split each
// icon into its own file only when the module asking for them by name isn't also importing some of
// them directly (Vite warns "dynamic import will not move module into another chunk" otherwise).

// PascalCase (as stored in Baserow, matching lucide-react's named exports) →
// kebab-case (matching lucide-react's individual icon file names).
function toKebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

// Vite-native glob of every lucide icon file — resolves in both the dev server and the
// production build (a bare-specifier dynamic import works only at build time). Every icon
// becomes its own build-output file; a browser fetches only the ones it draws. Old names
// Lucide still ships a file for keep working (the indexer's quarterly check reports them).
const iconModules = import.meta.glob('/node_modules/lucide-react/dist/esm/icons/*.mjs')

type IconModule = { default: LucideIcon }

// Every icon once loaded, by name, as a ready element (made once; an element is a description, so
// several rows can show the same one) — null for a name Lucide doesn't have, or an icon that failed
// to load (the row then shows ICON.badIcon). Shared by the preload and every row, so an icon
// already loaded is drawn on the row's first frame.
const loaded = new Map<string, ReactElement | null>()
const pending = new Map<string, Promise<ReactElement | null>>()

export const iconLoaded = (name: string): boolean => loaded.has(name)
export const loadedIcon = (name: string): ReactElement | null => loaded.get(name) ?? null

export function fetchIcon(name: string): Promise<ReactElement | null> {
  if (loaded.has(name)) return Promise.resolve(loadedIcon(name))
  let request = pending.get(name)
  if (!request) {
    const path = `/node_modules/lucide-react/dist/esm/icons/${toKebabCase(name)}.mjs`
    const loader = iconModules[path] as (() => Promise<IconModule>) | undefined
    request = (loader ? loader().then((mod) => createElement(mod.default)) : Promise.resolve(null))
      .catch(() => null)
      .then((icon) => { loaded.set(name, icon); pending.delete(name); return icon })
    pending.set(name, request)
  }
  return request
}

// Fires all icon fetches at once, priming the browser's module cache so that when ScienceGrid's
// rows mount and ask for the same icons they resolve at once instead of each starting its own
// request. Called from dataCache.tsx after the sciences land (so again only when they change).
export function preloadIcons(names: Iterable<string>) {
  for (const name of names) void fetchIcon(name)   // never rejects: a failure is the row's fallback
}

// WebKit (Safari, the iOS app's WKWebView) has no requestIdleCallback, so without a fallback
// nothing scheduled this way would ever run there (§12.16: standard APIs differ in this app's web
// views). A short timeout stands in — "the page has likely settled by now", not a precise
// substitute.
const IDLE_FALLBACK_MS = 200

export function scheduleIdle(callback: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(callback)
  } else {
    setTimeout(callback, IDLE_FALLBACK_MS)
  }
}
