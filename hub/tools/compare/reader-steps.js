// The Reader, old vs new: the same steps on both, recording what a reader would see change
// (the page shown, the page counter, the panel, search results, bookmarks, the address).
// An Arabic and an English book opened from the device, on a phone (390 px) and a desktop (1280 px):
// 4 cases × 17 steps; and books opened by link (?file=…, from a local lib site), where page links
// work: #p= in either numerals and with «ص», #n=, a missing page, a label that isn't a page (the
// address then names the page shown), volumes, lettered pages, the address following the reading,
// a reload, a link beating the saved position — 2 cases × 25 steps (+ page errors).
// (For a book opened from the device, #p= is ignored on purpose: such a book can't be linked to.)
//   node reader-steps.js [--old <ref>] [--new <ref>] [--out <folder>]
import { pages, options } from './lib/versions.js';
import { network, hubHosts, errorsOf, serveFile } from './lib/browser.js';
import { books, linked } from './lib/fixtures.js';
import { join } from 'node:path';
import { oldVsNew } from './lib/report.js';

const opts = options();
const BOOKS = books(), LINKED = linked();
const WIDTHS = [390, 1280];

const state = () => {
  const $ = (id) => document.getElementById(id);
  const vis = [...document.querySelectorAll('.page-sheet')].findIndex((s) => { const r = s.getBoundingClientRect(); return r.bottom > 80 && r.top < window.innerHeight / 2; });
  return {
    page: $('page-num-input').value, of: $('total-pages').textContent, vis,
    panel: $('side-panel').classList.contains('open') || !$('side-panel').hidden,
    items: document.querySelectorAll('#panel-body .panel-item').length, count: $('search-count').textContent,
    hash: window.location.hash, sheets: document.querySelectorAll('.page-sheet').length,
    drawn: ['.quran', '.fn-ref', '.fn-note', '.fn-back', '.table-wrap table'].map((s) => document.querySelectorAll(s).length),
    // what those elements say, not only that they exist (a quote can be drawn empty)
    drawnText: ['.quran', '.fn-note', '.table-wrap table'].map((s) => [...document.querySelectorAll(s)].map((e) => e.textContent).join('|').length),
    settings: ['btn-theme', 'btn-numerals'].map((id) => { const b = document.getElementById(id); return [b.querySelector('svg')?.dataset.lucide || b.textContent.trim(), b.title, b.getAttribute('aria-label')]; }),
    overflow: document.documentElement.scrollWidth > window.innerWidth
  };
};

async function run(browser, v) {
  const res = {};
  for (const [lang, book] of Object.entries(BOOKS)) for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    await network(ctx, hubHosts(v));
    const p = await ctx.newPage(), errors = errorsOf(p), log = [];
    const step = async (name, fn) => {
      try { await fn(); } catch (e) { log.push([name, 'ERROR ' + e.message.split('\n')[0]]); return; }
      await p.waitForTimeout(350);
      log.push([name, await p.evaluate(state).catch((e) => 'ERROR ' + e.message.split('\n')[0])]);
    };
    const open = async () => { await p.setInputFiles('#file-input', book); await p.waitForTimeout(1500); };
    // Opens a button that may have moved into ⋮ at this width.
    const press = async (id) => { const b = p.locator(id); if (await b.isVisible()) await b.click(); else { await p.click('#btn-more'); await p.click(id); } };
    await p.goto('https://i36o.web.app/md/'); await p.waitForTimeout(500);
    await step('open', open);
    await step('End', () => p.keyboard.press('End'));
    await step('Home', () => p.keyboard.press('Home'));
    await step('PageDown ×2', async () => { await p.keyboard.press('PageDown'); await p.keyboard.press('PageDown'); });
    await step('type page 3', async () => { await p.fill('#page-num-input', '3'); await p.press('#page-num-input', 'Enter'); });
    await step('type (2)', async () => { await p.fill('#page-num-input', '(2)'); await p.press('#page-num-input', 'Enter'); });
    await step('panel', () => p.click('#btn-panel'));
    await step('heading 2', async () => { const it = p.locator('#panel-body .panel-item').nth(1); if (await it.count()) await it.click(); });
    await step('search', async () => { await p.keyboard.press('Control+f'); await p.fill('#search-input', lang === 'ar' ? 'العلم' : 'the'); await p.press('#search-input', 'Enter'); await p.waitForTimeout(800); });
    await step('Enter ×2', async () => { await p.press('#search-input', 'Enter'); await p.press('#search-input', 'Enter'); });
    await step('Esc', () => p.keyboard.press('Escape'));
    await step('bookmark', () => press('#btn-bookmark'));
    await step('bookmarks tab', async () => { if (!(await p.locator('#tab-bookmarks').isVisible())) await p.click('#btn-panel'); await p.click('#tab-bookmarks'); });
    await step('close panel', () => p.keyboard.press('Escape'));
    await step('#p=2 (ignored: a device file)', async () => { await p.evaluate(() => { window.location.hash = '#p=2'; }); await p.waitForTimeout(600); });
    await step('theme button', () => press('#btn-theme'));
    await step('numerals button', () => press('#btn-numerals'));
    await step('text larger', async () => { await press('#btn-text-larger'); await p.keyboard.press('Escape'); });
    await step('reopen', async () => { await p.reload(); await p.waitForTimeout(500); await open(); });
    log.push(['page errors', errors]);
    res[`${lang} ${w}px`] = log;
    await ctx.close();
  }
  for (const w of WIDTHS) res[`linked ${w}px`] = await runLinked(browser, v, w);
  return res;
}

