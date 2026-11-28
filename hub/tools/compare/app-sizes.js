// The app's home screen, old vs new, across widths: the title's size and the science list's three
// levels (major, intermediate, minor), with a major and an intermediate opened, and whether the page
// scrolls sideways. Also checks the rule that no science level is bigger than the title.
// Widths 260–600 px every 5, then to 1400 every 50 (85 widths). Builds each version's app first
// (lib/versions.js, fake Baserow tables from lib/fakes.js).
//   node app-sizes.js [--old <ref>] [--new <ref>] [--widths 320,390,1280] [--out <folder>]
import { app, options } from './lib/versions.js';
import { network, errorsOf, SCIENCE_ROW, CLOSED_SCIENCE_ROW } from './lib/browser.js';
import { baserow } from './lib/fakes.js';
import { oldVsNew } from './lib/report.js';

const opts = options();
const WIDTHS = typeof opts.widths === 'string' ? opts.widths.split(',').map(Number)
  : [...Array.from({ length: 69 }, (_, i) => 260 + i * 5), ...Array.from({ length: 16 }, (_, i) => 650 + i * 50)];

const measure = (row) => {
  const size = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
  const rows = [...document.querySelectorAll(row)];
  const title = document.querySelector('.shadow-toolbar') || document.querySelector('header');
  return {
    title: size(title),
    major: size(rows.find((b) => !b.textContent.includes('فرع') && !b.textContent.includes('مصدر'))),
    intermediate: size(rows.find((b) => b.textContent.includes('فرع'))),
    minor: size([...document.querySelectorAll('main button:not([aria-expanded])')].find((b) => b.textContent.includes('مصدر'))),
    overflow: document.documentElement.scrollWidth > window.innerWidth
  };
};

async function one(browser, v, w) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 760 } });
  await network(ctx, { 'i36o.web.app': v.dist, 'theme.i36o.workers.dev': v.theme, 'api.baserow.io': baserow });
  await ctx.addInitScript(() => { try { localStorage.setItem('i360Privacy', '1'); } catch { /* storage blocked */ } });
  const p = await ctx.newPage(), errors = errorsOf(p);
  await p.goto('https://i36o.web.app/'); await p.waitForTimeout(1200);
  const steps = [];
  try {
    await p.locator(SCIENCE_ROW).first().click(); await p.waitForTimeout(200);
    await p.locator(CLOSED_SCIENCE_ROW).filter({ hasText: 'فرع' }).first().click(); await p.waitForTimeout(200);
    const m = await p.evaluate(measure, SCIENCE_ROW);
    m.biggerThanTitle = ['major', 'intermediate', 'minor'].filter((k) => m[k] > m.title);
    steps.push(['sizes', m]);
  } catch (e) { steps.push(['sizes', 'ERROR ' + e.message.split('\n')[0]]); }
  steps.push(['page errors', errors]);
  await ctx.close();
  return steps;
}

async function run(browser, v) {
  const res = {};
  for (const w of WIDTHS) res[`${w}px`] = await one(browser, v, w);
  return res;
}

const b = await oldVsNew('app-sizes', opts, app(opts.old), app(opts.new), run);
const broken = Object.entries(b).filter(([, s]) => s[0][1].biggerThanTitle?.length || s[0][1].overflow);
if (broken.length) {
  console.log(`  new: a level bigger than the title, or sideways scrolling, at ${broken.map(([k]) => k).join(', ')}`);
  process.exitCode = 1;
}
