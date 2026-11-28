// The shared components' markup, written once (their style: src/page-chrome.css). Every page gets
// exactly this structure and differs only in its own id, words and icon:
// - in a page's HTML, a placeholder the build writes out (scripts/placeholders.js):
//     <!--@@GHOST_BUTTON id="btn-zoom-in" icon="zoomIn"@@-->
// - in a page's script, the same function, its markup made an element (fromMarkup in page-chrome.js):
//     fromMarkup(ghostButton({ icon: ICON.delete }))
// Pure functions of their inputs (no browser needed), so the build and the pages share them. An icon
// is passed drawn (an <svg> string: the build draws it from its meaning, a page script imports it
// from 'i360:icons', drawn the same way by scripts/icons.js); every icon is hidden from screen readers, as each
// control names itself (its label, or title and aria-label).

const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const escapeAttr = (s) => escapeText(s).replace(/"/g, '&quot;');

// The attributes a component may take, always written in this order, then any data-* attributes
// (by name). `label` names a control (title and aria-label); `title` alone is a tooltip; `class`
// adds a page's own class beside the component's (placement only). true writes a bare attribute.
const ATTRIBUTE_ORDER = ['id', 'name', 'href', 'target', 'rel', 'lang', 'dir', 'role', 'label', 'title', 'aria-label',
  'placeholder', 'aria-controls', 'aria-labelledby', 'aria-haspopup', 'aria-expanded', 'aria-pressed', 'aria-selected',
  'aria-live', 'data-i18n'];

function attributes(a) {
  let out = '';
  const write = (name, value) => {
    if (value === undefined || value === null || value === false) return;
    if (name === 'label') out += ` title="${escapeAttr(value)}" aria-label="${escapeAttr(value)}"`;
    else out += value === true ? ` ${name}` : ` ${name}="${escapeAttr(value)}"`;
  };
  for (const name of ATTRIBUTE_ORDER) write(name, a[name]);
  for (const name of Object.keys(a).filter((k) => k.startsWith('data-') && k !== 'data-i18n').sort()) write(name, a[name]);
  return out;
}
const GHOST_BUTTON = 'i360-btn-ghost';
const TITLE = 'tb-title';
const flags = (a) => `${a.disabled ? ' disabled' : ''}${a.hidden ? ' hidden' : ''}`;
const classes = (own, extra) => (extra ? `${own} ${extra}` : own);

// The inside of a button: its icon and/or its text, icon first — `text` fixed, `text-id` naming the
// <span> its script fills, or data-i18n (its words by language, filled by its page). A button with
// none of these is refused, unless `drawn` (its script draws it all: the numerals sample, the
// text-size buttons).
function buttonInside(a, what) {
  const words = a.text !== undefined || a['text-id'] || a['data-i18n'];
  if (!a.icon && !words && !a.drawn) throw new Error(`${what} needs an icon, a text or both (or drawn, when its script draws it)`);
  const span = words ? `<span${a['text-id'] ? ` id="${escapeAttr(a['text-id'])}"` : ''}>${escapeText(a.text ?? '')}</span>` : '';
  return { icon: a.icon || '', span, iconOnly: !!a.icon && !words };
}

// A ghost button: no pill and no outline, a fill only when hovered or on — the toolbars' buttons, and
// any bare button beside a field or in a row. Its icon and/or text (buttonInside, above). `menu`:
// it opens a list (aria-controls names it) — its text, then the small dropdown icon, which is then
// its `icon` (Daily Reflection's languages).
function ghostButton(a = {}) {
  const { icon, span } = buttonInside(a, 'a ghost button');
  if (a.menu) {
    if (!a['aria-controls'] || !span) throw new Error('a menu button needs its text and aria-controls');
    return `<button class="${classes(`${GHOST_BUTTON} ${GHOST_BUTTON}-menu`, a.class)}" type="button"${attributes({ ...a, 'aria-haspopup': 'true', 'aria-expanded': 'false' })}${flags(a)}>${span}${icon}</button>`;
  }
  return `<button class="${classes(GHOST_BUTTON, a.class)}" type="button"${attributes(a)}${flags(a)}>${icon}${span}</button>`;
}

// The theme and numerals buttons, in the order of every i360 page (drawn by drawSettingsButtons).
function settingsButtons() {
  return ghostButton({ id: 'btn-theme', drawn: true }) + ghostButton({ id: 'btn-numerals', class: 'numerals-btn', drawn: true });
}

// The page's name on its toolbar: its one heading. `html` is the page's own fixed markup (the CSE
// keeps «i360إ» in order with <bdi>).
function toolbarTitle(a = {}) {
  if (a.html === undefined) throw new Error('a toolbar title needs its text');
  return `<h1 class="${TITLE}"${attributes(a)}>${a.html}</h1>`;
}

// A thin line between groups of toolbar buttons.
function divider(a = {}) {
  return `<span class="${classes('divider', a.class)}" aria-hidden="true"></span>`;
}

const CLASS_CHIP_LABEL = 'i360-chip-label';

// An option that is on or off (aria-pressed), shown with a tick box: the box, then its label
// (`text`, or empty for a script to fill; data-i18n names the label's words).
function chip(a = {}) {
  const label = `<span class="${CLASS_CHIP_LABEL}"${a['label-i18n'] ? ` data-i18n="${escapeAttr(a['label-i18n'])}"` : ''}>${escapeText(a.text ?? '')}</span>`;
  return `<button class="${classes('i360-chip', a.class)}" type="button"${attributes({ ...a, 'aria-pressed': a['aria-pressed'] ?? 'false' })}${flags(a)}>`
    + `<span class="i360-chip-box"></span>${label}</button>`;
}

// What each kind of box does with the browser's help, the same on every page: a search box shows
// its own results (no remembered entries, no corrections, a search key on the keyboard); a number
// box takes digits (no remembered entries); a list is a <select>.
const FIELD_KINDS = Object.freeze({
  search: ' type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"',
  number: ' type="text" inputmode="numeric" autocomplete="off"',
});

// A field: a search box, a number box or a list (its kind, above). `in-box`: it sits in a field box
// (box('fieldBox')) with its buttons, which gives it its look — every search box with buttons.
function field(a = {}) {
  if (a.kind === 'select') return `<select class="${classes('i360-field', a.class)}"${attributes(a)}${flags(a)}></select>`;
  const kind = FIELD_KINDS[a.kind];
  if (!kind) throw new Error(`a field's kind is search, number or select, not "${a.kind}"`);
  const own = a['in-box'] ? 'i360-field-input' : a.kind === 'search' ? 'i360-field i360-field-search' : 'i360-field';
  return `<input class="${classes(own, a.class)}"${kind}${attributes(a)}${flags(a)}>`;
}

// A button: a pill, outlined, or filled for the main action (`primary`); `small` makes it smaller.
// Its icon and/or text (buttonInside, above) — an icon alone takes .i360-btn-icon. type submit in a
// form.
function button(a = {}) {
  const { icon, span, iconOnly } = buttonInside(a, 'a button');
  const own = ['i360-btn', a.primary && 'i360-btn-primary', a.small && 'i360-btn-sm', iconOnly && 'i360-btn-icon'].filter(Boolean).join(' ');
  const inner = icon ? icon + span : span.replace(/^<span>|<\/span>$/g, '');
  return `<button class="${classes(own, a.class)}" type="${a.type === 'submit' ? 'submit' : 'button'}"${attributes(a)}${flags(a)}>${inner}</button>`;
}

// One row of a list: a button, or a link when it has an href. Its contents are its text, or what
// its script adds.
function listItem(a = {}) {
  const inner = escapeText(a.text ?? '');
  return a.href !== undefined
    ? `<a class="${classes('i360-list-item', a.class)}"${attributes(a)}>${inner}</a>`
    : `<button class="${classes('i360-list-item', a.class)}" type="button"${attributes(a)}${flags(a)}>${inner}</button>`;
}

const RESULT = 'i360-result';
const RESULT_LAYOUTS = Object.freeze(['stacked', 'inline']);

// A result row: where something is and what it says — a list row (listItem's look: a link with
// `href`, else a button) holding `where` (a page label, small and muted, as every page number and
// count) and its text: `text`, or a search `snippet` ({ before, hit, after }, the hit marked).
//   stacked  where above, then the snippet in reading text (it is the book's own words) — search
//            results (the CSE's, the Reader's); `more` adds a second muted note beside where
//            (the CSE's «مواضع: N»)
//   inline   the text, then where at the line's end — a table of contents, bookmarks; `level`
//            1–4 (a heading's: 1 and 2 bold, 3 and 4 further in)
// The text takes its direction from itself (dir="auto": a book may be Arabic or English). `class`
// places the row; `title` names where it goes.
function resultRow(a = {}) {
  const layout = a.layout || 'stacked';
  if (!RESULT_LAYOUTS.includes(layout)) throw new Error(`a result row's layout is stacked or inline, not "${a.layout}"`);
  if (a.text === undefined && !a.snippet) throw new Error('a result row needs its text or snippet');
  if (a.level !== undefined && (layout !== 'inline' || ![1, 2, 3, 4].includes(Number(a.level)))) throw new Error('a level (1–4) is for an inline result row');
  const s = a.snippet;
  const text = `<span class="${RESULT}-text" dir="auto">${s ? `${escapeText(s.before)}<mark>${escapeText(s.hit)}</mark>${escapeText(s.after)}` : escapeText(a.text)}</span>`;
  const notes = [a.where ? `<span>${escapeText(a.where)}</span>` : '', a.more ? `<span class="${RESULT}-more">${escapeText(a.more)}</span>` : ''].join('');
  const where = notes ? `<span class="${RESULT}-where">${notes}</span>` : '';
  const own = [`i360-list-item ${RESULT} ${RESULT}-${layout}`, a.level !== undefined && `${RESULT}-level-${Number(a.level)}`].filter(Boolean).join(' ');
  const inner = layout === 'stacked' ? where + text : text + where;
  return a.href !== undefined
    ? `<a class="${classes(own, a.class)}"${attributes(a)}>${inner}</a>`
    : `<button class="${classes(own, a.class)}" type="button"${attributes(a)}${flags(a)}>${inner}</button>`;
}

// The containers: their element and class; what is inside is the page's own (`html`, or what its
// script adds). A card may be a <section> or an <article> (the Reader's page sheets); a popup
// a <span> when it is a tooltip; a banner a <button> when tapping it opens its details (the app's
// load error) — then a button, not a status. fieldBox: a field's look round a field and its
// buttons (the app's search bar). The app's React versions: src/components/shared.tsx, checked
// against these by src/components/shared.test.ts.
// Each container, as the components' inventory (scripts/list-components.js) names it:
//   card          A box around a section
//   inset         A box inside a section
//   popup         A pop-up: a list, a dialog or a tooltip
//   banner        A notice
//   toast         A short message that comes and goes
//   fieldBox      A field's look round a field and its buttons
//   toolbar       A toolbar
//   toolbarStart  A toolbar's start (its settings)
//   toolbarMain   A toolbar's middle
//   toolbarEnd    A toolbar's end
//   toolbarGroup  A group of toolbar buttons
//   toolbarMenu   A toolbar's ⋮ menu
//   rows          A list of rows, a line between each (the science accordions)
const BOXES = Object.freeze({
  card: { cls: 'i360-card', tags: ['section', 'article', 'div'] },
  inset: { cls: 'i360-inset', tags: ['div'] },
  popup: { cls: 'i360-popup', tags: ['div', 'span'] },
  banner: { cls: 'i360-banner', tags: ['div', 'button'], role: 'status' },
  toast: { cls: 'i360-toast', tags: ['div'], role: 'status', live: 'polite' },
  fieldBox: { cls: 'i360-field i360-field-search', tags: ['div'] },
  // The toolbar (src/page-chrome.css): the bar, its parts, a group of its buttons and its ⋮ menu.
  // A bar's variant (sticky: stays at the top while the page scrolls; bottom: the app's) is its own
  // modifier class, never a page's.
  toolbar: { cls: 'toolbar', tags: ['header', 'div'], variants: ['sticky', 'bottom'] },
  toolbarStart: { cls: 'tb-start', tags: ['div'] },
  toolbarMain: { cls: 'tb-main', tags: ['div'] },
  toolbarEnd: { cls: 'tb-end', tags: ['div'] },
  toolbarGroup: { cls: 'tb-group', tags: ['div'] },
  toolbarMenu: { cls: 'toolbar-menu', tags: ['div'] },
  rows: { cls: 'i360-rows', tags: ['div'] },
});

function box(kind, a = {}) {
  const k = BOXES[kind];
  if (!k) throw new Error(`no container "${kind}"`);
  const tag = a.tag || k.tags[0];
  if (!k.tags.includes(tag)) throw new Error(`a ${kind} is a ${k.tags.join(' or ')}, not a ${tag}`);
  if (a.variant && !(k.variants || []).includes(a.variant)) throw new Error(`a ${kind} has no variant "${a.variant}"`);
  const own = a.variant ? `${k.cls} ${k.cls}-${a.variant}` : k.cls;
  const isButton = tag === 'button';
  const all = { ...a, role: a.role ?? (isButton ? undefined : k.role), 'aria-live': a['aria-live'] ?? k.live };
  return `<${tag} class="${classes(own, a.class)}"${isButton ? ' type="button"' : ''}${attributes(all)}${flags(a)}>${a.html ?? ''}</${tag}>`;
}

// An icon named by data, not by a meaning (the sciences' icons, named in Baserow: the CSE draws them
// from its catalog, indexer/science-icons.js): Lucide's drawing `nodes` ([[tag, attrs], …], as in
// lucide-static's icon-nodes.json) written as the pages write every icon — only the shapes and
// attributes Lucide uses, escaped. '' for a name or drawing that isn't one.
const SHAPES = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);
const SHAPE_ATTRIBUTES = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'fill']);
function dataIcon(name, nodes) {
  if (!/^[a-z0-9-]+$/.test(String(name)) || !Array.isArray(nodes) || !nodes.length) return '';
  const drawing = nodes.filter((n) => Array.isArray(n) && SHAPES.has(n[0])).map(([tag, attrs]) =>
    `<${tag}${Object.entries(attrs || {}).filter(([k]) => SHAPE_ATTRIBUTES.has(k)).map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('')}></${tag}>`).join('');
  return `<svg data-lucide="${name}" viewBox="0 0 24 24" aria-hidden="true">${drawing}</svg>`;
}

