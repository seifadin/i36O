// The i360 CSE page's script (src/cse.src.html), bundled into the page by scripts/build.js
// with the shared files it imports.
import * as i360Theme from '../../theme/site/theme-loader.js';
import * as SearchCore from '../search-core.js';
import * as CseIndex from '../cse-index.js';
import * as CseView from '../cse-view.js';
import { fetchWithTimeout } from '../net.js';
import { LIB } from '../sites.js';
import { $, IN_APP, drawSettingsButtons, el, fromMarkup, setPressed, setupClose, wireSettingsButtons } from '../page-chrome.js';
import { CLASS, box as componentBox, button, listItem } from '../components.js';
import { CSE as LOCALES } from '../locales.js';
import { numericDate } from '../dates.js';

const DEFAULT_DATA = LIB;   // src/sites.js
const BRAND = '\u2066i360\u200Eإ\u2069';   // kept "i360إ" in Arabic text (left-to-right isolate)
const CONFIRM_BATCH = 8;   // candidate pages checked at once

const form = $('search-form'), input = $('q');
const btnExact = $('opt-exact'), btnWord = $('opt-word');
const btnNumerals = $('btn-numerals'), btnTheme = $('btn-theme');
const statusEl = $('status'), resultsEl = $('results'), aboutEl = $('about');
const barEl = $('bar-btns');

const T = LOCALES.ar;

const state = {
  theme: 'system',
  numerals: 'western',
  exact: false,
  word: false,
  dataBase: DEFAULT_DATA,
  catalog: null,
  counts: null,
  searcher: null,
  run: 0          // the current search; older ones stop when it changes
};

/* ---------------- Numerals ---------------- */
// The shared i360 choice: 'western' 0123 | 'arabic' ٠١٢٣ | 'persian' ۰۱۲۳ (display only).
const fmt = (s) => i360Theme.toNumerals(s, state.numerals);
const fmtNum = (n) => fmt(Number(n).toLocaleString('en-US'));

// Re-draws every number on the page in the chosen numerals.
function applyNumerals() {
  drawSettingsButtons(btnTheme, btnNumerals);
  // The page and the header's name; not what the visitor typed.
  for (const root of [document.querySelector(`.${CLASS.title}`), document.querySelector('main')]) {
    i360Theme.convertNumerals(root, { skip: 'form', numerals: state.numerals });
  }
}

/* ---------------- Theme ---------------- */
// Theme: the shared i360 choice, kept by the built-in theme loader
// (i360Theme), followed live when it changes in another app or tab.
function applyTheme() {   // the button shows the choice
  drawSettingsButtons(btnTheme, btnNumerals);
}
i360Theme.onChange(({ choice }) => {
  if (choice === state.theme) return;
  state.theme = choice;
  applyTheme();
});

// A small outlined button (retry, more).
function smallButton(cls, text, onClick) {
  const b = fromMarkup(button({ class: cls, text, small: true }));
  b.addEventListener('click', onClick);
  return b;
}

/* ---------------- Status line ---------------- */
function setStatus(text, { error = false, retry = null } = {}) {
  statusEl.textContent = '';
  statusEl.classList.toggle('error', error);
  statusEl.classList.toggle(CLASS.banner, error);
  if (text) statusEl.append(fmt(text));
  if (retry) {
    statusEl.append(smallButton('retry', T.retry, retry));
  }
}

/* ---------------- Data ---------------- */
class BuildGone extends Error {}

async function fetchData(path, kind) {
  // The limit covers waiting for the answer only (src/net.js), not reading a big part of the index.
  const res = await fetchWithTimeout(state.dataBase + path, path === 'latest.json' ? { cache: 'no-cache' } : {});
  if (res.status === 404 && path.startsWith('b/')) throw new BuildGone(path);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return kind === 'bin' ? res.arrayBuffer() : res.json();
}

// Reads latest.json and, if the build changed, its catalog.
// Returns true when a new catalog was loaded.
async function loadCatalog() {
  const { buildId } = await fetchData('latest.json');
  if (state.catalog && state.catalog.buildId === buildId) return false;
  const catalog = await fetchData(`b/${buildId}/catalog.json`);
  state.catalog = catalog;
  state.counts = CseView.itemFileCounts(catalog);
  aboutEl.textContent = fmt(T.about(fmtNum(catalog.sources.length), fmtNum(catalog.pageCount), buildDate(catalog.builtAt)));
  return true;
}

