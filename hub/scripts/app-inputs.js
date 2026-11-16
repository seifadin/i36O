// The hub files the i360إ app's build reads: those the app's own files name (vite.config.ts,
// index.html, tsconfig.app.json, tailwind.config.ts, src/; comments left out, since they name
// files the build doesn't read), and everything their scripts import (esbuild follows the
// imports, symlinks included). Read from this working copy.
// Used by test/release-checks.test.js (the release checks must never skip these) and by
// tools/compare/run.js (which comparisons a change needs).
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as esbuild from 'esbuild';

export const REPO = join(import.meta.dirname, '..', '..');

/** @returns {Promise<Set<string>>} repo-relative paths, e.g. 'hub/src/net.js' */
export async function appHubFiles() {
  const files = ['vite.config.ts', 'index.html', 'tsconfig.app.json', 'tailwind.config.ts'];
  const walk = (dir) => readdirSync(join(REPO, dir), { withFileTypes: true })
    .forEach((e) => (e.isDirectory() ? walk(join(dir, e.name)) : /\.(tsx?|css)$/.test(e.name) && files.push(join(dir, e.name))));
  walk('src');
  const code = (f) => readFileSync(join(REPO, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const named = new Set();
  for (const f of files) for (const m of code(f).matchAll(/hub\/[\w./-]+\.(?:json|css|js)\b/g)) named.add(m[0]);
  const { metafile } = await esbuild.build({
    entryPoints: [...named].filter((f) => f.endsWith('.js')).map((f) => join(REPO, f)), absWorkingDir: REPO,
    bundle: true, write: false, metafile: true, outdir: 'unused', format: 'esm', platform: 'neutral', packages: 'external', logLevel: 'silent'
  });
  for (const input of Object.keys(metafile.inputs)) named.add(relative(REPO, join(REPO, input)));
  return named;
}
