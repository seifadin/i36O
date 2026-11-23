// The pre-push hook publishes a hub Worker again when a file it uses changes
// (scripts/hub-workers-pattern.sh). A Worker uses its own folder, the hub/src files its site
// serves through a link, and — the Hijri and quran Workers — the files its code bundles. Each of them must be
// covered by its pattern, or a change to it would leave the live Worker behind (§15az).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, realpathSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as esbuild from 'esbuild';
import { REPO } from '../scripts/app-inputs.js';

const rel = (p) => relative(REPO, realpathSync(p));

// Every file under a folder, links followed to the file they name.
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return statSync(p).isDirectory() ? files(p) : [rel(p)];
  });
}

// Everything the given scripts import (esbuild follows the imports, links included).
async function imports(entries) {
  const { metafile } = await esbuild.build({
    entryPoints: entries, absWorkingDir: REPO, bundle: true, write: false, metafile: true,
    outdir: 'unused', format: 'esm', platform: 'neutral', packages: 'external', logLevel: 'silent'
  });
  return Object.keys(metafile.inputs).map((f) => rel(join(REPO, f)));
}

const patterns = () => {
  const out = execFileSync('bash', ['-c', `source "${join(REPO, 'scripts/hub-workers-pattern.sh')}"; printf '%s\\n%s\\n%s' "$THEME_WORKER_PATTERN" "$HIJRI_WORKER_PATTERN" "$QURAN_WORKER_PATTERN"`], { encoding: 'utf8' });
  const [theme, hijri, quran] = out.split('\n');
  return { theme: new RegExp(theme), hijri: new RegExp(hijri), quran: new RegExp(quran) };
};

test("each hub Worker's pattern covers every file it serves or bundles", async () => {
  const { theme, hijri, quran } = patterns();
  const themeSite = join(REPO, 'hub/theme/site'), hijriDir = join(REPO, 'hub/hijri'), quranDir = join(REPO, 'hub/quran');
  const themeUses = new Set([...files(themeSite), ...await imports(readdirSync(themeSite).filter((f) => f.endsWith('.js')).map((f) => join(themeSite, f)))]);
  const hijriUses = new Set([...files(hijriDir), ...await imports([join(hijriDir, 'worker/index.js'), ...readdirSync(join(hijriDir, 'site')).filter((f) => f.endsWith('.js')).map((f) => join(hijriDir, 'site', f))])]);
  const quranUses = new Set([...files(quranDir), ...await imports([join(quranDir, 'worker/index.js')])]);
  assert.ok(themeUses.has('hub/src/storage.js') && hijriUses.has('hub/src/digits.js') && quranUses.has('hub/src/sites.js'), 'the linked and bundled files were found');
  for (const f of themeUses) assert.ok(theme.test(f), `the theme Worker uses ${f}, but a change to it would not publish the Worker`);
  for (const f of hijriUses) assert.ok(hijri.test(f), `the Hijri Worker uses ${f}, but a change to it would not publish the Worker`);
  for (const f of quranUses) assert.ok(quran.test(f), `the quran Worker uses ${f}, but a change to it would not publish the Worker`);
});

test('a hub/src file no Worker uses publishes none', () => {
  const { theme, hijri, quran } = patterns();
  for (const f of ['hub/src/reader/view.js', 'hub/src/page-chrome.css']) {
    assert.ok(!theme.test(f) && !hijri.test(f) && !quran.test(f), `${f} should not publish a Worker`);
  }
  assert.ok(!theme.test('hub/src/sites.js') && !hijri.test('hub/src/sites.js'), 'sites.js publishes only the quran Worker');
});
