import test from 'node:test';
import assert from 'node:assert/strict';
import {handleWorkspace as handler} from '../api/teacher/workspace.ts';
import {teacherReadCache} from '../api/_lib/teacherReadCache.ts';
const uid='teacher';
async function lessonReadFixture(patch:any={}) {
 const {teacherReadKey}=await import('../api/_lib/teacherReadCache.ts');teacherReadCache.clear();
 const actor={uid,admin:false,principal:false,academyId:'main',scopes:[],teachingScopes:[],...patch};
 await teacherReadCache.get(teacherReadKey(actor,'academy-source'),async()=>[]);
 await teacherReadCache.get(teacherReadKey(actor,'students'),async()=>[{studentKey:'s',studentDisplayName:'학생 이름'}]);
 const rows=Array.from({length:24},(_,i)=>({id:String(i).padStart(2,'0'),ownerUid:uid,academyId:'main',revision:1,stage:'draft',data:{studentKey:'s',date:'2026-09-29',start:i<12?'18:00':'15:00',classSession:'있음'}}));
 rows.push({id:'foreign',ownerUid:'another',academyId:'elsewhere',revision:1,stage:'draft',data:{studentKey:'s',date:'2026-09-29',start:'10:00',classSession:'있음'}});
 const db:any={collection:(name:string)=>{if(name==='users')return {doc:()=>({get:async()=>({data:()=>({alias:'지원T'})})})};const q:any={where:()=>q,doc:()=>({get:async()=>({exists:false,data:()=>undefined})}),get:async()=>({docs:rows.map(r=>({id:r.id,data:()=>r}))})};return q;}};
 return {db,actor};
}
test('lesson review sorts before pagination and regular teachers cannot see foreign records',async()=>{
 const {db}=await lessonReadFixture();
 const {body,status}=await run('/api/teacher/workspace?action=academy-lessons&page=1&period=all',db,{admin:false});
 assert.equal(status,200);assert.equal(body.total,24);assert.equal(body.records[0].data.start,'15:00');assert.equal(body.records.length,10);assert.ok(body.records.every((r:any)=>r.ownerUid===uid));teacherReadCache.clear();
});
test('lesson export includes all pages for selected date and rejects another owner before reads',async()=>{
 const {db}=await lessonReadFixture();
 const own=await run('/api/teacher/workspace?action=academy-lessons-export&day=2026-09-29',db,{admin:false});
 assert.equal(own.status,200);assert.equal(own.body.records.length,24);assert.equal(own.body.teacherName,'지원T');assert.equal(own.body.records[0].studentDisplayName,'학생 이름');
 const foreign=await run('/api/teacher/workspace?action=academy-lessons-export&day=2026-09-29&teacher=another',{collection:()=>{throw Error('must not read');}},{admin:false});
 assert.equal(foreign.status,403);const invalid=await run('/api/teacher/workspace?action=academy-lessons-export&day=2026-02-30',db,{admin:false});assert.equal(invalid.status,400);teacherReadCache.clear();
});
test('principal export remains limited to academy-visible records',async()=>{
 const {db}=await lessonReadFixture({principal:true});
 const foreign=await run('/api/teacher/workspace?action=academy-lessons-export&day=2026-09-29&teacher=another',db,{admin:false,principal:true});assert.equal(foreign.status,200);assert.equal(foreign.body.records.length,0);teacherReadCache.clear();
});
async function run(url:string,db:any,patch:any={}) {
 let body:any;const headers:any={};const res:any={setHeader:(k:string,v:string)=>headers[k]=v,end:(s:string)=>body=JSON.parse(s)};
 await handler({method:'GET',url} as any,res,async()=>({uid,admin:true,principal:false,academyId:'main',scopes:[],teachingScopes:[],db,...patch}) as any);
 return {body,status:res.statusCode,headers};
}
test('draft pages project only summary fields and fetch exactly the requested ten bodies',async()=>{
 teacherReadCache.clear();let summaryReads=0;const requested:string[][]=[];
 const values=Array.from({length:25},(_,i)=>({id:`draft-${i}`,updatedAt:25-i,ownerUid:uid,data:{content:'large content'}}));
 const query:any={where:(key:string,_op:string,value:string)=>{assert.equal(key,'ownerUid');assert.equal(value,uid);return query;},select:(...fields:string[])=>{assert.deepEqual(fields,['updatedAt','archived']);return query;},get:async()=>{summaryReads++;return {docs:values.map(v=>({id:v.id,data:()=>({updatedAt:v.updatedAt})}))};},doc:(id:string)=>({id})};
 const db={collection:(name:string)=>{assert.equal(name,'teacherLessonDrafts');return query;},getAll:async(...refs:any[])=>{requested.push(refs.map(r=>r.id));return refs.map(r=>({id:r.id,exists:true,data:()=>values.find(v=>v.id===r.id)}));}};
 const first=await run('/api/teacher/workspace?action=drafts-page&page=1',db);
 const second=await run('/api/teacher/workspace?action=drafts-page&page=2',db);
 assert.equal(first.status,200);assert.equal(second.body.records.length,10);assert.equal(second.body.records[0].id,'draft-10');assert.equal(second.body.total,25);assert.equal(summaryReads,1);assert.deepEqual(requested.map(r=>r.length),[10,10]);assert.match(first.headers['Cache-Control'],/private, no-store/);teacherReadCache.clear();
});
test('lesson bootstrap omits schedules, settings, all draft bodies and curriculum queries',async()=>{
 teacherReadCache.clear();const previous=globalThis.fetch,token=process.env.NOTION_INTEGRATION_TOKEN,database=process.env.NOTION_STUDENT_DATABASE_ID;
 process.env.NOTION_INTEGRATION_TOKEN='test';process.env.NOTION_STUDENT_DATABASE_ID='test';
 globalThis.fetch=async()=>new Response(JSON.stringify({results:[],has_more:false}),{status:200});
 const reads:string[]=[];const db:any={collection:(name:string)=>{reads.push(name);const q:any={where:()=>q,get:async()=>({docs:[]}),doc:()=>({get:async()=>({data:()=>undefined})})};return q;}};
 try{const {body,status}=await run('/api/teacher/workspace?action=bootstrap-fast&section=lesson',db);assert.equal(status,200);assert.deepEqual(body.classes,[]);
  for(const name of ['teacherSchedules','studentSchedules','teacherLessonDrafts','teacherCurricula','teacherWorkspaceAccess','users'])assert.equal(reads.includes(name),false,name);
  for(const key of ['drafts','schedules','reflectedSchedules','access','staff','curricula'])assert.equal(key in body,false,key);
 }finally{globalThis.fetch=previous; if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;if(database===undefined)delete process.env.NOTION_STUDENT_DATABASE_ID;else process.env.NOTION_STUDENT_DATABASE_ID=database;teacherReadCache.clear();}
});
test('record lookup rechecks ownership even for an authenticated teacher',async()=>{
 const db:any={collection:()=>({doc:()=>({get:async()=>({exists:true,id:'x',data:()=>({ownerUid:'other',data:{content:'private'}})})})})};
 const {status,body}=await run('/api/teacher/workspace?action=managed-record&kind=lesson&id=11111111-1111-4111-8111-111111111111',db,{admin:false});
 assert.equal(status,403);assert.equal(JSON.stringify(body).includes('private'),false);
});

