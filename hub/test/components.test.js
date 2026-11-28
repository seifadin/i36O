// Shared components are written once (src/components.js): no page writes their markup itself, the
// build writes each placeholder with the builder (scripts/placeholders.js), and every built page
// carries exactly the builder's structure.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import * as C from '../src/components.js';
import { writeComponents } from '../scripts/placeholders.js';

const ROOT = path.join(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const PAGES = fs.readdirSync(SRC).filter((f) => f.endsWith('.src.html'));
const BUILT = ['../public/md/index.html', '../public/cse/index.html', '../public/day/index.html', 'quran/site/i360/index.html'];
const SVG = (m) => `<svg data-icon="${m}" data-lucide="x" viewBox="0 0 24 24" aria-hidden="true"><path></path></svg>`;
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
// Markup outside the page's <style> and <script> (their text may name classes).
const markup = (html) => html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/g, '');

// Every shared component's own class: only its builder writes it.
const COMPONENT_CLASS = /(?<![\w-])(toolbar-btn|toolbar-menu|tb-(?:title|start|main|end|group)|divider|sr-only|i360-(?:chip|field|btn|list-item|card|inset|popup|banner|toast|status|empty))(?![\w-])/;
// The bar itself, in a page's HTML (in a script, "toolbar" is also the Reader's id for it).
const BAR_CLASS = /(?<![\w-])toolbar(?![\w-])/;

test('components: no page writes a shared component itself — in its HTML each names its placeholder', () => {
  for (const page of PAGES) {
    const html = markup(fs.readFileSync(path.join(SRC, page), 'utf8'));
    const found = [...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1].match(COMPONENT_CLASS) || m[1].match(BAR_CLASS)).filter(Boolean);
    assert.deepEqual(found.map((m) => m[1]), [], `${page}: hand-written component(s) — use their placeholders`);
  }
});

