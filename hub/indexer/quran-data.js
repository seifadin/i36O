// The Quran data for the quran Worker, published on the lib site under quran/ with every build:
//
//   quran/manifest.json          what is published: each text's file, its own version, its hash;
//                                tanzil's page version; the exegesis index's Baserow revision
//   quran/t/<id>.<hash>.json     one Quran text or translation, verbatim, with tanzil's copyright
//                                block (their terms require it in every copy)
//   quran/exegesis/<hash>.json   the chapter:verse → exegesis address table (Baserow i360dbq)
//
// Text files are named by their content, so a changed text gets a new address and the old one can
// be cached for good (_headers); only manifest.json is read fresh.
//
// When is anything downloaded?
// - Tanzil: its page's `version` (sent with every verse request; tanzil raises it when its stored
//   texts change, to clear its users' cached text) is read on every run — one small request.
//   Unchanged → every text is taken from the live build. Changed, or the quarterly full check (the
//   first Friday "full" run of January, April, July and October), or nothing published yet →
//   every text is downloaded and compared; only a text whose content differs gets a new file.
//   The Quran scripts come from tanzil's download page with all its options ticked (checked: then
//   identical to what its Navigator serves), translations from /trans/<id> (Seif agreed to
//   tanzil's Terms of Use, 2026-11-23).
// - Exegesis: i360dbc's Revision is read on every run (the app re-reads i360dbq on the same
//   signal); the table is read again only when it changed.
// A source that can't be reached keeps what the live build has (and says so in the log); with
// nothing published yet, that part is left out and tried again next run.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as inventory from './inventory.js';
import { TANZIL_ORIGIN } from '../src/sites.js';

// Bump when the published files' shape changes: everything is redone.
const FORMAT = 1;
const VERSES = 6236;
const QURAN_TYPES = Object.freeze(['simple', 'simple-plain', 'simple-min', 'simple-clean', 'uthmani', 'uthmani-min']);
// Tanzil's download options that reproduce its Navigator's own text exactly.
const QURAN_OPTIONS = 'marks=true&sajdah=true&tatweel=true&rub=true&stanween=true&outType=txt-2&agree=true';
const TABLE_RESOURCES = '193270';   // i360dbc
const TABLE_QURAN = '488824';       // i360dbq
const EXEGESIS_FIELDS = Object.freeze(['QuranChapter', 'QuranVerseMin', 'QuranVerseMax', 'ExegesisURL', 'ExegesisPage']);
const QUARTER_MONTHS = Object.freeze([0, 3, 6, 9]);
const CONCURRENCY = 3;

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

// The first Friday "full" run of January, April, July and October downloads every text again.
function quarterlyCheck(check, now) {
  return check === 'full' && QUARTER_MONTHS.includes(now.getUTCMonth()) && now.getUTCDate() <= 7;
}

const sourceUrl = (id) => (QURAN_TYPES.includes(id)
  ? `${TANZIL_ORIGIN}/pub/download/index.php?${QURAN_OPTIONS}&quranType=${encodeURIComponent(id)}`
  : `${TANZIL_ORIGIN}/trans/${encodeURIComponent(id)}`);

/* ---------------- Reading tanzil ---------------- */

