// The two versions a comparison runs on, taken from git so nothing is copied by hand.
//   --old <ref>   default origin/vite (what is live)
//   --new <ref>   default "work": this working copy as it is now (the hub pages as last
//                 built: run `npm run build` in hub/ first)
// A ref is anything git understands: a branch, a tag, a commit, HEAD~1…
// Each git version is unpacked once into the system's temporary folder and reused.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: import.meta.dirname, encoding: 'utf8' }).trim();
export const WORK = 'work';
const CACHE = join(tmpdir(), 'i360-compare');

const git = (...args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

// --old / --new (and any other --name value) from the command line.
export function options(defaults = {}) {
  const out = { old: 'origin/vite', new: WORK, ...defaults };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2), next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true; else { out[key] = next; i++; }
  }
  return out;
}

const shortSha = (ref) => git('rev-parse', '--short=8', `${ref}^{commit}`);
export const label = (ref) => (ref === WORK ? 'working copy' : `${ref} (${shortSha(ref)})`);

// Unpacks the given paths of a commit (once) and returns the folder.
function unpack(ref, paths, name) {
  const dir = join(CACHE, `${shortSha(ref)}-${name}`);
  if (existsSync(join(dir, '.done'))) return dir;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  execFileSync('sh', ['-c', `git archive "$0" -- "$@" | tar -x -C "${dir}"`, ref, ...paths], { cwd: REPO });
  writeFileSync(join(dir, '.done'), '');
  return dir;
}

// The built hub pages (public/md, cse, day) and the theme site of one version.
export function pages(ref) {
  const root = ref === WORK ? REPO : unpack(ref, ['public', 'hub/theme/site'], 'pages');
  return { label: label(ref), public: join(root, 'public'), theme: join(root, 'hub/theme/site') };
}

// The app's web build of one version, with Baserow pointed at the fake tables of lib/fakes.js.
// Built with this working copy's node_modules (the versions compared normally share them).
const FAKE_ENV = {
  VITE_BASEROW_URL: 'https://api.baserow.io/api/database/rows/table/',
  VITE_BASEROW_TABLE_SCIENCES: '1', VITE_BASEROW_TABLE_RESOURCES: '2', VITE_BASEROW_TABLE_QURAN: '3',
  VITE_BASEROW_KEY: 'compare', VITE_TRANSLATOR_KEY: '', VITE_TRANSLATOR_URL: '', VITE_PSE_CX: ''
};
export function app(ref) {
  const id = ref === WORK ? `work-${Date.now()}` : shortSha(ref);
  const out = join(CACHE, `${id}-app`);
  if (ref !== WORK && existsSync(join(out, 'index.html'))) return { label: label(ref), dist: out, theme: pages(ref).theme };
  let src = REPO;
  if (ref !== WORK) {
    src = unpack(ref, ['.', ':(exclude)android', ':(exclude)ios'], 'src');
    if (!existsSync(join(src, 'node_modules'))) symlinkSync(join(REPO, 'node_modules'), join(src, 'node_modules'));
  }
  // vite build only (the type check is the app's own test, not part of a comparison).
  execFileSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { cwd: src, env: { ...process.env, ...FAKE_ENV }, stdio: 'inherit' });
  return { label: label(ref), dist: out, theme: pages(ref).theme };
}

// A folder for screenshots and results: --out, else one per script in the temporary folder.
export function outDir(opts, name) {
  const dir = typeof opts.out === 'string' ? opts.out : join(CACHE, 'out', name);
  mkdirSync(dir, { recursive: true });
  return dir;
}
