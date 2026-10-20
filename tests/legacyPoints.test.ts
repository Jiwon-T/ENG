import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {initialPetState, monthEarned} from '../api/_lib/pet.js';
import {legacyAdjust} from '../api/_lib/legacyPoints.js';

const OCT22 = Date.parse('2026-10-22T05:00:00Z');
const A = '11111111-1111-4111-8111-111111111111';
const session = (day: string, uid = 'a') => ({uid, type: 'test', score: 10, totalItems: 10, createdAt: `${day}T15:00:00+09:00`});

test('예전 포인트: a full 300P is allowed for each day the records show the student active then; above it is taken back (never below 0); no records, no change', () => {
  const s = initialPetState(OCT22); s.points = 5000; s.ledger = [{day: '2026-09-25', kind: 'class', label: '출석', points: 500}];
  const sessions = [session('2026-09-10'), session('2026-09-10'), session('2026-09-11'), session('2026-09-26')]; // 9/26 is in the 내역 already
  assert.deepEqual(legacyAdjust(s, sessions, '2026-10-22'), {legacy: 4500, days: 2, allowed: 600, take: 3900});
  assert.equal(legacyAdjust(s, [], '2026-10-22').take, 0, 'no records from then: left alone');
  const spent = initialPetState(OCT22); spent.points = 50; spent.ledger = [];
  assert.equal(legacyAdjust(spent, [session('2026-09-10')], '2026-10-22').take, 0, 'within 300P a day');
  const fewLeft = initialPetState(OCT22); fewLeft.points = 100; fewLeft.ledger = [{day: '2026-09-20', kind: 'etc', label: '상점', points: -2000}];
  assert.equal(legacyAdjust(fewLeft, [session('2026-09-10')], '2026-10-22').take, 100, 'never below 0');
});

test('예전 포인트 조정: admin only; the list first, then taken from the points held and October\u2019s coupon count once, with a 내역 line', async () => {
  const {readLegacyPoints, applyLegacyPoints, LEGACY_LABEL} = await import('../api/_lib/legacyPoints.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const f = registrationFirestore();
  f.rows.set(`notionStudentMappings/${hashStudentKey(A)}`, {studentKey: A, notionStudentPageId: A, internalStudentId: 'int-a', studentDisplayName: '김하늘', sourceMode: 'firestore', firebaseUid: 'a'});
  f.rows.set('users/a', {role: 'student', notionStudentKey: A}); f.rows.set('users/t', {role: 'teacher'});
  // as in production: the points held (device era included) counted for October, the first season
  const pet = initialPetState(OCT22); pet.points = 5000; pet.earned = {month: '2026-10', points: 5000}; pet.earnedBy = {'2026-10': 5000}; pet.ledger = [{day: '2026-09-25', kind: 'class', label: '출석', points: 500}]; f.rows.set('petStates/a', pet);
  const teacherPet = initialPetState(OCT22); teacherPet.points = 9000; teacherPet.ledger = []; f.rows.set('petStates/t', teacherPet);
  f.rows.set('studySessions/s1', session('2026-09-10')); f.rows.set('studySessions/s2', session('2026-09-11')); f.rows.set('studySessions/s3', session('2026-09-11', 't'));
  const admin = {admin: true, academyId: 'main', uid: 'adm'};
  await assert.rejects(readLegacyPoints(f.db, {principal: true, academyId: 'main'}, OCT22), /FORBIDDEN/);
  assert.deepEqual(await readLegacyPoints(f.db, admin, OCT22), {students: [{name: '김하늘', held: 5000, legacy: 4500, days: 2, allowed: 600, take: 3900}], total: 3900, heldBack: []}, 'students only');
  assert.deepEqual(await applyLegacyPoints(f.db, admin, OCT22), {students: 1, total: 3900, failed: 0, heldBack: 0});
  const after = f.rows.get('petStates/a');
  assert.deepEqual([after.points, after.ledger.at(-1).label, after.ledger.at(-1).points, after.legacyCapped.took], [1100, LEGACY_LABEL, -3900, 3900]);
  assert.equal(monthEarned(after), 1100, 'October\u2019s coupon count (it held the device-era points) comes down too');
  assert.equal(f.rows.get('petStates/t').points, 9000, 'a teacher\u2019s pet is left alone');
  assert.deepEqual(await applyLegacyPoints(f.db, admin, OCT22), {students: 0, total: 0, failed: 0, heldBack: 0}, 'once');
});

test("예전 포인트 조정: records read to the end page by page; a student with more than the limit is held back, not adjusted from a part", async () => {
  const {readLegacyPoints, applyLegacyPoints} = await import('../api/_lib/legacyPoints.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const f = registrationFirestore(), admin = {admin: true, academyId: 'main', uid: 'adm'};
  f.rows.set(`notionStudentMappings/${hashStudentKey(A)}`, {studentKey: A, notionStudentPageId: A, internalStudentId: 'int-a', studentDisplayName: '김하늘', sourceMode: 'firestore', firebaseUid: 'a'});
  f.rows.set('users/a', {role: 'student', notionStudentKey: A});
  const pet = initialPetState(OCT22); pet.points = 5000; pet.ledger = [{day: '2026-09-25', kind: 'class', label: '출석', points: 500}]; f.rows.set('petStates/a', pet);
  for (let i = 0; i < 520; i++) f.rows.set(`studySessions/s${String(i).padStart(4, '0')}`, session(`2026-09-${String(1 + (i % 5)).padStart(2, '0')}`));
  assert.deepEqual((await readLegacyPoints(f.db, admin, OCT22)).students.map((s: any) => s.days), [5], 'two pages, every day counted');
  const held = await readLegacyPoints(f.db, admin, OCT22, 500);
  assert.deepEqual([held.students, held.heldBack], [[], ['김하늘']]);
  assert.deepEqual(await applyLegacyPoints(f.db, admin, OCT22, 500), {students: 0, total: 0, failed: 0, heldBack: 1});
  assert.equal(f.rows.get('petStates/a').points, 5000, 'left as it was');
});

test("예전 포인트 조정: exactly the limit with nothing past it is read in full (one more record looked for), not held back", async () => {
  const {readLegacyPoints} = await import('../api/_lib/legacyPoints.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const f = registrationFirestore(), admin = {admin: true, academyId: 'main', uid: 'adm'};
  f.rows.set(`notionStudentMappings/${hashStudentKey(A)}`, {studentKey: A, notionStudentPageId: A, internalStudentId: 'int-a', studentDisplayName: '김하늘', sourceMode: 'firestore', firebaseUid: 'a'});
  f.rows.set('users/a', {role: 'student', notionStudentKey: A});
  const pet = initialPetState(OCT22); pet.points = 5000; pet.ledger = [{day: '2026-09-25', kind: 'class', label: '출석', points: 500}]; f.rows.set('petStates/a', pet);
  for (let i = 0; i < 500; i++) f.rows.set(`studySessions/s${String(i).padStart(4, '0')}`, session(`2026-09-${String(1 + (i % 5)).padStart(2, '0')}`));
  const exact = await readLegacyPoints(f.db, admin, OCT22, 500);
  assert.deepEqual([exact.heldBack, exact.students.map((s: any) => s.days)], [[], [5]]);
  f.rows.set('studySessions/s0500', session('2026-09-06'));
  assert.deepEqual((await readLegacyPoints(f.db, admin, OCT22, 500)).heldBack, ['김하늘'], 'one past the limit: held back');
});

