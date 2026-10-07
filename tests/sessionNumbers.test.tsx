import React from 'react';
import test from 'node:test';import assert from 'node:assert/strict';import {renderToStaticMarkup} from 'react-dom/server';
import {sessionIncrement,nextSessionNumbers,autoSessionNumbers,formatSessionNumber,sessionBase} from '../src/lib/sessionNumbers';
import LessonAcademyFields from '../src/components/teacher/LessonAcademyFields';
import {applyPreviousLesson} from '../src/lib/teacherTodayLessons';
import {handleWorkspace} from '../api/teacher/workspace';
import {teacherReadCache} from '../api/_lib/teacherReadCache';
import {matchingSavedLesson} from '../src/lib/teacherLessonGrid';
const studentKey='11111111-1111-4111-8111-111111111111';
const input={studentKey,subject:'영어',date:'2026-10-07',start:'14:00',end:'15:20',classSession:'있음',attendance:'보강 출석',round:null,selfStudy:'있음',selfStudyStart:'15:20',selfStudyEnd:'16:20',selfStudyRound:null};
const row=(patch:any={})=>({id:'r',stage:'published',updatedAt:1,data:{...input,date:'2026-10-03',round:12,selfStudyRound:7,...patch}});
test('reselecting a saved current lesson preserves its identity, content and counters without recalculation',()=>{
 const saved={...row({date:input.date,round:3.9,selfStudyRound:2.5,content:'오늘 저장한 수업'}),ownerUid:'teacher',revision:4};
 const found=matchingSavedLesson([saved],input,'teacher');assert.equal(found,saved);
 assert.equal(autoSessionNumbers(found.data,[row()],[],true).data.round,3.9);
 assert.equal(found.id,'r');assert.equal(found.revision,4);assert.equal(found.data.content,'오늘 저장한 수업');
 for(const patch of [{date:'2026-10-08'},{start:'15:00'},{end:'16:30'},{subject:'수학'},{studentKey:'other'}])assert.equal(matchingSavedLesson([saved],{...input,...patch},'teacher'),undefined);
 assert.equal(matchingSavedLesson([saved],input,'another-teacher'),undefined);
 assert.equal(matchingSavedLesson([{...saved,archived:true}],input,'teacher'),undefined);
 assert.equal(matchingSavedLesson([{...saved,deleteRequested:true}],input,'teacher'),undefined);
 assert.equal(matchingSavedLesson([saved,{...saved,revision:5,data:{...saved.data,round:4}}],input,'teacher').data.round,4);
});
test('monthly counters restart at zero across months, years and the same month in another year',()=>{
 for(const [previous,date] of [['2026-09-30','2026-10-01'],['2026-12-31','2027-01-01'],['2025-10-03','2026-10-07']]){
  const records=[row({date:previous,round:12.9,selfStudyRound:8.5})];
  assert.deepEqual(nextSessionNumbers(records,{...input,date,selfStudyEnd:'15:50'}),{lesson:1,study:0.5});
  assert.equal(sessionBase(records,{...input,date},'lesson'),undefined);
  assert.equal(records[0].data.round,12.9);
 }
});
test('monthly lesson and study bases reset independently and skip non-incrementing records',()=>{
 const records=[row({date:'2026-09-30'}),row({date:'2026-10-03',round:2,selfStudy:'없음',selfStudyRound:null}),row({date:'2026-10-06',attendance:'보강 결석',round:90,selfStudyRound:90})];
 assert.deepEqual(nextSessionNumbers(records,input),{lesson:3,study:1});
 assert.deepEqual(nextSessionNumbers([row({date:'2026-09-30'})],{...input,attendance:'결석'}),{lesson:0,study:0});
});
test('monthly reset hints preserve manual and saved counters and reject invalid times',()=>{
 const records=[row({date:'2026-09-30'})];
 const result=autoSessionNumbers({...input,end:'15:10'},records);
 assert.equal(result.data.round,0.9);assert.equal(result.hints.round,'자동 입력 · 2026-10 월별 시작 0 +0.9');
 assert.equal(autoSessionNumbers({...input,round:22.7},records,['round']).data.round,22.7);
 const saved={...input,round:12.9};assert.equal(autoSessionNumbers(saved,records,[],true).data,saved);
 assert.equal(nextSessionNumbers(records,{...input,end:'13:00'}).lesson,null);
 assert.deepEqual(nextSessionNumbers([],input),{lesson:null,study:null});
});
test('integer tenths increments use half up without a minimum correction',()=>{
 for(const [minutes,tenths] of [[70,9],[80,10],[160,20],[60,8],[4,1],[3,0]])assert.equal(sessionIncrement('lesson',minutes),tenths);
 for(const [minutes,tenths] of [[60,10],[30,5],[90,15]])assert.equal(sessionIncrement('study',minutes),tenths);
 assert.equal(sessionIncrement('lesson',0),null);assert.equal(sessionIncrement('study',-1),null);
 assert.equal(formatSessionNumber(13),'13');assert.equal(formatSessionNumber(12.9),'12.9');
 assert.equal(formatSessionNumber(0.1+0.2),'0.3');
});
test('makeup class and makeup study increment independent counters from different latest records',()=>{
 const records=[row({date:'2026-10-05',round:12.9,selfStudy:'없음',selfStudyRound:null}),row({date:'2026-10-04',round:11,selfStudyRound:8.5})];
 assert.deepEqual(nextSessionNumbers(records,{...input,end:'15:10',selfStudyEnd:'15:50'}),{lesson:13.8,study:9});
 assert.deepEqual(nextSessionNumbers([row({round:0.1,selfStudyRound:0.1})],{...input,end:'14:16',selfStudyEnd:'15:32'}),{lesson:0.3,study:0.3});
});
test('skip absence, makeup absence, no-class records, deleted records and foreign identities',()=>{
 const records=[row(),row({date:'2026-10-06',attendance:'결석',round:90,selfStudyRound:90}),row({date:'2026-10-06',attendance:'보강 결석',round:91,selfStudyRound:91}),row({date:'2026-10-06',classSession:'없음',selfStudy:'없음',round:92,selfStudyRound:92}),{...row({round:99}),archived:true},row({studentKey:'foreign',round:93}),row({subject:'수학',round:94})];
 assert.deepEqual(nextSessionNumbers(records,input),{lesson:13,study:8});
 assert.equal(nextSessionNumbers([row({classSession:'없음',start:'',end:'',round:null,selfStudyRound:8})],input).study,9);
 for(const patch of [{start:''},{end:''},{end:'13:00'},{end:'14:00'}])assert.equal(nextSessionNumbers([row()],{...input,...patch}).lesson,null);
});
test('strict previous dates use later start for multiple records on a prior day and reject same-day records',()=>{
 const earlier=row({date:'2026-10-06',start:'13:00',end:'14:20',round:20});const later={...row({date:'2026-10-06',start:'17:00',end:'18:20',round:21}),updatedAt:0};
 const sameDay=row({date:input.date,round:100});
 assert.equal(sessionBase([earlier,later,sameDay],input,'lesson').round,21);
 assert.equal(nextSessionNumbers([sameDay,later,earlier],input).lesson,22);
});
test('time changes recalculate only new untouched numbers, preserve direct edits and saved records',()=>{
 const previous=[row()];const first=autoSessionNumbers(input,previous);assert.equal(first.data.round,13);
 const changed=autoSessionNumbers({...first.data,end:'16:40'},previous);assert.equal(changed.data.round,14);
 const manual=autoSessionNumbers({...changed.data,round:22.7,selfStudyRound:3.2,end:'15:10'},previous,['round','selfStudyRound']);assert.equal(manual.data.round,22.7);assert.equal(manual.data.selfStudyRound,3.2);assert.deepEqual(manual.hints,{});
 const saved={...input,round:13,selfStudyRound:8};assert.equal(autoSessionNumbers(saved,previous,[],true).data,saved);
 assert.deepEqual(autoSessionNumbers(saved,previous,[],true).hints,{});
 const empty=autoSessionNumbers(input,[]);assert.equal(empty.data.round,null);assert.equal(empty.data.selfStudyRound,null);
 const legacy={...input,round:13};assert.equal(autoSessionNumbers(legacy,previous,[],true).data.round,13);
});
test('late previous responses do not copy carried numbers or enable study in extended contracts',()=>{
 const previous={round:99,selfStudyRound:99,content:'last',sessionRecords:[row()]};
 const seed={...input,content:'',selfStudy:'미확인'};const filled=applyPreviousLesson(seed,seed,previous);
 assert.equal(filled.round,null);assert.equal(filled.selfStudy,'미확인');assert.equal(filled.content,'last');
 const automatic=autoSessionNumbers(filled,previous.sessionRecords);assert.equal(automatic.data.round,13);assert.equal(automatic.data.selfStudyRound,null);
});
test('round hints are rendered under editable decimal inputs for both counters',()=>{
 const filled=autoSessionNumbers(input,[row()]);const html=renderToStaticMarkup(<LessonAcademyFields value={filled.data} roundHints={filled.hints} onChange={()=>{}}/>);
 assert.ok(html.includes('자동 입력 · 직전 12회차(10/03) +1'));assert.ok(html.includes('자동 입력 · 직전 7회차(10/03) +1'));assert.equal((html.match(/inputMode="decimal"/g)||[]).length,2);assert.ok(html.includes('step="any"'));
});
test('previous endpoint extends one existing authorized request with independent counter history',async()=>{
 teacherReadCache.clear();let reads=0;const records=[row({date:'2026-10-06',round:13,selfStudy:'없음',selfStudyRound:null}),row({date:'2026-10-04',selfStudyRound:8})];
 const db={collection:(name:string)=>{assert.equal(name,'teacherLessonDrafts');return {where:(field:string,_op:string,value:string)=>{assert.equal(field,'ownerUid');assert.equal(value,'teacher');return {get:async()=>{reads++;return {docs:records.map(r=>({data:()=>r}))};}};}};}};
 let body:any;const res:any={setHeader:()=>{},end:(value:string)=>body=JSON.parse(value)};
 try{await handleWorkspace({method:'POST',body:{action:'previous-lesson',studentKey,subject:'영어',date:input.date}} as any,res,async()=>({uid:'teacher',admin:false,principal:false,academyId:'main',scopes:[{studentKey,subject:'영어'}],db} as any));
 assert.equal(res.statusCode,200);assert.equal(reads,1);assert.equal(body.data.round,13);assert.equal(body.data.sessionRecords.length,2);assert.deepEqual(nextSessionNumbers(body.data.sessionRecords,input),{lesson:14,study:9});
 }finally{teacherReadCache.clear();}
});

