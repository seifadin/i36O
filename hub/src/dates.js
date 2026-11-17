// i360 dates on screen: every page writes a date through these, so each form is made in one place.
// They return text with Western digits; the page's numerals setting converts the digits as it does
// everywhere else (the theme loader's watchNumerals). Calendar logic (Hijri ⇄ civil) lives in
// hijri/calc.js; this file only writes dates.

const LRI = '⁦', PDI = '⁩', LRM = '‎';
const pad2 = (n) => String(n).padStart(2, '0');

// The comma between two items in a language (Arabic and Urdu: «،»).
export const listSep = (lang) => (lang === 'ar' || lang === 'ur') ? '، ' : ', ';

// yyyy-mm-dd, year first, kept in that order in any text direction and with any digits. Why the
// invisible marks: in right-to-left text the parts would be reordered (2026-10-16 shown as
// 16-10-2026), so the date sits in a left-to-right isolate (LRI … PDI); and Arabic-Indic digits
// (٠١٢٣) are "Arabic numbers" to Unicode, between which a "-" takes the right-to-left direction
// even inside that isolate (Western and Persian digits are "European numbers" and join), so a
// left-to-right mark stands on each side of each "-".
export function numericDate(y, m, d) {
  return `${LRI}${String(y).padStart(4, '0')}${LRM}-${LRM}${pad2(m)}${LRM}-${LRM}${pad2(d)}${PDI}`;
}

// A Date's weekday in a language.
export function weekdayName(dt, lang, timeZone = 'UTC') {
  return new Intl.DateTimeFormat(`${lang}-u-nu-latn`, { weekday: 'long', timeZone }).format(dt);
}

// The month names of the Gregorian calendar in a language, from the browser; with `second` (a
// locale, e.g. 'ar-SY'), each followed by that locale's name in brackets: «يناير (كانون الثاني)».
export function gregorianMonthNames(lang, second = null) {
  const name = (loc) => new Intl.DateTimeFormat(`${loc}-u-ca-gregory-nu-latn`, { month: 'long', timeZone: 'UTC' });
  const main = name(lang), extra = second ? name(second) : null;
  return Array.from({ length: 12 }, (_, i) => {
    const at = new Date(0); at.setUTCMonth(i, 15);
    return extra ? `${main.format(at)} (${extra.format(at)})` : main.format(at);
  });
}

// A Gregorian date written out by the browser in a language: «الأحد، 15 نوفمبر 2026».
//   weekday   with the weekday (default)
//   timeZone  the zone the Date is read in (default UTC — for dates kept as UTC midnight);
//             undefined = the device's own
//   second    a locale whose month name follows in brackets (the converter's Arabic: 'ar-SY')
//   mark      the calendar's mark at the end, after a space (the converter: «م», "CE")
export function gregorianLong(dt, lang, { weekday = true, timeZone = 'UTC', second = null, mark = '' } = {}) {
  const opts = { day: 'numeric', month: 'long', year: 'numeric', timeZone };
  if (weekday) opts.weekday = 'long';
  const extra = second ? new Intl.DateTimeFormat(`${second}-u-ca-gregory-nu-latn`, { month: 'long', timeZone }).format(dt) : null;
  const text = new Intl.DateTimeFormat(`${lang}-u-ca-gregory-nu-latn`, opts).formatToParts(dt)
    .map((p) => (p.type === 'month' && extra ? `${p.value} (${extra})` : p.value)).join('');
  return mark ? `${text} ${mark}` : text;
}

// A Hijri date written out: «5 جمادى الآخرة 1448». h = { y, m (1–12), d }; months = the page's
// month names in its language (the locales' `months`).
//   weekday   a Date whose weekday comes first, with `lang`'s comma («الأحد، 5 …»)
//   mark      the calendar's mark at the end, after a space («هـ», "AH")
export function hijriLong(h, months, { weekday = null, lang = 'ar', mark = '' } = {}) {
  const text = `${h.d} ${months[h.m - 1]} ${h.y}${mark ? ` ${mark}` : ''}`;
  return weekday ? `${weekdayName(weekday, lang)}${listSep(lang)}${text}` : text;
}
