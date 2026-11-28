// What the frame of every hub page shares (Daily Reflection, the Reader, the CSE;
// claude/i360-hub.md §10 "Toolbars"): `$` and `el`, whether it runs inside the installed i360إ
// app, the ✕ that returns to the app's home, the theme and numerals buttons, and the toolbar
// that fits by measurement (fittingToolbar, below; its style: src/page-chrome.css). Bundled into
// each page by scripts/build.js.
import * as i360Theme from '../theme/site/theme-loader.js';
import { CLASS } from './components.js';
import * as ICON from 'i360:icons';

// A page element by its id.
export const $ = (id) => document.getElementById(id);

// A new element with an optional class and text.
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// An element from a shared component's markup (src/components.js), for a page's script.
export function fromMarkup(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup;
  return t.content.firstElementChild;
}

// Inside the installed i360إ app: Capacitor's bridge is in every page it serves.
export const IN_APP = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());

// In the app, ✕ returns to its home: back to it when the page was opened from it (the
// history stays home → this page, which the back button and the iOS edge swipe follow),
// else home in place of this page. stepsBack: how many history entries lead back to home
// (the CSE adds one per search it made). Outside the app, the ✕ stays hidden.
export function setupClose(button, stepsBack = () => 1) {
  if (!IN_APP) return;
  button.hidden = false;
  button.addEventListener('click', () => {
    let fromApp = false;
    try { fromApp = window.history.length > 1 && !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch { /* no referrer */ }
    if (fromApp) window.history.go(-stepsBack()); else window.location.replace('/index.html');
  });
}

/* ---------- A toolbar that fits by measurement (claude/i360-hub.md §10 "Toolbars") ----------
   A bar lists what it folds away when room runs out, in order: `fold`, one entry per level. Level n
   = the first n entries folded. fit() tries level 0, 1, 2… with every button at its narrowest
   (--toolbar-btn-min, src/page-chrome.css) and keeps the first level whose row fits; then every
   button narrower than the bar is high widens, evenly, into the room left. Measured, never tied to
   screen widths, so it follows the language, labels, numerals and text size. An entry may:
     items: ['id', …]  move these (a group, a button…) to the slot `to` while folded, in this order,
                       and back to where the page has them while not
     to: 'name'        that slot: <template data-slot="name"> inside the bar (or its ⋮ menu)
     flag: 'name'      set this class on the bar while folded (for the page's own CSS: hide a title…)
     dense: 1 | 2      the bar's last levels: toolbar-dense, then toolbar-densest (src/page-chrome.css)
   A bar without `fold` only widens its buttons. */

// An element that takes part in the row: shown, and not floating over it (a menu, a popup).
function inRow(node) {
  if (node.hidden) return false;
  const cs = getComputedStyle(node);
  return cs.display !== 'none' && cs.position !== 'absolute' && cs.position !== 'fixed';
}

// Returns fit(); call it whenever the bar's width or contents change (at most once a frame).
// The theme and numerals buttons of every page (the app's are in its OSRow.tsx): drawn with the
// shared choices' icon or sample, tooltip and aria-label in the page's language (`lang`; Arabic
// when left out); a tap cycles the shared choice. Each page redraws them on the loader's change
// events, beside its own work for that change.
export function drawSettingsButtons(themeBtn, numeralsBtn, lang) {
  const theme = i360Theme.getChoice(), numerals = i360Theme.getNumerals();
  themeBtn.innerHTML = ICON.theme[theme];
  setLabel(themeBtn, i360Theme.themeLabel(theme, lang));
  numeralsBtn.textContent = i360Theme.NUMERALS_SAMPLE[numerals];
  setLabel(numeralsBtn, i360Theme.numeralsLabel(numerals, lang));
}

export function wireSettingsButtons(themeBtn, numeralsBtn) {
  themeBtn.addEventListener('click', () => { i360Theme.cycle(); });
  numeralsBtn.addEventListener('click', () => { i360Theme.cycleNumerals(); });
}

// A control's tooltip and its name for screen readers, the same text.
export function setLabel(control, text) {
  control.title = text;
  control.setAttribute('aria-label', text);
}

// An on/off control's state (an option chip, a toggle button, the chosen row of a list).
export function setPressed(control, on) {
  control.setAttribute('aria-pressed', on ? 'true' : 'false');
}

// A status line (statusLine() in components.js): its words — text or nodes; none hides the line
// unless it keeps its place — a retry button when `retry` gives its label and what a tap does, and
// the notice's look on a failure (`error`). Every page's status goes through here.
export function setStatus(line, { text = '', retry = null, error = false } = {}) {
  const words = line.querySelector('[data-status-text]'), button = line.querySelector('[data-retry]');
  words.replaceChildren(text);
  line.classList.toggle(CLASS.banner, error);
  button.hidden = !retry;
  button.textContent = retry ? retry.label : '';
  button.onclick = retry ? retry.onClick : null;
  if (!line.hasAttribute('data-status-keep')) line.hidden = !text && !retry;
}

export function fittingToolbar({ bar, fold = [] }) {
  const DENSE = ['toolbar-dense', 'toolbar-densest'];
  // Each entry's changes, made once here: (folded) => void.
  const levels = fold.map(({ items = [], to, flag, dense }) => {
    const changes = [];
    if (items.length) {
      const slot = bar.querySelector(`template[data-slot="${to}"]`);
      if (!slot) throw new Error(`toolbar: no slot "${to}"`);
      for (const id of items) {
        const item = document.getElementById(id);
        const home = document.createComment(id);   // where the page has it
        item.parentNode.insertBefore(home, item);
        changes.push((folded) => {
          if (folded) { if (item.nextSibling !== slot) slot.parentNode.insertBefore(item, slot); }
          else if (home.nextSibling !== item) home.parentNode.insertBefore(item, home.nextSibling);
        });
      }
    }
    if (flag) changes.push((folded) => bar.classList.toggle(flag, folded));
    if (dense) changes.push((folded) => bar.classList.toggle(DENSE[dense - 1], folded));
    return changes;
  });
  const done = levels.map(() => null);
  const setLevel = (level) => levels.forEach((changes, i) => {
    const folded = i < level;
    if (done[i] === folded) return;
    done[i] = folded;
    for (const change of changes) change(folded);
  });

  // The room left in the row (negative: it doesn't fit). A part that grows to fill the bar
  // counts its content (with its padding), not the room it was given.
  const roomLeft = () => {
    const cs = getComputedStyle(bar);
    const parts = [...bar.children].filter(inRow);
    let need = (parseFloat(cs.columnGap) || 0) * Math.max(0, parts.length - 1);
    for (const part of parts) {
      const ps = getComputedStyle(part);
      if (parseFloat(ps.flexGrow) > 0) {
        const range = document.createRange();
        range.selectNodeContents(part);
        need += range.getBoundingClientRect().width + parseFloat(ps.paddingLeft) + parseFloat(ps.paddingRight);
      } else need += part.getBoundingClientRect().width;
    }
    return bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - need;
  };

  const setWidth = (value) => bar.style.setProperty('--toolbar-btn-w', value);

  // Every button narrower than the bar is high widens to one width, as far as the room allows:
  // the buttons' widths at their narrowest, filled up evenly from the narrowest one.
  const widen = (room) => {
    const buttons = [...bar.querySelectorAll(`.${CLASS.toolbarButton}`)].filter((b) => b.offsetParent && !b.closest(`.${CLASS.toolbarMenu}`));
    if (!buttons.length || room <= 0) return;
    const narrow = buttons.map((b) => b.getBoundingClientRect().width).sort((a, b) => a - b);
    setWidth('var(--toolbar-h)');
    const widest = Math.min(...buttons.map((b) => b.getBoundingClientRect().width));
    let width = widest, sum = 0;
    for (let k = 0; k < narrow.length; k++) {
      sum += narrow[k];
      const even = (room + sum) / (k + 1);   // the first k + 1 buttons at one width
      if (k + 1 === narrow.length || even <= narrow[k + 1]) { width = Math.min(widest, even); break; }
    }
    // A tenth of a pixel less, so the widened row never overflows by a fraction.
    setWidth(`${Math.floor(width * 10) / 10}px`);
  };

  return function fit() {
    setWidth('var(--toolbar-btn-min)');
    let room = 0;
    for (let level = 0; level <= levels.length; level++) {
      setLevel(level);
      room = roomLeft();
      if (room >= 0) break;
    }
    widen(room);
  };
}
