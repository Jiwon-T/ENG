import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.ts';
import { hashStudentKey } from '../api/_lib/security.ts';
import { initialPetState } from '../api/_lib/pet.ts';
import { attemptId } from '../api/_lib/questionAttempts.ts';
import { certId, decideStudyCert, loadStudentCerts, myStudyCerts, requestStudyCert, studyCertPhoto } from '../api/_lib/studyCerts.ts';

const NOW = Date.parse('2026-10-19T03:00:00Z'), DAY = 86_400_000;
const K1 = '11111111-1111-4111-8111-111111111111', KX = '44444444-4444-4444-8444-444444444444';
const PHOTO = 'data:image/jpeg;base64,' + 'A'.repeat(400);
function setup() {
  const f = registrationFirestore();
  f.rows.set(`notionStudentMappings/${hashStudentKey(K1)}`, { studentKey: K1, notionStudentPageId: K1, internalStudentId: 'int-1', studentDisplayName: '김하늘', sourceMode: 'firestore', firebaseUid: 'kid1' });
  f.rows.set('users/kid1', { name: '김하늘', role: 'student', notionStudentKey: K1 });
  f.rows.set('users/solo', { name: '혼자', role: 'student' });
  f.rows.set('petStates/kid1', initialPetState(NOW));
  f.rows.set('workbookHistory/kid1:wbkey1', { ownerUid: 'kid1', key: 'wbkey1', title: '10월 모의고사 18번', version: 1, versions: [] });
  f.rows.set('passages/psg001', { id: 'psg001', title: '20번 지문', sentences: ['A.'], public: false });
  f.rows.set('passageViews/kid1_psg001', { uid: 'kid1', passageId: 'psg001', at: NOW });
  f.rows.set('passages/other1', { id: 'other1', sentences: ['B.'], public: false });
  f.rows.set(`questionAttempts/${attemptId('kid1', 'set001')}`, { uid: 'kid1', kind: 'self', setId: 'set001', title: '내 문제', status: 'submitted', score: { correct: 3, total: 4 } });
  const actor = { uid: 'teacher', admin: false, principal: false, academyId: 'main', scopes: [{ studentKey: K1, subject: '영어' }] };
  return { f, actor };
}
const points = (f: any) => f.rows.get('petStates/kid1').points;

test('인증: a linked student asks about their own 워크북; the teacher grades it and the points are paid outside the study cap', async () => {
  const { f, actor } = setup();
  const pet = f.rows.get('petStates/kid1'); f.rows.set('petStates/kid1', { ...pet, today: { ...pet.today, studyPoints: 10_000 } }); // the cap used up
  const asked: any = await requestStudyCert(f.db, 'kid1', { kind: 'workbook', ref: 'wbkey1', photo: PHOTO }, NOW);
  assert.deepEqual([asked.cert.status, asked.cert.title, asked.cert.photo], ['pending', '10월 모의고사 18번', true]);
  await assert.rejects(requestStudyCert(f.db, 'kid1', { kind: 'workbook', ref: 'wbkey1' }, NOW), /CERT_PENDING/);
  const list: any = await loadStudentCerts(f.db, actor, K1);
  assert.equal(list.certs[0].id, asked.cert.id);
  assert.equal((await studyCertPhoto(f.db, actor, K1, asked.cert.id)).photo, PHOTO);
  await assert.rejects(decideStudyCert(f.db, actor, { studentKey: K1, id: asked.cert.id, grade: 'ok' }, NOW), /INVALID_INPUT/, 'a 워크북 takes 최상·상·중');
  const before = points(f);
  const done: any = await decideStudyCert(f.db, actor, { studentKey: K1, id: asked.cert.id, grade: '최상' }, NOW + 1);
  assert.deepEqual([done.cert.status, done.cert.points, points(f) - before], ['approved', 30, 30], 'paid in full although the study cap was used up');
  assert.equal(f.rows.has(`studyCertPhotos/${asked.cert.id}`), false, 'the photo goes once decided');
  await assert.rejects(decideStudyCert(f.db, actor, { studentKey: K1, id: asked.cert.id, grade: '상' }, NOW + 2), /CERT_DECIDED/);
  await assert.rejects(requestStudyCert(f.db, 'kid1', { kind: 'workbook', ref: 'wbkey1' }, NOW + 3), /CERT_DONE/);
  assert.equal(f.rows.get('petStates/kid1').earned.points >= 30, true, 'it counts for the 장학 쿠폰');
});

