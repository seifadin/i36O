import { createStore } from '@i360/storage'

// The app's settings and caches on the device: the hub's own store (hub/src/storage.js), so the
// app and the pages keep values the same way — JSON, never throwing (private browsing, full or
// blocked storage just means nothing is remembered). Keys have no prefix, as before.
export const deviceStore = createStore()

// The keys the app once saved as plain text rather than JSON (older bundles):
// the privacy flag, the change baselines and the feedback address. The caches and
// i360.mdReader were always JSON.
const PLAIN_TEXT_KEYS = ['i360Privacy', 'i360Edition', 'i360Version', 'i360Revision', 'i360FeedbackMailto']

// Run at every start, before anything reads storage (main.tsx): each of these keys holds text,
// so a value that doesn't read back as a JSON string (old plain text such as 0.14.0, 12 or 1.0)
// is rewritten as one, the same characters. Afterwards this changes nothing — and if an
// over-the-air update is ever rolled back, the older bundle's plain values are converted again
// at the next start of this one.
export function upgradeStoredValues(): void {
  for (const key of PLAIN_TEXT_KEYS) {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null || isJsonString(raw)) continue
      window.localStorage.setItem(key, JSON.stringify(raw))
    } catch { /* storage unavailable: nothing to upgrade */ }
  }
}

function isJsonString(raw: string): boolean {
  try { return typeof JSON.parse(raw) === 'string' } catch { return false }
}
