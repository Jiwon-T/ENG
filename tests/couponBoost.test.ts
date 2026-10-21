import test from 'node:test';
import assert from 'node:assert/strict';
import {enrol} from './helpers/enrolled.js';
import {applyCouponExtras, couponExtras, earnPoints, initialPetState, monthEarned, type CouponRow} from '../api/_lib/pet.js';

const OCT22 = Date.parse('2026-10-22T05:00:00Z');
const row = (date: string, x: Partial<CouponRow> = {}): CouponRow => ({date: `${date}T14:00:00+09:00`, attendance: '', homework: '', test: '', testPaper: true, attitude: '', subject: '영어', ...x});
const lessons = (month: string, n: number, x: (i: number) => Partial<CouponRow> = () => ({})) => Array.from({length: n}, (_, i) => row(`${month}-${String(i + 1).padStart(2, '0')}`, {session: true, attendance: '출석', ...x(i)}));

test('보완: ×3 only for a lesson done well all round (숙제·테스트·태도 상 이상; 출석 ×1), 자습 only on a day with 태도 상 이상 — once a day', () => {
  const e = couponExtras([
    row('2026-10-02', {attendance: '출석', attitude: '상', homework: '최상', test: '없는 날'}), // 상 이상 all round (테스트 없는 날 left out)
    row('2026-10-02', {studied: true}), row('2026-10-02', {studied: true, subject: '수학'}),   // 자습 that day: once
    row('2026-10-05', {attendance: '출석', attitude: '중', homework: '상', studied: true}),       // 태도 중: no ×3, no 자습
  ], '2026-10-22')['2026-10'];
  assert.deepEqual([e.lesson, e.study, e.studyDays], [(15 + 40) * 2, 90, 1]);
});

test('보완: 숙제 상 이상 3 in a row +500, 최상 2 in a row +300 — 없는 날·미확인 skipped, anything lower breaks', () => {
  const hw = (list: string[]) => couponExtras(list.map((h, i) => row(`2026-10-${String(i + 1).padStart(2, '0')}`, {homework: h})), '2026-10-22')['2026-10'];
  assert.deepEqual([hw(['상', '없는 날', '상', '미확인', '상']).homeworkRuns, hw(['상', '상', '중상', '상', '상']).homeworkRuns, hw(['상', '상', '미제출', '상']).homeworkRuns], [1, 0, 0]);
  const best = hw(['최상', '최상', '최상', '최상', '상', '최상']);
  assert.deepEqual([best.bestRuns, best.homeworkRuns], [2, 2], '최상 counts toward 상 이상 too');
  assert.equal(best.points, best.lesson + 2 * 500 + 2 * 300);
});

test('보완: 한 달 개근 — 8+ class sessions, no 결석; 30% less a 지각, +500 with none, +500 with no 숙제 미제출; final once the month is over', () => {
  const sept = (x: (i: number) => Partial<CouponRow> = () => ({})) => couponExtras(lessons('2026-09', 8, x), '2026-10-22')['2026-10'];
  assert.equal(sept().perfect, 1000 + 500 + 500, 'no 지각, no 미제출');
  assert.equal(sept(i => i < 1 ? {attendance: '지각'} : {}).perfect, 700 + 500, '1 지각: 30% less, no +500');
  assert.equal(sept(i => i < 2 ? {attendance: '보강 지각'} : {}).perfect, 400 + 500, '2 지각');
  assert.equal(sept(i => i < 4 ? {attendance: '지각'} : {}).perfect, 0 + 500, '4 지각: nothing but 성실');
  assert.equal(sept(i => i === 3 ? {homework: '미제출'} : {}).perfect, 1000 + 500, 'a 미제출: no 성실 개근');
  assert.equal(sept(i => i === 0 ? {attendance: '결석'} : {}).perfect, 0, 'a 결석');
  assert.equal(couponExtras(lessons('2026-09', 7), '2026-10-22')['2026-10'].perfect, 0, '7 sessions');
  assert.equal(couponExtras([...lessons('2026-09', 8), row('2026-09-20', {attendance: '출석'})], '2026-10-22')['2026-10'].perfect, 2000, 'a 테스트·자습 day (no 수업 시간) is not a session');
  const oct = couponExtras(lessons('2026-10', 8), '2026-10-22')['2026-10'];
  assert.deepEqual([oct.perfect, oct.pending], [0, 2000], 'October still running: shown, not counted');
  assert.equal(couponExtras(lessons('2026-10', 8), '2026-11-02')['2026-10'].perfect, 2000, 'counted once October is over');
});

test('보완: September counts for October (first season); the coupon count adds it, the points to spend do not', () => {
  const s = initialPetState(OCT22); s.points = 100; s.earned = {month: '2026-10', points: 100};
  applyCouponExtras(s, [...lessons('2026-09', 8), row('2026-09-03', {studied: true, attitude: '상'}), row('2026-09-04', {attendance: '출석', attitude: '상'})], OCT22);
  assert.deepEqual(Object.keys(s.couponExtra!), ['2026-10']);
  const extra = s.couponExtra!['2026-10'];
  assert.equal(extra.points, 15 * 2 + 90 + 2000, '태도 상 ×3 (the lesson attended; the 자습 record with no 출결 is not tripled), a 자습 day, 개근 + no 지각 + 성실');
  assert.equal(monthEarned(s), 100 + extra.points);
  earnPoints(s, 30, 'class', '출석', '2026-10-21');
  assert.deepEqual([s.earnedBy, s.points], [{'2026-10': 130}, 100], 'never baked into what was earned');
});

