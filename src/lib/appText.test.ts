import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// The app's words are written once, in hub/src/locales.js (APP, alias @i360/locales), as the hub
// pages' are: no app file writes Arabic text itself (comments aside). The Arabic decimal mark «٫»
// is a digit sign, not text.
describe('no app file writes its interface text itself', () => {
  const dir = join(process.cwd(), 'src')
  const files = (readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts'))
  it.each(files)('src/%s', (f) => {
    const code = readFileSync(join(dir, f), 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code.match(/[ء-ي][^'"`\n<>{}]*/g) ?? []).toEqual([])
  })
})
