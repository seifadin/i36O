// Which verse tanzil is showing, read from its page in the frame (served from this same address
// by the quran Worker), and the «تفسير» button's icons. No page wiring here, so the tests can run
// it in Node.
//
// First tanzil's own `curr` (the verse last tapped, or the first verse of the page turned to — on
// phones too), else the [sura:aya] in its title. Both checked on desktop and mobile, 2026-11-23.
// null when neither can be read: tanzil not loaded yet, or served from another site (the
// official embed), or tanzil changed.

/** @returns {{ sura: number, aya: number, from: 'curr' | 'title' } | null} */
export function readVerse(frame) {
  let w;
  try { w = frame.contentWindow; if (!w || !w.document) return null; } catch { return null; }
  try {
    const c = w.curr;
    if (c && valid(c.sura, c.aya)) return { sura: c.sura, aya: c.aya, from: 'curr' };
  } catch { /* read the title instead */ }
  try {
    const m = String(w.document.title).match(/\[(\d{1,3}):(\d{1,3})\]/);
    if (m && valid(+m[1], +m[2])) return { sura: +m[1], aya: +m[2], from: 'title' };
  } catch { /* nothing readable */ }
  return null;
}

const valid = (sura, aya) => Number.isInteger(sura) && Number.isInteger(aya) && sura >= 1 && sura <= 114 && aya >= 1 && aya <= 286;

// Lucide icons (lucide.dev, ISC licence), drawn by scripts/icons.js from lucide-static: the
// search bar's set in the app (at rest, no verse, no exegesis, opening failed) and data-unavailable.
export const ICONS = {
  exegesis: '<svg data-icon="exegesis" data-lucide="scroll-text" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 12h-5"></path><path d="M15 8h-5"></path><path d="M19 17V5a2 2 0 0 0-2-2H4"></path><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"></path></svg>',
  invalid: '<svg data-icon="invalid" data-lucide="circle-exclamation-point" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line></svg>',
  notFound: '<svg data-icon="notFound" data-lucide="circle-question-mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9 9.5a3 2.5 0 016 0c0 2-2 2-3 3.5"></path><path d="M12 17h.01"></path></svg>',
  openFailed: '<svg data-icon="openFailed" data-lucide="circle-x" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>',
  unavailable: '<svg data-icon="unavailable" data-lucide="database-x" viewBox="0 0 24 24" aria-hidden="true"><path d="m17 17 5 5"></path><path d="M19.323 13.744A9 3 0 0 0 21 12"></path><path d="M21 13.127V5"></path><path d="m22 17-5 5"></path><path d="M3 12A9 3 0 0 0 13.563 14.954"></path><path d="M3 5V19A9 3 0 0 0 13 21.981"></path><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse></svg>'
};
