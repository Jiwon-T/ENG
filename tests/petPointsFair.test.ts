import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {initialPetState} from '../api/_lib/pet.js';

const OCT22 = Date.parse('2026-10-22T05:00:00Z');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';

test('이번 달 포인트: every active student, with or without the app, at the points the 수업 일지 give them', async () => {
  const {listPetPoints} = await import('../api/_lib/petCoupon.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const f = registrationFirestore();
  // A: no app account at all; B: linked, has a pet, one lesson not settled yet
  f.rows.set(`academyStudentMemberships/${A}`, {academyId: 'main'}); f.rows.set(`academyStudentMemberships/${B}`, {academyId: 'main'});
  f.rows.set(`notionStudentMappings/${hashStudentKey(A)}`, {studentKey: A, notionStudentPageId: A, internalStudentId: 'int-a', studentDisplayName: '앱없는 학생', sourceMode: 'firestore'});
  f.rows.set(`notionStudentMappings/${hashStudentKey(B)}`, {studentKey: B, notionStudentPageId: B, internalStudentId: 'int-b', studentDisplayName: '앱있는 학생', sourceMode: 'firestore', firebaseUid: 'b'});
  f.rows.set('users/b', {role: 'student', notionStudentKey: B});
  const pet = initialPetState(OCT22); pet.points = 100; pet.earned = {month: '2026-10', points: 0}; f.rows.set('petStates/b', pet);
  const lesson = (who: string, id: string, date: string, extra: any = {}) => f.rows.set(`lessonReports/${id}`, {internalStudentId: who, reportIdentity: id, lessonDateStart: date, attendance: '출석', attitude: '상', homework: '', test: '', ...extra});
  lesson('int-a', 'a1', '2026-09-15T14:00:00+09:00', {test: '최상'}); // 놓친 수업 (old way, counted for October), 시험 on 자동 = paper
  lesson('int-a', 'a2', '2026-10-21T14:00:00+09:00', {homework: '최상'});
  lesson('int-b', 'b1', '2026-10-21T14:00:00+09:00');
  const out: any = await listPetPoints(f.db, {admin: true, academyId: 'main'}, OCT22);
  const by = Object.fromEntries(out.students.map((s: any) => [s.name, s]));
  assert.deepEqual([by['앱없는 학생'].app, by['앱없는 학생'].earned, by['앱없는 학생'].points], ['none', (30 + (15 + 40) * 3) + (30 + (40 + 15) * 3), 170]);
  assert.deepEqual([by['앱있는 학생'].app, by['앱있는 학생'].points, by['앱있는 학생'].waiting, by['앱있는 학생'].earned], ['linked', 145, 45, 30 + 15 * 3]);
  assert.equal(by['앱없는 학생'].ledger.some((x: any) => x.label === '지난 수업 보상'), true, 'the 내역 shows what the gauge is made of');
  assert.equal(f.rows.has('petStates/a'), false, 'nothing is saved');
  assert.equal(f.rows.get('petStates/b').points, 100);
});

test('오프라인 신청: the admin asks for a student who reached the coupon — without the app (record only) or linked (as in the app, with the medal)', async () => {
  const {listPetPoints, requestCouponOffline, listCoupons} = await import('../api/_lib/petCoupon.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const f = registrationFirestore();
  f.rows.set(`academyStudentMemberships/${A}`, {academyId: 'main'}); f.rows.set(`academyStudentMemberships/${B}`, {academyId: 'main'});
  f.rows.set(`notionStudentMappings/${hashStudentKey(A)}`, {studentKey: A, notionStudentPageId: A, internalStudentId: 'int-a', studentDisplayName: '앱없는 학생', sourceMode: 'firestore'});
  f.rows.set(`notionStudentMappings/${hashStudentKey(B)}`, {studentKey: B, notionStudentPageId: B, internalStudentId: 'int-b', studentDisplayName: '앱있는 학생', sourceMode: 'firestore', firebaseUid: 'b'});
  f.rows.set('users/b', {role: 'student', notionStudentKey: B});
  const pet = initialPetState(OCT22); pet.earned = {month: '2026-10', points: 10_000}; f.rows.set('petStates/b', pet);
  // 120 good October lessons before 10/21 (출석 30 + 태도 최상 20 + 시험 최상, 자동 = 종이 for no app, 40 = 90 each → 10,800)
  for (let i = 0; i < 120; i++) f.rows.set(`lessonReports/a${i}`, {internalStudentId: 'int-a', reportIdentity: `a${i}`, lessonDateStart: `2026-10-${String(1 + (i % 20)).padStart(2, '0')}T${String(10 + Math.floor(i / 20)).padStart(2, '0')}:00:00+09:00`, attendance: '출석', attitude: '최상', test: '최상', homework: i % 2 ? '최상' : ''});
  const admin = {admin: true, academyId: 'main', uid: 'boss'};
  const list: any = await listPetPoints(f.db, admin, OCT22);
  const noApp = list.students.find((s: any) => s.name === '앱없는 학생');
  assert.equal(noApp.earned >= 10_000, true);
  assert.deepEqual(noApp.options, [{id: 'full', won: 10_000}], 'October: the one 1만 원 coupon');
  const out: any = await requestCouponOffline(f.db, admin, {studentKey: A}, OCT22);
  assert.deepEqual([out.coupon.uid, out.coupon.offline, out.coupon.requestedBy, out.coupon.won], [null, true, 'boss', 10_000]);
  assert.equal(f.rows.has(`petCoupons/k${A.replace(/-/g, '')}_2026-10`), true);
  await assert.rejects(requestCouponOffline(f.db, admin, {studentKey: A}, OCT22), /COUPON_TAKEN/, 'once a month');
  await assert.rejects(requestCouponOffline(f.db, {admin: false, academyId: 'main', uid: 't', scopes: []}, {studentKey: A}, OCT22), /FORBIDDEN/);
  // linked: asked as in the app — the medal goes into the room
  const linked: any = await requestCouponOffline(f.db, admin, {studentKey: B}, OCT22);
  assert.deepEqual([linked.coupon.uid, linked.coupon.offline], ['b', true]);
  assert.deepEqual(f.rows.get('petStates/b').medals, ['2026-10']);
  const coupons: any = await listCoupons(f.db, admin);
  assert.deepEqual(coupons.coupons.map((c: any) => [c.name, Boolean(c.offline)]).sort(), [['앱없는 학생', true], ['앱있는 학생', true]]);
  assert.equal((await listPetPoints(f.db, admin, OCT22) as any).students.find((s: any) => s.name === '앱없는 학생').requested, true);
});

test('은메달: the first 5천 원 gives the month\'s 은메달; reaching 1만 원 that month turns it gold (same place in the room); 1만 원 at once is gold', async () => {
  const {requestCoupon, syncOfflineMedals} = await import('../api/_lib/petCoupon.js');
  const {rollDay} = await import('../api/_lib/pet.js');
  const NOV10 = Date.parse('2026-11-10T05:00:00Z');
  const make = (earned: number) => { const f = registrationFirestore(); f.rows.set('petStates/kid', rollDay({...initialPetState(NOV10), earned: {month: '2026-11', points: earned}} as any, NOV10)); return f; };
  const f = make(12_000);
  await requestCoupon(f.db, 'kid', A, NOV10, undefined, 'half');
  assert.deepEqual(f.rows.get('petStates/kid').medals, ['2026-11-s'], '6,000P → 5천 원 → 은메달');
  f.rows.set('petStates/kid', {...f.rows.get('petStates/kid'), decor: {default: [{id: '2026-11-s', x: 20, y: 30}]}});
  await requestCoupon(f.db, 'kid', A, NOV10, undefined, 'half');
  assert.deepEqual(f.rows.get('petStates/kid').medals, ['2026-11'], '12,000P → two 5천 원 → 금메달');
  assert.deepEqual(f.rows.get('petStates/kid').decor.default, [{id: '2026-11', x: 20, y: 30}], 'where the silver was');
  const g = make(10_000);
  await requestCoupon(g.db, 'kid', A, NOV10, undefined, 'full');
  assert.deepEqual(g.rows.get('petStates/kid').medals, ['2026-11'], '10,000P → 1만 원 → 금메달 straight away');
  // asked offline before joining: the medal goes into the room once there is a pet
  const h = make(0);
  h.rows.set(`petCoupons/k${A.replace(/-/g, '')}_2026-11_h1`, {uid: null, studentKey: A, month: '2026-11', won: 5_000, tier: 'half', offline: true});
  assert.equal(await syncOfflineMedals(h.db, 'kid', A, NOV10), 1);
  assert.deepEqual(h.rows.get('petStates/kid').medals, ['2026-11-s']);
  assert.equal(h.rows.get(`petCoupons/k${A.replace(/-/g, '')}_2026-11_h1`).uid, 'kid', 'the coupon now points at the account');
  assert.equal(await syncOfflineMedals(h.db, 'kid', A, NOV10), 0, 'once');
});
