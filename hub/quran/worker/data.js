// The quran Worker's answers to tanzil's two data scripts, from the files the CSE workflow
// publishes on the lib site (indexer/quran-data.js): quran/manifest.json and one file per text.
// No Worker API here, so the tests run it in Node with a stand-in for the lib site.
//
//   /php/get-aya.php  texts=[{textID, start, end}] (verses 0–6235 across the Quran, end not
//                     included) → {"<textID>": {"<index>": "<verse>\n", …}, …}
//   /php/search.php   tanzil's page builds the pattern itself (a regex allowing for diacritics);
//                     terms joined by "+" must all match, "!" excludes, "|" is plain regex OR;
//                     each verse is searched as " text " (quoted phrases need the spaces).
//                     → "<verses>:<matches>|<index>:<text>:<translation, ':' as '↕'>\n…"
// Both were checked byte for byte against tanzil's own server (2026-11-23). Root search
// ("Root <root>") needs word-root data tanzil doesn't offer for download: no results.

const VERSES = 6236;
const SEARCH_TYPE = 'simple';
const QURAN_TYPES = Object.freeze(['simple', 'simple-plain', 'simple-min', 'simple-clean', 'uthmani', 'uthmani-min']);
// Texts kept in memory: the search text, plus the most recently used others (Cloudflare gives a
// Worker 128 MB; a text takes about 1–3 MB).
const KEEP = 10;
const MANIFEST_TTL_MS = 5 * 60 * 1000;

// libFetch(path) → a fetch answer for that path on the lib site (a service binding in the Worker).
// Only finished values are kept between requests: Cloudflare doesn't let one request wait on
// work another request started.
export function createStore({ libFetch, now = () => Date.now(), keep = KEEP, manifestTtl = MANIFEST_TTL_MS }) {
  let manifest = null;
  let manifestAt = 0;
  const texts = new Map();   // file → verses, oldest use first
  let exegesisFile = null, exegesisRows = null;

  async function getManifest() {
    if (manifest && now() - manifestAt < manifestTtl) return manifest;
    const res = await libFetch('quran/manifest.json');
    if (!res.ok) throw new Error(`lib manifest: HTTP ${res.status}`);
    const m = await res.json();
    if (!m || !m.tanzil || !m.tanzil.texts || !m.tanzil.texts[SEARCH_TYPE]) throw new Error('lib manifest: no Quran texts');
    manifest = m;
    manifestAt = now();
    return manifest;
  }

  // A text's verses, or null when the manifest doesn't have it (tanzil offers a few translations
  // only inside its Navigator, not for download).
  async function text(id) {
    const entry = (await getManifest()).tanzil.texts[id];
    if (!entry) return null;
    if (texts.has(entry.file)) {
      const verses = texts.get(entry.file);
      texts.delete(entry.file);
      texts.set(entry.file, verses);
      return verses;
    }
    const res = await libFetch(entry.file);
    if (!res.ok) throw new Error(`lib ${entry.file}: HTTP ${res.status}`);
    const { verses } = await res.json();
    if (!Array.isArray(verses) || verses.length !== VERSES) throw new Error(`lib ${entry.file}: not ${VERSES} verses`);
    texts.set(entry.file, verses);
    const searchFile = manifest.tanzil.texts[SEARCH_TYPE].file;
    for (const file of texts.keys()) {
      if (texts.size <= keep) break;
      if (file !== searchFile) texts.delete(file);
    }
    return verses;
  }

  async function getAya(form) {
    const wanted = JSON.parse(form.get('texts') || '[]');
    const out = {};
    for (const t of wanted) {
      const id = String(t.textID);
      const verses = await text(id);
      const o = out[id] || (out[id] = {});
      if (!verses) continue;
      const s = Math.max(0, t.start | 0), e = Math.min(VERSES, t.end | 0);
      for (let i = s; i < e; i++) o[i] = verses[i] + '\n';
    }
    return JSON.stringify(out);
  }

  async function search(form) {
    const pattern = String(form.get('pattern') || '');
    const transType = String(form.get('transType') || '');
    const page = Math.max(1, parseInt(form.get('pageOffset'), 10) || 1);
    const per = Math.min(100, Math.max(1, parseInt(form.get('resultsPerPage'), 10) || 10));
    const type = String(form.get('type') || SEARCH_TYPE);
    if (!pattern || pattern.startsWith('Root ')) return '0:0|';

    const pos = [], neg = [];
    let sign = '+';
    try {
      for (const part of pattern.split(/([+!])/)) {
        if (part === '+' || part === '!') { sign = part; continue; }
        if (part) (sign === '!' ? neg : pos).push(new RegExp(part, 'g'));
      }
    } catch {
      return '0:0|';
    }
    const verses = await text(QURAN_TYPES.includes(type) ? type : SEARCH_TYPE);
    const trans = transType ? await text(transType) : null;

    let ayas = 0, matches = 0;
    const hits = [];
    for (let i = 0; i < VERSES; i++) {
      const s = ' ' + verses[i] + ' ';
      let ok = true, count = 0;
      for (const re of pos) {
        const m = s.match(re);
        if (!m) { ok = false; break; }
        count += m.length;
      }
      if (ok) for (const re of neg) { re.lastIndex = 0; if (re.test(s)) { ok = false; break; } }
      if (ok) { ayas++; matches += count; hits.push(i); }
    }
    const lines = hits.slice((page - 1) * per, page * per)
      .map((i) => i + ':' + verses[i] + ':' + (trans ? trans[i].replace(/:/g, '↕') : ''))
      .join('\n');
    return ayas + ':' + matches + '|' + lines + (lines ? '\n' : '');
  }

  // The exegesis index (the app's, from i360dbq), in src/exegesis.js's shape, for the page's «تفسير».
  async function exegesis() {
    const m = await getManifest();
    if (!m.exegesis) throw new Error('lib manifest: no exegesis index');
    if (exegesisFile === m.exegesis.file) return exegesisRows;
    const res = await libFetch(m.exegesis.file);
    if (!res.ok) throw new Error(`lib ${m.exegesis.file}: HTTP ${res.status}`);
    const { rows } = await res.json();
    if (!Array.isArray(rows)) throw new Error(`lib ${m.exegesis.file}: no rows`);
    exegesisFile = m.exegesis.file;
    exegesisRows = rows;
    return rows;
  }

  // Whether the data can be served: the manifest is readable and has the Quran texts.
  async function health() {
    const m = await getManifest();
    return {
      ok: true,
      pageVersion: m.tanzil.pageVersion,
      texts: Object.keys(m.tanzil.texts).length,
      exegesis: m.exegesis ? m.exegesis.revision : null
    };
  }

  return { getAya, search, exegesis, health, getManifest, kept: () => [...texts.keys()] };
}
