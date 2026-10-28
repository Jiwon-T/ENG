import test from 'node:test';
import assert from 'node:assert/strict';
import {enrol} from './helpers/enrolled.js';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {awardStudy, earnedIn, initialPetState, monthEarned, rollDay, settleLessonReward} from '../api/_lib/pet.js';
import {couponView, requestCoupon} from '../api/_lib/petCoupon.js';

const OCT31 = Date.parse('2026-10-31T05:00:00Z'), NOV1 = Date.parse('2026-11-01T05:00:00Z'), NOV5 = Date.parse('2026-11-05T05:00:00Z');

test('포인트 내역: by day, kind and what it was for; the same on one day adds up', () => {
  const s = initialPetState(OCT31); s.earned = {month: '2026-10', points: 0};
  awardStudy(s, 'vocab-test', 3); awardStudy(s, 'vocab-test', 2);
  // a lesson from 10/21 on is settled on 반영: one line for the lesson
  settleLessonReward(s, 'r1', '2026-10-31T14:00:00+09:00', {attendance: '출석', homework: '', test: '최상', testPaper: true, attitude: '상'}, OCT31);
  assert.deepEqual(s.ledger!.map(x => [x.day, x.kind, x.label, x.points]), [
    ['2026-10-31', 'study', '단어 테스트', 50], ['2026-10-31', 'class', '출석·시험(종이) 최상·태도 상', 85]]);
  assert.equal(monthEarned(s), 135);
});

test('다음 달로 안 넘어감: a lesson on 10/31 taken on 11/1 counts for October; the October coupon can be asked for until 11/3', async () => {
  const s = rollDay({...initialPetState(OCT31), earned: {month: '2026-10', points: 9_980}} as any, NOV1);
  settleLessonReward(s, 'r1', '2026-10-31T14:00:00+09:00', {attendance: '출석', homework: '', test: '', testPaper: true, attitude: ''}, NOV1);
  assert.deepEqual([earnedIn(s, '2026-10'), monthEarned(s)], [10_010, 0], 'October, not November');
  assert.equal(s.ledger!.at(-1)!.day, '2026-10-31');
  const view: any = couponView(s, true, [], []);
  assert.deepEqual([view.last.month, view.last.earned, view.last.requested, view.last.until], ['2026-10', 10_010, false, '2026-11-03']);
  const f = registrationFirestore(); f.rows.set('petStates/kid', s);
  const out: any = await requestCoupon(f.db, 'kid', 'key', NOV1, '2026-10');
  assert.deepEqual([out.coupon.month, out.coupon.earned, out.state.medals], ['2026-10', 10_010, ['2026-10']]);
  // after the grace days: only this month
  const g = registrationFirestore(); g.rows.set('petStates/kid', {...s, medals: []});
  await assert.rejects(requestCoupon(g.db, 'kid', 'key', NOV5, '2026-10'), /COUPON_NOT_YET/, 'November (0P) is asked for instead');
  assert.equal('last' in couponView(rollDay(structuredClone(s), NOV5), true, [], []), false);
});

