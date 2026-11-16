import { afterEach, describe, expect, test, vi } from 'vitest'
import { fetchResources } from '@/api/dataSource'

// Baserow, as a stand-in fetch: each call takes the next answer in the list.
type Answer = { status: number, body?: unknown } | Error
function baserow(...answers: Answer[]) {
  const calls: string[] = []
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url)
    const a = answers.shift() ?? { status: 500 }
    if (a instanceof Error) throw a
    return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => a.body }
  })
  return calls
}
const page = (results: unknown[], next: string | null = null) => ({ status: 200, body: { count: results.length, next, previous: null, results } })

describe('loading from Baserow: fetchJson with 3 tries (§14)', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  test('a passing failure is tried again, and the rows arrive', async () => {
    const calls = baserow({ status: 503 }, page([{ id: 1 }]))
    expect(await fetchResources()).toEqual([{ id: 1 }])
    expect(calls).toHaveLength(2)
  })

  test('every page is read, and an http:// next link is fetched over https', async () => {
    const calls = baserow(page([{ id: 1 }], 'http://api.example/next'), page([{ id: 2 }]))
    expect(await fetchResources()).toEqual([{ id: 1 }, { id: 2 }])
    expect(calls[1]).toBe('https://api.example/next')
  })

  test('three failures: the report names Baserow and the status', async () => {
    const calls = baserow({ status: 500 }, { status: 500 }, { status: 500 })
    await expect(fetchResources()).rejects.toThrow('Baserow fetch failed: 500')
    expect(calls).toHaveLength(3)
  }, 10000)

  test('a permanent error is not tried again', async () => {
    const calls = baserow({ status: 401 })
    await expect(fetchResources()).rejects.toThrow('Baserow fetch failed: 401')
    expect(calls).toHaveLength(1)
  })

  test('a network failure keeps its own words', async () => {
    baserow(new TypeError('Load failed'), new TypeError('Load failed'), new TypeError('Load failed'))
    await expect(fetchResources()).rejects.toThrow('Load failed')
  }, 10000)
})

describe('the feedback address', () => {
  test("the 'Feedback' row's mailto: link, or nothing", async () => {
    const { feedbackMailto } = await import('@/api/dataSource')
    const row = (ScienceMinor_En: string, Web: string) => ({ ScienceMinor_En, Web }) as never
    expect(feedbackMailto([row('Tafsir', 'https://x'), row('Feedback', 'mailto:a@example.org')])).toBe('mailto:a@example.org')
    expect(feedbackMailto([row('Feedback', 'https://example.org/form')])).toBeNull()
    expect(feedbackMailto([row('Tafsir', 'mailto:b@example.org')])).toBeNull()
    expect(feedbackMailto([])).toBeNull()
  })
})
