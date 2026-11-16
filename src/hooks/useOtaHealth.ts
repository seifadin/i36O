import { useCallback, useEffect, useRef, useState } from 'react'
import { OtaKit } from '@otakit/capacitor-updater'
import { useDataCache } from '@/store/dataCache'
import { hadUnrecoveredStartupError, likelyGenuineDataFailure, SAFETY_NET_DELAY_MS } from '@/lib/startupHealth'
import { isNewFailure, markFailureSeen } from '@/lib/otaFailureNotice'
import type { BundleInfo } from '@otakit/capacitor-updater'

// OtaKit health handshake + rollback visibility (§14o). Call once, from
// AppShell (it never unmounts). notifyAppReady() fires only after the first
// genuine data load, so OtaKit's own appReadyTimeout can roll back a bundle
// that runs but can't load data. Returns the rollback notice's state.
export function useOtaHealth(): { rollbackDetails: string | null; dismissRollback: () => void } {
  const { loading, error, lastFailure } = useDataCache()
  // The data state as of now, for the safety net's timer below.
  const latest = useRef({ loading, lastFailure })
  useEffect(() => { latest.current = { loading, lastFailure } }, [loading, lastFailure])

  const notified = useRef(false)
  const notifyReadyOnce = useCallback(() => {
    if (notified.current) return
    notified.current = true
    // Can reject; unhandled, it would trip the startup error guard.
    OtaKit.notifyAppReady().catch(() => {})
  }, [])

  // Ready = data settled successfully, with no unrecovered JS error so far.
  useEffect(() => {
    if (loading || error || hadUnrecoveredStartupError()) return
    notifyReadyOnce()
  }, [loading, error, notifyReadyOnce])

  // Safety net, shortly before appReadyTimeout (ota-timing.json): if the
  // failure looks like connectivity rather than this bundle, confirm anyway,
  // so a good bundle isn't rolled back over a dead or slow network. A load
  // still on its way, or one that failed only for network reasons, confirms
  // the bundle (unless a JS error happened); otherwise the device and the data
  // source are checked (§15ba).
  useEffect(() => {
    const timer = setTimeout(() => {
      if (notified.current) return
      const { loading: stillLoading, lastFailure: failed } = latest.current
      if (!hadUnrecoveredStartupError() && ((stillLoading && !failed) || failed?.network)) {
        notifyReadyOnce()
        return
      }
      void likelyGenuineDataFailure().then(genuine => { // never rejects
        if (!genuine) notifyReadyOnce()
      })
    }, SAFETY_NET_DELAY_MS)
    return () => clearTimeout(timer)
  }, [notifyReadyOnce])

  // A rollback shows up two ways: from a previous session (getLastFailure —
  // it happens before any JS runs) or live (the 'rollback' event). Reporting
  // only: OtaKit has no manual rollback API. Each failure is shown once: OtaKit
  // keeps the last one for good, so a closed notice is remembered (otaFailureNotice.ts).
  // details: what the report carries; failure: OtaKit's stored record, marked seen on close (a
  // live event carries no bundle id, so its stored record is read when the notice closes).
  const [notice, setNotice] = useState<{ details: string, failure: BundleInfo | null } | null>(null)
  useEffect(() => {
    let cancelled = false
    OtaKit.getLastFailure()
      .then(last => { if (!cancelled && isNewFailure(last)) setNotice({ details: JSON.stringify(last), failure: last }) })
      .catch(() => {})
    const listener = OtaKit.addListener('rollback', live => {
      if (!cancelled) setNotice({ details: JSON.stringify(live), failure: null })
    })
    return () => {
      cancelled = true
      listener.then(handle => handle.remove()).catch(() => {})
    }
  }, [])

  const dismissRollback = useCallback(() => {
    if (notice?.failure) markFailureSeen(notice.failure)
    else if (notice) OtaKit.getLastFailure().then(last => { if (last) markFailureSeen(last) }).catch(() => {})
    setNotice(null)
  }, [notice])
  return { rollbackDetails: notice?.details ?? null, dismissRollback }
}
