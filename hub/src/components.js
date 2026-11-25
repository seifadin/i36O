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

// The attributes a component may take, always written in this order. `label` names a control
// (title and aria-label); `class` adds a page's own class beside the component's (placement only).
const ATTRIBUTE_ORDER = ['id', 'label', 'dir', 'aria-controls', 'aria-haspopup', 'aria-expanded', 'aria-pressed', 'data-i18n'];

function attributes(a) {
  let out = '';
  for (const name of ATTRIBUTE_ORDER) {
    const value = a[name];
    if (value === undefined || value === null || value === false) continue;
    if (name === 'label') out += ` title="${escapeAttr(value)}" aria-label="${escapeAttr(value)}"`;
    else out += ` ${name}="${escapeAttr(value)}"`;
  }
  return out;
}
const flags = (a) => `${a.disabled ? ' disabled' : ''}${a.hidden ? ' hidden' : ''}`;
const classes = (own, extra) => (extra ? `${own} ${extra}` : own);

// A toolbar button: its icon, or empty when its script draws it (the text-size and book-direction
// buttons).
function toolbarButton(a = {}) {
  return `<button class="${classes('toolbar-btn', a.class)}" type="button"${attributes(a)}${flags(a)}>${a.icon || ''}</button>`;
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
  return `<h1 class="tb-title"${attributes(a)}>${a.html}</h1>`;
}

// A thin line between groups of toolbar buttons.
function divider(a = {}) {
  return `<span class="${classes('divider', a.class)}" aria-hidden="true"></span>`;
}

export { toolbarButton, labelButton, menuButton, settingsButtons, toolbarTitle, divider, ATTRIBUTE_ORDER };
