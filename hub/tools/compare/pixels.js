// Screens, old vs new, pixel by pixel: the Reader with the display test open (every element it
// draws), the CSE with results, Daily Reflection (clock fixed) and the app's home screen, in light,
// sepia and dark, at 390 and 1280 px. Each screen is saved old and new, and where they differ a
// third image marks the changed pixels in red (in --out, or the temporary folder).
//   node pixels.js [--old <ref>] [--new <ref>] [--pages reader,cse,day,app] [--full] [--out <folder>]
//   --full   whole pages instead of the first screen
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { options, outDir, versionFor } from './lib/versions.js';
import { launch, network, hubHosts, serveFile } from './lib/browser.js';
import { library, DISPLAY_TEST } from './lib/fixtures.js';
import { baserow, dayServices, DAY_CLOCK } from './lib/fakes.js';
import { compare } from './lib/report.js';

const opts = options();
const OUT = outDir(opts, 'pixels');
const WANT = (typeof opts.pages === 'string' ? opts.pages : 'reader,cse,day,app').split(',');
const THEMES = ['light', 'sepia', 'dark'], WIDTHS = [390, 1280];
const LIB = await library();

const SCREENS = {
  reader: (v) => ({ hosts: hubHosts(v), url: 'https://i36o.web.app/md/', prepare: async (p) => { await p.setInputFiles('#file-input', DISPLAY_TEST); await p.waitForTimeout(2000); } }),
  cse: (v) => ({ hosts: { ...hubHosts(v), 'lib.i36o.workers.dev': (r, u) => serveFile(r, join(LIB, decodeURIComponent(u.pathname))) }, url: `https://i36o.web.app/cse/?q=${encodeURIComponent('العلم')}`, prepare: async (p) => { await p.waitForTimeout(1500); } }),
  day: (v) => ({ hosts: { ...hubHosts(v), ...dayServices }, url: 'https://i36o.web.app/day/', clock: true }),
  app: (v) => ({ hosts: { 'i36o.web.app': v.dist, 'theme.i36o.workers.dev': v.theme, 'api.baserow.io': baserow }, url: 'https://i36o.web.app/', prepare: async (p) => { await p.locator('main button[aria-expanded]').first().click(); await p.waitForTimeout(300); } })
};

async function shot(browser, screen, theme, w, file) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, ...(screen.clock ? { timezoneId: DAY_CLOCK.timezoneId, locale: DAY_CLOCK.locale } : {}) });
  await network(ctx, screen.hosts);
  // The theme as this version saves it: JSON since the theme loader keeps its choices with
  // storage.js (beside it on the theme site), plain text before. The link itself is looked for:
  // in a version unpacked from git its target (hub/src/) isn't there.
  const hasStore = (() => { try { return lstatSync(join(screen.hosts['theme.i36o.workers.dev'], 'storage.js')).isSymbolicLink(); } catch { return false; } })();
  const saved = hasStore ? JSON.stringify(theme) : theme;
  await ctx.addInitScript((t) => { try { localStorage.setItem('i360.theme', t); localStorage.setItem('i360Privacy', '1'); } catch { /* storage blocked */ } }, saved);
  const p = await ctx.newPage();
  if (screen.clock) await p.clock.install({ time: DAY_CLOCK.time });
  await p.goto(screen.url); await p.waitForTimeout(1200);
  if (screen.clock) { await p.clock.runFor(2000); await p.waitForTimeout(300); }
  if (screen.prepare) await screen.prepare(p);
  await p.screenshot({ path: file, fullPage: !!opts.full, animations: 'disabled', caret: 'hide' });
  await ctx.close();
}

// Counts the pixels that differ (in a blank page's canvas) and draws them in red over a faded copy.
async function diff(page, a, b, file) {
  const res = await page.evaluate(async ([a, b]) => {
    const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const [x, y] = await Promise.all([load(a), load(b)]);
    const w = Math.max(x.width, y.width), h = Math.max(x.height, y.height);
    const data = (img) => { const c = new OffscreenCanvas(w, h), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
    const p = data(x), q = data(y), c = new OffscreenCanvas(w, h), g = c.getContext('2d'), out = g.createImageData(w, h);
    let n = 0;
    for (let i = 0; i < p.length; i += 4) {
      const changed = p[i] !== q[i] || p[i + 1] !== q[i + 1] || p[i + 2] !== q[i + 2] || p[i + 3] !== q[i + 3];
      if (changed) n++;
      out.data.set(changed ? [255, 0, 0, 255] : [q[i], q[i + 1], q[i + 2], 40], i);
    }
    if (!n) return { n, size: [x.width, x.height, y.width, y.height] };
    g.putImageData(out, 0, 0);
    const blob = await c.convertToBlob({ type: 'image/png' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (const v of bytes) s += String.fromCharCode(v);
    return { n, size: [x.width, x.height, y.width, y.height], png: btoa(s) };
  }, [a, b].map((f) => 'data:image/png;base64,' + readFileSync(f).toString('base64')));
  if (res.png) writeFileSync(file, Buffer.from(res.png, 'base64'));
  return { changedPixels: res.n, sizes: res.size[0] === res.size[2] && res.size[1] === res.size[3] ? 'same' : `${res.size[0]}×${res.size[1]} → ${res.size[2]}×${res.size[3]}` };
}

const oldV = versionFor(opts.old, WANT), newV = versionFor(opts.new, WANT);
const browser = await launch();
const blank = await (await browser.newContext()).newPage();
const oldRes = {}, newRes = {};
for (const name of Object.keys(SCREENS).filter((n) => WANT.includes(n))) {
  for (const theme of THEMES) for (const w of WIDTHS) {
    const base = join(OUT, `${name}-${theme}-${w}`);
    await shot(browser, SCREENS[name](oldV), theme, w, `${base}-old.png`);
    await shot(browser, SCREENS[name](newV), theme, w, `${base}-new.png`);
    const d = await diff(blank, `${base}-old.png`, `${base}-new.png`, `${base}-diff.png`);
    const key = `${name} ${theme} ${w}px`;
    oldRes[key] = [['pixels', { changedPixels: 0, sizes: 'same' }]];
    newRes[key] = [['pixels', d]];
  }
}
await browser.close();
compare('pixels', oldRes, newRes, { out: OUT, oldLabel: oldV.label, newLabel: newV.label });
console.log(`  screenshots: ${OUT}`);
