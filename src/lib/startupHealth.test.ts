import { describe, expect, test } from 'vitest'
import { isNetworkFailure } from '@/lib/startupHealth'

const err = (name: string, message: string) => Object.assign(new Error(message), { name })

describe('a data failure the network explains never rolls a good update back (§15ba)', () => {
  test('no answer in time, no connection (in each browser\'s wording), the server busy or down', () => {
    expect(isNetworkFailure(err('AbortError', 'timeout'))).toBe(true)
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkFailure(new TypeError('Load failed'))).toBe(true)
    expect(isNetworkFailure(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true)
    expect(isNetworkFailure(new Error('Baserow fetch failed: 503'))).toBe(true)
    expect(isNetworkFailure(new Error('Baserow fetch failed: 429'))).toBe(true)
  })

  test('anything else still points at the bundle', () => {
    expect(isNetworkFailure(new Error('Baserow fetch failed: 401'))).toBe(false)
    expect(isNetworkFailure(new Error('Baserow fetch failed: 404'))).toBe(false)
    expect(isNetworkFailure(new TypeError("Cannot read properties of undefined (reading 'results')"))).toBe(false)
    expect(isNetworkFailure(new SyntaxError('Unexpected token < in JSON'))).toBe(false)
    expect(isNetworkFailure('a string')).toBe(false)
  })
})
