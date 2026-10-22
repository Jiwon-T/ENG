// 종이 원서 사진: photos of the paper 입학원서 kept with a 상담·신입생 원서 (one document each, intakePhotos/{id}). Whoever
// may open the 원서 (assertIntakeAccess: its writer, a co-writer, 원장님·관리자) adds, opens and removes them. The list
// carries no image (each opens on its own), so a 원서 with several photos stays light.
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {assertIntakeAccess, type RegistrationActor} from './teacherStudentRegistration.js';
import {INTAKE_PHOTO_RULES} from '../../src/lib/intakePhotos.js';

const PHOTOS = 'intakePhotos', REGISTRATIONS = 'teacherStudentRegistrations';
const registrationId = z.string().regex(/^[a-f0-9]{64}$/), photoId = z.string().uuid();
async function openRegistration(db: any, actor: RegistrationActor, id: string) {
  assertIntakeAccess(actor);
  const r = (await db.collection(REGISTRATIONS).doc(id).get()).data();
  if (!r) throw Error('REGISTRATION_NOT_FOUND');
  assertIntakeAccess(actor, r);
  return r;
}
export async function listIntakePhotos(db: any, actor: RegistrationActor, idInput: unknown) {
  const id = registrationId.parse(idInput); await openRegistration(db, actor, id);
  const rows = (await db.collection(PHOTOS).where('registrationId', '==', id).get()).docs.map((d: any) => ({id: d.id, ...d.data()}));
  return {photos: rows.filter((p: any) => p.academyId === actor.academyId).sort((a: any, b: any) => a.at - b.at).map((p: any) => ({id: p.id, at: p.at}))};
}
export async function readIntakePhoto(db: any, actor: RegistrationActor, idInput: unknown) {
  const p = (await db.collection(PHOTOS).doc(photoId.parse(idInput)).get()).data();
  if (!p || p.academyId !== actor.academyId) throw Error('REGISTRATION_NOT_FOUND');
  await openRegistration(db, actor, p.registrationId);
  return {photo: String(p.data)};
}
export async function addIntakePhoto(db: any, actor: RegistrationActor, idInput: unknown, photoInput: unknown, now = Date.now()) {
  const id = registrationId.parse(idInput), photo = String(photoInput || '');
  if (photo.length > INTAKE_PHOTO_RULES.maxChars || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photo)) throw Error('INTAKE_PHOTO_BAD');
  const r = await openRegistration(db, actor, id);
  if (r.residentAt) throw Error('FORBIDDEN');
  const count = (await db.collection(PHOTOS).where('registrationId', '==', id).get()).docs.length;
  if (count >= INTAKE_PHOTO_RULES.maxPhotos) throw Error('INTAKE_PHOTO_LIMIT');
  const ref = db.collection(PHOTOS).doc(randomUUID());
  await ref.set({registrationId: id, academyId: actor.academyId, data: photo, at: now, by: actor.uid});
  return {id: ref.id, at: now};
}
export async function removeIntakePhoto(db: any, actor: RegistrationActor, idInput: unknown) {
  const ref = db.collection(PHOTOS).doc(photoId.parse(idInput)), p = (await ref.get()).data();
  if (!p || p.academyId !== actor.academyId) throw Error('REGISTRATION_NOT_FOUND');
  await openRegistration(db, actor, p.registrationId);
  await db.runTransaction(async (tx: any) => { tx.delete(ref); });
  return {removed: true};
}
