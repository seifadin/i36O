// Sets Lucide's version for the app and the hub together, exactly (no ^): the app draws icons with
// lucide-react, the hub pages with lucide-static's drawings, and both must be the same release
// (hub/test/icons.test.js fails otherwise). Lucide releases almost daily; update on purpose.
//
//   npm run lucide -- 1.79.0
//
// Then run both test suites; a renamed or removed icon fails them, pointing at the line to change
// in hub/src/icons.js.

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const HUB = path.join(ROOT, 'hub');
const version = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('Usage: npm run lucide -- <version>   (for example: npm run lucide -- 1.79.0)');
  process.exit(1);
}

const run = (cmd, args, cwd) => {
  const step = `${cmd} ${args.join(' ')}   (in ${path.relative(ROOT, cwd) || '.'})`;
  console.log(`\n> ${step}`);
  try {
    execFileSync(cmd, args, { cwd, stdio: 'inherit' });
  } catch {
    console.error(`\nStopped: "${step}" failed (its output is above).`);
    process.exit(1);
  }
};

run('npm', ['install', '--save-exact', '--no-audit', '--no-fund', `lucide-react@${version}`], ROOT);
run('npm', ['install', '--save-exact', '--no-audit', '--no-fund', `lucide-static@${version}`], HUB);
run('node', ['scripts/icons.js', '--write'], HUB);

console.log(`\nLucide ${version} set for the app and the hub, hub drawings redrawn.`);
console.log('Next: npm test (app) and cd hub && npm test.');
