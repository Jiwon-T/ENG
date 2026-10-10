import test from 'node:test';
import assert from 'node:assert/strict';
import {editedSessionNumbers,nextSessionNumbers} from '../src/lib/sessionNumbers';
import {processLessonRows} from '../src/lib/teacherLessonGrid';
import {todayLessons} from '../src/lib/teacherTodayLessons';
import {hideTodayLesson,hiddenTodayLessons,restoreTodayLessons} from '../src/lib/todayLessonVisibility';
const d={studentKey:'student',subject:'영어',date:'2026-10-07',classSession:'있음',start:'14:00',end:'15:20',round:2,attendance:'출석',selfStudy:'있음',selfStudyStart:'16:00',selfStudyEnd:'17:00',selfStudyRound:3};
test('second daily lesson uses earlier start in same month, never its own start',()=>{
 const records=[{id:'first',stage:'published',data:d}];
 assert.equal(nextSessionNumbers(records,{...d,start:'18:00',end:'19:20'}).lesson,3);
 assert.equal(nextSessionNumbers(records,d).lesson,null);
});
test('published editing adjusts saved base independently and preserves manual counters',()=>{
 const edited={...d,end:'16:40',selfStudyEnd:'16:30'};
 const result=editedSessionNumbers(edited,d);assert.equal(result.round,3);assert.equal(result.selfStudyRound,2.5);
 assert.equal(editedSessionNumbers({...edited,round:8.7},d,['round']).round,8.7);
 assert.deepEqual(editedSessionNumbers(d,d),d);
 assert.equal(editedSessionNumbers({...d,date:'2026-11-01'},d).round,1);
 assert.equal(editedSessionNumbers({...d,end:''},d).round,2);
});
test('pending unchanged row retries immutable publish without blocked save',async()=>{
 const calls:string[]=[];const row={id:'one',revision:1,stage:'report_published_notion_pending',data:{...d,content:'수업'},savedData:{...d,content:'수업'}};
 const result=await processLessonRows([row],'publish',async action=>{calls.push(action);return {stage:'published'};},()=>{});
 assert.deepEqual(calls,['publish']);assert.equal(result.succeeded,1);
});
test('regular and completed makeup remain distinct daily lessons',()=>{
 const data={admin:true,uid:'teacher',classes:[{id:'class',name:'정규',subject:'영어',students:['student'],slots:[{weekday:3,start:'14:00',end:'15:20'}]}]};
 const events=todayLessons(data,d.date,[{id:'makeup',data:{date:d.date,status:'완료',students:['student'],subject:'영어',start:'18:00',end:'19:20',kind:'보강'}}]);
 assert.equal(events.length,2);assert.deepEqual(events.map(r=>r.start),['14:00','18:00']);
});
test('daily exclusion is exact event, user and date scoped and reversible',()=>{
 hideTodayLesson('teacher',d.date,'regular:class:0');assert.equal(hiddenTodayLessons('teacher',d.date).size,1);
 assert.equal(hiddenTodayLessons('other',d.date).size,0);assert.equal(hiddenTodayLessons('teacher','2026-10-08').size,0);
 restoreTodayLessons('teacher',d.date);assert.equal(hiddenTodayLessons('teacher',d.date).size,0);
});

import {registrationFirestore} from './helpers/registrationFirestore';
import {readTodayVisibility,changeTodayVisibility} from '../api/_lib/teacherTodayVisibility';
test('hidden lessons survive a new read, isolate accounts and dates, and restore without source deletion',async()=>{
 const f=registrationFirestore();await changeTodayVisibility(f.db,'teacher',{date:d.date,eventId:'regular:class:0'});
 await changeTodayVisibility(f.db,'teacher',{date:d.date,eventId:'regular:class:0'});
 assert.deepEqual(await readTodayVisibility(f.db,'teacher',d.date),['regular:class:0']);
 assert.deepEqual(await readTodayVisibility(f.db,'other',d.date),[]);
 assert.deepEqual(await readTodayVisibility(f.db,'teacher','2026-10-08'),[]);
 await changeTodayVisibility(f.db,'teacher',{date:d.date,restore:true});assert.deepEqual(await readTodayVisibility(f.db,'teacher',d.date),[]);
 await assert.rejects(changeTodayVisibility(f.db,'teacher',{date:'2026-02-30',eventId:'x'}),/INVALID_INPUT/);
});

import {handleWorkspace} from '../api/teacher/workspace';
test('visibility action writes authenticated owner only and returns persisted selection',async()=>{
 const f=registrationFirestore(),actor:any={uid:'teacher',admin:false,academyId:'main',scopes:[],db:f.db};let body:any;
 const res:any={setHeader:()=>{},end:(v:string)=>body=JSON.parse(v)};
 await handleWorkspace({method:'POST',body:{action:'today-lesson-visibility',date:d.date,eventId:'schedule:one'}} as any,res,async()=>actor);
 assert.equal(res.statusCode,200);assert.deepEqual(body.hiddenTodayLessons,['schedule:one']);
 assert.equal(f.rows.get('teacherTodayVisibility/teacher:'+d.date).ownerUid,'teacher');
});

import {assertDraftEditable} from '../api/_lib/teacherWorkspacePolicy';
