// The quran page (quran.i36o.workers.dev/i360/, built by scripts/build.js into the quran
// Worker's files): tanzil's Quran Navigator under the shared toolbar, with «تفسير» opening the
// exegesis of the verse being shown, from the app's exegesis index (src/exegesis.js).
//
// Tanzil is served from this same address by the quran Worker, so this page can read which
// verse it shows: tanzil's own `curr` (the verse last tapped, or the first of the page turned
// to), else the [sura:aya] in its title. When the Worker can't serve tanzil's data
// (/i360/health), tanzil's official embed from tanzil.net is shown instead — a different site,
// which a page can't read — and «تفسير» is off, with the data-unavailable icon.
import * as i360Theme from '../../theme/site/theme-loader.js';
import { $, drawSettingsButtons, setLabel, wireSettingsButtons } from '../page-chrome.js';
import { fetchJson } from '../net.js';
import { findExegesisUrl } from '../exegesis.js';
import { isDesktop } from '../platform.js';
import { TANZIL_ORIGIN } from '../sites.js';
import { QURAN } from '../locales.js';
import { readVerse } from './verse.js';
import * as ICON from 'i360:icons';

const T = QURAN.ar;
// Tanzil's embed, Jalalayn as its translation (its one documented option).
const EMBED = '/?embed=true&defTrans=ar.jalalayn';
const FLASH_MS = 1500;

const btnTheme = $('btn-theme'), btnNumerals = $('btn-numerals');
const btnExegesis = $('btn-exegesis');
const frame = $('tanzil'), announce = $('announce');

let rows = null;          // the exegesis index, once loaded
let flashTimer = 0;

// The icon is the button's first child (every label button's shape, page-chrome.css): swapped whole.
// The exegesis button's states, named (a lookup by name would bring in every icon).
const BUTTON_ICONS = { exegesis: ICON.exegesis, invalid: ICON.invalid, notFound: ICON.notFound, openFailed: ICON.openFailed, unavailable: ICON.unavailable };
function showIcon(name) { btnExegesis.querySelector('svg').outerHTML = BUTTON_ICONS[name]; }

// «تفسير» at rest: its usual icon, on when the index is loaded.
function rest() {
  showIcon('exegesis');
  setLabel(btnExegesis, T.exegesisTitle);
  btnExegesis.disabled = !rows;
}

// A short sign on the button (the app's search bar does the same): which icon, and words for the
// tooltip and for screen readers; back to rest after a moment.
function flash(name, words) {
  clearTimeout(flashTimer);
  showIcon(name);
  setLabel(btnExegesis, words);
  announce.textContent = words;
  flashTimer = setTimeout(rest, FLASH_MS);
}

// The data can't be served: tanzil from tanzil.net, «تفسير» off with the data-unavailable icon.
function unavailable() {
  rows = null;
  clearTimeout(flashTimer);
  showIcon('unavailable');
  setLabel(btnExegesis, T.unavailable);
  btnExegesis.disabled = true;
}

function openExegesis(url) {
  // A desktop opens it in a new tab (the app's rule everywhere); on a phone the app shows this
  // page in the browser overlay, which has no tabs: the exegesis opens in its place (back returns).
  if (isDesktop()) {
    const w = window.open(url, '_blank');
    if (!w) { flash('openFailed', T.openFailed); return; }
    w.opener = null;
  } else {
    window.location.assign(url);
  }
}

btnExegesis.addEventListener('click', () => {
  if (!rows) return;
  const verse = readVerse(frame);
  if (!verse) { flash('invalid', T.noVerse); return; }
  const url = findExegesisUrl(rows, verse.sura, verse.aya);
  if (!url) { flash('notFound', T.notFound); return; }
  openExegesis(url);
});

/* ---------------- Tanzil centred under its banner ---------------- */
// Tanzil's page scrolls inside the frame, and its scrollbar takes room on one side, so tanzil
// centres itself a little off the banner above. An equal gap on both sides centres it on the
// frame's full width, like the banner. Set on every load (tanzil may navigate inside the frame),
// on whichever of html and body scrolls (a gutter only acts on a scroller), as properties rather
// than a <style> element, which a policy on tanzil's page could refuse. Tanzil.net's embed (when
// the Worker can't serve tanzil) is another site: it can't be reached, and stays as it is.
function centreTanzil() {
  try {
    const doc = frame.contentDocument;
    for (const el of [doc?.documentElement, doc?.body]) el?.style.setProperty('scrollbar-gutter', 'stable both-edges');
  } catch { /* another site's page */ }
}
frame.addEventListener('load', centreTanzil);

/* ---------------- Theme and numerals ---------------- */
const redraw = () => drawSettingsButtons(btnTheme, btnNumerals);
wireSettingsButtons(btnTheme, btnNumerals);
i360Theme.onChange(redraw);
i360Theme.onNumeralsChange(redraw);

/* ---------------- Start ---------------- */
async function start() {
  redraw();
  i360Theme.init();   // fresh theme.css in the background; the saved copy is already shown
  showIcon('exegesis');
  setLabel(btnExegesis, T.exegesisTitle);
  try {
    const health = await fetchJson('/i360/health', { retries: 1 });
    if (!health || !health.ok) throw new Error('not ok');
    frame.src = EMBED;
  } catch {
    frame.src = TANZIL_ORIGIN + EMBED;
    unavailable();
    return;
  }
  try {
    rows = await fetchJson('/i360/exegesis', { retries: 1 });
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('empty');
    rest();
  } catch {
    unavailable();
  }
}

void start();
