import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {awardCapped, claimStudyRewards, earnPoints, initialPetState, monthEarned, rollDay} from '../api/_lib/pet.js';
import {couponStudentKey, listCoupons, markCouponPaid, placeDecor, requestCoupon} from '../api/_lib/petCoupon.js';
import {handlePet} from '../api/_lib/student/pet.js';
import {hashStudentKey} from '../api/_lib/security.js';
import {PET_COUPON, medalLabel} from '../src/lib/petCatalog.js';

const OCT = Date.parse('2026-10-16T03:00:00Z'), NOV1_KST = Date.parse('2026-10-31T15:30:00Z'); // 11월 1일 00:30 in Seoul
const KEY = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222';

test('coupon points: counted by Korea-time month, spending does not lower them, the first season adds the points held', () => {
  assert.equal(medalLabel('2026-10'), '26.10');
  const s = initialPetState(OCT); s.points = 3000;
  assert.equal(monthEarned(s), 3000, 'first season: the points held count');
  awardCapped(s, 100, 100); claimStudyRewards(s, [{id: 'r1', kind: 'attendance'}]);
  assert.equal(monthEarned(s), 3100 + 30);
  s.points -= 2000; // bought something
  assert.equal(monthEarned(s), 3130, 'spending does not lower it');
  const nov = rollDay(s, NOV1_KST);
  assert.equal(nov.day.slice(0, 7), '2026-11', '00:30 on 1 November in Seoul is November');
  assert.equal(monthEarned(nov), 0, 'a new month starts from 0 (no first-season points again)');
  earnPoints(nov, 50); assert.deepEqual(nov.earned, {month: '2026-11', points: 50});
  const later = initialPetState(NOV1_KST); later.points = 500;
  assert.equal(monthEarned(later), 0, 'after the first season the points held do not count');
});

const setup = () => {
  const f = registrationFirestore();
  process.env.ADMIN_UID = 'admin';
  f.rows.set('users/kid', {notionStudentKey: KEY}); f.rows.set('users/other', {notionStudentKey: OTHER});
  f.rows.set(`academyStudentMemberships/${KEY}`, {academyId: 'main'}); f.rows.set(`academyStudentMemberships/${OTHER}`, {academyId: 'main'});
  f.rows.set('teacherWorkspaceAccess/admin', {academyId: 'main', scopes: [{studentKey: KEY, subject: '영어'}, {studentKey: OTHER, subject: '수학'}]});
  for (const [key, uid] of [[KEY, 'kid'], [OTHER, 'other']]) f.rows.set(`notionStudentMappings/${hashStudentKey(key)}`, {studentKey: key, notionStudentPageId: key, internalStudentId: `int-${uid}`, studentDisplayName: '학생', sourceMode: 'firestore', firebaseUid: uid});
  return f;
};

test('coupon: any 채움 학원 student linked to this account; once a month at the goal; no points taken; the month medal is added', async () => {
  const f = setup();
  assert.equal(await couponStudentKey(f.db, 'kid'), KEY);
  assert.equal(await couponStudentKey(f.db, 'other'), OTHER, 'any subject, any teacher');
  f.rows.set('users/faker', {notionStudentKey: KEY});
  assert.equal(await couponStudentKey(f.db, 'faker'), null, 'a key this account is not linked to');
  f.rows.set(`academyStudentMemberships/${OTHER}`, {academyId: 'main', disabled: true});
  const s = initialPetState(OCT); s.points = PET_COUPON.goal - 1; f.rows.set('petStates/kid', s);
  await assert.rejects(() => requestCoupon(f.db, 'kid', KEY, OCT), /COUPON_NOT_YET/);
  s.points = PET_COUPON.goal + 500; f.rows.set('petStates/kid', s);
  const out = await requestCoupon(f.db, 'kid', KEY, OCT);
  assert.deepEqual([out.state.points, out.state.medals, out.coupon.month, out.coupon.paidAt], [PET_COUPON.goal + 500, ['2026-10'], '2026-10', null]);
  assert.ok(f.rows.get('petCoupons/kid_2026-10'));
  await assert.rejects(() => requestCoupon(f.db, 'kid', KEY, OCT), /COUPON_TAKEN/, 'one a month');
});

