// One example or more of every shared component (src/components.js), made by its real builder, for
// the components' inventory (scripts/list-components.js reads each component's class from its first
// example) and the catalogue page (tools/catalogue/build-catalogue.js shows them all, in every
// theme). A component without examples fails the tests (test/components-inventory.test.js), so a new
// builder or container can't be left out of either.
//
// Keyed like the inventory's rows: a builder's name, or `box:<kind>` for each container. Each example:
//   name     what it shows (a state or a variant)
//   args     the builder's input (a container: box(kind, args))
//   display  optional: the markup as the catalogue shows it — placed in a bar or a card, or with the
//            text its page script would fill in (the inventory always reads the builder's own markup)
import * as C from '../src/components.js';
import { svgFor } from './icons.js';

const icon = (meaning) => svgFor(meaning);

// A script-filled row (`data-target="x"`) given its text, as its page script would.
const fill = (html, texts) => Object.entries(texts).reduce(
  (out, [target, text]) => out.replace(new RegExp(`(data-target="${target}"[^>]*>)(?=</)`), `$1${text}`), html);
// Placed in a toolbar, with a button on each side where it sits between buttons.
const inBar = (html) => C.box('toolbar', { html: C.box('toolbarStart', { html }) });
const sampleButton = () => C.toolbarButton({ icon: icon('search'), label: 'بحث' });
// Placed in a card, as on Daily Reflection.
const inCard = (html) => C.box('card', { tag: 'div', class: 'p-md', html });