test('관리자 › 이번 달 포인트: linked, active students with points held, this month earned (most first) and the 내역', async () => {
  const {listPetPoints} = await import('../api/_lib/petCoupon.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const f = registrationFirestore();
  const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333';
  for (const [uid, key, name] of [['a', A, '김하늘'], ['b', B, '박서준'], ['c', C, '그만둔 학생']]) {
    f.rows.set(`users/${uid}`, {role: 'student', notionStudentKey: key});
    f.rows.set(`academyStudentMemberships/${key}`, {academyId: 'main', disabled: uid === 'c'}); enrol(f, key);
    f.rows.set(`notionStudentMappings/${hashStudentKey(key)}`, {studentKey: key, notionStudentPageId: key, internalStudentId: `int-${uid}`, studentDisplayName: name, sourceMode: 'firestore', firebaseUid: uid});
  }
  const s = initialPetState(OCT31); s.earned = {month: '2026-10', points: 0}; awardStudy(s, 'vocab-test', 5); f.rows.set('petStates/a', s);
  f.rows.set('users/t', {role: 'teacher'});
  const out: any = await listPetPoints(f.db, {admin: true, academyId: 'main'}, OCT31);
  assert.deepEqual(out.students.map((x: any) => [x.name, x.earned, x.ledger.length]), [['김하늘', 50, 1], ['박서준', 0, 0]]);
  await assert.rejects(listPetPoints(f.db, {admin: false, academyId: 'main'}, OCT31), /FORBIDDEN/);
});

test('관리자 › 이번 달 포인트: an old account still holding a student key (linked elsewhere now) is left out', async () => {
  const {listPetPoints} = await import('../api/_lib/petCoupon.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const f = registrationFirestore(), A = '11111111-1111-4111-8111-111111111111';
  f.rows.set('users/old', {role: 'student', notionStudentKey: A}); f.rows.set('users/new', {role: 'student', notionStudentKey: A});
  f.rows.set(`academyStudentMemberships/${A}`, {academyId: 'main'}); enrol(f, A);
  f.rows.set(`notionStudentMappings/${hashStudentKey(A)}`, {studentKey: A, notionStudentPageId: A, internalStudentId: 'int-1', studentDisplayName: '김하늘', sourceMode: 'firestore', firebaseUid: 'new'});
  const out: any = await listPetPoints(f.db, {admin: true, academyId: 'main'}, OCT31);
  assert.equal(out.students.length, 1);
});

test('학습 리포트 › 장학 쿠폰: the teachers who have the student (any subject) and the admin see this month; others do not', async () => {
  const {teacherStudentCoupon} = await import('../api/_lib/petCoupon.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const f = registrationFirestore(), A = '11111111-1111-4111-8111-111111111111';
  f.rows.set('users/a', {role: 'student', notionStudentKey: A});
  f.rows.set(`notionStudentMappings/${hashStudentKey(A)}`, {studentKey: A, notionStudentPageId: A, internalStudentId: 'int-1', studentDisplayName: '김하늘', sourceMode: 'firestore', firebaseUid: 'a'});
  const s = initialPetState(OCT31); s.earned = {month: '2026-10', points: 0}; awardStudy(s, 'vocab-test', 5); f.rows.set('petStates/a', s);
  const math = {uid: 't', admin: false, scopes: [{studentKey: A, subject: '수학'}]};
  const out: any = await teacherStudentCoupon(f.db, math, A, OCT31);
  assert.deepEqual([out.linked, out.earned, out.points, out.ledger.length, out.goal], [true, 50, s.points, 1, 10_000]);
  assert.deepEqual(out.forecast, {perfect: 0, growth: {}, growthAt: OCT31}, '월말 예상: a pet, no growth yet this month, and the ranking’s time');
  await assert.rejects(teacherStudentCoupon(f.db, {uid: 'x', admin: false, scopes: []}, A, OCT31), /FORBIDDEN/);
  assert.equal((await teacherStudentCoupon(f.db, {admin: true, scopes: []}, A, OCT31) as any).earned, 50);
});

test('학생 관리 › 장학 쿠폰: a teacher sees the students they have; the principal and the admin the whole academy', async () => {
  const {listPetPoints} = await import('../api/_lib/petCoupon.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const f = registrationFirestore(), A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
  for (const [uid, key, name] of [['a', A, '김하늘'], ['b', B, '박서준']]) {
    f.rows.set(`users/${uid}`, {role: 'student', notionStudentKey: key}); f.rows.set(`academyStudentMemberships/${key}`, {academyId: 'main'}); enrol(f, key);
    f.rows.set(`notionStudentMappings/${hashStudentKey(key)}`, {studentKey: key, notionStudentPageId: key, internalStudentId: `int-${uid}`, studentDisplayName: name, sourceMode: 'firestore', firebaseUid: uid});
  }
  const names = async (actor: any) => ((await listPetPoints(f.db, actor, OCT31)) as any).students.map((s: any) => s.name).sort();
  assert.deepEqual(await names({uid: 't', academyId: 'main', scopes: [{studentKey: A, subject: '수학'}]}), ['김하늘']);
  assert.deepEqual(await names({uid: 'p', principal: true, academyId: 'main', scopes: [{studentKey: A, subject: '영어'}]}), ['김하늘', '박서준']);
  assert.deepEqual(await names({admin: true, academyId: 'main', scopes: []}), ['김하늘', '박서준']);
});

test('단계 쿠폰 (10월부터): 6,000P → 5천 원 (6,000P used, the rest keeps counting), 10,000P → 1만 원, at most 1만 원 a month', async () => {
  const NOV10 = Date.parse('2026-11-10T05:00:00Z');
  const make = (earned: number) => { const f = registrationFirestore(); const s: any = rollDay({...initialPetState(NOV10), earned: {month: '2026-11', points: earned}} as any, NOV10); f.rows.set('petStates/kid', s); return f; };
  // 12,000P: 5천 원, then another 5천 원 (12,000 = 6,000 × 2), then no more (1만 원 a month)
  const f = make(12_000);
  const first: any = await requestCoupon(f.db, 'kid', 'key', NOV10, undefined, 'half');
  assert.deepEqual([first.coupon.tier, first.coupon.won, first.coupon.points], ['half', 5_000, 6_000]);
  let view: any = couponView(f.rows.get('petStates/kid'), true, [first.coupon]);
  assert.deepEqual([view.left, view.won, view.options.map((o: any) => [o.id, o.ready])], [6_000, 5_000, [['half', true], ['full', false]]]);
  const second: any = await requestCoupon(f.db, 'kid', 'key', NOV10, undefined, 'half');
  assert.equal(second.coupon.won, 5_000);
  await assert.rejects(requestCoupon(f.db, 'kid', 'key', NOV10, undefined, 'half'), /COUPON_TAKEN/, 'a month gives at most 1만 원');
  assert.equal([...f.rows.keys()].filter(k => k.startsWith('petCoupons/')).length, 2);
  // 10,000P: one 1만 원; after it nothing more
  const g = make(10_400);
  assert.equal((await requestCoupon(g.db, 'kid', 'key', NOV10, undefined, 'full') as any).coupon.won, 10_000);
  await assert.rejects(requestCoupon(g.db, 'kid', 'key', NOV10, undefined, 'half'), /COUPON_TAKEN/);
  // 5,999P: not yet; 5천 원 after 1만 원 is not possible either way
  await assert.rejects(requestCoupon(make(5_999).db, 'kid', 'key', NOV10, undefined, 'half'), /COUPON_NOT_YET/);
  // September (before 단계 쿠폰): one 1만 원 coupon; October has both
  const SEP15 = Date.parse('2026-09-15T05:00:00Z');
  view = couponView(rollDay(structuredClone(initialPetState(OCT31)), OCT31), true, []);
  assert.deepEqual(view.options.map((o: any) => o.id), ['half', 'full']);
  view = couponView(rollDay(structuredClone(initialPetState(SEP15)), SEP15), true, []);
  assert.deepEqual(view.options.map((o: any) => o.id), ['full']);
});

test('학습 리포트 › 장학 쿠폰: two 5천 원 coupons, one handed out — each shown with its own state', async () => {
  const {teacherStudentCoupon} = await import('../api/_lib/petCoupon.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const NOV = Date.parse('2026-11-10T05:00:00Z'), f = registrationFirestore(), A = '11111111-1111-4111-8111-111111111111';
  f.rows.set('users/a', {role: 'student', notionStudentKey: A});
  f.rows.set(`notionStudentMappings/${hashStudentKey(A)}`, {studentKey: A, notionStudentPageId: A, internalStudentId: 'int-1', studentDisplayName: '김하늘', sourceMode: 'firestore', firebaseUid: 'a'});
  f.rows.set('petCoupons/a_2026-11_h1', {uid: 'a', month: '2026-11', tier: 'half', won: 5000, points: 6000, paidAt: NOV});
  f.rows.set('petCoupons/a_2026-11_h2', {uid: 'a', month: '2026-11', tier: 'half', won: 5000, points: 6000, paidAt: null});
  const out: any = await teacherStudentCoupon(f.db, {admin: true, scopes: []}, A, NOV);
  assert.deepEqual([out.requested, out.paid, out.coupons], [true, false, [{won: 5000, paid: true}, {won: 5000, paid: false}]]);
});
