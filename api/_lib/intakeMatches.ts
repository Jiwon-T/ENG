// 상담·신입생 원서, one per student: the same student talked to by two teachers (one on paper, one in the app) ends up in
// one 원서. While a 원서 is written, the ones that look like the same student are shown (name + a phone, or name + school
// and grade); "같이 쓰기" adds the teacher as a co-writer (coWriters) so both see and edit that 원서.
import {z} from 'zod';
import {assertIntakeAccess, registrationSummary, type RegistrationActor} from './teacherStudentRegistration.js';

const REGISTRATIONS = 'teacherStudentRegistrations', MAX_CO_WRITERS = 10;
const nameKey = (v: unknown) => String(v || '').replace(/\s+/g, '').replace(/\(.*\)$/, '');
const phoneKey = (v: unknown) => String(v || '').replace(/\D/g, '');
// '용죽고등학교' = '용죽고' (the list's own short form), '평택여자중학교' = '평택여자중'
const schoolKey = (v: unknown) => String(v || '').replace(/\s+/g, '').replace(/고등학교$/, '고').replace(/중학교$/, '중').replace(/초등학교$/, '초').replace(/학교$/, '');
const matchInput = z.object({name: z.string().trim().min(2).max(60), studentPhone: z.string().max(30).optional(), guardianPhone: z.string().max(30).optional(),
  school: z.string().max(80).optional(), grade: z.string().max(10).optional(), exceptId: z.string().regex(/^[a-f0-9]{64}$/).optional()});
export interface IntakeMatch {id: string; title: string; writer: string; updatedAt: number; by: 'phone' | 'school'; mine: boolean}

/** The 원서 (not yet 재원생) that look like this student: the same name and a phone in common, or the same name, school
 *  and grade. Only what tells them apart is shown (title, who wrote it, when) — phones stay in the 원서 until joined. */
export async function findIntakeMatches(db: any, actor: RegistrationActor, input: unknown): Promise<IntakeMatch[]> {
  assertIntakeAccess(actor);
  const v = matchInput.parse(input), name = nameKey(v.name), phones = [v.studentPhone, v.guardianPhone].map(phoneKey).filter(p => p.length >= 9);
  const rows = (await db.collection(REGISTRATIONS).where('academyId', '==', actor.academyId).get()).docs.map((d: any) => ({id: d.id, r: d.data()}));
  const out: IntakeMatch[] = [];
  for (const {id, r} of rows) {
    if (id === v.exceptId || r.residentAt || r.academyId !== actor.academyId || nameKey(r.data?.name) !== name) continue;
    const theirs = [r.data?.studentPhone, r.data?.guardianPhone].map(phoneKey).filter((p: string) => p.length >= 9);
    const by = phones.some(p => theirs.includes(p)) ? 'phone' : v.school && v.grade && schoolKey(v.school) === schoolKey(r.data?.school) && v.grade === r.data?.grade ? 'school' : null;
    if (!by) continue;
    const user = r.ownerUid ? (await db.collection('users').doc(r.ownerUid).get()).data() : null;
    out.push({id, title: String(r.title || r.data?.name || '원서'), writer: String(user?.alias || user?.name || '선생님'), updatedAt: Number(r.updatedAt || 0), by,
      mine: Boolean(actor.admin || actor.principal || r.ownerUid === actor.uid || (r.coWriters || []).includes(actor.uid))});
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
}

/** 같이 쓰기: the teacher joins another teacher's 원서 (a new student's, not yet 재원생) and then reads and edits it. */
export async function joinStudentRegistration(db: any, actor: RegistrationActor, idInput: unknown) {
  assertIntakeAccess(actor);
  const id = z.string().regex(/^[a-f0-9]{64}$/).parse(idInput), ref = db.collection(REGISTRATIONS).doc(id);
  return db.runTransaction(async (tx: any) => {
    const r = (await tx.get(ref)).data();
    if (!r) throw Error('REGISTRATION_NOT_FOUND');
    if (r.academyId !== actor.academyId || r.residentAt || (r.data?.purpose || 'new') !== 'new' && !actor.admin && !actor.principal) throw Error('FORBIDDEN');
    const coWriters: string[] = r.coWriters || [];
    if (!actor.admin && !actor.principal && r.ownerUid !== actor.uid && !coWriters.includes(actor.uid)) {
      if (coWriters.length >= MAX_CO_WRITERS) throw Error('FORBIDDEN');
      tx.set(ref, {...r, coWriters: [...coWriters, actor.uid], updatedAt: Date.now()});
      return {record: registrationSummary(id, {...r, coWriters: [...coWriters, actor.uid]})};
    }
    return {record: registrationSummary(id, r)};
  });
}

const plain = (p: any) => (p?.title || p?.rich_text || []).map((v: any) => v.plain_text ?? v.text?.content ?? '').join('');
const titleOf = (props: any) => Object.values(props || {}).map((p: any) => p?.title ? plain(p) : '').filter(Boolean).join('');
export interface RegisteredMatch {studentKey: string; title: string; status: string; subjects: string[]; by: 'phone' | 'school'}
/** 등록 확정 전: students already on the list that look like this 원서's student (the same name with a phone in common, or
 *  the same "이름 (학교학년)"), so a second teacher does not register the same child twice. Name, status and subjects
 *  only. */
export async function findRegisteredMatches(db: any, actor: RegistrationActor, idInput: unknown): Promise<RegisteredMatch[]> {
  assertIntakeAccess(actor);
  const id = z.string().regex(/^[a-f0-9]{64}$/).parse(idInput), r = (await db.collection(REGISTRATIONS).doc(id).get()).data();
  if (!r) throw Error('REGISTRATION_NOT_FOUND');
  assertIntakeAccess(actor, r);
  const v = r.data || {}, name = nameKey(v.name), phones = [v.studentPhone, v.guardianPhone].map(phoneKey).filter((p: string) => p.length >= 9);
  const spaced = (s: unknown) => String(s || '').replace(/\s+/g, ''), title = spaced(r.title), out: RegisteredMatch[] = [];
  const rows = (await db.collection('academyDirectorySources').where('academyId', '==', actor.academyId).where('kind', '==', 'students').get()).docs.map((d: any) => d.data());
  for (const row of rows) {
    const props = row.fields?.properties; if (!props || row.fields?.archived || row.fields?.in_trash || row.issue || row.studentKey === r.studentKey) continue;
    const full = titleOf(props); if (nameKey(full) !== name && nameKey(full.replace(/\s*\(.*\)\s*$/, '')) !== name) continue;
    const theirs = [props['학생연락처']?.phone_number, props['보호자연락처']?.phone_number].map(phoneKey).filter((p: string) => p.length >= 9);
    const by = phones.some((p: string) => theirs.includes(p)) ? 'phone' : title && /\(/.test(title) && spaced(full) === title ? 'school' : null;
    if (!by) continue;
    out.push({studentKey: String(row.studentKey || row.entityId || ''), title: full, status: props['등록상태']?.select?.name || props['등록상태']?.status?.name || '',
      subjects: (props['강의명']?.multi_select || []).map((s: any) => s.name), by});
  }
  return out.slice(0, 5);
}
