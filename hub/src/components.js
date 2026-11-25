// The shared components' markup, written once (their style: src/page-chrome.css). Every page gets
// exactly this structure and differs only in its own id, words and icon:
// - in a page's HTML, a placeholder the build writes out (scripts/components.js):
//     <!--@@TOOLBAR_BUTTON id="btn-zoom-in" icon="zoomIn"@@-->
// - in a page's script, the same function, its markup made an element (fromMarkup in page-chrome.js):
//     fromMarkup(toolbarButton({ icon: ICON.delete }))
// Pure functions of their inputs (no browser needed), so the build and the pages share them. An icon
// is passed drawn (an <svg> string: the build draws it from its meaning, a page takes it from its
// icon set, both checked by scripts/icons.js); every icon is hidden from screen readers, as each
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
// script adds). A card or inset may be a <details> (the CSE's groups), a card a <section>.
const BOXES = Object.freeze({
  card: { cls: 'i360-card', tags: ['section', 'details', 'div'] },
  inset: { cls: 'i360-inset', tags: ['div', 'details'] },
  popup: { cls: 'i360-popup', tags: ['div'] },
  banner: { cls: 'i360-banner', tags: ['div'], role: 'status' },
  toast: { cls: 'i360-toast', tags: ['div'], role: 'status', live: 'polite' },
});

function box(kind, a = {}) {
  const k = BOXES[kind];
  if (!k) throw new Error(`no container "${kind}"`);
  const tag = a.tag || k.tags[0];
  if (!k.tags.includes(tag)) throw new Error(`a ${kind} is a ${k.tags.join(' or ')}, not a ${tag}`);
  const all = { ...a, role: a.role ?? k.role, 'aria-live': a['aria-live'] ?? k.live };
  return `<${tag} class="${classes(k.cls, a.class)}"${attributes(all)}${flags(a)}>${a.html ?? ''}</${tag}>`;
}

// The component classes a script needs — to turn a component's look on and off (the CSE's status
// line becomes a banner on an error) or to find components (a toolbar's buttons) — never written
// out by hand.
const CLASS = Object.freeze({ banner: BOXES.banner.cls, chipLabel: CLASS_CHIP_LABEL, title: TITLE, toolbarButton: TOOLBAR_BUTTON });

export { toolbarButton, labelButton, menuButton, settingsButtons, toolbarTitle, divider, chip, field, button, listItem, box,
  BOXES, FIELD_KINDS, CLASS, ATTRIBUTE_ORDER };
