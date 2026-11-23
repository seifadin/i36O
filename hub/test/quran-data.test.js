// indexer/quran-data.js with a simulated tanzil and Baserow: what is downloaded when, what is
// taken from the live build, and the files a build carries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Q from '../indexer/quran-data.js';
import { reply } from './helpers.js';

const NOTICE = '# PLEASE DO NOT REMOVE OR CHANGE THIS COPYRIGHT BLOCK\n#  Tanzil Quran Text (Uthmani, Version 1.1)\n#  TERMS OF USE: verbatim copies only';
const TRANS_NOTICE = '# Quran Translation\n#  ID: ar.jalalayn\n#  Last Update: December 1, 2010';
const textFile = (notice, word) => `${notice}\n${Array.from({ length: Q.VERSES }, (_, i) => `1|${i + 1}|${word} ${i + 1}`).join('\n')}\n`;

function services(state) {
  return async (url) => {
    state.calls.push(url);
    if (state.tanzilDown && url.startsWith('https://tanzil.net/')) throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED', message: 'refused' } });
    if (url === 'https://tanzil.net/?embed=true') return reply(200, `<script>var version = '${state.version}';</script>`);
    if (url === 'https://tanzil.net/dist/tanzil.js') return reply(200, 'var x=1;var transList = {"ar.jalalayn":"تفسير الجلالين","en.sahih":"Saheeh International"};var y=2;');
    if (url.startsWith('https://tanzil.net/pub/download/index.php')) {
      const type = new URL(url).searchParams.get('quranType');
      return reply(200, textFile(NOTICE, state.words[type] || `نص-${type}`));
    }
    if (url.startsWith('https://tanzil.net/trans/')) {
      const id = url.slice('https://tanzil.net/trans/'.length);
      return reply(200, textFile(id === 'ar.jalalayn' ? TRANS_NOTICE : '# Quran Translation', state.words[id] || `ترجمة-${id}`));
    }
    if (url.startsWith(`https://api.baserow.io/api/database/rows/table/${Q.TABLE_RESOURCES}/`)) {
      return reply(200, { next: null, results: [{ id: 1, Revision: state.revision }] });
    }
    // As Baserow does: a next-page link over http://, and a request without the key refused.
    if (url.startsWith('http://')) return reply(401, { detail: 'Authentication credentials were not provided.' });
    if (url.startsWith(`https://api.baserow.io/api/database/rows/table/${Q.TABLE_QURAN}/`) && url.includes('page=2')) {
      return reply(200, { next: null, results: [
        { id: 4, QuranChapter: 3, QuranVerseMin: 1, QuranVerseMax: 9, ExegesisURL: 'https://example.org/tafsir/3', ExegesisPage: 5 }
      ] });
    }
    if (url.startsWith(`https://api.baserow.io/api/database/rows/table/${Q.TABLE_QURAN}/`)) {
      state.exegesisReads++;
      return reply(200, { next: `http://api.baserow.io/api/database/rows/table/${Q.TABLE_QURAN}/?page=2&size=200&user_field_names=true`, results: [
        { id: 1, QuranChapter: '1', QuranVerseMin: '1', QuranVerseMax: 7, ExegesisURL: 'https://example.org/tafsir/1', ExegesisPage: 1 },
        { id: 2, QuranChapter: 2, QuranVerseMin: 1, QuranVerseMax: 5, ExegesisURL: ' https://example.org/tafsir/2 ', ExegesisPage: '3' },
        { id: 3, QuranChapter: 2, QuranVerseMin: 6, QuranVerseMax: 7, ExegesisURL: '', ExegesisPage: 4 }   // no address: dropped
      ] });
    }
    throw new Error('unexpected ' + url);
  };
}

const newState = () => ({ calls: [], version: '1.7.3', revision: '1.0', words: {}, exegesisReads: 0, tanzilDown: false });
const downloads = (state) => state.calls.filter((u) => u.includes('/pub/download/') || u.includes('/trans/')).length;

// A "live build" made from a plan's files, as the lib site would serve it.
async function publish(planned) {
  const dir = mkdtempSync(join(tmpdir(), 'quran-'));
  await Q.write(planned, dir);
  return { dir, load: async (p) => JSON.parse(readFileSync(join(dir, p), 'utf8')) };
}
const nothing = async () => { throw new Error('HTTP 404'); };
const MAY = new Date('2026-05-08T01:00:00Z');   // not a quarterly-check week
const run = (state, loadPrevious, extra = {}) => Q.plan({ fetchFn: services(state), key: 'k', loadPrevious, now: MAY, log: () => {}, ...extra });

