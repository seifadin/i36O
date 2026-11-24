// Which kind of device a page runs on, from the browser's user agent. One copy, used by the i360إ
// app (usePlatform.ts, imported as '@i360/platform': where links open, which store) and the quran
// page (where an exegesis opens: a new tab on a desktop, the same view on a phone — the overlay
// the app opens it in has no tabs).

/** @typedef {'android' | 'ios' | 'web'} OSType */

/**
 * @param {string} [userAgent] the browser's (navigator.userAgent when left out)
 * @returns {OSType}
 */
export function detectOS(userAgent = globalThis.navigator ? globalThis.navigator.userAgent : '') {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'web';
}

/**
 * @param {string} [userAgent]
 * @returns {boolean}
 */
export function isDesktop(userAgent) {
  return detectOS(userAgent) === 'web';
}
