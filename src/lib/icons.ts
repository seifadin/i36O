import { createElement, ReactElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bot, ChevronDown, ChevronLeft, CircleCheck, CircleExclamationPoint, CircleQuestionMark,
  CircleSlash, CircleX, Coffee, EllipsisVertical, Globe, Keyboard, Languages, LoaderCircle,
  Minimize2, Monitor, Moon, Paperclip, PencilSparkles, ScrollText, Search, Sun,
} from 'lucide-react'
import type { ICON_SEMANTICS } from '@i360/icons'

// Every icon the app draws. Its meanings and their icons are decided once, in
// hub/src/icons.js (shared with the hub pages); this file only maps each meaning the app
// uses to its lucide-react component (icons.test.ts checks each one is the named icon).
// Components import icons from here, never from lucide-react (ESLint enforces it).
// Imported by name so the bundle holds only these.

type Semantics = typeof ICON_SEMANTICS

export const ICON = {
  menu: EllipsisVertical,
  search: Search,
  searchAuto: PencilSparkles,
  searchOnly: Minimize2,
  translating: Languages,
  exegesis: ScrollText,
  assistant: Bot,
  keyboard: Keyboard,
  loading: LoaderCircle,
  checked: CircleCheck,
  invalid: CircleExclamationPoint,
  notFound: CircleQuestionMark,
  openFailed: CircleX,
  badIcon: CircleSlash,
  collapsed: ChevronLeft,
  expanded: ChevronDown,
  web: Globe,
  attachment: Paperclip,
} satisfies Partial<Record<Exclude<keyof Semantics, 'theme'>, LucideIcon>>

export const THEME_ICON = {
  system: Monitor,
  light: Sun,
  sepia: Coffee,
  dark: Moon,
} satisfies Record<keyof Semantics['theme'], LucideIcon>

// --- Science icons: named in Baserow, so loaded by name while the app runs ---

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
