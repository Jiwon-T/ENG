/**
 * 계산 전용 수업 기록 가져오기 (lessonBackfill) — the 9/1–9/19 lessons from the Notion export, for the rewards only.
 *
 * Input: a JSON file (rows taken from the export, kept on this computer only) of
 *   {date: 'YYYY-MM-DD', who: '이름 (학교학년)', lessonTime, attended: 'Yes'|'No', content}.
 * 출결: No → 결석; Yes whose 수업 내용 starts with 지각 → 지각; else 출석 (보강 when the 내용 starts with 보강).
 * 태도: only a row given a grade by hand (the 수업 내용 praised it — the export's own chips are all 미확인); its 자습 then
 * counts too. Nothing is marked down from the 내용.
 * Student: the app's name matching '이름 (학교학년)' exactly; else the one active student of that name whose app name has
 * no 학교학년. Doc ids come from the student, the day and the 수업 time, so running it again writes nothing new.
 *
 * Safety: a dry run by default (counts only, names masked). `--apply` writes the lessonBackfill docs — run it only after
 * the user approved the dry run. Nothing else is touched (no 일지, no report, no points: those come at the next settling).
 * A doc already there is left as it is, except a 태도 given since (then only its attitude and studied are set).
 *
 *   node --env-file=<env> --import tsx scripts/import-lesson-backfill.ts <rows.json> [--apply]
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getFirebaseAdmin } from '../api/_lib/firebaseAdmin.ts';
import { displayName } from '../api/_lib/petCoupon.ts';
import { readStudentMapping } from '../api/_lib/studentIdentity.ts';
import { LESSON_BACKFILL } from '../api/_lib/lessonRewardRows.ts';
import { normalizeNotionPageId as uuid } from '../api/_lib/notionPageId.ts';

const [file, flag] = process.argv.slice(2), apply = flag === '--apply';
if (!file) { console.error('rows.json is needed'); process.exit(1); }
const rows: any[] = JSON.parse(readFileSync(file, 'utf8'));
const clean = (s: string) => String(s || '').replace(/\(https?:.*$/, '').trim(), squash = (s: string) => clean(s).replace(/\s+/g, '');
const part = (s: string) => { const m = clean(s).match(/^(\S+)\s*(\(.*\))?/); return {name: m?.[1] || '', tag: (m?.[2] || '').trim()}; };
const mask = (s: string) => { const p = part(s); return (p.name ? p.name[0] + '*'.repeat(p.name.length - 1) : '?') + (p.tag ? ' ' + p.tag : ''); };
const GRADES = new Set(['최상', '상', '중상', '중', '하']);
export const attitudeOf = (r: any) => GRADES.has(String(r.attitude || '')) ? String(r.attitude) : '';
export function attendanceOf(r: any) {
  const content = String(r.content || '').trim(), makeUp = /^보강/.test(content), head = content.slice(0, 20);
  const base = r.attended === 'No' ? '결석' : /지각/.test(head) ? '지각' : '출석';
  return makeUp ? `보강 ${base}` : base;
}

const { db } = getFirebaseAdmin(), now = Date.now();
const members = (await db.collection('academyStudentMemberships').where('academyId', '==', 'main').get()).docs.filter((d: any) => !d.data().disabled);
const students = await Promise.all(members.map(async (d: any) => { let key = ''; try { key = uuid(d.id); } catch { return null; } return {key, name: await displayName(db, key)}; }));
const active = students.filter(Boolean) as {key: string; name: string}[];
const findKey = (who: string) => {
  const exact = active.filter(s => squash(s.name) === squash(who)); if (exact.length === 1) return exact[0].key;
  const p = part(who), bare = active.filter(s => part(s.name).name === p.name && !part(s.name).tag);
  return bare.length === 1 && active.filter(s => part(s.name).name === p.name).length === 1 ? bare[0].key : null;
};
const byWho = new Map<string, string | null>(), out: {id: string; data: any}[] = [], unmatched = new Set<string>();
for (const r of rows) {
  if (!byWho.has(r.who)) byWho.set(r.who, findKey(r.who));
  const key = byWho.get(r.who); if (!key) { unmatched.add(mask(r.who)); continue; }
  const mapping: any = await readStudentMapping(db, key); if (!mapping?.internalStudentId) { unmatched.add(mask(r.who)); continue; }
  const id = 'nb' + createHash('sha256').update([mapping.internalStudentId, r.date, r.lessonTime].join('|')).digest('hex').slice(0, 30);
  out.push({id, data: {internalStudentId: mapping.internalStudentId, studentKey: key, date: `${r.date}T12:00:00+09:00`, lessonTime: String(r.lessonTime || ''), subject: '영어', attendance: attendanceOf(r), ...(attitudeOf(r) ? {attitude: attitudeOf(r), studied: r.selfStudy === 'Yes'} : {}), source: 'notion-2026-09', createdAt: now}});
}
const snaps = await Promise.all(out.map(o => db.collection(LESSON_BACKFILL).doc(o.id).get()));
const existing = new Set(snaps.filter((d: any) => d.exists).map((d: any) => d.id));
// docs already there that now have a 태도 they lack (or another one)
const toUpdate = out.filter((o, i) => snaps[i].exists && o.data.attitude && (snaps[i].data()?.attitude !== o.data.attitude || Boolean(snaps[i].data()?.studied) !== Boolean(o.data.studied)));
const byAttendance = out.reduce((a: any, o) => (a[o.data.attendance] = (a[o.data.attendance] || 0) + 1, a), {});
const perStudent = [...new Set(out.map(o => o.data.studentKey))].map(k => ({lessons: out.filter(o => o.data.studentKey === k).length}));
console.log(JSON.stringify({mode: apply ? 'apply' : 'dry-run', rows: rows.length, toWrite: out.length - existing.size, alreadyThere: existing.size, students: perStudent.length, unmatched: [...unmatched], byAttendance, withAttitude: out.filter(o => o.data.attitude).length, toUpdate: toUpdate.length}, null, 1));
if (apply) {
  let written = 0;
  for (const o of out) if (!existing.has(o.id)) { await db.collection(LESSON_BACKFILL).doc(o.id).set(o.data); written++; }
  let updated = 0;
  for (const o of toUpdate) { await db.collection(LESSON_BACKFILL).doc(o.id).update({attitude: o.data.attitude, studied: o.data.studied, updatedAt: now}); updated++; }
  console.log(JSON.stringify({written, updated}));
}
process.exit(0);
