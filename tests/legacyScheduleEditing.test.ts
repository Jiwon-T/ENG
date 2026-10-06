import test from 'node:test';import assert from 'node:assert/strict';
import {rowSource,readSourceSchedules,DEFAULT_SOURCE} from '../api/_lib/teacherNotionWorkspace.js';
import {handleWorkspace} from '../api/teacher/workspace.js';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {teacherReadCache} from '../api/_lib/teacherReadCache.js';
const database='3430f1a4-9dde-4b4c-a5cf-0d11b913b38c',teacher='3ec0d0f1-c79a-8108-b714-c1d6fc390ba2',student='22222222-2222-4222-8222-222222222222',pageId='3ed0d0f1-c79a-80e7-b04e-e9cd979d8be1';
function page(){return {id:pageId,parent:{database_id:database},last_edited_time:'2026-10-06T06:00:00Z',properties:{과목:{select:null},'담당 선생님':{relation:[{id:teacher}]},'대상 학생':{relation:[{id:student}]},일정명:{title:[{plain_text:'평여중2 직전 보강'}]},'날짜 및 시간':{date:{start:'2026-10-06T10:10:00Z',end:'2026-10-06T12:00:00Z'}}}};}
test('blank subject fallback is confined to known main support-English schedule identity',async()=>{
 const source={...DEFAULT_SOURCE,shared:true,academyId:'main',legacySchedule:true,profiles:[{uid:'support',notionTeacherPageId:teacher}]},p:any=page();
 assert.equal((await rowSource(p,source,{uid:'support',academyId:'main'})).subject,'영어');
 assert.equal(await rowSource(p,source,{uid:'outsider',academyId:'main'}),null);
 for(const changed of [{...p,parent:{database_id:student}},{...p,properties:{...p.properties,'담당 선생님':{relation:[{id:student}]}}},{...p,properties:{...p.properties,'담당 선생님':{relation:[{id:teacher},{id:student}]}}}])assert.equal(await rowSource(changed,source,{uid:'support',academyId:'main'}),null);
 assert.equal(await rowSource(p,{...source,academyId:'other'},{uid:'support',academyId:'other'}),null);
});
async function fixture(run:(f:any)=>Promise<void>){
 const f=registrationFirestore(),original=globalThis.fetch,token=process.env.NOTION_INTEGRATION_TOKEN,admin=process.env.ADMIN_UID;process.env.NOTION_INTEGRATION_TOKEN='test';process.env.ADMIN_UID='support';teacherReadCache.clear();
 f.rows.set('academyNotionConfig/main',{...DEFAULT_SOURCE,mode:'shared'});f.rows.set('teacherWorkspaceAccess/support',{academyId:'main',notionTeacherPageId:teacher});
 const actor={uid:'support',admin:true,academyId:'main',scopes:[{studentKey:student,subject:'영어'}],teachingScopes:[{studentKey:student,subject:'영어'}],db:f.db};
 const p=page();globalThis.fetch=(async(url,options)=>{const path=String(url).replace('https://api.notion.com/v1/','');if(path===`databases/${database}`)return new Response(JSON.stringify({properties:{과목:{type:'select'}}}));assert.equal(path,`databases/${database}/query`);assert.equal(options?.method,'POST');return new Response(JSON.stringify({results:[p],has_more:false}));}) as typeof fetch;
 const call=async()=>{let body:any;const res:any={setHeader:()=>{},end:(v:string)=>body=JSON.parse(v)};await handleWorkspace({method:'POST',body:{action:'import-source-record',kind:'schedule',id:pageId}} as any,res,async()=>actor as any);return {status:res.statusCode,body};};
 try{await run({...f,actor,p,call});}finally{globalThis.fetch=original;teacherReadCache.clear();if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;if(admin===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=admin;}
}
test('legacy schedule source is editable and displays authoritative Notion Korean time',async()=>fixture(async f=>{
 const [source]=await readSourceSchedules(f.db,f.actor);assert.equal(source.data.start,'19:10');assert.equal(source.data.end,'21:00');assert.equal(source.ownerUid,'support');assert.equal(source.data.subject,'영어');
 const result=await f.call();assert.equal(result.status,200);assert.equal(result.body.record.notionPageId,pageId);assert.equal(result.body.record.data.start,'19:10');assert.equal(result.body.record.stage,'draft');
}));
test('refresh for editing preserves existing local identity and clears only completed journal',async()=>fixture(async f=>{
 const localId='33333333-3333-4333-8333-333333333333';f.rows.set('teacherSchedules/'+localId,{ownerUid:'support',academyId:'main',notionPageId:pageId,stage:'published',revision:3,lastSubmittedRevision:3,notionWrite:{done:true},data:{start:'13:00'}});
 const result=await f.call();assert.equal(result.status,200);assert.equal(result.body.record.id,localId);assert.equal(result.body.record.revision,4);assert.equal(result.body.record.data.start,'19:10');assert.equal(result.body.record.notionWrite,null);assert.ok(!f.rows.has('teacherSchedules/'+pageId));
}));
test('archived and uncertain schedules cannot be re-imported or have their intent overwritten',async()=>fixture(async f=>{
 for(const patch of [{archived:true},{deleteRequested:true},{notionWrite:{done:false},lastSubmittedRevision:1}]){const old={ownerUid:'support',academyId:'main',notionPageId:pageId,stage:'published',revision:3,...patch};f.rows.set('teacherSchedules/'+pageId,old);const result=await f.call();assert.notEqual(result.status,200);assert.deepEqual(f.rows.get('teacherSchedules/'+pageId),old);}
}));
