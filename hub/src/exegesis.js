// The exegesis lookup: which address holds the exegesis of a chapter:verse, from Baserow's i360dbq
// rows (QuranChapter, QuranVerseMin, QuranVerseMax, ExegesisURL, ExegesisPage). One copy, used by
// the i360إ app (its search bar, imported as '@i360/exegesis'), the quran page (tanzil's «تفسير»)
// and the CSE indexer, which publishes the rows on the lib site in this module's shape
// (indexer/quran-data.js).

/**
 * @typedef {{ chapter: number, verseMin: number, verseMax: number, url: string, page: number | null }} ExegesisRow
 * @typedef {{ QuranChapter?: unknown, QuranVerseMin?: unknown, QuranVerseMax?: unknown, ExegesisURL?: unknown, ExegesisPage?: unknown }} BaserowExegesisRow
 */

/**
 * Baserow's rows in one shape: numbers as numbers (Baserow can send them as text, i360-instructions
 * §3), the address trimmed; rows without a chapter, a valid verse range or an address left out.
 * @param {ReadonlyArray<BaserowExegesisRow>} rows
 * @returns {ExegesisRow[]}
 */
export function exegesisRows(rows) {
  return rows.map((r) => ({
    chapter: Number(r.QuranChapter),
    verseMin: Number(r.QuranVerseMin),
    verseMax: Number(r.QuranVerseMax),
    url: String(r.ExegesisURL ?? '').trim(),
    page: Number(r.ExegesisPage) || null
  })).filter((r) => r.chapter > 0 && r.verseMin > 0 && r.verseMax >= r.verseMin && r.url);
}

/**
 * The address for chapter:verse — the first row whose chapter matches and whose range holds the
 * verse — or null when none does.
 * @param {ReadonlyArray<ExegesisRow>} rows
 * @param {number} chapter
 * @param {number} verse
 * @returns {string | null}
 */
export function findExegesisUrl(rows, chapter, verse) {
  const match = rows.find((r) => r.chapter === chapter && verse >= r.verseMin && verse <= r.verseMax);
  return match ? match.url : null;
}
