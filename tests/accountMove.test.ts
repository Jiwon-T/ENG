import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.ts';
import {moveStudentAccount, previewAccountMove, swapUid} from '../api/_lib/accountMove.ts';
import {attemptId} from '../api/_lib/questionAttempts.ts';
import {certId} from '../api/_lib/studyCerts.ts';
import {initialPetState} from '../api/_lib/pet.ts';

const A = 'oldAccountUid', B = 'newAccountUid', K = '11111111-1111-4111-8111-111111111111';
const admin = {uid: 'admin', admin: true, academyId: 'main'};
function world() {
  const f = registrationFirestore(), s = (path: string, v: any) => f.rows.set(path, v);
  s(`users/${A}`, {role: 'student', email: 'yw@x.com', notionStudentKey: K, petStats: {points: 1190}});
  s(`users/${B}`, {role: 'student', email: 'a0@x.com'});
  s('notionStudentMappings/m1', {firebaseUid: A, studentKey: K}); s('notionStudentMappings/m2', {firebaseUid: A, studentKey: K});
  s(`petStates/${A}`, {points: 1190, pets: [{slot: 1}, {slot: 2}], rewarded: {r1: ['attendance']}}); s(`petStates/${B}`, {points: 300, pets: [{slot: 1}]});
  s(`petTowers/${A}`, {pets: {'1': {best: 23}}}); s(`petGuild/${A}`, {parties: {w43: 'p1'}});
  s('petParties/p1', {members: [{uid: A}, {uid: 'C'}], votes: {[A]: 'x'}, results: {[A]: 10}});
  s('studySessions/s1', {uid: A, type: 'test'}); s('studySessions/s2', {uid: B, type: 'test'});
  s(`wordProgress/${A}_w1`, {uid: A, learned: true}); s(`wordProgress/${A}_w2`, {uid: A, learned: false}); s(`wordProgress/${B}_w2`, {uid: B, learned: true});
  s(`attendance/${A}_2026-10-01`, {studentId: A});
  s('questionAttempts/old', {uid: A, kind: 'self', setId: 'set1', status: 'submitted'});
  const cert = certId(A, 'workbook' as any, 'r', 0, K); s(`studyCerts/${cert}`, {uid: A, kind: 'workbook', ref: 'r', round: 0, studentKey: K}); s(`studyCertPhotos/${cert}`, {uid: A, data: 'x'});
  s(`users/${A}/assignmentCompletions/r1`, {completedAt: 1});
  s(`petCoupons/${A}_2026-10`, {uid: A, studentKey: K});
  s('petRooms/C', {neighbors: [A, 'D']}); s('petNames/fox_x', {owners: [`${A}:1`, 'E']}); s('petTowerHall/f1', {first: {uid: A}, fewest: {uid: 'C'}});
  s('questionAssignments/q1', {uids: [A, 'C'], targets: [{uid: A}]}); s('petRankings/current', {builtAt: 5});
  const blocked: string[] = [];
  return {f, blocked, auth: {updateUser: async (uid: string, v: any) => { if (v.disabled) blocked.push(uid); }, revokeRefreshTokens: async () => {}}};
}

test('swapUid: the account and its 펫 이름 slots, keys too; other values left', () => {
  assert.deepEqual(swapUid({a: [A, `${A}:2`, 'x'], [A]: 1, n: 3}, A, B), {a: [B, `${B}:2`, 'x'], [B]: 1, n: 3});
});

test('미리 세어 보기: what each account holds; only an admin; the new account must be unlinked', async () => {
  const {f} = world();
  const p: any = await previewAccountMove(f.db, admin, {fromUid: A, toUid: B});
  assert.deepEqual([p.from.sessions, p.from.words, p.from.points, p.from.pets, p.from.floor, p.from.done, p.to.sessions, p.to.points], [1, 2, 1190, 2, 23, 1, 1, 300]);
  await assert.rejects(previewAccountMove(f.db, {uid: 't', admin: false, academyId: 'main'}, {fromUid: A, toUid: B}), /FORBIDDEN/);
  f.rows.set(`users/${B}`, {role: 'student', notionStudentKey: 'other'});
  await assert.rejects(previewAccountMove(f.db, admin, {fromUid: A, toUid: B}), /ACCOUNT_MOVE_TARGET_LINKED/);
});

