import React from 'react';import test from 'node:test';import assert from 'node:assert/strict';import {renderToStaticMarkup} from 'react-dom/server';
import {todayLessonState,todayLessonRecord,todayLessonProgress,nextUnwrittenLesson} from '../src/lib/todayLessonProgress';import TeacherTodayLessons from '../src/components/teacher/TeacherTodayLessons';import {resolveSavedLesson,openTodayLesson} from '../src/lib/teacherLessonGrid';import {readFileSync} from 'node:fs';
const event={id:'e',title:'개인 보강',kind:'보강',date:'2026-10-07',subject:'영어',start:'17:00',end:'18:00',students:['a','b','c']};
const record=(studentKey:string,stage:string)=>({id:studentKey,stage,data:{studentKey,date:event.date,subject:event.subject,start:event.start}});
test('progress matches exact day student subject start and excludes deleted or unsaved records',()=>{
 const rows=[record('a','published'),record('b','draft'),{...record('c','published'),archived:true},{...record('c','draft'),data:{...record('c','draft').data,start:'18:00'}},record('c','new')];
 // c's draft moved to 18:00 just for today: no event starts then, so it still belongs to this event.
 assert.deepEqual(todayLessonProgress([event],rows),{total:3,published:1,saved:2,empty:0});assert.equal(todayLessonState(event,'c',rows),'미작성','without the day events only the exact time matches');
 assert.equal(todayLessonState(event,'c',rows,[event]),'저장됨');
 assert.equal(todayLessonState(event,'a',[{...record('a','published'),updatedAt:1},{...record('a','draft'),updatedAt:2}]),'저장됨');
});
test('today cards display loaded-record progress and explicit group denominator without another request',()=>{
 let calls=0;const props={data:{uid:'t',admin:true,classes:[],students:event.students.map(studentKey=>({studentKey,studentDisplayName:studentKey})),drafts:[record('a','published'),record('b','draft')],schedules:[{id:'e',data:{...event,status:'예정'}}]},date:event.date,onDate:()=>{},request:async()=>{calls++;return {};}};
 const single=renderToStaticMarkup(<TeacherTodayLessons {...props} onStudent={()=>{}}/>);assert.ok(single.includes('반영 1 · 저장 1 · 미작성 1'));assert.ok(single.includes('반영 완료'));assert.ok(single.includes('현재 불러온 기록 기준'));assert.equal(calls,0);
 const group=renderToStaticMarkup(<TeacherTodayLessons {...props} onGroup={()=>{}}/>);assert.ok(group.includes('반영 1/3명'));assert.ok(group.includes('학생 3명 불러오기'));assert.equal(calls,0);
});