test('쿠폰 자격: 숙제 제출률 80% (중상 이상 = 제출; 없는 날·미확인 left out)', () => {
  const e = (list: string[]) => couponExtras(list.map((h, i) => row(`2026-10-${String(i + 1).padStart(2, '0')}`, {homework: h})), '2026-10-22')['2026-10'];
  const a = e(['상', '중상', '중', '없는 날', '미확인', '최상', '미제출']);
  assert.deepEqual([a.hwCounted, a.hwDone], [5, 3]);
});

test('자동 tests: paper or app is read from 9/1 (the first day lessons are paid from), so an older one stays paper as the window moves', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../api/_lib/lessonRewardRows.ts', import.meta.url), 'utf8');
  assert.match(src, /const from = Math\.min\(Date\.now\(\) - \(PET_REWARD_WINDOW_DAYS \+ 2\) \* 86_400_000, Date\.parse\(`\$\{LESSON_BACKPAY_FROM\}T00:00:00\+09:00`\)\);/);
});


test('쿠폰 자격: under 80% 숙제 제출률 no coupon can be asked for (the admin offline either); at 80% it can', async () => {
  const {registrationFirestore} = await import('./helpers/registrationFirestore.js');
  const {listPetPoints, requestCouponOffline} = await import('../api/_lib/petCoupon.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const B = '22222222-2222-4222-8222-222222222222', f = registrationFirestore(), admin = {admin: true, academyId: 'main', uid: 'adm'};
  f.rows.set(`academyStudentMemberships/${B}`, {academyId: 'main'}); enrol(f, B);
  f.rows.set(`notionStudentMappings/${hashStudentKey(B)}`, {studentKey: B, notionStudentPageId: B, internalStudentId: 'int-b', studentDisplayName: '학생', sourceMode: 'firestore', firebaseUid: 'b'});
  f.rows.set('users/b', {role: 'student', notionStudentKey: B});
  const pet = initialPetState(OCT22); pet.earned = {month: '2026-10', points: 10_000}; pet.earnedBy = {'2026-10': 10_000}; f.rows.set('petStates/b', pet);
  const lesson = (id: string, date: string, homework: string) => f.rows.set(`lessonReports/${id}`, {internalStudentId: 'int-b', reportIdentity: id, lessonDateStart: `${date}T14:00:00+09:00`, attendance: '', attitude: '', homework, test: ''});
  lesson('b1', '2026-10-06', '미제출'); lesson('b2', '2026-10-08', '중상'); lesson('b3', '2026-10-10', '없는 날');
  let row: any = (await listPetPoints(f.db, admin, OCT22)).students[0];
  assert.deepEqual([row.options, row.homework], [[], {done: 1, counted: 2, rate: 50, ok: false}]);
  await assert.rejects(requestCouponOffline(f.db, admin, {studentKey: B, tier: 'full'}, OCT22), /COUPON_HOMEWORK/);
  lesson('b4', '2026-10-13', '상'); lesson('b5', '2026-10-15', '최상'); lesson('b6', '2026-10-17', '상');
  row = (await listPetPoints(f.db, admin, OCT22)).students[0];
  assert.deepEqual([row.homework.rate, row.homework.ok, row.options.length > 0], [80, true, true], '4 of 5: 80%');
});

test('보완 내역: what it is made of — tripled lessons, a line a day (×3, 자습, 숙제 runs) adding up, 개근 parts by month, this month toward 개근', () => {
  const e = couponExtras([
    ...lessons('2026-09', 8, i => i === 0 ? {attendance: '지각'} : {}),
    row('2026-10-02', {attendance: '출석', attitude: '상', homework: '상', test: '최상', session: true, studied: true}),
    row('2026-10-05', {attendance: '출석', homework: '상', session: true}), row('2026-10-07', {attendance: '결석', homework: '상', session: true}),
  ], '2026-10-22')['2026-10'];
  assert.equal(e.boosted, 2, 'lessons attended whose graded chips are all 상 이상 (the 결석 one is not tripled)');
  assert.deepEqual(e.days!.map(d => [d.day, d.kind]), [['2026-10-02', 'lesson'], ['2026-10-05', 'lesson'], ['2026-10-02', 'study'], ['2026-10-07', 'hwRun']]);
  assert.equal(e.days!.reduce((n, d) => n + d.points, 0), e.lesson + e.study + e.homeworkRuns * 500 + e.bestRuns * 300, 'the lines add up to all but 개근');
  assert.deepEqual(e.perfects, [{month: '2026-09', base: 700, noLate: 0, diligent: 500, lates: 1, final: true}]);
  assert.deepEqual(e.now, {sessions: 2, absences: 1, lates: 0});
  assert.equal(e.points, e.lesson + e.study + 500 + 700 + 500);
});