test('인증: 다시 해 오기 pays nothing and can be asked again; only own things, only linked students, only the teacher who reaches them', async () => {
  const { f, actor } = setup();
  const asked: any = await requestStudyCert(f.db, 'kid1', { kind: 'questions', ref: 'set001' }, NOW);
  const redo: any = await decideStudyCert(f.db, actor, { studentKey: K1, id: asked.cert.id, grade: 'redo' }, NOW + 1);
  assert.deepEqual([redo.cert.status, redo.cert.points, points(f)], ['redo', 0, initialPetState(NOW).points]);
  const again: any = await requestStudyCert(f.db, 'kid1', { kind: 'questions', ref: 'set001' }, NOW + 2);
  assert.equal(again.cert.status, 'pending');
  const ok: any = await decideStudyCert(f.db, actor, { studentKey: K1, id: again.cert.id, grade: 'ok' }, NOW + 3);
  assert.equal(ok.cert.points, 3 * 5 + 1 * 2, 'a set they made: like a set a teacher gave (5P right, 2P wrong)');
  await assert.rejects(requestStudyCert(f.db, 'solo', { kind: 'workbook', ref: 'wbkey1' }, NOW), /CERT_NOT_LINKED/);
  await assert.rejects(requestStudyCert(f.db, 'kid1', { kind: 'reading', ref: 'other1' }, NOW), /CERT_NOT_FOUND/, 'a passage they never opened');
  await assert.rejects(requestStudyCert(f.db, 'kid1', { kind: 'workbook', ref: 'nope99' }, NOW), /CERT_NOT_FOUND/);
  await assert.rejects(requestStudyCert(f.db, 'kid1', { kind: 'workbook', ref: 'wbkey1', photo: 'data:image/png;base64,AAAA' }, NOW), /CERT_PHOTO_BAD/);
  const outsider = { ...actor, scopes: [{ studentKey: KX, subject: '영어' }] };
  const w: any = await requestStudyCert(f.db, 'kid1', { kind: 'workbook', ref: 'wbkey1' }, NOW);
  await assert.rejects(decideStudyCert(f.db, outsider, { studentKey: K1, id: w.cert.id, grade: '상' }, NOW), /FORBIDDEN/);
  assert.deepEqual((await loadStudentCerts(f.db, outsider, K1)).certs, []);
});

test('회독: one a day, up to 3 a passage, 10P each', async () => {
  const { f, actor } = setup();
  for (let round = 1; round <= 3; round++) {
    const at = NOW + (round - 1) * DAY;
    const asked: any = await requestStudyCert(f.db, 'kid1', { kind: 'reading', ref: 'psg001' }, at);
    assert.equal(asked.cert.round, round);
    assert.equal(asked.cert.id, certId('kid1', 'reading', 'psg001', round));
    const done: any = await decideStudyCert(f.db, actor, { studentKey: K1, id: asked.cert.id, grade: 'ok' }, at + 1);
    assert.equal(done.cert.points, 10);
    if (round < 3) await assert.rejects(requestStudyCert(f.db, 'kid1', { kind: 'reading', ref: 'psg001' }, at + 2), /CERT_ONE_A_DAY/);
  }
  await assert.rejects(requestStudyCert(f.db, 'kid1', { kind: 'reading', ref: 'psg001' }, NOW + 5 * DAY), /CERT_DONE/);
  assert.equal((await myStudyCerts(f.db, 'kid1', { kind: 'reading', ref: 'psg001' })).certs.length, 3);
});

test('인증: at most 5 paid a day (the next day again), at most 10 waiting', async () => {
  const { f, actor } = setup();
  const ids: string[] = [];
  for (let i = 0; i < 6; i++) {
    f.rows.set(`workbookHistory/kid1:wb${i}xx`, { ownerUid: 'kid1', key: `wb${i}xx`, title: `W${i}` });
    ids.push((await requestStudyCert(f.db, 'kid1', { kind: 'workbook', ref: `wb${i}xx` }, NOW) as any).cert.id);
  }
  for (const id of ids.slice(0, 5)) await decideStudyCert(f.db, actor, { studentKey: K1, id, grade: '중' }, NOW + 1);
  await assert.rejects(decideStudyCert(f.db, actor, { studentKey: K1, id: ids[5], grade: '중' }, NOW + 2), /CERT_DAILY_LIMIT/);
  assert.equal((await decideStudyCert(f.db, actor, { studentKey: K1, id: ids[5], grade: '중' }, NOW + DAY) as any).cert.status, 'approved', 'tomorrow');
  for (let i = 0; i < 10; i++) { f.rows.set(`workbookHistory/kid1:many${i}`, { ownerUid: 'kid1', key: `many${i}`, title: 'M' }); if (i < 10) await requestStudyCert(f.db, 'kid1', { kind: 'workbook', ref: `many${i}` }, NOW); }
  f.rows.set('workbookHistory/kid1:many10', { ownerUid: 'kid1', key: 'many10', title: 'M' });
  await assert.rejects(requestStudyCert(f.db, 'kid1', { kind: 'workbook', ref: 'many10' }, NOW), /CERT_TOO_MANY/);
});

test('워크북 (학생): a student saves their own workbook version, then asks for it to be checked', async () => {
  const { saveWorkbookVersion } = await import('../api/_lib/teacherWorkbook.ts');
  const { f } = setup();
  await saveWorkbookVersion(f.db, { uid: 'kid1' }, { key: 'mine123', title: '내 워크북', blanks: [[1]], orders: [[0]] }, NOW);
  const asked: any = await requestStudyCert(f.db, 'kid1', { kind: 'workbook', ref: 'mine123' }, NOW);
  assert.equal(asked.cert.title, '내 워크북');
  await assert.rejects(requestStudyCert(f.db, 'kid1', { kind: 'workbook', ref: 'wbkey1x' }, NOW), /CERT_NOT_FOUND/, 'only a workbook this account made');
});
