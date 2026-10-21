import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { buildTimetableExcel, sheetClock, timetableFilename, timetableSheet } from '../src/lib/timetableSheet.ts';

const k = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const data: any = {
  uid: 'me', admin: false,
  students: [
    {studentKey: k(1), studentDisplayName: '김민준 (용인중1)'}, {studentKey: k(2), studentDisplayName: '이서연 (평여중1)'},
    {studentKey: k(3), studentDisplayName: '박하늘 (고덕중2)'}, {studentKey: k(4), studentDisplayName: '최다은 (이충중3)'},
  ],
  classes: [
    {id: 'c1', name: '중1반', status: '진행 중', ownerUid: 'me', students: [k(1), k(2)], slots: [
      {id: 's1', weekday: 1, start: '16:10', end: '17:30', kind: 'lesson', study: [{start: '17:30', end: '18:30', students: [k(1)]}, {start: '17:30', end: '18:30', students: [k(2)]}]},
      {id: 's2', weekday: 3, start: '17:30', end: '18:30', kind: 'test', students: [k(2)]},
      {id: 's3', weekday: 2, start: '16:00', end: '17:00', status: '중단'},
    ]},
    {id: 'c2', name: '섞인 반', status: '진행 중', ownerUid: 'other', assignedUids: ['me'], students: [k(3), k(4)], slots: [
      {id: 's4', weekday: 1, start: '18:50', end: '20:10', study: [{start: '20:10', end: '21:10'}]},
    ]},
    {id: 'c3', name: '남의 반', status: '진행 중', ownerUid: 'other', students: [k(1)], slots: [{weekday: 1, start: '10:00', end: '11:00'}]},
    {id: 'c4', name: '멈춘 반', status: '중단', ownerUid: 'me', students: [k(1)], slots: [{weekday: 1, start: '09:00', end: '10:00'}]},
  ],
  schedules: [
    {id: 'h', ownerUid: 'me', data: {date: '2026-10-19', start: '16:10', end: '17:30', kind: '휴강', status: '예정', students: [k(1)]}},
    {id: 'b', ownerUid: 'me', data: {date: '2026-10-21', start: '19:00', end: '20:20', kind: '보강', status: '예정', students: [k(1)]}},
    {id: 's', ownerUid: 'me', data: {date: '2026-10-21', start: '17:30', end: '18:30', kind: '자습', status: '변경', students: [k(3)]}},
    {id: 't', ownerUid: 'me', data: {date: '2026-10-22', start: '15:40', end: '16:40', kind: '테스트', status: '예정', students: [k(4)]}},
    {id: 'x', ownerUid: 'me', data: {date: '2026-10-22', start: '15:00', end: '16:00', kind: '보강', status: '취소', students: [k(4)]}},
    {id: 'o', ownerUid: 'other', data: {date: '2026-10-22', start: '15:00', end: '16:00', kind: '보강', status: '예정', students: [k(4)]}},
    {id: 'd', ownerUid: 'me', deleteRequested: true, data: {date: '2026-10-22', start: '15:00', end: '16:00', kind: '보강', status: '예정', students: [k(4)]}},
  ],
};

test('시간표: afternoon times without 오후, as the academy writes them', () => {
  assert.equal(sheetClock('16:10'), '4:10'); assert.equal(sheetClock('09:05'), '9:05'); assert.equal(sheetClock('12:30'), '12:30'); assert.equal(sheetClock('00:00'), '12:00');
});

test('정규 시간표: my and assigned classes (not 중단), grade after the time, 자습 at the same time on one line, 3차시 under Test', () => {
  const sheet = timetableSheet(data, 'regular', '2026-10-19', '이지원 T');
  assert.equal(sheet.title, '10월 시간표'); assert.equal(sheet.teacher, '이지원 T');
  assert.deepEqual(sheet.days.map(d => d.label), ['월', '화', '수', '목', '금', '토', '일']);
  const mon = sheet.days[0];
  assert.deepEqual(mon.lesson, ['4:10~5:30 (중1)', '김민준, 이서연', '6:50~8:10 (중2·중3)', '박하늘, 최다은']);
  assert.deepEqual(mon.study, ['5:30~6:30 김민준, 이서연', '8:10~9:10 박하늘, 최다은']);
  assert.deepEqual(sheet.days[1].lesson, [], '중단 line left out');
  assert.deepEqual(sheet.days[2].test, ['5:30~6:30 이서연']);
  assert.equal(timetableFilename(sheet), '10월 시간표_이지원 T.xlsx');
});

test('이번 주: 휴강 takes out the lesson and its 자습 for those students; 보강·자습·테스트 add lines; 취소, others\' and deleted ignored', () => {
  const sheet = timetableSheet(data, 'week', '2026-10-22', '이지원 T');
  assert.equal(sheet.title, '10/19~10/25 시간표');
  assert.equal(sheet.days[0].label, '월 10/19');
  assert.deepEqual(sheet.days[0].lesson, ['4:10~5:30 (중1)', '이서연', '6:50~8:10 (중2·중3)', '박하늘, 최다은']);
  assert.deepEqual(sheet.days[0].study, ['5:30~6:30 이서연', '8:10~9:10 박하늘, 최다은']);
  assert.deepEqual(sheet.days[2].lesson, ['7:00~8:20 (중1)', '김민준']);
  assert.deepEqual(sheet.days[2].study, ['5:30~6:30 박하늘']);
  assert.deepEqual(sheet.days[2].test, ['5:30~6:30 이서연']);
  assert.deepEqual(sheet.days[3].test, ['3:40~4:40 최다은']);
  assert.deepEqual(sheet.days[3].lesson, []);
});

test('Excel: the academy template filled in, rows taller for long cells, no data from the original file', async () => {
  const template = readFileSync(new URL('../public/templates/timetable.xlsx', import.meta.url));
  const zip0 = await JSZip.loadAsync(template);
  assert.equal(await zip0.file('xl/sharedStrings.xml')!.async('string').then(s => /<si>/.test(s)), false, 'the template holds no names');
  const sheet = timetableSheet(data, 'regular', '2026-10-19', '이지원 T');
  sheet.days[4].lesson = Array.from({length: 30}, (_, i) => `줄 ${i} & <특수>`);
  const zip = await JSZip.loadAsync(await buildTimetableExcel(template, sheet));
  const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  assert.match(xml, /<c r="C2" s="0" t="inlineStr"><is><t xml:space="preserve">10월 시간표<\/t>/);
  assert.match(xml, /<c r="I2" s="9" t="inlineStr"><is><t xml:space="preserve">이지원 T<\/t>/);
  assert.match(xml, /<c r="C3" s="2" t="inlineStr"><is><t xml:space="preserve">월<\/t>/);
  assert.match(xml, /<c r="C4" s="4" t="inlineStr"><is><r><rPr><b\/><sz val="10"\/>[^]*?<t xml:space="preserve">4:10~5:30 \(중1\)\n<\/t><\/r><r><rPr><sz val="10"\/>[^]*?<t xml:space="preserve">김민준, 이서연/, 'the 수업 time line bold (as the academy sheet), the names not');
  assert.match(xml, /<c r="B5" s="6" t="inlineStr"><is><t xml:space="preserve">자습\n\(1,2차시\)<\/t>/);
  assert.match(xml, /줄 0 &amp; &lt;특수&gt;/);
  assert.match(xml, /<row r="4" ht="413\.00" customHeight="1">/, '30 lines: 30 × 13.5 + 8');
  assert.match(xml, /<row r="5" ht="125\.25" customHeight="1">/, 'short cells keep the template height');
  assert.match(xml, /<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="1"\/>/);
});
