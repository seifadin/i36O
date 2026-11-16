// Test material, made on the fly (always the same: a fixed seed), so nothing large is kept in git.
//   books()    two long books for the Reader: Arabic with «[ص N]» page marks (40 pages, a chapter
//              every 8; every fifth page also has a Qur'an quote, a footnote and a table) and English
//              with ==Start pN== / ==End pN== marks (30 pages, a chapter every 6)
//   linked()   the lib site's /books/ folder for books opened by link (?file=…), where page links
//              (#p=…) work: the two books, a two-volume book ([ج N ص X], 12 pages each), a book whose
//              front matter is lettered ([ص أ] … [ص ج], then [ص 1] … [ص 6]) and a plain Markdown book
//   library()  a small CSE library written with this working copy's own indexer: three majors,
//              with and without intermediates, six books, enough hits for «more»
// The display test (every element the Reader draws: Quran, footnotes, tables, code…) is the repo's
// own hub/library/books/display-test.md.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { REPO } from './versions.js';

const DIR = join(tmpdir(), 'i360-compare', 'fixtures-2');   // a new name when the fixtures change
export const DISPLAY_TEST = join(REPO, 'hub/library/books/display-test.md');

function random(seed) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
}
const paragraph = (r, words, n) => Array.from({ length: n }, () => words[Math.floor(r() * words.length)]).join(' ');

export function books() {
  const ar = join(DIR, 'book.md'), en = join(DIR, 'book-en.md');
  if (existsSync(ar) && existsSync(en)) return { ar, en };
  mkdirSync(DIR, { recursive: true });
  const r = random(7);
  const AR = ['الحمد', 'لله', 'العلم', 'نور', 'الشيخ', 'قال', 'كتاب', 'باب', 'فصل', 'مسألة'];
  const EN = ['the', 'praise', 'knowledge', 'light', 'scholar', 'said', 'book', 'chapter', 'section', 'question'];
  let a = '';
  // The Reader's own elements (as the OCR engine exports them): a Qur'an quote, a footnote marker
  // glued to its word with the note below the page's last ---, a table.
  const extras = (p) => `﴿وُجُوهٌ يَوْمَئِذٍ نَاضِرَةٌ (22) إِلَىٰ رَبِّهَا نَاظِرَةٌ (23)﴾ [القيامة: 22–23] وفيه بيان(1) للمسألة.\n\n` +
    `| المسألة | الحكم |\n| --- | --- |\n| الصلاة ${p} | واجبة |\n\n---\n(1) حاشية الصفحة ${p}.\n\n`;
  for (let p = 1; p <= 40; p++) a += `[ص ${p}]\n${p % 8 === 1 ? `\n# باب ${p}\n\n` : ''}${paragraph(r, AR, 120 + Math.floor(r() * 40))}\n\n${p % 5 === 0 ? extras(p) : ''}`;
  let e = '';
  for (let p = 1; p <= 30; p++) e += `==Start p${p}==\n${p % 6 === 1 ? `\n# Chapter ${p}\n\n` : ''}${paragraph(r, EN, 150 + Math.floor(r() * 40))}\n==End p${p}==\n\n`;
  writeFileSync(ar, a);
  writeFileSync(en, e);
  return { ar, en };
}

export function linked() {
  const root = join(DIR, 'linked'), dir = join(root, 'books');
  if (existsSync(join(dir, 'letters.md'))) return root;
  mkdirSync(dir, { recursive: true });
  const b = books();
  copyFileSync(b.ar, join(dir, 'ar.md'));
  copyFileSync(b.en, join(dir, 'en.md'));
  let vol = '';
  for (const v of [1, 2]) for (let p = 1; p <= 12; p++) vol += `[ج ${v} ص ${p}]\n\nالجزء ${v} الصفحة ${p} ${'نص '.repeat(150)}\n\n`;
  writeFileSync(join(dir, 'vol.md'), vol);
  const letters = ['أ', 'ب', 'ج', '1', '2', '3', '4', '5', '6'];
  writeFileSync(join(dir, 'letters.md'), letters.map((l) => `[ص ${l}]\n\nالصفحة ${l} ${'نص '.repeat(150)}\n\n`).join(''));
  writeFileSync(join(dir, 'plain.md'), `# كتاب\n\n${'نص بلا علامات صفحات. '.repeat(400)}`);
  return root;
}

export async function library() {
  const out = join(DIR, 'lib');
  if (existsSync(join(out, 'latest.json'))) return out;
  const { writeBuild } = await import(join(REPO, 'hub/indexer/index-writer.js'));
  const r = random(11);
  const WORDS = ['الحمد', 'لله', 'رَبِّ', 'العالمين', 'الرحمن', 'الرحيم', 'مالك', 'يوم', 'الدين', 'العلم', 'والعلماء', 'علم', 'مسألة', 'رحمة', 'قال', 'الإمام', 'في', 'كتاب', 'الصلاة', 'الزكاة'];
  const MAJORS = ['العقيدة', 'الفقه', 'الحديث وعلومه'];
  const homes = [['العقيدة', '', 'كتاب التوحيد'], ['العقيدة', 'أصول الدين', 'شرح الأصول'], ['الفقه', 'فقه العبادات', 'كتاب الصلاة'],
    ['الفقه', 'فقه المعاملات', 'كتاب البيوع'], ['الحديث وعلومه', '', 'الأربعون'], ['الحديث وعلومه', '', 'رياض الصالحين']];
  const sources = homes.map(([major, intermediate, minor], s) => {
    const pages = Array.from({ length: 12 + s * 3 }, (_, p) => ({
      label: String(p + 1), vol: s === 3 ? 2 : null,
      paras: Array.from({ length: 2 + (p % 3) }, () => paragraph(r, WORDS, 12 + Math.floor(r() * 30)))
    }));
    return {
      id: `archive:item${s}/book${s}_djvu.txt`, url: `https://archive.org/stream/item${s}/book${s}_djvu.txt`, links: [], type: 'djvu-txt',
      usedBy: [{ rowId: s + 1, major, intermediate, minor, majorId: String(MAJORS.indexOf(major) + 1), intermediateId: intermediate ? String(10 + s) : '', minorId: String(100 + s) }],
      pages, loadPages: async () => pages
    };
  });
  await writeBuild({ sources, outDir: out, buildId: 'v1', passes: 3, chunkBytes: 4000 });
  return out;
}