test('next unwritten starts after selection, skips completed entries, wraps and excludes itself',()=>{const events=[{...event,id:'first',start:'17:00',students:['a']},{...event,id:'second',start:'18:00',students:['b']},{...event,id:'third',start:'19:00',students:['c']}];const selection={date:event.date,subject:event.subject,start:'18:00',studentKey:'b'};assert.equal(nextUnwrittenLesson(events,[],selection)?.key,'c');assert.equal(nextUnwrittenLesson(events,[],{...selection,start:'19:00',studentKey:'c'})?.key,'a');assert.equal(nextUnwrittenLesson([events[1]],[],selection),undefined);assert.equal(nextUnwrittenLesson(events,[])?.key,'a');const done={stage:'published',data:{studentKey:'c',date:event.date,subject:event.subject,start:'19:00'}};assert.equal(nextUnwrittenLesson(events,[done],selection)?.key,'a');});
test('a lesson saved with a time changed just for today stays on its event; each lesson pairs with one event, nearest start first',()=>{
 const reg={...event,id:'r1',start:'16:10',end:'17:30',students:['a']},late={...event,id:'r2',start:'19:00',end:'20:20',students:['a']};
 const at=(id:string,start:string,stage='draft')=>({id,stage,data:{studentKey:'a',date:event.date,subject:event.subject,start}});
 assert.equal(todayLessonRecord(reg,'a',[at('x','16:40')],[reg])?.id,'x','16:10 moved to 16:40 today');
 const both=[reg,late],rows=[at('x','16:40'),at('y','19:30','published')];
 assert.equal(todayLessonRecord(reg,'a',rows,both)?.id,'x');assert.equal(todayLessonRecord(late,'a',rows,both)?.id,'y','two moved lessons, each to its nearest event');
 assert.equal(todayLessonRecord(late,'a',[at('x','16:40'),at('z','19:00')],both)?.id,'z','an exact time always wins');
 assert.equal(todayLessonRecord(reg,'a',[at('x','16:40'),at('z','19:00')],both)?.id,'x');
 assert.equal(todayLessonRecord(reg,'a',[at('z','19:00')],both),undefined,'a lesson at the time of another event is not borrowed');
 assert.equal(todayLessonRecord(reg,'a',[{...at('x','16:40'),data:{...at('x','16:40').data,subject:'수학'}}],[reg]),undefined,'other subjects never match');
});
test('the card shows the time changed just for today and opens that lesson',()=>{
 const reg={id:'r1',title:'중1 문법반',kind:'정규',date:'2026-10-07',subject:'영어',start:'16:10',end:'17:30',students:['a'],session:'lesson'} as any;
 let opened:any=null;
 const html=renderToStaticMarkup(<TeacherTodayLessons data={{uid:'t',admin:true,classes:[],students:[{studentKey:'a',studentDisplayName:'가'}],drafts:[{id:'x',stage:'draft',data:{studentKey:'a',date:reg.date,subject:'영어',start:'16:40',end:'18:00',classSession:'있음'}}],schedules:[{id:'s',data:{...reg,status:'예정',kind:'정규'}}]}} date={reg.date} onDate={()=>{}} request={async()=>({})} onStudent={(k:any,e:any)=>{opened=e;}}/>);
 assert.ok(html.includes('오늘만 16:40–18:00'),'moved time shown');assert.ok(html.includes('저장됨'));
});
test('next unwritten lesson after a lesson moved for today goes forward, not back to an earlier one',()=>{
 const mk=(id:string,start:string,end:string)=>({...event,id,start,end,students:['a']});
 const early=mk('e1','14:00','15:20'),mid=mk('e2','16:00','17:20'),late=mk('e3','18:00','19:20'),events=[early,mid,late];
 const rows=[{id:'m',stage:'draft',data:{studentKey:'a',date:event.date,subject:event.subject,start:'16:30'}}];
 const next=nextUnwrittenLesson(events,rows,{studentKey:'a',date:event.date,subject:event.subject,start:'16:30'});
 assert.equal(next?.event.id,'e3','the 16:00 lesson saved at 16:30 is the current one; the next is 18:00');
});
test('a card opens its saved lesson by id even outside the loaded page; never a new draft for an existing lesson',async()=>{
 const input={studentKey:'a',subject:'영어',date:'2026-10-07',start:'16:00',end:'17:20'};
 const saved={id:'old-1',ownerUid:'t',stage:'published',revision:4,data:{...input,start:'16:30',end:'17:50'}};
 let reads=0;const read=async(id:string)=>{reads++;return id==='old-1'?[saved]:[];};
 assert.equal(await resolveSavedLesson([],'t','old-1',read),saved,'outside the first page: read by id, same id and revision kept');assert.equal(reads,1);
 assert.equal((await resolveSavedLesson([saved],'t','old-1',read))?.id,'old-1');assert.equal(reads,1,'already loaded: no read');
 assert.equal(await resolveSavedLesson([],'t','old-1',async()=>[{...saved,archived:true}]),null,'a deleted lesson is not reopened');
 assert.equal(await resolveSavedLesson([],'t','old-1',async()=>[{...saved,ownerUid:'other'}]),null,'not this teacher');
});
test('opening a card: loaded lesson as is, an outside lesson joins the list, a failed read never becomes a new lesson',async()=>{
 const input={studentKey:'a',subject:'영어',date:'2026-10-07',start:'16:00',end:'17:20'};
 const outside={id:'old-1',ownerUid:'t',stage:'draft',revision:2,data:{...input,start:'16:30'}};
 let reads=0;
 const loaded=await openTodayLesson([{...outside,data:{...input}}],input,'t',false,'old-1',async()=>{reads++;return [];});
 assert.equal(loaded.kind,'saved');assert.equal((loaded as any).add,false);assert.equal(reads,0);
 const opened=await openTodayLesson([],input,'t',false,'old-1',async()=>[outside]);
 assert.deepEqual([opened.kind,(opened as any).record.id,(opened as any).record.revision,(opened as any).add],['saved','old-1',2,true],'same id and revision; added to the loaded lessons');
 assert.equal((await openTodayLesson([],input,'t',false,'old-1',async()=>{throw Error('offline');})).kind,'failed','a failed read stops; it is not a new lesson');
 assert.equal((await openTodayLesson([],input,'t',false,'old-1',async()=>[])).kind,'new','gone: a new lesson may start');
 assert.equal((await openTodayLesson([],input,'t',false,undefined,async()=>[])).kind,'new');
 const source=readFileSync(new URL('../src/components/teacher/TeacherWorkspace.tsx',import.meta.url),'utf8');
 assert.match(source,/opened\.kind==='failed'\)\{setSavedLookup\('failed'\);return;\}/,'the editor stops on a failed read');
 assert.match(source,/drafts:\[opened\.record,/,'a lesson read by id joins data.drafts so currentDraft works');
 assert.match(source,/disabled=\{busy\|\|Boolean\(savedLookup\)\}/,'the form is locked while it is read');
});
test('the card lesson id wins over another loaded lesson at the same time',async()=>{
 const input={studentKey:'a',subject:'영어',date:'2026-10-07',start:'16:00',end:'17:20'};
 const older={id:'older-same-time',ownerUid:'t',stage:'draft',revision:1,updatedAt:1,data:{...input}};
 const matched={id:'matched',ownerUid:'t',stage:'published',revision:3,data:{...input,start:'16:30'}};
 let reads=0;const read=async(id:string)=>{reads++;return id==='matched'?[matched]:[];};
 const opened=await openTodayLesson([older],input,'t',false,'matched',read);
 assert.deepEqual([opened.kind,(opened as any).record.id,(opened as any).add,reads],['saved','matched',true,1],'read by the card id, not the same-time lesson in memory');
 const inMemory=await openTodayLesson([older,matched],input,'t',false,'matched',read);
 assert.deepEqual([(inMemory as any).record.id,(inMemory as any).add,reads],['matched',false,1],'loaded by id: no read');
 assert.equal((await openTodayLesson([older],input,'t',false,undefined,read) as any).record.id,'older-same-time','without an id the time match is used');
 assert.equal((await openTodayLesson([older,{...matched,archived:true}],input,'t',false,'matched',read)).kind,'new','the card lesson was deleted: not swapped for the same-time one');
 const source=readFileSync(new URL('../src/components/teacher/TeacherWorkspace.tsx',import.meta.url),'utf8');
 assert.match(source,/let saved:any=savedId\?null:matchingSavedLesson/,'selectStudent skips the time match when a card id is given');
});