// The build's date as year-month-day (2026-10-16), on this device's calendar day (dates.js keeps
// its order in Arabic text, with any digits).
function buildDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return numericDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function newSearcher() {
  const base = `b/${state.catalog.buildId}/`;
  return CseIndex.createSearcher(state.catalog, (p) => fetchData(base + p, p.endsWith('.bin') ? 'bin' : 'json'));
}

/* ---------------- Address ---------------- */
function syncAddress(q, push) {
  const s = CseView.writeAddress({ q, exact: state.exact, word: state.word, data: state.dataBase === DEFAULT_DATA ? null : state.dataBase });
  const url = window.location.pathname + s;
  if (url === window.location.pathname + window.location.search) return;
  // Each entry carries how many searches deep it is in this page, so ✕ can step back
  // past all of them at once (stepsIn()).
  if (push) window.history.pushState({ i360cse: stepsIn() + 1 }, '', url); else window.history.replaceState(window.history.state, '', url);
}

function stepsIn() {
  const s = window.history.state;
  return s && typeof s.i360cse === 'number' && s.i360cse > 0 ? s.i360cse : 0;
}

// Result pages aren't for search engines; the home page is.
function setRobots(q) {
  let m = document.querySelector('meta[name="robots"]');
  if (q && !m) { m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.append(m); }
  if (!q && m) m.remove();
}

/* ---------------- Searching ---------------- */
async function search(raw, { push = false } = {}) {
  const run = ++state.run;
  const q = raw.trim();
  resultsEl.textContent = '';
  barEl.hidden = true;
  syncAddress(q, push);
  setRobots(q);
  document.title = q ? `${q} — البحث في ${BRAND}` : `البحث في ${BRAND}`;
  if (!q) { setStatus(''); aboutEl.hidden = false; return; }
  aboutEl.hidden = true;
  if (SearchCore.normalizeQuery(q, false).length < CseIndex.MIN_QUERY) { setStatus(T.tooShort(CseIndex.MIN_QUERY)); return; }

  try {
    if (!state.catalog) { setStatus(T.loadingIndex); await loadCatalog(); }
    if (run !== state.run) return;
    setStatus(T.searching);
    await runSearch(run, q);
  } catch (err) {
    if (run !== state.run) return;
    if (err instanceof BuildGone) {
      // A new build was published while searching: load it and search again, once.
      try {
        if (await loadCatalog()) { if (run === state.run) await runSearch(run, q); return; }
      } catch { /* reported below */ }
    }
    resultsEl.textContent = '';
    setStatus(state.catalog ? T.searchError : T.loadError, { error: true, retry: () => search(input.value) });
  }
}

async function runSearch(run, q) {
  const searcher = newSearcher();   // one per search, so memory doesn't grow
  const opts = { exact: state.exact, word: state.word, snippetChars: 60, maxSnippets: 1 };
  const gps = await searcher.candidates(q);
  if (run !== state.run) return;
  resultsEl.textContent = '';
  if (gps.length === 0) { setStatus(T.noResults); return; }

  const hits = new Map();   // gp → Promise<hit | null>, shared by groups that list the same source
  const ctx = { run, q, searcher, opts, hits, majors: [], groups: [] };
  for (const M of CseView.candidateGroups(searcher, gps)) {
    const m = makeMajor(ctx, M);
    ctx.majors.push(m);
    resultsEl.append(m.el);
  }
  barEl.hidden = false;
  updateSummary(ctx);
  applyNumerals();

  // Everything starts collapsed, so every science found shows at once (Seif 2026-10-26); a group is
  // checked only when opened, so its count stays approximate («≈») until then. A science that is
  // the only one opens by itself (and a lone sub-group inside it — see makeMajor).
  if (ctx.majors.length === 1) ctx.majors[0].el.open = true;
}

// A summary line: name, then its count.
function summaryLine(name) {
  const summary = el('summary');
  const count = el('span', 'count');
  summary.append(el('span', '', name), count);
  return { summary, count };
}

function makeMajor(ctx, M) {
  const box = fromMarkup(componentBox('card', { tag: 'details', class: 'major' }));
  const { summary, count } = summaryLine(M.major);
  const body = el('div', 'major-body');
  box.append(summary, body);
  const m = { el: box, count, groups: [] };
  for (const U of M.units) {
    const g = makeGroup(ctx, U, m);
    m.groups.push(g);
    ctx.groups.push(g);
    body.append(g.el);
  }
  updateMajor(m);
  // Rows without an intermediate show as soon as the major opens; a sub-group that is the
  // only one inside it opens with it.
  box.addEventListener('toggle', () => {
    if (!box.open) return;
    if (m.groups.length === 1 && m.groups[0].details) m.groups[0].el.open = true;
    for (const g of m.groups) if (!g.details && g.next === 0 && !g.loading) loadMore(ctx, g);
  });
  return m;
}

