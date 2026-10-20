import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {initialPetState} from '../api/_lib/pet.js';

const OCT22 = Date.parse('2026-10-22T05:00:00Z');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333';

test('대기 포인트 모두 넣기: the admin sees how many students and points wait, then pays them as 반영 does — once; no app account is left alone', async () => {
  const {readWaitingPoints, settleWaitingPoints} = await import('../api/_lib/settleWaiting.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const f = registrationFirestore();
  const student = (key: string, internal: string, uid?: string) => {
    f.rows.set(`academyStudentMemberships/${key}`, {academyId: 'main'});
    f.rows.set(`notionStudentMappings/${hashStudentKey(key)}`, {studentKey: key, notionStudentPageId: key, internalStudentId: internal, studentDisplayName: '학생', sourceMode: 'firestore', ...(uid ? {firebaseUid: uid} : {})});
    if (uid) f.rows.set(`users/${uid}`, {role: 'student', notionStudentKey: key});
  };
  // A: no app account; B: linked with a pet; C: linked, no pet yet
  student(A, 'int-a'); student(B, 'int-b', 'b'); student(C, 'int-c', 'c');
  const pet = initialPetState(OCT22); pet.points = 100; pet.earned = {month: '2026-10', points: 0}; f.rows.set('petStates/b', pet);
  const lesson = (who: string, id: string, date: string) => f.rows.set(`lessonReports/${id}`, {internalStudentId: who, reportIdentity: id, lessonDateStart: date, attendance: '출석', attitude: '', homework: '', test: ''});
  lesson('int-a', 'a1', '2026-09-15T14:00:00+09:00'); lesson('int-b', 'b1', '2026-09-15T14:00:00+09:00'); lesson('int-c', 'c1', '2026-09-16T14:00:00+09:00');
  const admin = {admin: true, academyId: 'main', uid: 'adm'};
  await assert.rejects(readWaitingPoints(f.db, {academyId: 'main', uid: 't', scopes: [{studentKey: B}]}, OCT22), /FORBIDDEN/);
  await assert.rejects(settleWaitingPoints(f.db, {principal: true, academyId: 'main', uid: 'p'}, OCT22), /FORBIDDEN/);
  assert.deepEqual(await readWaitingPoints(f.db, admin, OCT22), {students: 2, points: 60, failed: 0});
  assert.deepEqual(await settleWaitingPoints(f.db, admin, OCT22), {students: 2, points: 60, failed: 0});
  assert.deepEqual([f.rows.get('petStates/b').points, f.rows.get('petStates/c').points], [130, 30], 'the pet account made for C');
  assert.equal(f.rows.has('petStates/a'), false, 'no app account: nothing to pay into');
  assert.ok((f.rows.get('petStates/b').inbox || []).length > 0, 'shown in the popup inbox next time');
  assert.deepEqual(await readWaitingPoints(f.db, admin, OCT22), {students: 0, points: 0, failed: 0}, 'nothing left');
  assert.deepEqual(await settleWaitingPoints(f.db, admin, OCT22), {students: 0, points: 0, failed: 0}, 'never paid twice');
});

test("대기 포인트 모두 넣기: a student whose count can't be read is counted as failed (never left out silently)", async () => {
  const {readWaitingPoints, settleWaitingPoints} = await import('../api/_lib/settleWaiting.js');
  const f = registrationFirestore();
  const {hashStudentKey} = await import('../api/_lib/security.js');
  f.rows.set(`academyStudentMemberships/${A}`, {academyId: 'main'});
  f.rows.set(`notionStudentMappings/${hashStudentKey(A)}`, {studentKey: A, notionStudentPageId: A, internalStudentId: 'int-a', studentDisplayName: '학생', sourceMode: 'firestore', firebaseUid: 'a'});
  // the account read fails
  const db: any = new Proxy(f.db, {get: (t: any, k) => k === 'collection' ? (name: string) => name === 'users' ? {doc: () => ({get: async () => { throw Error('READ'); }})} : t.collection(name) : t[k]});
  const admin = {admin: true, academyId: 'main', uid: 'adm'};
  assert.deepEqual(await readWaitingPoints(db, admin, OCT22), {students: 0, points: 0, failed: 1});
  assert.deepEqual(await settleWaitingPoints(db, admin, OCT22), {students: 0, points: 0, failed: 1});
});

test('대기 포인트 모두 넣기: a failed read of the student record or the lessons is a failure too, not "nothing waiting"', async () => {
  const {readWaitingPoints, settleWaitingPoints} = await import('../api/_lib/settleWaiting.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const admin = {admin: true, academyId: 'main', uid: 'adm'};
  for (const broken of ['notionStudentMappings', 'lessonReports']) {
    const f = registrationFirestore();
    f.rows.set(`academyStudentMemberships/${A}`, {academyId: 'main'});
    f.rows.set(`notionStudentMappings/${hashStudentKey(A)}`, {studentKey: A, notionStudentPageId: A, internalStudentId: 'int-a', studentDisplayName: '학생', sourceMode: 'firestore', firebaseUid: 'a'});
    f.rows.set('users/a', {role: 'student', notionStudentKey: A});
    const fail = async () => { throw Error('READ'); };
    const db: any = new Proxy(f.db, {get: (t: any, k) => k === 'collection' ? (name: string) => name === broken ? {doc: () => ({get: fail}), where: () => ({get: fail, limit: () => ({get: fail})})} : t.collection(name) : t[k]});
    assert.deepEqual(await readWaitingPoints(db, admin, OCT22), {students: 0, points: 0, failed: 1}, `${broken} read fails`);
    assert.deepEqual(await settleWaitingPoints(db, admin, OCT22), {students: 0, points: 0, failed: 1}, `${broken} read fails`);
  }
});

