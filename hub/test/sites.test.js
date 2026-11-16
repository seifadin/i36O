// hub/firebase.json (the forwarders' redirect rules, read by Firebase as plain JSON) must say what
// src/sites.js says, so the two can't drift apart: every forwarding site there is listed here and
// the other way round, each forwards to the right place on the app's site, and each old book
// path goes to the lib site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ORIGIN, LIB, OLD_BOOK_PATHS, SITE_FORWARDERS, TOOL_FORWARDERS } from '../src/sites.js';

const read = (name) => JSON.parse(readFileSync(join(import.meta.dirname, '..', name), 'utf8'));

// { 'i360-md.web.app': [{ from, to }…] } — each hosting target's site, from .firebaserc.
function forwarders() {
  const sites = {};
  for (const project of Object.values(read('.firebaserc').targets)) {
    for (const [target, ids] of Object.entries(project.hosting)) sites[target] = ids;
  }
  const out = {};
  for (const h of read('firebase.json').hosting) {
    const [id] = sites[h.target] || [];
    assert.ok(id, `firebase.json target "${h.target}" has no site in .firebaserc`);
    out[`${id}.web.app`] = (h.redirects || []).map((r) => ({ from: r.source || r.regex, to: r.destination, type: r.type }));
  }
  return out;
}

test('every forwarding site in firebase.json is in src/sites.js, and every one there is in firebase.json', () => {
  const inFirebase = Object.keys(forwarders()).sort();
  const inSites = [...SITE_FORWARDERS, ...Object.keys(TOOL_FORWARDERS)].sort();
  assert.deepEqual(inFirebase, inSites);
});

test("each forwarder sends its paths to the right place on the app's site, permanently", () => {
  for (const [host, rules] of Object.entries(forwarders())) {
    const base = TOOL_FORWARDERS[host] ? `${APP_ORIGIN}/${TOOL_FORWARDERS[host]}/` : `${APP_ORIGIN}/`;
    const home = rules.find((r) => r.from === '/');
    const rest = rules.find((r) => r.from === '^/(.+)$');
    assert.equal(home && home.to, base, `${host}: / should go to ${base}`);
    assert.equal(rest && rest.to, `${base}:1`, `${host}: every other path should go to ${base}…`);
    for (const r of rules) assert.equal(r.type, 301, `${host}: ${r.from} should be a 301`);
  }
});

test('the old book paths in firebase.json are the ones in src/sites.js, and go to the lib site', () => {
  for (const [host, rules] of Object.entries(forwarders())) {
    const books = rules.filter((r) => r.to.startsWith(LIB));
    const path = OLD_BOOK_PATHS[host];
    if (!path) { assert.equal(books.length, 0, `${host}: forwards books, but src/sites.js lists no book path for it`); continue; }
    assert.equal(books.length, 1, `${host}: should forward ${path} to the lib site`);
    assert.equal(books[0].from, `^${path}(.+)$`);
    assert.equal(books[0].to, `${LIB}books/:1`);
  }
});
