// 변형 문제 내주기 (선생님): a teacher gives one of their question sets to students and/or classes, like a 숙제, with an
// optional deadline. Everything a submission is graded by is fixed when it is given: the questions (a snapshot of the
// set) and who may solve it (the students of the chosen classes at that moment, each with their linked app account).
// Students solve it through questionAttempts (graded once, points for 선생님이 내준 세트). Server only.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canAccessOwned, canTeach } from './teacherWorkspacePolicy.js';
import { readStudentMapping } from './studentIdentity.js';
import { linkedStudentAccount } from './teacherOnlineLearning.js';
import { QUESTION_SETS } from './questionSets.js';

export const QUESTION_ASSIGNMENTS = 'questionAssignments';
const SUBJECT = '영어';
export const ASSIGN_MESSAGES: Record<string, string> = {
  FORBIDDEN: '이 학생이나 반에는 내줄 수 없어요.',
  ASSIGN_SET_NOT_FOUND: '문제 세트를 찾지 못했어요.',
  ASSIGN_NO_TARGET: '내줄 학생이나 반을 골라 주세요.',
  ASSIGN_NO_LINKED: '고른 학생 중 앱에 연결된 학생이 없어요. 학생 연결을 먼저 해 주세요.',
  ASSIGN_NOT_FOUND: '내준 문제를 찾지 못했어요.',
  QUESTIONS_NOT_SOLVABLE: '이 세트는 화면에서 풀 수 있는 문제가 없어요.',
};
const err = (code: string) => Error(code);
const name = (mapping: any) => String(mapping?.studentDisplayName || '학생');

/** The classes (반) a teacher can give to: like the workspace — the admin all, a principal the academy's, a teacher their own. */
async function myClasses(db: any, actor: any) {
  const q = actor.admin ? db.collection('teacherClasses') : actor.principal ? db.collection('teacherClasses').where('academyId', '==', actor.academyId) : db.collection('teacherClasses').where('ownerUid', '==', actor.uid);
  return (await q.get()).docs.map((d: any) => ({ id: d.id, ...d.data() })).filter((c: any) => !c.archived && (!c.subject || c.subject === SUBJECT));
}
const classStudents = (c: any): string[] => (Array.isArray(c.students) ? c.students : []).map(String);
const className = (c: any) => String(c.name || '반');

/** Who can be chosen: the teacher's classes and the students they teach (English), with whether each has an app account. */
export async function questionTargets(db: any, actor: any) {
  const classes = await myClasses(db, actor);
  const keys = [...new Set([...(actor.admin ? [] : (actor.principal ? actor.teachingScopes || actor.scopes : actor.scopes) || []).filter((s: any) => s.subject === SUBJECT).map((s: any) => s.studentKey), ...classes.flatMap(classStudents)])]
    .filter(key => canTeach(actor, key, SUBJECT)).slice(0, 400);
  const students = (await Promise.all(keys.map(async key => { const m = await readStudentMapping(db, key).catch(() => null); return m ? { studentKey: key, name: name(m), linked: Boolean(m.firebaseUid) } : null; })))
    .filter(Boolean).sort((x: any, y: any) => x.name.localeCompare(y.name, 'ko'));
  return { classes: classes.map((c: any) => ({ id: c.id, name: className(c), count: classStudents(c).length })).sort((x: any, y: any) => x.name.localeCompare(y.name, 'ko')), students };
}

const assignInput = z.object({ setId: z.string().min(1).max(64), classIds: z.array(z.string().max(64)).max(30).default([]), studentKeys: z.array(z.string().max(64)).max(400).default([]), dueAt: z.number().int().positive().nullable().default(null) });
/** 내주기: the set's questions and the students (classes expanded now) are fixed in one document. Students without a linked
 *  app account are reported, not given it. */
