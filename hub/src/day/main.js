// Daily Reflection's script (src/day.src.html), bundled into the page by scripts/build.js with
// what it imports: the shared Hijri date (hijri/, i360-hub.md §8), Adhan (adhan-js, MIT,
// Batoul Apps: prayer times calculated on the device, i360-hub.md §10) and the default-city
// table (src/day-cities.json: every time zone's main city; the build keeps only the fields
// used here).
import * as adhan from 'adhan';
import * as i360Theme from '../../theme/site/theme-loader.js';
import * as HijriCalc from '../../hijri/calc.js';
import * as HijriClient from '../../hijri/client.js';
import DAY_CITIES from '../day-cities.json';
import { $, drawSettingsButtons, el, setLabel, setupClose, wireSettingsButtons } from '../page-chrome.js';
import { oncePerFrame } from '../frame.js';
import { createStore } from '../storage.js';
import { fetchJson } from '../net.js';
import { gregorianLong, gregorianMonthNames, hijriLong, listSep, numericDate } from '../dates.js';
import { DAY as LOCALES } from '../locales.js';


/* ---------- Config ---------- */
const CONFIG = {
  S: { T: 'th-v8', L: 'ln-v8', M: 'sm-v8', Q: 'qd-v8', H: 'hd-v8', CITY: 'ct-v1' },
  API: {
    Q: 'https://api.alquran.cloud/v1/ayah',
    HE: 'https://hadeethenc.com/api/v1',
    CITY: 'https://geocoding-api.open-meteo.com/v1/search'   // the city picker only
  },
  // HadeethEnc root categories left out of the daily pick (2 = "The Hadith and Hadith Sciences", technical, 10 items).
  HADEETH_EXCLUDE_ROOTS: ['2'],
  EDITIONS: { quran: { ar: 'ar.jalalayn', en: 'en.sahih', tr: 'tr.ates', id: 'id.indonesian', ur: 'ur.ahmedali' } },
  P_KEYS: ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
  P_NEXT_KEYS: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],   // Sunrise is shown but is not a prayer
  // Arabic Gregorian months also by their Levantine names (كانون الثاني …), from the browser's own
  // data for this locale (Seif 2026-11-15); other languages: their own names only.
  CONV_SECOND_MONTHS: { ar: 'ar-SY' },
  // The note above the events (the Islamic day runs sunset to sunset) and its source (Seif, 2026-11-15).
  DAY_NOTE_SOURCE: 'https://ar.wikipedia.org/wiki/%D9%88%D9%8A%D9%83%D9%8A%D8%A8%D9%8A%D8%AF%D9%8A%D8%A7:%D9%81%D9%8A_%D9%87%D8%B0%D8%A7_%D8%A7%D9%84%D9%8A%D9%88%D9%85/%D8%A7%D9%84%D9%85%D9%86%D8%A7%D8%B3%D8%A8%D8%A7%D8%AA_%D8%A7%D9%84%D9%87%D8%AC%D8%B1%D9%8A%D8%A9',
  EV: [
    {id:'h_new',d:1,m:0},{id:'tasua',d:9,m:0},{id:'ashura',d:10,m:0},
    {id:'mig_mecca',d:27,m:1},
    {id:'mawlid',d:12,m:2},{id:'arrival',d:12,m:2},
    {id:'isra',d:27,m:6},
    {id:'baraah',d:15,m:7},{id:'cres',d:29,m:7},
    {id:'ram_start',d:1,m:8},{id:'badr',d:17,m:8},{id:'fath',d:20,m:8},{id:'qadr',d:27,m:8},
    {id:'f1',d:1,m:9},{id:'f2',d:2,m:9},{id:'f3',d:3,m:9},
    {id:'sq',d:1,m:10},
    {id:'sh',d:1,m:11},{id:'tar',d:8,m:11},{id:'ara',d:9,m:11},{id:'a1',d:10,m:11},{id:'a2',d:11,m:11},{id:'a3',d:12,m:11},{id:'a4',d:13,m:11}
  ]
};

/* Prayer-time calculation (adhan-js, on the device): the method by the city's country, from Adhan's
   own methods and recommendations only (Seif 2026-10-22, i360-hub.md §10); every other country:
   Muslim World League. Its name: Arabic on the Arabic page, the institution's English name otherwise. */
const METHOD_BY_COUNTRY = {
  Egyptian: 'EG SD LY SY LB IQ JO PS', UmmAlQura: 'SA YE BH OM', Dubai: 'AE', Kuwait: 'KW', Qatar: 'QA',
  Turkey: 'TR', Tehran: 'IR', Karachi: 'PK IN BD AF', Singapore: 'SG MY ID BN', MoonsightingCommittee: 'US CA GB'
};
const METHOD_OF = {};
Object.keys(METHOD_BY_COUNTRY).forEach(m => METHOD_BY_COUNTRY[m].split(' ').forEach(cc => { METHOD_OF[cc] = m; }));
const METHOD_NAMES = {
  MuslimWorldLeague: ['رابطة العالم الإسلامي', 'Muslim World League'],
  Egyptian: ['الهيئة المصرية العامة للمساحة', 'Egyptian General Authority of Survey'],
  UmmAlQura: ['جامعة أم القرى، مكة المكرمة', 'Umm al-Qura University, Makkah'],
  Dubai: ['دبي', 'Dubai'], Kuwait: ['الكويت', 'Kuwait'], Qatar: ['قطر', 'Qatar'],
  Turkey: ['رئاسة الشؤون الدينية التركية (ديانت)', 'Diyanet İşleri Başkanlığı, Turkey'],
  Tehran: ['معهد الجيوفيزياء، جامعة طهران', 'Institute of Geophysics, University of Tehran'],
  Karachi: ['جامعة العلوم الإسلامية بكراتشي', 'University of Islamic Sciences, Karachi'],
  Singapore: ['مجلس الشؤون الإسلامية بسنغافورة', 'Majlis Ugama Islam Singapura'],
  MoonsightingCommittee: ['لجنة رؤية الهلال', 'Moonsighting Committee Worldwide']
};
// No usable device time zone: Makkah (Seif 2026-10-22).
const MAKKAH = { cc: 'SA', lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh',
         n: { ar: 'مكة المكرمة', en: 'Makkah', tr: 'Mekke', id: 'Makkah', ur: 'مکہ مکرمہ' } };

