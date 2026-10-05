import type { Firestore } from 'firebase-admin/firestore';
import { NotionReportWebhookSchema } from './reportSchemas.js';
import { lookupStudentByPageId } from './notion.js';
import { migrateStudentMapping } from './studentIdentity.js';
import { extractAssignmentFromFeedback } from './assignmentExtractor.js';
import { normalizeNotionPageId } from './notionPageId.js';
export const LESSON_DATABASE = 'ab289f5b-1cf5-4160-809e-10d268c9c385';
const text = (p: any) => (p?.title || p?.rich_text || []).map((x: any) => x.plain_text ?? x.text?.content ?? '').join('');
const choice = (p: any) => p?.status?.name || p?.select?.name || '';
const score = (p: any) => { const value = p?.type === 'formula' ? p.formula?.number : p?.number; return typeof value === 'number' && Number.isFinite(value) ? value : null; };
export function academyPayload(page: any) {
  if (normalizeNotionPageId(page.parent?.database_id || '') !== LESSON_DATABASE) throw new Error('SOURCE_NOT_ALLOWED');
  const p = page.properties || {};
  if (page.archived || page.in_trash || choice(p['전송 완료']) !== '완료') return null;
  const relation = p['학생'];
  if (relation?.has_more || relation?.relation?.length !== 1) throw new Error('EXACTLY_ONE_STUDENT_REQUIRED');
  const vocabularyScore = score(p['단어 테스트']), schoolExamScore = score(p['내신 대비 점수']);
  if (vocabularyScore === null && schoolExamScore === null) return null;
  return NotionReportWebhookSchema.parse({
    notionPageId: normalizeNotionPageId(page.id), notionStudentPageId: normalizeNotionPageId(relation.relation[0].id),
    subject: '영어', lessonDateStart: p['수업 날짜']?.date?.start || '', lessonDateEnd: p['수업 날짜']?.date?.end || null,
    lessonTime: text(p['수업']), selfStudyTime: text(p['자습시간']), category: choice(p['범주']) || '수업',
    attendance: choice(p['출석']), attitude: choice(p['태도']), homework: choice(p['숙제']), test: choice(p['테스트']),
    vocabularyScore, schoolExamScore, feedback: text(p['수업 내용']), sourceUpdatedAt: page.last_edited_time,
  });
}
export function missingScorePatch(current: any, source: { vocabularyScore: number | null; schoolExamScore: number | null }) {
  const patch: Record<string, number> = {};
  for (const field of ['vocabularyScore', 'schoolExamScore'] as const) {
    if (current[field] == null && source[field] !== null) patch[field] = source[field];
  }
  return patch;
}
export async function backfillAcademyPage(db: Firestore, page: any) {
  const data = academyPayload(page);
  if (!data) return false;
  const ref = db.collection('lessonReports').doc(data.notionPageId);
  const compactRef = db.collection('lessonReports').doc(data.notionPageId.replace(/-/g, ''));
  const [existing, compact] = await Promise.all([ref.get(), compactRef.get()]);
  if (existing.exists && compact.exists) throw new Error('DUPLICATE_SOURCE_IDS');
  const current = existing.exists ? existing : compact;
  if(current.exists && current.data()?.teacherDraftId)return false;
  if (current.exists && Object.keys(missingScorePatch(current.data(), data)).length === 0) return false;
  const student = await lookupStudentByPageId(data.notionStudentPageId, '', false);
  const mapping = await migrateStudentMapping(db, student.notionStudentPageId, student.studentDisplayName);
  return db.runTransaction(async tx => {
    const target = current.exists ? current.ref : ref;
    const latest = await tx.get(target);
    if (latest.exists) {
      const stored = latest.data()!;
      if(stored.teacherDraftId)return false;
      if (stored.internalStudentId !== mapping.internalStudentId || stored.sourceUpdatedAt > (data.sourceUpdatedAt || '')) return false;
      const patch = missingScorePatch(stored, data);
      if (!Object.keys(patch).length) return false;
      tx.update(target, { ...patch, serverUpdatedAt: new Date().toISOString() });
    } else {
      const now = new Date().toISOString();
      tx.set(target, { ...data, studentKey: mapping.studentKey, internalStudentId: mapping.internalStudentId,
        derivedAssignment: extractAssignmentFromFeedback(data.feedback), sourceUpdatedAt: data.sourceUpdatedAt || now,
        serverReceivedAt: now, serverUpdatedAt: now });
    }
    return true;
  });
}
