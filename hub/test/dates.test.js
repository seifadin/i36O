// dates.js: the one place pages write dates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { numericDate, gregorianLong, gregorianMonthNames, hijriLong, weekdayName, listSep } from '../src/dates.js';

const visible = (s) => s.replace(/[⁦⁩‎]/g, '');

test('numericDate: year-month-day, held in order in any direction and with any digits', () => {
  const s = numericDate(1448, 6, 5);
  assert.equal(visible(s), '1448-06-05');
  assert.ok(s.startsWith('⁦') && s.endsWith('⁩'), 'a left-to-right isolate');
  assert.equal((s.match(/‎-‎/g) || []).length, 2, 'a left-to-right mark on each side of each "-"');
  assert.equal(visible(numericDate(622, 7, 18)), '0622-07-18');
});

test('gregorianLong: the browser\'s long date, with the weekday, the second month name and the mark when asked', () => {
  const dt = new Date(Date.UTC(2026, 10, 15));
  assert.equal(gregorianLong(dt, 'en'), 'Sunday, November 15, 2026');
  assert.equal(gregorianLong(dt, 'en', { weekday: false }), 'November 15, 2026');
  assert.equal(gregorianLong(dt, 'ar', { second: 'ar-SY', mark: 'م' }), 'الأحد، 15 نوفمبر (تشرين الثاني) 2026 م');
  assert.match(gregorianLong(dt, 'ar'), /^الأحد، 15 نوفمبر 2026$/);
});

test('gregorianMonthNames: in the language, the second name in brackets when asked', () => {
  assert.equal(gregorianMonthNames('en')[0], 'January');
  assert.equal(gregorianMonthNames('ar', 'ar-SY')[0], 'يناير (كانون الثاني)');
  assert.equal(gregorianMonthNames('ar').length, 12);
});

test('hijriLong: day, month name, year; the weekday and the mark when asked', () => {
  const months = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة'];
  assert.equal(hijriLong({ y: 1448, m: 6, d: 5 }, months), '5 جمادى الآخرة 1448');
  assert.equal(hijriLong({ y: 1448, m: 6, d: 5 }, months, { weekday: new Date(Date.UTC(2026, 10, 15)), lang: 'ar', mark: 'هـ' }), 'الأحد، 5 جمادى الآخرة 1448 هـ');
  assert.equal(weekdayName(new Date(Date.UTC(2026, 10, 15)), 'en'), 'Sunday');
  assert.equal(listSep('ur'), '، ');
  assert.equal(listSep('tr'), ', ');
});
