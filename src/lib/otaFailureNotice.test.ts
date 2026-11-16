import { beforeEach, describe, expect, test } from 'vitest'
import type { BundleInfo } from '@otakit/capacitor-updater'
import { isNewFailure, markFailureSeen, OTA_FAILURE_SEEN_KEY } from '@/lib/otaFailureNotice'

// localStorage, in memory (the tests run in plain Node).
const store = new Map<string, string>()
let broken = false
const localStorage = {
  getItem: (k: string) => { if (broken) throw new Error('blocked'); return store.get(k) ?? null },
  setItem: (k: string, v: string) => { if (broken) throw new Error('blocked'); store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
Object.assign(globalThis, { localStorage, window: { localStorage } })

const failure = (id: string) => ({ id, version: '0.14.0+otk.x', status: 'error' }) as BundleInfo

describe('the rollback notice: once per failure (OtaKit keeps the last one for good)', () => {
  beforeEach(() => { store.clear(); broken = false })

  test('no failure, nothing to show', () => {
    expect(isNewFailure(null)).toBe(false)
  })

  test('a failure shows until its notice is closed, then not again', () => {
    const f = failure('bundle-1')
    expect(isNewFailure(f)).toBe(true)
    markFailureSeen(f)
    expect(isNewFailure(f)).toBe(false)
    expect(JSON.parse(store.get(OTA_FAILURE_SEEN_KEY) ?? 'null')).toBe('bundle-1')   // stored as JSON
  })

  test('a later failure shows again', () => {
    markFailureSeen(failure('bundle-1'))
    expect(isNewFailure(failure('bundle-2'))).toBe(true)
  })

  test('blocked storage: the notice still shows, nothing throws', () => {
    broken = true
    expect(isNewFailure(failure('bundle-1'))).toBe(true)
    expect(() => markFailureSeen(failure('bundle-1'))).not.toThrow()
  })
})
