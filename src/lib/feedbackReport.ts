// Shared "copy + email" report mechanism — used by ErrorBoundary and
// ReportNotice (rollback notice, data-loading error): one place for the feedback
// address and the copy + mailto logic.

import { Capacitor } from '@capacitor/core'
import { OtaKit } from '@otakit/capacitor-updater'
import { deviceStore } from './deviceStorage'
import { FEEDBACK_MAILTO_KEY, CACHE_KEY_SCIENCES } from '@/store/dataCache'
import { Science, feedbackMailto } from '@/api/dataSource'
import { timestamp } from '@i360/dates'
import { detectOS } from '@/hooks/usePlatform'


// Two-tier lookup, both reading localStorage directly — this needs to work
// even from ErrorBoundary, which sits ABOVE DataCacheProvider in the tree
// (main.tsx), so useDataCache() isn't reachable from every caller. Tier 1:
// the small dedicated key (dataCache.tsx writes this on every successful
// Sciences load, not just during a crash — see its own comment for why).
// Tier 2: fall back to parsing the full Sciences cache directly, in case
// the dedicated key hasn't been written yet (e.g. an OTA update landing
// between a user's last successful Sciences fetch and this feature
// shipping). Both can come up empty only on a device's very first ever
// launch, before any successful fetch has happened at all — an
// unavoidable, narrow edge case each caller handles at its own render
// level (see ErrorBoundary's and App.tsx's own comments).
export function resolveFeedbackMailto(): string | null {
  const saved = deviceStore.get<unknown>(FEEDBACK_MAILTO_KEY, null)
  if (typeof saved === 'string' && saved) return saved
  const sciences = deviceStore.get<unknown>(CACHE_KEY_SCIENCES, null)
  return Array.isArray(sciences) ? feedbackMailto(sciences as Science[]) : null
}

// Diagnostic context prepended to every report (§15d) — nothing personal:
// platform (detectOS(), plus a Huawei/HMS flag via usePlatform()'s regex), the
// app version (__APP_VERSION__, what shipped) and the OTA build actually running
// (they can differ), time and timezone. On web, OTA doesn't apply, so the OTA
// build is __APP_VERSION__. Read once at startup and cached — see
// copyAndEmailReport() for why nothing in the report path may await.
let cachedOtaBuild: string | null = null

// Called once from main.tsx, as early as possible. A no-op on web. Fully
// caught on purpose: an unhandled rejection here would trip
// startupHealth.ts's startup error guard and block notifyAppReady().
export function primeDiagnosticContext(): void {
  if (!Capacitor.isNativePlatform()) return
  OtaKit.getState()
    .then(state => { cachedOtaBuild = state.current.version })
    .catch(() => {
      // Left unknown — buildDiagnosticContext() reports it as such.
    })
}

// The running OTA build: web → __APP_VERSION__ (OTA doesn't apply); native →
// what primeDiagnosticContext() read, or null while unknown. Shared with
// OSRow's About dialog, so both always show the same value.
export function getOtaBuild(): string | null {
  return Capacitor.isNativePlatform() ? cachedOtaBuild : __APP_VERSION__
}

function buildDiagnosticContext(): string {
  const os = detectOS()
  const isHuawei = /huawei|hmscore|harmony/i.test(navigator.userAgent)
  const platform = os === 'android' && isHuawei ? 'android (Huawei)' : os

  // Native: whatever primeDiagnosticContext() read; 'unknown' if it
  // hasn't resolved yet or failed — deliberately NOT __APP_VERSION__
  // there, since on native that would state a value nobody actually read.
  const otaBuild = getOtaBuild() ?? 'unknown'

  return [
    `Platform: ${platform}`,
    `App version: ${__APP_VERSION__}`,
    `OTA build: ${otaBuild}`,
    `Time: ${timestamp()}`,
    // Directly relevant here in a way it wouldn't be for most apps:
    // usePlatform.ts's own isChina heuristic already matches this exact
    // string (Shanghai/Urumqi) — §16's own "Next Up" documents a real,
    // still-open China-access limitation (archive.org blocked, search
    // engines untested). A China-based timezone on an incoming report is
    // a fast, strong signal pointing at that known issue, not a fresh
    // code bug. Raw string, not a derived yes/no flag, so the real value
    // is visible directly rather than trusted through a boolean.
    `Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
  ].join('\n')
}

// Copies the full details to the clipboard (the complete copy — mailto bodies
// can be truncated), then, if a feedback address exists, opens a pre-filled
// mailto: with the first 500 characters.
//
// SYNCHRONOUS ON PURPOSE — keep it that way (§15g). Clipboard writes are only
// allowed during a user gesture, and WebKit (iOS) rejects one made after an
// await; failing silently there would hit ErrorBoundary's crash screen, where
// the copy can be the only way out. So the OTA build is read at startup and
// nothing here awaits.
export function copyAndEmailReport(subjectAr: string, details: string): void {
  const fullDetails = `${buildDiagnosticContext()}\n\n${details}`

  navigator.clipboard?.writeText(fullDetails).catch(() => {})

  const feedbackMailto = resolveFeedbackMailto()
  if (feedbackMailto) {
    const subject = encodeURIComponent(subjectAr)
    const body = encodeURIComponent(fullDetails.slice(0, 500))
    const separator = feedbackMailto.includes('?') ? '&' : '?'
    window.location.href = `${feedbackMailto}${separator}subject=${subject}&body=${body}`
  }
}