test('academic filters apply before server paging and page changes reuse private source snapshots',async()=>{
 const {teacherReadKey}=await import('../api/_lib/teacherReadCache.ts');teacherReadCache.clear();
 const actor={uid,admin:true,principal:false,academyId:'main',scopes:[],teachingScopes:[]};
 await teacherReadCache.get(teacherReadKey(actor,'academic-firestore-source:'+JSON.stringify([null,'영어'])),async()=>[]);
 await teacherReadCache.get(teacherReadKey(actor,'academic-firestore-students'),async()=>[{studentKey:'student',studentDisplayName:'김연우'}]);
 let reads=0;
 const values=Array.from({length:30},(_,i)=>({ownerUid:uid,data:{studentKey:'student',examType:'학교 내신',subject:i<25?'영어':'수학',title:'평여중2-1중간',examDate:'2026-04-29',examDetail:'1학기 중간고사'},revision:1,stage:'draft'}));
 const db:any={collection:(name:string)=>{assert.equal(name,'teacherAcademicDrafts');return {get:async()=>{reads++;return {docs:values.map((value,i)=>({id:String(i),data:()=>value}))};}};}};
 const first=await run('/api/teacher/workspace?action=academic-records&page=1&subject=영어&search=김연우',db);
 const second=await run('/api/teacher/workspace?action=academic-records&page=2&subject=영어&search=김연우',db);
 assert.equal(first.status,200);assert.equal(first.body.total,25);assert.equal(first.body.records.length,12);assert.equal(second.body.records.length,12);assert.equal(second.body.pages,3);assert.equal(reads,1);assert.equal(second.body.periods.length,1);teacherReadCache.clear();
});

