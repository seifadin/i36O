// The shared components' markup, written once (their style: src/page-chrome.css). Every page gets
// exactly this structure and differs only in its own id, words and icon:
// - in a page's HTML, a placeholder the build writes out (scripts/placeholders.js):
//     <!--@@TOOLBAR_BUTTON id="btn-zoom-in" icon="zoomIn"@@-->
// - in a page's script, the same function, its markup made an element (fromMarkup in page-chrome.js):
//     fromMarkup(toolbarButton({ icon: ICON.delete }))
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
const TOOLBAR_BUTTON = 'toolbar-btn';
const TITLE = 'tb-title';
const flags = (a) => `${a.disabled ? ' disabled' : ''}${a.hidden ? ' hidden' : ''}`;
const classes = (own, extra) => (extra ? `${own} ${extra}` : own);

// A toolbar button: its icon, or empty when its script draws it (the text-size and book-direction
// buttons).
function toolbarButton(a = {}) {
  return `<button class="${classes(TOOLBAR_BUTTON, a.class)}" type="button"${attributes(a)}${flags(a)}>${a.icon || ''}</button>`;
}

// A toolbar button with a word beside its icon (the Reader's «فتح ملف», the quran page's «تفسير»):
// the icon, then the label (labelId names it, for a script that changes its text).
function labelButton(a = {}) {
  if (!a.icon || !a.text) throw new Error('a label button needs icon and text');
  const span = `<span${a.labelId ? ` id="${escapeAttr(a.labelId)}"` : ''}>${escapeText(a.text)}</span>`;
  return `<button class="${classes('toolbar-btn toolbar-btn-label', a.class)}" type="button"${attributes(a)}${flags(a)}>${a.icon}${span}</button>`;
}

// A toolbar button that opens a list (Daily Reflection's languages): its short text, then the
// dropdown icon (its look: .toolbar-btn-menu).
function menuButton(a = {}) {
  if (!a.icon || !a.textId || !a['aria-controls']) throw new Error('a menu button needs icon, textId and aria-controls');
  return `<button class="${classes('toolbar-btn toolbar-btn-menu', a.class)}" type="button"${attributes({ ...a, 'aria-haspopup': 'true', 'aria-expanded': 'false' })}${flags(a)}>`
    + `<span id="${escapeAttr(a.textId)}"></span>${a.icon}</button>`;
}

// The theme and numerals buttons, in the order of every i360 page (drawn by drawSettingsButtons).
function settingsButtons() {
  return toolbarButton({ id: 'btn-theme' }) + toolbarButton({ id: 'btn-numerals', class: 'numerals-btn' });
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

// A field: a search box, a number box or a list (its kind, above).
function field(a = {}) {
  if (a.kind === 'select') return `<select class="${classes('i360-field', a.class)}"${attributes(a)}${flags(a)}></select>`;
  const kind = FIELD_KINDS[a.kind];
  if (!kind) throw new Error(`a field's kind is search, number or select, not "${a.kind}"`);
  const own = a.kind === 'search' ? 'i360-field i360-field-search' : 'i360-field';
  return `<input class="${classes(own, a.class)}"${kind}${attributes(a)}${flags(a)}>`;
}

// A button: its text (`text`, or empty for a script to fill), its icon alone (an icon-only
// button, its look .i360-btn-icon), or its icon then a text its script fills (`text-target`
// names it, data-target). `primary` fills it, `small` makes it smaller; type submit in a form.
function button(a = {}) {
  const iconOnly = a.icon && !a['text-target'];
  const own = ['i360-btn', a.primary && 'i360-btn-primary', a.small && 'i360-btn-sm', iconOnly && 'i360-btn-icon'].filter(Boolean).join(' ');
  const inner = a.icon
    ? a.icon + (a['text-target'] ? `<span data-target="${escapeAttr(a['text-target'])}"></span>` : '')
    : escapeText(a.text ?? '');
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

// The containers: their element and class; what is inside is the page's own (`html`, or what its
// script adds). A card or inset may be a <details> (the CSE's groups), a card a <section>; a popup
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
const BOXES = Object.freeze({
  card: { cls: 'i360-card', tags: ['section', 'details', 'div'] },
  inset: { cls: 'i360-inset', tags: ['div', 'details'] },
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

// A card's header (Daily Reflection): its icon on a tile in the card's colour, then its name.
// Each colour's classes are written out whole, so Tailwind (src/day.tailwind.js, which reads this
// file) builds them. `class` places it (a margin).
const CARD_TONES = Object.freeze({
  quran: { tile: 'bg-quran-soft text-quran', text: 'text-quran' },
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

// A part's status (Daily Reflection): its words while loading or after a failure, and a retry
// button; hidden until its script shows it. `part` names it; `class` places it.
function statusLine(a = {}) {
  if (!a.part) throw new Error('a status line needs its part');
  return `<div data-status="${escapeAttr(a.part)}" class="${classes('hidden items-center gap-sm text-sm text-custom-secondary', a.class)}">`
    + `<span data-status-text></span>${button({ small: true, 'data-retry': true })}</div>`;
}

// A card's footer (Daily Reflection): under one divider, in the card's colour, its rows 0.25 rem
// apart — what the card's contents are cited as, the work they come from, and their source. Each
// row is optional and filled by the page script through `<part>-<row>` targets; a row left empty
// is hidden, so a card that has only a source shows just that line.
//   citation: the reference line (سورة البقرة (2:186); a hadith's grade and attribution)
//   reference: "text" (the edition shown) or "details" (a collapsed list, `reference-i18n` its label)
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
    rows.push(`<details class="text-sm has-[>p:empty]:hidden"><summary data-i18n="${escapeAttr(a['reference-i18n'])}" class="cursor-pointer text-base"></summary>`
      + `<p data-target="${t('reference')}" class="mt-sm whitespace-pre-line"></p></details>`);
  } else if (a.reference) throw new Error('a card footer\'s reference is "text" or "details"');
  if (a.source === 'link') {
    if (!a['source-text'] || !a['source-href']) throw new Error('a source link needs source-text and source-href');
    rows.push(`<p class="text-sm"><span data-i18n="sourceLabel">Source</span>: <a data-target="${t('link')}" href="${escapeAttr(a['source-href'])}" target="_blank" rel="noopener noreferrer" class="underline">${escapeText(a['source-text'])}</a></p>`);
  } else if (a.source === 'text') rows.push(`<p data-target="${t('source')}" class="text-sm empty:hidden"></p>`);
  else if (a.source) throw new Error('a card footer\'s source is "link" or "text"');
  return `<div class="${classes(`border-t border-rule pt-md space-y-xs font-bold ${tone.text}`, a.class)}">${rows.join('')}</div>`;
}

// The component classes a script needs — to turn a component's look on and off (the CSE's status
// line becomes a banner on an error) or to find components (a toolbar's buttons) — never written
// out by hand.
const CLASS = Object.freeze({ banner: BOXES.banner.cls, chipLabel: CLASS_CHIP_LABEL, title: TITLE, toolbarButton: TOOLBAR_BUTTON,
  toolbarEnd: BOXES.toolbarEnd.cls, toolbarMenu: BOXES.toolbarMenu.cls });

// BOXES and CARD_TONES are exported for the components' inventory and catalogue
// (scripts/list-components.js, tools/catalogue/), which list every container and card colour.
export { toolbarButton, labelButton, menuButton, settingsButtons, toolbarTitle, divider, chip, field, button, listItem, box,
  cardHeader, cardFooter, statusLine, CLASS, BOXES, CARD_TONES };
