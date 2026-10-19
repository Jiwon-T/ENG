import {studyLastEnd,studyTimeText} from '../../src/lib/sessionNumbers.js';
import {assertLessonComplete,lessonFeedback,percentage} from './teacherWorkspacePolicy.js';
import {parentFeedbackText,type ExtraScore} from '../../src/lib/lessonReportText.js';
import {extractAssignmentFromFeedback} from './assignmentExtractor.js';
import {normalizeNotionPageId} from './notionPageId.js';
export function directLessonReport(draftId:string,draft:any,mapping:any,previous:any={},now=new Date().toISOString()) {
 const d=assertLessonComplete(draft.data);
 // 선생님 메모 (teacherNote), 시험범위 and 회차 never reach the report.
 const feedback=parentFeedbackText(d);
 return {notionPageId:draft.notionPageId?normalizeNotionPageId(draft.notionPageId):draftId,reportIdentity:previous.reportIdentity||previous.notionPageId||draftId,teacherDraftId:draftId,teacherAppRevision:draft.revision,studentKey:mapping.studentKey,internalStudentId:mapping.internalStudentId,
 lessonDateStart:`${d.date}T${d.classSession==='있음'?d.start:d.selfStudyStart}:00+09:00`,lessonDateEnd:`${d.date}T${d.classSession==='있음'?d.end:studyLastEnd(d)}:00+09:00`,lessonTime:d.classSession==='있음'?`${d.start} ~ ${d.end}`:'',selfStudyTime:d.selfStudy==='있음'?studyTimeText(d,' ~ '):'',subject:d.subject,category:'수업',attendance:d.attendance,attitude:d.attitude,homework:d.homework,test:d.test,vocabularyScore:percentage(d.correct,d.total),testName:d.testName||'',testPaper:d.testPaper,extraScores:d.extraTests.map(t=>({name:t.name,score:percentage(t.correct,t.total)})).filter((t):t is ExtraScore=>t.score!=null),schoolExamScore:percentage(d.examCorrect,d.examTotal),feedback,derivedAssignment:extractAssignmentFromFeedback(lessonFeedback(d)),sourceUpdatedAt:now,serverReceivedAt:previous.serverReceivedAt||now,serverUpdatedAt:now};
}
