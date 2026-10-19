import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTimetableExcel, timetableSheet } from '../src/lib/timetableSheet.ts';
import { namesIn, parseEntries, parseLessons, planImport, readSheetCells, sheetTime, type SheetCells } from '../src/lib/timetableImport.ts';

const k = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const base = (): any => ({
  uid: 'me',
  teachingScopes: [1, 2, 3, 4, 5].map(n => ({studentKey: k(n), subject: '영어'})),
  students: [
    {studentKey: k(1), studentDisplayName: '김민준 (용인중1)'}, {studentKey: k(2), studentDisplayName: '이서연 (평여중1)'},
    {studentKey: k(3), studentDisplayName: '박하늘 (고덕중2)'}, {studentKey: k(4), studentDisplayName: '최지호 (이충중2)'},
    {studentKey: k(5), studentDisplayName: '정우진 (용인중3)'}, {studentKey: k(6), studentDisplayName: '정우진 (고덕중1)'},
  ],
  classes: [
    {id: 'c1', name: '중1반', status: '진행 중', ownerUid: 'me', revision: 3, students: [k(1), k(2)], books: [{id: 'b', title: '교재', status: 'current', extra: 'x'}], slots: [
      {id: 's1', weekday: 1, start: '16:10', end: '17:30', kind: 'lesson', status: '진행 중', study: [{start: '17:30', end: '18:30'}]},
      {id: 's2', weekday: 3, start: '16:10', end: '17:30', kind: 'lesson', status: '진행 중'},
      {id: 's3', weekday: 2, start: '17:30', end: '18:30', kind: 'test', status: '진행 중', students: [k(1)]},
    ]},
    {id: 'c2', name: '남의 반', status: '진행 중', ownerUid: 'other', students: [k(3), k(4)], slots: [{id: 's9', weekday: 1, start: '18:00', end: '19:00'}]},
  ],
});

test('times as the academy writes them: afternoon unless 오전, 9–11 morning only on weekends', () => {
  assert.equal(sheetTime(4, 10, 1), '16:10'); assert.equal(sheetTime(9, 0, 4), '21:00'); assert.equal(sheetTime(11, 0, 6), '11:00');
  assert.equal(sheetTime(12, 30, 2), '12:30'); assert.equal(sheetTime(10, 0, 3, '오전'), '10:00'); assert.equal(sheetTime(9, 0, 6, '오후'), '21:00'); assert.equal(sheetTime(18, 0, 1), '18:00');
});

test('hand-written cells: names on the next line or the same one, no spaces, two entries on one line, empty slots', () => {
  assert.deepEqual(parseLessons('4:10~5:30 (중1)\n김민준, 이서연\n\n5:30~6:50\n\n6:50~8:10 (중2) 박하늘 최지호', 1),
    [{weekday: 1, start: '16:10', end: '17:30', names: ['김민준', '이서연']}, {weekday: 1, start: '17:30', end: '18:50', names: []}, {weekday: 1, start: '18:50', end: '20:10', names: ['박하늘', '최지호']}]);
  assert.deepEqual(parseEntries('5:40~6:40박하늘6:00~7:00김민준,이서연\n7:30~8:30 최지호', 5).map(e => [e.start, e.end, e.names]),
    [['17:40', '18:40', ['박하늘']], ['18:00', '19:00', ['김민준', '이서연']], ['19:30', '20:30', ['최지호']]]);
  assert.deepEqual(namesIn(' (중2) 김민준 · 이서연/박하늘 '), ['김민준', '이서연', '박하늘']);
});

test('round trip: a sheet exported from the app reads back as "그대로" for every class', async () => {
  const data = base();
  const file = await buildTimetableExcel(readFileSync(new URL('../public/templates/timetable.xlsx', import.meta.url)), timetableSheet(data, 'regular', '2026-10-19', '이지원 T'));
  const cells = await readSheetCells(file);
  assert.deepEqual(cells.map(c => c.weekday), [1, 2, 3, 4, 5, 6, 0]);
  const plan = planImport(cells, data);
  assert.deepEqual(plan.classes.map(c => [c.classId, c.status, c.data]), [['c1', 'same', null]]);
  assert.deepEqual(plan.unknown, []);
});

test('a changed time, a new class, 자습 per student, a 3차시 line, and names to confirm', () => {
  const data = base();
  const cells: SheetCells[] = [
    {weekday: 1, lesson: '4:20~5:40 (중1)\n김민준, 이서연\n6:00~7:20\n박하늘, 최지후', study: '5:40~6:40 김민준\n5:40~6:40 이서연\n7:20~8:20 박하늘', test: ''},
    {weekday: 2, lesson: '', study: '', test: '5:30~6:30 김민준, 이서연'},
    {weekday: 4, lesson: '6:00~7:20\n박하늘, 최지후\n8:00~9:00\n정우진', study: '', test: ''},
  ];
  const plan = planImport(cells, data);
  assert.deepEqual(plan.unknown.map(u => [u.raw, u.options]), [['최지후', [k(4)]], ['정우진', [k(5), k(6)]]], 'a near name and two of the same name are asked, never guessed');
  const c1 = plan.classes.find(c => c.classId === 'c1')!;
  assert.equal(c1.status, 'changed');
  assert.deepEqual(c1.changes, ['월 16:10~17:30 → 16:20~17:40', '화 테스트 바뀜']);
  assert.deepEqual(c1.data.slots, [
    {id: 's1', weekday: 1, start: '16:20', end: '17:40', kind: 'lesson', status: '진행 중', study: [{start: '17:40', end: '18:40'}]},
    {id: 's2', weekday: 3, start: '16:10', end: '17:30', kind: 'lesson', status: '진행 중'},
    {id: 's3', status: '진행 중', weekday: 2, start: '17:30', end: '18:30', kind: 'test'},
  ], 'the sheet\'s weekdays change; 수 stays; the 화 test keeps its id and now names the whole class');
  assert.deepEqual(c1.data.books, [{id: 'b', title: '교재', status: 'current'}], 'books kept, only the saved fields');
  assert.equal(c1.revision, 3);
  const pending = plan.classes.filter(c => c.status === 'new');
  assert.deepEqual(pending.map(c => [c.name, c.data.students]), [['중2 박하늘반', [k(3)]]], 'until 최지후 is chosen, only 박하늘; 정우진 has no class');
  // The teacher picks the students: 최지후 → 최지호, 정우진 → the 중3 one; and renames the new class.
  const chosen = planImport(cells, data, {'최지후': k(4), '정우진': k(5)}, {'new:2': '목요반'});
  const news = chosen.classes.filter(c => c.status === 'new');
  assert.deepEqual(news.map(c => [c.name, c.data.students, c.data.slots.map((s: any) => `${s.weekday} ${s.start}`)]), [
    ['중2 박하늘 외 1명반', [k(3), k(4)], ['1 18:00', '4 18:00']],
    ['목요반', [k(5)], ['4 20:00']],
  ], 'the same students on two days share one new class; not someone else\'s class with those students');
  assert.deepEqual(news[0].data.slots[0].study, [{start: '19:20', end: '20:20', students: [k(3)]}]);
  assert.equal(news[0].data.subject, '영어'); assert.equal(news[0].data.status, '진행 중');
  assert.equal(planImport(cells, data, {'최지후': '', '정우진': ''}).unknown.length, 0, '빼고 저장 settles them');
});