test('zero rounded increments are not raised to one and still follow base plus increment',()=>{
 assert.equal(nextSessionNumbers([row()],{...input,end:'14:03'}).lesson,12);
 assert.equal(nextSessionNumbers([row({date:'2026-10-06',start:'14:00',end:'14:03',round:100}),row()],input).lesson,13);
});
test('Notion fallback paginates in the same endpoint flow and reads title times with independent study history',async()=>{
 const {previousNotionLesson}=await import('../api/_lib/teacherNotionPublish');
 const previousFetch=globalThis.fetch,token=process.env.NOTION_INTEGRATION_TOKEN;process.env.NOTION_INTEGRATION_TOKEN='test';let calls=0;
 const page=(date:string,round:number,study:boolean)=>({id:date,properties:{'타임 슬롯':{date:{start:date+'T14:00:00+09:00'}},'배정 시간':{title:[{text:{content:'14:00 ~ 15:20'}}]},'회차':{number:round},'출석':{select:{name:'보강 출석'}},'자습':{checkbox:study},'자습시간':{rich_text:[{text:{content:study?'15:20 ~ 16:20':''}}]},'자습 회차':{number:study?8:null}}});
 const db:any={collection:()=>({doc:()=>({get:async()=>({data:()=>undefined})}),get:async()=>({docs:[]})})};
 globalThis.fetch=async(_url:any,init:any)=>{const query=JSON.parse(init.body);assert.equal(query.page_size,100);assert.equal(query.sorts,undefined);assert.ok(JSON.stringify(query.filter).includes(studentKey));calls++;return new Response(JSON.stringify(calls===1?{results:[page('2026-10-06',13,false)],has_more:true,next_cursor:'next'}:{results:[page('2026-10-04',12,true)],has_more:false}));};
 try{const result=await previousNotionLesson(studentKey,{db,actor:{uid:'teacher'},subject:'영어',date:input.date,includeSessionHistory:true});assert.equal(calls,2);assert.equal(result.round,13);assert.deepEqual(nextSessionNumbers(result.sessionRecords,input),{lesson:14,study:9});}
 finally{globalThis.fetch=previousFetch;if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;}
});