async function runLinked(browser, v, w) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
  await network(ctx, { ...hubHosts(v), 'lib.i36o.workers.dev': (route, url) => serveFile(route, join(LINKED, decodeURIComponent(url.pathname))) });
  const p = await ctx.newPage(), errors = errorsOf(p), log = [];
  // The Reader writes the address 0.5 s after scrolling stops (SAVE_DEBOUNCE_MS): wait past it.
  const snap = async (name) => { await p.waitForTimeout(900); log.push([name, await p.evaluate(state).catch((e) => 'ERROR ' + e.message.split('\n')[0])]); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { log.push([name, 'ERROR ' + e.message.split('\n')[0]]); return; } await snap(name); };
  const at = (book, hash = '') => `https://i36o.web.app/md/?file=${encodeURIComponent(`https://lib.i36o.workers.dev/books/${book}`)}${hash}`;
  const go = async (url) => { await p.goto(url); await p.waitForTimeout(1500); };
  const hash = (h) => p.evaluate((x) => { window.location.hash = x; }, h);
  await step('open ar #p=5', () => go(at('ar.md', '#p=5')));
  await step('#p=12', () => hash('#p=12'));
  await step('#p=١٧ (Arabic digits)', () => hash('#p=١٧'));
  await step('#p=ص 20', () => hash('#p=ص 20'));
  await step('#n=3', () => hash('#n=3'));
  await step('#p=999 (nearest page)', () => hash('#p=999'));
  await step('#p=abc (not a page: address corrected)', () => hash('#p=abc'));
  await step('#n=999 (past the end: address corrected)', () => hash('#n=999'));
  await step('Home (address follows)', () => p.keyboard.press('Home'));
  await step('PageDown ×2', async () => { await p.keyboard.press('PageDown'); await p.keyboard.press('PageDown'); });
  await step('reload', async () => { await p.reload(); await p.waitForTimeout(1500); });
  await step('open without #p (saved position)', () => go(at('ar.md')));
  await step('open #p=30 (link beats saved)', () => go(at('ar.md', '#p=30')));
  await step('volumes: open #p=2:5', () => go(at('vol.md', '#p=2:5')));
  await step('volumes: #p=1:9', () => hash('#p=1:9'));
  await step('volumes: #p=7 (this volume)', () => hash('#p=7'));
  await step('volumes: #p=ج2/ص3', () => hash('#p=ج2/ص3'));
  await step('letters: open #p=ب', () => go(at('letters.md', '#p=ب')));
  await step('letters: #p=4', () => hash('#p=4'));
  await step('letters: #p=أ', () => hash('#p=أ'));
  await step('letters: #p=د (no such letter)', () => hash('#p=د'));
  await step('letters: open #p=xyz', () => go(at('letters.md', '#p=xyz')));
  await step('English: open #p=7', () => go(at('en.md', '#p=7')));
  await step('plain: open #n=1', () => go(at('plain.md', '#n=1')));
  await step('not in the library', () => go('https://i36o.web.app/md/?file=' + encodeURIComponent('https://example.org/x.md')));
  log.push(['page errors', errors]);
  await ctx.close();
  return log;
}

await oldVsNew('reader-steps', opts, pages(opts.old), pages(opts.new), run);
