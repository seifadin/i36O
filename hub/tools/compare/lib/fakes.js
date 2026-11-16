// Stand-ins for the outside services, so every run sees the same data and needs no network.

import { serveJson } from './browser.js';

// --- Baserow (the app): table 1 sciences, 2 resources/config, 3 Quran index (lib/versions.js
// builds the app with these numbers). Four majors, each with two minors of its own and two
// under an intermediate, long enough names to wrap on a phone.
const MAJORS = [['العقيدة', 'Creed', 'Shield'], ['الفقه', 'Fiqh', 'Scale'], ['التفسير وعلوم القرآن', 'Tafsir', 'BookOpen'], ['الحديث وعلومه', 'Hadith', 'ScrollText']];
const sciences = [];
MAJORS.forEach(([ar, en, icon], m) => {
  for (let k = 0; k < 4; k++) {
    const id = sciences.length + 1;
    sciences.push({
      id, ScienceMinorId: id, ScienceMinor_Ar: `${ar} — مصدر ${k + 1}`, ScienceMinor_En: `${en} ${k + 1}`, ScienceMinorIcon: 'Book',
      ScienceIntermediateId: k < 2 ? null : 100 + m, ScienceIntermediate_Ar: k < 2 ? '' : `فرع من ${ar}`, ScienceIntermediate_En: '', ScienceIntermediateIcon: 'Library',
      ScienceMajorId: m + 1, ScienceMajor_Ar: ar, ScienceMajor_En: en, ScienceMajorIcon: icon,
      GooglePlayStore: '', HuaweiAppGallery: '', AppleAppStore: '', Web: 'https://example.org/', WebAppendix: k === 0 ? 'https://example.org/a' : ''
    });
  }
});
const TABLES = {
  1: sciences,
  2: [{ id: 1, CustomSearch: 'https://example.org/?q=', Huawei_CustomSearch: '', Translator: '', BotSearch: 'https://example.org/bot', Huawei_BotSearch: '',
    Google_VirtualKeyboard: 'https://example.org/k', Huawei_VirtualKeyboard: '', WebsiteStatus: '', Edition: '1', Version: '0.14.0', Revision: '1',
    inWebList: '', URIschemes: '', MdReader: 'https://i36o.web.app/md/?file=' }],
  3: []
};
export function baserow(route, url) {
  const m = url.pathname.match(/table\/(\d+)\//);
  const rows = (m && TABLES[m[1]]) || [];
  return serveJson(route, { count: rows.length, next: null, previous: null, results: rows });
}

// --- Daily Reflection: the verse, the hadith, the city search.
const VERSE = 'وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ ۖ فَلْيَسْتَجِيبُوا لِي وَلْيُؤْمِنُوا بِي لَعَلَّهُمْ يَرْشُدُونَ';
const TRANSLATION = {
  ar: 'تفسير ميسر: وإذا سألك عبادي عني فقل لهم: إني قريب منهم، أجيب دعوة الداعي إذا دعاني.',
  en: 'And when My servants ask you concerning Me, indeed I am near. I respond to the invocation of the supplicant when he calls upon Me.',
  other: 'Translation text of the verse for this language, long enough to wrap over two lines.'
};
const HADITH = {
  ar: { id: '2962', title: 'إنما الأعمال بالنيات', hadeeth: 'عن عمر بن الخطاب رضي الله عنه قال: سمعت رسول الله ﷺ يقول: «إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى، فمن كانت هجرته إلى الله ورسوله فهجرته إلى الله ورسوله».', attribution: 'متفق عليه', grade: 'صحيح', reference: 'صحيح البخاري (1)\nصحيح مسلم (1907)' },
  other: { id: '2962', title: 'Actions are judged by intentions', hadeeth: '"Actions are judged by intentions, and every person will get what he intended."', attribution: 'Agreed upon', grade: 'Authentic' }
};
const CITIES = [
  { id: 361058, population: 3800000, name: 'الإسكندرية', admin1: 'الإسكندرية', country: 'مصر', country_code: 'EG', latitude: 31.2, longitude: 29.92, timezone: 'Africa/Cairo' },
  { id: 320392, population: 230000, name: 'الإسكندرونة', admin1: 'هاتاي', country: 'تركيا', country_code: 'TR', latitude: 36.58, longitude: 36.17, timezone: 'Europe/Istanbul' }
];
export const dayServices = {
  'api.alquran.cloud': (route, url) => {
    const edition = url.pathname.split(',')[1] || '';
    const tr = edition.startsWith('ar') ? TRANSLATION.ar : edition.startsWith('en') ? TRANSLATION.en : TRANSLATION.other;
    return serveJson(route, { data: [{ text: VERSE, surah: { name: 'سُورَةُ البَقَرَةِ', englishName: 'Al-Baqara', number: 2 }, numberInSurah: 186 }, { text: tr }] });
  },
  'hadeethenc.com': (route, url) => {
    if (url.pathname.includes('/categories/roots')) return serveJson(route, [{ id: '1', title: 'x', hadeeths_count: '1' }]);
    if (url.pathname.includes('/hadeeths/list')) return serveJson(route, { data: [{ id: '2962', title: 'x' }], meta: { total_items: 1, last_page: 1 } });
    return serveJson(route, url.searchParams.get('language') === 'ar' ? HADITH.ar : HADITH.other);
  },
  'geocoding-api.open-meteo.com': (route) => serveJson(route, { results: CITIES })
};

// The fixed moment Daily Reflection runs at: 2027-01-05 10:00 in Cairo, when the Isra event is "today".
export const DAY_CLOCK = { time: new Date('2027-01-05T08:00:00Z'), timezoneId: 'Africa/Cairo', locale: 'ar-EG' };