test('옮기기: 학습 기록 merged (the new copy wins), 펫·포인트 the old account’s, others’ records rewritten, the link moved, the old one blocked', async () => {
  const {f, auth, blocked} = world(), r = (p: string) => f.rows.get(p);
  const out: any = await moveStudentAccount(f.db, admin, {fromUid: A, toUid: B}, auth, 1000);
  // pet (with the lessons already paid): the old one, and the old copy gone
  assert.deepEqual([r(`petStates/${B}`).points, r(`petStates/${B}`).rewarded.r1, f.rows.has(`petStates/${A}`), r(`petTowers/${B}`).pets['1'].best], [1190, ['attendance'], false, 23]);
  // study records
  assert.deepEqual([r('studySessions/s1').uid, r('studySessions/s2').uid], [B, B]);
  assert.deepEqual([r(`wordProgress/${B}_w1`).uid, r(`wordProgress/${B}_w2`).learned, f.rows.has(`wordProgress/${A}_w1`)], [B, true, false], 'B’s own word kept');
  assert.equal(r(`attendance/${B}_2026-10-01`).studentId, B);
  assert.equal(r(`questionAttempts/${attemptId(B, 'set1')}`).status, 'submitted');
  const cert = certId(B, 'workbook' as any, 'r', 0, K);
  assert.deepEqual([r(`studyCerts/${cert}`).uid, r(`studyCertPhotos/${cert}`).uid], [B, B]);
  assert.ok(f.rows.has(`users/${B}/assignmentCompletions/r1`) && !f.rows.has(`users/${A}/assignmentCompletions/r1`));
  assert.equal(r(`petCoupons/${B}_2026-10`).uid, B);
  // others' records
  assert.deepEqual(r('petParties/p1'), {members: [{uid: B}, {uid: 'C'}], votes: {[B]: 'x'}, results: {[B]: 10}});
  assert.deepEqual([r('petRooms/C').neighbors, r('petNames/fox_x').owners, r('petTowerHall/f1').first.uid, r('questionAssignments/q1').uids], [[B, 'D'], [`${B}:1`, 'E'], B, [B, 'C']]);
  assert.equal(r('petRankings/current').builtAt, 0);
  // the link
  assert.deepEqual([r('notionStudentMappings/m1').firebaseUid, r('notionStudentMappings/m2').firebaseUid, r(`users/${B}`).notionStudentKey, r(`users/${B}`).petStats.points], [B, B, K, 1190]);
  assert.deepEqual([r(`users/${A}`).notionStudentKey, r(`users/${A}`).movedTo, r(`users/${A}`).signInBlocked], [null, B, true]);
  assert.deepEqual([blocked, out.signInBlocked], [[A], true]);
  assert.ok([...f.rows.keys()].some(k => k.startsWith('accountMoves/')));
});

// 기존 계정으로 옮기기: U (not linked) into L (linked)
const U = 'unlinkedUid', L = 'linkedUid';
function mergeWorld(lHasPet = true) {
  const f = registrationFirestore(), s = (path: string, v: any) => f.rows.set(path, v);
  s(`users/${U}`, {role: 'student', email: 'u@x.com', name: '박서준'}); s(`users/${L}`, {role: 'student', email: 'l@x.com', name: '박서준', notionStudentKey: K});
  const state = (points: number, name: string, extra = {}) => { const x: any = initialPetState(0); x.pets[0].name = name; return {...x, points, ...extra}; };
  s(`petStates/${U}`, state(320, '말랑이')); if (lHasPet) s(`petStates/${L}`, state(2140, '고미', {rewarded: {r1: ['attendance']}}));
  s(`petTowers/${U}`, {pets: {'1': {best: 9}}}); s(`petRooms/${U}`, {owner: U}); s('petRoomCodes/c1', {uid: U});
  s('studySessions/u1', {uid: U, type: 'test'}); s('studySessions/l1', {uid: L, type: 'test'});
  s(`wordProgress/${U}_w1`, {uid: U, learned: true}); s(`wordProgress/${U}_w2`, {uid: U, learned: true}); s(`wordProgress/${L}_w2`, {uid: L, learned: false});
  s(`passageViews/${U}_p1`, {uid: U, passageId: 'p1', at: 1}); s(`workbookHistory/${U}:k1`, {ownerUid: U, key: 'k1', version: 2});
  s('questionAttempts/old', {uid: U, kind: 'self', setId: 'set9', status: 'submitted'});
  s(`aiPasses/${U}`, {plan: 'pet', until: '2099-01-01'}); s('petRankings/current', {builtAt: 5});
  const blocked: string[] = [];
  return {f, blocked, auth: {updateUser: async (uid: string, v: any) => { if (v.disabled) blocked.push(uid); }, revokeRefreshTokens: async () => {}}};
}