test('class and curriculum refresh skips student directory, schedules and settings',async()=>{
 const {teacherReadKey}=await import('../api/_lib/teacherReadCache.ts');teacherReadCache.clear();
 const actor={uid,admin:true,principal:false,academyId:'main',scopes:[],teachingScopes:[]};
 await teacherReadCache.get(teacherReadKey(actor,'workspace-curriculum'),async()=>({classes:[],curricula:[],issues:[],sources:[]}));
 const reads:string[]=[];const db:any={collection:(name:string)=>{reads.push(name);return {get:async()=>({docs:[]}),doc:()=>({get:async()=>({data:()=>undefined})})};}};
 const {body,status}=await run('/api/teacher/workspace?action=bootstrap&section=curriculum&resourcesOnly=1',db);
 assert.equal(status,200);assert.deepEqual(reads.sort(),['academyClassAuthority','teacherClasses','teacherCurricula']);assert.equal('students' in body,false);assert.equal('staff' in body,false);assert.equal('schedules' in body,false);teacherReadCache.clear();
});

test('reproduces missing today record outside the first draft page with eleven owned drafts',async()=>{
 const {todayLessonState}=await import('../src/lib/todayLessonProgress');
 teacherReadCache.clear();
 const event={id:'today',date:'2026-10-07',subject:'영어',start:'17:00',end:'18:00',students:['s'],title:'정규',kind:'정규'};
 const values=Array.from({length:11},(_,i)=>({id:`draft-${i}`,ownerUid:uid,updatedAt:11-i,stage:i===10?'published':'draft',data:{studentKey:'s',date:i===10?event.date:'2026-10-06',subject:'영어',start:event.start}}));
 const query:any={where:(key:string,_op:string,value:string)=>{assert.equal(key,'ownerUid');assert.equal(value,uid);return query;},select:()=>query,get:async()=>({docs:values.map(v=>({id:v.id,data:()=>({updatedAt:v.updatedAt})}))}),doc:(id:string)=>({id})};
 const db={collection:(name:string)=>{assert.equal(name,'teacherLessonDrafts');return query;},getAll:async(...refs:any[])=>refs.map(r=>({id:r.id,exists:true,data:()=>values.find(v=>v.id===r.id)}))};
 try{
  const first=await run('/api/teacher/workspace?action=drafts-page&page=1',db,{admin:false});
  const second=await run('/api/teacher/workspace?action=drafts-page&page=2',db,{admin:false});
  assert.equal(first.status,200);assert.equal(first.body.total,11);assert.equal(first.body.records.length,10);
  assert.equal(second.body.records.length,1);assert.equal(second.body.records[0].id,'draft-10');
  // Diagnostic reproduction of the existing bug, not the desired final state.
  assert.equal(todayLessonState(event,'s',first.body.records),'미작성');
  assert.equal(todayLessonState(event,'s',[...first.body.records,...second.body.records]),'반영 완료');
 }finally{teacherReadCache.clear();}
});
