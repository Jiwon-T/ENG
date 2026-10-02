import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessOwned, canTeach, continuation, lessonDraftSchema, percentage, timetableSlotSchema, assertDraftEditable, publishDecision } from '../api/_lib/teacherWorkspacePolicy.ts';
const studentKey='11111111-1111-4111-8111-111111111111';
const lesson={studentKey,subject:'영어',date:'2026-10-02',start:'14:00',end:'15:30',attendance:'출석',attitude:'상',homework:'상',test:'상',content:'관계대명사',assignment:'문제 1–10',note:'다음 시간 재확인',nextPlan:'복습',correct:27,total:30,round:1};
test('teacher can access owned records and assigned student subjects; highest admin can oversee',()=>{
 const actor={uid:'a',admin:false,scopes:[{studentKey,subject:'영어'}]};
 assert.equal(canAccessOwned(actor,'a'),true); assert.equal(canAccessOwned(actor,'b'),false);
 assert.equal(canTeach(actor,studentKey,'영어'),true); assert.equal(canTeach(actor,studentKey,'수학'),false);
 assert.equal(canTeach(actor,'22222222-2222-4222-8222-222222222222','영어'),false);
 assert.equal(canAccessOwned({...actor,admin:true},'b'),true);
});
test('27/30 becomes 90; zero is preserved and missing score stays missing',()=>{
 assert.equal(percentage(27,30),90);assert.equal(percentage(0,30),0);assert.equal(percentage(null,null),null);
 assert.equal(lessonDraftSchema.safeParse(lesson).success,true);
 for(const change of [{correct:31},{correct:null},{total:0},{date:'2026-02-30'},{start:'25:00'},{end:'13:00'}])assert.equal(lessonDraftSchema.safeParse({...lesson,...change}).success,false);
});
test('continuation retains learning plans but resets old scores, evaluations, and personal notes',()=>{
 const next=continuation(lesson);
 assert.equal(next.content,lesson.content);assert.equal(next.assignment,lesson.assignment);assert.equal(next.nextPlan,'복습');
 assert.equal(next.attendance,'미확인');assert.equal(next.homework,'미확인');assert.equal(next.test,'미확인');
 assert.equal(next.correct,null);assert.equal(next.total,null);assert.equal(next.round,null);assert.equal(next.note,'');
});
test('regular timetable rejects invalid or reversed times',()=>{
 assert.equal(timetableSlotSchema.safeParse({weekday:1,start:'14:00',end:'15:30'}).success,true);
 for(const slot of [{weekday:7,start:'14:00',end:'15:30'},{weekday:1,start:'25:00',end:'26:00'},{weekday:1,start:'14:00',end:'14:00'}])assert.equal(timetableSlotSchema.safeParse(slot).success,false);
});
test('draft conflicts and changing an already published student or subject are blocked',()=>{
 const old={data:lesson,revision:2,stage:'draft',notionPageId:'source'};
 assert.doesNotThrow(()=>assertDraftEditable(old,2,lesson));
 assert.throws(()=>assertDraftEditable(old,1,lesson),/DRAFT_CONFLICT/);
 assert.throws(()=>assertDraftEditable(old,2,{...lesson,subject:'수학'}),/SOURCE_IDENTITY_LOCKED/);
 for(const stage of ['publishing','processing','notion_saved'])assert.throws(()=>assertDraftEditable({...old,stage},2,lesson),/PUBLISH_IN_PROGRESS/);
});
test('repeated publish of a confirmed revision is idempotent; pending reflection cannot be requeued',()=>{
 assert.equal(publishDecision({stage:'published',revision:2,lastSubmittedRevision:2}),'already-published');
 assert.equal(publishDecision({stage:'draft',revision:3,lastSubmittedRevision:2}),'publish');
 for(const stage of ['publishing','processing','notion_saved'])assert.throws(()=>publishDecision({stage}),/PUBLISH_IN_PROGRESS/);
});
test('schedule input requires recipients and rejects invalid dates and overnight time ranges',async()=>{
 const {teacherScheduleSchema}=await import('../api/_lib/teacherWorkspacePolicy.ts');
 const value={title:'보강',subject:'영어',students:[studentKey],date:'2026-10-03',start:'14:00',end:'15:00',kind:'보강',status:'예정',place:'학원',note:''};
 assert.equal(teacherScheduleSchema.safeParse(value).success,true);
 for(const change of [{students:[]},{date:'2026-02-30'},{end:'13:00'}])assert.equal(teacherScheduleSchema.safeParse({...value,...change}).success,false);
});