// Tanzil's page version and the translations its Navigator offers (its own list).
async function readTanzil(fetchFn) {
  const page = await inventory.fetchWithRetry(fetchFn, `${TANZIL_ORIGIN}/?embed=true`);
  if (!page.ok) throw new Error(`tanzil page: HTTP ${page.status}`);
  const html = await page.text();
  const version = (html.match(/var\s+version\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  if (!version) throw new Error('tanzil page: no version found');
  const script = await inventory.fetchWithRetry(fetchFn, `${TANZIL_ORIGIN}/dist/tanzil.js`);
  if (!script.ok) throw new Error(`tanzil.js: HTTP ${script.status}`);
  const js = await script.text();
  const list = (js.match(/var\s+transList\s*=\s*\{([^}]*)\}/) || [])[1];
  if (!list) throw new Error('tanzil.js: no translation list found');
  const translations = [...list.matchAll(/["']?([a-z]{2,3}\.[a-z0-9_-]+)["']?\s*:/gi)].map((m) => m[1]);
  if (translations.length === 0) throw new Error('tanzil.js: empty translation list');
  return { version, translations: [...new Set(translations)] };
}

// One text: tanzil's copyright block (every '#' line, as it is) and the verses (sura|aya|text).
function parseText(id, raw) {
  const notice = [];
  const verses = [];
  for (const line of raw.split('\n')) {
    const l = line.replace(/\r$/, '');
    if (l.startsWith('#')) { notice.push(l); continue; }
    if (!l) continue;
    const a = l.indexOf('|'), b = l.indexOf('|', a + 1);
    if (a < 0 || b < 0) throw new Error(`${id}: unexpected line «${l.slice(0, 40)}»`);
    verses.push(l.slice(b + 1));
  }
  if (verses.length !== VERSES) throw new Error(`${id}: ${verses.length} verses, not ${VERSES}`);
  if (notice.length === 0) throw new Error(`${id}: no copyright block`);
  // The text's own version: "Version 1.1" (Quran) or "Last Update: …" (translations).
  const head = notice.join('\n');
  const textVersion = (head.match(/Version\s+([\d.]+)/i) || head.match(/Last Update:\s*(.+)/i) || [])[1] || null;
  return { id, textVersion: textVersion && textVersion.trim(), notice, verses };
}

async function downloadText(fetchFn, id) {
  const res = await inventory.fetchWithRetry(fetchFn, sourceUrl(id));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseText(id, await res.text());
}

/* ---------------- Reading Baserow ---------------- */

async function readRevision(fetchFn, key, table) {
  const { rows } = await inventory.readRows(fetchFn, key, table, ['Revision']);
  const revision = rows.length ? inventory.fieldText(rows[0].Revision).trim() : '';
  if (!revision) throw new Error(`i360dbc (table ${table}): no Revision`);
  return revision;
}

// The exegesis index: the rows the app matches against (Number() as the app does, §3).
async function readExegesis(fetchFn, key, table) {
  const { rows } = await inventory.readRows(fetchFn, key, table, [...EXEGESIS_FIELDS]);
  return rows.map((r) => ({
    chapter: Number(inventory.fieldText(r.QuranChapter)),
    verseMin: Number(inventory.fieldText(r.QuranVerseMin)),
    verseMax: Number(inventory.fieldText(r.QuranVerseMax)),
    url: inventory.fieldText(r.ExegesisURL).trim(),
    page: Number(inventory.fieldText(r.ExegesisPage)) || null
  })).filter((r) => r.chapter > 0 && r.verseMin > 0 && r.verseMax >= r.verseMin && r.url);
}

async function mapLimit(items, limit, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; await fn(items[i], i); }
  }));
}

/* ---------------- The plan ----------------
   loadPrevious(path) reads a file of the live build (JSON), or rejects. Returns
   { manifest, changed, files, report }: files is a map path → (async () => content), to be written
   into the build by write(); changed says whether the manifest differs from the live one. */