/* ---------- Small helpers ---------- */
const pad = n => String(n).padStart(2, '0');
const ymdKey = o => `${o.y}-${pad(o.m)}-${pad(o.d)}`;
const localYMD = (d = new Date()) => ({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
function minutesNowIn(tz) {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    return parseInt(p.find(x => x.type === 'hour').value, 10) * 60 + parseInt(p.find(x => x.type === 'minute').value, 10);
  } catch (e) { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
}
// Lucide icons shown from script (beside a provisional Hijri date).
const PROVISIONAL_ICON = '<svg data-icon="provisional" data-lucide="clock-fading" class="icon-inline me-xs" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 1 7.38 16.75"></path><path d="M12 6v6l4 2"></path><path d="M2.5 8.875a10 10 0 0 0-.5 3"></path><path d="M2.83 16a10 10 0 0 0 2.43 3.4"></path><path d="M4.636 5.235a10 10 0 0 1 .891-.857"></path><path d="M8.644 21.42a10 10 0 0 0 7.631-.38"></path></svg>';
function svgIcon(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup;
  return t.content.firstChild;
}

const DataStore = createStore();   // src/storage.js — keys as they are (CONFIG.S)

/* ---------- Network: timeout, no retry on 4xx, bounded retries on network/5xx (src/net.js) ---------- */

/* ---------- Hijri date: the shared files (hijri/calc.js, hijri/client.js; i360-hub.md §8) ----------
   The date comes from the dar-hijri Worker (Dar al-Ifta's), or is calculated here when the Worker
   can't be reached; the label says which. The browser keeps the Worker's answer (its cache headers),
   so the page saves nothing itself. k = the day shift between the calculator and that date, used
   to project the events. */
const Hijri = {
  today: () => HijriCalc.todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone),
  make(date, h, source, provisional) {
    const k = HijriCalc.offsetFor(date, h, 3);
    return { date, today: h, source, provisional, k: k === null ? 0 : k };
  },
  sync() { const date = this.today(); return this.make(date, HijriCalc.fromCivil(date), HijriCalc.SOURCES.CALC, false); },
  async resolve() {
    const r = await HijriClient.get({ date: this.today() });
    if (r.error) console.warn('[hijri] calculated here:', r.error);
    if (r.outdated) console.warn('[hijri] this page\'s calc.js differs from the Worker\'s: rebuild and redeploy the page');
    return this.make(r.date, r.h, r.source, r.provisional);
  },
  label(h, lang) { return HijriCalc.label(h.provisional ? 'provisional' : h.source, lang); },
  /* Next occurrence of every event within the coming year (the whole year, Seif 2026-11-15), by walking
     forward day by day (no drifting arithmetic). */
  events(h) {
    const out = [], seen = new Set();
    for (let i = 0; i <= 385 && seen.size < CONFIG.EV.length; i++) {
      const x = HijriCalc.addDays(h.date, i), hh = HijriCalc.fromCivil(x, h.k);
      for (const e of CONFIG.EV) {
        if (!seen.has(e.id) && e.m + 1 === hh.m && e.d === hh.d) { seen.add(e.id); out.push({ id: e.id, d: e.d, m: e.m, year: hh.y, date: HijriCalc.parseYMD(x), isT: i === 0 }); }
      }
    }
    return out;
  }
};

/* ---------- HadeethEnc (IslamHouse / Saudi Ministry of Islamic Affairs) ---------- */
const HE = {
  per: 20,
  async list(lang, cat, page) {
    const r = await fetchJson(`${CONFIG.API.HE}/hadeeths/list/?language=${lang}&category_id=${cat}&page=${page}&per_page=${this.per}`);
    const m = r.meta || {};
    return { items: Array.isArray(r) ? r : (r.data || []), total: Number(m.total_items ?? m.total ?? m.count) || 0, lastPage: Number(m.last_page) || 0 };
  },
  async pickId(lang) {
    const r = await fetchJson(`${CONFIG.API.HE}/categories/roots/?language=${lang}`);
    const roots = (Array.isArray(r) ? r : (r.data || [])).filter(c => !CONFIG.HADEETH_EXCLUDE_ROOTS.includes(String(c.id)));
    if (!roots.length) throw new Error('HadeethEnc: no root categories');
    const counts = roots.map(c => Number(c.hadeeths_count) || 0), total = counts.reduce((a, b) => a + b, 0);
    let root, idx = null;
    if (total > 0) {                           // uniform over all hadiths in the allowed roots
      let n = Math.floor(Math.random() * total);
      for (let i = 0; i < roots.length; i++) { if (n < counts[i]) { root = roots[i]; idx = n; break; } n -= counts[i]; }
    } else root = roots[Math.floor(Math.random() * roots.length)];
    let res;
    try { res = await this.list(lang, root.id, idx === null ? 1 : Math.floor(idx / this.per) + 1); }
    catch (e) { if (e.status && e.status < 500) { idx = null; res = await this.list(lang, root.id, 1); } else throw e; }
    if (idx === null) {                        // sizes unknown: learn them from meta, then jump to a random page
      const last = res.lastPage || (res.total ? Math.ceil(res.total / this.per) : 1);
      const p = 1 + Math.floor(Math.random() * last);
      if (p !== 1) res = await this.list(lang, root.id, p);
      idx = Math.floor(Math.random() * Math.max(res.items.length, 1));
    }
    if (!res.items.length) throw new Error('HadeethEnc: empty page');
    return String(res.items[Math.min(idx % this.per, res.items.length - 1)].id);
  },
  one(lang, id, opts) { return fetchJson(`${CONFIG.API.HE}/hadeeths/one/?id=${id}&language=${lang}`, opts); },
  async daily(lang) {
    const day = ymdKey(localYMD()), c = DataStore.get(CONFIG.S.H);
    let id = (c && c.day === day && c.lang === lang) ? c.id : null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!id) { id = await this.pickId(lang); DataStore.set(CONFIG.S.H, { day, lang, id }); }
      try {
        const rec = await this.one(lang, id);
        // HadeethEnc returns the bibliography (`reference`) for Arabic only. For other languages it is fetched from the
        // Arabic record in the background, so a slow or failed extra request never delays or blocks the hadith itself.
        if (lang !== 'ar' && !rec.reference) {
          this.one('ar', id, { retries: 0, timeout: 4000 }).then(ar => {
            if (ar && ar.reference) { rec.reference = ar.reference; if (App.state.hadith === rec) UI.renderHadith(); }
          }).catch(() => { /* bibliography is optional */ });
        }
        return rec;
      }
      catch (e) { if (attempt === 0 && e.status && e.status < 500) { id = null; continue; } throw e; }   // stale/missing id: pick again once
    }
  }
};