test('components: Daily Reflection writes no card header or status line itself — each names its placeholder', () => {
  const html = markup(fs.readFileSync(path.join(SRC, 'day.src.html'), 'utf8'));
  assert.doesNotMatch(html, /<h2\b/, 'a hand-written card header (<!--@@CARD_HEADER …@@-->)');
  assert.doesNotMatch(html, /data-status="/, 'a hand-written status line (<!--@@STATUS_LINE …@@-->)');
  const built = markup(read('../public/day/index.html'));
  assert.equal((built.match(/<h2 data-i18n="[a-zA-Z]+" class="text-base font-bold uppercase tracking-widest text-[a-z]+">/g) || []).length, 5, 'five card headers, all one size');
  assert.equal((built.match(/<div class="i360-status m[tb]-md" role="status" aria-live="polite" data-status="[a-z]+" hidden><span data-status-text><\/span><button class="i360-btn i360-btn-sm" type="button" data-retry hidden><\/button><\/div>/g) || []).length, 3, 'three status lines');
});

test('components: the CSE writes no status line itself, the quran page no announcer, the Reader no empty state', () => {
  for (const [page, re, what] of [['cse', /id="status"/, 'STATUS_LINE'], ['quran', /class="sr-only"/, 'ANNOUNCER'], ['reader', /id="empty-state"/, 'EMPTY_STATE']]) {
    assert.doesNotMatch(markup(fs.readFileSync(path.join(SRC, `${page}.src.html`), 'utf8')).replace(/<!--[\s\S]*?-->/g, ''), re, `${page}: write it as <!--@@${what} …@@-->`);
  }
});

test('components: no page script writes a shared component\'s class itself — it calls the builder (src/components.js)', () => {
  // day.tailwind.js names sr-only only to block Tailwind's own copy of it.
  const scripts = fs.readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith('.js') && f !== 'components.js' && f !== 'day.tailwind.js');
  for (const rel of scripts) {
    const code = fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const literals = [...code.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]).filter((s) => COMPONENT_CLASS.test(s));
    assert.deepEqual(literals, [], `src/${rel}: writes a component class by hand`);
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
    for (const m of html.matchAll(/<(\w+) class="((?:[^"]* )?i360-(chip|field|btn|list-item|card|inset|popup|banner|toast)(?: [^"]*)?)"([^>]*)>/g)) {
      const [, tag, cls, kind, rest] = m;
      const where = `${rel}: ${m[0].slice(0, 100)}`;
      assert.ok(cls.startsWith(`i360-${kind}`), `${where} — the component's own class comes first`);
      if (kind === 'chip') assert.match(rest, /^ type="button"/, where);
      if (kind === 'btn') assert.match(rest, /^ type="(button|submit)"/, where);
      if (kind === 'field' && tag === 'input') assert.match(rest, /^ (type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"|type="text" inputmode="numeric" autocomplete="off")/, `${where} — a field kind's behaviour`);
    }
    for (const m of html.matchAll(/<button class="i360-chip[^"]*"[^>]*>([\s\S]*?)<\/button>/g)) {
      assert.match(m[1], /^<span class="i360-chip-box"><\/span><span class="i360-chip-label"(?: data-i18n="[^"]+")?>[^<]*<\/span>$/, `${rel}: a chip in another shape`);
    }
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
  assert.equal(C.chip({ id: 'c', text: 'كلمة كاملة', title: 'تلميح', 'data-school': '1' }),
    '<button class="i360-chip" type="button" id="c" title="تلميح" aria-pressed="false" data-school="1"><span class="i360-chip-box"></span><span class="i360-chip-label">كلمة كاملة</span></button>');
  assert.equal(C.chip({ id: 'c', 'label-i18n': 'schoolStd' }), '<button class="i360-chip" type="button" id="c" aria-pressed="false"><span class="i360-chip-box"></span><span class="i360-chip-label" data-i18n="schoolStd"></span></button>');
  assert.equal(C.field({ kind: 'search', id: 'q', name: 'q', 'aria-label': 'نص', class: 'search-input' }),
    '<input class="i360-field i360-field-search search-input" type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" id="q" name="q" aria-label="نص">');
  assert.equal(C.field({ kind: 'number', id: 'p' }), '<input class="i360-field" type="text" inputmode="numeric" autocomplete="off" id="p">');
  assert.equal(C.field({ kind: 'select', id: 's', hidden: true }), '<select class="i360-field" id="s" hidden></select>');
  assert.equal(C.button({ text: 'بحث', primary: true, type: 'submit', class: 'search-btn' }), '<button class="i360-btn i360-btn-primary search-btn" type="submit">بحث</button>');
  assert.equal(C.button({ id: 'e', icon: SVG('expandAll'), label: 'توسيع', small: true }), `<button class="i360-btn i360-btn-sm i360-btn-icon" type="button" id="e" title="توسيع" aria-label="توسيع">${SVG('expandAll')}</button>`);
  assert.equal(C.button({ id: 's', icon: SVG('swap'), 'text-target': 'dir' }), `<button class="i360-btn" type="button" id="s">${SVG('swap')}<span data-target="dir"></span></button>`);
  assert.equal(C.button({ small: true, 'data-retry': true }), '<button class="i360-btn i360-btn-sm" type="button" data-retry></button>');
  assert.equal(C.listItem({ id: 'l', lang: 'ur', 'data-lang': 'ur', text: 'اردو' }), '<button class="i360-list-item" type="button" id="l" lang="ur" data-lang="ur">اردو</button>');
  assert.equal(C.listItem({ href: '/md/?file=x&p=1', class: 'hit' }), '<a class="i360-list-item hit" href="/md/?file=x&amp;p=1"></a>');
  assert.equal(C.box('card', { tag: 'details', class: 'major' }), '<details class="i360-card major"></details>');
  assert.equal(C.box('toast', { id: 't' }), '<div class="i360-toast" id="t" role="status" aria-live="polite"></div>');
  assert.equal(C.box('banner', { html: '<p>x</p>' }), '<div class="i360-banner" role="status"><p>x</p></div>');
  assert.equal(C.cardHeader({ tone: 'quran', icon: SVG('verse'), 'data-i18n': 'quranLabel', text: 'Quranic Verse', class: 'mb-md' }),
    '<div class="flex items-center gap-sm mb-md"><span class="bg-quran-bg text-quran p-sm rounded-lg"><svg class="icon" data-icon="verse" data-lucide="x" viewBox="0 0 24 24" aria-hidden="true"><path></path></svg></span><h2 data-i18n="quranLabel" class="text-base font-bold uppercase tracking-widest text-quran">Quranic Verse</h2></div>');
  assert.equal(C.statusLine({ part: 'prayer', class: 'mb-md' }), '<div class="i360-status mb-md" role="status" aria-live="polite" data-status="prayer" hidden><span data-status-text></span><button class="i360-btn i360-btn-sm" type="button" data-retry hidden></button></div>');
  assert.equal(C.statusLine({ id: 'status', keep: true }), '<div class="i360-status" id="status" role="status" aria-live="polite" data-status-keep><span data-status-text></span><button class="i360-btn i360-btn-sm" type="button" data-retry hidden></button></div>');
  assert.equal(C.announcer({ id: 'announce' }), '<span class="sr-only" id="announce" role="status" aria-live="polite"></span>');
  assert.equal(C.emptyState({ id: 'e', class: 'empty-state' }), '<div class="i360-empty empty-state" id="e"></div>');
  assert.equal(C.emptyState({ text: 'لا علامات <بعد>' }), '<div class="i360-empty">لا علامات &lt;بعد></div>');
  assert.throws(() => C.cardHeader({ tone: 'pink', icon: SVG('x'), text: 't' }), /needs a tone/);
  assert.equal(C.cardFooter({ tone: 'quran', part: 'quran', citation: true, reference: 'text', source: 'link', 'source-text': 'AlQuran.cloud', 'source-href': 'https://alquran.cloud/', class: 'mt-md' }),
    '<div class="border-t border-rule pt-md space-y-xs font-bold text-quran mt-md"><p data-target="quran-citation" class="text-base empty:hidden"></p><p data-target="quran-reference" class="text-sm empty:hidden"></p>'
    + '<p class="text-sm"><span data-i18n="sourceLabel">Source</span>: <a data-target="quran-link" href="https://alquran.cloud/" target="_blank" rel="noopener noreferrer" class="underline">AlQuran.cloud</a></p></div>');
  assert.equal(C.cardFooter({ tone: 'hadith', part: 'hadith', reference: 'details', 'reference-i18n': 'refsLabel' }),
    '<div class="border-t border-rule pt-md space-y-xs font-bold text-hadith"><details class="text-sm has-[>p:empty]:hidden"><summary data-i18n="refsLabel" class="cursor-pointer text-base"></summary><p data-target="hadith-reference" class="mt-sm whitespace-pre-line"></p></details></div>');
  assert.equal(C.cardFooter({ tone: 'converter', part: 'conv', source: 'text' }),
    '<div class="border-t border-rule pt-md space-y-xs font-bold text-converter"><p data-target="conv-source" class="text-sm empty:hidden"></p></div>');
  assert.throws(() => C.cardFooter({ tone: 'quran', part: 'q' }), /at least one row/);
  assert.throws(() => C.cardFooter({ tone: 'pink', part: 'q', citation: true }), /needs a tone/);
  assert.throws(() => C.cardFooter({ tone: 'quran', part: 'q', reference: 'details' }), /reference-i18n/);
  assert.throws(() => C.cardFooter({ tone: 'quran', part: 'q', source: 'link' }), /source-text and source-href/);
  assert.throws(() => C.cardFooter({ tone: 'quran', part: 'q', source: 'image' }), /"link" or "text"/);
  assert.throws(() => C.statusLine({}), /needs its part or id/);
  assert.throws(() => C.field({ kind: 'date' }), /search, number or select/);
  assert.throws(() => C.box('popup', { tag: 'section' }), /a popup is a div/);
  assert.throws(() => C.box('sidebar'), /no container/);
});

test('components: the toolbar and its parts — a header (the app\'s: a div), its variant its own modifier class', () => {
  assert.equal(C.box('toolbar', { variant: 'sticky', html: 'x' }), '<header class="toolbar toolbar-sticky">x</header>');
  assert.equal(C.box('toolbar', { id: 'toolbar' }), '<header class="toolbar" id="toolbar"></header>');
  assert.equal(C.box('toolbar', { tag: 'div', variant: 'bottom', class: 'justify-between' }), '<div class="toolbar toolbar-bottom justify-between"></div>');
  assert.throws(() => C.box('toolbar', { variant: 'floating' }), /no variant/);
  assert.throws(() => C.box('card', { variant: 'sticky' }), /no variant/);
  assert.equal(C.box('toolbarStart'), '<div class="tb-start"></div>');
  assert.equal(C.box('toolbarMain'), '<div class="tb-main"></div>');
  assert.equal(C.box('toolbarEnd'), '<div class="tb-end"></div>');
  assert.equal(C.box('toolbarGroup', { id: 'g' }), '<div class="tb-group" id="g"></div>');
  assert.equal(C.box('toolbarMenu', { id: 'm', hidden: true }), '<div class="toolbar-menu" id="m" hidden></div>');
  assert.equal(writeComponents('<!--@@TOOLBAR variant="sticky"@@--><!--@@TOOLBAR_START@@-->s<!--@@/TOOLBAR_START@@--><!--@@TOOLBAR_MENU id="m" hidden@@--><!--@@TOOLBAR_GROUP id="g"@@-->x<!--@@/TOOLBAR_GROUP@@--><!--@@/TOOLBAR_MENU@@--><!--@@/TOOLBAR@@-->'),
    '<header class="toolbar toolbar-sticky"><div class="tb-start">s</div><div class="toolbar-menu" id="m" hidden><div class="tb-group" id="g">x</div></div></header>');
  assert.throws(() => C.labelButton({ id: 'l', text: 't' }), /needs icon and text/);
  assert.throws(() => C.menuButton({ id: 'm', icon: SVG('x') }), /needs icon, textId and aria-controls/);
});

test('components: placeholders are written by the builders; build.js\'s own are left; mistakes stop the build', () => {
  const page = '<!--@@SETTINGS_BUTTONS@@--><!--@@DIVIDER@@--><!--@@TOOLBAR_BUTTON id="b" icon="close" hidden@@--><!--@@TOOLBAR_TITLE id="t"@@--> اسم <!--@@/TOOLBAR_TITLE@@--><!--@@CSP@@-->';
  assert.equal(writeComponents(page, SVG),
    C.settingsButtons() + C.divider() + C.toolbarButton({ id: 'b', icon: SVG('close'), hidden: true }) + '<h1 class="tb-title" id="t">اسم</h1><!--@@CSP@@-->');
  assert.equal(writeComponents('<!--@@LABEL_BUTTON id="b" icon="openFile" text="Open file" label-id="l"@@-->', SVG), C.labelButton({ id: 'b', icon: SVG('openFile'), text: 'Open file', labelId: 'l' }));
  assert.equal(writeComponents('<!--@@CARD id="c" class="glass"@@--><p><!--@@INSET@@--><!--@@CHIP id="o" text="t"@@--><!--@@/INSET@@--></p><!--@@/CARD@@-->', SVG),
    `<section class="i360-card glass" id="c"><p><div class="i360-inset">${C.chip({ id: 'o', text: 't' })}</div></p></section>`);
  assert.equal(writeComponents('<!--@@INSET@@-->a<!--@@INSET@@-->b<!--@@/INSET@@--><!--@@/INSET@@-->', SVG), '<div class="i360-inset">a<div class="i360-inset">b</div></div>');
  assert.equal(writeComponents('<!--@@BUTTON id="p" icon="pickDate"@@-->', SVG), C.button({ id: 'p', icon: SVG('pickDate') }));
  assert.throws(() => writeComponents('<!--@@TOOLBAR_BUTON id="b"@@-->', SVG), /unknown component/);
  assert.throws(() => writeComponents('<!--@@CARD id="c"@@-->no end', SVG), /unknown component/);
  assert.throws(() => writeComponents('<!--@@LABEL_BUTTON id="b" text="y"@@-->', SVG), /needs id, icon and text/);
  assert.throws(() => writeComponents('<!--@@TOOLBAR_TITLE@@-->no end'), /unknown component/);
  assert.throws(() => writeComponents('<!--@@TOOLBAR_BUTTON id="b" icon="noSuchMeaning"@@-->'), /not a meaning in src\/icons\.js/);
});

test('components: page-chrome.css has every comment closed, and the label button\'s rule is live (not inside a comment)', () => {
  const css = fs.readFileSync(path.join(SRC, 'page-chrome.css'), 'utf8');
  assert.equal((css.match(/\/\*/g) || []).length, (css.match(/\*\//g) || []).length, 'a comment is never closed');
  assert.match(css.replace(/\/\*[\s\S]*?\*\//g, ''), /\.toolbar-btn-label\s*\{/, '.toolbar-btn-label { … } is missing or commented out');
});

test('components: Daily Reflection\'s verse, hadith and converter cards end with the shared footer, nothing hand-written', () => {
  const html = fs.readFileSync(path.join(ROOT, 'src', 'day.src.html'), 'utf8');
  for (const part of ['quran', 'hadith', 'conv']) assert.match(html, new RegExp(`<!--@@CARD_FOOTER [^@]*part="${part}"`), part);
  assert.doesNotMatch(html, /border-t border-rule pt-md space-y-xs/, 'a footer written by hand');
  assert.doesNotMatch(html, /data-i18n="sourceLabel"/, 'a source line written by hand');
});