const DISCLOSURE = 'i360-disclosure';
const DISCLOSURE_LEVELS = Object.freeze(['1', '2', 'inline']);

// A disclosure: a row that opens and closes what it holds — the browser's own <details>, so it
// works without script and screen readers announce it as expanded or collapsed. The science
// accordions (the app's and the CSE's: `level` 1, a science; 2, a group inside one) and a collapsed
// list inside a text (`inline`: Daily Reflection's references). Its heading: the chevron (`chevrons`
// { closed, open }, both drawn; the right one shows by itself), then an optional `icon`, its text
// (`text`, or `text-i18n` for words its page fills), and with `count` a place for a number
// ([data-disclosure-count], filled by its script). What it holds is `html` (or what its script
// adds). `open` starts it open; `head-class` places the heading (the app's rows reach the screen's
// edges); `class` places the whole. A heading holds no other control: a button inside a <summary>
// would also open and close it.
function disclosure(a = {}) {
  const { closed, open } = a.chevrons || {};
  if (!closed || !open) throw new Error('a disclosure needs its two chevrons (chevrons: { closed, open })');
  if (a.text === undefined && !a['text-i18n']) throw new Error('a disclosure needs its text (text or text-i18n)');
  const level = a.inline ? 'inline' : String(a.level ?? 1);
  if (!DISCLOSURE_LEVELS.includes(level)) throw new Error(`a disclosure's level is 1 or 2 (or inline), not "${a.level}"`);
  const head = `<summary class="${classes(`${DISCLOSURE}-head`, a['head-class'])}">`
    + `<span class="${DISCLOSURE}-chevron" aria-hidden="true">${closed}${open}</span>`
    + (a.icon ? `<span class="${DISCLOSURE}-icon" aria-hidden="true">${a.icon}</span>` : '')
    + `<span class="${DISCLOSURE}-text"${a['text-i18n'] ? ` data-i18n="${escapeAttr(a['text-i18n'])}"` : ''}>${escapeText(a.text ?? '')}</span>`
    + (a.count ? `<span class="${DISCLOSURE}-count" data-disclosure-count></span>` : '')
    + '</summary>';
  return `<details class="${classes(`${DISCLOSURE} ${DISCLOSURE}-${level}`, a.class)}"${attributes({ id: a.id })}${a.open ? ' open' : ''}${flags(a)}>${head}${a.html ?? ''}</details>`;
}

