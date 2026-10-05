import crypto from 'node:crypto';
import type { StoredLessonReport, StudentLessonReportDTO, ParentLessonReportDTO, StoredStudentSchedule, StudentScheduleDTO } from './reportSchemas.js';
export const lessonReportId = (r: StoredLessonReport) => crypto.createHash('sha256').update(r.reportIdentity || r.notionPageId).digest('hex').slice(0, 16);
export const assignmentContentHash = (r: StoredLessonReport) => crypto.createHash('sha256').update(r.derivedAssignment || '').digest('hex');
export function studentLessonDTO(r: StoredLessonReport, completions = new Map<string, string>()): StudentLessonReportDTO {
    return { reportId: lessonReportId(r), lessonDate: r.lessonDateStart, subject: r.subject || '영어', category: r.category, attendance: r.attendance || '', homework: r.homework || '', vocabularyScore: r.vocabularyScore, schoolExamScore: r.schoolExamScore, assignmentContent: r.derivedAssignment || null, assignmentCompleted: completions.get(lessonReportId(r)) === assignmentContentHash(r) };
}
export function parentLessonDTO(r: StoredLessonReport): ParentLessonReportDTO {
    return { reportId: lessonReportId(r), lessonDateStart: r.lessonDateStart, lessonDateEnd: r.lessonDateEnd, lessonTime: r.lessonTime, selfStudyTime: r.selfStudyTime, category: r.category, subject: r.subject || '영어', attendance: r.attendance, attitude: r.attitude, homework: r.homework, test: r.test, vocabularyScore: r.vocabularyScore, schoolExamScore: r.schoolExamScore, feedback: r.feedback };
}
export function reportScheduleDTO(s: StoredStudentSchedule): StudentScheduleDTO {
    return { scheduleId: s.scheduleDocId, title: s.title, startAt: s.startAt, endAt: s.endAt, subject: s.subject || '영어', scheduleType: s.scheduleType, status: s.status, notice: s.notice, completedAt: s.status === '완료' ? s.completedAt || s.serverUpdatedAt || s.endAt || s.startAt : null };
}
