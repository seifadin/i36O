import { ComponentType, createElement, ReactElement } from 'react'

// PascalCase (as stored in Baserow, matching lucide-react's named exports) →
// kebab-case (matching lucide-react's individual icon file names).
function toKebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

// Vite-native glob of every lucide icon file — resolves correctly in BOTH
// the dev server and production build. A bare-specifier dynamic import
// (`import('lucide-react/dist/esm/icons/...')`) only works at build time,
// since Rollup can statically rewrite it; the dev server serves raw
// browser-native ESM, and browsers cannot resolve a bare specifier inside a
// dynamic import at all. This does mean every icon in the library gets its
// own build-output chunk (not just the ones this app's data uses) — a
// build-time/deployment-footprint cost, not a runtime one: a real browser
// only ever fetches the specific icons it actually renders.
const iconModules = import.meta.glob('/node_modules/lucide-react/dist/esm/icons/*.mjs')

type IconModule = { default: ComponentType }

// Every icon once loaded, by name, as a ready element (made once; an element is a description, so
// several rows can show the same one) — null for a name Lucide doesn't have, or an icon that failed
// to load (the row then shows its visible fallback). Shared by the preload and every row, so an
// icon already loaded is drawn on the row's first frame.
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

// Fires all icon fetches at once, priming the browser's module cache so
// that when ScienceGrid's rows actually mount and request these same icons
// (via DynamicIcon), they resolve instantly instead of each triggering its
// own fresh network round-trip in a burst. Called from dataCache.tsx right
// after Sciences data lands — naturally re-runs only when that data
// actually changes (Edition-gated), same as the underlying fetch itself.
export function preloadIcons(names: Iterable<string>) {
  for (const name of names) void fetchIcon(name)   // never rejects: a failure is the row's fallback
}

// WebKit (Safari, the iOS app's WKWebView) has no requestIdleCallback, so
// without a fallback nothing scheduled this way would ever run there (§12.16:
// standard APIs differ in this app's web views). A short timeout stands in —
// "the page has likely settled by now", not a precise substitute.
const IDLE_FALLBACK_MS = 200

export function scheduleIdle(callback: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(callback)
  } else {
    setTimeout(callback, IDLE_FALLBACK_MS)
  }
}
