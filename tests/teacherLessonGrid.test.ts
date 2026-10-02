import test from 'node:test';
import assert from 'node:assert/strict';
import { newGridLesson,applyCommonLesson,gridCanPublish,isCurrentStudent,processLessonRows } from '../src/lib/teacherLessonGrid.ts';
import { lessonFeedback } from '../api/_lib/teacherWorkspacePolicy.ts';
import { extractAssignmentFromFeedback } from '../api/_lib/assignmentExtractor.ts';
import { studentLessonDTO } from '../api/_lib/reportAudienceDTO.ts';
import { decodeMakeBase64Payload } from '../api/webhooks/notion-report.ts';
const lesson=()=>newGridLesson('11111111-1111-4111-8111-111111111111','영어','2026-10-03','14:00','15:30');
test('common class input keeps individual scores, attendance and feedback independent',()=>{
 const previous={...lesson(),correct:27,total:30,note:'개별 메모',attendance:'지각'};
 const result=applyCommonLesson(previous,{content:'관계대명사',assignment:'교재 10쪽',nextPlan:'복습'});
 assert.equal(result.correct,27);assert.equal(result.note,'개별 메모');assert.equal(result.attendance,'지각');assert.equal(previous.assignment,'');
});
test('app homework survives Notion feedback, Make base64 decoding, extraction and student DTO projection',()=>{
 const d=applyCommonLesson(lesson(),{content:'수업 진행',assignment:'교재 10쪽\n단어 DAY 3',nextPlan:'다음 수업 준비'});
 const feedback=lessonFeedback({...d,note:'재확인 필요'} as any);
 assert.ok(feedback.endsWith('과제: 교재 10쪽\n단어 DAY 3'));
 const decoded=decodeMakeBase64Payload({payloadEncoding:'base64',feedback:Buffer.from(feedback).toString('base64')}) as any;
 const stored:any={notionPageId:'source',lessonDateStart:'2026-10-03',subject:'영어',category:'수업',attendance:'출석',homework:'상',vocabularyScore:90,schoolExamScore:null,feedback:decoded.feedback,derivedAssignment:extractAssignmentFromFeedback(decoded.feedback)};
 assert.equal(studentLessonDTO(stored).assignmentContent,'교재 10쪽\n단어 DAY 3');
 const changed={...d,assignment:'새 과제'};assert.equal(extractAssignmentFromFeedback(lessonFeedback(changed as any)),'새 과제');
 assert.equal(extractAssignmentFromFeedback(lessonFeedback({...d,assignment:'없는 날'} as any)),null);
});
test('draft edits require saving again before publish and pending rows cannot be published twice',()=>{
 const d=lesson(),row={id:'a',revision:1,stage:'draft',data:d,savedData:structuredClone(d)};
 assert.equal(gridCanPublish(row),true);assert.equal(gridCanPublish({...row,data:{...d,note:'수정'}}),false);
 assert.equal(gridCanPublish({...row,stage:'processing'}),false);
});
test('one failed student does not block later students and save preserves each stable source ID',async()=>{
 const calls:string[]=[],updates:any[]=[];
 const rows=['a','b','c'].map(id=>({id,stage:'new',data:lesson()}));
 const result=await processLessonRows(rows,'save',async(action,body)=>{assert.equal(action,'save-draft');calls.push(body.id);if(body.id==='b')throw new Error('실패');return {ok:true};},(id,patch)=>updates.push({id,...patch}));
 assert.deepEqual(calls,['a','b','c']);assert.deepEqual(result,{succeeded:2,failed:1});
 assert.equal(updates[1].error,'실패');assert.equal(updates[2].revision,1);
});
test('any registered scoped subject means current student; stopped and waiting subjects stay in other',()=>{
 assert.equal(isCurrentStudent({subjects:[{status:'중단'},{status:'등록'}],enrollmentStatus:'중단'}),true);
 assert.equal(isCurrentStudent({subjects:[{status:'중단'},{status:'대기'}],enrollmentStatus:'등록'}),false);
 assert.equal(isCurrentStudent({enrollmentStatus:'등록'}),true);assert.equal(isCurrentStudent({}),false);
});