export async function assignQuestionSet(db: any, actor: any, input: unknown, now = Date.now()) {
  const v = assignInput.parse(input);
  const setSnap = await db.collection(QUESTION_SETS).doc(v.setId).get();
  if (!setSnap.exists) throw err('ASSIGN_SET_NOT_FOUND');
  const set = setSnap.data();
  if (set.uid !== actor.uid && !actor.admin) throw err('FORBIDDEN');
  if (!(set.questions || []).some((q: any) => q.type !== 'workbook')) throw err('QUESTIONS_NOT_SOLVABLE');
  const classes = v.classIds.length ? await Promise.all(v.classIds.map(async id => { const s = await db.collection('teacherClasses').doc(id).get(); return s.exists ? { id: s.id, ...s.data() } : null; })) : [];
  for (const c of classes) if (!c || c.archived || !canAccessOwned(actor, c.ownerUid, c.academyId) && !(actor.principal && c.academyId === actor.academyId)) throw err('FORBIDDEN');
  const keys = [...new Set([...v.studentKeys, ...classes.flatMap(c => classStudents(c))])];
  if (!keys.length) throw err('ASSIGN_NO_TARGET');
  for (const key of keys) if (!canTeach(actor, key, SUBJECT)) throw err('FORBIDDEN');
  const links = await Promise.all(keys.map(async key => ({ key, link: await linkedStudentAccount(db, key, { readStudentMapping }).catch(() => ({ reason: 'error' })) as any })));
  const targets = links.filter(x => !('reason' in x.link)).map(x => ({ studentKey: x.key, uid: x.link.uid, name: name(x.link.mapping) }));
  const skipped = await Promise.all(links.filter(x => 'reason' in x.link).map(async x => name(await readStudentMapping(db, x.key).catch(() => null))));
  if (!targets.length) throw err('ASSIGN_NO_LINKED');
  const unique = [...new Map(targets.map(t => [t.uid, t])).values()];
  const doc = { id: randomUUID(), setId: v.setId, setVersion: set.createdAt, teacherUid: actor.uid, academyId: actor.academyId || 'main', title: String(set.title || '변형 문제'), questions: set.questions,
    classIds: classes.map(c => c.id), classNames: classes.map(c => className(c)), targets: unique, uids: unique.map(t => t.uid), dueAt: v.dueAt, cancelled: false, createdAt: now };
  await db.collection(QUESTION_ASSIGNMENTS).doc(doc.id).set(doc);
  return { assignment: { id: doc.id, title: doc.title, count: unique.length, dueAt: doc.dueAt }, skipped };
}

/** The teacher's own assignments, newest first (20), each with how many students have submitted (a count query). */
export async function myQuestionAssignments(db: any, actor: any) {
  const snap = await db.collection(QUESTION_ASSIGNMENTS).where('teacherUid', '==', actor.uid).limit(200).get();
  const rows = snap.docs.map((d: any) => d.data()).sort((x: any, y: any) => y.createdAt - x.createdAt).slice(0, 20);
  const done = await Promise.all(rows.map((x: any) => db.collection('questionAttempts').where('assignmentId', '==', x.id).where('status', '==', 'submitted').count().get().then((c: any) => Number(c.data().count || 0)).catch(() => null)));
  return { assignments: rows.map((x: any, k: number) => ({ id: x.id, title: x.title, count: x.uids.length, submitted: done[k], names: (x.targets || []).map((t: any) => t.name).slice(0, 30), classNames: x.classNames || [], dueAt: x.dueAt, cancelled: Boolean(x.cancelled), createdAt: x.createdAt })) };
}

/** 내주기 취소: students who have not submitted no longer see it; submitted results stay (for them and the teacher). */
export async function cancelQuestionAssignment(db: any, actor: any, id: unknown, now = Date.now()) {
  const ref = db.collection(QUESTION_ASSIGNMENTS).doc(String(id || '').slice(0, 64)), snap = await ref.get();
  if (!snap.exists) throw err('ASSIGN_NOT_FOUND');
  if (snap.data().teacherUid !== actor.uid && !actor.admin) throw err('FORBIDDEN');
  await ref.set({ ...snap.data(), cancelled: true, cancelledAt: now });
  return { cancelled: true };
}
