import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPreviousLesson,previousLessonValues} from '../src/lib/teacherTodayLessons';
import {newGridLesson,matchingSavedLesson} from '../src/lib/teacherLessonGrid';
import {handleWorkspace} from '../api/teacher/workspace';
import {teacherReadCache} from '../api/_lib/teacherReadCache';
const studentKey='11111111-1111-4111-8111-111111111111';
const seed=newGridLesson(studentKey,'영어','2026-10-07','15:30','16:50');
const assessment={attendance:'보강 출석',attitude:'최상',homework:'상',test:'중상',wrong:20,total:20,correct:0,examWrong:3,examTotal:10,examCorrect:7};
test('today completion opens the same saved record despite changed end time, with all evaluations intact',()=>{
 const record={id:'saved',ownerUid:'teacher',stage:'published',revision:3,data:{...seed,...assessment,end:'17:00',round:2.9}};
 assert.equal(matchingSavedLesson([record],seed,'teacher'),undefined);
 const opened=matchingSavedLesson([record],seed,'teacher',false);
 assert.equal(opened,record);assert.equal(opened.data.correct,0);assert.equal(opened.data.attitude,'최상');assert.equal(opened.data.round,2.9);
 assert.equal(matchingSavedLesson([record],seed,'other',false),undefined);
});
test('previous endpoint carries app evaluations and both score groups in the existing response',async()=>{
 teacherReadCache.clear();const previous={...seed,...assessment,date:'2026-10-06',round:2,selfStudy:'있음',selfStudyStart:'17:00',selfStudyEnd:'18:00',selfStudyRound:1};
 const db:any={collection:(name:string)=>{assert.equal(name,'teacherLessonDrafts');return {where:()=>({get:async()=>({docs:[{id:'saved',data:()=>({ownerUid:'teacher',stage:'published',data:previous})}]})})};}};
 let body:any;const res:any={setHeader:()=>{},end:(value:string)=>body=JSON.parse(value)};
 try{await handleWorkspace({method:'POST',body:{action:'previous-lesson',studentKey,subject:'영어',date:seed.date}} as any,res,async()=>({uid:'teacher',admin:false,principal:false,academyId:'main',scopes:[{studentKey,subject:'영어'}],db} as any));
 assert.equal(res.statusCode,200);for(const [key,value] of Object.entries(assessment))assert.equal(body.data[key],value);
 }finally{teacherReadCache.clear();}
});
test('previous assessment copies all raw counts including real zero and preserves touched score groups',()=>{
 const previous={...assessment,sessionRecords:[]};
 const result=applyPreviousLesson(seed,seed,previous);
 for(const [key,value] of Object.entries(assessment))assert.equal(result[key],value);
 assert.equal(result.start,seed.start);assert.equal(result.date,seed.date);
 const manual=applyPreviousLesson({...seed,attitude:'하',wrong:1,total:5,correct:4},seed,previous,['attitude','wrong']);
 assert.equal(manual.attitude,'하');assert.equal(manual.correct,4);assert.equal(manual.total,5);assert.equal(manual.wrong,1);assert.equal(manual.examCorrect,7);
 assert.equal(applyPreviousLesson(seed,seed,previous,['attendance']).attendance,'미확인');
 assert.equal(previousLessonValues(assessment).correct,0);
});
