// i360 icons: Lucide (lucide.dev, ISC licence), from the lucide-static npm package (version set
// with the app's lucide-react by `npm run lucide -- <version>` at the repo root). The pages carry
// each icon as inline SVG (in their HTML, or as text in their scripts), tagged with its meaning
// (src/icons.js) and the Lucide icon that meaning uses:
//
//   <svg data-icon="search" data-lucide="search" viewBox="0 0 24 24">…drawing…</svg>
//
// The page keeps its own attributes on <svg> (size and stroke come from its CSS); the drawing
// inside is exactly Lucide's.
//
//   node scripts/icons.js           check (exit 1, listing what is wrong)
//   node scripts/icons.js --write   set each icon's Lucide name from its meaning and redraw it
//                                   from the installed Lucide (after changing src/icons.js or
//                                   Lucide's version)
//
// Wrong: an <svg> with no meaning, a meaning src/icons.js doesn't have, a Lucide name other than
// its meaning's, a name Lucide doesn't have, a drawing that differs from Lucide's, or anything
// left of Font Awesome. The tests run the check (test/icons.test.js).

import fs from 'fs';
import path from 'path';
import { ICON_SEMANTICS } from '../src/icons.js';

const ROOT = path.join(import.meta.dirname, '..');
// Every file of the pages: their HTML and every script they bundle (src/, all of it).
const PAGES = fs.readdirSync(path.join(ROOT, 'src'), { recursive: true })
  .filter((f) => /\.(html|js)$/.test(f))
  .map((f) => path.posix.join('src', f.split(path.sep).join('/')))
  .sort();
const SVG = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/g;
const NAME = /\sdata-lucide="([a-z0-9-]+)"/;
const MEANING = /\sdata-icon="([A-Za-z0-9.]+)"/;
const FONT_AWESOME = /font-?awesome|\bfa-(solid|regular|brands|[a-z]+-[a-z])|\bfa[srb]? fa-/i;

const LUCIDE = path.join(ROOT, 'node_modules/lucide-static');
const lucide = () => JSON.parse(fs.readFileSync(path.join(LUCIDE, 'icon-nodes.json'), 'utf8'));
const version = () => JSON.parse(fs.readFileSync(path.join(LUCIDE, 'package.json'), 'utf8')).version;

// Lucide's drawing for one icon, as the pages write it.
function draw(nodes) {
  return nodes.map(([tag, attrs]) =>
    `<${tag}${Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join('')}></${tag}>`).join('');
}

const lineOf = (html, at) => html.slice(0, at).split('\n').length;

// The Lucide name a meaning uses ('theme.dark' reads a group), or undefined.
const nameFor = (meaning, semantics) =>
  meaning.split('.').reduce((o, key) => (o && typeof o === 'object' ? o[key] : undefined), semantics);

// What is wrong in one page: [{ line, problem }].
function check(html, icons = lucide(), semantics = ICON_SEMANTICS) {
  const problems = [];
  for (const m of html.matchAll(SVG)) {
    const line = lineOf(html, m.index);
    const meaning = (m[1].match(MEANING) || [])[1];
    const name = (m[1].match(NAME) || [])[1];
    const wanted = meaning && nameFor(meaning, semantics);
    if (!meaning) problems.push({ line, problem: '<svg> without data-icon="…" (its meaning, src/icons.js)' });
    else if (typeof wanted !== 'string') problems.push({ line, problem: `"${meaning}" is not a meaning in src/icons.js` });
    else if (name !== wanted) problems.push({ line, problem: `"${meaning}" uses "${wanted}", not "${name || '(none)'}"` });
    else if (!icons[name]) problems.push({ line, problem: `"${name}" is not a Lucide icon` });
    else if (m[2] !== draw(icons[name])) problems.push({ line, problem: `"${name}" differs from Lucide ${version()}` });
  }
  const fa = html.match(FONT_AWESOME);
  if (fa) problems.push({ line: lineOf(html, fa.index), problem: `Font Awesome is still used ("${fa[0]}")` });
  return problems;
}

// The page with every icon's Lucide name set from its meaning and its drawing redrawn from Lucide
// (an unknown meaning, or a name Lucide doesn't have, left as it is).
function write(html, icons = lucide(), semantics = ICON_SEMANTICS) {
  return html.replace(SVG, (all, attrs) => {
    const meaning = (attrs.match(MEANING) || [])[1];
    const wanted = meaning && nameFor(meaning, semantics);
    if (typeof wanted !== 'string' || !icons[wanted]) return all;
    const named = NAME.test(attrs) ? attrs.replace(NAME, ` data-lucide="${wanted}"`) : attrs.replace(MEANING, (m) => `${m} data-lucide="${wanted}"`);
    return `<svg${named}>${draw(icons[wanted])}</svg>`;
  });
}

function main() {
  const fix = process.argv.includes('--write');
  let bad = 0;
  for (const rel of PAGES) {
    const file = path.join(ROOT, rel);
    let html = fs.readFileSync(file, 'utf8');
    if (fix) {
      const out = write(html);
      if (out !== html) { fs.writeFileSync(file, out); console.log(`${rel}: icons set from src/icons.js and Lucide ${version()}`); html = out; }
    }
    for (const p of check(html)) { bad++; console.log(`${rel}:${p.line}  ${p.problem}`); }
  }
  if (bad) { console.log(`\n${bad} icon problem(s).${fix ? '' : ' Drawings that differ: node scripts/icons.js --write'}`); process.exit(1); }
  console.log(`Icons: every page icon is Lucide ${version()}`);
}

if (process.argv[1] === import.meta.filename) main();
export { PAGES, draw, check, write, version };