test('coupon API: the screen shows the gauge only for eligible students; others are refused', async () => {
  const f = setup();
  const s = initialPetState(OCT); s.pets[0].chosen = true; s.points = 12000; f.rows.set('petStates/kid', s);
  const o = initialPetState(OCT); o.pets[0].chosen = true; o.points = 12000; f.rows.set('petStates/other', o);
  const call = async (uid: string, method: string, body?: any) => {
    let out: any; const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, statusCode: 0};
    await handlePet({method, headers: {authorization: 'Bearer t'}, body} as any, res, {verify: async () => ({uid}), db: () => f.db, generate: async () => '{}', now: () => OCT} as any);
    return out;
  };
  const view = (await call('kid', 'GET')).coupon;
  assert.deepEqual([view.eligible, view.earned, view.goal, view.requested, view.label], [true, 12000, 10000, false, '26.10']);
  assert.equal((await call('other', 'GET')).coupon.eligible, true, 'a student of another subject too');
  f.rows.set(`academyStudentMemberships/${OTHER}`, {academyId: 'main', disabled: true});
  assert.equal((await call('other', 'GET')).coupon.eligible, false, 'no longer a member');
  assert.equal((await call('other', 'POST', {action: 'coupon-request'})).error, 'COUPON_NOT_ELIGIBLE');
  const got = await call('kid', 'POST', {action: 'coupon-request'});
  assert.deepEqual([got.ok, got.coupon.requested, got.state.medals, got.state.points], [true, true, ['2026-10'], 12000]);
});

test('medal decoration: only medals the student has, each once, kept inside the room; per room', () => {
  const s = initialPetState(OCT); s.medals = ['2026-10']; s.inventory.push('bed');
  placeDecor(s, 'bed', [{id: '2026-10', x: 120, y: -5}]);
  assert.deepEqual(s.decor, {bed: [{id: '2026-10', x: 100, y: 0}]});
  placeDecor(s, 'default', []);
  assert.deepEqual(s.decor?.bed.length, 1, 'other rooms keep their medals');
  assert.throws(() => placeDecor(s, 'bed', [{id: '2026-11', x: 1, y: 1}]), /PET_BAD_ACTION/, 'a medal not owned');
  assert.throws(() => placeDecor(s, 'bed', [{id: '2026-10', x: 1, y: 1}, {id: '2026-10', x: 2, y: 2}]), /PET_BAD_ACTION/, 'twice');
  assert.throws(() => placeDecor(s, 'star_room', []), /PET_BAD_ACTION/, 'a room the student does not have');
});

test('coupon list and 지급 완료: admin only; names and current points come with each coupon', async () => {
  const f = setup();
  const s = initialPetState(OCT); s.points = 11000; f.rows.set('petStates/kid', s);
  await requestCoupon(f.db, 'kid', KEY, OCT);
  const admin = {admin: true, academyId: 'main', uid: 'admin'};
  await assert.rejects(() => listCoupons(f.db, {admin: false, principal: true, academyId: 'main'}), /FORBIDDEN/);
  await assert.rejects(() => markCouponPaid(f.db, {admin: false, academyId: 'main'}, {id: 'kid_2026-10'}), /FORBIDDEN/);
  const {coupons} = await listCoupons(f.db, admin);
  assert.deepEqual(coupons.map(c => [c.id, c.label, c.points, c.paidAt]), [['kid_2026-10', '26.10', 11000, null]]);
  await markCouponPaid(f.db, admin, {id: 'kid_2026-10'});
  assert.ok(f.rows.get('petCoupons/kid_2026-10').paidAt);
  await markCouponPaid(f.db, admin, {id: 'kid_2026-10', paid: false});
  assert.equal(f.rows.get('petCoupons/kid_2026-10').paidAt, null);
});
