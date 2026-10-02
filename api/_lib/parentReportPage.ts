import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldPath } from 'firebase-admin/firestore';
import { getSecretOrThrow } from './security.js';
import type { StoredLessonReport } from './reportSchemas.js';

function cursorKey() { return crypto.createHash('sha256').update(getSecretOrThrow('PARENT_SESSION_SECRET')).digest(); }
export function encodeReportCursor(student: string, date: string, id: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cursorKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify({ student, date, id })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
export function decodeReportCursor(token: string, student: string): { date: string; id: string } {
  try {
    if (token.length > 2048) throw new Error();
    const bytes = Buffer.from(token, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', cursorKey(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const value = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
    if (value.student !== student || typeof value.date !== 'string' || typeof value.id !== 'string' || !value.id || value.id.includes('/')) throw new Error();
    return { date: value.date, id: value.id };
  } catch { throw new Error('INVALID_REPORT_CURSOR'); }
}
export async function loadParentReportPage(db: Firestore, student: string, cursor?: string | null) {
  let query = db.collection('lessonReports').where('internalStudentId', '==', student)
    .orderBy('lessonDateStart', 'desc').orderBy(FieldPath.documentId(), 'desc');
  if (cursor) { const value = decodeReportCursor(cursor, student); query = query.startAfter(value.date, value.id); }
  const snapshot = await query.limit(11).get();
  const docs = snapshot.docs.slice(0, 10);
  const reports = docs.map(doc => {
    const r = doc.data() as StoredLessonReport;
    return {
      reportId: crypto.createHash('sha256').update(r.notionPageId).digest('hex').slice(0, 16),
      lessonDateStart: r.lessonDateStart, lessonDateEnd: r.lessonDateEnd,
      lessonTime: r.lessonTime, selfStudyTime: r.selfStudyTime, category: r.category,
      subject: r.subject || '영어',
      attendance: r.attendance, attitude: r.attitude, homework: r.homework, test: r.test,
      vocabularyScore: r.vocabularyScore, schoolExamScore: r.schoolExamScore, feedback: r.feedback,
    };
  });
  const last = docs.at(-1);
  return { reports, nextCursor: snapshot.docs.length > 10 && last
    ? encodeReportCursor(student, last.data().lessonDateStart, last.id) : null };
}
