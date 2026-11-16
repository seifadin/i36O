// The release checks (scripts/ota-relevant-pattern.sh) decide from the changed files whether a push
// deploys the web and releases to phones. They exclude parts of hub/ — so they must never exclude a
// hub file the app's build reads, or a change to it alone would reach nobody (§15au).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { REPO, appHubFiles } from '../scripts/app-inputs.js';

const patterns = () => {
  const out = execFileSync('bash', ['-c', `source "${join(REPO, 'scripts/ota-relevant-pattern.sh')}"; printf '%s\\n%s' "$HOSTING_UNAFFECTED_PATTERN" "$OTA_UNAFFECTED_PATTERN"`], { encoding: 'utf8' });
  const [hosting, ota] = out.split('\n');
  return { hosting: new RegExp(hosting), ota: new RegExp(ota) };
};

test("the release checks never skip a hub file the app's build reads", async () => {
  const { hosting, ota } = patterns();
  const inputs = [...await appHubFiles()];
  assert.ok(inputs.includes('hub/theme/site/theme-loader.js') && inputs.includes('hub/src/net.js'), 'the app inputs were found');
  for (const f of inputs) {
    assert.ok(!ota.test(f), `${f} feeds the app's bundle, but the OTA check would skip it`);
    assert.ok(!hosting.test(f), `${f} feeds the app's bundle, but the web deploy check would skip it`);
  }
});

test('what the checks skip in hub/, and that a new hub folder counts', () => {
  const { ota } = patterns();
  for (const f of ['hub/hijri/worker/source.js', 'hub/indexer/inventory.js', 'hub/test/x.test.js', 'hub/tools/compare/run.js',
    'hub/theme/site/theme.css', 'hub/theme/site/fonts/amiri/1/a.woff2', 'hub/README.md', 'hub/package.json']) assert.ok(ota.test(f), `${f} should be skipped`);
  for (const f of ['hub/theme/early.js', 'hub/src/page-chrome.css', 'hub/build-targets.json', 'hub/newfolder/x.js']) assert.ok(!ota.test(f), `${f} should count`);
});