test('first run: every Quran script and translation, verbatim with tanzil\'s notice, and the exegesis index', async () => {
  const state = newState();
  const p = await run(state, nothing);
  assert.equal(p.changed, true);
  assert.equal(downloads(state), Q.QURAN_TYPES.length + 2);
  assert.deepEqual(Object.keys(p.manifest.tanzil.texts).sort(), [...Q.QURAN_TYPES, 'ar.jalalayn', 'en.sahih'].sort());
  assert.equal(p.manifest.tanzil.pageVersion, '1.7.3');
  const live = await publish(p);
  const u = p.manifest.tanzil.texts.uthmani;
  assert.match(u.file, /^quran\/t\/uthmani\.[0-9a-f]{16}\.json$/);
  assert.equal(u.textVersion, '1.1');
  assert.equal(p.manifest.tanzil.texts['ar.jalalayn'].textVersion, 'December 1, 2010');
  const text = await live.load(u.file);
  assert.equal(text.verses.length, Q.VERSES);
  assert.equal(text.verses[0], 'نص-uthmani 1');
  assert.deepEqual(text.notice, NOTICE.split('\n'));
  const ex = await live.load(p.manifest.exegesis.file);
  assert.equal(ex.revision, '1.0');
  assert.deepEqual(ex.rows, [
    { chapter: 1, verseMin: 1, verseMax: 7, url: 'https://example.org/tafsir/1', page: 1 },
    { chapter: 2, verseMin: 1, verseMax: 5, url: 'https://example.org/tafsir/2', page: 3 },
    { chapter: 3, verseMin: 1, verseMax: 9, url: 'https://example.org/tafsir/3', page: 5 }   // from page 2
  ]);
  assert.ok(existsSync(join(live.dir, 'quran', 'manifest.json')));
});

test('same tanzil version and revision: nothing downloaded, nothing changed, files come from the live build', async () => {
  const state = newState();
  const live = await publish(await run(state, nothing));
  const again = newState();
  const p = await run(again, live.load);
  assert.equal(p.changed, false);
  assert.equal(downloads(again), 0);
  assert.equal(again.exegesisReads, 0);
  const next = await publish(p);   // a new build carries the same files
  assert.deepEqual(await next.load('quran/manifest.json'), await live.load('quran/manifest.json'));
  assert.deepEqual(await next.load(p.manifest.tanzil.texts.simple.file), await live.load(p.manifest.tanzil.texts.simple.file));
});

test('a new tanzil version: everything compared, only a text that differs gets a new file', async () => {
  const live = await publish(await run(newState(), nothing));
  const before = (await live.load('quran/manifest.json')).tanzil.texts;
  const state = { ...newState(), version: '1.7.4', words: { uthmani: 'نص-معدل' } };
  const p = await run(state, live.load);
  assert.equal(p.changed, true);
  assert.equal(downloads(state), Q.QURAN_TYPES.length + 2);
  assert.notEqual(p.manifest.tanzil.texts.uthmani.file, before.uthmani.file);
  assert.equal(p.manifest.tanzil.texts.simple.file, before.simple.file);
  assert.equal(p.manifest.tanzil.pageVersion, '1.7.4');
});

test('the quarterly check: the first Friday full run of January, April, July and October downloads again', async () => {
  assert.equal(Q.quarterlyCheck('full', new Date('2026-04-03T01:00:00Z')), true);
  assert.equal(Q.quarterlyCheck('full', new Date('2026-04-10T01:00:00Z')), false);
  assert.equal(Q.quarterlyCheck('links', new Date('2026-04-03T01:00:00Z')), false);
  assert.equal(Q.quarterlyCheck('full', new Date('2026-05-01T01:00:00Z')), false);
  const live = await publish(await run(newState(), nothing));
  const state = newState();
  const p = await run(state, live.load, { now: new Date('2026-04-03T01:00:00Z') });
  assert.equal(downloads(state), Q.QURAN_TYPES.length + 2);
  assert.equal(p.changed, false);   // same texts: nothing to publish
});

test('a new revision: the exegesis index is read again', async () => {
  const live = await publish(await run(newState(), nothing));
  const state = { ...newState(), revision: '1.1' };
  const p = await run(state, live.load);
  assert.equal(state.exegesisReads, 1);
  assert.equal(p.changed, true);
  assert.equal(p.manifest.exegesis.revision, '1.1');
});

test('tanzil down: the live build\'s texts are kept; with none published, left out without stopping the run', async () => {
  const live = await publish(await run(newState(), nothing));
  const p = await run({ ...newState(), tanzilDown: true }, live.load);
  assert.equal(p.changed, false);
  assert.deepEqual(p.manifest.tanzil, (await live.load('quran/manifest.json')).tanzil);
  const first = await run({ ...newState(), tanzilDown: true }, nothing);
  assert.equal(first.manifest.tanzil, null);
  assert.ok(first.manifest.exegesis);
});

test('a text with the wrong number of verses or no copyright block is refused', () => {
  assert.throws(() => Q.parseText('x', `${NOTICE}\n1|1|نص\n`), /1 verses/);
  assert.throws(() => Q.parseText('x', textFile('', 'نص').replace(/^\n/, '')), /no copyright block/);
  assert.equal(Q.parseText('x', textFile(NOTICE, 'نص')).verses.length, Q.VERSES);
});
