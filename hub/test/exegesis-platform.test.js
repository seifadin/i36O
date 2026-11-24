// src/exegesis.js and src/platform.js: shared by the i360إ app, the quran page and the indexer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exegesisRows, findExegesisUrl } from '../src/exegesis.js';
import { detectOS, isDesktop } from '../src/platform.js';

const BASEROW = [
  { QuranChapter: '1', QuranVerseMin: '1', QuranVerseMax: 7, ExegesisURL: ' https://example.org/1 ', ExegesisPage: '2' },
  { QuranChapter: 2, QuranVerseMin: 1, QuranVerseMax: 5, ExegesisURL: '', ExegesisPage: 3 },          // no address: left out
  { QuranChapter: 2, QuranVerseMin: 1, QuranVerseMax: 141, ExegesisURL: 'https://example.org/2a', ExegesisPage: null },
  { QuranChapter: 2, QuranVerseMin: 142, QuranVerseMax: 286, ExegesisURL: 'https://example.org/2b', ExegesisPage: 9 },
  { QuranChapter: 3, QuranVerseMin: 9, QuranVerseMax: 2, ExegesisURL: 'https://example.org/bad' }      // a backwards range: left out
];

test('exegesisRows: numbers as numbers, addresses trimmed, unusable rows left out', () => {
  assert.deepEqual(exegesisRows(BASEROW), [
    { chapter: 1, verseMin: 1, verseMax: 7, url: 'https://example.org/1', page: 2 },
    { chapter: 2, verseMin: 1, verseMax: 141, url: 'https://example.org/2a', page: null },
    { chapter: 2, verseMin: 142, verseMax: 286, url: 'https://example.org/2b', page: 9 }
  ]);
});

test('findExegesisUrl: the first row holding the verse; none for a verse outside every range', () => {
  const rows = exegesisRows(BASEROW);
  assert.equal(findExegesisUrl(rows, 1, 7), 'https://example.org/1');
  assert.equal(findExegesisUrl(rows, 2, 141), 'https://example.org/2a');
  assert.equal(findExegesisUrl(rows, 2, 142), 'https://example.org/2b');
  assert.equal(findExegesisUrl(rows, 2, 5), 'https://example.org/2a');   // the empty-address row is gone
  assert.equal(findExegesisUrl(rows, 1, 8), null);
  assert.equal(findExegesisUrl(rows, 3, 5), null);
});

test('detectOS / isDesktop: by user agent, as the app decided before', () => {
  assert.equal(detectOS('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'ios');
  assert.equal(detectOS('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'ios');
  assert.equal(detectOS('Mozilla/5.0 (Linux; Android 14; Pixel 7) Mobile'), 'android');
  assert.equal(detectOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/158.0'), 'web');
  assert.equal(isDesktop('Mozilla/5.0 (Linux; Android 14; Pixel 7) Mobile'), false);
  assert.equal(isDesktop('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)'), true);
});
