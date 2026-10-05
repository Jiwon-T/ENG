import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {todayLessons,applyPreviousLesson,previousLessonValues,latestPreviousLesson} from '../src/lib/teacherTodayLessons.ts';
import {newGridLesson} from '../src/lib/teacherLessonGrid.ts';
import TeacherTodayLessons from '../src/components/teacher/TeacherTodayLessons';
import {handleWorkspace} from '../api/teacher/workspace.ts';
import {teacherReadCache,invalidateTeacherMutation} from '../api/_lib/teacherReadCache.ts';
import {previousNotionLesson} from '../api/_lib/teacherNotionPublish.ts';
const day='2026-10-05',a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const data:any={uid:'teacher',admin:false,scopes:[{studentKey:a,subject:'영어'},{studentKey:b,subject:'영어'}],students:[{studentKey:a,studentDisplayName:'학생A'},{studentKey:b,studentDisplayName:'학생B'}],classes:[{id:'class',ownerUid:'teacher',name:'정규반',subject:'영어',students:[a,b],slots:[{weekday:1,start:'17:00',end:'18:00'},{weekday:1,start:'19:00',end:'20:00',status:'중단'}]}]};
const schedule=(id:string,status='예정',extra:any={})=>({id,notionPageId:id,data:{date:day,title:'보강',kind:'보강',subject:'영어',start:'15:00',end:'16:00',students:[a,b],status,...extra}});
test('today list combines every regular slot and scheduled student, filters cancellations and permissions, and sorts by time',()=>{
 const events=todayLessons({...data,classes:[...data.classes,{...data.classes[0],id:'stopped',status:'중단'},{...data.classes[0],id:'other',ownerUid:'other'}]},day,[schedule('makeup'),schedule('cancel','취소'),schedule('done','완료'),schedule('tomorrow','예정',{date:'2026-10-06'}),{...schedule('archived'),archived:true},schedule('foreign','예정',{students:['unknown']})]);
 assert.deepEqual(events.map(e=>e.id),['schedule:makeup','regular:class:0']);assert.deepEqual(events[0].students,[a,b]);
 const restricted=todayLessons({...data,scopes:[{studentKey:a,subject:'영어'}]},day,[schedule('makeup')]);assert.ok(restricted.every(e=>e.students.length===1&&e.students[0]===a));
});
test('reflected schedule copies are deduplicated against source records, including cancelled sources',()=>{
 const reflected=[{id:'copy',notionPageId:'make-up',date:day,status:'예정',students:[a,b],subject:'영어',start:'15:00',end:'16:00'}];
 assert.equal(todayLessons({...data,classes:[]},day,[schedule('makeup')],reflected).length,1);
 assert.equal(todayLessons({...data,classes:[]},day,[schedule('makeup','취소')],reflected).length,0);
 assert.equal(todayLessons({...data,classes:[]},day,[],reflected)[0].students.length,2);
});
test('automatic fill copies exact decimal rounds, content and assignment and preserves selected schedule times and clean evaluations',()=>{
 const seed=newGridLesson(a,'영어',day,'15:00','16:00');
 const previous={round:1.7,selfStudyRound:0.5,content:'직전 수업',assignment:'직전 과제',start:'09:00',attendance:'결석',correct:30,total:30};
 const next=applyPreviousLesson(seed,seed,previous);
 assert.equal(next.round,1.7);assert.equal(next.selfStudyRound,0.5);assert.equal(next.selfStudy,'있음');assert.equal(next.content,'직전 수업');assert.equal(next.assignment,'직전 과제');
 assert.equal(next.start,'15:00');assert.equal(next.end,'16:00');assert.equal(next.attendance,'미확인');assert.equal(next.correct,null);
 assert.equal(previousLessonValues({round:0,selfStudyRound:0}).round,0);
});
test('late autofill respects manual edits, changed students/subjects/dates and explicitly absent sessions',()=>{
 const seed=newGridLesson(a,'영어',day,'15:00','16:00');const previous={round:4,selfStudyRound:2,content:'old',assignment:'old work'};
 const cleared=applyPreviousLesson(seed,seed,previous,['content','assignment']);assert.equal(cleared.content,'');assert.equal(cleared.assignment,'');
 const edited={...seed,round:3.5,content:'작성 중',assignment:'새 과제'};
 const next=applyPreviousLesson(edited,seed,previous);assert.equal(next.content,'작성 중');assert.equal(next.assignment,'새 과제');assert.equal(next.round,3.5);
 for(const patch of [{studentKey:b},{subject:'수학'},{date:'2026-10-06'}]){const changed={...seed,...patch};assert.equal(applyPreviousLesson(changed,seed,previous),changed);}
 const absent={...seed,classSession:'없음',selfStudy:'없음'};assert.equal(applyPreviousLesson(absent,seed,previous).round,null);assert.equal(applyPreviousLesson(absent,seed,previous).selfStudyRound,null);
 assert.deepEqual(previousLessonValues({}),{round:null,selfStudyRound:null,content:'',assignment:'',examScope:''});
});
test('previous selection uses lesson date before edit time and excludes archived, wrong-subject and future lessons',()=>{
 const records=[{data:{studentKey:a,subject:'영어',date:'2026-10-03',round:1},updatedAt:100},{data:{studentKey:a,subject:'영어',date:'2026-10-04',round:2},updatedAt:5},{data:{studentKey:a,subject:'영어',date:'2026-10-06',round:3}},{archived:true,data:{studentKey:a,subject:'영어',date:day,round:4}},{data:{studentKey:a,subject:'수학',date:day,round:5}}];
 assert.equal(latestPreviousLesson(records,a,'영어',day).round,2);
});
test('the same today list renders student buttons for single writing and group choices for multiple writing',()=>{
 const props={data:{...data,schedules:[schedule('makeup')]},date:day,onDate:()=>{},request:async()=>({})};
 const single=renderToStaticMarkup(<TeacherTodayLessons {...props} onStudent={()=>{}}/>);
 assert.ok(single.includes('정규반'));assert.ok(single.includes('보강'));assert.ok(single.includes('15:00'));assert.equal((single.match(/학생A/g)||[]).length,2);assert.ok(single.includes('학생B'));
 const group=renderToStaticMarkup(<TeacherTodayLessons {...props} onGroup={()=>{}}/>);assert.equal((group.match(/학생 2명 불러오기/g)||[]).length,2);
});
test('previous-lesson endpoint reuses owner snapshots, preserves rounds and rejects unauthorized students',async()=>{
 teacherReadCache.clear();let reads=0;
 const actor:any={uid:'teacher',admin:false,scopes:data.scopes};const db={collection:()=>({where:()=>({get:async()=>{reads++;return {docs:[a,b].map(studentKey=>({data:()=>({updatedAt:1,data:{studentKey,subject:'영어',date:'2026-10-04',round:1.7,selfStudyRound:0.5,content:studentKey,assignment:'과제'}})}))};}})})};
 const run=async(studentKey:string)=>{let body:any;const res:any={setHeader:()=>{},end:(v:string)=>body=JSON.parse(v)};await handleWorkspace({method:'POST',body:{action:'previous-lesson',studentKey,subject:'영어',date:day}} as any,res,async()=>({...actor,db}));return {status:res.statusCode,body};};
 const first=await run(a),second=await run(b);assert.equal(first.status,200);assert.equal(first.body.data.round,1.7);assert.equal(second.body.data.content,b);assert.equal(reads,1);
 assert.equal((await run('33333333-3333-4333-8333-333333333333')).status,403);
 invalidateTeacherMutation('save-draft');await run(a);assert.equal(reads,2);teacherReadCache.clear();
});
test('Notion fallback reads both round property spellings and excludes future lessons',async()=>{
 const old=globalThis.fetch,token=process.env.NOTION_INTEGRATION_TOKEN;process.env.NOTION_INTEGRATION_TOKEN='test';let filter:any;
 const db:any={collection:()=>({doc:()=>({get:async()=>({data:()=>undefined})}),get:async()=>({docs:[]})})};
 globalThis.fetch=async(_url:any,init:any)=>{filter=JSON.parse(init.body).filter;return new Response(JSON.stringify({results:[{properties:{'회차':{number:1.7},'자습 회차':{number:0.5},'수업 내용':{rich_text:[{plain_text:'관계대명사\n\n과제: 교재 10쪽'}]}}}]}));};
 try{const result=await previousNotionLesson(a,{db,actor:{uid:'teacher'},subject:'영어',date:day});assert.equal(result.round,1.7);assert.equal(result.selfStudyRound,0.5);assert.equal(result.content,'관계대명사');assert.equal(result.assignment,'교재 10쪽');assert.equal(filter.and[1].date.on_or_before,day);}
 finally{globalThis.fetch=old;if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;}
});
