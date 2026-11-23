// The quran Worker (quran/worker/): tanzil's two data scripts answered from the lib site's files,
// in the formats tanzil's page reads, the memory cap, /i360/health and the pass-through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../quran/worker/data.js';
import worker from '../quran/worker/index.js';

const N = 6236;
const fill = (word, set = {}) => Array.from({ length: N }, (_, i) => (i in set ? set[i] : `${word} ${i}`));
// The search text: a few verses with known words; 25 verses with «نور» for paging.
const SIMPLE = fill('نص', {
  0: 'بسم الله الرحمن الرحيم', 1: 'الحمد لله رب العالمين', 5: 'الله الصمد',
  10: 'قال موسى', 11: 'قال عيسى', 12: 'رب موسى و رب هارون',
  ...Object.fromEntries(Array.from({ length: 25 }, (_, k) => [100 + k, 'نور على نور']))
});
const TEXTS = {
  simple: SIMPLE,
  uthmani: fill('عثماني', { 0: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ' }),
  'ar.jalalayn': fill('تفسير', { 5: '«الله الصمد» مبتدأ وخبر: أي المقصود' })
};
for (const id of ['a.one', 'b.two', 'c.three', 'd.four']) TEXTS[id] = fill(id);

function lib(state = {}) {
  const manifest = () => ({
    format: 1,
    tanzil: { pageVersion: state.pageVersion || '1.7.3', texts: Object.fromEntries(Object.keys(TEXTS).map((id) => [id, { file: `quran/t/${id}.h.json`, hash: 'h' }])) },
    exegesis: { revision: '2025-03-30', file: 'quran/exegesis/x.json', rows: 1 }
  });
  const calls = [];
  const libFetch = async (path) => {
    calls.push(path);
    if (state.down) return new Response('down', { status: 500 });
    if (path === 'quran/manifest.json') return Response.json(manifest());
    const m = path.match(/^quran\/t\/(.+)\.h\.json$/);
    if (m && TEXTS[m[1]]) return Response.json({ id: m[1], verses: TEXTS[m[1]] });
    return new Response('not found', { status: 404 });
  };
  return { libFetch, calls, state };
}
const form = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, typeof v === 'string' ? v : JSON.stringify(v)); return f; };
const ask = (pattern, extra = {}) => form({ type: 'simple', searchText: 'x', pattern, transType: '', pageOffset: '1', resultsPerPage: '10', ...extra });

