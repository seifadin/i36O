// The Reader, old vs new: the same steps on both, recording what a reader would see change
// (the page shown, the page counter, the panel, search results, bookmarks, the address).
// An Arabic and an English book, on a phone (390 px) and a desktop (1280 px): 4 cases × 17 steps (+ page errors).
//   node reader-steps.js [--old <ref>] [--new <ref>] [--out <folder>]
import { pages, options, outDir } from './lib/versions.js';
import { launch, network, hubHosts, errorsOf } from './lib/browser.js';
import { books } from './lib/fixtures.js';
import { compare } from './lib/report.js';

const opts = options();
const BOOKS = books();
const WIDTHS = [390, 1280];

const state = () => {
  const $ = (id) => document.getElementById(id);
  const vis = [...document.querySelectorAll('.page-sheet')].findIndex((s) => { const r = s.getBoundingClientRect(); return r.bottom > 80 && r.top < window.innerHeight / 2; });
  return {
    page: $('page-num-input').value, of: $('total-pages').textContent, vis,
    panel: $('side-panel').classList.contains('open') || !$('side-panel').hidden,
    items: document.querySelectorAll('#panel-body .panel-item').length, count: $('search-count').textContent,
    hash: window.location.hash, sheets: document.querySelectorAll('.page-sheet').length,
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
    await step('#p=2 link', async () => { await p.evaluate(() => { window.location.hash = '#p=2'; }); await p.waitForTimeout(600); });
    await step('text larger', async () => { await press('#btn-text-larger'); await p.keyboard.press('Escape'); });
    await step('reopen', async () => { await p.reload(); await p.waitForTimeout(500); await open(); });
    log.push(['page errors', errors]);
    res[`${lang} ${w}px`] = log;
    await ctx.close();
  }
  return res;
}

const oldV = pages(opts.old), newV = pages(opts.new);
const browser = await launch();
const [a, b] = [await run(browser, oldV), await run(browser, newV)];
await browser.close();
compare('reader-steps', a, b, { out: outDir(opts, 'reader-steps'), oldLabel: oldV.label, newLabel: newV.label });