/* The interface text, in the five languages: src/locales.js (DAY). The theme and numerals
   buttons' icons (src/page-chrome.js) and labels (the theme loader) are shared by every i360 page. */

/* ---------- Numerals: every number on the page in the shared choice (display only) ----------
   The loader's watchNumerals(): text drawn later (prayer times, countdowns, dates…) too. */
const NUMERALS_SKIP = { skip: 'script, style, #btn-numerals' };

/* ---------- The city: the device time zone's, or one picked by name ---------- */
const City = {
  // The default: the main city of the device's time zone (src/day-cities.json); Makkah otherwise.
  auto() {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* no time zone: Makkah */ }
    const T = DAY_CITIES, id = T.zones[tz] ? tz : T.aliases[tz];
    const z = id && T.zones[id];
    return z ? { cc: z.cc, lat: z.lat, lng: z.lng, tz: id, n: z.n } : MAKKAH;
  },
  // A picked city is kept on the device until another is picked, or "device time zone".
  get() {
    const c = DataStore.get(CONFIG.S.CITY, null);
    return (c && typeof c.lat === 'number' && typeof c.lng === 'number' && c.tz && c.cc) ? c : this.auto();
  },
  picked() { return !!DataStore.get(CONFIG.S.CITY, null); },
  set(c) { if (c) DataStore.set(CONFIG.S.CITY, c); else DataStore.remove(CONFIG.S.CITY); },
  // The name in the page's language: the table has all five; a picked city keeps the name it was picked by.
  name(c, lang) { return (c.n && (c.n[lang] || c.n.en)) || c.name || '—'; },
  // Letters written more than one way, so a search finds the place whichever was typed:
  // Arabic أ/إ/آ/ا, ة/ه, ى/ي; Urdu ہ/ھ/ه. At most 6 searches, sent together.
  variants(q) {
    const out = new Set([q]);
    const bare = q.replace(/[أإآ]/g, 'ا');
    out.add(bare);
    out.add(bare.replace(/(^|\s)(ال)?ا/g, '$1$2أ'));
    out.add(bare.replace(/(^|\s)(ال)?ا/g, '$1$2إ'));
    [[/ة(?=\s|$)/g, 'ه'], [/ه(?=\s|$)/g, 'ة'], [/ى(?=\s|$)/g, 'ي'], [/ي(?=\s|$)/g, 'ى'], [/ہ/g, 'ه'], [/ھ/g, 'ه'], [/ه/g, 'ہ']]
      .forEach(([re, to]) => { if (re.test(q)) out.add(q.replace(re, to)); re.lastIndex = 0; });
    return [...out].slice(0, 6);
  },
  async search(q, lang) {
    const lists = await Promise.all(this.variants(q).map(v =>
      fetchJson(`${CONFIG.API.CITY}?name=${encodeURIComponent(v)}&count=10&language=${lang}&format=json`).then(r => r.results || [])));
    const seen = new Map();
    lists.flat().forEach(p => { if (p && p.id != null && !seen.has(p.id) && typeof p.latitude === 'number' && p.timezone && p.country_code) seen.set(p.id, p); });
    return [...seen.values()].sort((a, b) => (b.population || 0) - (a.population || 0)).slice(0, 10);
  }
};

