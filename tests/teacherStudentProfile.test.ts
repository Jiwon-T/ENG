import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {readStudentProfile,saveStudentProfile,discardStudentProfile,profileFromPage,profileProperties} from '../api/_lib/teacherStudentProfile.js';
import {REGISTRATION_STUDENT_DATABASE as studentDB} from '../api/_lib/teacherStudentRegistrationNotion.js';
import {hashPin,hashToken,hashStudentKey} from '../api/_lib/security.js';
import {getVerifiedParentSession} from '../api/_lib/session.js';
import {assertContactEditAllowsIssuance} from '../api/_lib/studentContactEdit.js';
import {handleWorkspace} from '../api/teacher/workspace.js';
const key='11111111-1111-4111-8111-111111111111',op='22222222-2222-4222-8222-222222222222',otherOp='33333333-3333-4333-8333-333333333333';
const actor={uid:'principal',admin:false,principal:true,academyId:'main'};
const baseline='2026-10-05T01:00:00.000Z';
const rich=(value:string)=>({rich_text:value?[{text:{content:value}}]:[]});
function fixture(){
 process.env.NOTION_STUDENT_DATABASE_ID=studentDB;process.env.PHONE_PIN_PEPPER='test-phone-pepper-for-unit-tests-only'.repeat(2);process.env.PARENT_SESSION_SECRET='test-session-secret-for-unit-tests-only'.repeat(2);
 const memory=registrationFirestore();
 memory.rows.set('academyStudentMemberships/'+key,{academyId:'main',disabled:false});
 memory.rows.set('notionStudentMappings/'+hashStudentKey(key),{studentKey:key,notionStudentPageId:key,studentDisplayName:'기존 학생(학교 고1)',internalStudentId:'stable-internal',firebaseUid:'student-account',createdAt:'original'});
 memory.rows.set('users/student-account',{role:'student',notionStudentKey:key,name:'계정 이름'});
 memory.rows.set('studentReportMappings/stable-internal',{internalStudentId:'stable-internal',studentKey:key,activeReportSlug:'existing'});
 memory.rows.set('reportSlugs/existing',{reportSlug:'existing',studentKey:key,internalStudentId:'stable-internal',studentDisplayName:'기존 학생(학교 고1)',parentPhonePinHash:hashPin('0000'),active:true,authVersion:1,failedAttempts:2,lockedUntil:null,createdAt:'original'});
 memory.rows.set('reportSlugs/inactive',{...memory.rows.get('reportSlugs/existing'),reportSlug:'inactive',active:false});
 memory.rows.set('parentSessions/'+hashToken('old-session'),{authenticationMode:'page-pin-v1',reportSlug:'existing',internalStudentId:'stable-internal',authVersion:1,expiresAt:new Date(Date.now()+60000).toISOString()});
 const properties:any={'학생':{title:[{text:{content:'기존 학생(학교 고1)'}}]},'학교':rich('학교'),'학년':{select:{name:'고1'}},'학생연락처':{phone_number:null},'보호자연락처':{phone_number:'01000000000'},'보호자이름':rich('보호자'),'학생 호칭':rich('학생'),'수강료':{number:10000},'납부기한':rich('매월 5일'),'소속반':{relation:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}]},'등록상태':{status:{name:'등록'}},'앱 등록 ID':rich('original-registration')};
 const page:any={id:key,parent:{database_id:studentDB},last_edited_time:baseline,properties};
 const types:any={'학생':'title','학교':'rich_text','학년':'select','학생연락처':'phone_number','보호자연락처':'phone_number','보호자이름':'rich_text','학생 호칭':'rich_text','수강료':'number','납부기한':'rich_text'};
 const schema:any={properties:Object.fromEntries(Object.entries(types).map(([key,type])=>[key,{type}]))};
 const calls:any[]=[];let failure='none',gate:Promise<void>|undefined;
 const notion=async(path:string,method='GET',body?:any)=>{
  calls.push({path,method,body});
  if(method==='PATCH'){
   if(gate)await gate;
   if(failure==='definite'){failure='none';throw Error('NOTION_400');}
   if(failure==='no-commit'){failure='none';throw Error('TIMEOUT');}
   Object.assign(page.properties,structuredClone(body.properties));page.last_edited_time='2026-10-05T02:00:00.000Z';
   if(failure==='commit-timeout'){failure='none';throw Error('TIMEOUT');}
   if(failure==='app-failure'){failure='none';memory.failNextCommit();}
   return structuredClone(page);
  }
  if(path===`pages/${key}`)return structuredClone(page);
  if(path===`databases/${studentDB}`)return structuredClone(schema);
  throw Error('UNEXPECTED_CALL');
 };
 const input=()=>profileFromPage(page),patches=()=>calls.filter(c=>c.method==='PATCH');
 const session=()=>getVerifiedParentSession('old-session',(()=>({db:memory.db})) as any);
 return {...memory,page,schema,notion,calls,input,patches,session,fail:(mode:string)=>{failure=mode;},gate:(promise:Promise<void>)=>{gate=promise;}};
}
test('profile read preserves the original display name and omits account, PIN and report identity details',async()=>{
 const f=fixture(),record=await readStudentProfile(f.db,actor,key,f.notion);
 assert.equal(record.data.displayName,'기존 학생(학교 고1)');assert.equal(record.pending,null);
 assert.equal(JSON.stringify(record).includes('stable-internal'),false);assert.equal(JSON.stringify(record).includes('student-account'),false);
 assert.equal(JSON.stringify(record).includes('parentPhonePinHash'),false);
});
test('guardian edit revokes old sessions before Notion responds and preserves links, ownership, inactive state and IDs',async()=>{
 const f=fixture();assert.ok(await f.session());let release!:()=>void;f.gate(new Promise<void>(resolve=>{release=resolve;}));
 const data={...f.input(),guardianPhone:'01000000001',displayName:'변경 학생(학교 고1)'};
 const saving=saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion);
 while(!f.patches().length)await new Promise(resolve=>setTimeout(resolve,1));
 assert.equal(await f.session(),null);assert.equal(f.rows.get('reportSlugs/existing').parentPhonePinHash,'');
 release();await saving;
 const slug=f.rows.get('reportSlugs/existing');assert.equal(slug.reportSlug,'existing');assert.equal(slug.parentPhonePinHash,hashPin('0001'));assert.equal(slug.authVersion,2);assert.equal(slug.failedAttempts,0);
 assert.equal(f.rows.get('reportSlugs/inactive').active,false);assert.equal(f.rows.get('studentReportMappings/stable-internal').activeReportSlug,'existing');
 const mapping=f.rows.get('notionStudentMappings/'+hashStudentKey(key));assert.equal(mapping.firebaseUid,'student-account');assert.equal(mapping.internalStudentId,'stable-internal');assert.equal(mapping.createdAt,'original');
 assert.equal(f.rows.get('users/student-account').name,'계정 이름');assert.equal(f.page.properties['등록상태'].status.name,'등록');assert.equal(f.page.properties['앱 등록 ID'].rich_text[0].text.content,'original-registration');
 assert.deepEqual(Object.keys(f.patches()[0].body.properties).sort(),['보호자연락처','학생']);
 await saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion);assert.equal(f.patches().length,1);assert.equal(f.rows.get('reportSlugs/existing').authVersion,2);
});
test('non-contact edits preserve parent sessions and authentication counters, and zero fees stay zero',async()=>{
 const f=fixture(),data={...f.input(),school:'새 학교',tuition:0};
 await saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion);
 assert.ok(await f.session());assert.equal(f.rows.get('reportSlugs/existing').authVersion,1);assert.equal(f.rows.get('reportSlugs/existing').failedAttempts,2);assert.equal(f.page.properties['수강료'].number,0);
 assert.deepEqual(Object.keys(f.patches()[0].body.properties).sort(),['수강료','학교']);
});
test('changing a full phone number even with identical last digits revokes sessions; clearing contact disables PIN',async()=>{
 const f=fixture();await saveStudentProfile(f.db,actor,key,op,baseline,{...f.input(),guardianPhone:'02000000000'},f.notion);
 assert.equal(await f.session(),null);assert.equal(f.rows.get('reportSlugs/existing').parentPhonePinHash,hashPin('0000'));
 await saveStudentProfile(f.db,actor,key,otherOp,f.page.last_edited_time,{...f.input(),guardianPhone:''},f.notion);
 assert.equal(f.rows.get('reportSlugs/existing').parentPhonePinHash,'');assert.equal(f.rows.get('reportSlugs/existing').authVersion,3);assert.equal(f.rows.get('reportSlugs/existing').active,true);
});
test('a committed PATCH with lost response recovers by reading values and never repeats PATCH or session revocation',async()=>{
 const f=fixture(),data={...f.input(),guardianPhone:'01000000001'};f.fail('commit-timeout');
 await assert.rejects(saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion),/TIMEOUT/);
 const pending=(await readStudentProfile(f.db,actor,key,f.notion)).pending!;assert.equal(pending.status,'uncertain');assert.equal(pending.canDiscard,false);assert.equal(pending.data.guardianPhone,data.guardianPhone);
 assert.equal(f.rows.get('reportSlugs/existing').parentPhonePinHash,'');
 await saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion);assert.equal(f.patches().length,1);assert.equal(f.rows.get('reportSlugs/existing').authVersion,2);assert.equal(f.rows.get('reportSlugs/existing').parentPhonePinHash,hashPin('0001'));
});
test('unconfirmed writes cannot be blindly repeated, discarded or replaced with changed input',async()=>{
 const f=fixture(),data={...f.input(),guardianPhone:'01000000001'};f.fail('no-commit');
 await assert.rejects(saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion),/TIMEOUT/);
 await assert.rejects(saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion),/STUDENT_PROFILE_RESULT_UNCERTAIN/);
 await assert.rejects(discardStudentProfile(f.db,actor,key,op,f.notion),/STUDENT_PROFILE_IN_PROGRESS/);
 await assert.rejects(saveStudentProfile(f.db,actor,key,op,baseline,{...data,displayName:'다른 이름'},f.notion),/STUDENT_PROFILE_REQUEST_CONFLICT/);
 assert.equal(f.patches().length,1);assert.equal(await f.session(),null);
});
test('definitive rejection leaves a retryable request; safe discard restores current PIN while old sessions remain revoked',async()=>{
 const f=fixture(),data={...f.input(),guardianPhone:'01000000001'};f.fail('definite');
 await assert.rejects(saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion),/NOTION_400/);
 assert.equal((await readStudentProfile(f.db,actor,key,f.notion)).pending?.canDiscard,true);
 await discardStudentProfile(f.db,actor,key,op,f.notion);
 assert.equal(f.rows.get('reportSlugs/existing').parentPhonePinHash,hashPin('0000'));assert.equal(f.rows.get('reportSlugs/existing').authVersion,3);assert.equal(await f.session(),null);assert.equal((await readStudentProfile(f.db,actor,key,f.notion)).pending,null);
});
test('app transaction failure after remote success recovers without duplicate Notion writes',async()=>{
 const f=fixture(),data={...f.input(),guardianPhone:'01000000001',displayName:'새 이름'};f.fail('app-failure');
 await assert.rejects(saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion),/FIRESTORE_UNAVAILABLE/);
 assert.equal(f.rows.get('reportSlugs/existing').parentPhonePinHash,'');
 await saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion);assert.equal(f.patches().length,1);assert.equal(f.rows.get('notionStudentMappings/'+hashStudentKey(key)).studentDisplayName,'새 이름');
});
test('concurrent conflicting requests never rename metadata or revoke sessions twice',async()=>{
 const f=fixture();let release!:()=>void;f.gate(new Promise<void>(resolve=>{release=resolve;}));
 const data={...f.input(),guardianPhone:'01000000001',displayName:'변경 이름'},saving=saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion);
 while(!f.patches().length)await new Promise(resolve=>setTimeout(resolve,1));
 await assert.rejects(saveStudentProfile(f.db,actor,key,otherOp,baseline,{...data,displayName:'충돌 이름'},f.notion),/STUDENT_PROFILE_IN_PROGRESS/);
 assert.equal(f.rows.get('notionStudentMappings/'+hashStudentKey(key)).studentDisplayName,'기존 학생(학교 고1)');
 release();await saving;assert.equal(f.patches().length,1);assert.equal(f.rows.get('reportSlugs/existing').authVersion,2);
});
test('revision conflicts, foreign membership, unassigned principals and ordinary teachers stop before mutation',async()=>{
 const f=fixture(),data=f.input();f.page.last_edited_time='2026-10-05T03:00:00.000Z';
 await assert.rejects(saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion),/NOTION_EDIT_CONFLICT/);
 assert.equal(f.rows.has('teacherStudentEdits/'+hashStudentKey(key)),false);assert.ok(await f.session());
 for(const denied of [{...actor,principal:false},{...actor,academyId:'other'}])await assert.rejects(readStudentProfile(f.db,denied,key,f.notion));
 f.rows.set('academyStudentMemberships/'+key,{academyId:'other'});await assert.rejects(readStudentProfile(f.db,{...actor,admin:true},key,f.notion),/FORBIDDEN/);
 f.rows.delete('academyStudentMemberships/'+key);await assert.rejects(readStudentProfile(f.db,actor,key,f.notion),/FORBIDDEN/);
 assert.equal(f.patches().length,0);
});
test('recovery preserves unrelated remote edits but blocks a changed target contact',async()=>{
 const f=fixture(),data={...f.input(),tuition:0};f.fail('commit-timeout');
 await assert.rejects(saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion));
 f.page.properties['학생']={title:[{text:{content:'노션에서 변경한 이름'}}]};
 await saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion);
 assert.equal(f.rows.get('notionStudentMappings/'+hashStudentKey(key)).studentDisplayName,'노션에서 변경한 이름');assert.equal(f.patches().length,1);
 const g=fixture(),contact={...g.input(),guardianPhone:'01000000001'};g.fail('commit-timeout');await assert.rejects(saveStudentProfile(g.db,actor,key,op,baseline,contact,g.notion));
 g.page.properties['보호자연락처']={phone_number:'01000000002'};await assert.rejects(saveStudentProfile(g.db,actor,key,op,baseline,contact,g.notion),/STUDENT_PROFILE_RESULT_UNCERTAIN/);
 assert.equal(g.rows.get('reportSlugs/existing').parentPhonePinHash,'');
});
test('new report issuance is blocked while contact sync is pending and rejects stale phone reads after completion',()=>{
 for(const status of ['syncing','failed','uncertain'])assert.throws(()=>assertContactEditAllowsIssuance({contactChanged:true,status},baseline),/STUDENT_PROFILE_CONTACT_PENDING/);
 const edit={contactChanged:true,status:'synced',remoteEditedAt:'2026-10-05T02:00:00.000Z'};
 assert.throws(()=>assertContactEditAllowsIssuance(edit,baseline));assert.throws(()=>assertContactEditAllowsIssuance(edit));
 assert.doesNotThrow(()=>assertContactEditAllowsIssuance(edit,'2026-10-05T03:00:00.000Z'));assert.doesNotThrow(()=>assertContactEditAllowsIssuance({...edit,status:'discarded'},baseline));
});
test('actual workspace read/save endpoints enforce scoped access, validation, no-store and stable identity',async()=>{
 const f=fixture(),original=globalThis.fetch,originalToken=process.env.NOTION_INTEGRATION_TOKEN;
 process.env.NOTION_INTEGRATION_TOKEN='test-notion-token';
 globalThis.fetch=async(url,init:any={})=>new Response(JSON.stringify(await f.notion(String(url).replace('https://api.notion.com/v1/',''),init.method || 'GET',init.body?JSON.parse(init.body):undefined)),{status:200});
 const call=async(method:string,body:any,as:any=actor)=>{
  let data:any;const headers=new Map();const res:any={setHeader:(k:string,v:string)=>headers.set(k,v),end:(s:string)=>{data=JSON.parse(s);}};
  const req:any=method==='GET'?{method,url:'/api/teacher/workspace?'+new URLSearchParams(body)}:{method,body};
  await handleWorkspace(req,res,async()=>({...as,db:f.db,scopes:[],teachingScopes:[]}) as any);return {data,status:res.statusCode,headers};
 };
 try {
  const read=await call('GET',{action:'student-profile',studentKey:key});assert.equal(read.status,200);assert.match(read.headers.get('Cache-Control'),/no-store/);
  const save=await call('POST',{action:'save-student-profile',studentKey:key,operationId:op,expectedEditedAt:baseline,data:{...read.data.record.data,tuition:0}});assert.equal(save.status,200);assert.equal(save.data.status,'synced');
  const forbidden=await call('GET',{action:'student-profile',studentKey:key},{...actor,principal:false});assert.equal(forbidden.status,403);
  const invalid=await call('POST',{action:'save-student-profile',studentKey:key,operationId:otherOp,expectedEditedAt:baseline,data:{...f.input(),internalStudentId:'hijack'}});assert.equal(invalid.status,400);
 } finally {globalThis.fetch=original;if(originalToken===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=originalToken;}
});

test('expired worker cannot change mapping after another result-check request takes its lease',async()=>{
 const f=fixture();let release!:()=>void;f.gate(new Promise<void>(resolve=>{release=resolve;}));
 const data={...f.input(),guardianPhone:'01000000001',displayName:'변경 이름'};
 const worker=saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion).then(()=>null,error=>error);
 for(let attempt=0;attempt<200 && !f.patches().length;attempt++)await new Promise(resolve=>setTimeout(resolve,1));
 assert.equal(f.patches().length,1);
 const ref='teacherStudentEdits/'+hashStudentKey(key);f.rows.set(ref,{...f.rows.get(ref),leaseUntil:0});
 await assert.rejects(saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion),/STUDENT_PROFILE_RESULT_UNCERTAIN/);
 release();assert.match((await worker).message,/STUDENT_PROFILE_IN_PROGRESS/);
 assert.equal(f.rows.get('notionStudentMappings/'+hashStudentKey(key)).studentDisplayName,'기존 학생(학교 고1)');
 await saveStudentProfile(f.db,actor,key,op,baseline,data,f.notion);
 assert.equal(f.patches().length,1);assert.equal(f.rows.get('reportSlugs/existing').authVersion,2);
});

test('stale replay after a later completed edit does not mutate names or authentication',async()=>{
 const f=fixture(),first={...f.input(),displayName:'첫 수정'};
 await saveStudentProfile(f.db,actor,key,op,baseline,first,f.notion);
 await saveStudentProfile(f.db,actor,key,otherOp,f.page.last_edited_time,{...f.input(),displayName:'다음 수정'},f.notion);
 await assert.rejects(saveStudentProfile(f.db,actor,key,op,baseline,first,f.notion),/NOTION_EDIT_CONFLICT/);
 assert.equal(f.rows.get('notionStudentMappings/'+hashStudentKey(key)).studentDisplayName,'다음 수정');
 assert.equal(f.rows.get('reportSlugs/existing').authVersion,1);assert.equal(f.patches().length,2);
});
