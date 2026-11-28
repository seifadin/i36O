// Writes hub/COMPONENTS.md: every component of the encyclopedia and where it is used, read from the
// code each time (never typed by hand), so it can't fall behind — test/components-inventory.test.js
// fails when the committed file differs from what this writes, and prints the command that updates it.
//
//   npm run components            write COMPONENTS.md
//   npm run components -- --check  only compare (exit 1 if it is out of date)
//
// Three tables:
//   1. Shared components: every builder in src/components.js (each container kind on its own row) and
//      the app's own shared ones in src/components/shared.tsx — placeholder, CSS class (read from the
//      builder's markup for its first example in scripts/component-samples.js), React twin, and every
//      use: placeholders in each page's HTML, calls in page scripts, the React twin in the app.
//   2. The app's own components: every React component in the app's src/ (file-local ones too).
//   3. Each hub page's own CSS classes: the ones its <style> defines that the shared stylesheet
//      (src/page-chrome.css) doesn't — what the page builds by itself, outside the shared components.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import * as C from '../src/components.js';
import { PLACEHOLDER_NAMES } from './placeholders.js';
import { SAMPLES, render } from './component-samples.js';

const HUB = join(import.meta.dirname, '..');
const APP = join(HUB, '..');
const OUT = join(HUB, 'COMPONENTS.md');
const read = (p) => readFileSync(p, 'utf8');

function walk(dir, keep) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, keep));
    else if (keep(p)) out.push(p);
  }
  return out;
}

// The builders, in the order components.js exports them; box() becomes one row per container.
const BUILDERS = Object.keys(C).filter((k) => typeof C[k] === 'function');
const ROWS = BUILDERS.flatMap((b) => (b === 'box' ? Object.keys(C.BOXES).map((k) => `box:${k}`) : [b]));
const toSnake = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
const placeholderOf = (row) => {
  const name = toSnake(row.startsWith('box:') ? row.slice(4) : row);
  return PLACEHOLDER_NAMES.includes(name) ? name : null;
};
const callOf = (row) => (row.startsWith('box:') ? `box('${row.slice(4)}')` : row);

// The builder's own one-line description: the start of the last comment above it (a container's: its line in
// the list above BOXES, components.js — a comment, so the built pages don't carry it).
function descriptions() {
  const lines = read(join(HUB, 'src/components.js')).split('\n');
  const out = {};
  for (const k of Object.keys(C.BOXES)) {
    const line = lines.find((l) => new RegExp(`^//   ${k} {2,}\\S`).test(l));
    out[`box:${k}`] = line?.replace(new RegExp(`^//   ${k}\\s+`), '').trim();
  }
  for (const b of BUILDERS) {
    let i = lines.findIndex((l) => l.startsWith(`function ${b}(`));
    while (--i >= 0 && !lines[i].startsWith('//')) if (lines[i].startsWith('function ')) { i = -1; break; }
    if (i < 0) continue;
    while (i > 0 && lines[i - 1].startsWith('//')) i--;
    out[b] = lines[i].replace(/^\/\/\s*/, '').split(/[:(,—.]/)[0].trim();
  }
  return out;
}

// A component's own classes: those on its outermost element that the shared stylesheet styles.
const PAGE_CHROME = read(join(HUB, 'src/page-chrome.css'));
function ownClasses(row) {
  const sample = (SAMPLES[row] || [])[0];
  if (!sample) throw new Error(`${callOf(row)} has no example in scripts/component-samples.js`);
  const cls = render(row, sample.args).match(/^<\w+ class="([^"]*)"/);
  return (cls ? cls[1].split(/\s+/) : []).filter((c) => new RegExp(`\\.${c.replace(/[-]/g, '\\-')}(?![\\w-])`).test(PAGE_CHROME));
}

// The app's shared React components and the hub builder each one twins ("(hub: …)" in its comment).
const SHARED_TSX = join(APP, 'src/components/shared.tsx');
function reactTwins() {
  const src = read(SHARED_TSX);
  const twins = [];
  for (const m of src.matchAll(/((?:^\/\/.*\n)+)export (?:function|const) ([A-Z]\w*)/gm)) {
    const hub = m[1].match(/\(hub: ([^)]+?\)?)\)/);
    twins.push({ name: m[2], hub: hub ? hub[1].replace(/^box\('(\w+)'\)$/, 'box:$1') : null });
  }
  return twins;
}

