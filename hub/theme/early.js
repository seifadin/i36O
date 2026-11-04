// i360 theme, early part: inlined in each app's <head> (not served), after the
// app's fallback colours and before anything is drawn. It shows the saved
// theme and the saved copy of theme.css at once, so a repeat visit has no
// flash of the wrong colours. theme-loader.js does the rest. Then, in a browser
// too old for the pages, a note instead of a blank page (below).
// Plain ES5 on purpose: it must run in any browser that can show the page.
// Keep in step with CHOICE_KEY, CACHE_KEY and THEMES in site/theme-loader.js.
(function () {
  var root = document.documentElement, themes = ['system', 'light', 'sepia', 'dark'];
  var c = root.getAttribute('data-i360-lock');
  if (themes.indexOf(c) < 0) {
    try { c = localStorage.getItem('i360.theme'); } catch (e) { c = null; }
  }
  if (themes.indexOf(c) < 0) c = 'system';
  if (c === 'system') {
    c = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.setAttribute('data-theme', c);
  try {
    var k = JSON.parse(localStorage.getItem('i360.theme.css'));
    if (k && typeof k.css === 'string') {
      var s = document.createElement('style');
      s.id = 'i360-theme';
      s.textContent = k.css;
      document.head.appendChild(s);
    }
  } catch (e) { /* no copy yet: the page's own colours */ }
})();

// A browser too old for these pages: the page's own code never runs there and the page would stay
// blank. Instead: a note, in place of the page. "Too old": no JavaScript modules (Firefox before 60,
// Chrome before 61, Safari before 11), or older than what the builds write for (hub/build-targets.json:
// Firefox 104, Chrome 107, Safari 15 — late 2022). A script can't test syntax itself (the pages'
// security policy forbids eval), so an API of that time stands in for it: structuredClone (Firefox 94,
// Chrome 98, Safari 15.4 — also where Safari's dvh unit, which the app's layout needs, arrived). The
// Reader's Markdown library (marked) uses lookbehind (Safari 16.4) only where the browser has it, with
// a fallback otherwise, so it needs nothing more.
// The note's link: i360dbc's Support (the support site), put here by the app's build in place of '/'
// (vite.config.ts); on the hub pages it stays '/', the app's home, whose note has it.
(function () {
  if ('noModule' in document.createElement('script') && typeof window.structuredClone === 'function') return;
  var SUPPORT_LINK = '/';
  var hide = document.createElement('style');
  hide.textContent = 'body > * { display: none !important; } body > #i360-old-browser { display: block !important; }';
  document.head.appendChild(hide);
  function show() {
    var note = document.createElement('p'), name = document.createElement('bdi'), link = document.createElement('a');
    note.id = 'i360-old-browser';
    note.dir = 'rtl';
    note.style.cssText = 'margin: 0; padding: 3rem 1.5rem; text-align: center; font-family: var(--i360-font, serif); font-size: 1.35rem; line-height: 2;'
      + ' color: var(--i360-text, #0010CF); background: var(--i360-bg, #FAF7F2); min-height: 100vh; box-sizing: border-box;';
    name.dir = 'ltr';                          // «i360إ» in place with any surrounding text (as the CSE's title)
    name.textContent = 'i360‎إ';
    link.href = SUPPORT_LINK;
    link.textContent = 'للمزيد';
    link.style.cssText = 'color: var(--i360-link, #2E8B57); font-weight: 700;';
    note.appendChild(document.createTextNode('متصفحك قديم ولا يدعم الموسوعة الإسلامية '));
    note.appendChild(name);
    note.appendChild(document.createTextNode('؛ يُرجى استخدام متصفح أحدث. '));
    note.appendChild(link);
    document.body.insertBefore(note, document.body.firstChild);
  }
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
})();
