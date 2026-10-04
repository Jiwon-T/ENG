import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportCache } from '../src/lib/studentReportCache.ts';
import { lessonDraftSchema, continuation } from '../api/_lib/teacherWorkspacePolicy.ts';
import { teacherTestProperties } from '../api/_lib/teacherTestProperties.ts';
import { newGridLesson } from '../src/lib/teacherLessonGrid.ts';
import { sharedRecordAccess, sharedRecordOwner } from '../api/_lib/sharedNotionPolicy.ts';
import { mergeNotionRows, sourceSlots, sourcesFor, rowSource } from '../api/_lib/teacherNotionWorkspace.ts';

test('report cache deduplicates both views, isolates users, expires, and retries failures', async () => {
  let now=100, calls=0;
  const cache=createReportCache(()=>now,30);
  const fetcher=async()=>{calls++;return {count:calls};};
  const [a,b]=await Promise.all([cache.read('a','reports',fetcher),cache.read('a','reports',fetcher)]);
  assert.deepEqual(a,b); assert.equal(calls,1);
  await cache.read('b','reports',fetcher); assert.equal(calls,2);
  now=140;await cache.read('a','reports',fetcher);assert.equal(calls,3);
  await assert.rejects(cache.read('a','bad',async()=>{throw Error('offline');}));
  assert.equal(await cache.read('a','bad',async()=>42),42);
});
test('an invalidated in-flight response never repopulates the cache',async()=>{
  const cache=createReportCache();let resolve!:(n:number)=>void;
  const old=cache.read('a','reports',()=>new Promise<number>(r=>resolve=r));
  cache.invalidate('a');assert.equal(await cache.read('a','reports',async()=>2),2);
  resolve(1);await old;assert.equal(await cache.read('a','reports',async()=>3),2);
});
test('optional tests remain independent, distinguish zero, and reset on continuation',()=>{
  const base=newGridLesson('11111111-1111-4111-8111-111111111111','수학','2026-10-03','14:00','15:30');
  assert.ok(lessonDraftSchema.safeParse(base).success);
  const data=lessonDraftSchema.parse({...base,correct:0,total:20,examCorrect:18,examTotal:20});
  assert.deepEqual(teacherTestProperties(data),{'단어':{number:20},'틀린 단어':{number:20},'문항 수':{number:20},'오답 수':{number:2}});
  assert.equal(lessonDraftSchema.safeParse({...base,examCorrect:3}).success,false);
  assert.equal(lessonDraftSchema.safeParse({...base,examCorrect:21,examTotal:20}).success,false);
  assert.equal(continuation(data).examCorrect,null);
});
test('shared ownership and visibility preserve academy and author boundaries',()=>{
  const profiles=new Map([['teacher1','uid1'],['teacher2','uid2']]);
  assert.equal(sharedRecordOwner([],['teacher1'],profiles),'uid1');
  assert.equal(sharedRecordOwner([],['teacher1','teacher2'],profiles),'__unlinked_author__');
  assert.equal(sharedRecordOwner(['teacher2'],['teacher1'],profiles),'uid2');
  assert.equal(sharedRecordAccess({uid:'uid1',academyId:'main'},'main',['uid1'],'uid2'),true);
  assert.equal(sharedRecordAccess({uid:'other',academyId:'other',principal:true},'main',['other'],'uid1'),false);
  assert.equal(sharedRecordAccess({uid:'head',academyId:'main',principal:true},'main',[],'uid1'),true);
});
test('pending local edits survive a source outage and an upstream refresh',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  const local={id,notionPageId:id,revision:2,notionSyncStage:'failed',name:'수정 중'};
  assert.equal(mergeNotionRows([local],[])[0].name,'수정 중');
  assert.equal(mergeNotionRows([local],[{id,notionPageId:id,name:'원본'}])[0].name,'수정 중');
});
test('source regular times preserve weekday and validate malformed intervals',()=>{
  const page={id:'11111111-1111-4111-8111-111111111111',properties:{'시간대':{title:[{plain_text:'목 14:00-15:30'}]},'요일':{select:{name:'목'}}}};
  assert.equal(sourceSlots(page)?.weekday,4);
  assert.equal(sourceSlots({...page,properties:{...page.properties,'시간대':{title:[{plain_text:'목 15:30-14:00'}]}}}),null);
});
test('shared connection replaces personal source ownership rather than duplicating queries',async()=>{
  const profile={academyId:'main',notionTeacherPageId:'11111111-1111-4111-8111-111111111111'};
  const doc={id:'teacher',exists:true,data:()=>profile};
  const db={collection:(name:string)=>({doc:()=>({get:async()=>({data:()=>name==='academyNotionConfig'?{mode:'shared'}:profile})}),where:()=>({get:async()=>({docs:[doc]})})})};
  const sources=await sourcesFor(db,{uid:'teacher',academyId:'main'});
  assert.equal(sources.length,1);assert.equal(sources[0].shared,true);
  const page={properties:{'학원':{rich_text:[{plain_text:'main'}]},'과목':{select:{name:'수학'}},'담당 선생님':{relation:[{id:profile.notionTeacherPageId}]}}};
  assert.equal((await rowSource(page,sources[0],{uid:'teacher',academyId:'main'})).subject,'수학');
  assert.equal(await rowSource(page,sources[0],{uid:'outsider',academyId:'main'}),null);
});