const PAGES = readdirSync(join(HUB, 'src')).filter((f) => f.endsWith('.src.html')).sort().map((f) => f.replace('.src.html', ''));
const pageHtml = (page) => read(join(HUB, 'src', `${page}.src.html`));
const HUB_SCRIPTS = walk(join(HUB, 'src'), (p) => p.endsWith('.js') && basename(p) !== 'components.js');
const APP_FILES = walk(join(APP, 'src'), (p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p));
const rel = (p) => relative(APP, p).replaceAll('\\', '/');

// The name a script calls a builder by, if it imports it from components.js: `name`, its alias
// (`box as componentBox`), or `C.name` when it imports the module as a whole.
function importedAs(src, builder) {
  for (const m of src.matchAll(/import\s+(\{[^}]*\}|\*\s+as\s+\w+)\s+from\s+'[./]*components\.js'/g)) {
    const spec = m[1];
    if (spec.startsWith('*')) return `${spec.split(/\s+/).pop()}.${builder}`;
    for (const part of spec.slice(1, -1).split(',')) {
      const [name, alias] = part.trim().split(/\s+as\s+/);
      if (name === builder) return alias || name;
    }
  }
  return null;
}

// Where a shared component is used: placeholders per page, calls per hub script, the twin per app file.
function usesOf(row, twin) {
  const uses = [];
  const ph = placeholderOf(row);
  if (ph) {
    for (const page of PAGES) {
      const n = (pageHtml(page).match(new RegExp(`<!--@@${ph}[\\s@]`, 'g')) || []).length;
      if (n) uses.push(`${page} page ×${n}`);
    }
  }
  const builder = row.startsWith('box:') ? 'box' : row;
  for (const file of HUB_SCRIPTS) {
    const src = read(file);
    const local = importedAs(src, builder);
    if (!local) continue;
    const name = local.replace('.', '\\.');
    const call = row.startsWith('box:') ? new RegExp(`(?<![\\w.$])${name}\\(\\s*'${row.slice(4)}'`, 'g') : new RegExp(`(?<![\\w.$])${name}\\(`, 'g');
    const n = (src.match(call) || []).length;
    if (n) uses.push(`${rel(file)} ×${n}`);
  }
  if (twin) {
    for (const file of APP_FILES) {
      if (file === SHARED_TSX) continue;
      const n = (read(file).match(new RegExp(`<${twin}[\\s/>]`, 'g')) || []).length;
      if (n) uses.push(`${rel(file)} ×${n}`);
    }
  }
  return uses;
}

