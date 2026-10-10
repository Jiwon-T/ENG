import {assertLessonComplete,lessonFeedback,percentage} from './teacherWorkspacePolicy.js';
import {extractAssignmentFromFeedback} from './assignmentExtractor.js';
import {normalizeNotionPageId} from './notionPageId.js';
export function directLessonReport(draftId:string,draft:any,mapping:any,previous:any={},now=new Date().toISOString()) {
 const d=assertLessonComplete(draft.data);
 const feedback=[lessonFeedback(d),d.attendanceNote?`출결 메모: ${d.attendanceNote}`:'',d.specialNote?`특이 사항: ${d.specialNote}`:''].filter(Boolean).join('\n\n');
 return {notionPageId:draft.notionPageId?normalizeNotionPageId(draft.notionPageId):draftId,reportIdentity:previous.reportIdentity||previous.notionPageId||draftId,teacherDraftId:draftId,teacherAppRevision:draft.revision,studentKey:mapping.studentKey,internalStudentId:mapping.internalStudentId,
 lessonDateStart:`${d.date}T${d.classSession==='있음'?d.start:d.selfStudyStart}:00+09:00`,lessonDateEnd:`${d.date}T${d.classSession==='있음'?d.end:d.selfStudyEnd}:00+09:00`,lessonTime:d.classSession==='있음'?`${d.start} ~ ${d.end}`:'',selfStudyTime:d.selfStudy==='있음'?`${d.selfStudyStart} ~ ${d.selfStudyEnd}`:'',subject:d.subject,category:'수업',attendance:d.attendance,attitude:d.attitude,homework:d.homework,test:d.test,vocabularyScore:percentage(d.correct,d.total),schoolExamScore:percentage(d.examCorrect,d.examTotal),feedback,derivedAssignment:extractAssignmentFromFeedback(lessonFeedback(d)),sourceUpdatedAt:now,serverReceivedAt:previous.serverReceivedAt||now,serverUpdatedAt:now};
}
