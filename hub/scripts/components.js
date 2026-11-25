// The shared components' markup, written once (their style: src/page-chrome.css). A page names a
// component with a placeholder, and the build (scripts/build.js) writes it here, so every page has
// exactly the same structure and differs only in its own words, icon and id:
//
//   <!--@@LABEL_BUTTON id="btn-exegesis" icon="exegesis" label="تفسير" label-id="exegesis-label" disabled@@-->
//
// LABEL_BUTTON  a toolbar button with a word beside its icon: the icon (by its meaning in
//               src/icons.js, drawn from the pinned Lucide) then the label, both direct children.
//               id, icon and label are required; label-id names the label (for a script that
//               changes its text); disabled starts it off.

import { svgFor } from './icons.js';

const PLACEHOLDER = /<!--@@([A-Z_]+)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*@@-->/g;
const ATTRIBUTE = /([a-z-]+)(?:="([^"]*)")?/g;
const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const escapeAttr = (s) => escapeText(s).replace(/"/g, '&quot;');

function labelButton({ id, icon, label, labelId, disabled = false }, draw = svgFor) {
  if (!id || !icon || !label) throw new Error('LABEL_BUTTON needs id, icon and label');
  const labelAttr = labelId ? ` id="${escapeAttr(labelId)}"` : '';
  return `<button class="toolbar-btn toolbar-btn-label" id="${escapeAttr(id)}" type="button"${disabled ? ' disabled' : ''}>`
    + `${draw(icon)}<span${labelAttr}>${escapeText(label)}</span></button>`;
}

const COMPONENTS = Object.freeze({
  LABEL_BUTTON: (a, draw) => labelButton({ id: a.id, icon: a.icon, label: a.label, labelId: a['label-id'], disabled: 'disabled' in a }, draw),
});

// The page's HTML with every component placeholder written out. A placeholder without attributes
// (<!--@@CSP@@-->) is build.js's own and is left for it; an unknown component throws.
function writeComponents(html, draw = svgFor) {
  return html.replace(PLACEHOLDER, (all, name, attrs) => {
    const make = COMPONENTS[name];
    if (!make && !attrs.trim()) return all;
    if (!make) throw new Error(`unknown component <!--@@${name}…@@-->`);
    const a = {};
    for (const m of attrs.matchAll(ATTRIBUTE)) a[m[1]] = m[2] ?? '';
    return make(a, draw);
  });
}

export { labelButton, writeComponents, COMPONENTS };
