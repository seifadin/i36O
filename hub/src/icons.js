// i360 icon semantics: which Lucide icon (lucide.dev, ISC licence) each meaning uses, by its current
// name. The one place to decide an icon: the hub pages draw these names inline (scripts/icons.js
// checks every drawing is keyed by its meaning here), the app maps each meaning to its lucide-react
// component in src/lib/icons.ts (a test checks they match). One meaning, one icon; one icon, one
// meaning. Science icons are not here: they come from Baserow (src/lib/icons.ts loads them by name,
// and the indexer's quarterly check reports old or unknown names).

export const ICON_SEMANTICS = Object.freeze({
  // Settings, on every toolbar
  theme: Object.freeze({ system: 'monitor', light: 'sun', sepia: 'coffee', dark: 'moon' }),
  menu: 'ellipsis-vertical',
  close: 'x',

  // Search and the Qur'an
  search: 'search',
  searchAuto: 'pencil-sparkles', // the search box's resting state: it decides what to do
  searchOnly: 'minimize-2', // forced plain search, armed by a tap
  translating: 'languages',
  exegesis: 'scroll-text',
  assistant: 'bot',
  keyboard: 'keyboard',

  // States
  loading: 'loader-circle',
  checked: 'circle-check',
  invalid: 'circle-exclamation-point',
  notFound: 'circle-question-mark',
  openFailed: 'circle-x',
  unavailable: 'database-x',
  warning: 'triangle-exclamation-point',
  online: 'globe-check',
  offline: 'globe-x',
  badIcon: 'circle-slash', // a science icon name Lucide doesn't have

  // Lists and groups
  collapsed: 'chevron-left',
  expanded: 'chevron-down',
  expandAll: 'list-chevrons-up-down',
  collapseAll: 'list-chevrons-down-up',
  dropdown: 'chevrons-up-down', // a button that opens a list (Daily Reflection's languages)

  // The app's own controls
  web: 'globe',
  attachment: 'paperclip',

  // The Reader
  openFile: 'folder-open',
  contents: 'table-of-contents',
  bookmark: 'bookmark',
  delete: 'trash',
  copyLink: 'link',
  originalPage: 'scan-text',
  readingMode: 'maximize',
  exitReadingMode: 'minimize',
  zoomIn: 'plus',
  zoomOut: 'minus',
  fitWidth: 'move-horizontal',
  fitPage: 'move-vertical',
  pageLeft: 'arrow-left', // by screen side: a book's direction decides which is next
  pageRight: 'arrow-right',
  bookRtl: 'step-forward', // the book-direction button
  bookLtr: 'step-back',
  searchResults: 'list',
  resultNext: 'arrow-down',
  resultPrevious: 'arrow-up',

  // Daily Reflection
  verse: 'moon-star',
  hadith: 'book-open',
  prayerTimes: 'clock',
  events: 'calendar-check',
  converter: 'calendar-sync',
  swap: 'arrow-left-right',
  pickDate: 'calendar',
  provisional: 'clock-fading', // a Hijri date awaiting Dar al-Ifta's announcement
});
