import test from 'node:test';
import assert from 'node:assert/strict';
import { newGridLesson,applyCommonLesson,gridCanPublish,isCurrentStudent,processLessonRows } from '../src/lib/teacherLessonGrid.ts';
import { lessonFeedback } from '../api/_lib/teacherWorkspacePolicy.ts';
import { extractAssignmentFromFeedback } from '../api/_lib/assignmentExtractor.ts';
import { studentLessonDTO } from '../api/_lib/reportAudienceDTO.ts';
import { decodeMakeBase64Payload } from '../api/webhooks/notion-report.ts';
const lesson=()=>({...newGridLesson('11111111-1111-4111-8111-111111111111','영어','2026-10-03','14:00','15:30'),content:'관계대명사'});
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

test('direct publish saves new and edited rows first, and does not publish failed saves',async()=>{
 const rows=['new','edited','failure'].map(id=>({id,stage:id==='edited'?'draft':'new',revision:id==='edited'?2:undefined,data:lesson(),savedData:id==='edited'?{...lesson(),content:'old'}:undefined}));
 const calls:string[]=[],updates:any[]=[];
 const result=await processLessonRows(rows,'publish',async(action,body)=>{calls.push(`${body.id}:${action}`);if(body.id==='failure')throw new Error('save failed');return action==='save-draft'?{record:{revision:3,data:body.data}}:{stage:'processing'};},(id,patch)=>updates.push({id,...patch}));
 assert.deepEqual(calls,['new:save-draft','new:publish','edited:save-draft','edited:publish','failure:save-draft']);
 assert.deepEqual(result,{succeeded:2,failed:1});assert.equal(updates[0].revision,3);
});
test('publish failure preserves saved revision for retry; pending rows make no requests',async()=>{
 const updates:any[]=[];
 await processLessonRows([{id:'a',stage:'new',data:lesson()}],'publish',async action=>{if(action==='publish')throw new Error('publish failed');return {record:{revision:1,data:lesson()}};},(_,patch)=>updates.push(patch));
 assert.equal(updates[0].stage,'draft');assert.equal(updates[0].revision,1);assert.equal(updates[1].error,'publish failed');
 const result=await processLessonRows([{id:'a',stage:'processing',data:lesson()}],'publish',async()=>{throw new Error('should not call');},()=>{});assert.equal(result.failed,1);
});

test('blank lesson contents cannot be published while partial drafts remain saveable',async()=>{
 const row={id:'empty',stage:'new',data:{...lesson(),content:' \n '}};const calls:string[]=[],updates:any[]=[];
 assert.equal((await processLessonRows([row],'publish',async action=>{calls.push(action);return {};},(_,patch)=>updates.push(patch))).failed,1);
 assert.equal(calls.length,0);assert.match(updates[0].error,/수업 내용/);
 assert.equal((await processLessonRows([row],'save',async action=>{calls.push(action);return {};},()=>{})).succeeded,1);
});