const SAMPLES = Object.freeze({
  toolbarButton: [
    { name: 'عادي', args: { icon: icon('zoomIn'), label: 'تكبير' }, display: inBar },
    { name: 'مفعّل', args: { icon: icon('bookmark'), label: 'علامة', 'aria-pressed': 'true' }, display: inBar },
    { name: 'معطّل', args: { icon: icon('zoomOut'), label: 'تصغير', disabled: true }, display: inBar },
  ],
  labelButton: [
    { name: 'عادي', args: { icon: icon('exegesis'), text: 'تفسير', label: 'تفسير الآية' }, display: inBar },
    { name: 'معطّل', args: { icon: icon('exegesis'), text: 'تفسير', label: 'تفسير الآية', disabled: true }, display: inBar },
  ],
  menuButton: [
    { name: 'عادي', args: { icon: icon('dropdown'), textId: 'cat-lang-short', 'aria-controls': 'cat-lang-list', label: 'اللغة' },
      display: (html) => inBar(html.replace('id="cat-lang-short"></span>', 'id="cat-lang-short">ع</span>')) },
  ],
  settingsButtons: [
    { name: 'السمة والأرقام', args: {},
      display: (html) => inBar(html.replace('id="btn-theme"></button>', `id="btn-theme">${icon('theme.light')}</button>`)
        .replace('id="btn-numerals" class="toolbar-btn numerals-btn"></button>', 'id="btn-numerals" class="toolbar-btn numerals-btn">٤٥٦</button>')
        .replace(/ id="btn-(theme|numerals)"/g, '')) },
  ],
  toolbarTitle: [
    { name: 'عنوان الصفحة', args: { html: 'التأمل اليومي' },
      display: (html) => C.box('toolbar', { html: C.box('toolbarStart', { html: sampleButton() }) + html }) },
  ],
  divider: [
    { name: 'بين مجموعتين', args: {}, display: (html) => inBar(sampleButton() + html + sampleButton()) },
  ],
  chip: [
    { name: 'غير مفعّل', args: { text: 'كلمة كاملة' } },
    { name: 'مفعّل', args: { text: 'كلمة كاملة', 'aria-pressed': 'true' } },
  ],
  field: [
    { name: 'بحث', args: { kind: 'search', 'aria-label': 'بحث', placeholder: 'ابحث…' } },
    { name: 'رقم', args: { kind: 'number', 'aria-label': 'السنة', placeholder: 'مثل 1448' } },
    { name: 'قائمة', args: { kind: 'select', 'aria-label': 'الشهر' },
      display: (html) => html.replace('></select>', '><option>1. محرم</option><option>2. صفر</option></select>') },
  ],
  button: [
    { name: 'محدّد', args: { text: 'المزيد' } },
    { name: 'أساسي', args: { text: 'بحث', primary: true } },
    { name: 'صغير', args: { text: 'إعادة المحاولة', small: true } },
    { name: 'أيقونة فقط', args: { icon: icon('expandAll'), label: 'فتح الكل' } },
    { name: 'معطّل', args: { text: 'المزيد', disabled: true } },
  ],
  listItem: [
    { name: 'زر', args: { text: 'العربية' } },
    { name: 'محدّد', args: { text: 'English', 'aria-selected': 'true' } },
    { name: 'رابط', args: { text: 'صفحة الكتاب', href: '#' } },
  ],
  'box:card': [{ name: 'بطاقة', args: { tag: 'div', class: 'p-md', html: '<p>محتوى البطاقة</p>' } }],
  'box:inset': [{ name: 'صندوق داخلي', args: { class: 'p-md', html: '<p>محتوى داخلي</p>' } }],
  'box:popup': [{ name: 'قائمة منبثقة', args: { class: 'p-sm', html: C.listItem({ text: 'العربية' }) + C.listItem({ text: 'English' }) } }],
  'box:banner': [{ name: 'تنبيه', args: { class: 'p-sm', html: 'تعذّر تحميل البيانات' } }],
  'box:toast': [{ name: 'رسالة عابرة', args: { class: 'px-md py-sm', html: 'تم النسخ' } }],
  'box:fieldBox': [{ name: 'شريط البحث', args: { class: 'flex items-center gap-sm px-md py-sm', html: `<span>ابحث…</span>${icon('search')}` } }],
  'box:toolbar': [
    { name: 'عادي', args: { html: C.box('toolbarStart', { html: sampleButton() }) } },
    { name: 'أعلى الصفحة', args: { variant: 'sticky', html: C.box('toolbarStart', { html: sampleButton() }) + C.toolbarTitle({ html: 'العنوان' }) } },
    { name: 'أسفل الصفحة', args: { variant: 'bottom', html: C.box('toolbarStart', { html: sampleButton() }) } },
  ],
  'box:toolbarStart': [{ name: 'بداية الشريط', args: { html: sampleButton() }, display: (html) => C.box('toolbar', { html }) }],
  'box:toolbarMain': [{ name: 'وسط الشريط', args: { html: sampleButton() }, display: (html) => C.box('toolbar', { html }) }],
  'box:toolbarEnd': [{ name: 'نهاية الشريط', args: { html: sampleButton() }, display: (html) => C.box('toolbar', { html }) }],
  'box:toolbarGroup': [{ name: 'مجموعة أزرار', args: { html: sampleButton() + sampleButton() }, display: inBar }],
  'box:toolbarMenu': [{ name: 'قائمة ⋮', args: { html: sampleButton() } }],
  cardHeader: Object.keys(C.CARD_TONES).map((tone) => ({
    name: tone,
    args: { tone, icon: icon({ quran: 'verse', hadith: 'hadith', prayer: 'prayerTimes', converter: 'converter', event: 'events' }[tone] || 'verse'),
      text: { quran: 'آية اليوم', hadith: 'الحديث الشريف', prayer: 'مواقيت الصلاة', converter: 'محوّل التاريخ', event: 'مناسبات' }[tone] || tone },
  })),
  cardFooter: [
    { name: 'الآية', args: { tone: 'quran', part: 'cat-quran', citation: true, reference: 'text', source: 'link', 'source-text': 'AlQuran.cloud', 'source-href': 'https://alquran.cloud/' },
      display: (html) => inCard(fill(html, { 'cat-quran-citation': 'سورة البقرة (2:186)', 'cat-quran-reference': 'تفسير الجلالين' }).replace('>Source<', '>المصدر<')) },
    { name: 'الحديث', args: { tone: 'hadith', part: 'cat-hadith', citation: true, reference: 'details', 'reference-i18n': 'refsLabel', source: 'link', 'source-text': 'HadeethEnc.com', 'source-href': 'https://hadeethenc.com/' },
      display: (html) => inCard(fill(html, { 'cat-hadith-citation': 'الدرجة: صحيح · متفق عليه', 'cat-hadith-reference': 'صحيح البخاري (1)' })
        .replace('data-i18n="refsLabel" class="cursor-pointer text-base"></summary>', 'data-i18n="refsLabel" class="cursor-pointer text-base">المراجع</summary>').replace('>Source<', '>المصدر<')) },
    { name: 'المحوّل', args: { tone: 'converter', part: 'cat-conv', source: 'text' },
      display: (html) => inCard(fill(html, { 'cat-conv-source': 'تقويم حسابي تقريبي. قد يختلف التاريخ بيوم أو اثنين عن الفعلي.' })) },
    { name: 'صفوف فارغة تختفي', args: { tone: 'quran', part: 'cat-empty', citation: true, reference: 'text', source: 'link', 'source-text': 'AlQuran.cloud', 'source-href': 'https://alquran.cloud/' },
      display: (html) => inCard(html.replace('>Source<', '>المصدر<')) },
  ],
  statusLine: [
    { name: 'بعد فشل', args: { part: 'cat-status' },
      display: (html) => inCard(html.replace('class="hidden items-center', 'class="flex items-center')
        .replace('<span data-status-text></span>', '<span data-status-text>تعذّر التحميل</span>')
        .replace('data-retry></button>', 'data-retry>إعادة المحاولة</button>')) },
  ],
});

// The builder's own markup for one example (the inventory reads this).
function render(key, args) {
  if (key.startsWith('box:')) return C.box(key.slice(4), args);
  return C[key](args);
}

export { SAMPLES, render };