// One unit: an intermediate (its own box that opens and closes) or the
// rows without one (directly in the major).
function makeGroup(ctx, U, m) {
  const list = el('div');
  const foot = el('div', 'group-foot');
  const details = U.name != null;
  let box, count = null;
  if (details) {
    box = fromMarkup(componentBox('inset', { tag: 'details', class: 'inter' }));
    const line = summaryLine(U.name);
    count = line.count;
    const body = el('div', 'inter-body');
    body.append(list, foot);
    box.append(line.summary, body);
  } else {
    box = el('div', 'direct');
    box.append(list, foot);
  }
  const g = { el: box, details, count, list, foot, gps: U.gps, next: 0, shown: 0, done: false, loading: null, sources: new Map(), major: m };
  setCount(g);
  if (details) box.addEventListener('toggle', () => { if (box.open && g.next === 0 && !g.loading) loadMore(ctx, g); });
  return g;
}

function setCount(g) {
  if (g.count) {
    const n = g.done ? g.shown : g.gps.length;
    g.count.textContent = fmt(g.done ? fmtNum(n) : `≈ ${fmtNum(n)}`);
    g.count.title = g.done ? T.exactTitle : T.approxTitle;
  }
  // A group with no real match stays where it was opened and says so (drawFoot).
}

function updateMajor(m) {
  const exact = m.groups.every((g) => g.done);
  const n = m.groups.reduce((a, g) => a + (g.done ? g.shown : g.gps.length), 0);
  m.count.textContent = fmt(exact ? fmtNum(n) : `≈ ${fmtNum(n)}`);
  m.count.title = exact ? T.exactTitle : T.approxTitle;
}

// Pages in several groups are counted once.
function updateSummary(ctx) {
  const pages = new Set();
  let exact = true;
  for (const g of ctx.groups) {
    if (!g.done) exact = false;
    for (const gp of g.gps) pages.add(gp);
  }
  if (exact) {
    let n = 0;
    for (const gp of pages) if (ctx.confirmed && ctx.confirmed.has(gp)) n++;
    setStatus(n ? T.summary(fmtNum(n), fmtNum(ctx.groups.filter((g) => g.shown).length), true) : T.noResults);
    if (!n) barEl.hidden = true;
  } else {
    setStatus(T.summary(fmtNum(pages.size), fmtNum(ctx.groups.length), false));
  }
}

function confirmPage(ctx, gp) {
  if (!ctx.hits.has(gp)) {
    ctx.hits.set(gp, ctx.searcher.confirm([gp], ctx.q, ctx.opts).then((r) => {
      const hit = r[0] || null;
      if (hit) (ctx.confirmed || (ctx.confirmed = new Set())).add(gp);
      return hit;
    }));
  }
  return ctx.hits.get(gp);
}

// Shows the group's next step of results (about RESULTS_PER_STEP pages).
function loadMore(ctx, g) {
  if (g.loading || g.done) return g.loading;
  g.loading = (async () => {
    g.foot.textContent = T.checking;
    let added = 0;
    try {
      while (added < CseView.RESULTS_PER_STEP && g.next < g.gps.length) {
        const batch = g.gps.slice(g.next, g.next + CONFIRM_BATCH);
        const got = await Promise.all(batch.map((gp) => confirmPage(ctx, gp)));
        if (ctx.run !== state.run) return;
        // Stop at exactly one step; pages checked beyond it are kept for «المزيد».
        for (const hit of got) {
          if (added >= CseView.RESULTS_PER_STEP) break;
          g.next++;
          if (hit) { addHit(ctx, g, hit); added++; }
        }
      }
      g.done = g.next >= g.gps.length;
    } catch (err) {
      if (ctx.run !== state.run) return;
      if (err instanceof BuildGone) { search(input.value); return; }
      showGroupError(ctx, g);
      return;
    } finally {
      g.loading = null;
    }
    setCount(g);
    updateMajor(g.major);
    updateSummary(ctx);
    drawFoot(ctx, g);
    applyNumerals();
  })();
  return g.loading;
}

function drawFoot(ctx, g) {
  g.foot.textContent = '';
  if (g.done && g.shown === 0) { g.foot.textContent = T.noMatches; return; }
  if (g.done) return;
  g.foot.append(smallButton('', T.more, () => loadMore(ctx, g)));
}

function showGroupError(ctx, g) {
  g.foot.textContent = '';
  g.foot.append(T.searchError);
  g.foot.append(smallButton('', T.retry, () => loadMore(ctx, g)));
}

