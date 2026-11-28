# Components

Written by `npm run components` (`hub/scripts/list-components.js`) from the code — never by hand.
`npm test` fails when this file is out of date. What each component looks like: the catalogue
(`npm run catalogue`, `hub/tools/catalogue/`). The rules behind them: the project's `i360-components.md`.

## 1. Shared components

Built by `hub/src/components.js` (hub pages, page scripts) and its React twins in `src/components/shared.tsx`
(the app; parity-tested against the builders). Uses: `<page> page ×n` = placeholders in `hub/src/<page>.src.html`;
a file = calls in that script or React uses in that app file.

| Builder | What | Placeholder | Class | React twin | Used by |
|---|---|---|---|---|---|
| `announcer` | A hidden announcer | `ANNOUNCER` | `.sr-only` | `Announcer` | quran page ×1; src/components/SearchBar.tsx ×1 |
| `box('card')` | A box around a section | `CARD` | `.i360-card` | — | day page ×5 |
| `box('inset')` | A box inside a section | `INSET` | `.i360-inset` | — | day page ×3; hub/src/day/main.js ×2 |
| `box('popup')` | A pop-up: a list, a dialog or a tooltip | `POPUP` | `.i360-popup` | `Popup` | day page ×1; reader page ×1; src/components/Dialog.tsx ×1; src/components/OSRow.tsx ×1 |
| `box('banner')` | A notice | `BANNER` | `.i360-banner` | `Banner` | reader page ×1; src/components/ScienceGrid.tsx ×1 |
| `box('toast')` | A short message that comes and goes | `TOAST` | `.i360-toast` | `Toast` | reader page ×1; src/components/ScienceGrid.tsx ×1 |
| `box('fieldBox')` | A field's look round a field and its buttons | `FIELD_BOX` | `.i360-field` `.i360-field-search` | `FieldBox` | cse page ×1; reader page ×1; src/components/SearchBar.tsx ×1 |
| `box('toolbar')` | A toolbar | `TOOLBAR` | `.toolbar` | `Toolbar` | cse page ×1; day page ×1; quran page ×1; reader page ×1; src/components/OSRow.tsx ×1 |
| `box('toolbarStart')` | A toolbar's start (its settings) | `TOOLBAR_START` | `.tb-start` | `ToolbarStart` | cse page ×1; day page ×1; quran page ×1; reader page ×1; src/components/OSRow.tsx ×1 |
| `box('toolbarMain')` | A toolbar's middle | `TOOLBAR_MAIN` | `.tb-main` | — | reader page ×1 |
| `box('toolbarEnd')` | A toolbar's end | `TOOLBAR_END` | `.tb-end` | — | reader page ×1 |
| `box('toolbarGroup')` | A group of toolbar buttons | `TOOLBAR_GROUP` | `.tb-group` | — | reader page ×7 |
| `box('toolbarMenu')` | A toolbar's ⋮ menu | `TOOLBAR_MENU` | `.toolbar-menu` | — | reader page ×1 |
| `box('rows')` | A list of rows, a line between each (the science accordions) | `ROWS` | `.i360-rows` | `Rows` | cse page ×1; hub/src/cse/main.js ×1; src/components/ScienceGrid.tsx ×2 |
| `button` | A button | `BUTTON` | `.i360-btn` | `Button` | cse page ×3; day page ×3; quran page ×1; reader page ×1; hub/src/cse/main.js ×1; src/components/Dialog.tsx ×2; src/components/ErrorBoundary.tsx ×2 |
| `cardFooter` | A card's footer | `CARD_FOOTER` | — (Tailwind) | — | day page ×3 |
| `cardHeader` | A card's header | `CARD_HEADER` | — (Tailwind) | — | day page ×5 |
| `chip` | An option that is on or off | `CHIP` | `.i360-chip` | — | cse page ×2; day page ×2; reader page ×2 |
| `disclosure` | A disclosure | `DISCLOSURE` | `.i360-disclosure` `.i360-disclosure-1` | `Disclosure` | hub/src/cse/main.js ×1; src/components/ScienceGrid.tsx ×1 |
| `divider` | A thin line between groups of toolbar buttons | `DIVIDER` | `.divider` | — | quran page ×1; reader page ×2 |
| `emptyState` | A message where there is nothing to show | `EMPTY_STATE` | `.i360-empty` | — | reader page ×1; hub/src/reader/panel.js ×1 |
| `field` | A field | `FIELD` | `.i360-field` `.i360-field-search` | `SearchField` | cse page ×1; day page ×4; reader page ×3; src/components/SearchBar.tsx ×1 |
| `ghostButton` | A ghost button | `GHOST_BUTTON` | `.i360-btn-ghost` | `GhostButton` | cse page ×1; day page ×2; reader page ×22; hub/src/reader/panel.js ×1; src/components/OSRow.tsx ×3; src/components/ScienceGrid.tsx ×1; src/components/SearchBar.tsx ×4 |
| `listItem` | One row of a list | `LIST_ITEM` | `.i360-list-item` | — | day page ×5; hub/src/cse/main.js ×1; hub/src/day/main.js ×1; hub/src/reader/panel.js ×1; hub/src/reader/search.js ×1 |
| `settingsButtons` | The theme and numerals buttons | `SETTINGS_BUTTONS` | `.i360-btn-ghost` | — | cse page ×1; day page ×1; quran page ×1; reader page ×1 |
| `statusLine` | A status line | `STATUS_LINE` | `.i360-status` | — | cse page ×1; day page ×3 |
| `toolbarTitle` | The page's name on its toolbar | `TOOLBAR_TITLE` | `.tb-title` | — | cse page ×1; day page ×1; quran page ×1; reader page ×1 |

