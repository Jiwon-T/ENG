import test from 'node:test';
import assert from 'node:assert/strict';
import {publishTeacherGrade} from '../api/_lib/teacherAcademicNotion.ts';
import {syncAcademicPage} from '../api/_lib/academic.ts';
const studentKey='11111111-1111-4111-8111-111111111111', id='22222222-2222-4222-8222-222222222222', pageId='33333333-3333-4333-8333-333333333333';
const d={examDetail:'9월',studentKey,subject:'영어',examType:'학력평가',title:'10월 학력평가',examDate:'2026-10-03',deadline:null,score:0,maxScore:100,grade:'B',submissionStatus:'제출 완료',note:'확인'};
const profile={notionTeacherPageId:'44444444-4444-4444-8444-444444444444'};
const env=()=>{const token=process.env.NOTION_INTEGRATION_TOKEN;process.env.NOTION_INTEGRATION_TOKEN='fake-test-only';return()=>{if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;};};
const reply=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('grade publishing blocks before any page write when source schema is not prepared',async()=>{
 const restore=env(), original=global.fetch, writes:any[]=[];
 global.fetch=async(_url,init)=>{if(init?.method!=='GET')writes.push(init);return reply({properties:{}});};
 const db={collection:()=>({doc:()=>({get:async()=>({data:()=>profile})})})} as any;
 try{await assert.rejects(publishTeacherGrade(db,id,{ownerUid:'t',data:d,revision:1}),/NOTION_SCHEMA_SETUP_REQUIRED/);assert.equal(writes.length,0);}finally{global.fetch=original;restore();}
});
test('grade retry reuses source ID, persists identity before projection, and preserves zero',async()=>{
 const restore=env(), original=global.fetch, calls:any[]=[], updates:any[]=[];
 let projected=false;
 const db={collection:(name:string)=>({doc:(key:string)=>({get:async()=>({data:()=>profile}),update:async(value:any)=>{updates.push({name,key,...value});}})}),runTransaction:async(f:any)=>f({get:async()=>({exists:false,data:()=>undefined}),set:(_ref:any,value:any)=>{projected=value.score===0;},update:()=>{}})} as any;
 global.fetch=async(url,init)=>{
  const path=String(url).split('/v1/')[1],body=init?.body?JSON.parse(String(init.body)):null;calls.push({path,method:init?.method,body});
  if(path.startsWith('databases/')&&init?.method==='GET')return reply({properties:{'앱 기록 ID':{}}});
  if(path.startsWith('databases/')&&init?.method==='PATCH')return reply({});
  if(path.endsWith('/query'))return reply({results:[{id:pageId}]});
  if(path===`pages/${pageId}`&&init?.method==='PATCH')return reply({id:pageId});
  if(path===`pages/${pageId}`)return reply({id:pageId,archived:false,last_edited_time:'2026-10-03T00:00:00.000Z',parent:{database_id:'fa6ce5a8-9572-4f4d-80d9-4d1485d44e6f'},properties:{'학생':{relation:[{id:studentKey}]},'원점수':{number:0},'만점':{number:100},'과목':{select:{name:'영어'}},'시험 종류':{select:{name:'학력평가'}}}});
  throw new Error(`unexpected ${path}`);
 };
 try {
  await publishTeacherGrade(db,id,{ownerUid:'t',data:d,revision:1},{syncAcademicPage: (database,page)=>syncAcademicPage(database,page,async()=>({notionStudentPageId:studentKey,studentKey,studentDisplayName:'학생',parentPhonePinHash:''}),async()=>({internalStudentId:'internal'}) as any)});
  assert.equal(calls.some(c=>c.path==='pages'&&c.method==='POST'),false);
  const source=calls.find(c=>c.path===`pages/${pageId}`&&c.body?.properties?.['원점수']);
  assert.equal(source.body.properties['원점수'].number,0);
  assert.equal(source.body.properties['세부 종류'].select.name,'9월');
  assert.equal(updates[0].notionPageId,pageId);assert.equal(updates[0].stage,'notion_saved');
  assert.equal(updates.at(-1).stage,'published');assert.equal(projected,true);
 }finally{global.fetch=original;restore();}
});