test('extended history contains counter metadata only and existing decimal validation/export remains exact',async()=>{
 const {sessionRecordSummaries}=await import('../src/lib/sessionNumbers');
 const {lessonDraftSchema,assertLessonComplete}=await import('../api/_lib/teacherWorkspacePolicy');
 const {lessonExcelCells}=await import('../src/lib/lessonExcel');
 const history=sessionRecordSummaries([{...row(),data:{...row().data,content:'private past content',note:'private note'}}]);
 assert.ok(!JSON.stringify(history).includes('private'));
 const value={...input,attendance:'출석',attitude:'상',homework:'상',test:'미확인',content:'수업',assignment:'',note:'',nextPlan:'',correct:null,total:null,examCorrect:null,examTotal:null,round:12.9,selfStudyRound:0.5};
 const parsed=lessonDraftSchema.parse(value);assert.equal(assertLessonComplete(parsed).round,12.9);assert.equal(parsed.selfStudyRound,0.5);
 assert.equal(JSON.parse(JSON.stringify(parsed)).round,12.9);assert.ok(lessonExcelCells({data:parsed,studentDisplayName:'모의 학생'})[1].includes('(12.9)'));
 assert.equal(assertLessonComplete({...value,round:13,selfStudyRound:8}).round,13);
});

test('missing local study counter uses Notion without replacing the authoritative app lesson counter',async()=>{
 teacherReadCache.clear();const previousFetch=globalThis.fetch,token=process.env.NOTION_INTEGRATION_TOKEN;process.env.NOTION_INTEGRATION_TOKEN='test';let calls=0;
 const local=row({date:'2026-10-06',round:13,selfStudy:'없음',selfStudyRound:null});
 const db:any={collection:(name:string)=>name==='teacherLessonDrafts'?{where:()=>({get:async()=>({docs:[{id:'local',data:()=>local}]})})}:{doc:()=>({get:async()=>({exists:false,data:()=>undefined})}),get:async()=>({docs:[]})}};
 const page={id:'22222222-2222-4222-8222-222222222222',properties:{'수업 날짜':{date:{start:'2026-10-05T14:00:00+09:00'}},'배정 시간':{title:[{text:{content:'14:00 ~ 15:20'}}]},'회차':{number:50},'출석':{select:{name:'보강 출석'}},'자습':{checkbox:true},'자습시간':{rich_text:[{text:{content:'15:20 ~ 16:20'}}]},'자습회차':{number:8}}};
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({results:[page],has_more:false}));};
 let body:any;const res:any={setHeader:()=>{},end:(value:string)=>body=JSON.parse(value)};
 try{await handleWorkspace({method:'POST',body:{action:'previous-lesson',studentKey,subject:'영어',date:input.date}} as any,res,async()=>({uid:'teacher',admin:false,principal:false,academyId:'main',scopes:[{studentKey,subject:'영어'}],db} as any));
  assert.equal(res.statusCode,200);assert.equal(calls,1);assert.equal(body.data.round,13);assert.deepEqual(nextSessionNumbers(body.data.sessionRecords,input),{lesson:14,study:9});
 }finally{teacherReadCache.clear();globalThis.fetch=previousFetch;if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;}
});

test('absence keeps the preceding counters without increment and automatic session clears do not count as manual edits',()=>{
 const absent=autoSessionNumbers({...input,attendance:'보강 결석'},[row()]);assert.equal(absent.data.round,12);assert.equal(absent.data.selfStudyRound,7);assert.ok(absent.hints.round.endsWith('+0'));
 const cleared=autoSessionNumbers({...input,classSession:'없음',round:null},[row()],['classSession']);assert.equal(cleared.data.round,null);
 const enabled=autoSessionNumbers({...cleared.data,classSession:'있음'},[row()],['classSession']);assert.equal(enabled.data.round,13);
});

