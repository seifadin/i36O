// Safe areas (notch, rounded corners, a foldable's hinge side), old vs new: with the insets emulated
// by Chromium, does any text or control sit inside a left or right inset? Every page (the Reader
// with the display test open, the CSE with results, Daily Reflection, the app's home screen) on an
// iPhone in portrait and landscape and on the Surface Duo's three layouts with an inset on one side.
// The new version's findings are listed on their own as well.
//   node safe-area.js [--old <ref>] [--new <ref>] [--pages reader,cse,day,app] [--out <folder>]
import { join } from 'node:path';
import { options, versionFor } from './lib/versions.js';
import { network, hubHosts, serveFile } from './lib/browser.js';
import { library, DISPLAY_TEST } from './lib/fixtures.js';
import { baserow, dayServices, DAY_CLOCK } from './lib/fakes.js';
import { oldVsNew } from './lib/report.js';

const opts = options();
const WANT = (typeof opts.pages === 'string' ? opts.pages : 'reader,cse,day,app').split(',');
const LIB = await library();

// [width, height, insets]: an iPhone's real insets, and 60 px on one side of each Duo layout.
const LAYOUTS = {
  'iPhone portrait': [390, 844, { top: 59, bottom: 34 }],
  'iPhone landscape': [844, 390, { left: 47, right: 47, bottom: 21 }],
  'Duo outer, left': [466, 678, { left: 60 }], 'Duo outer, right': [466, 678, { right: 60 }],
  'Duo inner portrait, left': [626, 890, { left: 60 }], 'Duo inner portrait, right': [626, 890, { right: 60 }],
  'Duo inner landscape, left': [890, 626, { left: 60 }], 'Duo inner landscape, right': [890, 626, { right: 60 }]
};

const PAGES = {
  reader: (v) => ({ hosts: hubHosts(v), url: 'https://i36o.web.app/md/', prepare: async (p) => { await p.setInputFiles('#file-input', DISPLAY_TEST); await p.waitForTimeout(2000); } }),
  cse: (v) => ({ hosts: { ...hubHosts(v), 'lib.i36o.workers.dev': (r, u) => serveFile(r, join(LIB, decodeURIComponent(u.pathname))) }, url: `https://i36o.web.app/cse/?q=${encodeURIComponent('العلم')}`, prepare: async (p) => { await p.waitForTimeout(1500); } }),
  day: (v) => ({ hosts: { ...hubHosts(v), ...dayServices }, url: 'https://i36o.web.app/day/', clock: true }),
  app: (v) => ({ hosts: { 'i36o.web.app': v.dist, 'theme.i36o.workers.dev': v.theme, 'api.baserow.io': baserow }, url: 'https://i36o.web.app/', prepare: async (p) => { await p.locator('main button[aria-expanded]').first().click(); await p.waitForTimeout(300); } })
};

// Text and controls on screen whose box reaches into the left or right inset. (Top and bottom
// insets are part of each layout so the pages draw as on a phone; only the sides are checked.)
const inInsets = ({ left, right }) => {
  const W = document.documentElement.clientWidth, lo = left || 0, hi = W - (right || 0), bad = [];
  const shown = (el) => { const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0; };
  const check = (r, what) => {
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > window.innerHeight) return;
    if (r.left < lo - 0.5 || r.right > hi + 0.5) bad.push(what);
  };
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) {
    const el = n.parentElement;
    if (!n.textContent.trim() || !el || !shown(el) || el.closest('script, style, [aria-hidden="true"]')) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    for (const r of range.getClientRects()) check(r, '«' + n.textContent.trim().slice(0, 24) + '»');
  }
  // Controls and icons; one spanning the whole width is a full-bleed row or ornament on purpose
  // (its background reaches the edge, its content is padded — that content is checked above).
  for (const el of document.querySelectorAll('button, input, select, textarea, a, svg')) {
    if (!shown(el) || el.closest('svg svg')) continue;
    const r = el.getBoundingClientRect();
    if (r.left <= 0.5 && r.right >= W - 0.5) continue;
    check(r, el.tagName.toLowerCase() + (el.getAttribute('aria-label') ? ':' + el.getAttribute('aria-label').slice(0, 20) : ''));
  }
  return [...new Set(bad)].sort();
};

async function run(browser, v) {
  const res = {};
  for (const name of Object.keys(PAGES).filter((n) => WANT.includes(n))) {
    const pg = PAGES[name](v), log = [];
    for (const [layout, [w, h, insets]] of Object.entries(LAYOUTS)) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, ...(pg.clock ? { timezoneId: DAY_CLOCK.timezoneId, locale: DAY_CLOCK.locale } : {}) });
      await network(ctx, pg.hosts);
      await ctx.addInitScript(() => { try { localStorage.setItem('i360Privacy', '1'); } catch { /* storage blocked */ } });
      const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: 0, left: 0, right: 0, ...insets } });
      if (pg.clock) await p.clock.install({ time: DAY_CLOCK.time });
      await p.goto(pg.url); await p.waitForTimeout(1200);
      if (pg.clock) { await p.clock.runFor(2000); await p.waitForTimeout(300); }
      if (pg.prepare) await pg.prepare(p);
      log.push([layout, await p.evaluate(inInsets, insets)]);
      await ctx.close();
    }
    res[name] = log;
  }
  return res;
}

const b = await oldVsNew('safe-area', opts, versionFor(opts.old, WANT), versionFor(opts.new, WANT), run);
for (const [name, log] of Object.entries(b)) for (const [layout, bad] of log) {
  if (bad.length) { console.log(`  new ${name}, ${layout}: ${bad.length} inside the inset — ${bad.slice(0, 4).join(' · ')}`); process.exitCode = 1; }
}
