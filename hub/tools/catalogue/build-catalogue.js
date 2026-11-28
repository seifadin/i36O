// The components' catalogue (dev-only): one page showing every shared component, made by its real
// builder (src/components.js) from its examples (scripts/component-samples.js), side by side in the
// light, sepia and dark themes, with the shared stylesheet (src/page-chrome.css), the theme's
// built-in colours and Daily Reflection's Tailwind — as the pages have them. Nothing here is drawn
// by hand, so a change to a component shows here as it will on every page, and a new component
// appears as soon as it has an example (a test fails until it does).
//
//   cd hub && npm run build (or npm run catalogue alone) writes tools/catalogue/out/index.html (git-ignored):
//   one self-contained file — download it from the Codespace and open it in a browser.
//
// Never built into a page or deployed. The app's React components render the same markup (parity-
// tested: src/components/shared.test.ts), so they aren't shown separately. Uses and classes:
// hub/COMPONENTS.md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { SAMPLES, render } from '../../scripts/component-samples.js';
import { ROWS } from '../../scripts/list-components.js';
import { fallbackCss } from '../../theme/fallbacks.js';
import { THEME_ORIGIN } from '../../src/sites.js';

const HUB = join(import.meta.dirname, '..', '..');
const OUT_DIR = join(import.meta.dirname, 'out');
const read = (p) => readFileSync(join(HUB, p), 'utf8');
const THEMES = ['light', 'sepia', 'dark'];
const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const call = (row) => (row.startsWith('box:') ? `box('${row.slice(4)}')` : row);
// «i360إ» as the CSE's title writes it (src/cse.src.html): an isolate keeps the إ after the name, a mark
// before it keeps it there with Eastern digits.
const anchor = (row) => `c-${row.replace(':', '-')}`;

// The catalogue's own layout: theme columns and labels, from the theme's values.
// The shared stylesheet's own names for the theme's values (:root { --toolbar-bg: var(--i360-toolbar) … })
// resolve once, at the page's root, so each theme column names them again for its own colours.
const chrome = read('src/page-chrome.css');
const ROOT_ALIASES = [...chrome.matchAll(/^:root\s*\{([^}]*)\}/gm)].map((m) => m[1]).join('\n');
const CATALOGUE_CSS = `
  [data-theme] {${ROOT_ALIASES}}
  body { font-family: var(--i360-font); font-size: var(--i360-text-size); line-height: var(--i360-line-height-ui);
    background-color: var(--i360-bg); color: var(--i360-text); margin: 0; }
  .cat-page { max-width: calc(3 * var(--i360-content-width) / 2); margin-inline: auto; padding: var(--i360-space-lg) var(--i360-gap); }
  .cat-page > h1 { font-size: var(--i360-text-size-xl); margin-block-end: var(--i360-space-sm); }
  .cat-note { color: var(--i360-muted); font-size: var(--i360-text-size-sm); }
  .cat-index { display: flex; flex-wrap: wrap; gap: var(--i360-space-xs) var(--i360-space-md); margin-block: var(--i360-space-md);
    font-size: var(--i360-text-size-sm); }
  .cat-index a { color: var(--i360-link); }
  .cat-component { margin-block-start: var(--i360-space-lg); border-block-start: var(--i360-line-width) solid var(--i360-border);
    padding-block-start: var(--i360-space-md); }
  .cat-component > h2 { font-size: var(--i360-text-size-lg); direction: ltr; text-align: start; unicode-bidi: plaintext; }
  .cat-themes { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: var(--i360-space-md);
    margin-block-start: var(--i360-space-sm); }
  .cat-theme { background-color: var(--i360-bg); color: var(--i360-text); border: var(--i360-line-width) solid var(--i360-border);
    border-radius: var(--i360-radius-lg); padding: var(--i360-space-md); display: flex; flex-direction: column; gap: var(--i360-space-md); }
  .cat-theme-name { font-size: var(--i360-text-size-sm); color: var(--i360-muted); direction: ltr; text-align: end; }
  .cat-example-name { font-size: var(--i360-text-size-sm); color: var(--i360-muted); margin-block-end: var(--i360-space-xs); }
  .cat-example { position: relative; }
  .cat-example .toolbar, .cat-example .toolbar-menu { position: static; }   /* in place, not floating */
  /* What a page sets for itself, as Daily Reflection (src/day.src.html) does: icon sizes (and the app's search bar's), and no
     letter spacing in Arabic. */
  svg.icon, .i360-field svg { width: var(--i360-icon-size); height: var(--i360-icon-size); display: block; }
  [dir="rtl"] .tracking-widest { letter-spacing: normal !important; }
`;

// The page, without its Tailwind (filled in by the build below from the classes the page uses).
function catalogueHtml() {
  const sections = ROWS.map((row) => {
    const examples = SAMPLES[row].map((s) => {
      const own = render(row, s.args);
      return `<div class="cat-example"><div class="cat-example-name">${escapeText(s.name)}</div>${s.display ? s.display(own) : own}</div>`;
    }).join('');
    const columns = THEMES.map((t) => `<div class="cat-theme" data-theme="${t}"><div class="cat-theme-name">${t}</div>${examples}</div>`).join('');
    return `<section class="cat-component" id="${anchor(row)}"><h2>${call(row)}</h2><div class="cat-themes">${columns}</div></section>`;
  }).join('\n');
  const index = ROWS.map((row) => `<a href="#${anchor(row)}">${call(row)}</a>`).join('');
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>مكوّنات &#x2066;i360إ&#x2069;</title>
  <style id="i360-fallback">${fallbackCss(read('theme/site/theme.css'))}</style>
  <link rel="stylesheet" href="${THEME_ORIGIN}/theme.css">
  <style>${chrome}${CATALOGUE_CSS}</style>
  <style id="tailwind">/*@@TAILWIND@@*/</style>
</head>
<body class="i360-page">
  <main class="cat-page">
    <h1>مكوّنات <bdi dir="ltr">i360&lrm;إ</bdi> المشتركة</h1>
    <p class="cat-note">${ROWS.length} مكوّنًا، كلٌّ منها مرسوم من بانيه في الشيفرة، بالسمات الثلاث. أماكن الاستخدام: hub/COMPONENTS.md</p>
    <nav class="cat-index">${index}</nav>
${sections}
  </main>
</body>
</html>
`;
}

export { catalogueHtml };

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = join(OUT_DIR, 'index.html');
  const html = catalogueHtml();
  writeFileSync(file, html);
  // Daily Reflection's Tailwind (its card header, footer and status line use it), built from the
  // classes this page and the builders use.
  const tailwind = execFileSync(process.execPath, [join(HUB, 'node_modules/tailwindcss/lib/cli.js'), '-c', join(HUB, 'src/day.tailwind.js'),
    '--content', `${file},${join(HUB, 'src/components.js')}`, '--minify'], { cwd: HUB, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  writeFileSync(file, html.replace('/*@@TAILWIND@@*/', () => tailwind.trim()));
  console.log(`tools/catalogue/out/index.html: ${ROWS.length} components × ${THEMES.length} themes`);
}
