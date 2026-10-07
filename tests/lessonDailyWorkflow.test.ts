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
import {writeTeacherNotionRecord} from '../api/_lib/teacherNotionWrite';
test('hidden lessons survive a new read, isolate accounts and dates, and restore without source deletion',async()=>{
 const f=registrationFirestore();await changeTodayVisibility(f.db,'teacher',{date:d.date,eventId:'regular:class:0'});
 await changeTodayVisibility(f.db,'teacher',{date:d.date,eventId:'regular:class:0'});
 assert.deepEqual(await readTodayVisibility(f.db,'teacher',d.date),['regular:class:0']);
 assert.deepEqual(await readTodayVisibility(f.db,'other',d.date),[]);
 assert.deepEqual(await readTodayVisibility(f.db,'teacher','2026-10-08'),[]);
 await changeTodayVisibility(f.db,'teacher',{date:d.date,restore:true});assert.deepEqual(await readTodayVisibility(f.db,'teacher',d.date),[]);
 await assert.rejects(changeTodayVisibility(f.db,'teacher',{date:'2026-02-30',eventId:'x'}),/INVALID_INPUT/);
});
test('same student same day separate app IDs create independent Notion pages including a later lesson',async()=>{
 const f=registrationFirestore(),database='33333333-3333-4333-8333-333333333333',pages=new Map<string,any>();let count=0;
 const notion=async(path:string,method='GET',body?:any)=>{
  if(path.endsWith('/query'))return {results:[...pages.values()].filter(p=>p.properties['앱 기록 ID'].rich_text[0].text.content===body.filter.rich_text.equals),has_more:false};
  if(path==='pages'&&method==='POST'){const id=count++?'55555555-5555-4555-8555-555555555555':'44444444-4444-4444-8444-444444444444';const page={id,parent:{database_id:database},properties:body.properties,last_edited_time:'2026-10-07T00:00:00Z'};pages.set(id,page);return page;}
  return pages.get(path.slice(6));
 };
 for(const [id,start] of [['11111111-1111-4111-8111-111111111111','14:00'],['22222222-2222-4222-8222-222222222222','18:00']]){
  const record={revision:1,stage:'draft',data:{...d,start}};f.rows.set('teacherLessonDrafts/'+id,record);
  await writeTeacherNotionRecord(f.db,'teacherLessonDrafts',id,record,database,{'앱 기록 ID':{rich_text:[{text:{content:id}}]},'학생':{rich_text:[{text:{content:d.studentKey}}]},'시작':{rich_text:[{text:{content:start}}]}},notion);
 }
 assert.equal(pages.size,2);assert.equal(count,2);
});

import {handleWorkspace} from '../api/teacher/workspace';
test('visibility action writes authenticated owner only and returns persisted selection',async()=>{
 const f=registrationFirestore(),actor:any={uid:'teacher',admin:false,academyId:'main',scopes:[],db:f.db};let body:any;
 const res:any={setHeader:()=>{},end:(v:string)=>body=JSON.parse(v)};
 await handleWorkspace({method:'POST',body:{action:'today-lesson-visibility',date:d.date,eventId:'schedule:one'}} as any,res,async()=>actor);
 assert.equal(res.statusCode,200);assert.deepEqual(body.hiddenTodayLessons,['schedule:one']);
 assert.equal(f.rows.get('teacherTodayVisibility/teacher:'+d.date).ownerUid,'teacher');
});

import {lessonImportPublicationPatch} from '../api/_lib/teacherLessonImport';
import {assertDraftEditable} from '../api/_lib/teacherWorkspacePolicy';
test('imported completed baseline drops old journal and remains editable at new revision',()=>{
 const old={revision:2,lastSubmittedRevision:2,notionWrite:{revision:2,done:true}};
 const imported={...old,...lessonImportPublicationPatch(old,{stage:'published'}),revision:3,stage:'published',data:d};
 assert.equal(imported.lastSubmittedRevision,3);assert.equal(imported.notionWrite,null);
 assert.doesNotThrow(()=>assertDraftEditable(imported,3,d));
});
