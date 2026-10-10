import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

export const publicId = (id: string) => crypto.createHash('sha256').update(id).digest('hex').slice(0, 24);

export function academicDTO(id: string, r: any) {
  return { examDetail:r.examDetail||'',examYear:r.examYear??null,semester:r.semester??null,examPeriod:r.examPeriod??null,recordId: publicId(id), title: r.title, subject: r.subject, examType: r.examType, examDate: r.examDate,
    score: r.score, maxScore: r.maxScore, percentile: r.percentile, grade: r.grade, submissionStatus: r.submissionStatus };
}
export async function loadSubjectEnrollments(db: Firestore, studentId: string) {
  const current = await db.collection('studentEnrollments').where('internalStudentId', '==', studentId).get();
  if (current.docs.length) return current.docs.filter(d => !d.data().removed).flatMap(d => d.data().subjects || []);
  const legacy = await db.collection('studentAcademicProfiles').doc(studentId).get();
  if (!legacy.exists || legacy.data()?.archived) return [];
  return Object.entries(legacy.data()?.subjects || {}).map(([subject, value]: [string, any]) => ({
    subject, status: value.status, startAt: value.startDate || null, endAt: value.endDate || null,
  }));
}
export async function loadAcademicData(db: Firestore, studentId: string) {
  const [grades, legacyGrades, subjects, lessons] = await Promise.all([
    db.collection('academicRecords').where('internalStudentId', '==', studentId).get(),
    db.collection('examResults').where('internalStudentId', '==', studentId).get(),
    loadSubjectEnrollments(db, studentId),
    db.collection('lessonReports').where('internalStudentId', '==', studentId)
      .select('notionPageId', 'subject', 'lessonDateStart', 'vocabularyScore', 'schoolExamScore').get(),
  ]);
  // The first interrupted ZIP used examResults/studentAcademicProfiles. Preserve any
  // data imported from that version; a current source row overrides its legacy copy.
  const currentSources = new Set(grades.docs.map(d => d.id));
  const legacyRecords = legacyGrades.docs.filter(d => !d.data().archived && !currentSources.has(d.data().sourceId || d.id)).map(d => {
    const r = d.data();
    return academicDTO(r.sourceId || d.id, { ...r, examType: r.kind, submissionStatus: r.status });
  });
  const records = [...legacyRecords, ...grades.docs.filter(d => !d.data().removed).map(d => academicDTO(d.id, d.data()))];
  const academyScores = lessons.docs.map(d => { const r = d.data(); return { recordId: publicId(d.id), subject: r.subject || '영어',
    examDate: r.lessonDateStart, vocabularyScore: r.vocabularyScore ?? null, schoolExamScore: r.schoolExamScore ?? null }; });
  return { records, subjects, academyScores };
}
