// The i360 CSE, old vs new, on a small test library (lib/fixtures.js): search, expand and collapse,
// «more», the two options, a too-short search, a failed search and its retry, the theme button.
// Phone (390 px) and desktop (1280 px): 2 cases × up to 15 steps.
//   node cse-steps.js [--old <ref>] [--new <ref>] [--out <folder>]
import { pages, options, outDir } from './lib/versions.js';
import { launch, network, hubHosts, errorsOf, serveFile } from './lib/browser.js';
import { library } from './lib/fixtures.js';
import { compare } from './lib/report.js';
import { join } from 'node:path';

const opts = options();
const LIB = await library();
const WIDTHS = [390, 1280];

const state = () => {
  const $ = (id) => document.getElementById(id);
  const status = $('status');
  return {
    status: status.textContent.trim(), error: status.classList.contains('error'),
    majors: document.querySelectorAll('details.major').length, inters: document.querySelectorAll('details.inter').length,
    open: document.querySelectorAll('details[open]').length, hits: document.querySelectorAll('.hit').length,
    visibleHits: [...document.querySelectorAll('.hit')].filter((h) => h.offsetParent).length,
    more: document.querySelectorAll('.group-foot button').length, bar: !$('bar-btns').hidden,
    exact: $('opt-exact').getAttribute('aria-pressed'), word: $('opt-word').getAttribute('aria-pressed'),
    theme: document.documentElement.dataset.theme, about: $('about').textContent.trim().slice(0, 120), q: window.location.search,
    overflow: document.documentElement.scrollWidth > window.innerWidth
  };
};

async function run(browser, v) {
  const res = {};
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    let libDown = false;
    await network(ctx, { ...hubHosts(v), 'lib.i36o.workers.dev': (route, url) => (libDown ? route.fulfill({ status: 500, body: '' }) : serveFile(route, join(LIB, decodeURIComponent(url.pathname)))) });
    const p = await ctx.newPage(), errors = errorsOf(p), log = [];
    const snap = async (name) => { await p.waitForTimeout(400); log.push([name, await p.evaluate(state).catch((e) => 'ERROR ' + e.message.split('\n')[0])]); };
    // A step that can't be done is recorded as such (a difference), not a crash.
    const step = async (name, fn) => { try { await fn(); } catch (e) { log.push([name, 'ERROR ' + e.message.split('\n')[0]]); return; } await snap(name); };
    const search = async (q, wait = 1200) => { await p.fill('#q', q); await p.press('#q', 'Enter'); await p.waitForTimeout(wait); };
    const firstMore = () => p.locator('.group-foot button:visible').first();
    const T = { timeout: 3000 };
    await p.goto('https://i36o.web.app/cse/'); await p.waitForTimeout(1500); await snap('load');
    await step('search', () => search('العلم'));
    await step('expand all', () => p.click('#btn-expand', T));
    if (await firstMore().count()) await step('more (expanded)', async () => { await firstMore().click(T); await p.waitForTimeout(1000); });
    await step('collapse all', () => p.click('#btn-collapse', T));
    await step('open first major', () => p.locator('details.major > summary').first().click(T));
    if (await p.locator('details.inter > summary').count()) await step('open first intermediate', async () => { await p.locator('details.inter > summary').first().click(T); await p.waitForTimeout(800); });
    if (await firstMore().count()) await step('more', () => firstMore().click(T));
    await step('exact on', async () => { await p.click('#opt-exact', T); await p.waitForTimeout(1000); });
    await step('word on', async () => { await p.click('#opt-word', T); await p.waitForTimeout(1000); });
    await step('both off', async () => { await p.click('#opt-exact', T); await p.click('#opt-word', T); await p.waitForTimeout(1000); });
    await step('too short', () => search('في', 0));
    libDown = true;
    await p.evaluate(async () => { try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* no caches */ } });
    await step('failed search', () => search('مسألة العلم', 1500));
    libDown = false;
    if (await p.locator('.status .retry').count()) await step('retry', async () => { await p.locator('.status .retry').click(T); await p.waitForTimeout(1500); });
    await step('theme button 1', () => p.click('#btn-theme', T));
    await step('theme button 2', () => p.click('#btn-theme', T));
    log.push(['page errors', errors]);
    res[`${w}px`] = log;
    await ctx.close();
  }
  return res;
}

const oldV = pages(opts.old), newV = pages(opts.new);
const browser = await launch();
const [a, b] = [await run(browser, oldV), await run(browser, newV)];
await browser.close();
compare('cse-steps', a, b, { out: outDir(opts, 'cse-steps'), oldLabel: oldV.label, newLabel: newV.label });