test('기존 계정으로 옮기기: 학습 기록 join the linked account (its own copy wins), only the points are added, the account moved is blocked', async () => {
  const {mergeIntoLinkedAccount, previewAccountMerge} = await import('../api/_lib/accountMove.ts');
  const {f, auth, blocked} = mergeWorld();
  await assert.rejects(previewAccountMerge(f.db, {uid: 't', admin: false, academyId: 'main'}, {fromUid: U, toUid: L}), /FORBIDDEN/);
  await assert.rejects(previewAccountMerge(f.db, admin, {fromUid: L, toUid: U}), /ACCOUNT_MERGE_FROM_LINKED/);
  const p: any = await previewAccountMerge(f.db, admin, {fromUid: U, toUid: L});
  assert.deepEqual([p.from.sessions, p.from.words, p.from.passages, p.from.workbooks, p.from.points, p.to.points], [1, 2, 1, 1, 320, 2140]);
  const r: any = await mergeIntoLinkedAccount(f.db, admin, {fromUid: U, toUid: L}, auth, 1000);
  assert.equal(r.points, 320);
  const pet = f.rows.get(`petStates/${L}`);
  assert.equal(pet.points, 2460); assert.equal(pet.pets[0].name, '고미', "the linked account's pet stays"); assert.deepEqual(pet.rewarded, {r1: ['attendance']});
  assert.equal(f.rows.get(`users/${L}`).petStats.points, 2460);
  assert.equal(f.rows.has(`petStates/${U}`), false); assert.equal(f.rows.has(`petTowers/${U}`), false); assert.equal(f.rows.has(`petTowers/${L}`), false, "U's tower does not come over");
  assert.equal(f.rows.has('petRoomCodes/c1'), false);
  assert.equal(f.rows.get('studySessions/u1').uid, L);
  assert.equal(f.rows.get(`wordProgress/${L}_w1`).learned, true); assert.equal(f.rows.get(`wordProgress/${L}_w2`).learned, false, "L's own copy wins");
  assert.equal(f.rows.has(`wordProgress/${U}_w1`), false);
  assert.equal(f.rows.get(`passageViews/${L}_p1`).uid, L); assert.equal(f.rows.get(`workbookHistory/${L}:k1`).ownerUid, L);
  assert.equal(f.rows.get(`questionAttempts/${attemptId(L, 'set9')}`).uid, L); assert.equal(f.rows.has('questionAttempts/old'), false);
  assert.equal(f.rows.get(`aiPasses/${L}`).until, '2099-01-01', 'a pass in force comes over');
  assert.equal(f.rows.get(`users/${L}`).notionStudentKey, K); assert.equal(f.rows.get(`users/${U}`).movedTo, L);
  assert.deepEqual(blocked, [U]); assert.equal(f.rows.get(`users/${U}`).signInBlocked, true);
  assert.equal(f.rows.get('petRankings/current').builtAt, 0);
  // run again: nothing left under U, the points are not added twice
  await mergeIntoLinkedAccount(f.db, admin, {fromUid: U, toUid: L}, auth, 2000);
  assert.equal(f.rows.get(`petStates/${L}`).points, 2460);
});

test('기존 계정으로 옮기기: when the linked account has no pet yet, the pet comes over whole', async () => {
  const {mergeIntoLinkedAccount} = await import('../api/_lib/accountMove.ts');
  const {f, auth} = mergeWorld(false);
  const r: any = await mergeIntoLinkedAccount(f.db, admin, {fromUid: U, toUid: L}, auth, 1000);
  assert.equal(r.points, 0); assert.equal(f.rows.get(`petStates/${L}`).points, 320); assert.equal(f.rows.get(`petStates/${L}`).pets[0].name, '말랑이');
  assert.equal(f.rows.get(`petTowers/${L}`).pets['1'].best, 9); assert.equal(f.rows.get(`petRooms/${L}`).owner, L);
  assert.equal(f.rows.has(`petStates/${U}`), false);
});
