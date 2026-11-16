// Old vs new, case by case and step by step, printed the same way by every script.
// A result is { case: [[step, state], …] }; a state is anything JSON can hold.
// The exit code is 0 when everything is identical, 1 when anything differs.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './browser.js';
import { outDir } from './versions.js';

// Every script's ending: the steps on the old version, then on the new one — one at a time, since
// two side by side compete for the machine and timing-sensitive readings then come out differently —
// then the comparison printed. Returns the new version's results, for a script's own checks on them.
export async function oldVsNew(name, opts, oldV, newV, run) {
  const browser = await launch();
  let a, b;
  try { a = await run(browser, oldV); b = await run(browser, newV); } finally { await browser.close(); }
  compare(name, a, b, { out: outDir(opts, name), oldLabel: oldV.label, newLabel: newV.label });
  return b;
}

export function compare(name, oldRes, newRes, { out, oldLabel, newLabel } = {}) {
  let same = 0;
  const diffs = [];
  for (const key of new Set([...Object.keys(oldRes), ...Object.keys(newRes)])) {
    const a = oldRes[key] || [], b = newRes[key] || [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const step = a[i] && b[i] && a[i][0] !== b[i][0] ? `${a[i][0]} / ${b[i][0]}` : (a[i] || b[i])[0];
      if (JSON.stringify(a[i]) === JSON.stringify(b[i])) same++;
      else diffs.push({ key, step, old: a[i]?.[1], new: b[i]?.[1] });
    }
  }
  console.log(`\n${name}: ${oldLabel || 'old'} → ${newLabel || 'new'}`);
  for (const d of diffs) {
    console.log(`  DIFF ${d.key} · ${d.step}`);
    for (const line of changedFields(d.old, d.new)) console.log('    ' + line);
  }
  console.log(`  ${same} identical, ${diffs.length} different (of ${same + diffs.length})`);
  if (out) writeFileSync(join(out, `${name}.json`), JSON.stringify({ old: oldRes, new: newRes, diffs }, null, 1));
  if (diffs.length) process.exitCode = 1;
  return diffs;
}

// Only the fields that changed, so a long state stays readable.
function changedFields(a, b) {
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
      .map((k) => `${k}: ${short(a[k])} → ${short(b[k])}`);
  }
  return [`old ${short(a)}`, `new ${short(b)}`];
}
const short = (v) => { const s = JSON.stringify(v); return s === undefined ? '(missing)' : s.length > 160 ? s.slice(0, 157) + '…' : s; };