function sourceBlock(ctx, g, source) {
  if (g.sources.has(source.key)) return g.sources.get(source.key);
  const block = el('div', 'source');
  const head = el('div', 'source-name');
  const nm = CseView.sourceName(source, state.counts);
  head.append(el('span', '', `«${nm.title}»`));
  if (nm.file) head.append(el('span', 'sep', '\\'), el('span', 'file', `«${nm.file}»`));
  block.append(head);
  g.list.append(block);
  g.sources.set(source.key, block);
  return block;
}

// The phone's browser overlay (Custom Tabs / Safari sheet) through the app's Browser plugin,
// called over Capacitor's bridge (this page doesn't bundle the plugin's JavaScript). If
// that fails, an ordinary navigation: Capacitor hands an outside address to the phone's
// browser app.
function openOutside(e) {
  e.preventDefault();
  const url = e.currentTarget.href;
  Promise.resolve()
    .then(() => window.Capacitor.nativePromise('Browser', 'open', { url }))
    .catch(() => { window.location.href = url; });
}

function addHit(ctx, g, hit) {
  g.shown++;
  const block = sourceBlock(ctx, g, hit.source);
  const sn = hit.snippets[0];
  const link = CseView.resultLink(hit, ctx.q, sn ? sn.hit : '');
  const toReader = link.startsWith(CseView.READER);
  const a = fromMarkup(listItem({ href: link, class: 'hit' }));
  if (IN_APP) {
    // Inside the app: the Reader in this same view (its ✕ and the back button return
    // here); anything else in the phone's browser overlay, like every resource in the app.
    if (!toReader) a.addEventListener('click', openOutside);
  } else {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  a.title = toReader ? T.openReader : T.openTitle;
  const label = CseView.pageLabel(hit);
  if (label || hit.count > 1) {
    const meta = el('div', 'hit-meta');
    if (label) meta.append(el('span', '', label));
    if (hit.count > 1) meta.append(el('span', 'more-spots', T.spots(hit.count)));
    a.append(meta);
  }
  if (sn) {
    const t = el('div', 'hit-text');
    t.append(sn.before, el('mark', '', sn.hit), sn.after);
    a.append(t);
  }
  block.append(a);
}

/* ---------------- Events ---------------- */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  input.blur();
  search(input.value, { push: true });
});
btnExact.addEventListener('click', () => {
  state.exact = !state.exact; setPressed(btnExact, state.exact);
  if (input.value.trim()) search(input.value);
});
btnWord.addEventListener('click', () => {
  state.word = !state.word; setPressed(btnWord, state.word);
  if (input.value.trim()) search(input.value);
});
// Theme and numerals: the shared i360 choices, also followed when another app or tab changes them.
wireSettingsButtons(btnTheme, btnNumerals);
i360Theme.onNumeralsChange(({ numerals }) => {
  if (numerals === state.numerals) return;
  state.numerals = numerals;
  applyNumerals();
});
// Opening a group loads its first step of results, as a tap does.
$('btn-expand').addEventListener('click', () => {
  for (const d of resultsEl.querySelectorAll('details')) d.open = true;
});
$('btn-collapse').addEventListener('click', () => {
  for (const d of resultsEl.querySelectorAll('details')) d.open = false;
});
window.addEventListener('popstate', () => fromAddress());

function fromAddress() {
  const a = CseView.readAddress(window.location.search, window.location.hostname, window.location.protocol);
  state.exact = a.exact; state.word = a.word;
  setPressed(btnExact, a.exact); setPressed(btnWord, a.word);
  input.value = a.q;
  search(a.q);
}

/* ---------------- Start ---------------- */
// Keys scroll the results, as they would scroll a normal page.
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (t === document.body && ['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) $('scroller').focus({ preventScroll: true });
});

function init() {
  // In the app, ✕ returns to its home (src/page-chrome.js): back past this page's own
  // searches, to the page it was opened from.
  setupClose($('btn-close'), () => stepsIn() + 1);
  state.theme = i360Theme.getChoice();
  i360Theme.init();   // fresh theme.css in the background; the saved copy is already shown
  state.numerals = i360Theme.getNumerals();
  applyTheme();
  applyNumerals();
  const a = CseView.readAddress(window.location.search, window.location.hostname, window.location.protocol);
  if (a.data) state.dataBase = a.data;
  fromAddress();
  if (!a.q) {
    input.focus();
    // The index details under the search box.
    loadCatalog().then(applyNumerals).catch(() => { /* shown when a search is made */ });
  }
}
init();
