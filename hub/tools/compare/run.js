// Runs only the comparison scripts a change needs (lib/select.js decides), two at a time, and
// prints why each was chosen before running it.
//   node run.js [--old <ref>] [--new <ref>] [--all] [--plan] [--no-build] [--out <folder>]
//   --all        every script on every page, whatever changed
//   --plan       print what would run, and why, without running anything
//   --no-build   when --new is the working copy, don't run the hub build first (by default the
//                hub pages are built, since the scripts test them as built)
// Exit code 0 when every script chosen found nothing different, 1 otherwise.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appHubFiles } from '../../scripts/app-inputs.js';
import { REPO, WORK, options, label, pages, app } from './lib/versions.js';
import { BUILT, MULTI, SCRIPTS, select, everything } from './lib/select.js';

const opts = options();
const git = (args, encoding = 'utf8') => execFileSync('git', args, { cwd: REPO, encoding, maxBuffer: 1 << 28 });

// The files that differ between the two versions (the working copy: its changes and new files).
function changedFiles() {
  const list = (s) => s.split('\n').filter(Boolean);
  if (opts.new !== WORK) return list(git(['diff', '--name-only', opts.old, opts.new]));
  return [...new Set([...list(git(['diff', '--name-only', opts.old])), ...list(git(['ls-files', '--others', '--exclude-standard']))])];
}

// A file as it is in one version (null when it isn't there).
function fileAt(ref, path) {
  try { return ref === WORK ? readFileSync(join(REPO, path)) : git(['show', `${ref}:${path}`], null); } catch { return null; }
}

if (opts.new === WORK && !opts['no-build']) {
  console.log('Building the hub pages (npm run build in hub/) …');
  execFileSync('npm', ['run', 'build', '--silent'], { cwd: join(REPO, 'hub'), stdio: ['ignore', 'ignore', 'inherit'] });
}

const plan = opts.all ? everything() : select({
  changed: changedFiles(),
  builtDiffers: Object.fromEntries(Object.entries(BUILT).map(([page, path]) => {
    const a = fileAt(opts.old, path), b = fileAt(opts.new, path);
    return [page, !a || !b || !a.equals(b)];
  })),
  appHub: await appHubFiles()
});

console.log(`compare: ${label(opts.old)} → ${label(opts.new)}`);
for (const [page, reasons] of plan.why) console.log(`  ${page}: ${reasons.slice(0, 3).join(', ')}${reasons.length > 3 ? ` (+${reasons.length - 3} more)` : ''}`);
if (!plan.run.length) { console.log('  Nothing these checks look at differs: no script to run.'); process.exit(0); }
for (const { script, pages: p, whole } of plan.run) console.log(`  → ${script}${MULTI.has(script) ? ` (${p.join(', ')})` : ''}${whole ? ` — ${whole} changed` : ''}`);
if (opts.plan) process.exit(0);

// Unpack and build each version once here, so the scripts running side by side reuse them.
pages(opts.old); pages(opts.new);
const env = { ...process.env };
if (plan.run.some((j) => j.pages.includes('app'))) {
  app(opts.old);
  const built = app(opts.new);
  if (opts.new === WORK) env.I360_COMPARE_WORK_APP = built.dist;
}

function runOne({ script, pages: p }) {
  const args = [script, '--old', opts.old, '--new', opts.new];
  if (MULTI.has(script) && p.length < SCRIPTS[script].length) args.push('--pages', p.join(','));
  if (typeof opts.out === 'string') args.push('--out', join(opts.out, script.replace(/\.js$/, '')));
  const start = Date.now();
  return new Promise((done) => {
    const child = spawn(process.execPath, args, { cwd: import.meta.dirname, env });
    let output = '';
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('close', (code) => done({ script, code, output, seconds: Math.round((Date.now() - start) / 1000) }));
  });
}

const queue = [...plan.run], results = [];
const worker = async () => {
  while (queue.length) {
    const r = await runOne(queue.shift());
    console.log(`\n── ${r.script} ${r.code ? '✗ differences or errors' : '✓ identical'} (${r.seconds} s)\n${r.output.trimEnd()}`);
    results.push(r);
  }
};
await Promise.all([worker(), worker()]);
const bad = results.filter((r) => r.code).map((r) => r.script);
console.log(`\n${results.length} scripts: ${results.length - bad.length} identical${bad.length ? `, different: ${bad.join(', ')}` : ''}`);
process.exitCode = bad.length ? 1 : 0;
