// 문제 신고 (변형 문제): anyone who sees a question — the teacher who made the set, a student solving a given one — can
// say what looks wrong (정답 · 해설 · 문제나 보기 · 기타, with a short note). One report a person a question, however many
// tasks it was given in (asking again changes it). The admin sees the open ones with the share of questions reported (the beta rule: under 5%), and closes
// each as 고침 or 문제없음.
import { createHash } from 'node:crypto';
import type { PassageActor } from './passage.js';
import { QUESTION_SETS } from './questionSets.js';

export const QUESTION_REPORTS = 'questionReports';
const clip = (v: any, n: number) => String(v ?? '').trim().slice(0, n);
export const REPORT_REASONS = { answer: '정답이 틀렸어요', explanation: '해설이 이상해요', question: '문제나 보기가 이상해요', other: '기타' } as const;
type Reason = keyof typeof REPORT_REASONS;

/** The question as the reporter saw it (the set, or the set a teacher gave), and whether they may report it. */
async function questionOf(db: any, a: PassageActor, input: any) {
  const index = Math.floor(Number(input?.index));
  if (input?.assignmentId) {
    const x = (await db.collection('questionAssignments').doc(clip(input.assignmentId, 64)).get()).data();
    if (!x) throw Error('PASSAGE_NOT_FOUND');
    if (!a.admin && x.teacherUid !== a.uid && !(x.uids || []).includes(a.uid)) throw Error('FORBIDDEN');
    return { source: 'assigned', sourceId: String(x.id), setId: x.setId ? String(x.setId) : null, title: String(x.title || ''), index, q: (x.questions || [])[index] };
  }
  const s = (await db.collection(QUESTION_SETS).doc(clip(input?.setId, 64)).get()).data();
  if (!s) throw Error('PASSAGE_NOT_FOUND');
  if (!a.admin && s.uid !== a.uid) throw Error('FORBIDDEN');
  return { source: 'set', sourceId: String(s.id), setId: String(s.id), title: String(s.title || ''), index, q: (s.questions || [])[index] };
}

export async function reportQuestion(db: any, a: PassageActor, input: any, now = Date.now()) {
  const reason = String(input?.reason || '') as Reason;
  if (!(reason in REPORT_REASONS)) throw Error('BAD_REQUEST');
  const found = await questionOf(db, a, input);
  if (!found.q || !(found.index >= 0)) throw Error('BAD_REQUEST');
  // one question wherever it was seen (its set, or any task it was given in): the set, the question and its version
  const key = `${found.setId || found.sourceId}:${String(found.q.id ?? found.index)}:${Number(found.q.rev) || 0}`;
  const id = createHash('sha256').update(`${key}|${a.uid}`).digest('hex').slice(0, 40);
  await db.collection(QUESTION_REPORTS).doc(id).set({
    id, key, source: found.source, sourceId: found.sourceId, setId: found.setId, index: found.index, title: found.title.slice(0, 80),
    type: String(found.q.type || ''), label: String(found.q.label || ''), prompt: String(found.q.prompt || '').slice(0, 200),
    reason, note: clip(input?.note, 200), uid: a.uid, role: a.staff ? 'teacher' : 'student', name: a.name, at: now, status: 'open',
  });
  return { reported: true };
}

/** The admin: open reports, newest first, and the share of the questions made that were reported. */
export async function listQuestionReports(db: any, a: PassageActor) {
  if (!a.admin) throw Error('FORBIDDEN');
  const [reports, sets] = await Promise.all([db.collection(QUESTION_REPORTS).get(), db.collection(QUESTION_SETS).get()]);
  const all = reports.docs.map((d: any) => d.data()), made = sets.docs.reduce((n: number, d: any) => n + ((d.data().questions || []).length), 0);
  const reported = new Set(all.map((r: any) => r.key || `${r.source}:${r.sourceId}:${r.index}`)).size;
  return { reports: all.filter((r: any) => r.status === 'open').sort((x: any, y: any) => y.at - x.at).slice(0, 100), made, reported, rate: made ? Math.round(reported / made * 1000) / 10 : 0 };
}

/** The admin closes a report: 'fixed' (고침) or 'ok' (문제없음). */
export async function closeQuestionReport(db: any, a: PassageActor, input: any, now = Date.now()) {
  if (!a.admin) throw Error('FORBIDDEN');
  const status = input?.status === 'fixed' ? 'fixed' : input?.status === 'ok' ? 'ok' : null;
  if (!status) throw Error('BAD_REQUEST');
  const ref = db.collection(QUESTION_REPORTS).doc(clip(input?.id, 200)), snap = await ref.get();
  if (!snap.exists) throw Error('PASSAGE_NOT_FOUND');
  await ref.update({ status, closedAt: now });
  return { id: snap.id, status };
}
