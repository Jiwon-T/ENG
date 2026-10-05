import { normalizeNotionPageId as uuid } from './notionPageId.js';
import { extractAssignmentFromFeedback } from './assignmentExtractor.js';
import type { NotionReportWebhookPayload } from './reportSchemas.js';
export async function storeWebhookLessonReport(db: any, data: NotionReportWebhookPayload, mapping: any) {
    const id = uuid(data.notionPageId), target = db.collection('lessonReports').doc(id), legacy = db.collection('lessonReports').doc(id.replace(/-/g, ''));
    if (data.sourceUpdatedAt && !Number.isFinite(Date.parse(data.sourceUpdatedAt)))
        throw Error('INVALID_INPUT');
    return db.runTransaction(async (tx: any) => {
        const [current, compact] = await Promise.all([tx.get(target), tx.get(legacy)]), records = [current, compact].filter(s => s.exists);
        if (records.some(s => s.data()?.teacherDraftId))
            return { applied: false, reason: 'APP_OWNED', isNew: false };
        if (records.some(s => s.data()?.internalStudentId && s.data().internalStudentId !== mapping.internalStudentId))
            throw Error('SOURCE_IDENTITY_LOCKED');
        if (records.some(s => s.data()?.sourceUpdatedAt && (!data.sourceUpdatedAt || Date.parse(s.data().sourceUpdatedAt) >= Date.parse(data.sourceUpdatedAt))))
            return { applied: false, reason: 'OLDER_SOURCE', isNew: false };
        const now = new Date().toISOString(), previous = current.exists ? current.data() : compact.data();
        tx.set(target, { notionPageId: id, studentKey: mapping.studentKey, internalStudentId: mapping.internalStudentId, lessonDateStart: data.lessonDateStart, lessonDateEnd: data.lessonDateEnd || null, lessonTime: data.lessonTime || '', selfStudyTime: data.selfStudyTime || '', subject: data.subject || '영어', category: data.category, attendance: data.attendance || '', attitude: data.attitude || '', homework: data.homework || '', test: data.test || '', vocabularyScore: data.vocabularyScore ?? null, schoolExamScore: data.schoolExamScore ?? null, feedback: data.feedback || '', derivedAssignment: extractAssignmentFromFeedback(data.feedback), sourceUpdatedAt: data.sourceUpdatedAt || now, serverReceivedAt: previous?.serverReceivedAt || now, serverUpdatedAt: now }, { merge: true });
        if (compact.exists)
            tx.delete(legacy);
        return { applied: true, isNew: !records.length };
    });
}
