import { describe, expect, it } from 'vitest'
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as Hub from '@i360/components'
import { Announcer, Banner, Button, FieldBox, GhostButton, Popup, SearchField, Toast, Toolbar, ToolbarStart } from './shared'

// The app's shared components (shared.tsx) against the hub builders (hub/src/components.js): the
// same element, classes and attributes for the same inputs. An icon's drawing is left out (each
// side draws its own Lucide icon; which icon is checked by src/lib/icons.test.ts), and attributes
// are compared as a set (their order means nothing to a browser).

const ICON = '<svg data-icon="x"></svg>'
const icon = h('svg', { 'data-icon': 'x' })

function normal(html: string): string {
  return html
    .replace(/<svg\b[\s\S]*?<\/svg>/g, '<svg/>')
    // Attribute names compared lower-case, as HTML reads them (React writes enterKeyHint), and an
    // empty element's "/>" as ">".
    .replace(/<([a-z0-9]+)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*\/?>/g, (_, tag: string, attrs: string) => {
      const list = [...attrs.matchAll(/([a-zA-Z-]+)(?:="([^"]*)")?/g)].map((m) => { const name = m[1]!.toLowerCase(); return m[2] === undefined || m[2] === '' ? name : `${name}="${m[2]}"` })
      return `<${tag}${list.sort().map((a) => ` ${a}`).join('')}>`
    })
}
const app = (el: ReactElement) => normal(renderToStaticMarkup(el))

describe('the app\'s shared components write the hub builders\' structure', () => {
  const cases: [string, ReactElement, string][] = [
    ['ghost button with icon', h(GhostButton, { icon, label: 'معلومات الإصدار' }), Hub.ghostButton({ icon: ICON, label: 'معلومات الإصدار' })],
    ['ghost button with icon and text', h(GhostButton, { icon, text: 'فتح ملف' }), Hub.ghostButton({ icon: ICON, text: 'فتح ملف' })],
    ['ghost button, own class, drawn by its script', h(GhostButton, { className: 'numerals-btn', label: 'الأرقام' }), Hub.ghostButton({ class: 'numerals-btn', label: 'الأرقام', drawn: true })],
    ['button, primary, words', h(Button, { primary: true }, 'موافق'), Hub.button({ primary: true, text: 'موافق' })],
    ['button, words, placement', h(Button, { className: 'w-full' }, 'إعادة'), Hub.button({ class: 'w-full', text: 'إعادة' })],
    ['button, small, icon only', h(Button, { small: true, icon, label: 'توسيع' }), Hub.button({ small: true, icon: ICON, label: 'توسيع' })],
    ['pop-up', h(Popup, { className: 'w-full', role: 'dialog' }), Hub.box('popup', { class: 'w-full', role: 'dialog' })],
    ['pop-up as a tooltip', h(Popup, { as: 'span', 'aria-hidden': 'true' }), Hub.box('popup', { tag: 'span' }).replace('<span ', '<span aria-hidden="true" ')],
    ['notice', h(Banner, { className: 'm-md' }), Hub.box('banner', { class: 'm-md' })],
    ['notice as a button', h(Banner, { onClick: () => {} }), Hub.box('banner', { tag: 'button' })],
    ['toast', h(Toast, { className: 'fixed' }), Hub.box('toast', { class: 'fixed' })],
    ['the bottom toolbar', h(Toolbar, { variant: 'bottom', className: 'justify-between' }), Hub.box('toolbar', { tag: 'div', variant: 'bottom', class: 'justify-between' })],
    ['a toolbar\'s start', h(ToolbarStart), Hub.box('toolbarStart')],
    ['field box', h(FieldBox, { className: 'flex' }), Hub.box('fieldBox', { class: 'flex' })],
    ['hidden announcer', h(Announcer), Hub.announcer()],
    ['search field in a field box', h(SearchField, { id: 'q', placeholder: 'ابحث…' }), Hub.field({ kind: 'search', 'in-box': true, id: 'q', placeholder: 'ابحث…' })],
  ]
  it.each(cases)('%s', (_, el, hub) => {
    expect(app(el)).toBe(normal(hub))
  })

  it('fails when the two differ (the comparison can see a difference)', () => {
    expect(app(h(Button, { small: true }, 'x'))).not.toBe(normal(Hub.button({ text: 'x' })))
  })
})

describe('no app component writes a shared component\'s class itself', () => {
  const COMPONENT_CLASS = /(?<![\w-])(toolbar|toolbar-menu|tb-(?:title|start|main|end|group)|sr-only|i360-(?:chip|field|field-input|btn|btn-ghost|list-item|card|inset|popup|banner|toast|status|empty))(?![\w-])/
  const dir = join(process.cwd(), 'src')
  const files = (readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('shared.tsx'))
  it.each(files)('src/%s', (f) => {
    const code = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    const found = [...code.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2] ?? "").filter((s) => COMPONENT_CLASS.test(s))
    expect(found).toEqual([])
  })
})