// The app's own React components: PascalCase functions (or forwardRef / memo) in src/.
function appComponents() {
  const sharedNames = new Set(reactTwins().map((t) => t.name));
  const out = [];
  for (const file of APP_FILES.filter((f) => f.endsWith('.tsx') && f !== SHARED_TSX)) {
    const src = read(file);
    for (const m of src.matchAll(/^(export\s+)?(?:default\s+)?(?:function\s+([A-Z][a-z]\w*)\s*\(|const\s+([A-Z][a-z]\w*)\s*=\s*(?:forwardRef|memo|\())/gm)) {
      const name = m[2] || m[3];
      if (sharedNames.has(name)) continue;
      const usedIn = APP_FILES.filter((f) => new RegExp(`<${name}[\\s/>]`).test(read(f))).map(rel);
      out.push({ name, file: rel(file), exported: !!m[1], usedIn });
    }
  }
  return out;
}

// A page's own classes: defined in its <style> blocks, not by the shared stylesheet.
function pageClasses(page) {
  const styles = [...pageHtml(page).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
  const found = new Set([...styles.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
  return [...found].filter((c) => !new RegExp(`\\.${c.replace(/-/g, '\\-')}(?![\\w-])`).test(PAGE_CHROME)).sort();
}

const cell = (s) => String(s).replaceAll('|', '\\|');

function inventory() {
  const desc = descriptions();
  const twins = reactTwins();
  const lines = [
    '# Components',
    '',
    'Written by `npm run components` (`hub/scripts/list-components.js`) from the code — never by hand.',
    '`npm test` fails when this file is out of date. What each component looks like: the catalogue',
    '(`npm run catalogue`, `hub/tools/catalogue/`). The rules behind them: the project\'s `i360-components.md`.',
    '',
    '## 1. Shared components',
    '',
    'Built by `hub/src/components.js` (hub pages, page scripts) and its React twins in `src/components/shared.tsx`',
    '(the app; parity-tested against the builders). Uses: `<page> page ×n` = placeholders in `hub/src/<page>.src.html`;',
    'a file = calls in that script or React uses in that app file.',
    '',
    '| Builder | What | Placeholder | Class | React twin | Used by |',
    '|---|---|---|---|---|---|',
  ];
  for (const row of ROWS) {
    const twin = twins.find((t) => t.hub === row)?.name || null;
    const uses = usesOf(row, twin);
    const classes = ownClasses(row);
    lines.push(`| \`${callOf(row)}\` | ${cell(desc[row] || '')} | ${placeholderOf(row) ? `\`${placeholderOf(row)}\`` : '—'} | ${classes.length ? classes.map((c) => `\`.${c}\``).join(' ') : '— (Tailwind)'} | ${twin ? `\`${twin}\`` : '—'} | ${uses.length ? cell(uses.join('; ')) : '**unused**'} |`);
  }
  for (const t of twins.filter((x) => !x.hub)) {
    const uses = usesOf('__none__', t.name);
    lines.push(`| — | app-only | — | — | \`${t.name}\` | ${uses.length ? cell(uses.join('; ')) : '**unused**'} |`);
  }
  lines.push('', '## 2. The app\'s own components', '', 'React components in the app\'s `src/` outside the shared ones (file-local ones included).', '',
    '| Component | Defined in | Exported | Used in |', '|---|---|---|---|');
  for (const c of appComponents()) {
    lines.push(`| \`${c.name}\` | \`${c.file}\` | ${c.exported ? 'yes' : 'no'} | ${c.usedIn.length ? c.usedIn.map((f) => `\`${f}\``).join(', ') : '**unused**'} |`);
  }
  lines.push('', '## 3. Each hub page\'s own classes', '',
    'Classes a page\'s `<style>` defines that the shared stylesheet (`hub/src/page-chrome.css`) doesn\'t: what the page',
    'builds by itself. (Daily Reflection\'s Tailwind utilities and classes added only by scripts aren\'t listed.)', '',
    '| Page | Own classes |', '|---|---|');
  for (const page of PAGES) {
    const own = pageClasses(page);
    lines.push(`| ${page} | ${own.length ? own.map((c) => `\`.${c}\``).join(' ') : '—'} |`);
  }
  return lines.join('\n') + '\n';
}

// Checks the inventory relies on, for the test: every placeholder and React twin belongs to a row,
// and every row has an example.
function problems() {
  const out = [];
  for (const name of PLACEHOLDER_NAMES) if (!ROWS.some((r) => placeholderOf(r) === name)) out.push(`placeholder ${name} matches no builder`);
  for (const t of reactTwins()) if (t.hub && !ROWS.includes(t.hub)) out.push(`${t.name} twins an unknown builder (${t.hub})`);
  for (const row of ROWS) if (!(SAMPLES[row] || []).length) out.push(`${callOf(row)} has no example`);
  for (const key of Object.keys(SAMPLES)) if (!ROWS.includes(key)) out.push(`an example for ${key}, which is no component`);
  return out;
}

export { inventory, problems, ROWS, OUT };

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const text = inventory();
  if (process.argv.includes('--check')) {
    const now = (() => { try { return read(OUT); } catch { return ''; } })();
    if (now !== text) { console.error('hub/COMPONENTS.md is out of date: run `npm run components` in hub/'); process.exit(1); }
    console.log('hub/COMPONENTS.md is up to date');
  } else {
    writeFileSync(OUT, text);
    console.log(`hub/COMPONENTS.md: ${ROWS.length} shared rows`);
  }
}
