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
 const {teacherReadKey}=await import('../api/_lib/teacherReadCache.ts');await teacherReadCache.get(teacherReadKey({uid,admin:true,principal:false,academyId:'main',scopes:[],teachingScopes:[]},'students'),async()=>[]);
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
 const values=Array.from({length:130},(_,i)=>({ownerUid:uid,data:{studentKey:'student',examType:'학교 내신',subject:i<125?'영어':'수학',title:'평여중2-1중간',examDate:'2026-04-29',examDetail:'1학기 중간고사'},revision:1,stage:'draft'}));
 const db:any={collection:(name:string)=>{assert.equal(name,'teacherAcademicDrafts');return {get:async()=>{reads++;return {docs:values.map((value,i)=>({id:String(i),data:()=>value}))};}};}};
 const first=await run('/api/teacher/workspace?action=academic-records&page=1&subject=영어&search=김연우',db);
 const second=await run('/api/teacher/workspace?action=academic-records&page=2&subject=영어&search=김연우',db);
 assert.equal(first.status,200);assert.equal(first.body.total,125);assert.equal(first.body.records.length,60);assert.equal(second.body.records.length,60);assert.equal(second.body.pages,3);assert.equal(reads,1);assert.equal(second.body.periods.length,1);teacherReadCache.clear();
});

test('class and curriculum refresh skips student directory, schedules and settings',async()=>{
 const {teacherReadKey}=await import('../api/_lib/teacherReadCache.ts');teacherReadCache.clear();
 const actor={uid,admin:true,principal:false,academyId:'main',scopes:[],teachingScopes:[]};
 await teacherReadCache.get(teacherReadKey(actor,'workspace-curriculum'),async()=>({classes:[],curricula:[],issues:[],sources:[]}));
 const reads:string[]=[];const db:any={collection:(name:string)=>{reads.push(name);return {get:async()=>({docs:[]}),doc:()=>({get:async()=>({data:()=>undefined})})};}};
 const {body,status}=await run('/api/teacher/workspace?action=bootstrap&section=curriculum&resourcesOnly=1',db);
 assert.equal(status,200);assert.deepEqual(reads.sort(),['academyClassAuthority','teacherClasses','teacherCurricula']);assert.equal('students' in body,false);assert.equal('staff' in body,false);assert.equal('schedules' in body,false);teacherReadCache.clear();
});

test('오늘 수업 progress sees a today lesson outside the first saved-lesson page (eleven own drafts, one from another teacher)',async()=>{
 const {todayLessonState}=await import('../src/lib/todayLessonProgress');
 teacherReadCache.clear();
 const event={id:'today',date:'2026-10-07',subject:'영어',start:'17:00',end:'18:00',students:['s'],title:'정규',kind:'정규'};
 const values=Array.from({length:12},(_,i)=>({id:`draft-${i}`,ownerUid:i===5?'other':uid,updatedAt:12-i,stage:i===11?'published':'draft',data:{studentKey:'s',date:i===11||i===5?event.date:'2026-10-06',subject:'영어',start:event.start,content:'본문'}}));
 const selected:string[][]=[];
 const query=(name:string,filters:any[]=[]):any=>({where:(key:string,_op:string,value:any)=>query(name,[...filters,[key,value]]),select:(...fields:string[])=>{selected.push(fields);return query(name,filters);},limit:()=>query(name,filters),orderBy:()=>query(name,filters),
  get:async()=>({docs:(name==='teacherLessonDrafts'?values:[]).filter(v=>filters.every(([k,val])=>k.split('.').reduce((o:any,p:string)=>o?.[p],v)===val)).map(v=>({id:v.id,data:()=>v}))}),doc:(id:string)=>({id,get:async()=>({exists:false,data:()=>undefined})})});
 const db:any={collection:(name:string)=>query(name),getAll:async(...refs:any[])=>refs.map(r=>({id:r.id,exists:true,data:()=>values.find(v=>v.id===r.id)}))};
 try{
  const firstPage=(await run('/api/teacher/workspace?action=drafts-page&page=1',db,{admin:false})).body.records;
  assert.equal(firstPage.length,10);assert.ok(!firstPage.some((r:any)=>r.id==='draft-11'),'the published today lesson is on page 2');
  const day=await run('/api/teacher/workspace?action=schedule-records&day=2026-10-07',db,{admin:false});
  assert.equal(day.status,200);
  assert.deepEqual(day.body.dayLessons.map((r:any)=>r.id),['draft-11'],'own lessons of that day only (another teacher\'s is not included)');
  assert.equal('content' in day.body.dayLessons[0].data,false,'summary fields only');
  assert.equal(todayLessonState(event,'s',[...day.body.dayLessons,...firstPage]),'반영 완료');
 }finally{teacherReadCache.clear();}
});

