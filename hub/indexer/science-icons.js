// The science icons named in Baserow (ScienceMajorIcon, ScienceIntermediateIcon, ScienceMinorIcon,
// in lucide-react's PascalCase), checked once a quarter against the Lucide the app pins
// (lucide-static, the same version: hub/test/icons.test.js): an old name Lucide still answers
// (the app draws it, through Lucide's stand-in) is reported with its current name, a name Lucide
// doesn't have at all (the app shows its badIcon) as unknown. Report only: the data is fixed in
// Baserow, and nothing here stops a publish. Read from the rows the indexer reads anyway.

import fs from 'node:fs';
import path from 'node:path';

const ICON_FIELDS = Object.freeze(['ScienceMajorIcon', 'ScienceIntermediateIcon', 'ScienceMinorIcon']);
const LUCIDE_INDEX = path.join(import.meta.dirname, '..', 'node_modules', 'lucide-static', 'dist', 'esm', 'lucide-static.mjs');

const pascal = (kebab) => kebab.replace(/(^|-)([a-z0-9])/g, (_, _dash, c) => c.toUpperCase());

// Every name Lucide answers (current and old), each with its icon's current name, from the
// package's index: `export { default as BookBookmark, default as BookMarked } from './icons/book-bookmark.mjs';`
function lucideNames(index = fs.readFileSync(LUCIDE_INDEX, 'utf8')) {
  const names = new Map();
  for (const m of index.matchAll(/export \{([^}]+)\} from '\.\/icons\/([a-z0-9-]+)\.mjs'/g)) {
    const current = pascal(m[2]);
    for (const part of m[1].split(',')) {
      const name = (part.match(/default as (\w+)/) || [])[1];
      if (name) names.set(name, current);
    }
  }
  return names;
}

// [{ name, current, sciences }] for each name that isn't current — current null when unknown.
function checkIcons(rows, names = lucideNames()) {
  const used = new Map();
  for (const row of rows) {
    for (const field of ICON_FIELDS) {
      const name = String(row[field] ?? '').trim();
      if (!name) continue;
      const level = field.replace(/^Science|Icon$/g, '');
      const science = String(row[`Science${level}_Ar`] ?? '').trim() || `row ${row.id}`;
      if (!used.has(name)) used.set(name, new Set());
      used.get(name).add(science);
    }
  }
  const findings = [];
  for (const [name, sciences] of [...used].sort(([a], [b]) => a.localeCompare(b))) {
    const current = names.get(name) ?? null;
    if (current !== name) findings.push({ name, current, sciences: [...sciences] });
  }
  return findings;
}

// The findings as lines for the run's log (and its summary page).
function describe(findings) {
  if (!findings.length) return ['Science icons: every name is current.'];
  return [
    `Science icons: ${findings.length} to change in Baserow (then bump Edition):`,
    ...findings.map((f) => `  ${f.name} → ${f.current ?? '(not a Lucide icon)'} — ${f.sciences.join('، ')}`),
  ];
}

export { ICON_FIELDS, lucideNames, checkIcons, describe };
