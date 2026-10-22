// 상담 일정 ↔ 신입생 원서: a 상담 일정 names 신입생 (data.prospects, by name). The first time a teacher saves the 원서 opened
// from its card, the 원서 is tied to that name on the 일정 (consultLinks, kept beside the data so the 일정 revision does not
// move). Reading the 일정 back carries each tie's state: the 원서 still being written, or the registered student.
import {z} from 'zod';
import {canAccessOwned} from './teacherWorkspacePolicy.js';
import {assertIntakeAccess} from './teacherStudentRegistration.js';

const SCHEDULES = 'teacherSchedules', REGISTRATIONS = 'teacherStudentRegistrations';
// the other way round (원서 → its 상담 일정), so the 원서 shows its 일정 and is not given a second one
const REVERSE = 'consultScheduleLinks';
const linkInput = z.object({scheduleId: z.string().uuid(), name: z.string().trim().min(1).max(60), registrationId: z.string().regex(/^[a-f0-9]{64}$/)}).strict();

/** Ties the 원서 to the 신입생 of a 상담 일정 the teacher may edit (once; a later tie for that name replaces it). */
export async function linkConsultRegistration(db: any, actor: any, input: unknown) {
  const v = linkInput.parse(input), ref = db.collection(SCHEDULES).doc(v.scheduleId), regRef = db.collection(REGISTRATIONS).doc(v.registrationId);
  return db.runTransaction(async (tx: any) => {
    const [s, r] = [(await tx.get(ref)).data(), (await tx.get(regRef)).data()];
    if (!s || s.archived || s.deleteRequested || !canAccessOwned(actor, s.ownerUid, s.academyId)) throw Error('FORBIDDEN');
    if (s.data?.kind !== '상담' || !(s.data.prospects || []).some((p: any) => p.name === v.name)) throw Error('INVALID_INPUT');
    if (!r) throw Error('REGISTRATION_NOT_FOUND');
    assertIntakeAccess(actor, r);
    tx.set(ref, {...s, consultLinks: {...(s.consultLinks || {}), [v.name]: v.registrationId}});
    tx.set(db.collection(REVERSE).doc(v.registrationId), {scheduleId: v.scheduleId, name: v.name, academyId: s.academyId, at: Date.now()});
    return {linked: true};
  });
}

export interface ConsultTie {registrationId: string; studentKey: string | null; title: string}
/** The ties of these 일정 with their state (only 원서 the teacher may open; a 원서 gone or out of reach is left out). */
export async function consultTies(db: any, actor: any, records: any[]): Promise<Record<string, Record<string, ConsultTie>>> {
  const out: Record<string, Record<string, ConsultTie>> = {}, cache = new Map<string, any>();
  for (const rec of records) {
    const links = rec?.consultLinks; if (!links || rec.data?.kind !== '상담') continue;
    for (const [name, id] of Object.entries(links) as [string, string][]) {
      if (!cache.has(id)) cache.set(id, (await db.collection(REGISTRATIONS).doc(id).get()).data() || null);
      const r = cache.get(id); if (!r) continue;
      try { assertIntakeAccess(actor, r); } catch { continue; }
      (out[rec.id] ||= {})[name] = {registrationId: id, studentKey: r.studentKey || r.notionStudentPageId || null, title: String(r.title || name)};
    }
  }
  return out;
}

const regId = z.string().regex(/^[a-f0-9]{64}$/);
async function openRegistration(db: any, actor: any, id: string) {
  const r = (await db.collection(REGISTRATIONS).doc(id).get()).data();
  if (!r) throw Error('REGISTRATION_NOT_FOUND');
  assertIntakeAccess(actor, r);
  return r;
}
/** The 상담 일정 a 원서 is tied to (still there, not deleted), or null. */
export async function readConsultSchedule(db: any, actor: any, idInput: unknown) {
  const id = regId.parse(idInput); await openRegistration(db, actor, id);
  const link = (await db.collection(REVERSE).doc(id).get()).data(); if (!link) return {schedule: null};
  const s = (await db.collection(SCHEDULES).doc(link.scheduleId).get()).data();
  if (!s || s.archived || s.deleteRequested || s.consultLinks?.[link.name] !== id) return {schedule: null};
  return {schedule: {id: link.scheduleId, title: String(s.data?.title || ''), date: s.data?.date, start: s.data?.start, end: s.data?.end}};
}
const pad = (n: number) => String(n).padStart(2, '0');
/** 상담 일정으로 남기기 (a 원서 written without one): a 상담 일정 today from now (to the 10 minutes, an hour), naming the
 *  신입생, saved as a draft the teacher may change and tied to this 원서. A 원서 already tied gets its 일정 back. */
export async function createConsultSchedule(db: any, actor: any, idInput: unknown, now = Date.now()) {
  const id = regId.parse(idInput), r = await openRegistration(db, actor, id);
  const existing = await readConsultSchedule(db, actor, id); if (existing.schedule) return {...existing, created: false};
  const {saveAppSchedule, readAppSchedulePlaces} = await import('./appSchedule.js');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(new Date(now)).map(p => [p.type, p.value]));
  const minutes = Math.min(Number(parts.hour) * 60 + Math.floor(Number(parts.minute) / 10) * 10, 23 * 60 + 50), endMinutes = Math.min(minutes + 60, 23 * 60 + 59);
  const clock = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const name = String(r.data?.name || '신입생').trim().slice(0, 60), subjects = ['영어', '수학', '국어', '과학', '한국사'];
  const subject = (r.data?.enrollments || []).map((e: any) => e.subject).find((s: string) => subjects.includes(s)) || '영어';
  const places: string[] = await readAppSchedulePlaces(db, actor).catch(() => []);
  const campus = [...(r.data?.campuses || []), ...(r.data?.enrollments || []).map((e: any) => e.campus)].find((c: any) => c && places.includes(c));
  const saved = await saveAppSchedule(db, actor, {data: {title: `${name} 상담`, subject, students: [], date: `${parts.year}-${parts.month}-${parts.day}`, start: clock(minutes), end: clock(endMinutes), kind: '상담', status: '예정', place: campus || '', note: '', prospects: [{name}]}});
  await linkConsultRegistration(db, actor, {scheduleId: saved.id, name, registrationId: id});
  return {...await readConsultSchedule(db, actor, id), created: true};
}
