import test from 'node:test';
import assert from 'node:assert/strict';
import { schedulePlaceOptions, assertSchedulePlace, readSchedulePlaceOptions, SCHEDULE_DATABASE } from '../api/_lib/teacherSchedulePlaces.js';
import { handleWorkspace } from '../api/teacher/workspace.js';
import { registrationFirestore } from './helpers/registrationFirestore.js';
const studentKey='33333333-3333-4333-8333-333333333333', id='11111111-1111-4111-8111-111111111111';
const schema=(names=['학원','이충','용죽','고덕','온라인','기타'])=>({properties:{장소:{type:'select',select:{options:names.map(name=>({name}))}}}});
test('place options follow source names and order including future additions',async()=>{
 const s=schema(['고덕','새 강의실','온라인']);assert.deepEqual(schedulePlaceOptions(s),['고덕','새 강의실','온라인']);
 assert.deepEqual(await readSchedulePlaceOptions(async path=>{assert.equal(path,`databases/${SCHEDULE_DATABASE}`);return s;}),['고덕','새 강의실','온라인']);
 assert.doesNotThrow(()=>assertSchedulePlace(s,'새 강의실'));assert.throws(()=>assertSchedulePlace(s,'학원'),/NOTION_SCHEDULE_PLACE_REQUIRED/);
});
test('missing or wrong place schema never silently falls back to fixed options',()=>{
 for(const s of [{},{properties:{장소:{type:'rich_text'}}},{properties:{장소:{type:'select',select:{options:[{}]}}}}])assert.throws(()=>schedulePlaceOptions(s),/NOTION_SCHEDULE_PLACE_SCHEMA_REQUIRED/);
 assert.deepEqual(schedulePlaceOptions(schema([])),[]);assert.doesNotThrow(()=>assertSchedulePlace(schema([]),''));
});
test('workspace loads live options, saves and edits every configured place, rejects stale values without writes',async()=>{
 const f=registrationFirestore(), actor:any={uid:'t',admin:false,principal:false,academyId:'main',scopes:[{studentKey,subject:'영어'}],db:f.db};
 const original=global.fetch, token=process.env.NOTION_INTEGRATION_TOKEN;process.env.NOTION_INTEGRATION_TOKEN='test';let live=schema();
 global.fetch=async(url:any)=>{assert.equal(String(url),`https://api.notion.com/v1/databases/${SCHEDULE_DATABASE}`);return new Response(JSON.stringify(live));};
 const call=async(method:string,values:any)=>{let body:any;const res:any={setHeader(){},end(v:string){body=JSON.parse(v);}};await handleWorkspace(method==='GET'?{method,url:'/api/teacher/workspace?'+new URLSearchParams(values)} as any:{method,body:values} as any,res,async()=>actor);return {status:res.statusCode,body};};
 const data={title:'보강',subject:'영어',students:[studentKey],date:'2026-10-08',start:'14:50',end:'16:10',kind:'보강',status:'예정',place:'이충',note:'준비물'};
 try{
  assert.deepEqual((await call('GET',{action:'schedule-options'})).body.places,['학원','이충','용죽','고덕','온라인','기타']);
  assert.equal((await call('POST',{action:'save-schedule',id,data})).status,200);
  assert.equal(f.rows.get('teacherSchedules/'+id).data.place,'이충');
  for(const [i,place] of ['용죽','고덕','온라인','기타','학원'].entries())assert.equal((await call('POST',{action:'save-schedule',id,revision:i+1,data:{...data,place}})).status,200);
  live=schema(['온라인']);const before=structuredClone(f.rows.get('teacherSchedules/'+id));
  const invalid=await call('POST',{action:'save-schedule',id,revision:6,data:{...data,place:'고덕'}});
  assert.equal(invalid.status,400);assert.equal(invalid.body.error,'NOTION_SCHEDULE_PLACE_REQUIRED');assert.match(invalid.body.message,/장소 목록/);assert.deepEqual(f.rows.get('teacherSchedules/'+id),before);
  assert.deepEqual((await call('GET',{action:'schedule-options'})).body.places,['온라인']);
  assert.equal((await call('POST',{action:'save-schedule',id,revision:5,data:{...data,place:'온라인'}})).status,409);
  actor.uid='other';assert.equal((await call('POST',{action:'save-schedule',id,revision:6,data:{...data,place:'온라인'}})).status,403);
 }finally{global.fetch=original;if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;}
});
test('existing Notion schedule reads preserve branch place, identity and an unset location',async()=>{
 const {readSourceSchedules,DEFAULT_SOURCE}=await import('../api/_lib/teacherNotionWorkspace.js');
 const f=registrationFirestore();f.rows.set('teacherWorkspaceAccess/t',{academyId:'main',notionSources:[DEFAULT_SOURCE],notionTeacherPageId:'55555555-5555-4555-8555-555555555555'});
 const actor:any={uid:'t',academyId:'main',admin:false,principal:false,scopes:[{studentKey,subject:'영어'}]};
 const original=global.fetch,token=process.env.NOTION_INTEGRATION_TOKEN;process.env.NOTION_INTEGRATION_TOKEN='test';let place:any={name:'이충'};
 const page=()=>({id,parent:{database_id:SCHEDULE_DATABASE},last_edited_time:'2026-10-05T01:00:00.000Z',properties:{일정명:{title:[{text:{content:'기존 보강'}}]},과목:{select:{name:'영어'}},'대상 학생':{relation:[{id:studentKey}]},'담당 선생님':{relation:[{id:'55555555-5555-4555-8555-555555555555'}]},'날짜 및 시간':{date:{start:'2026-10-08T14:50:00+09:00',end:'2026-10-08T16:10:00+09:00'}},'일정 종류':{select:{name:'보강'}},'일정 상태':{select:{name:'예정'}},장소:{select:place}}});
 global.fetch=async(url:any)=>{assert.equal(String(url),`https://api.notion.com/v1/databases/${SCHEDULE_DATABASE}/query`);return new Response(JSON.stringify({results:[page()],has_more:false}));};
 try{const [r]=await readSourceSchedules(f.db,actor);assert.equal(r.data.place,'이충');assert.equal(r.notionPageId,id);assert.deepEqual(r.data.students,[studentKey]);assert.equal(r.data.start,'14:50');place=null;assert.equal((await readSourceSchedules(f.db,actor))[0].data.place,'');}
 finally{global.fetch=original;if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;}
});