test('lost Notion creation response is recovered by stable app ID without creating a second class',async()=>{
  const {syncManagedRecord,DEFAULT_SOURCE}=await import('../api/_lib/teacherNotionWorkspace.ts');
  const priorAdmin=process.env.ADMIN_UID,priorToken=process.env.NOTION_INTEGRATION_TOKEN,fetcher=globalThis.fetch;
  process.env.ADMIN_UID='owner';process.env.NOTION_INTEGRATION_TOKEN='test-token';
  const id='44444444-4444-4444-8444-444444444444',pageId='55555555-5555-4555-8555-555555555555';
  const record:any={ownerUid:'owner',academyId:'main',subject:'영어',name:'예시반',students:[],slots:[],books:[],revision:1};
  const profile={academyId:'main',notionSources:[DEFAULT_SOURCE]};let created=0,page:any;
  const ref={get:async()=>({data:()=>record}),update:async(patch:any)=>Object.assign(record,patch)};
  const db:any={collection:(name:string)=>({doc:()=>name==='teacherClasses'?ref:{get:async()=>({data:()=>name==='teacherWorkspaceAccess'?profile:undefined})},get:async()=>({docs:[{id:'owner',exists:true,data:()=>profile}]})}),runTransaction:async(fn:any)=>fn({get:(r:any)=>r.get(),update:(r:any,p:any)=>r.update(p)})};
  globalThis.fetch=(async(url:any,options:any={})=>{
    const path=String(url).split('/v1/')[1],body=options.body?JSON.parse(options.body):{};
    if(path?.startsWith('databases/')&&path.endsWith('/query'))return Response.json({results:path.includes(DEFAULT_SOURCE.classDatabaseId)&&page?[page]:[],has_more:false});
    if(path?.startsWith('databases/'))return Response.json({properties:{'앱 기록 ID':{rich_text:{}},'수업 계획':{rich_text:{}}}});
    if(path==='pages'&&options.method==='POST'){created++;page={id:pageId,parent:{database_id:DEFAULT_SOURCE.classDatabaseId},properties:body.properties,last_edited_time:'2026-10-03T00:00:00Z'};throw Error('lost response');}
    if(path===`pages/${pageId}`){if(options.method==='PATCH')Object.assign(page.properties,body.properties);return Response.json(page);}
    throw Error(`Unexpected mock path ${path}`);
  }) as any;
  try{
    await assert.rejects(syncManagedRecord(db,'teacherClasses',id),/lost response/);
    assert.equal(record.notionSyncStage,'failed');assert.equal(created,1);
    await syncManagedRecord(db,'teacherClasses',id);
    assert.equal(created,1);assert.equal(record.notionPageId,pageId);assert.equal(record.notionSyncStage,'synced');
  }finally{globalThis.fetch=fetcher;if(priorAdmin===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=priorAdmin;if(priorToken===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=priorToken;}
});

test('common curriculum attaches the existing page without duplicating it or removing other classes',async()=>{
 const {syncManagedRecord,DEFAULT_SOURCE}=await import('../api/_lib/teacherNotionWorkspace.ts');
 const oldAdmin=process.env.ADMIN_UID,oldToken=process.env.NOTION_INTEGRATION_TOKEN,oldFetch=globalThis.fetch;
 process.env.ADMIN_UID='owner';process.env.NOTION_INTEGRATION_TOKEN='test';
 const id='44444444-4444-4444-8444-444444444444',classId='55555555-5555-4555-8555-555555555555',bookId='66666666-6666-4666-8666-666666666666',otherClass='77777777-7777-4777-8777-777777777777';
 const teacher='3ec0d0f1-c79a-8108-b714-c1d6fc390ba2';
 const record:any={ownerUid:'owner',academyId:'main',subject:'영어',name:'새 반',students:[],slots:[],books:[{id:bookId,linkedPlanId:bookId,title:'공통 교재',status:'planned',notionEditedAt:'old'}],revision:1};
 const profile={academyId:'main',notionSources:[DEFAULT_SOURCE]};
 const classPage:any={id:classId,parent:{database_id:DEFAULT_SOURCE.classDatabaseId},properties:{},last_edited_time:'new'};
 const bookPage:any={id:bookId,parent:{database_id:DEFAULT_SOURCE.curriculumDatabaseId},properties:{'교재명':{title:[{plain_text:'공통 교재'}]},'과목':{select:{name:'영어'}},'학원':{rich_text:[{plain_text:'main'}]},'담당 선생님':{relation:[{id:teacher}]},'반 관리':{relation:[{id:otherClass}]},'공통 계획':{checkbox:true},'진행도':{status:{name:'시작 전'}}},last_edited_time:'old'};
 const ref={get:async()=>({data:()=>record}),update:async(patch:any)=>Object.assign(record,patch)};
 const db:any={collection:(name:string)=>({doc:()=>name==='teacherClasses'?ref:{get:async()=>({data:()=>name==='teacherWorkspaceAccess'?profile:undefined})},get:async()=>({docs:[{id:'owner',exists:true,data:()=>profile}]})}),runTransaction:async(fn:any)=>fn({get:(r:any)=>r.get(),update:(r:any,p:any)=>r.update(p)})};
 let bookCreates=0;
 globalThis.fetch=(async(url:any,options:any={})=>{
  const path=String(url).split('/v1/')[1],body=options.body?JSON.parse(options.body):{};
  if(path?.endsWith('/query'))return Response.json({results:[],has_more:false});
  if(path?.startsWith('databases/'))return Response.json({properties:{'앱 기록 ID':{rich_text:{}},'공통 계획':{checkbox:{}}}});
  if(path==='pages'){if(body.parent.database_id===DEFAULT_SOURCE.curriculumDatabaseId)bookCreates++;Object.assign(classPage.properties,body.properties);return Response.json(classPage);}
  const page=path===`pages/${classId}`?classPage:path===`pages/${bookId}`?bookPage:null;
  if(page){if(options.method==='PATCH'){Object.assign(page.properties,body.properties);page.last_edited_time='new';}return Response.json(page);}
  throw Error('Unexpected mocked route '+path);
 }) as any;
 try{await syncManagedRecord(db,'teacherClasses',id);assert.equal(bookCreates,0);assert.equal(record.books[0].id,bookId);assert.equal(bookPage.properties['공통 계획'].checkbox,true);assert.deepEqual(bookPage.properties['반 관리'].relation.map((r:any)=>r.id),[otherClass,classId]);assert.equal(classPage.properties['커리큘럼'].relation[0].id,bookId);await syncManagedRecord(db,'teacherClasses',id);assert.equal(bookCreates,0);}
 finally{globalThis.fetch=oldFetch;if(oldAdmin===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=oldAdmin;if(oldToken===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=oldToken;}
});

test('class stop cascades to all timetable statuses, while stopping one slot preserves the class',async()=>{
  const {syncManagedRecord,DEFAULT_SOURCE}=await import('../api/_lib/teacherNotionWorkspace.ts');
  const priorAdmin=process.env.ADMIN_UID,priorToken=process.env.NOTION_INTEGRATION_TOKEN,fetcher=globalThis.fetch;
  process.env.ADMIN_UID='owner';process.env.NOTION_INTEGRATION_TOKEN='test-token';
  const id='44444444-4444-4444-8444-444444444444',pageId='55555555-5555-4555-8555-555555555555';
  const record:any={ownerUid:'owner',academyId:'main',subject:'영어',name:'예시반',status:'중단',students:[],slots:[{weekday:1,start:'14:00',end:'15:30',status:'진행 중'},{weekday:4,start:'15:00',end:'16:30',status:'대기'}],books:[],revision:1};
  const profile={academyId:'main',notionSources:[DEFAULT_SOURCE]};let created=0,page:any;const times:any[]=[];
  const ref={get:async()=>({data:()=>record}),update:async(patch:any)=>Object.assign(record,patch)};
  const db:any={collection:(name:string)=>({doc:()=>name==='teacherClasses'?ref:{get:async()=>({data:()=>name==='teacherWorkspaceAccess'?profile:undefined})},get:async()=>({docs:[{id:'owner',exists:true,data:()=>profile}]})}),runTransaction:async(fn:any)=>fn({get:(r:any)=>r.get(),update:(r:any,p:any)=>r.update(p)})};
  globalThis.fetch=(async(url:any,options:any={})=>{
    const path=String(url).split('/v1/')[1],body=options.body?JSON.parse(options.body):{};
    if(path?.startsWith('databases/')&&path.endsWith('/query'))return Response.json({results:path.includes(DEFAULT_SOURCE.classDatabaseId)&&page?[page]:path.includes(DEFAULT_SOURCE.timetableDatabaseId)?times.filter(r=>!body.filter?.rich_text||r.properties['앱 기록 ID']?.rich_text?.some((t:any)=>t.text.content===body.filter.rich_text.equals)):[],has_more:false});
    if(path?.startsWith('databases/'))return Response.json({properties:{'앱 기록 ID':{rich_text:{}},'수업 계획':{rich_text:{}}}});
    if(path==='pages'&&options.method==='POST'){
      if(body.parent.database_id===DEFAULT_SOURCE.timetableDatabaseId){const row={id:created++?'77777777-7777-4777-8777-777777777777':'66666666-6666-4666-8666-666666666666',parent:body.parent,properties:body.properties,last_edited_time:'old'};times.push(row);return Response.json(row);}
      page={id:pageId,parent:{database_id:DEFAULT_SOURCE.classDatabaseId},properties:body.properties,last_edited_time:'old'};return Response.json(page);
    }
    const row=path===`pages/${pageId}`?page:times.find(r=>path===`pages/${r.id}`);
    if(row){if(options.method==='PATCH')Object.assign(row.properties,body.properties);return Response.json(row);}
    throw Error(`Unexpected mock path ${path}`);
  }) as any;
  try{
    await syncManagedRecord(db,'teacherClasses',id);
    assert.equal(page.properties['상태'].status.name,'중단');
    assert.deepEqual(times.map(r=>r.properties['상태'].status.name),['중단','중단']);
    record.status='진행 중';record.slots=record.slots.map((r:any,i:number)=>({...r,status:i?'진행 중':'중단'}));
    await syncManagedRecord(db,'teacherClasses',id);
    assert.equal(page.properties['상태'].status.name,'진행 중');
    assert.deepEqual(times.map(r=>r.properties['상태'].status.name),['중단','진행 중']);
  }finally{globalThis.fetch=fetcher;if(priorAdmin===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=priorAdmin;if(priorToken===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=priorToken;}
});
