// indexer/science-icons.js: the quarterly report of science icons named in Baserow.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as ScienceIcons from '../indexer/science-icons.js';

const INDEX = [
  "export { default as BookBookmark, default as BookMarked } from './icons/book-bookmark.mjs';",
  "export { default as Minimize2 } from './icons/minimize-2.mjs';",
  "export { default as Search } from './icons/search.mjs';",
].join('\n');

test('science icons: every name Lucide answers maps to its icon\'s current name', () => {
  const names = ScienceIcons.lucideNames(INDEX);
  assert.equal(names.get('BookMarked'), 'BookBookmark');
  assert.equal(names.get('BookBookmark'), 'BookBookmark');
  assert.equal(names.get('Minimize2'), 'Minimize2');
  assert.equal(names.get('Nope'), undefined);
});

test('science icons: old and unknown names are reported once, with the sciences using them; current names are not', () => {
  const rows = [
    { id: 1, ScienceMajorIcon: 'Search', ScienceMajor_Ar: 'أ', ScienceIntermediateIcon: 'BookMarked', ScienceIntermediate_Ar: 'ب', ScienceMinorIcon: '', ScienceMinor_Ar: 'ج' },
    { id: 2, ScienceMajorIcon: 'Search', ScienceMajor_Ar: 'أ', ScienceIntermediateIcon: '', ScienceMinorIcon: 'BookMarked', ScienceMinor_Ar: 'د' },
    { id: 3, ScienceMinorIcon: ' Typo ', ScienceMinor_Ar: '' },
  ];
  assert.deepEqual(ScienceIcons.checkIcons(rows, ScienceIcons.lucideNames(INDEX)), [
    { name: 'BookMarked', current: 'BookBookmark', sciences: ['ب', 'د'] },
    { name: 'Typo', current: null, sciences: ['row 3'] },
  ]);
  assert.deepEqual(ScienceIcons.describe([]), ['Science icons: every name is current.']);
  assert.match(ScienceIcons.describe(ScienceIcons.checkIcons(rows, ScienceIcons.lucideNames(INDEX))).join('\n'), /BookMarked → BookBookmark — ب، د\n {2}Typo → \(not a Lucide icon\)/);
});

test('science icons: the installed Lucide is read (old names included)', () => {
  const names = ScienceIcons.lucideNames();
  assert.equal(names.get('BookMarked'), 'BookBookmark');
  assert.equal(names.get('History'), 'RotateCcwClock');
  assert.equal(names.get('ScrollText'), 'ScrollText');
});
