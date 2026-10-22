import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {saveStudentRegistration} from '../api/_lib/teacherStudentRegistration.js';
import {joinStudentRegistration} from '../api/_lib/intakeMatches.js';
import {addIntakePhoto, listIntakePhotos, readIntakePhoto, removeIntakePhoto} from '../api/_lib/intakePhotos.js';

const t1 = {uid: 't1', admin: false, principal: false, academyId: 'academy-a'}, t2 = {...t1, uid: 't2'};
const input = {name: '김동하', school: '용죽고', grade: '고1', enrollments: [{subject: '영어', status: '등록', startDate: '2026-10-22'}]};
const jpeg = 'data:image/jpeg;base64,' + 'A'.repeat(400);

test('종이 원서 사진: the writer adds, lists (no image), opens and removes; a co-writer too; others and bad files refused; up to 6', async () => {
  const f = registrationFirestore();
  const r = await saveStudentRegistration(f.db, t1, input, '11111111-1111-4111-8111-111111111111');
  const added = await addIntakePhoto(f.db, t1, r.id, jpeg, 1000);
  const list = await listIntakePhotos(f.db, t1, r.id);
  assert.deepEqual(list.photos, [{id: added.id, at: 1000}], 'no image in the list');
  assert.equal((await readIntakePhoto(f.db, t1, added.id)).photo, jpeg);
  await assert.rejects(readIntakePhoto(f.db, t2, added.id), /FORBIDDEN/, 'not before joining');
  await assert.rejects(addIntakePhoto(f.db, t1, r.id, 'data:image/png;base64,AAAA'), /INTAKE_PHOTO_BAD/);
  await joinStudentRegistration(f.db, t2, r.id);
  assert.equal((await readIntakePhoto(f.db, t2, added.id)).photo, jpeg, 'a co-writer reads it');
  for (let i = 0; i < 5; i++) await addIntakePhoto(f.db, t2, r.id, jpeg, 2000 + i);
  await assert.rejects(addIntakePhoto(f.db, t1, r.id, jpeg), /INTAKE_PHOTO_LIMIT/);
  await assert.rejects(removeIntakePhoto(f.db, {...t1, uid: 't3'}, added.id), /FORBIDDEN/);
  await removeIntakePhoto(f.db, t1, added.id);
  assert.equal((await listIntakePhotos(f.db, t1, r.id)).photos.length, 5);
});
