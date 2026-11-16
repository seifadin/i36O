// Digits in the three sets i360 shows: Western (0123), Arabic-Indic (٠١٢٣) and Persian / Urdu (۰۱۲۳).
// One converter for the pages, the app (through the theme loader, which imports this file from
// beside itself: on the theme site, and here in the repo, theme/site/digits.js is a link to this
// file), the Hijri Worker and the CSE indexer. No browser needed.

/** @typedef {'western' | 'arabic' | 'persian'} Numerals */

const ZERO = { western: 0x30, arabic: 0x0660, persian: 0x06F0 };

/** Any digit of the three sets. */
export const ANY_DIGIT = /[0-9٠-٩۰-۹]/;

/** Every digit in text, of any of the three sets, written in the given numerals. @param {unknown} text @param {Numerals} numerals @returns {string} */
export function writeNumerals(text, numerals) {
  const zero = ZERO[numerals] || ZERO.western;
  return String(text).replace(/[0-9٠-٩۰-۹]/g, (d) => {
    const c = d.charCodeAt(0);
    const v = c >= 0x06F0 ? c - 0x06F0 : c >= 0x0660 ? c - 0x0660 : c - 0x30;
    return String.fromCharCode(zero + v);
  });
}

/** Arabic-Indic and Persian digits as Western digits. @param {unknown} s @returns {string} */
export const toWestern = (s) => writeNumerals(s, 'western');
