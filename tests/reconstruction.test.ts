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