## 2. The app's own components

React components in the app's `src/` outside the shared ones (file-local ones included).

| Component | Defined in | Exported | Used in |
|---|---|---|---|
| `AppShell` | `src/App.tsx` | no | `src/App.tsx` |
| `App` | `src/App.tsx` | no | `src/main.tsx` |
| `AndroidIcon` | `src/components/BrandIcons.tsx` | yes | `src/components/OSRow.tsx` |
| `AppleIcon` | `src/components/BrandIcons.tsx` | yes | `src/components/OSRow.tsx` |
| `GoogleIcon` | `src/components/BrandIcons.tsx` | yes | `src/components/OSRow.tsx` |
| `HuaweiIcon` | `src/components/BrandIcons.tsx` | yes | `src/components/OSRow.tsx` |
| `Dialog` | `src/components/Dialog.tsx` | yes | `src/App.tsx`, `src/components/OSRow.tsx`, `src/components/ReportNotice.tsx`, `src/components/ScienceGrid.tsx` |
| `ToggleItem` | `src/components/OSRow.tsx` | no | `src/components/OSRow.tsx` |
| `OrnamentDivider` | `src/components/OrnamentDivider.tsx` | yes | `src/pages/Home.tsx` |
| `ReportNotice` | `src/components/ReportNotice.tsx` | yes | `src/App.tsx`, `src/components/ScienceGrid.tsx` |
| `DynamicIcon` | `src/components/ScienceGrid.tsx` | no | `src/components/ScienceGrid.tsx` |
| `ScienceRow` | `src/components/ScienceGrid.tsx` | no | `src/components/ScienceGrid.tsx` |
| `MinorButton` | `src/components/ScienceGrid.tsx` | no | `src/components/ScienceGrid.tsx` |
| `StatusPill` | `src/components/ScienceGrid.tsx` | no | `src/components/ScienceGrid.tsx` |
| `ScienceGrid` | `src/components/ScienceGrid.tsx` | yes | `src/pages/Home.tsx` |
| `SearchBar` | `src/components/SearchBar.tsx` | yes | `src/pages/Home.tsx` |
| `Home` | `src/pages/Home.tsx` | yes | `src/App.tsx` |
| `AppStateProvider` | `src/store/appState.tsx` | yes | `src/App.tsx` |
| `DataCacheProvider` | `src/store/dataCache.tsx` | yes | `src/App.tsx` |

## 3. Each hub page's own classes

Classes a page's `<style>` defines that the shared stylesheet (`hub/src/page-chrome.css`) doesn't: what the page
builds by itself. (Daily Reflection's Tailwind utilities and classes added only by scripts aren't listed.)

| Page | Own classes |
|---|---|
| cse | `.about` `.bar-btns` `.direct` `.file` `.group-foot` `.hit` `.hit-meta` `.hit-text` `.inter-body` `.more-spots` `.options` `.results-bar` `.scroller` `.search-btn` `.search-form` `.search-input` `.sep` `.source` `.source-name` `.status` |
| day | `.cards` `.cards-col` `.cards-wide` `.conv-error` `.conv-field` `.conv-field-month` `.conv-field-year` `.conv-fields` `.conv-native` `.conv-pick` `.day-card` `.events-grid` `.is-shown` `.lang-list` `.lang-wrap` `.layout-stable` `.next-prayer-highlight` `.page` `.quran-verse` `.tracking-widest` `.two-cols` |
| quran | `.banner` `.tanzil` |
| reader | `.acts-folded` `.bm-row` `.bookmarked` `.empty-state` `.figure-label` `.flash` `.floating-btn` `.fn-back` `.fn-note` `.fn-ref` `.folded` `.footnotes` `.footnotes-list` `.indeterminate` `.item-page` `.item-text` `.lvl-1` `.lvl-2` `.lvl-3` `.lvl-4` `.markdown-body` `.missing-pages-banner` `.missing-pages-text` `.near` `.no-head` `.no-total` `.nopos` `.notitle` `.offline` `.open` `.page-content` `.page-counter` `.page-input` `.page-number-footer` `.page-placeholder` `.page-pos` `.page-sheet` `.pages-wrapper` `.panel-body` `.panel-empty` `.panel-head` `.panel-item` `.panel-list` `.panel-tab` `.progress` `.progress-fill` `.progress-text` `.progress-track` `.quran` `.reading` `.res-more` `.res-page` `.search-count` `.search-input` `.search-popup` `.search-results` `.search-row` `.show` `.side-panel` `.status-icon` `.status-text` `.sublist` `.table-wrap` `.text-size-btn` `.toast` `.viewer-container` `.visible` `.vol-select` |
