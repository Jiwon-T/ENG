import test from 'node:test';
import assert from 'node:assert/strict';
import {notionFailureDiagnostic} from '../api/_lib/notionFailure';
import {gradeNotion} from '../api/_lib/teacherAcademicNotion';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import WorkspaceSyncPanel from '../src/components/teacher/WorkspaceSyncPanel';
import {syncManagedRecord,DEFAULT_SOURCE} from '../api/_lib/teacherNotionWorkspace';
test('Notion diagnostics retain property hints but exclude raw field values, page IDs and secrets',()=>{
 const diagnostic=notionFailureDiagnostic('pages/private-page-id','PATCH',{properties:{'상태':{status:{name:'PRIVATE_VALUE'}},'수업명':{title:[]}}},{code:'validation_error',request_id:'request-123',message:'상태 invalid PRIVATE_STUDENT PRIVATE_VALUE token-secret'});
 assert.deepEqual(diagnostic.fields,[{name:'상태',type:'status'}]);
 assert.equal(diagnostic.operation,'PATCH pages/:id');
 const json=JSON.stringify(diagnostic);for(const secret of ['PRIVATE','token-secret','private-page-id'])assert.ok(!json.includes(secret));
 assert.equal(notionFailureDiagnostic('pages','POST',{}, {request_id:'unsafe\nsecret',code:'unexpected-secret'}).requestId,null);
});
test('managed class rejection stores safe stage details and the retry panel renders them',async()=>{
 const fetcher=globalThis.fetch,token=process.env.NOTION_INTEGRATION_TOKEN,admin=process.env.ADMIN_UID;
 process.env.NOTION_INTEGRATION_TOKEN='mock-token';process.env.ADMIN_UID='owner';
 const record:any={ownerUid:'owner',academyId:'main',subject:'영어',name:'모의 반',students:[],slots:[],books:[],revision:1,notionSyncDiagnostic:{phase:'old'}};
 const profile={academyId:'main',notionSources:[DEFAULT_SOURCE]};
 const ref={get:async()=>({data:()=>record}),update:async(p:any)=>Object.assign(record,p)};
 const db:any={collection:(name:string)=>({doc:()=>name==='teacherClasses'?ref:{get:async()=>({data:()=>profile})},get:async()=>({docs:[{id:'owner',exists:true,data:()=>profile}]})}),runTransaction:async(fn:any)=>fn({get:(r:any)=>r.get(),update:(r:any,p:any)=>r.update(p)})};
 globalThis.fetch=(async(url:any)=>{
  const path=String(url).split('/v1/')[1];
  if(path.endsWith('/query'))return Response.json({results:[],has_more:false});
  if(path.startsWith('databases/'))return Response.json({properties:{'앱 기록 ID':{rich_text:{}}}});
  return Response.json({code:'validation_error',request_id:'mock-request',message:'상태 invalid private-value'},{status:400});
 }) as any;
 try{
  await assert.rejects(syncManagedRecord(db,'teacherClasses','44444444-4444-4444-8444-444444444444'),/NOTION_400/);
  assert.equal(record.notionSyncStage,'failed');assert.equal(record.notionSyncDiagnostic.phase,'반 정보 반영');
  assert.deepEqual(record.notionSyncDiagnostic.fields,[{name:'상태',type:'status'}]);
  const html=renderToStaticMarkup(React.createElement(WorkspaceSyncPanel,{data:{uid:'owner',classes:[record]},busy:false,request:async()=>{},refresh:async()=>{},act:async()=>{}}));
  assert.match(html,/반 정보 반영/);assert.match(html,/상태 \(status\)/);assert.match(html,/mock-request/);assert.ok(!html.includes('private-value'));
 }finally{globalThis.fetch=fetcher;if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;if(admin===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=admin;}
});
test('Notion transport preserves NOTION_400 error contract with safe diagnostics and no retry',async()=>{
 const oldFetch=globalThis.fetch,oldToken=process.env.NOTION_INTEGRATION_TOKEN;let calls=0;
 process.env.NOTION_INTEGRATION_TOKEN='mock-token';
 globalThis.fetch=(async()=>{calls++;return Response.json({code:'validation_error',request_id:'req-400',message:'요일 validation failed student-private'},{status:400});}) as any;
 try{await assert.rejects(gradeNotion('pages/id','PATCH',{properties:{'요일':{select:{name:'월'}}}}),(error:any)=>{assert.equal(error.message,'NOTION_400');assert.deepEqual(error.notionDiagnostic.fields,[{name:'요일',type:'select'}]);assert.ok(!JSON.stringify(error.notionDiagnostic).includes('student-private'));return true;});assert.equal(calls,1);}
 finally{globalThis.fetch=oldFetch;if(oldToken===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=oldToken;}
});
