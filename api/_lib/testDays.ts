// 누적 테스트 날 (3차시 테스트: no class, 자습·테스트 only): the days the timetable gives a student one — a class's regular
// 'test' line on that weekday (for the whole class or the student), or a one-off '테스트' 일정 naming the student — less
// the days a 휴강 일정 for the student overlaps it. Read for the rewards only: a day with no 일지 counts as 결석 for 누적
// 테스트 개근, but nothing is written (no 일지, no report, no message).
import { normalizeNotionPageId as uuid } from './notionPageId.js';

const keyOf = (s: unknown) => { try { return uuid(String(s || '')); } catch { return ''; } };
const overlaps = (a: {start: string; end: string}, b: {start?: string; end?: string}) => !b.start || !b.end || (a.start < b.end && b.start < a.end);
const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
/** The days from `from` to `to` (YYYY-MM-DD, both kept). */
function days(from: string, to: string) {
  const out: string[] = []; for (let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); t <= end; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
/** The pure part: the student's test days from the academy's classes and 일정. */
export function testDaysOf(studentKey: string, classes: any[], schedules: any[], from: string, to: string) {
  const key = keyOf(studentKey), out = new Set<string>(); if (!key || from > to) return out;
  const mine = classes.filter(c => !c.archived && c.status !== '중단' && (c.students || []).some((s: string) => keyOf(s) === key));
  const events = schedules.filter(s => (s.academyId || 'main') === 'main' && !s.archived && !s.deleteRequested && s.data && s.data.status !== '취소' && s.data.date >= from && s.data.date <= to);
  const forMe = (e: any) => !(e.data.students || []).length || (e.data.students || []).some((s: string) => keyOf(s) === key);
  for (const day of days(from, to)) {
    const off = events.filter(e => e.data.date === day && e.data.kind === '휴강' && forMe(e));
    const regular = mine.some(c => (c.slots || []).some((slot: any) => slot.kind === 'test' && slot.status !== '중단' && slot.weekday === weekdayOf(day)
      && (!slot.students?.length || slot.students.some((s: string) => keyOf(s) === key)) && !off.some(e => overlaps(slot, e.data))));
    const once = events.some(e => e.data.date === day && (e.data.kind === '테스트' || e.data.kind === '시험') && (e.data.students || []).some((s: string) => keyOf(s) === key));
    if (regular || once) out.add(day);
  }
  return out;
}
/** The classes and 일정 read once for a short while (the 포인트 list counts every student in one go); a failed read is not kept. */
const READ_TTL_MS = 30_000, reads = new Map<string, {at: number; read: Promise<{classes: any[]; schedules: any[]}>}>();
function timetable(db: any, from: string, to: string) {
  const key = `${from}|${to}`, hit = reads.get(key);
  if (hit && hit.at > Date.now() - READ_TTL_MS) return hit.read;
  const read = Promise.all([
    db.collection('teacherClasses').where('academyId', '==', 'main').get(),
    db.collection('teacherSchedules').where('data.date', '>=', from).where('data.date', '<=', to).get(),
  ]).then(([c, s]: any[]) => ({classes: c.docs.map((d: any) => d.data()), schedules: s.docs.map((d: any) => d.data())}));
  read.catch(() => reads.delete(key));
  reads.set(key, {at: Date.now(), read});
  return read;
}
/** Read the academy's classes and the 일정 in range, then the student's test days. A failed read gives none (no day is
 *  taken for 결석 on a guess). */
export async function expectedTestDays(db: any, studentKey: string, from: string, to: string) {
  try {
    const {classes, schedules} = await timetable(db, from, to);
    return testDaysOf(studentKey, classes, schedules, from, to);
  } catch { console.warn('TEST_DAYS_FAILED'); return new Set<string>(); }
}