// A card's header (Daily Reflection): its icon on a tile in the card's colour, then its name.
// Each colour's classes are written out whole, so Tailwind (src/day.tailwind.js, which reads this
// file) builds them. `class` places it (a margin).
const CARD_TONES = Object.freeze({
  quran: { tile: 'bg-quran-bg text-quran', text: 'text-quran' },
  hadith: { tile: 'bg-hadith-bg text-hadith', text: 'text-hadith' },
  prayer: { tile: 'bg-prayer-bg text-prayer', text: 'text-prayer' },
  converter: { tile: 'bg-converter-bg text-converter', text: 'text-converter' },
  event: { tile: 'bg-event-bg text-event', text: 'text-event' },
});

function cardHeader(a = {}) {
  const tone = CARD_TONES[a.tone];
  if (!tone || !a.icon || a.text === undefined) throw new Error(`a card header needs a tone (${Object.keys(CARD_TONES).join(', ')}), icon and text`);
  const icon = a.icon.replace(/^<svg /, '<svg class="icon" ');
  const name = `<h2${a['data-i18n'] ? ` data-i18n="${escapeAttr(a['data-i18n'])}"` : ''} class="text-base font-bold uppercase tracking-widest ${tone.text}">${escapeText(a.text)}</h2>`;
  return `<div class="${classes('flex items-center gap-sm', a.class)}"><span class="${tone.tile} p-sm rounded-lg">${icon}</span>${name}</div>`;
}

