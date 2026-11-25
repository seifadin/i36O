// Which verse tanzil is showing, read from its page in the frame (served from this same address
// by the quran Worker). No page wiring here, so the tests can run it in Node.
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