async function plan({ fetchFn = fetch, key, loadPrevious, check = 'full', now = new Date(), refresh = false,
  tables = {}, log = console.log }) {
  const tableResources = tables.resources || TABLE_RESOURCES;
  const tableQuran = tables.quran || TABLE_QURAN;
  const prev = await loadPrevious('quran/manifest.json').then((m) => (m && m.format === FORMAT ? m : null)).catch(() => null);
  const prevTanzil = prev && prev.tanzil;   // null when tanzil couldn't be read last time either
  const prevTexts = prevTanzil ? prevTanzil.texts : {};
  const files = new Map();
  const fromPrevious = (file) => () => loadPrevious(file);
  const report = { tanzil: null, exegesis: null };

  /* Tanzil */
  let tanzil = prevTanzil || null;
  try {
    const live = await readTanzil(fetchFn);
    const full = !prevTanzil || refresh || live.version !== prevTanzil.pageVersion || quarterlyCheck(check, now);
    if (!full) {
      log(`Quran texts: tanzil version ${live.version} unchanged — ${Object.keys(prevTexts).length} texts taken from the live build.`);
      report.tanzil = 'unchanged';
    } else {
      const why = !prevTanzil ? 'nothing published yet' : refresh ? 'asked for' : live.version !== prevTanzil.pageVersion
        ? `tanzil version ${prevTanzil.pageVersion} → ${live.version}` : 'quarterly check';
      const ids = [...QURAN_TYPES, ...live.translations];
      log(`Quran texts: downloading ${ids.length} (${why})…`);
      const texts = {};
      const counts = { same: 0, changed: 0, added: 0, kept: 0, missing: 0 };
      await mapLimit(ids, CONCURRENCY, async (id) => {
        try {
          const t = await downloadText(fetchFn, id);
          const body = JSON.stringify({ id, textVersion: t.textVersion, notice: t.notice, verses: t.verses });
          const hash = sha(body);
          const old = prevTexts[id];
          if (old && old.hash === hash) { texts[id] = old; counts.same++; return; }
          const file = `quran/t/${id}.${hash}.json`;
          texts[id] = { file, hash, textVersion: t.textVersion };
          files.set(file, async () => body);
          counts[old ? 'changed' : 'added']++;
          if (old) log(`  changed: ${id}`);
        } catch (err) {
          if (prevTexts[id]) { texts[id] = prevTexts[id]; counts.kept++; log(`  UNREACHABLE, live copy kept: ${id} — ${inventory.causeText(err)}`); }
          else { counts.missing++; log(`  UNREACHABLE, left out: ${id} — ${inventory.causeText(err)}`); }
        }
      });
      if (!QURAN_TYPES.every((id) => texts[id])) throw new Error('a Quran script could not be read and none is published yet');
      tanzil = { pageVersion: live.version, texts: Object.fromEntries(Object.keys(texts).sort().map((id) => [id, texts[id]])) };
      log(`Quran texts: ${counts.same} unchanged, ${counts.changed} changed, ${counts.added} new, ${counts.kept} kept from the live build, ${counts.missing} left out.`);
      report.tanzil = counts;
    }
  } catch (err) {
    log(`Quran texts: tanzil not read (${inventory.causeText(err)})${prevTanzil ? ' — the live build\'s texts are kept' : ' — left out, tried again next run'}.`);
    report.tanzil = { error: inventory.causeText(err) };
  }

  /* Exegesis index */
  let exegesis = prev ? prev.exegesis : null;
  try {
    const revision = await readRevision(fetchFn, key, tableResources);
    if (prev && prev.exegesis && prev.exegesis.revision === revision) {
      log(`Exegesis index: revision ${revision} unchanged — taken from the live build.`);
      report.exegesis = 'unchanged';
    } else {
      const rows = await readExegesis(fetchFn, key, tableQuran);
      const body = JSON.stringify({ revision, rows });
      const file = `quran/exegesis/${sha(body)}.json`;
      files.set(file, async () => body);
      exegesis = { revision, file, rows: rows.length };
      log(`Exegesis index: revision ${prev && prev.exegesis ? `${prev.exegesis.revision} → ` : ''}${revision}, ${rows.length} rows.`);
      report.exegesis = { revision, rows: rows.length };
    }
  } catch (err) {
    log(`Exegesis index: not read (${inventory.causeText(err)})${exegesis ? ' — the live build\'s index is kept' : ' — left out, tried again next run'}.`);
    report.exegesis = { error: inventory.causeText(err) };
  }

  const manifest = { format: FORMAT, tanzil, exegesis };
  // Files not downloaded this run come from the live build.
  for (const t of Object.values(tanzil ? tanzil.texts : {})) if (!files.has(t.file)) files.set(t.file, fromPrevious(t.file));
  if (exegesis && !files.has(exegesis.file)) files.set(exegesis.file, fromPrevious(exegesis.file));
  const changed = JSON.stringify(manifest) !== JSON.stringify(prev);
  return { manifest, changed, files, report };
}

// Writes the manifest and every file into the build folder.
async function write(planned, distDir) {
  const paths = [...planned.files.keys()];
  await mapLimit(paths, CONCURRENCY, async (p) => {
    const content = await planned.files.get(p)();
    const out = join(distDir, p);
    mkdirSync(join(out, '..'), { recursive: true });
    writeFileSync(out, typeof content === 'string' ? content : JSON.stringify(content));
  });
  mkdirSync(join(distDir, 'quran'), { recursive: true });
  writeFileSync(join(distDir, 'quran', 'manifest.json'), JSON.stringify(planned.manifest));
  return paths.length + 1;
}

export { plan, write, parseText, quarterlyCheck, FORMAT, VERSES, QURAN_TYPES, TABLE_RESOURCES, TABLE_QURAN };
