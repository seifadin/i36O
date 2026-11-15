/* i360 Hijri calculator — the one offline Hijri calculation, shared by the
   dar-hijri Worker, the hub pages (built in) and the i360 release script
   (scripts/get-hijri-date.js, which requires this file), so every place
   computes the same date.

   Pure: no network, no storage, no clock of its own (callers pass the date).
   Dates are civil dates as 'YYYY-MM-DD' strings; a Hijri date is {y, m, d}
   with m = 1..12. An ES module: bundled into the pages, imported by Node and by
   the Worker, and served as is at dar-hijri.i36o.workers.dev/calc.js.

   The calendar is ICU's 'islamic' (astronomical), the one i360 has used as its
   fallback. 'islamic-civil' is a different calendar: they differ on most days.
   Dar al-Ifta decides months by sighting, so this can be a day off theirs;
   `offsetFor` measures that difference from one known Dar al-Ifta date.

   Change VERSION whenever behaviour or labels change: the Worker reports it,
   and a copy that doesn't match is flagged as out of date. */
const VERSION = 3;                 // 3: toCivil, Hijri → civil (2026-11-15); 2: the 'provisional' label
const CALENDAR = 'islamic';
const SOURCES = Object.freeze({ DAR: 'dar', CALC: 'calc' });

// Shown next to the date: where it came from (or that it may still change). Keys are the day page's languages.
const LABELS = Object.freeze({
  dar: Object.freeze({ ar: 'حسب دار الإفتاء المصرية', en: "Per Egypt's Dar al-Ifta", tr: "Mısır Dar el-İfta'ya göre", id: 'Menurut Dar al-Ifta Mesir', ur: 'مصری دارالافتاء کے مطابق' }),
  calc: Object.freeze({ ar: 'تقويم حسابي تقريبي', en: 'Calculated (approximate)', tr: 'Hesaplanmış (yaklaşık)', id: 'Hitungan (perkiraan)', ur: 'حسابی (تخمینی)' }),
  // A calculated date Dar al-Ifta hasn't settled yet (the day after a 29th): it may still change.
  provisional: Object.freeze({ ar: 'بانتظار إعلان دار الإفتاء', en: "Awaiting Dar al-Ifta's announcement", tr: "Dar el-İfta'nın duyurusu bekleniyor", id: 'Menunggu pengumuman Dar al-Ifta', ur: 'دارالافتاء کے اعلان کا انتظار' })
});

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86400000;

// 'YYYY-MM-DD' -> that civil day as UTC midnight (a Date), or null if not a real date.
// setUTCFullYear: Date.UTC would read the years 0000–0099 as 1900–1999.
function parseYMD(s) {
  const m = YMD.exec(String(s));
  if (!m) return null;
  const dt = new Date(0);
  dt.setUTCFullYear(+m[1], +m[2] - 1, +m[3]);
  return (dt.getUTCFullYear() === +m[1] && dt.getUTCMonth() === +m[2] - 1 && dt.getUTCDate() === +m[3]) ? dt : null;
}

function toYMD(dt) {
  const p = (n, w) => String(n).padStart(w, '0');
  return `${p(dt.getUTCFullYear(), 4)}-${p(dt.getUTCMonth() + 1, 2)}-${p(dt.getUTCDate(), 2)}`;
}

function mustParse(s) {
  const dt = parseYMD(s);
  if (!dt) throw new RangeError(`HijriCalc: not a civil date "${s}" (expected YYYY-MM-DD)`);
  return dt;
}

function addDays(ymd, n) { return toYMD(new Date(mustParse(ymd).getTime() + n * DAY_MS)); }

// Whole days from a to b (b - a).
function diffDays(a, b) { return Math.round((mustParse(b).getTime() - mustParse(a).getTime()) / DAY_MS); }

// The civil date in a time zone at a moment (default: now). Callers pass `now` in tests.
function todayIn(timeZone, now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now === undefined ? new Date() : now);
}