/* ---------- Prayer times, calculated on the device (adhan-js) ---------- */
const Prayer = {
  KEYS: { Fajr: 'fajr', Sunrise: 'sunrise', Dhuhr: 'dhuhr', Asr: 'asr', Maghrib: 'maghrib', Isha: 'isha' },
  // Today in the city's own time zone; adhan reads the date's year, month and day.
  todayIn(tz) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).map(x => [x.type, x.value]));
    return new Date(+p.year, +p.month - 1, +p.day, 12);
  },
  times(city, school) {
    const a = adhan, method = METHOD_OF[city.cc] || 'MuslimWorldLeague';
    const coords = new a.Coordinates(city.lat, city.lng), params = a.CalculationMethod[method]();
    params.madhab = school === 1 ? a.Madhab.Hanafi : a.Madhab.Shafi;
    params.highLatitudeRule = a.HighLatitudeRule.recommended(coords);        // high latitudes: Adhan's own rule
    params.polarCircleResolution = a.PolarCircleResolution.AqrabYaum;         // no sunrise/sunset: the nearest day with both
    const t = new a.PrayerTimes(coords, this.todayIn(city.tz), params);
    const hm = new Intl.DateTimeFormat('en-GB', { timeZone: city.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const timings = {};
    Object.keys(this.KEYS).forEach(k => { const d = t[this.KEYS[k]]; timings[k] = (d instanceof Date && !isNaN(d)) ? hm.format(d) : ''; });
    return { timings, tz: city.tz, method };
  }
};

/* ---------- App controller ---------- */
const App = {
  state: { quran: null, hadith: null, prayer: null, hijri: null, err: {} },
  tokens: {},
  day: null,
  get lang() { const l = DataStore.get(CONFIG.S.L, 'ar'); return LOCALES[l] ? l : 'ar'; },
  get school() { return DataStore.get(CONFIG.S.M, 0) === 1 ? 1 : 0; },
  setLang(l) {
    DataStore.set(CONFIG.S.L, l);
    this.state.quran = null; this.state.hadith = null; this.state.err.quran = null; this.state.err.hadith = null;
    UI.render();                                        // labels, dates and methods re-render from state
    ['quran', 'hadith'].forEach(n => this.run(n));      // only the language-dependent requests are repeated
  },
  setSchool(s) { DataStore.set(CONFIG.S.M, s); UI.renderSchool(); this.run('prayer'); },
  setCity(c) { City.set(c); this.run('prayer'); },
  loaders: {
    async quran(lang) {
      const day = ymdKey(localYMD());
      let rec = DataStore.get(CONFIG.S.Q);
      if (!rec || rec.day !== day) { rec = { day, id: Math.floor(Math.random() * 6236) + 1 }; DataStore.set(CONFIG.S.Q, rec); }
      return fetchJson(`${CONFIG.API.Q}/${rec.id}/editions/quran-uthmani,${CONFIG.EDITIONS.quran[lang]}`);
    },
    hadith: lang => HE.daily(lang),
    async prayer() { return Prayer.times(City.get(), App.school); }   // on the device: nothing is sent
  },
  async run(name) {
    const id = this.tokens[name] = (this.tokens[name] || 0) + 1;     // drop answers that arrive after a newer request
    UI.status(name, 'loading');
    try {
      const data = await this.loaders[name](this.lang);
      if (this.tokens[name] !== id) return;
      this.state[name] = data; this.state.err[name] = null;
      if (name === 'prayer') this.prayerDay = Prayer.todayIn(data.tz).getDate();
    } catch (e) {
      if (this.tokens[name] !== id) return;
      console.error(`[${name}]`, e);
      this.state[name] = (name === 'prayer') ? this.state[name] : null;   // keep old prayer times if a refresh fails
      this.state.err[name] = e;
    }
    UI.renderPart(name);
  },
  load() {
    this.day = ymdKey(localYMD());
    this.state.hijri = Hijri.sync();                       // instant offline answer...
    UI.render();
    Hijri.resolve().then(h => { this.state.hijri = h; UI.renderHijri(); UI.renderEvents(); Conv.render(); }).catch(e => console.error('[hijri]', e));   // ...upgraded to Dar al-Ifta when it answers
    ['quran', 'hadith', 'prayer'].forEach(n => this.run(n));
  },
  retry(name) { this.run(name); },
  tick() {                                                    // every 30s: new local day -> reload; otherwise refresh the NEXT highlight
    if (ymdKey(localYMD()) !== this.day) this.load();
    else if (this.state.prayer && Prayer.todayIn(this.state.prayer.tz).getDate() !== this.prayerDay) this.run('prayer');   // the city's own new day
    else UI.renderPrayers();
  }
};

// "Cairo, Egypt": the country's name from the browser, in the page's language.
function cityLabel(c, lang) {
  let country = '';
  try { country = new Intl.DisplayNames([lang], { type: 'region' }).of(c.cc) || ''; } catch (e) { /* the city alone */ }
  const city = City.name(c, lang);
  return country && country !== city ? `${city}${listSep(lang)}${country}` : city;
}

/* ---------- The city picker: opened from the prayer card; searches only after typing pauses ---------- */
const Picker = {
  open: false, token: 0, results: [], state: '', timer: 0,
  init() {
    this.box = $('city-picker');
    this.input = $('city-search');
    this.btn = $('city-change');
    this.btn.addEventListener('click', () => this.toggle());
    this.input.addEventListener('input', () => { clearTimeout(this.timer); this.timer = setTimeout(() => this.search(), 500); });
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.toggle(false); });
  },
  toggle(on = !this.open) {
    this.open = on;
    this.box.classList.toggle('hidden', !on); this.box.classList.toggle('flex', on);
    this.btn.setAttribute('aria-expanded', on);
    if (on) { this.input.value = ''; this.results = []; this.state = ''; this.render(); this.input.focus(); }
  },
  async search() {
    const q = this.input.value.trim(), id = ++this.token;
    if (q.length < 2) { this.results = []; this.state = ''; this.render(); return; }
    this.state = 'loading'; this.render();
    try {
      const found = await City.search(q, App.lang);
      if (id !== this.token) return;
      this.results = found; this.state = found.length ? '' : 'none';
    } catch (e) {
      if (id !== this.token) return;
      console.error('[city]', e); this.results = []; this.state = 'error';
    }
    this.render();
  },
  choose(c) { this.toggle(false); App.setCity(c); },
  render() {
    const L = UI.L, lang = App.lang, list = UI.targets['city-results'];
    this.input.placeholder = L.citySearch; this.input.setAttribute('aria-label', L.citySearch);
    UI.set('city-status', { loading: L.loading, none: L.cityNone, error: L.loadError }[this.state] || '');
    const row = (label, sub, on, pick) => {
      const b = el('button', `i360-list-item${on ? ' active-btn' : ''}`);
      b.type = 'button'; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', on);
      b.append(el('span', 'font-bold', label)); if (sub) b.append(el('span', 'text-sm ms-sm', sub));
      b.addEventListener('click', pick);
      return b;
    };
    // First: back to the device time zone's city.
    const rows = [row(L.deviceTz, cityLabel(City.auto(), lang), !City.picked(), () => this.choose(null))];
    const sep = listSep(lang);
    this.results.forEach(p => rows.push(row(p.name, [p.admin1, p.country].filter(Boolean).join(sep), false,
      () => this.choose({ name: p.name, n: { [lang]: p.name }, lat: p.latitude, lng: p.longitude, tz: p.timezone, cc: p.country_code }))));
    list.replaceChildren(...rows);
  }
};

