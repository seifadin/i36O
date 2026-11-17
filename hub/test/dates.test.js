// dates.js: the one place pages write dates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { numericDate, dayFirstToNumeric, timestamp, gregorianLong, gregorianMonthNames, hijriLong, weekdayName, listSep } from '../src/dates.js';

const visible = (s) => s.replace(/[⁦⁩‎]/g, '');

test('numericDate: year-month-day, held in order in any direction and with any digits', () => {
  const s = numericDate(1448, 6, 5);
  assert.equal(visible(s), '1448-06-05');
  assert.ok(s.startsWith('⁦') && s.endsWith('⁩'), 'a left-to-right isolate');
  assert.equal((s.match(/‎-‎/g) || []).length, 2, 'a left-to-right mark on each side of each "-"');
  assert.equal(visible(numericDate(622, 7, 18)), '0622-07-18');
});

test('dayFirstToNumeric: every d-m-yyyy in a text becomes a held, year-first numericDate; nothing else changes', () => {
  const line = 'إصدار 0.14.0 @ 22-10-2026 م / 30-04-1448 هـ';
  const out = dayFirstToNumeric(line);
  assert.equal(visible(out), 'إصدار 0.14.0 @ 2026-10-22 م / 1448-04-30 هـ');
  assert.equal(out.split(numericDate(2026, 10, 22)).length, 2, 'held exactly as numericDate holds it');
  assert.ok(out.includes(numericDate(1448, 4, 30)));
  assert.equal(visible(dayFirstToNumeric('5-6-1448')), '1448-06-05');
  for (const plain of ['إصدار -', '0.14.0', '2026-10-22', '122-10-2026', '22-10-20261']) assert.equal(dayFirstToNumeric(plain), plain);
});

test('timestamp: plain ISO in UTC with the time, no direction marks', () => {
  assert.equal(timestamp(new Date(Date.UTC(2026, 10, 17, 21, 51))), '2026-11-17T21:51:00.000Z');
  assert.match(timestamp(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(visible(timestamp()), timestamp());
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
