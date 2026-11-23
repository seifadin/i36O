// Every i360 address the code needs, in one place: the app's site, the sites that only forward
// to it, where they kept our books, and the lib and theme sites. Read by the hub pages, the
// CSE indexer, vite.config.ts and the i360إ app (imported as '@i360/sites'; types from the JSDoc).
// hub/firebase.json holds the forwarders' own redirect rules (Firebase reads it as plain JSON);
// test/sites.test.js checks it against this file, so the two can't drift apart.
// The Hijri files (hijri/client.js, served alone) keep their Worker's address themselves.

/** The app's site (since 2026-10-23), with the side tools at /day/, /md/ and /cse/. */
export const APP_HOST = 'i36o.web.app';
export const APP_ORIGIN = `https://${APP_HOST}`;

/** Sites that forward every path to the same path on the app's site: the app's address until
 * 2026-10-23, and the hub's (2026-10-17 → 2026-10-23). */
export const SITE_FORWARDERS = Object.freeze(['i360-e.web.app', 'i360-hub.web.app']);

/** Sites of a single tool, forwarding to that tool's folder on the app's site. */
export const TOOL_FORWARDERS = Object.freeze({ 'i360-day.web.app': 'day', 'i360-md.web.app': 'md', 'i360-cse.web.app': 'cse' });

/** Where an address once kept our books, now read from the lib site (lib-copy.js ownBook()). */
export const OLD_BOOK_PATHS = Object.freeze({
  [APP_HOST]: '/md/books/',
  ...Object.fromEntries(SITE_FORWARDERS.map((host) => [host, '/md/books/'])),
  'i360-md.web.app': '/books/'
});

/** The lib site: the CSE's data and our own books (indexer/wrangler.jsonc). */
export const LIB_HOST = 'lib.i36o.workers.dev';
export const LIB = `https://${LIB_HOST}/`;

/** The shared theme site (theme/wrangler.jsonc). */
export const THEME_ORIGIN = 'https://theme.i36o.workers.dev';

/** Tanzil (tanzil.net): the Quran Navigator the quran Worker serves, and the source of the Quran
 * texts and translations the CSE workflow publishes on the lib site (indexer/quran-data.js). */
export const TANZIL_ORIGIN = 'https://tanzil.net';
