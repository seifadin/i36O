import { beforeEach, describe, expect, test } from 'vitest'
import { commitBaseline, hasChanged } from '@/lib/changeBaseline'
import { upgradeStoredValues } from '@/lib/deviceStorage'

// localStorage, in memory (the tests run in plain Node); the shared store reads the global
// localStorage, the start-up upgrade window.localStorage — the same object here.
const store = new Map<string, string>()
let broken = false
const localStorage = {
  getItem: (k: string) => { if (broken) throw new Error('blocked'); return store.get(k) ?? null },
  setItem: (k: string, v: string) => { if (broken) throw new Error('blocked'); store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}
Object.assign(globalThis, { localStorage, window: { localStorage } })
const saved = (k: string) => JSON.parse(store.get(k) ?? 'null')

describe('change flags: read first, baseline written only after a successful load (§15h)', () => {
  beforeEach(() => store.clear())

  test('first launch: nothing stored is not a change', () => {
    expect(hasChanged('i360Edition', '5')).toBe(false)
  })

  test('a new value is a change until it is committed', () => {
    commitBaseline('i360Edition', '5')
    expect(hasChanged('i360Edition', '6')).toBe(true)
    expect(hasChanged('i360Edition', '6')).toBe(true)   // reading alone never writes
    commitBaseline('i360Edition', '6')
    expect(hasChanged('i360Edition', '6')).toBe(false)
  })

  test('a load that fails after the check commits nothing, so the retry still sees the change', () => {
    commitBaseline('i360Revision', '3')
    expect(hasChanged('i360Revision', '4')).toBe(true)
    // …the gated download fails here: no commitBaseline call…
    expect(hasChanged('i360Revision', '4')).toBe(true)
    expect(saved('i360Revision')).toBe('3')
  })

  test('a missing value is never a change and never stored', () => {
    commitBaseline('i360Version', '1.0')
    for (const v of [null, undefined, '']) {
      expect(hasChanged('i360Version', v)).toBe(false)
      commitBaseline('i360Version', v)
    }
    expect(saved('i360Version')).toBe('1.0')
  })

  test('each item has its own baseline', () => {
    commitBaseline('i360Edition', '5')
    commitBaseline('i360Version', '5')
    expect(hasChanged('i360Edition', '6')).toBe(true)
    expect(hasChanged('i360Version', '5')).toBe(false)
  })
})

describe('start-up upgrade: values older bundles saved as plain text', () => {
  beforeEach(() => { store.clear(); broken = false })

  test('plain text becomes the same text as JSON, so nothing reads as changed', () => {
    store.set('i360Version', '0.14.0')
    store.set('i360Edition', '12')
    store.set('i360Revision', '1.0')
    store.set('i360FeedbackMailto', 'mailto:a@example.org')
    store.set('i360Privacy', '1')
    upgradeStoredValues()
    expect(store.get('i360Version')).toBe('"0.14.0"')
    expect(store.get('i360Edition')).toBe('"12"')
    expect(store.get('i360Revision')).toBe('"1.0"')
    expect(store.get('i360FeedbackMailto')).toBe('"mailto:a@example.org"')
    expect(store.get('i360Privacy')).toBe('"1"')
    expect(hasChanged('i360Version', '0.14.0')).toBe(false)
    expect(hasChanged('i360Edition', '12')).toBe(false)
    expect(hasChanged('i360Revision', '1.0')).toBe(false)
    expect(hasChanged('i360Version', '0.15.0')).toBe(true)
  })

  test('a second start changes nothing; JSON caches and other keys are left alone', () => {
    store.set('i360Version', '0.14.0')
    store.set('i360CacheSciences', '[{"id":1}]')
    store.set('i360.mdReader', '"https://i36o.web.app/md/?file="')
    upgradeStoredValues()
    const once = new Map(store)
    upgradeStoredValues()
    expect(store).toEqual(once)
    expect(store.get('i360CacheSciences')).toBe('[{"id":1}]')
    expect(store.get('i360.mdReader')).toBe('"https://i36o.web.app/md/?file="')
  })

  test('a value Baserow sends as a number compares equal to the same text', () => {
    commitBaseline('i360Edition', 12 as unknown as string)
    expect(hasChanged('i360Edition', '12')).toBe(false)
    expect(hasChanged('i360Edition', 12 as unknown as string)).toBe(false)
  })

  test('blocked storage: nothing throws, nothing reads as changed', () => {
    broken = true
    expect(() => upgradeStoredValues()).not.toThrow()
    expect(hasChanged('i360Version', '0.14.0')).toBe(false)
    expect(() => commitBaseline('i360Version', '0.14.0')).not.toThrow()
  })
})
