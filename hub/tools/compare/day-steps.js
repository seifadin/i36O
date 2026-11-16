// Daily Reflection, old vs new, with every outside service faked (lib/fakes.js) and the clock fixed
// (2027-01-05 in Cairo: the Isra event is "today"): loading, the language list, English and back,
// the madhab, the date converter (both directions, a missing 30th, a year out of range), the city
// picker and a search, numerals, the theme button.
// Phone (390 px) and desktop (1280 px): 2 cases × 20 steps.
//   node day-steps.js [--old <ref>] [--new <ref>] [--out <folder>]
import { pages, options, outDir } from './lib/versions.js';
import { launch, network, hubHosts, errorsOf } from './lib/browser.js';
import { dayServices, DAY_CLOCK } from './lib/fakes.js';
import { compare } from './lib/report.js';

const opts = options();
const WIDTHS = [390, 1280];

const state = () => {
  const text = (s) => { const e = document.querySelector(`[data-target="${s}"]`); return e ? e.textContent.trim().replace(/\s+/g, ' ') : null; };
  const grid = document.querySelector('[data-target="prayer-grid"]');
  const ev = document.querySelector('[data-target="events-list"]');
  const next = grid.querySelector('.next-prayer-highlight');
  return {
    lang: document.documentElement.lang, dir: document.documentElement.dir, theme: document.documentElement.dataset.theme,
    title: document.querySelector('.tb-title').textContent.trim(), date: text('current-date'), hijri: text('hijri-date'), hijriSrc: text('hijri-source'),
    verse: (text('quran-arabic') || '').slice(0, 20), tr: (text('quran-translation') || '').slice(0, 30), ref: text('quran-ref'),
    hadith: text('hadith-title'), grade: text('hadith-grade'),
    prayers: [...grid.children].map((b) => b.textContent.trim().replace(/\s+/g, ' ')), prayerRows: new Set([...grid.children].map((b) => b.offsetTop)).size,
    next: next ? next.textContent.trim().replace(/\s+/g, ' ') : null,
    method: text('meta-method'), loc: text('meta-window.location'), tz: text('meta-timezone'),
    events: ev.children.length, eventsScroll: ev.scrollHeight > ev.clientHeight + 1,
    firstEvents: [...ev.children].slice(0, 3).map((c) => c.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)),
    twoCols: document.body.classList.contains('two-cols'),
    langOpen: !document.getElementById('lang-list').hidden, picker: !document.getElementById('city-picker').classList.contains('hidden'),
    cityResults: document.querySelectorAll('[data-target="city-results"] button').length,
    settings: ['btn-theme', 'btn-numerals'].map((id) => { const b = document.getElementById(id); return [b.querySelector('svg')?.dataset.lucide || b.textContent.trim(), b.title, b.getAttribute('aria-label')]; }),
    madhab: [0, 1].map((i) => document.getElementById('school-' + i).getAttribute('aria-pressed') === 'true'),
    conv: {
      dir: text('conv-dir'), d: document.getElementById('conv-d').value, m: document.getElementById('conv-m').value, y: document.getElementById('conv-y').value,
      days: document.getElementById('conv-d').options.length - 1, alpha: text('conv-alpha'), iso: text('conv-iso'),
      error: document.querySelector('[data-target="conv-error"]').hidden ? null : text('conv-error'), label: text('conv-label')
    },
    overflow: document.documentElement.scrollWidth > window.innerWidth
  };
};

async function run(browser, v) {
  const res = {};
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, timezoneId: DAY_CLOCK.timezoneId, locale: DAY_CLOCK.locale });
    await network(ctx, { ...hubHosts(v), ...dayServices });
    const p = await ctx.newPage(), errors = errorsOf(p), log = [];
    await p.clock.install({ time: DAY_CLOCK.time });
    const snap = async (name) => { await p.clock.runFor(1500); await p.waitForTimeout(300); log.push([name, await p.evaluate(state).catch((e) => 'ERROR ' + e.message.split('\n')[0])]); };
    const step = async (name, fn) => { try { await fn(); } catch (e) { log.push([name, 'ERROR ' + e.message.split('\n')[0]]); return; } await snap(name); };
    await p.goto('https://i36o.web.app/day/'); await snap('load');
    await step('language list open', () => p.click('#btn-lang'));
    await step('English', () => p.click('#lang-en'));
    await step('back to Arabic', async () => { await p.click('#btn-lang'); await p.click('#lang-ar'); });
    await step('Hanafi', () => p.click('#school-1'));
    await step('standard', () => p.click('#school-0'));
    // The converter: the year typed first (its change fires on leaving it; it decides whether
    // 29 February is offered), then the month and the day chosen.
    const convDate = async (d, m, y) => {
      await p.fill('#conv-y', String(y)); await p.locator('#conv-y').blur();
      await p.selectOption('#conv-m', String(m)); await p.selectOption('#conv-d', String(d));
    };
    await step('converter: 15/8/2027 → Hijri', () => convDate(15, 8, 2027));
    await step('converter: swap to Hijri → Gregorian', () => p.click('#conv-swap'));
    await step('converter: 1 Ramadan 1448', () => convDate(1, 9, 1448));
    await step('converter: 30 Dhu al-Hijjah 1448', () => convDate(30, 12, 1448));
    await step('converter: year 0', async () => { await p.fill('#conv-y', '0'); await p.locator('#conv-y').blur(); });
    await step('converter: swap back', () => p.click('#conv-swap'));
    await step('converter: 29/2/2028 (leap year)', () => convDate(29, 2, 2028));
    await step('converter: year 2027 (no 29 Feb)', async () => { await p.fill('#conv-y', '2027'); await p.locator('#conv-y').blur(); });
    await step('city picker', () => p.click('#city-change'));
    await step('city search', async () => { await p.fill('#city-search', 'الإسك'); await p.clock.runFor(800); });
    await step('city chosen', () => p.locator('[data-target="city-results"] button').nth(1).click());
    await step('numerals', () => p.click('#btn-numerals'));
    await step('theme 1', () => p.click('#btn-theme'));
    await step('theme 2', () => p.click('#btn-theme'));
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
compare('day-steps', a, b, { out: outDir(opts, 'day-steps'), oldLabel: oldV.label, newLabel: newV.label });
