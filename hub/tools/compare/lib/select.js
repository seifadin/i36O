// Which comparison scripts a change needs, and on which pages (used by run.js).
// The hub pages are judged by what the scripts actually test, their built files: a page whose
// public/<page>/index.html is byte-identical in the two versions needs no check, whatever changed
// in hub/src. The app is judged by its inputs: every file outside hub/ that its web build can read
// (all of them but NOT_APP), and the hub files it imports (run.js finds them by following imports).
// The theme site is read live by every page and the app, so a change there checks everything.

export const PAGES = ['reader', 'cse', 'day', 'app'];
export const BUILT = { reader: 'public/md/index.html', cse: 'public/cse/index.html', day: 'public/day/index.html' };

// Each script and the pages it can check (--pages narrows the last three); longest first, so two
// at a time finish sooner.
export const SCRIPTS = {
  'sweep.js': PAGES,
  'pixels.js': PAGES,
  'reader-steps.js': ['reader'],
  'safe-area.js': PAGES,
  'app-sizes.js': ['app'],
  'day-steps.js': ['day'],
  'cse-steps.js': ['cse']
};
// The scripts that take --pages.
export const MULTI = new Set(Object.keys(SCRIPTS).filter((s) => SCRIPTS[s].length > 1));

// Files outside hub/ that the app's web build never reads; every other file outside hub/ counts
// for the app, so a new kind of file is checked rather than skipped.
const NOT_APP = [
  /^android\//, /^ios\//, /^scripts\//, /^\.github\//, /^public\/(md|cse|day)\//,
  /\.md$/, /\.test\.ts$/, /^\.gitignore$/, /^\.env\.example$/, /^\.firebaserc$/, /^firebase\.json$/,
  /^capacitor\.config\.ts$/, /^eslint\.config\.js$/
];
// Only the Reader's screens in pixels.js and safe-area.js open it.
const DISPLAY_TEST = 'hub/library/books/display-test.md';
const TOOLS = 'hub/tools/compare/';

// changed: the files that differ between the two versions; builtDiffers: { reader, cse, day } →
// whether that page's built file differs; appHub: the hub files the app's build reads (a Set).
// Returns { run: [{ script, pages, whole }], why: Map(page → reasons) }; whole: the file whose change
// makes a script run on all its pages (the script itself, or lib/).
export function select({ changed, builtDiffers, appHub }) {
  const why = new Map();
  const add = (page, reason) => { if (!why.has(page)) why.set(page, []); why.get(page).push(reason); };
  const whole = new Map();   // a script that changed itself runs on all its pages
  for (const [page, differs] of Object.entries(builtDiffers)) if (differs) add(page, `${BUILT[page]} differs`);
  for (const f of changed) {
    if (f.startsWith(TOOLS)) {
      const name = f.slice(TOOLS.length);
      if (SCRIPTS[name]) whole.set(name, f);
      else if (name.startsWith('lib/')) for (const s of Object.keys(SCRIPTS)) if (!whole.has(s)) whole.set(s, f);
      continue;                                     // the README: nothing to check
    }
    if (f.startsWith('hub/theme/site/')) { for (const p of PAGES) add(p, f); continue; }
    if (f === DISPLAY_TEST) { add('reader', f); continue; }
    if (f.startsWith('hub/')) { if (appHub.has(f)) add('app', f); continue; }   // the pages: by their built files, above
    if (!NOT_APP.some((r) => r.test(f))) add('app', f);
  }
  const run = [];
  for (const [script, can] of Object.entries(SCRIPTS)) {
    const pages = whole.has(script) ? can : can.filter((p) => why.has(p));
    if (pages.length) run.push({ script, pages, whole: whole.get(script) || null });
  }
  return { run, why };
}

// Everything, for --all.
export const everything = () => ({ run: Object.entries(SCRIPTS).map(([script, pages]) => ({ script, pages, whole: null })), why: new Map([['all', ['--all']]]) });
