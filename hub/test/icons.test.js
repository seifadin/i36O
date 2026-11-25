// scripts/icons.js: every page icon is keyed by its meaning (src/icons.js) and drawn as the pinned
// Lucide draws it, nothing is left of Font Awesome, and the app and the hub pin the same Lucide.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import * as icons from '../scripts/icons.js';

const ROOT = path.join(import.meta.dirname, '..');
const FAKE = { x: [['path', { d: 'M18 6 6 18' }], ['path', { d: 'm6 6 12 12' }]], plus: [['path', { d: 'M5 12h14' }]] };
const X = '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>';
const PLUS = '<path d="M5 12h14"></path>';
const MEANINGS = { close: 'x', add: 'plus', theme: { dark: 'x' } };

test('icons: every page icon has a meaning and is drawn exactly as the pinned Lucide draws its icon', () => {
  for (const rel of icons.PAGES) {
    const problems = icons.check(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    assert.deepEqual(problems, [], `${rel}: ${problems.map(p => `line ${p.line}: ${p.problem}`).join('; ')} (fix: node scripts/icons.js --write)`);
  }
});

test('icons: the installed Lucide is the version package-lock.json pins', () => {
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')).packages['node_modules/lucide-static'].version, icons.version());
});

test('icons: the app (lucide-react) and the hub (lucide-static) pin the same Lucide, exactly', () => {
  // Read as files, so this runs where only the hub's packages are installed (the CSE index workflow).
  const hub = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).devDependencies['lucide-static'];
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'package.json'), 'utf8')).dependencies['lucide-react'];
  assert.match(hub, /^\d+\.\d+\.\d+$/, `hub/package.json: lucide-static "${hub}" is not an exact version (fix: npm run lucide -- <version>)`);
  assert.equal(app, hub, `package.json: lucide-react "${app}" ≠ hub/package.json: lucide-static "${hub}" (fix: npm run lucide -- <version>)`);
});

test('icons: a missing or unknown meaning, a name other than its meaning\'s, an unknown, visible or changed icon and Font Awesome are each reported', () => {
  const page = [
    `<svg data-icon="close" data-lucide="x" viewBox="0 0 24 24" aria-hidden="true">${X}</svg>`,
    `<svg data-icon="theme.dark" data-lucide="x" aria-hidden="true">${X}</svg>`,
    `<svg data-lucide="x" viewBox="0 0 24 24" aria-hidden="true">${X}</svg>`,
    `<svg data-icon="nope" data-lucide="x" aria-hidden="true">${X}</svg>`,
    `<svg data-icon="close" data-lucide="plus" aria-hidden="true">${PLUS}</svg>`,
    '<svg data-icon="add" data-lucide="no-such-icon" aria-hidden="true"></svg>',
    '<svg data-icon="close" data-lucide="x" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line></svg>',
    `<svg data-icon="close" data-lucide="x">${X}</svg>`,
    '<i class="fas fa-clock"></i>'
  ].join('\n');
  assert.deepEqual(icons.check(page, FAKE, MEANINGS).map(p => p.line), [3, 4, 5, 6, 7, 8, 9]);
  assert.equal(icons.check(page, FAKE, MEANINGS)[5].problem, '"close" is not hidden from screen readers (aria-hidden="true")');
  assert.match(icons.check(`<svg data-icon="close" data-lucide="x" viewBox="0 0 24 24" aria-hidden="true" stroke="red">${X}</svg>`, FAKE, MEANINGS)[0].problem, /carries attributes of its own/);
  assert.deepEqual(icons.check(`<svg data-icon="close" data-lucide="x" class="icon-inline" viewBox="0 0 24 24" aria-hidden="true">${X}</svg>`, FAKE, MEANINGS), []);
  assert.equal(icons.check(`<svg data-icon="add" data-lucide="plus" aria-hidden="true">${PLUS}</svg>`, { x: FAKE.x }, MEANINGS)[0].problem, '"plus" is not a Lucide icon');
  assert.equal(icons.check('<link href="…/font-awesome/6.0.0/css/all.min.css">', FAKE, MEANINGS).length, 1);
});

test('icons: --write sets the name from the meaning, hides it from screen readers and redraws, keeps the page\'s own attributes, leaves unknown meanings', () => {
  const page = '<svg data-icon="close" data-lucide="plus" class="icon" aria-hidden="true"><line x1="1"></line></svg> <svg data-icon="add" class="icon"></svg> <svg data-icon="nope" data-lucide="x"><b></b></svg>';
  assert.equal(icons.write(page, FAKE, MEANINGS),
    `<svg data-icon="close" data-lucide="x" class="icon" aria-hidden="true">${X}</svg> <svg data-icon="add" data-lucide="plus" class="icon" aria-hidden="true">${PLUS}</svg> <svg data-icon="nope" data-lucide="x"><b></b></svg>`);
});

test('icons: svgFor draws an icon whole from its meaning; an unknown meaning or icon throws', () => {
  assert.equal(icons.svgFor('close', FAKE, MEANINGS), `<svg data-icon="close" data-lucide="x" viewBox="0 0 24 24" aria-hidden="true">${X}</svg>`);
  assert.throws(() => icons.svgFor('nope', FAKE, MEANINGS), /not a meaning/);
  assert.throws(() => icons.svgFor('add', { x: FAKE.x }, MEANINGS), /is not a Lucide/);
});