// A status line: its words (loading, a summary, a failure) and a retry button, both shown and filled
// by setStatus() (page-chrome.js); a failure takes the notice's look. Hidden while empty, unless
// `keep` (it then holds its place: the CSE's, under its search box). `part` names it for its page
// script (Daily Reflection's three), or `id`; `class` places it.
function statusLine(a = {}) {
  if (!a.part && !a.id) throw new Error('a status line needs its part or id');
  return `<div class="${classes('i360-status', a.class)}"${attributes({ id: a.id, role: 'status', 'aria-live': 'polite', 'data-status': a.part, 'data-status-keep': a.keep })}${a.keep ? '' : ' hidden'}>`
    + `<span data-status-text></span>${button({ small: true, text: '', 'data-retry': true, hidden: true })}</div>`;
}

// A hidden announcer: words for screen readers only, set by its script (the quran page's «تفسير»
// failures; the app's search states, by its React twin). `id`: how its script finds it.
function announcer(a = {}) {
  return `<span class="${classes('sr-only', a.class)}"${attributes({ id: a.id, role: 'status', 'aria-live': 'polite' })}></span>`;
}

// A message where there is nothing to show (the Reader's "open a file", an empty list): its text, or
// what its script writes. `class` places it.
function emptyState(a = {}) {
  return `<div class="${classes('i360-empty', a.class)}"${attributes(a)}${flags(a)}>${escapeText(a.text ?? '')}</div>`;
}

