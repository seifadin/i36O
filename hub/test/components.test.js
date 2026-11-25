// Shared components are written once (src/components.js): no page writes their markup itself, the
// build writes each placeholder with the builder (scripts/components.js), and every built page
// carries exactly the builder's structure.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import * as C from '../src/components.js';
import { writeComponents } from '../scripts/components.js';

const ROOT = path.join(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const PAGES = fs.readdirSync(SRC).filter((f) => f.endsWith('.src.html'));
const BUILT = ['../public/md/index.html', '../public/cse/index.html', '../public/day/index.html', 'quran/site/i360/index.html'];
const SVG = (m) => `<svg data-icon="${m}" data-lucide="x" viewBox="0 0 24 24" aria-hidden="true"><path></path></svg>`;
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
// Markup outside the page's <style> and <script> (their text may name classes).
const markup = (html) => html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/g, '');

test('components: no page writes a toolbar button, title or divider itself — each names its placeholder', () => {
  for (const page of PAGES) {
    const html = markup(fs.readFileSync(path.join(SRC, page), 'utf8'));
    assert.doesNotMatch(html, /class="[^"]*\btoolbar-btn\b/, `${page}: a hand-written toolbar button (<!--@@TOOLBAR_BUTTON …@@-->)`);
    assert.doesNotMatch(html, /class="[^"]*\btb-title\b/, `${page}: a hand-written toolbar title (<!--@@TOOLBAR_TITLE …@@-->)`);
    assert.doesNotMatch(html, /class="[^"]*\bdivider\b/, `${page}: a hand-written divider (<!--@@DIVIDER@@-->)`);
  }
});

test('components: every built page\'s toolbar buttons, titles and dividers have the builders\' structure', () => {
  const BUTTON = /<button class="toolbar-btn(?: [a-z-]+)*" type="button"(?: (?:id|title|aria-label|dir|aria-controls|aria-haspopup|aria-expanded|aria-pressed)="[^"]*")*(?: disabled)?(?: hidden)?>((?:<svg data-icon="[A-Za-z.]+" data-lucide="[a-z0-9-]+" viewBox="0 0 24 24" aria-hidden="true">[\s\S]*?<\/svg>)?(?:<span(?: id="[^"]*")?>[^<]*<\/span>)?(?:<svg[\s\S]*?<\/svg>)?)<\/button>/g;
  let buttons = 0;
  for (const rel of BUILT) {
    const html = markup(read(rel));
    const all = html.match(/<button class="toolbar-btn[\s\S]*?<\/button>/g) || [];
    const shaped = html.match(BUTTON) || [];
    assert.equal(shaped.length, all.length, `${rel}: a toolbar button in another shape`);
    buttons += all.length;
    assert.equal((html.match(/class="tb-title"/g) || []).length, (html.match(/<h1 class="tb-title"/g) || []).length, `${rel}: a toolbar title that isn't the builder's <h1>`);
    assert.equal((html.match(/class="divider"/g) || []).length, (html.match(/<span class="divider" aria-hidden="true"><\/span>/g) || []).length, `${rel}: a divider in another shape`);
    assert.doesNotMatch(html, /<!--@@/, `${rel}: a placeholder left unfilled`);
  }
  assert.ok(buttons >= 35, `the pages' toolbar buttons are found (${buttons})`);
});

test('components: each builder writes one fixed structure, attributes in one order, text escaped', () => {
  assert.equal(C.toolbarButton({ hidden: true, 'aria-pressed': 'false', id: 'b', icon: SVG('close'), label: 'إغلاق "x"', class: 'extra' }),
    `<button class="toolbar-btn extra" type="button" id="b" title="إغلاق &quot;x&quot;" aria-label="إغلاق &quot;x&quot;" aria-pressed="false" hidden>${SVG('close')}</button>`);
  assert.equal(C.toolbarButton({ id: 'e', dir: 'ltr' }), '<button class="toolbar-btn" type="button" id="e" dir="ltr"></button>');
  assert.equal(C.labelButton({ id: 'l', icon: SVG('exegesis'), text: 'تفسير <و>', labelId: 'll', disabled: true }),
    `<button class="toolbar-btn toolbar-btn-label" type="button" id="l" disabled>${SVG('exegesis')}<span id="ll">تفسير &lt;و></span></button>`);
  assert.equal(C.menuButton({ id: 'm', icon: SVG('dropdown'), textId: 't', 'aria-controls': 'list' }),
    `<button class="toolbar-btn toolbar-btn-menu" type="button" id="m" aria-controls="list" aria-haspopup="true" aria-expanded="false"><span id="t"></span>${SVG('dropdown')}</button>`);
  assert.equal(C.settingsButtons(), '<button class="toolbar-btn" type="button" id="btn-theme"></button><button class="toolbar-btn numerals-btn" type="button" id="btn-numerals"></button>');
  assert.equal(C.toolbarTitle({ 'data-i18n': 'title', html: 'البحث في <bdi dir="ltr">i360</bdi>' }), '<h1 class="tb-title" data-i18n="title">البحث في <bdi dir="ltr">i360</bdi></h1>');
  assert.equal(C.divider(), '<span class="divider" aria-hidden="true"></span>');
  assert.throws(() => C.labelButton({ id: 'l', text: 't' }), /needs icon and text/);
  assert.throws(() => C.menuButton({ id: 'm', icon: SVG('x') }), /needs icon, textId and aria-controls/);
});

test('components: placeholders are written by the builders; build.js\'s own are left; mistakes stop the build', () => {
  const page = '<!--@@SETTINGS_BUTTONS@@--><!--@@DIVIDER@@--><!--@@TOOLBAR_BUTTON id="b" icon="close" hidden@@--><!--@@TOOLBAR_TITLE id="t"@@--> اسم <!--@@/TOOLBAR_TITLE@@--><!--@@CSP@@-->';
  assert.equal(writeComponents(page, SVG),
    C.settingsButtons() + C.divider() + C.toolbarButton({ id: 'b', icon: SVG('close'), hidden: true }) + '<h1 class="tb-title" id="t">اسم</h1><!--@@CSP@@-->');
  assert.equal(writeComponents('<!--@@LABEL_BUTTON id="b" icon="openFile" text="Open file" label-id="l"@@-->', SVG), C.labelButton({ id: 'b', icon: SVG('openFile'), text: 'Open file', labelId: 'l' }));
  assert.throws(() => writeComponents('<!--@@TOOLBAR_BUTON id="b"@@-->', SVG), /unknown component/);
  assert.throws(() => writeComponents('<!--@@LABEL_BUTTON id="b" text="y"@@-->', SVG), /needs id, icon and text/);
  assert.throws(() => writeComponents('<!--@@TOOLBAR_TITLE@@-->no end'), /unknown component/);
  assert.throws(() => writeComponents('<!--@@TOOLBAR_BUTTON id="b" icon="noSuchMeaning"@@-->'), /not a meaning in src\/icons\.js/);
});

test('components: page-chrome.css has every comment closed, and the label button\'s rule is live (not inside a comment)', () => {
  const css = fs.readFileSync(path.join(SRC, 'page-chrome.css'), 'utf8');
  assert.equal((css.match(/\/\*/g) || []).length, (css.match(/\*\//g) || []).length, 'a comment is never closed');
  assert.match(css.replace(/\/\*[\s\S]*?\*\//g, ''), /\.toolbar-btn-label\s*\{/, '.toolbar-btn-label { … } is missing or commented out');
});
