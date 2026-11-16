// Every page, old vs new, resized from 260 to 1800 px (every 10 px below 600, then every 20):
// does the page or its toolbar run off the side, which toolbar level is in use and what sits in ⋮,
// and for Daily Reflection the columns and the prayer rows. Pages: the Reader (a book open, in the
// browser and as inside the app), the CSE (with results), Daily Reflection, the app's home screen.
// Besides old vs new, any sideways scrolling in the new version is listed on its own.
//   node sweep.js [--old <ref>] [--new <ref>] [--pages reader,cse,day,app] [--out <folder>]
import { pages, app, options, outDir } from './lib/versions.js';
import { launch, network, hubHosts, serveFile } from './lib/browser.js';
import { books, library } from './lib/fixtures.js';
import { baserow, dayServices, DAY_CLOCK } from './lib/fakes.js';
import { compare } from './lib/report.js';
import { join } from 'node:path';

const opts = options();
const WANT = (typeof opts.pages === 'string' ? opts.pages : 'reader,cse,day,app').split(',');
const WIDTHS = [];
for (let w = 260; w <= 1800; w += w < 600 ? 10 : 20) WIDTHS.push(w);
const BOOK = books().ar, LIB = await library();

const measure = () => {
  const out = { overflow: document.documentElement.scrollWidth > window.innerWidth };
  const bar = document.querySelector('.toolbar');
  if (bar) {
    const shown = [...bar.querySelectorAll('button, .tb-title, .page-counter')].filter((e) => e.offsetParent && !e.closest('.more-menu, #more-menu'));
    out.barOverflow = bar.scrollWidth > bar.clientWidth + 1 || shown.some((e) => { const r = e.getBoundingClientRect(); return r.left < -0.5 || r.right > window.innerWidth + 0.5; });
    out.barLevel = [...bar.classList].filter((c) => c !== 'toolbar').join(' ');
    out.inMenu = document.querySelectorAll('#more-menu button').length;
  }
  const grid = document.querySelector('[data-target="prayer-grid"]');
  if (grid) {
    out.twoCols = document.body.classList.contains('two-cols');
    out.prayerRows = new Set([...grid.children].map((x) => x.offsetTop)).size;
    out.prayerBoxOverflow = [...grid.children].some((x) => x.scrollWidth > x.clientWidth);
  }
  return out;
};

const CASES = {
  reader: async (b, v) => sweepOne(b, hubHosts(v), 'https://i36o.web.app/md/', async (p) => { await p.setInputFiles('#file-input', BOOK); await p.waitForTimeout(2000); }),
  'reader in app': async (b, v) => sweepOne(b, hubHosts(v), 'https://i36o.web.app/md/', async (p) => { await p.setInputFiles('#file-input', BOOK); await p.waitForTimeout(2000); }, true),
  cse: async (b, v) => sweepOne(b, { ...hubHosts(v), 'lib.i36o.workers.dev': (r, u) => serveFile(r, join(LIB, decodeURIComponent(u.pathname))) },
    `https://i36o.web.app/cse/?q=${encodeURIComponent('العلم')}`, async (p) => { await p.waitForTimeout(1500); }),
  day: async (b, v) => sweepOne(b, { ...hubHosts(v), ...dayServices }, 'https://i36o.web.app/day/', null, false, true),
  app: async (b, v) => sweepOne(b, { 'i36o.web.app': v.dist, 'theme.i36o.workers.dev': v.theme, 'api.baserow.io': baserow }, 'https://i36o.web.app/',
    async (p) => { await p.locator('main button[aria-expanded]').first().click(); await p.waitForTimeout(300); })
};

async function sweepOne(browser, hosts, url, prepare, inApp = false, clock = false) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 800 }, ...(clock ? { timezoneId: DAY_CLOCK.timezoneId, locale: DAY_CLOCK.locale } : {}) });
  await network(ctx, hosts);
  await ctx.addInitScript((native) => { try { localStorage.setItem('i360Privacy', '1'); } catch { /* storage blocked */ } if (native) window.Capacitor = { isNativePlatform: () => true }; }, inApp);
  const p = await ctx.newPage();
  if (clock) await p.clock.install({ time: DAY_CLOCK.time });
  await p.goto(url); await p.waitForTimeout(1000);
  if (clock) await p.clock.runFor(2000);
  if (prepare) await prepare(p);
  const rows = [];
  for (const w of WIDTHS) {
    await p.setViewportSize({ width: w, height: 800 });
    await p.waitForTimeout(80);
    if (clock) await p.clock.runFor(100);
    rows.push([`${w}px`, await p.evaluate(measure)]);
  }
  await ctx.close();
  return rows;
}

async function run(browser, v) {
  const res = {};
  for (const name of Object.keys(CASES)) if (WANT.includes(name.split(' ')[0])) res[name] = await CASES[name](browser, v);
  return res;
}

const withApp = (ref) => (WANT.includes('app') ? { ...pages(ref), ...app(ref) } : pages(ref));
const oldV = withApp(opts.old), newV = withApp(opts.new);
const browser = await launch();
const [a, b] = await Promise.all([run(browser, oldV), run(browser, newV)]);
await browser.close();
compare('sweep', a, b, { out: outDir(opts, 'sweep'), oldLabel: oldV.label, newLabel: newV.label });
for (const [name, rows] of Object.entries(b)) {
  const bad = rows.filter(([, m]) => m.overflow || m.barOverflow || m.prayerBoxOverflow).map(([w]) => w);
  if (bad.length) { console.log(`  new ${name}: runs off the side at ${bad.join(', ')}`); process.exitCode = 1; }
}
