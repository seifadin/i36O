// The quran page's reading of tanzil's verse (src/quran/verse.js), the Worker's /i360/exegesis, and
// the built page's content policy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readVerse } from '../src/quran/verse.js';
import { createStore } from '../quran/worker/data.js';
import worker from '../quran/worker/index.js';

const frameWith = (win) => ({ contentWindow: win });

test('readVerse: tanzil\'s curr first, then the title; nothing when neither can be read', () => {
  assert.deepEqual(readVerse(frameWith({ document: { title: 'Ya-Sin [36:1] - Tanzil' }, curr: { sura: 19, aya: 12 } })), { sura: 19, aya: 12, from: 'curr' });
  assert.deepEqual(readVerse(frameWith({ document: { title: 'Ya-Sin [36:12] - Tanzil Quran Navigator' } })), { sura: 36, aya: 12, from: 'title' });
  assert.deepEqual(readVerse(frameWith({ document: { title: 'Maryam [19:5] - Tanzil' }, curr: { sura: '19', aya: 5 } })), { sura: 19, aya: 5, from: 'title' });
  assert.equal(readVerse(frameWith({ document: { title: 'Tanzil - Quran Navigator' } })), null);
  assert.equal(readVerse(frameWith({ document: { title: 'x [200:1]' }, curr: { sura: 0, aya: 1 } })), null);   // out of range
  assert.equal(readVerse(frameWith(null)), null);
  // Another site in the frame (the official embed): reading it throws.
  const foreign = { get document() { throw new DOMException('Blocked', 'SecurityError'); } };
  assert.equal(readVerse(frameWith(foreign)), null);
});

const ROWS = [{ chapter: 1, verseMin: 1, verseMax: 7, url: 'https://example.org/1', page: 1 }];
function lib(state = { file: 'quran/exegesis/a.json' }) {
  const calls = [];
  const libFetch = async (path) => {
    calls.push(path);
    if (path === 'quran/manifest.json') {
      return Response.json({ format: 1, tanzil: { pageVersion: '1.7.3', texts: { simple: { file: 'quran/t/simple.h.json' } } }, exegesis: state.noIndex ? null : { revision: 'r', file: state.file, rows: 1 } });
    }
    if (path.startsWith('quran/exegesis/')) return Response.json({ revision: 'r', rows: ROWS });
    return new Response('not found', { status: 404 });
  };
  return { libFetch, calls, state };
}

test('/i360/exegesis: the index from the lib site, read once per published file', async () => {
  let t = 0;
  const l = lib();
  const s = createStore({ libFetch: l.libFetch, now: () => t });
  assert.deepEqual(await s.exegesis(), ROWS);
  assert.deepEqual(await s.exegesis(), ROWS);
  assert.equal(l.calls.filter((c) => c.startsWith('quran/exegesis/')).length, 1);
  l.state.file = 'quran/exegesis/b.json';   // a new revision published
  t = 10 * 60 * 1000;
  await s.exegesis();
  assert.equal(l.calls.filter((c) => c.startsWith('quran/exegesis/')).length, 2);
  const env = { LIB: { fetch: (req) => l.libFetch(new URL(req.url).pathname.slice(1)) } };
  const res = await worker.fetch(new Request('https://quran.i36o.workers.dev/i360/exegesis'), env);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), ROWS);
  const none = lib({ noIndex: true });
  const missing = await worker.fetch(new Request('https://quran.i36o.workers.dev/i360/exegesis'), { LIB: { fetch: (req) => none.libFetch(new URL(req.url).pathname.slice(1)) } });
  assert.equal(missing.status, 503);
});

test('the built page: only its own address, tanzil\'s banner and frame, and tanzil.net in the frame', () => {
  const html = readFileSync(join(import.meta.dirname, '../quran/site/i360/index.html'), 'utf8');
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /connect-src https:\/\/theme\.i36o\.workers\.dev 'self'/);
  assert.match(csp, /img-src 'self'/);
  assert.match(csp, /frame-src 'self' https:\/\/tanzil\.net/);
  assert.match(html, /<button class="toolbar-btn toolbar-btn-label" type="button" id="btn-exegesis"/);
  assert.match(html, /<img src="\/img\/header\.png"/);
  assert.doesNotMatch(html, /id="btn-close"/);   // opened in the overlay, which has its own close
});
