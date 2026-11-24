// Exported so startupHealth.ts's connectivity check uses the same base URL as
// the fetches below — one source of truth for the data source.
export const BASE_URL = import.meta.env.VITE_BASEROW_URL
const API_KEY = import.meta.env.VITE_BASEROW_KEY
const TABLE_SCIENCES = import.meta.env.VITE_BASEROW_TABLE_SCIENCES
const TABLE_RESOURCES = import.meta.env.VITE_BASEROW_TABLE_RESOURCES
const TABLE_QURAN = import.meta.env.VITE_BASEROW_TABLE_QURAN

import { fetchJson } from '@i360/net'

const headers = {
  Authorization: `Token ${API_KEY}`,
  'Content-Type': 'application/json',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Science {
  id: number
  ScienceMinorId: number
  ScienceMinor_Ar: string
  ScienceMinor_En: string
  ScienceMinorIcon: string
  ScienceIntermediateId: number | null
  ScienceIntermediate_Ar: string
  ScienceIntermediate_En: string
  ScienceIntermediateIcon: string
  ScienceMajorId: number
  ScienceMajor_Ar: string
  ScienceMajor_En: string
  ScienceMajorIcon: string
  GooglePlayStore: string
  HuaweiAppGallery: string
  AppleAppStore: string
  Web: string
  WebAppendix: string
}

export interface Resource {
  id: number
  CustomSearch: string
  Huawei_CustomSearch: string
  Translator: string
  BotSearch: string
  Huawei_BotSearch: string
  Google_VirtualKeyboard: string
  Huawei_VirtualKeyboard: string
  WebsiteStatus: string
  Edition: string
  Version: string
  Revision: string
  inWebList: string
  URIschemes: string
  // The Reader's public address, a prefix ending in "?file=" (i360-hub.md §1). Not used by
  // the app itself: saved on the device for the Reader's "copy link" (dataCache.tsx).
  MdReader: string
  // i360dbqEOF exists in the Baserow table but is deliberately NOT typed
  // here: nothing reads it (§5), and an interface field with zero readers
  // only implies a dependency that doesn't exist. The column itself stays
  // in Baserow (old installs read it, like IconName).
}

export interface QuranEntry {
  id: number
  QuranChapter: number
  QuranVerseMin: number
  QuranVerseMax: number
  ExegesisURL: string
  ExegesisPage: number
}

interface BaserowResponse<T> {
  count: number
  next: string | null
  results: T[]
}

// ─── Pagination helper ────────────────────────────────────────────────────────

// Why timeout + retry (§14): without them, one transient network failure, from any
// source, could break data loading for the whole session. fetchJson (hub/src/net.js, shared
// with the hub pages): 3 tries, 1 s then 2 s apart, the 10 s limit covering the answer's body
// too; a permanent error (4xx other than 429) isn't retried. Closing and reopening the app
// starts a fresh set of tries — no state is kept across calls.
const FETCH_TIMEOUT_MS = 10000
const MAX_RETRIES = 2 // 1 initial attempt + 2 retries = 3 total tries
const RETRY_BACKOFF_MS = 1000 // doubling: 1 s, then 2 s

async function fetchPage<T>(url: string): Promise<BaserowResponse<T>> {
  try {
    return await fetchJson(url, { headers, timeout: FETCH_TIMEOUT_MS, retries: MAX_RETRIES, backoff: RETRY_BACKOFF_MS })
  } catch (err) {
    // An HTTP error names Baserow in the report; a network error keeps its own words.
    const status = (err as { status?: number }).status
    throw status ? new Error(`Baserow fetch failed: ${status}`) : err
  }
}

async function fetchAllPages<T>(url: string): Promise<T[]> {
  const all: T[] = []
  let nextUrl: string | null = url

  while (nextUrl) {
    const safeUrl = nextUrl.replace(/^http:\/\//, 'https://')
    const data: BaserowResponse<T> = await fetchPage<T>(safeUrl)
    all.push(...data.results)
    nextUrl = data.next
  }

  return all
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

export async function fetchSciences(): Promise<Science[]> {
  // Sort by ScienceMinorId alone — the primary key, which already respects the
  // Major/Intermediate grouping and keeps each row's original position, which
  // groupSciences() relies on to interleave intermediate groups and direct items.
  return fetchAllPages<Science>(
    `${BASE_URL}${TABLE_SCIENCES}/?user_field_names=true&exclude_fields=BotKB,CustomSearchAIKBlessBotKB&order_by=ScienceMinorId`
  )
}

// i360dbc has no per-science filter field — always fetch the global record(s)
export async function fetchResources(): Promise<Resource[]> {
  return fetchAllPages<Resource>(
    `${BASE_URL}${TABLE_RESOURCES}/?user_field_names=true`
  )
}

// Full table fetch — i360dbq is cached client-side (Phase 7a), so lookups
// run locally against cached rows instead of a network round-trip per verse.
export async function fetchQuran(): Promise<QuranEntry[]> {
  return fetchAllPages<QuranEntry>(
    `${BASE_URL}${TABLE_QURAN}/?user_field_names=true`
  )
}

// The feedback address: the Web field of the i360dbs row named 'Feedback' (§3, §14e), when it is
// a mailto: link. Used for the saved copy (dataCache.tsx) and its fallback (feedbackReport.ts).
export function feedbackMailto(sciences: readonly Science[]): string | null {
  const row = sciences.find(s => s?.ScienceMinor_En === 'Feedback')
  return row?.Web?.toLowerCase().startsWith('mailto:') ? row.Web : null
}

