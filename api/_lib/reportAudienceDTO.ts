import crypto from 'node:crypto';
import type { StoredLessonReport, StudentLessonReportDTO, ParentLessonReportDTO, StoredStudentSchedule, StudentScheduleDTO } from './reportSchemas.js';
export const lessonReportId = (r: StoredLessonReport) => crypto.createHash('sha256').update(r.reportIdentity || r.notionPageId).digest('hex').slice(0, 16);
export const assignmentContentHash = (r: StoredLessonReport) => crypto.createHash('sha256').update(r.derivedAssignment || '').digest('hex');
/** 선생님이 확인한 과제: a lesson that decides the 숙제 평가 (not 미확인, 없는 날 or none) grades the latest 과제 of that subject
 *  given before it; older 과제 still open then were passed without a grade (`grade` null). Either way they leave the
 *  student's 할 일. One 평가 grades one 과제. Keyed by report id. */
export function assignmentGrades(reports: StoredLessonReport[]) {
  const out = new Map<string, { grade: string | null; date: string }>(), day = (r: StoredLessonReport) => String(r.lessonDateStart || '').slice(0, 10);
  const open = new Map<string, StoredLessonReport[]>();
  for (const r of [...reports].sort((a, b) => day(a).localeCompare(day(b)))) {
    const subject = r.subject || '영어', waiting = open.get(subject) || [];
    if (r.homework && !['미확인', '없는 날'].includes(r.homework)) {
      // the 과제 of an earlier day: the newest gets this 평가, the rest were passed
      const before = waiting.filter(a => day(a) < day(r)), latest = before[before.length - 1];
      for (const a of before) out.set(lessonReportId(a), { grade: a === latest ? String(r.homework) : null, date: day(r) });
      open.set(subject, waiting.filter(a => day(a) >= day(r)));
    }
    if (String(r.derivedAssignment || '').trim()) open.set(subject, [...(open.get(subject) || []), r]);
  }
  return out;
}
export function studentLessonDTO(r: StoredLessonReport, completions = new Map<string, string>()): StudentLessonReportDTO {
    return { reportId: lessonReportId(r), lessonDate: r.lessonDateStart, subject: r.subject || '영어', category: r.category, attendance: r.attendance || '', homework: r.homework || '', vocabularyScore: r.vocabularyScore, testName: r.testName || '', schoolExamScore: r.schoolExamScore, assignmentContent: r.derivedAssignment || null, assignmentCompleted: completions.get(lessonReportId(r)) === assignmentContentHash(r) };
}
export function parentLessonDTO(r: StoredLessonReport): ParentLessonReportDTO {
    return { reportId: lessonReportId(r), lessonDateStart: r.lessonDateStart, lessonDateEnd: r.lessonDateEnd, lessonTime: r.lessonTime, selfStudyTime: r.selfStudyTime, category: r.category, subject: r.subject || '영어', attendance: r.attendance, attitude: r.attitude, homework: r.homework, test: r.test, vocabularyScore: r.vocabularyScore, testName: r.testName || '', extraScores: r.extraScores || [], schoolExamScore: r.schoolExamScore, examExtraScores: r.examExtraScores || [], feedback: r.feedback };
}
export function reportScheduleDTO(s: StoredStudentSchedule): StudentScheduleDTO {
    return { scheduleId: s.scheduleDocId, title: s.title, startAt: s.startAt, endAt: s.endAt, subject: s.subject || '영어', scheduleType: s.scheduleType, status: s.status, notice: s.notice, completedAt: s.status === '완료' ? s.completedAt || s.serverUpdatedAt || s.endAt || s.startAt : null };
}
