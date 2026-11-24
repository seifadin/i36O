// Guard for the shared values (i360-instructions.md §15al): sizes, spacing, corners, lines, shadows,
// speeds and colours come from the theme (--i360-…), never written into a page. What may stay fixed
// is listed below, each with its reason; a new fixed value fails here. To pass: use a theme value,
// or — only for a component's own size — add it to the list with why.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HUB = join(import.meta.dirname, '..');
const ROOT = join(HUB, '..');
const read = (p) => readFileSync(p, 'utf8');

// Fixed rem/px values allowed per file: component sizes, not shared values.
const ALLOWED = {
  'src/page-chrome.css': {
    '2rem': 'a toolbar button\'s height',
    '1.85rem': 'a button\'s narrowest width at the dense step',
    '1.6rem': 'a button\'s narrowest width at the densest step',
    '0.9rem': 'the option tick box',
    '0.7rem': 'the tick inside it',
    '0px': 'no status-bar inset for the bottom bar'
  },
  'theme/site/botpress.css': {},
  'src/reader.src.html': {
    '15rem': 'the narrowest page', '14rem': 'the title\'s widest', '1.75rem': 'page box and volume menu height',
    '3.4rem': 'page box width', '5.5rem': 'volume menu widest', '2rem': 'menu rows and small button heights',
    '3rem': 'progress track narrowest', '2.8rem': 'page box when folded', '2.4rem': 'page box when dense',
    '3.6rem': 'volume menu when dense', '22rem': 'empty-state text and search results height',
    '1.5rem': 'page padding (clamp)', '3.5rem': 'page padding (clamp)', '1.25rem': 'page padding (clamp)',
    '1rem': 'page padding (clamp)', '0.9rem': 'bookmark ribbon width', '1.6rem': 'bookmark ribbon height', '8rem': 'figure label narrowest',
    '26rem': 'search pop-up width', '20rem': 'side panel width', '2.5rem': 'floating button size'
  },
  'src/cse.src.html': { '2.75rem': 'search box and button height', '1.5rem': 'status line height (one line)' },
  'src/quran.src.html': { '48rem': 'tanzil\'s banner at most its own width (768 px)', '1px': 'the hidden status line for screen readers' },
  'src/day.src.html': { '0.875rem': 'the language button\'s caret', '11rem': 'language list narrowest' }
};

// Drop comments, print styles (they keep black on white for paper), and the light values built
// into var(--i360-…, value) for when theme.css hasn't arrived.
function plain(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let i = css.indexOf('@media print'); i !== -1; i = css.indexOf('@media print')) {
    let depth = 0, j = css.indexOf('{', i);
    for (; j < css.length; j++) { if (css[j] === '{') depth++; else if (css[j] === '}' && --depth === 0) break; }
    css = css.slice(0, i) + css.slice(j + 1);
  }
  return css.replace(/var\(--i360-[a-z0-9-]+,\s*((?:[^()]|\([^()]*\))+)\)/g, 'var()');
}
const styles = (file) => {
  const t = read(join(HUB, file));
  return plain(file.endsWith('.html') ? [...t.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n') : t);
};

test('no fixed colours in the pages, the shared CSS or botpress.css', () => {
  for (const file of Object.keys(ALLOWED)) {
    const found = styles(file).match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g) || [];
    assert.deepEqual(found, [], `${file}: use a theme colour (--i360-…)`);
  }
});

test('no fixed sizes but the listed component sizes', () => {
  for (const [file, allowed] of Object.entries(ALLOWED)) {
    const found = [...new Set(styles(file).match(/(?<![\w.-])\d*\.?\d+(?:rem|px)\b/g) || [])];
    const extra = found.filter((v) => !(v in allowed));
    assert.deepEqual(extra, [], `${file}: use a theme value, or list a component size in test/no-hardcoded.test.js`);
    const unused = Object.keys(allowed).filter((v) => !found.includes(v));
    assert.deepEqual(unused, [], `${file}: no longer used — remove from the list`);
  }
});

test('transitions use the theme\'s speeds', () => {
  for (const file of Object.keys(ALLOWED)) {
    const found = styles(file).match(/transition[^;{}]*\b\d*\.?\d+m?s\b/g) || [];
    assert.deepEqual(found, [], `${file}: use --i360-speed / --i360-speed-quick`);
  }
});

test('the Tailwind configs offer only theme values', () => {
  const day = read(join(HUB, 'src/day.tailwind.js')).replace(/\/\/.*$/gm, '');
  assert.deepEqual(day.match(/['"`]\s*-?\d*\.?\d+(?:rem|px|em)|#[0-9a-fA-F]{3,8}\b|rgba?\(/g) || [], [], 'src/day.tailwind.js: v(\'…\') only');
  const app = plain(read(join(ROOT, 'tailwind.config.ts')).replace(/\/\/.*$/gm, ''));
  assert.deepEqual(app.match(/\d*\.?\d+(?:rem|px)\b|#[0-9a-fA-F]{3,8}\b|rgba?\(/g) || [], [], 'tailwind.config.ts: var(--i360-…, light value) only');
});

test('fixed sizes in class names are only the listed ones', () => {
  const ALLOWED_CLASSES = {
    'bottom-[calc(env(safe-area-inset-bottom)+7rem)]': 'the status pill above the bottom rows (ScienceGrid)',
    '-top-[9999px]': 'off-screen measuring copies of the title (Home)',
    '-left-[9999px]': 'off-screen measuring copies of the title (Home)',
    'h-[1.33em]': 'the logo, relative to the title', 'w-[1.33em]': 'the logo, relative to the title'
  };
  const files = ['src/components/ScienceGrid.tsx', 'src/components/Dialog.tsx', 'src/components/ErrorBoundary.tsx', 'src/components/OSRow.tsx',
    'src/components/SearchBar.tsx', 'src/pages/Home.tsx'].map((f) => join(ROOT, f)).concat(['src/day.src.html', 'src/day/main.js'].map((f) => join(HUB, f)));
  for (const f of files) {
    const found = (read(f).match(/[\w-]+-\[[^\]\s]*\]/g) || []).filter((c) => /\d(?:rem|px|em)\b|#[0-9a-fA-F]{3}/.test(plain(c)) && !(c in ALLOWED_CLASSES));
    assert.deepEqual(found, [], `${f}: a theme value, or list it here`);
  }
});