test('lesson bootstrap carries page 1 of saved lessons when asked, so the tab needs one request',async()=>{
 teacherReadCache.clear();const previous=globalThis.fetch,token=process.env.NOTION_INTEGRATION_TOKEN,database=process.env.NOTION_STUDENT_DATABASE_ID;
 process.env.NOTION_INTEGRATION_TOKEN='test';process.env.NOTION_STUDENT_DATABASE_ID='test';
 globalThis.fetch=async()=>new Response(JSON.stringify({results:[],has_more:false}),{status:200});
 const drafts=Array.from({length:9},(_,i)=>({id:`d${i}`,ownerUid:uid,updatedAt:100-i,archived:false,stage:'draft',data:{studentKey:'s',date:'2026-10-06',subject:'영어'}}));
 const db:any={getAll:async(...refs:any[])=>refs.map(r=>({id:r.id,exists:true,data:()=>drafts.find(d=>d.id===r.id)})),collection:(name:string)=>{const q:any={where:()=>q,select:()=>q,limit:()=>q,orderBy:()=>q,get:async()=>({docs:name==='teacherLessonDrafts'?drafts.map(d=>({id:d.id,data:()=>d})):[]}),doc:(id:string)=>({id,get:async()=>({exists:false,data:()=>undefined})})};return q;}};
 const {teacherReadKey}=await import('../api/_lib/teacherReadCache.ts');const seedStudents=()=>teacherReadCache.get(teacherReadKey({uid,admin:false,principal:false,academyId:'main',scopes:[],teachingScopes:[]},'students'),async()=>[]);
 try{
  await seedStudents();
  const withList=await run('/api/teacher/workspace?action=bootstrap&section=lesson&draftsSize=6',db,{admin:false});
  assert.equal(withList.status,200,JSON.stringify(withList.body));assert.equal(withList.body.draftsPage.records.length,6);assert.equal(withList.body.draftsPage.total,9);assert.equal(withList.body.draftsPage.records[0].id,'d0');
  teacherReadCache.clear();await seedStudents();
  const without=await run('/api/teacher/workspace?action=bootstrap&section=lesson',db,{admin:false});
  assert.equal('draftsPage' in without.body,false);
 }finally{globalThis.fetch=previous;if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;if(database===undefined)delete process.env.NOTION_STUDENT_DATABASE_ID;else process.env.NOTION_STUDENT_DATABASE_ID=database;teacherReadCache.clear();}
});
test('repeated bootstraps reuse the enrollment read until a forced refresh, read student links fresh every time, and base reads no class data',async()=>{
 teacherReadCache.clear();
 const student='11111111-1111-4111-8111-111111111111';let linkedUid:string|null=null;
 const reads:string[]=[];const db:any={collection:(name:string)=>{reads.push(name);const q:any={where:()=>q,select:()=>q,limit:()=>q,get:async()=>({docs:name==='notionStudentMappings'?[{id:'m',data:()=>({notionStudentPageId:student,studentKey:student,internalStudentId:'internal',firebaseUid:linkedUid,studentDisplayName:'학생'})}]:[]}),doc:()=>({get:async()=>({exists:false,data:()=>undefined})})};return q;}};
 const {teacherReadKey}=await import('../api/_lib/teacherReadCache.ts');await teacherReadCache.get(teacherReadKey({uid,admin:true,principal:false,academyId:'main',scopes:[],teachingScopes:[]},'students'),async()=>[{studentKey:student,studentDisplayName:'학생'}]);
 const count=(name:string)=>reads.filter(r=>r===name).length;
 try{
  const first=await run('/api/teacher/workspace?action=bootstrap&section=students',db);assert.equal(first.status,200);assert.equal(first.body.students[0].accountLinked,false);
  // Linked from another endpoint or device (another server instance never clears this process's cache): shows on the next read.
  linkedUid='student-account';
  const second=await run('/api/teacher/workspace?action=bootstrap&section=students',db);assert.equal(second.body.students[0].accountLinked,true,'a new link shows without force');
  assert.equal(count('notionStudentMappings'),2,'student links are read on every bootstrap');
  assert.equal(count('studentEnrollments'),1,'the enrollment read is reused');
  await run('/api/teacher/workspace?action=bootstrap&section=lesson&force=1',db);assert.equal(count('studentEnrollments'),2,'새로고침 (force) reads again');
  reads.length=0;await run('/api/teacher/workspace?action=bootstrap&section=base',db);
  for(const name of ['teacherClasses','teacherCurricula','academyClassAuthority','studentEnrollments'])assert.equal(reads.includes(name),false,name);
 }finally{teacherReadCache.clear();}
});
test('today records: the day read fills in lessons beyond the first page; copies in memory win by id', async () => {
 const { todayRecords, todayLessonState } = await import('../src/lib/todayLessonProgress');
 const event = { id: 'e', date: '2026-10-07', subject: '영어', start: '17:00', end: '18:00', students: ['s'], title: '정규', kind: '정규' } as any;
 const server = [{ id: 'a', stage: 'published', updatedAt: 1, data: { studentKey: 's', date: '2026-10-07', subject: '영어', start: '17:00' } }];
 assert.equal(todayLessonState(event, 's', todayRecords(server, [])), '반영 완료', 'a lesson only the day read knows about counts');
 const deletedHere = [{ ...server[0], archived: true, updatedAt: 2 }];
 assert.equal(todayLessonState(event, 's', todayRecords(server, deletedHere)), '미작성', 'deleted here: the stale server copy does not bring it back');
 assert.equal(todayLessonState(event, 's', todayRecords(undefined, [])), '미작성');
});
test('today records keep the newer copy: a newer publish or delete from another device beats an older copy in memory; this device’s latest action is kept', async () => {
 const { todayRecords, todayLessonState } = await import('../src/lib/todayLessonProgress');
 const event = { id: 'e', date: '2026-10-07', subject: '영어', start: '17:00', end: '18:00', students: ['s'], title: '정규', kind: '정규' } as any;
 const lesson = (patch: any) => ({ id: 'a', data: { studentKey: 's', date: '2026-10-07', subject: '영어', start: '17:00' }, ...patch });
 const state = (server: any[], memory: any[]) => todayLessonState(event, 's', todayRecords(server, memory));
 assert.equal(state([lesson({ revision: 2, stage: 'published', updatedAt: 20 })], [lesson({ revision: 1, stage: 'draft', updatedAt: 10 })]), '반영 완료', 'published on another device');
 assert.equal(state([lesson({ revision: 3, stage: 'archived', archived: true, updatedAt: 30 })], [lesson({ revision: 2, stage: 'published', updatedAt: 20 })]), '미작성', 'deleted on another device');
 assert.equal(state([lesson({ revision: 2, stage: 'published', updatedAt: 20 })], [lesson({ revision: 3, stage: 'archived', archived: true, updatedAt: 30 })]), '미작성', 'just deleted here: the older day read does not bring it back');
 assert.equal(state([lesson({ revision: 1, stage: 'draft', updatedAt: 10 })], [lesson({ revision: 2, stage: 'published', updatedAt: 20 })]), '반영 완료', 'just published here');
 assert.equal(state([lesson({ revision: 2, stage: 'draft', updatedAt: 20 })], [lesson({ revision: 2, stage: 'published', updatedAt: 20 })]), '반영 완료', 'same version: this device’s copy is kept');
 assert.equal(state([lesson({ stage: 'published', updatedAt: 50 })], [lesson({ stage: 'draft', updatedAt: 40 })]), '반영 완료', 'without revisions the later update wins');
});