test('get-aya: verses by range for each text, as tanzil serves them; a text not published gives none', async () => {
  const s = createStore({ libFetch: lib().libFetch });
  const out = JSON.parse(await s.getAya(form({ texts: [{ textID: 'uthmani', start: 0, end: 2 }, { textID: 'ar.jalalayn', start: 5, end: 6 }, { textID: 'en.asad', start: 0, end: 2 }], version: '1.7.3' })));
  assert.deepEqual(out, {
    uthmani: { 0: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ\n', 1: 'عثماني 1\n' },
    'ar.jalalayn': { 5: '«الله الصمد» مبتدأ وخبر: أي المقصود\n' },
    'en.asad': {}
  });
  const end = JSON.parse(await s.getAya(form({ texts: [{ textID: 'simple', start: 6230, end: 9999 }] })));
  assert.deepEqual(Object.keys(end.simple), ['6230', '6231', '6232', '6233', '6234', '6235']);
});

test('search: one word, all words (+), excluding (!), either (|), a phrase, counts of verses and matches', async () => {
  const s = createStore({ libFetch: lib().libFetch });
  assert.equal(await s.search(ask('الصمد')), '1:1|5:الله الصمد:\n');
  assert.equal(await s.search(ask('رب')), '2:3|1:الحمد لله رب العالمين:\n12:رب موسى و رب هارون:\n');
  assert.equal(await s.search(ask('رب+موسى')), '1:3|12:رب موسى و رب هارون:\n');
  assert.equal(await s.search(ask('قال!عيسى')), '1:1|10:قال موسى:\n');
  assert.equal(await s.search(ask('موسى|عيسى')), '3:3|10:قال موسى:\n11:قال عيسى:\n12:رب موسى و رب هارون:\n');
  // A phrase pattern needs a space before it: each verse is searched with one added at both ends.
  assert.equal(await s.search(ask('\\sرب\\s')), '2:3|1:الحمد لله رب العالمين:\n12:رب موسى و رب هارون:\n');
});

test('search: pages of results, the translation beside each (its ":" as "↕"), root search and a broken pattern', async () => {
  const s = createStore({ libFetch: lib().libFetch });
  const page2 = await s.search(ask('نور', { pageOffset: '2' }));
  assert.equal(page2.split('|')[0], '25:50');
  assert.deepEqual(page2.split('|')[1].trim().split('\n').map((l) => l.split(':')[0]), Array.from({ length: 10 }, (_, k) => String(110 + k)));
  assert.equal(await s.search(ask('الصمد', { transType: 'ar.jalalayn' })), '1:1|5:الله الصمد:«الله الصمد» مبتدأ وخبر↕ أي المقصود\n');
  assert.equal(await s.search(form({ pattern: 'Root صمد', type: 'simple' })), '0:0|');
  assert.equal(await s.search(ask('(')), '0:0|');
});

test('memory: the search text plus the most recently used others, up to the cap', async () => {
  const s = createStore({ libFetch: lib().libFetch, keep: 3 });
  for (const id of ['simple', 'a.one', 'b.two', 'c.three']) await s.getAya(form({ texts: [{ textID: id, start: 0, end: 1 }] }));
  assert.deepEqual(s.kept().sort(), ['quran/t/b.two.h.json', 'quran/t/c.three.h.json', 'quran/t/simple.h.json']);
  await s.getAya(form({ texts: [{ textID: 'b.two', start: 0, end: 1 }] }));   // used again: now the most recent
  await s.getAya(form({ texts: [{ textID: 'd.four', start: 0, end: 1 }] }));
  assert.deepEqual(s.kept().sort(), ['quran/t/b.two.h.json', 'quran/t/d.four.h.json', 'quran/t/simple.h.json']);
});

test('the manifest is read again after a few minutes, not on every request', async () => {
  let t = 0;
  const l = lib();
  const s = createStore({ libFetch: l.libFetch, now: () => t });
  assert.equal((await s.health()).pageVersion, '1.7.3');
  l.state.pageVersion = '1.7.4';
  t = 60 * 1000;
  assert.equal((await s.health()).pageVersion, '1.7.3');
  t = 6 * 60 * 1000;
  assert.equal((await s.health()).pageVersion, '1.7.4');
  assert.equal(l.calls.filter((c) => c === 'quran/manifest.json').length, 2);
});

test('the Worker: health 200 when the lib site answers, 503 when not; data scripts answered here', async () => {
  const l = lib();
  const env = { LIB: { fetch: (req) => l.libFetch(new URL(req.url).pathname.slice(1)) } };
  const ok = await worker.fetch(new Request('https://quran.i36o.workers.dev/i360/health'), env);
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, pageVersion: '1.7.3', texts: Object.keys(TEXTS).length, exegesis: '2025-03-30' });
  const aya = await worker.fetch(new Request('https://quran.i36o.workers.dev/php/get-aya.php', { method: 'POST', body: form({ texts: [{ textID: 'simple', start: 5, end: 6 }] }) }), env);
  assert.deepEqual(await aya.json(), { simple: { 5: 'الله الصمد\n' } });
  const down = { LIB: { fetch: async () => new Response('down', { status: 500 }) } };
  const bad = await worker.fetch(new Request('https://quran.i36o.workers.dev/i360/health'), down);
  assert.equal(bad.status, 503);
  assert.equal((await bad.json()).ok, false);
  const failed = await worker.fetch(new Request('https://quran.i36o.workers.dev/php/search.php', { method: 'POST', body: ask('رب') }), down);
  assert.equal(failed.status, 503);
});

test('the Worker: anything else goes to tanzil.net unchanged; a redirect to tanzil.net stays on this address', async (t) => {
  const seen = [];
  t.mock.method(globalThis, 'fetch', async (req) => {
    seen.push(req.url);
    if (req.url === 'https://tanzil.net/old') return new Response(null, { status: 301, headers: { Location: 'https://tanzil.net/new?x=1' } });
    return new Response('<html>tanzil</html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
  });
  const env = { LIB: { fetch: lib().libFetch } };
  const page = await worker.fetch(new Request('https://quran.i36o.workers.dev/?embed=true&defTrans=ar.jalalayn'), env);
  assert.equal(await page.text(), '<html>tanzil</html>');
  assert.equal(seen[0], 'https://tanzil.net/?embed=true&defTrans=ar.jalalayn');
  const moved = await worker.fetch(new Request('https://quran.i36o.workers.dev/old'), env);
  assert.equal(moved.status, 301);
  assert.equal(moved.headers.get('Location'), '/new?x=1');
});
