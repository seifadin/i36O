import { describe, expect, it } from 'vitest'
import { ICON_SEMANTICS } from '@i360/icons'
import { ICON, THEME_ICON } from './icons'

// lucide-react names each component after its icon's current name (displayName, in PascalCase),
// whatever name it was imported under — so this checks the icon itself, not the import's spelling.
const pascal = (name: string) => name.replace(/(^|-)([a-z0-9])/g, (_, _dash, c: string) => c.toUpperCase())

describe('the app draws the icon each meaning names in hub/src/icons.js', () => {
  it.each(Object.entries(ICON))('%s', (meaning, Icon) => {
    expect(Icon.displayName).toBe(pascal(ICON_SEMANTICS[meaning as keyof typeof ICON]))
  })
  it.each(Object.entries(THEME_ICON))('theme.%s', (choice, Icon) => {
    expect(Icon.displayName).toBe(pascal(ICON_SEMANTICS.theme[choice as keyof typeof THEME_ICON]))
  })
})
