import {readStudentMapping,migrateStudentMapping} from './studentIdentity.js';
import {lookupStudentByPageId} from './notion.js';
import {assertLessonComplete,lessonFeedback,percentage} from './teacherWorkspacePolicy.js';
import {extractAssignmentFromFeedback} from './assignmentExtractor.js';
import {normalizeNotionPageId} from './notionPageId.js';
export function directLessonReport(draftId:string,draft:any,mapping:any,previous:any={},now=new Date().toISOString()) {
 const d=assertLessonComplete(draft.data);
 const feedback=[lessonFeedback(d),d.attendanceNote?`출결 메모: ${d.attendanceNote}`:'',d.specialNote?`특이 사항: ${d.specialNote}`:''].filter(Boolean).join('\n\n');
 return {notionPageId:draft.notionPageId?normalizeNotionPageId(draft.notionPageId):draftId,reportIdentity:previous.reportIdentity||previous.notionPageId||draftId,teacherDraftId:draftId,teacherAppRevision:draft.revision,studentKey:mapping.studentKey,internalStudentId:mapping.internalStudentId,
 lessonDateStart:`${d.date}T${d.classSession==='있음'?d.start:d.selfStudyStart}:00+09:00`,lessonDateEnd:`${d.date}T${d.classSession==='있음'?d.end:d.selfStudyEnd}:00+09:00`,lessonTime:d.classSession==='있음'?`${d.start} ~ ${d.end}`:'',selfStudyTime:d.selfStudy==='있음'?`${d.selfStudyStart} ~ ${d.selfStudyEnd}`:'',subject:d.subject,category:'수업',attendance:d.attendance,attitude:d.attitude,homework:d.homework,test:d.test,vocabularyScore:percentage(d.correct,d.total),schoolExamScore:percentage(d.examCorrect,d.examTotal),feedback,derivedAssignment:extractAssignmentFromFeedback(lessonFeedback(d)),sourceUpdatedAt:now,serverReceivedAt:previous.serverReceivedAt||now,serverUpdatedAt:now};
}
export async function writeDirectLessonReport(db:any,draftId:string,draft:any) {
 let mapping=await readStudentMapping(db,draft.data.studentKey);
 if(!mapping){const student=await lookupStudentByPageId(draft.data.studentKey,'',false);mapping=await migrateStudentMapping(db,student.notionStudentPageId,student.studentDisplayName);}
 const id=draft.notionPageId?normalizeNotionPageId(draft.notionPageId):draftId;
 const target=db.collection('lessonReports').doc(id),temporary=db.collection('lessonReports').doc(draftId);
 const compact=draft.notionPageId?db.collection('lessonReports').doc(id.replace(/-/g,'')):null;
 await db.runTransaction(async(t:any)=>{
  const draftState=(await t.get(db.collection('teacherLessonDrafts').doc(draftId))).data();if(draftState?.archived||draftState?.deleteRequested)throw Error('FORBIDDEN');
  const current=await t.get(target),temp=id!==draftId?await t.get(temporary):null,legacy=compact&&compact.id!==target.id?await t.get(compact):null;
  const records=[current,temp,legacy].filter(r=>r?.exists);
  for(const r of records){const value=r.data();if(value.teacherDraftId&&value.teacherDraftId!==draftId||value.internalStudentId&&value.internalStudentId!==mapping!.internalStudentId)throw new Error('SOURCE_IDENTITY_LOCKED');if(value.teacherDraftId===draftId&&value.teacherAppRevision>draft.revision)throw new Error('DRAFT_CONFLICT');}
  const previous=temp?.exists&&temp.data().teacherDraftId===draftId?temp.data():current.exists?current.data():legacy?.exists?legacy.data():{};
  if(previous.teacherDraftId===draftId && previous.teacherAppRevision>draft.revision)throw new Error('DRAFT_CONFLICT');
  if(previous.teacherDraftId&&previous.teacherDraftId!==draftId)throw new Error('SOURCE_IDENTITY_LOCKED');
  if(previous.internalStudentId&&previous.internalStudentId!==mapping!.internalStudentId)throw new Error('SOURCE_IDENTITY_LOCKED');
  t.set(target,directLessonReport(draftId,draft,mapping,previous),{merge:true});
  if(temp?.exists&&temp.data().teacherDraftId===draftId)t.delete(temporary);
  if(legacy?.exists)t.delete(compact);
  t.update(db.collection('teacherLessonDrafts').doc(draftId),{directReportRevision:draft.revision,reportPublishedAt:Date.now()});
 });
}
