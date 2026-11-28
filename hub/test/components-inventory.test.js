// The components' inventory (hub/COMPONENTS.md, written by scripts/list-components.js) and the
// catalogue page (tools/catalogue/) are read from the code: these tests keep them complete and current.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inventory, problems, ROWS, OUT } from '../scripts/list-components.js';
import { catalogueHtml } from '../tools/catalogue/build-catalogue.js';

test('components inventory: hub/COMPONENTS.md is up to date (else run `npm run components` in hub/)', () => {
  assert.equal(fs.readFileSync(OUT, 'utf8'), inventory(), 'hub/COMPONENTS.md is out of date: run `npm run components` in hub/');
});

test('components inventory: every placeholder and React twin belongs to a component, and every component has an example', () => {
  assert.deepEqual(problems(), []);
});

test('components catalogue: every shared component is shown, in each of the three themes', () => {
  const html = catalogueHtml();
  for (const row of ROWS) assert.ok(html.includes(`id="c-${row.replace(':', '-')}"`), `${row} missing from the catalogue`);
  for (const theme of ['light', 'sepia', 'dark']) assert.ok(html.includes(`data-theme="${theme}"`), theme);
  assert.doesNotMatch(html, /<!--@@/, 'a placeholder left in the catalogue');
});