/* ---------- Language menu ---------- */
// The bar's language button: the current language's short name; it opens the list of the five.
// Closes on a choice, on Escape (focus back on the button) or on a tap outside.
const LANG_SHORT = { ar: 'ع', ur: 'ار', id: 'ID', tr: 'TR', en: 'EN' };
const LangMenu = {
  init() {
    this.btn = $('btn-lang'); this.list = $('lang-list');
    this.btn.addEventListener('click', () => (this.list.hidden ? this.open() : this.close(true)));
    document.addEventListener('click', e => { if (!this.list.hidden && !e.target.closest('.lang-wrap')) this.close(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !this.list.hidden) this.close(true); });
  },
  open() {
    this.list.hidden = false; this.btn.setAttribute('aria-expanded', 'true');
    (this.list.querySelector('[aria-pressed="true"]') || this.list.querySelector('button')).focus();
  },
  close(focusButton) {
    if (this.list.hidden) return;
    this.list.hidden = true; this.btn.setAttribute('aria-expanded', 'false');
    if (focusButton) this.btn.focus();
  }
};

/* ---------- Two columns, where they fit (see the .cards styles) ---------- */
const Cols = {
  init() {
    this.a = $('col-a'); this.b = $('col-b');
    this.prayer = $('prayer-card');
    this.grid = this.prayer.querySelector('[data-target="prayer-grid"]');
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => this.queue());
      [$('cards'), this.a, this.prayer].forEach(e => ro.observe(e));
    }
    window.addEventListener('resize', () => this.queue());
    this.queue();
  },
  queue: oncePerFrame(() => Cols.fit()),
  // The prayer times: all six in one row where each one's name and time fit in its box, otherwise
  // three to a row — measured, as drawn, never a width breakpoint.
  fitPrayers() {
    const g = this.grid, boxes = [...g.children];
    if (!boxes.length) return;
    g.style.gridTemplateColumns = `repeat(${boxes.length}, minmax(0, 1fr))`;
    if (boxes.some(b => b.scrollWidth > b.clientWidth)) g.style.gridTemplateColumns = '';
  },
  // Two columns or one, as laid out (the events card below widens with it, and the top bar).
  fit() {
    if (!this.a) return;
    this.fitPrayers();
    const side = this.a.offsetTop === this.b.offsetTop && this.a.offsetLeft !== this.b.offsetLeft;
    document.body.classList.toggle('two-cols', side);
  }
};

/* ---------- The date converter (Seif 2026-11-15; i360-daily-reflection.md) ----------
   One direction at a time (the swap button), each a day list, a month list and a year box; the
   answer as the long date (weekday first, its calendar's mark last) and the numeric one (year
   first). Calculated by the shared calculator, shifted by the offset measured from the Worker's
   date (k), as the events are; so labelled calculated, with the note that it can be a day or two
   off. Arabic Gregorian months carry the Levantine name too (CONFIG.CONV_SECOND_MONTHS). */