let fmt = null;
function formatter() {
  if (!fmt) fmt = new Intl.DateTimeFormat(`en-u-ca-${CALENDAR}-nu-latn`, { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
  return fmt;
}

// The calculated Hijri date of a day counted from 1970-01-01 (UTC); null outside what Date can hold.
// Years before 1 AH come out as 0 and below (ICU counts on backwards).
function hijriOfDay(n) {
  const dt = new Date(n * DAY_MS);
  if (Number.isNaN(dt.getTime())) return null;
  const parts = formatter().formatToParts(dt);
  const get = (type) => parseInt(parts.find((x) => x.type === type).value, 10);
  return { y: get('year'), m: get('month'), d: get('day') };
}

// The calculated Hijri date of a civil date, shifted by `offset` days (see offsetFor).
function fromCivil(ymd, offset) {
  return hijriOfDay(Math.round(mustParse(ymd).getTime() / DAY_MS) + (offset || 0));
}

const order = (a, b) => a.y - b.y || a.m - b.m || a.d - b.d;

// The civil date whose calculated Hijri date (shifted by `offset`, as in fromCivil) is h, as
// 'YYYY-MM-DD'; null when the calculation has no such day (a 30th of a 29-day month), or h is before
// 1 AH or beyond the dates Date can hold. Searched over days — outward from 1970-01-01, then by
// halving — so no average month length is assumed: the calendar itself decides.
function toCivil(h, offset) {
  if (!h || ![h.y, h.m, h.d].every(Number.isInteger) || h.y < 1 || h.m < 1 || h.m > 12 || h.d < 1 || h.d > 30) return null;
  const k = offset || 0;
  const cmpAt = (n) => { const x = hijriOfDay(n + k); return x === null ? null : order(x, h); };
  const first = cmpAt(0);
  if (first === null) return null;
  // Bracket: lo before h, hi at or after it.
  let lo, hi;
  if (first < 0) {
    lo = 0;
    for (let step = 1; ; step *= 2) { const c = cmpAt(step); if (c === null) return null; if (c >= 0) { hi = step; break; } lo = step; }
  } else {
    hi = 0;
    for (let step = 1; ; step *= 2) { const c = cmpAt(-step); if (c === null) return null; if (c < 0) { lo = -step; break; } hi = -step; }
  }
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (cmpAt(mid) < 0) lo = mid; else hi = mid; }
  return cmpAt(hi) === 0 ? toYMD(new Date(hi * DAY_MS)) : null;
}

function isHijri(h) {
  return !!h && Number.isInteger(h.y) && Number.isInteger(h.m) && Number.isInteger(h.d) &&
    h.y >= 1300 && h.y <= 1700 && h.m >= 1 && h.m <= 12 && h.d >= 1 && h.d <= 30;
}

const same = (a, b) => a.y === b.y && a.m === b.m && a.d === b.d;

// The day shift k such that fromCivil(civil, k) equals a known (e.g. Dar al-Ifta) date,
// trying the nearest first; null if they are more than `max` days apart.
function offsetFor(civil, hijri, max) {
  const limit = max === undefined ? 2 : max;
  for (let i = 0; i <= limit; i++) {
    for (const k of i === 0 ? [0] : [-i, i]) if (same(fromCivil(civil, k), hijri)) return k;
  }
  return null;
}

// A known Hijri date moved forward n days by counting alone. A month has 29 or 30 days:
// counting is certain up to day 29, and after a 30th comes the 1st. The day after a 29th
// is decided by sighting, so whenever counting would pass it the answer is null.
function countForward(h, n) {
  if (!isHijri(h) || !Number.isInteger(n) || n < 0) return null;
  if (n === 0) return { y: h.y, m: h.m, d: h.d };
  if (h.d + n <= 29) return { y: h.y, m: h.m, d: h.d + n };
  if (h.d === 30 && n <= 29) return h.m === 12 ? { y: h.y + 1, m: 1, d: n } : { y: h.y, m: h.m + 1, d: n };
  return null;
}

function label(source, lang) {
  const set = LABELS[source];
  if (!set) return '';
  return set[lang] || set.ar;
}

export { VERSION, CALENDAR, SOURCES, LABELS, parseYMD, toYMD, addDays, diffDays, todayIn, fromCivil, toCivil, isHijri, offsetFor, countForward, label };
