// Writes the shared components into a page's HTML at build time (scripts/build.js): each
// placeholder becomes the markup of its builder in src/components.js, the one place that markup is
// written (page scripts call the same builders). An icon is named by its meaning (src/icons.js) and
// drawn here from the pinned Lucide. Attributes the builders take: id, label, dir, aria-controls,
// aria-expanded, aria-pressed, data-i18n, class (a page's own placement class), disabled, hidden.
//
//   <!--@@TOOLBAR_BUTTON id="btn-zoom-in" icon="zoomIn"@@-->        (no icon: its script draws it)
//   <!--@@LABEL_BUTTON id="btn-exegesis" icon="exegesis" text="تفسير" label-id="exegesis-label" disabled@@-->
//   <!--@@MENU_BUTTON id="btn-lang" icon="dropdown" text-id="lang-short" aria-controls="lang-list"@@-->
//   <!--@@SETTINGS_BUTTONS@@-->
//   <!--@@DIVIDER@@-->
//   <!--@@TOOLBAR_TITLE data-i18n="title"@@-->Daily Reflection<!--@@/TOOLBAR_TITLE@@-->
//   <!--@@CHIP id="opt-word" text="كلمة كاملة" title="…"@@-->       (label-i18n: the label's words)
//   <!--@@FIELD kind="search" id="q" name="q" aria-label="…"@@-->  (kind: search, number or select)
//   <!--@@BUTTON id="btn-expand" icon="expandAll" label="…" small@@-->  (or text="…"; primary; type="submit")
//   <!--@@LIST_ITEM id="lang-ar" lang="ar" data-lang="ar" text="العربية"@@-->
//   <!--@@CARD id="quran-card" class="…"@@--> …the page's own contents… <!--@@/CARD@@-->
//   (likewise INSET, POPUP, BANNER and TOAST; tag="…" where the container allows another element)
//   <!--@@CARD_HEADER tone="quran" icon="verse" data-i18n="quranLabel" text="Quranic Verse" class="mb-md"@@-->
//   <!--@@STATUS_LINE part="quran" class="mt-md"@@-->
//
// A misspelled component, a missing field or an unknown meaning stops the build. A placeholder
// with no attributes that isn't a component (<!--@@CSP@@-->) is build.js's own and is left for it;
// build.js stops on any placeholder still left in a finished page.

import { svgFor } from './icons.js';
import * as C from '../src/components.js';

const PLACEHOLDER = /<!--@@([A-Z_]+)((?:\s+[a-z0-9-]+(?:="[^"]*")?)*)\s*@@-->/g;
// Placeholders around the page's own contents: the title, and the containers.
const PAIRED = Object.freeze({
  TOOLBAR_TITLE: (a, inner) => C.toolbarTitle({ ...a, html: inner.trim() }),
  CARD: (a, inner) => C.box('card', { ...a, html: inner }),
  INSET: (a, inner) => C.box('inset', { ...a, html: inner }),
  POPUP: (a, inner) => C.box('popup', { ...a, html: inner }),
  BANNER: (a, inner) => C.box('banner', { ...a, html: inner }),
  TOAST: (a, inner) => C.box('toast', { ...a, html: inner }),
});
// Its contents hold no opening of the same container, so the innermost pair is written first.
const pairedPattern = (name) => new RegExp(`<!--@@${name}((?:\\s+[a-z0-9-]+(?:="[^"]*")?)*)\\s*@@-->((?:(?!<!--@@${name}[\\s@])[\\s\\S])*?)<!--@@\\/${name}@@-->`, 'g');

function parse(text) {
  const a = {};
  for (const m of text.matchAll(/([a-z0-9-]+)(?:="([^"]*)")?/g)) a[m[1]] = m[2] ?? true;
  return a;
}

const COMPONENTS = Object.freeze({
  TOOLBAR_BUTTON: (a, draw) => C.toolbarButton({ ...a, icon: a.icon ? draw(a.icon) : undefined }),
  LABEL_BUTTON: (a, draw) => {
    if (!a.id || !a.icon || !a.text) throw new Error('LABEL_BUTTON needs id, icon and text');
    return C.labelButton({ ...a, icon: draw(a.icon), labelId: a['label-id'] });
  },
  MENU_BUTTON: (a, draw) => C.menuButton({ ...a, icon: a.icon ? draw(a.icon) : undefined, textId: a['text-id'] }),
  SETTINGS_BUTTONS: () => C.settingsButtons(),
  DIVIDER: (a) => C.divider(a),
  CHIP: (a) => C.chip(a),
  FIELD: (a) => C.field(a),
  BUTTON: (a, draw) => C.button({ ...a, icon: a.icon ? draw(a.icon) : undefined }),
  LIST_ITEM: (a) => C.listItem(a),
  CARD_HEADER: (a, draw) => C.cardHeader({ ...a, icon: a.icon ? draw(a.icon) : undefined }),
  STATUS_LINE: (a) => C.statusLine(a),
});

// The page's HTML with every component written out.
function writeComponents(html, draw = svgFor) {
  // Innermost first, so a container may hold another (and any component).
  let out = html, before;
  do {
    before = out;
    for (const [name, make] of Object.entries(PAIRED)) {
      out = out.replace(pairedPattern(name), (_, attrs, inner) => make(parse(attrs), inner));
    }
  } while (out !== before);
  return out.replace(PLACEHOLDER, (all, name, attrs) => {
    const make = COMPONENTS[name];
    if (make) return make(parse(attrs), draw);
    if (!attrs.trim() && !(name in PAIRED)) return all;   // build.js's own; it fails on any left over
    throw new Error(`unknown component <!--@@${name}…@@-->`);
  });
}

export { writeComponents };