const Conv = {
  dir: 'g2h', d: 0, m: 0, y: '',
  init() {
    this.el = { d: $('conv-d'), m: $('conv-m'), y: $('conv-y'), pick: $('conv-pick'), pickBtn: $('conv-pick-btn'), native: $('conv-native') };
    const t = localYMD();
    Object.assign(this, { d: t.d, m: t.m, y: String(t.y) });
    // The browser's date picker can be opened from a button only where it has showPicker (Safari 16+).
    this.canPick = typeof this.el.native.showPicker === 'function';
    this.el.d.addEventListener('change', () => { this.d = +this.el.d.value; this.render(); });
    this.el.m.addEventListener('change', () => { this.m = +this.el.m.value; this.d = Math.min(this.d, this.days()); this.render(); });
    this.el.y.addEventListener('input', () => { this.y = this.el.y.value; if (this.d) this.d = Math.min(this.d, this.days()); this.render(false); });
    this.el.y.addEventListener('change', () => this.render());
    this.el.pickBtn.addEventListener('click', () => {
      try { this.el.native.showPicker(); } catch (e) { console.warn('[converter] date picker:', e); }
    });
    this.el.native.addEventListener('change', () => {
      const dt = HijriCalc.parseYMD(this.el.native.value); if (!dt) return;
      Object.assign(this, { d: dt.getUTCDate(), m: dt.getUTCMonth() + 1, y: String(dt.getUTCFullYear()) });
      this.render();
    });
    $('conv-swap').addEventListener('click', () => this.swap());
  },
  get k() { return App.state.hijri ? App.state.hijri.k : 0; },
  get g() { return this.dir === 'g2h'; },
  year() { const v = i360Theme.toNumerals(this.y, 'western').trim(); return /^\d+$/.test(v) ? parseInt(v, 10) : null; },
  // Days in the chosen month: Hijri 1–30 (the calculation says which 30ths exist); Gregorian by
  // month and year — with no year yet, the most that month ever has (a leap year is one of four).
  days() {
    if (!this.g) return 30;
    if (!this.m) return 31;
    const y = this.year(), last = yy => { const t = new Date(0); t.setUTCFullYear(yy, this.m, 0); return t.getUTCDate(); };
    if (y !== null && y >= 1) return last(y);
    const now = new Date().getFullYear();
    return Math.max(...[0, 1, 2, 3].map(i => last(now + i)));
  },
  monthNames(lang) {
    return this.g ? gregorianMonthNames(lang, CONFIG.CONV_SECOND_MONTHS[lang]) : this.L.months;
  },
  get L() { return UI.L; },
  // The answer: { alpha, iso, mark } or { error }, and the same date in the other calendar (carry).
  result(lang) {
    const L = this.L, y = this.year();
    if (this.y.trim() === '' || !this.d || !this.m) return null;
    if (y === null || y < 1) return { error: L.convRange };
    if (this.g) {
      const civil = `${String(y).padStart(4, '0')}-${pad(this.m)}-${pad(this.d)}`, dt = HijriCalc.parseYMD(civil);
      if (!dt) return { error: L.convRange };                       // past the four-digit years
      const h = HijriCalc.fromCivil(civil, this.k);
      if (!h || h.y < 1) return { error: L.convRange };             // before 1 AH
      return { alpha: hijriLong(h, L.months, { weekday: dt, lang, mark: L.markH }), iso: numericDate(h.y, h.m, h.d), mark: L.markH, carry: h };
    }
    const h = { y, m: this.m, d: this.d }, civil = HijriCalc.toCivil(h, this.k);
    if (!civil) return { error: this.d === 30 && HijriCalc.toCivil({ ...h, d: 29 }, this.k) ? L.convNoDay : L.convRange };
    const dt = HijriCalc.parseYMD(civil), g = { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
    // The browser's own long date in the page's language; Arabic adds the Levantine month name.
    return { alpha: gregorianLong(dt, lang, { second: CONFIG.CONV_SECOND_MONTHS[lang], mark: L.markG }), iso: numericDate(g.y, g.m, g.d), mark: L.markG, carry: g };
  },
  swap() {
    const r = this.result(App.lang);
    this.dir = this.g ? 'h2g' : 'g2h';
    if (r && r.carry) Object.assign(this, { d: r.carry.d, m: r.carry.m, y: String(r.carry.y) });
    else {   // nothing to carry over: today, in the new calendar
      const t = localYMD(), h = this.g ? null : HijriCalc.fromCivil(ymdKey(t), this.k);
      Object.assign(this, this.g ? { d: t.d, m: t.m, y: String(t.y) } : { d: h.d, m: h.m, y: String(h.y) });
    }
    this.render();
  },
  // fields = false while typing in the year box: its text is left as typed.
  render(fields = true) {
    if (!this.el) return;
    const L = this.L, lang = App.lang, box = this.el, num = i360Theme.getNumerals();
    UI.set('conv-dir', this.g ? L.convG2H : L.convH2G);
    const sw = $('conv-swap'); sw.title = L.convSwap; sw.setAttribute('aria-label', `${L.convSwap}: ${this.g ? L.convG2H : L.convH2G}`);
    $('conv-fields').setAttribute('aria-label', this.g ? L.convG2H : L.convH2G);
    const option = (value, text, placeholder) => { const o = el('option', '', text); o.value = value; if (placeholder) { o.disabled = true; } return o; };
    const days = this.days();
    if (this.d > days) this.d = days;
    box.d.replaceChildren(option('', L.convDay, true), ...Array.from({ length: days }, (_, i) => option(i + 1, String(i + 1))));
    box.d.value = this.d ? String(this.d) : '';
    box.m.replaceChildren(option('', L.convMonth, true), ...this.monthNames(lang).map((n, i) => option(i + 1, `${i + 1}. ${n}`)));
    box.m.value = this.m ? String(this.m) : '';
    box.y.placeholder = i360Theme.toNumerals(this.g ? L.convYearHintG : L.convYearHintH, num);
    if (fields) box.y.value = i360Theme.toNumerals(this.y, num);
    box.pick.hidden = !(this.g && this.canPick);
    setLabel(box.pickBtn, L.convPick);
    const r = this.result(lang), isoBox = UI.targets['conv-iso'], err = UI.targets['conv-error'];
    if (this.g) { const y = this.year(); box.native.value = (r && r.carry && y !== null) ? `${String(y).padStart(4, '0')}-${pad(this.m)}-${pad(this.d)}` : ''; }
    UI.set('conv-alpha', r && !r.error ? r.alpha : '');
    // The numeric date left to right (year first) and the mark after it, at the line's end.
    if (r && !r.error) isoBox.replaceChildren(`${r.iso} ${r.mark}`); else isoBox.replaceChildren();
    err.hidden = !(r && r.error); err.textContent = r && r.error ? r.error : '';
    // The label and the note on one line: the label ends its sentence (Urdu: «۔»).
    UI.set('conv-label', `${HijriCalc.label(HijriCalc.SOURCES.CALC, lang)}${lang === 'ur' ? '۔' : '.'}`);
    Cols.queue();
  }
};


/* ---------- UI ---------- */
const UI = {
  targets: {}, shown: false,
  get L() { return LOCALES[App.lang] || LOCALES.ar; },
  init() {
    document.querySelectorAll('[data-target]').forEach(node => this.targets[node.dataset.target] = node);
    document.querySelectorAll('[data-status]').forEach(node => {
      node.querySelector('[data-retry]').addEventListener('click', () => App.retry(node.dataset.status));
    });
    document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { LangMenu.close(true); App.setLang(b.dataset.lang); }));
    LangMenu.init();
    document.querySelectorAll('[data-school]').forEach(b => b.addEventListener('click', () => App.setSchool(+b.dataset.school)));
    Picker.init();
    setupClose($('btn-close'));   // in the installed app, ✕ returns home (src/page-chrome.js)
    wireSettingsButtons($('btn-theme'), $('btn-numerals'));
    i360Theme.onChange(() => this.settingsButtons());
    i360Theme.onNumeralsChange(() => { this.settingsButtons(); Conv.render(); });
    i360Theme.watchNumerals(document.body, NUMERALS_SKIP);   // converts the page now and on every change, after the button
    this.settingsButtons();
    i360Theme.init();   // fresh theme.css in the background; the saved copy is already shown
    Cols.init();
    Conv.init();
    App.load();
    setInterval(() => App.tick(), 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) App.tick(); });
  },
  settingsButtons() { drawSettingsButtons($('btn-theme'), $('btn-numerals'), App.lang); },   // in the page's language
  set(t, v) { if (this.targets[t]) this.targets[t].textContent = v; },
  status(name, kind) {
    const box = document.querySelector(`[data-status="${name}"]`); if (!box) return;
    const L = this.L, btn = box.querySelector('[data-retry]'), txt = box.querySelector('[data-status-text]');
    if (!kind) { box.classList.add('hidden'); box.classList.remove('flex'); return; }
    box.classList.remove('hidden'); box.classList.add('flex');
    txt.textContent = kind === 'loading' ? L.loading : L.loadError;
    btn.textContent = L.retry; btn.classList.toggle('hidden', kind === 'loading');
  },
  reveal() {
    if (this.shown) return; this.shown = true;
    ['quran-card', 'hadith-card', 'prayer-card', 'converter-card', 'events-card'].forEach((id, i) => setTimeout(() => {
      const e = $(id); if (e) { e.style.opacity = 1; e.style.transform = 'translateY(0)'; }
    }, i * 120));
  },
  render() {
    const L = this.L, lang = App.lang;
    document.documentElement.lang = lang; document.documentElement.dir = L.dir;
    document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = L[node.dataset.i18n] || LOCALES.en[node.dataset.i18n]; });
    document.querySelectorAll('[data-lang]').forEach(node => { const on = node.dataset.lang === lang; node.classList.toggle('active-btn', on); node.setAttribute('aria-pressed', on); });
    const lb = $('btn-lang'), cur = $(`lang-${lang}`);
    $('lang-short').textContent = LANG_SHORT[lang];
    setLabel(lb, `${L.language}: ${cur.textContent}`);
    this.settingsButtons();   // their tooltips are in the page's language
    setLabel($('btn-close'), L.close);
    document.title = L.title;   // the tab name follows the language too
    this.renderSchool();
    this.renderHijri();
    ['quran', 'hadith', 'prayer'].forEach(n => this.renderPart(n));
    this.renderCredits();
    if (Picker.open) Picker.render();
    this.renderEvents();
    Conv.render();
    this.reveal();
  },
  // Credits (Open-Meteo and GeoNames: CC BY 4.0; Adhan: MIT), in the page's language, on two lines.
  renderCredits() {
    const L = this.L, box = this.targets.credits; if (!box) return;
    const link = (text, href) => { const a = el('a', 'underline', text); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
    box.replaceChildren(
      document.createTextNode(`${L.creditCities}: `), link('Open-Meteo', 'https://open-meteo.com/'), document.createTextNode(' · '),
      link('GeoNames', 'https://www.geonames.org/'), document.createElement('br'), document.createTextNode(`${L.creditPrayer}: `),
      link('Adhan', 'https://github.com/batoulapps/adhan-js'));
  },
  renderSchool() {
    [0, 1].forEach(s => { const b = $(`school-${s}`); if (!b) return; const on = App.school === s; b.setAttribute('aria-pressed', on); });
  },
  renderHijri() {
    const L = this.L, h = App.state.hijri; if (!h) return;
    this.set('current-date', gregorianLong(new Date(), App.lang, { timeZone: undefined }));   // today on this device
    this.set('hijri-date', hijriLong(h.today, L.months));
    const src = this.targets['hijri-source'];
    if (src) {
      const icon = h.provisional ? [svgIcon(PROVISIONAL_ICON)] : [];
      src.replaceChildren(...icon, document.createTextNode(Hijri.label(h, App.lang)));
    }
  },
  renderPart(name) {
    const fn = { quran: 'renderQuran', hadith: 'renderHadith', prayer: 'renderPrayers' }[name];
    this[fn]();
    this.status(name, App.state.err[name] ? 'error' : (App.state[name] ? null : (App.tokens[name] ? 'loading' : null)));
  },
  renderQuran() {
    const q = App.state.quran, lang = App.lang;
    if (!q) { ['quran-arabic', 'quran-translation', 'quran-ref'].forEach(t => this.set(t, '')); return; }
    this.set('quran-arabic', q.data[0].text);
    this.set('quran-translation', q.data[1].text);
    this.set('quran-ref', `${(lang === 'ar' || lang === 'ur') ? q.data[0].surah.name : q.data[0].surah.englishName} (${q.data[0].surah.number}:${q.data[0].numberInSurah})`);
  },
  renderHadith() {
    const h = App.state.hadith, L = this.L, lang = App.lang;
    const hide = (node, on) => { if (node) node.classList.toggle('hidden', on); };
    if (!h) {
      ['hadith-title', 'hadith-narrator', 'hadith-text', 'hadith-grade', 'hadith-ref'].forEach(t => this.set(t, ''));
      hide(this.targets['hadith-narrator'], true); hide($('hadith-refs'), true); return;
    }
    this.set('hadith-title', h.title || '');
    /* HadeethEnc returns the opening line naming the Companion (the highest narrator) as `hadeeth_intro`.
       It is shown on its own line; every character of the text is still displayed (its terms forbid deleting any).
       If the field is missing, or the text doesn't begin with it, the whole text is shown as one block. */
    const full = h.hadeeth || '', intro = (h.hadeeth_intro || '').trim();
    let narrator = '', body = full;
    if (intro && full.trimStart().startsWith(intro)) {
      const rest = full.trimStart().slice(intro.length).trim();
      if (rest) { narrator = intro; body = rest; }
    }
    this.set('hadith-narrator', narrator); hide(this.targets['hadith-narrator'], !narrator);
    this.set('hadith-text', body);
    this.set('hadith-grade', [h.grade ? `${L.gradeLabel}: ${h.grade}` : '', h.attribution || ''].filter(Boolean).join(' · '));
    /* `reference` is HadeethEnc's bibliography (editions used), Arabic only. Kept in full, collapsed by default. */
    const refs = (h.reference || '').trim();
    this.set('hadith-ref', refs); hide($('hadith-refs'), !refs);
    const a = this.targets['hadith-link']; if (a) a.href = `https://hadeethenc.com/${lang}/browse/hadith/${encodeURIComponent(h.id)}`;
  },
  renderPrayers() {
    const L = this.L, p = App.state.prayer, lang = App.lang;
    this.set('meta-location', cityLabel(City.get(), lang));
    const grid = this.targets['prayer-grid'];
    if (!p) { grid.replaceChildren(); this.set('meta-method', '—'); this.set('meta-timezone', '—'); return; }
    const t = p.timings, tz = p.tz;
    const toMin = k => { const m = /(\d{1,2}):(\d{2})/.exec(t[k] || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
    const now = minutesNowIn(tz);
    let next = CONFIG.P_NEXT_KEYS.find(k => toMin(k) !== null && toMin(k) > now);
    if (!next) next = 'Fajr';                                 // after Isha the next prayer is tomorrow's Fajr
    grid.replaceChildren(...CONFIG.P_KEYS.map((k, i) => {
      const isNext = k === next, m = /(\d{1,2}):(\d{2})/.exec(t[k] || '');
      const box = el('div', `flex flex-col items-center p-sm transition-all ${isNext ? 'next-prayer-highlight' : 'i360-inset'}`);
      box.append(
        el('span', `text-sm font-bold ${isNext ? 'text-accent' : 'text-custom-secondary'}`, L.prayers[i]),
        el('span', `text-base font-bold mt-xs ${isNext ? 'text-accent' : 'text-custom-secondary'}`, m ? m[0] : '—'));
      if (isNext) box.append(el('span', 'text-sm mt-xs font-bold text-accent animate-pulse', L.next));
      return box;
    }));
    const names = METHOD_NAMES[p.method];
    this.set('meta-method', names ? names[lang === 'ar' ? 0 : 1] : '—');
    let tzText = tz || '—';
    try { const n = new Intl.DateTimeFormat(lang, { timeZone: tz, timeZoneName: 'long' }).formatToParts(new Date()).find(x => x.type === 'timeZoneName'); if (n) tzText = n.value; } catch (e) { /* localized name only; the raw IANA id stays as the fallback */ }
    this.set('meta-timezone', tzText);
    Cols.queue();
  },
  renderEvents() {
    const L = this.L, lang = App.lang, h = App.state.hijri, list = this.targets['events-list'];
    if (!h || !list) return;
    const note = this.targets['events-note'];
    if (note) {
      const a = el('a', 'underline', L.sourceLabel);
      a.href = CONFIG.DAY_NOTE_SOURCE; a.target = '_blank'; a.rel = 'noopener noreferrer';
      note.replaceChildren(`${L.eventsNote} (`, a, ')');
    }
    list.replaceChildren(...Hijri.events(h).map(e => {
      const row = el('div', `flex justify-between items-center gap-md p-md transition-all ${e.isT ? 'border-2 border-event bg-event-bg rounded-lg' : 'i360-inset'}`);
      const left = el('div', 'flex-1'), title = el('div', 'flex items-center gap-sm');
      title.append(el('span', 'text-base font-bold text-custom-secondary', L.events[e.id]));
      if (e.isT) title.append(el('span', 'bg-event text-page text-sm font-bold px-sm rounded-full', L.todayLabel));
      left.append(title, el('span', 'text-sm text-custom-secondary font-bold', hijriLong({ y: e.year, m: e.m + 1, d: e.d }, L.months)));
      const right = el('div', 'text-end');
      right.append(
        el('span', 'text-sm uppercase font-bold text-event block', L.expected),
        el('span', 'text-sm font-bold text-custom-secondary', gregorianLong(e.date, lang)));
      row.append(left, right);
      return row;
    }));
    Cols.queue();
  }
};
document.addEventListener('DOMContentLoaded', () => { UI.init(); });
