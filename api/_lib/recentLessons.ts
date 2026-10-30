// 수업 일지 › 지난 수업: the student's latest lessons in a subject up to the lesson being written — the teacher's own
// saved ones and any teacher's published ones, and the migrated history not taken over by an app lesson — with what was
// taught and the 과제, for the teacher to read or copy. Read only; any teacher of the student in that subject.
import {z} from 'zod';
import {canTeach} from './teacherWorkspacePolicy.js';

const startOf = (d: any) => (d?.classSession === '없음' ? d?.selfStudyStart : d?.start) || '';
export async function recentLessons(db: any, actor: any, keyInput: unknown, subjectInput: unknown, dateInput: unknown, excludeInput?: unknown, limit = 3) {
  const studentKey = z.string().uuid().parse(keyInput), subject = z.enum(['영어', '수학', '국어', '과학', '한국사']).parse(subjectInput);
  const date = dateInput ? z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(dateInput) : '', exclude = excludeInput ? String(excludeInput) : '';
  if (!canTeach(actor, studentKey, subject)) throw Error('FORBIDDEN');
  const [drafts, sources] = await Promise.all([db.collection('teacherLessonDrafts').where('data.studentKey', '==', studentKey).get(), db.collection('lessonSourceRecords').where('studentKey', '==', studentKey).get()]);
  const rows = drafts.docs.map((d: any) => ({id: d.id, ...d.data()}));
  // a migrated row an app lesson stands for (or one deleted in the app) is that lesson, not shown twice
  const taken = new Set(rows.flatMap((r: any) => [r.id, r.notionPageId].filter(Boolean)));
  const inRange = (d: any) => d?.subject === subject && Boolean(d.date) && (!date || d.date <= date);
  const app = rows.filter((r: any) => r.academyId === 'main' && !r.archived && !r.deleteRequested && r.id !== exclude && inRange(r.data) && r.stage !== 'new' && (r.stage === 'published' || r.ownerUid === actor.uid))
    .map((r: any) => ({id: r.id, ownerUid: r.ownerUid, d: r.data}));
  const old = sources.docs.map((s: any) => s.data()).filter((s: any) => s.academyId === 'main' && !s.removed && !s.appDeleted && s.sourceId !== exclude && inRange({...s.data, subject: s.subject}) && ![s.sourceId, s.appRecordId, s.linkedDraftId].some(id => id && taken.has(id)))
    .map((s: any) => ({id: s.sourceId, ownerUid: s.ownerUid, d: s.data}));
  const latest = [...app, ...old].sort((a, b) => b.d.date.localeCompare(a.d.date) || startOf(b.d).localeCompare(startOf(a.d))).slice(0, limit);
  const names = new Map<string, string>();
  await Promise.all([...new Set(latest.map(x => x.ownerUid).filter(Boolean))].map(async (uid: string) => { const u = (await db.collection('users').doc(uid).get()).data(); names.set(uid, u?.alias || u?.name || '선생님'); }));
  return {lessons: latest.map(x => ({id: x.id, date: x.d.date, start: startOf(x.d), kind: x.d.classSession === '없음' ? '테스트' : '수업', content: String(x.d.content || ''), assignment: String(x.d.assignment || ''), teacher: names.get(x.ownerUid) || '선생님'}))};
}
