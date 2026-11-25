// scripts/components.js: shared components are written once, by the build — no page writes their
// markup itself, and every built page carries exactly the builder's structure.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { labelButton, writeComponents } from '../scripts/components.js';

const ROOT = path.join(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const BUILT = ['../public/md/index.html', '../public/cse/index.html', '../public/day/index.html', 'quran/site/i360/index.html'];
const LABEL_BUTTON = /<button\b[^>]*\bclass="[^"]*\btoolbar-btn-label\b[^"]*"[^>]*>([\s\S]*?)<\/button>/g;
const SHAPE = /^<svg data-icon="[A-Za-z.]+" data-lucide="[a-z0-9-]+" viewBox="0 0 24 24" aria-hidden="true">[\s\S]*?<\/svg><span\b[^>]*>[^<]+<\/span>$/;
const fakeDraw = (meaning) => `<svg data-icon="${meaning}" data-lucide="x" viewBox="0 0 24 24" aria-hidden="true"><path></path></svg>`;

test('components: no page writes a label button itself — each names <!--@@LABEL_BUTTON …@@-->', () => {
  for (const page of fs.readdirSync(SRC).filter((f) => f.endsWith('.src.html'))) {
    const html = fs.readFileSync(path.join(SRC, page), 'utf8');
    assert.equal([...html.matchAll(LABEL_BUTTON)].length, 0, `${page}: a hand-written label button (use <!--@@LABEL_BUTTON …@@-->)`);
  }
});

test('components: every built page\'s label buttons are the icon\'s <svg> then the label, both directly in the button', () => {
  let found = 0;
  for (const rel of BUILT) {
    for (const m of fs.readFileSync(path.join(ROOT, rel), 'utf8').matchAll(LABEL_BUTTON)) {
      found++;
      assert.match(m[1], SHAPE, `${rel}: ${m[0].slice(0, 120)}`);
    }
  }
  assert.ok(found >= 2, 'the Reader\'s and the quran page\'s label buttons are found');
});

test('components: LABEL_BUTTON is written with its id, icon, label, label id and disabled; text escaped', () => {
  assert.equal(labelButton({ id: 'b', icon: 'exegesis', label: 'تفسير <و>', labelId: 'l', disabled: true }, fakeDraw),
    '<button class="toolbar-btn toolbar-btn-label" id="b" type="button" disabled><svg data-icon="exegesis" data-lucide="x" viewBox="0 0 24 24" aria-hidden="true"><path></path></svg><span id="l">تفسير &lt;و></span></button>');
  assert.equal(writeComponents('<p><!--@@LABEL_BUTTON id="b" icon="openFile" label="Open file"@@--></p>', fakeDraw),
    '<p><button class="toolbar-btn toolbar-btn-label" id="b" type="button"><svg data-icon="openFile" data-lucide="x" viewBox="0 0 24 24" aria-hidden="true"><path></path></svg><span>Open file</span></button></p>');
});

test('components: build placeholders are left for build.js; an unknown component, missing fields or an unknown meaning stop the build', () => {
  assert.equal(writeComponents('<head><!--@@CSP@@--></head>', fakeDraw), '<head><!--@@CSP@@--></head>');
  assert.throws(() => writeComponents('<!--@@LABEL_BUTON id="b" icon="x" label="y"@@-->', fakeDraw), /unknown component/);
  assert.throws(() => writeComponents('<!--@@LABEL_BUTTON id="b" label="y"@@-->', fakeDraw), /needs id, icon and label/);
  assert.throws(() => writeComponents('<!--@@LABEL_BUTTON id="b" icon="noSuchMeaning" label="y"@@-->'), /not a meaning in src\/icons\.js/);
});

test('components: page-chrome.css has every comment closed, and the label button\'s rule is live (not inside a comment)', () => {
  const css = fs.readFileSync(path.join(SRC, 'page-chrome.css'), 'utf8');
  assert.equal((css.match(/\/\*/g) || []).length, (css.match(/\*\//g) || []).length, 'a comment is never closed');
  assert.match(css.replace(/\/\*[\s\S]*?\*\//g, ''), /\.toolbar-btn-label\s*\{/, '.toolbar-btn-label { … } is missing or commented out');
});