// A card's footer (Daily Reflection): under one divider, in the card's colour, its rows 0.25 rem
// apart — what the card's contents are cited as, the work they come from, and their source. Each
// row is optional and filled by the page script through `<part>-<row>` targets; a row left empty
// is hidden, so a card that has only a source shows just that line.
//   citation: the reference line (سورة البقرة (2:186); a hadith's grade and attribution)
//   reference: "text" (the edition shown) or "details" (a collapsed list, `reference-i18n` its label:
//              an inline disclosure, `chevrons` its two chevrons)
//   source: "link" — «المصدر: <a>» with `source-text` and `source-href` — or "text"
// `class` places it (a margin).
function cardFooter(a = {}) {
  const tone = CARD_TONES[a.tone];
  if (!tone || !a.part) throw new Error(`a card footer needs a tone (${Object.keys(CARD_TONES).join(', ')}) and its part`);
  if (!a.citation && !a.reference && !a.source) throw new Error('a card footer needs at least one row');
  const t = (row) => escapeAttr(`${a.part}-${row}`);
  const rows = [];
  if (a.citation) rows.push(`<p data-target="${t('citation')}" class="text-base empty:hidden"></p>`);
  if (a.reference === 'text') rows.push(`<p data-target="${t('reference')}" class="text-sm empty:hidden"></p>`);
  else if (a.reference === 'details') {
    if (!a['reference-i18n']) throw new Error('a collapsed reference needs its label (reference-i18n)');
    rows.push(disclosure({ inline: true, chevrons: a.chevrons, 'text-i18n': a['reference-i18n'], class: 'text-sm has-[>p:empty]:hidden', 'head-class': 'text-base',
      html: `<p data-target="${t('reference')}" class="mt-sm whitespace-pre-line"></p>` }));
  } else if (a.reference) throw new Error('a card footer\'s reference is "text" or "details"');
  if (a.source === 'link') {
    if (!a['source-text'] || !a['source-href']) throw new Error('a source link needs source-text and source-href');
    rows.push(`<p class="text-sm"><span data-i18n="sourceLabel">Source</span>: <a data-target="${t('link')}" href="${escapeAttr(a['source-href'])}" target="_blank" rel="noopener noreferrer" class="underline">${escapeText(a['source-text'])}</a></p>`);
  } else if (a.source === 'text') rows.push(`<p data-target="${t('source')}" class="text-sm empty:hidden"></p>`);
  else if (a.source) throw new Error('a card footer\'s source is "link" or "text"');
  return `<div class="${classes(`border-t border-rule pt-md space-y-xs font-bold ${tone.text}`, a.class)}">${rows.join('')}</div>`;
}

// The component classes a script needs — to turn a component's look on and off (the CSE's status
// line becomes a banner on an error), to find components (a toolbar's buttons), or to give one to an
// element made in bulk (the Reader's page sheets, thousands in a big book, are cards) — never
// written out by hand.
const CLASS = Object.freeze({ banner: BOXES.banner.cls, card: BOXES.card.cls, chipLabel: CLASS_CHIP_LABEL, title: TITLE, ghostButton: GHOST_BUTTON,
  toolbarEnd: BOXES.toolbarEnd.cls, toolbarMenu: BOXES.toolbarMenu.cls });

// BOXES and CARD_TONES are exported for the components' inventory and catalogue
// (scripts/list-components.js, tools/catalogue/), which list every container and card colour.
export { ghostButton, settingsButtons, toolbarTitle, divider, chip, field, button, listItem, box, disclosure, resultRow, dataIcon,
  cardHeader, cardFooter, statusLine, announcer, emptyState, CLASS, BOXES, CARD_TONES };
