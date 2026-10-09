import test from 'node:test';
import assert from 'node:assert/strict';
import {templateFirestore} from './helpers/templateFirestore.js';
import {managedPlan,importManagedStep,activateManaged,saveManaged,archiveManaged,readManaged,CLASS_AUTHORITY} from '../api/_lib/managedAcademy.js';
import {readNotionWorkspace,mergeNotionRows} from '../api/_lib/teacherNotionWorkspace.js';
import {DIRECTORY_ROWS,directoryRowKey} from '../api/_lib/academyDirectorySource.js';
import {CORE_AUTHORITY} from '../api/_lib/academyCore.js';
import {syncStatusMap} from '../src/lib/statusMap.js';
const cls='11111111-1111-4111-8111-111111111111',book='22222222-2222-4222-8222-222222222222',slot='33333333-3333-4333-8333-333333333333',student='44444444-4444-4444-8444-444444444444';
function fixture(){
 const f=templateFirestore(),actor={uid:'owner',admin:true,principal:false,academyId:'main',scopes:[]},source={subject:'영어',classDatabaseId:'1a554024-20f2-42c5-8837-983bd1a4f61e',curriculumDatabaseId:'3390d0f1-c79a-80f5-96b0-e7dfe294b8f3',timetableDatabaseId:'5553cc9c-0182-4f0d-a661-3f3c1c83dc39',lessonDatabaseId:'ab289f5b-1cf5-4160-809e-10d268c9c385'},at=new Date().toISOString();let calls=0;
 f.rows.set('teacherWorkspaceAccess/owner',{academyId:'main',notionSources:[source]});
 f.rows.set('academyStudentMemberships/'+student,{academyId:'main'});f.rows.set(DIRECTORY_ROWS+'/'+directoryRowKey('students',student),{kind:'students',academyId:'main',notionPageId:student,revision:1,remoteEditedAt:at,fields:{properties:{'소속반':{relation:[{id:cls}]}},archived:false}});
 const b={id:book,parent:{database_id:source.curriculumDatabaseId},last_edited_time:at,properties:{'교재명':{title:[{plain_text:'교재'}]},'수업 계획':{rich_text:[{plain_text:'계획'}]},'공통 계획':{checkbox:true},'진행도':{status:{name:'시작 전'}},'반 관리':{relation:[]}}};
 const c={id:cls,parent:{database_id:source.classDatabaseId},last_edited_time:at,properties:{'수업명':{title:[{plain_text:'반'}]},'상태':{status:{name:'진행 중'}},'대상 학생':{relation:[{id:student}]},'커리큘럼':{relation:[{id:book}]}}};
 const t={id:slot,parent:{database_id:source.timetableDatabaseId},last_edited_time:at,properties:{'시간대':{title:[{plain_text:'14:00–15:20'}]},'요일':{select:{name:'월'}},'상태':{status:{name:'진행 중'}},'반':{relation:[{id:cls}]}}};
 const notion:any=async(path:string,method:string,body:any)=>{calls++;assert.equal(method,'POST');if(path.includes(source.curriculumDatabaseId))return {results:[b],has_more:false};if(path.includes(source.classDatabaseId))return {results:[c],has_more:false};if(path.includes(source.timetableDatabaseId)){assert.equal(body.filter.relation.contains,cls);return {results:[t],has_more:false};}throw Error(path);};
 const setup=async()=>{const plan=await managedPlan(f.db,actor);for(const kind of ['curricula','classes']){const item=plan.sources.find((s:any)=>s.kind===kind)!;await importManagedStep(f.db,actor,{key:item.key,kind,final:true,confirmed:true},notion);}await activateManaged(f.db,actor);f.rows.set(CORE_AUTHORITY+'/main',{active:true});};
 return {...f,actor,source,notion,setup,get calls(){return calls;}};
}
test('bounded dry-run makes no writes; source import carries regular slots/books and retains IDs',async()=>{
 const f=fixture(),p=await managedPlan(f.db,f.actor),bookSource=p.sources.find((s:any)=>s.kind==='curricula')!;f.resetMetrics();const dry=await importManagedStep(f.db,f.actor,{key:bookSource.key,kind:'curricula',dryRun:true},f.notion);assert.equal(dry.writes,0);assert.equal(f.metrics.writes,0);
 await f.setup();const c=f.rows.get('teacherClasses/'+cls);assert.equal(c.notionPageId,cls);assert.equal(c.slots[0].id,slot);assert.equal(c.slots[0].weekday,1);assert.equal(c.books[0].linkedPlanId,book);
});
test('Notion blocked: read/update class and time, local common plan, student link, archive and history work',async()=>{
 const f=fixture();await f.setup();const before=f.calls,fetcher=globalThis.fetch;globalThis.fetch=(async()=>{throw Error('NOTION_BLOCKED');}) as any;
 try{const old=f.rows.get('teacherClasses/'+cls),saved=await saveManaged(f.db,f.actor,'classes',{id:cls,revision:old.revision,data:{name:'새 반',subject:'영어',status:'진행 중',students:[],slots:[{id:slot,weekday:2,start:'16:00',end:'17:20'}],books:old.books}});
 assert.equal(saved.sourceMode,'firestore');assert.equal(f.rows.get('teacherClasses/'+cls).slots[0].weekday,2);assert.deepEqual(f.rows.get(DIRECTORY_ROWS+'/'+directoryRowKey('students',student)).fields.properties['소속반'].relation,[]);
 const plan=await saveManaged(f.db,f.actor,'curricula',{data:{title:'새 공통',subject:'영어',content:'본문',classId:null}});assert.equal(plan.record.isCommon,true);assert.equal(plan.record.notionPageId,undefined);
 const data=await readNotionWorkspace(f.db,f.actor);assert.equal(data.classes[0].name,'새 반');assert.ok(data.curricula.some((r:any)=>r.id===plan.id));assert.equal(mergeNotionRows(data.classes,[]).length,1);
 await archiveManaged(f.db,f.actor,'classes',cls,saved.revision);assert.equal((await readManaged(f.db,f.actor)).classes.length,0);assert.ok([...f.rows.keys()].some(k=>k.startsWith('academyManagedHistory/')));assert.equal(f.calls,before);
 }finally{globalThis.fetch=fetcher;}
});
test('foreign writer, stale revision, duplicate slots and failed commit never alter class/roster',async()=>{
 const f=fixture();await f.setup();const old=structuredClone(f.rows.get('teacherClasses/'+cls)),input={id:cls,revision:old.revision,data:{name:'반',subject:'영어',students:[student],slots:old.slots,books:old.books}};
 await assert.rejects(saveManaged(f.db,{...f.actor,uid:'foreign',admin:false},'classes',input),/FORBIDDEN/);await assert.rejects(saveManaged(f.db,f.actor,'classes',{...input,revision:0}),/DRAFT_CONFLICT/);
 await assert.rejects(saveManaged(f.db,f.actor,'classes',{...input,data:{...input.data,slots:[old.slots[0],old.slots[0]]}}),/INVALID_INPUT/);
 f.failNextCommit();await assert.rejects(saveManaged(f.db,f.actor,'classes',input),/FIRESTORE_UNAVAILABLE/);assert.deepEqual(f.rows.get('teacherClasses/'+cls),old);
});
test('activation is held until final full-source verification and stops source imports after activation',async()=>{
 const f=fixture();await assert.rejects(activateManaged(f.db,f.actor),/CORE_NOT_READY/);await f.setup();const p=await managedPlan(f.db,f.actor);await assert.rejects(importManagedStep(f.db,f.actor,{key:p.sources[0].key,kind:'curricula',confirmed:true},f.notion),/CORE_FROZEN/);assert.equal(f.rows.get(CLASS_AUTHORITY+'/main').active,true);
 const badge=syncStatusMap('app_saved')!;assert.equal(badge.text,'앱 저장 완료');assert.equal(badge.kind,'editing');
});

import {workspaceError} from '../api/_lib/teacherWorkspaceError.js';
import {runManagedMigration,confirmManagedMigration,managedRetryable} from '../src/lib/managedMigrationRunner.js';
async function importAll(f:any,kinds=['curricula','classes'],dryRun=false){const plan=await managedPlan(f.db,f.actor);const out:any[]=[];for(const kind of kinds){const item=plan.sources.find((s:any)=>s.kind===kind)!;out.push(await importManagedStep(f.db,f.actor,dryRun?{key:item.key,kind,dryRun:true}:{key:item.key,kind,final:true,confirmed:true},f.notion));}return out;}
test('an unfinished Notion write keeps the app copy, resumes, and can be confirmed without re-sending to Notion',async()=>{
 const f=fixture();await importAll(f);
 const row=f.rows.get('teacherClasses/'+cls);Object.assign(row,{name:'앱에서 고친 반',notionSyncStage:'failed',notionSyncError:'NOTION_400'});
 f.resetMetrics();const [dry]=await importAll(f,['classes'],true);assert.equal(dry.decision,'app-preserved');assert.equal(f.metrics.writes,0);
 const [step]=await importAll(f,['classes']);assert.equal(step.decision,'app-preserved');
 const kept=f.rows.get('teacherClasses/'+cls);assert.equal(kept.name,'앱에서 고친 반','Notion value must not overwrite the newer app copy');assert.equal(kept.migrationAppAuthoritative,true);
 assert.ok([...f.rows.values()].some((v:any)=>v.reason==='pending-write-app-preserved'));
 // Running again is a no-op for the preserved row (no new revision).
 const revision=kept.revision;await importAll(f,['classes']);assert.equal(f.rows.get('teacherClasses/'+cls).revision,revision);
 const before=f.calls;await activateManaged(f.db,f.actor);assert.equal(f.calls,before,'activation never writes to Notion');
 const done=f.rows.get('teacherClasses/'+cls);assert.equal(done.name,'앱에서 고친 반');assert.equal(done.notionSyncStage,'app_saved');
});
test('a running Notion write or deletion stops with the class name; the message is no longer a server-connection error',async()=>{
 const f=fixture();await importAll(f);
 const row=f.rows.get('teacherClasses/'+cls);row.notionSyncStage='syncing';
 let failure:any;try{await importAll(f,['classes']);}catch(e){failure=e;}
 assert.equal(failure.message,'MANAGED_PENDING_WRITE');assert.deepEqual({title:failure.managedBlocker.title,reason:failure.managedBlocker.reason},{title:'반',reason:'running'});
 const response=workspaceError(failure,'managed-import');assert.equal(response.status,409);assert.match(response.body.message!,/‘반’ 반·시간표: Notion 반영이 진행 중/);assert.deepEqual(response.body.blocker,{kind:'classes',title:'반',reason:'running'});
 assert.equal(f.rows.get('teacherClasses/'+cls).notionSyncStage,'syncing','nothing changed');
 row.notionSyncStage='synced';row.deleteRequested=true;await assert.rejects(importAll(f,['classes']),(e:any)=>e.managedBlocker?.reason==='deletion');
 for(const code of ['MANAGED_LINK_REQUIRED','MANAGED_BOOKS_FIRST','MANAGED_IMPORT_FAILED'])assert.notEqual(workspaceError(Error(code),'managed-import').body.error,'WORKSPACE_ERROR');
});
test('activation still refuses an unfinished Notion write the import has not confirmed',async()=>{
 const f=fixture();await importAll(f);f.rows.get('teacherClasses/'+cls).notionSyncStage='failed';
 await assert.rejects(activateManaged(f.db,f.actor),(e:any)=>e.message==='MANAGED_PENDING_WRITE'&&e.managedBlocker.reason==='unconfirmed');
});
test('the runner retries temporary failures and a running write, but stops on real problems',async()=>{
 const err=(code?:string,blocker?:any)=>Object.assign(Error(code||'network'),{code,blocker});
 assert.equal(managedRetryable(err()),true);assert.equal(managedRetryable(err('NOTION_429')),true);assert.equal(managedRetryable(err('MANAGED_PENDING_WRITE',{reason:'running'})),true);
 assert.equal(managedRetryable(err('MANAGED_PENDING_WRITE',{reason:'deletion'})),false);assert.equal(managedRetryable(err('MANAGED_LINK_REQUIRED')),false);
 const plan={sources:[{key:'b',kind:'curricula',subject:'영어',ready:false}]};let failures=2,waits:number[]=[];const seen:any[]=[];
 const request=async(a:string)=>{if(a==='managed-migration-plan')return seen.length?{sources:[{...plan.sources[0],ready:true,verifiedAt:1}]}:plan;if(a==='managed-activate'){seen.push('activate');return {active:true};}if(failures-->0)throw err('NOTION_CONNECTION_ERROR');seen.push('step');return {continue:false,decision:'app-preserved'};};
 const r:any=await confirmManagedMigration(request,()=>false,()=>{},async ms=>{waits.push(ms);});
 assert.deepEqual(waits,[3000,10000]);assert.equal(r.activated,true);assert.equal(r.preserved,2);assert.equal(seen.at(-1),'activate');
 let tries=0;await assert.rejects(runManagedMigration(async a=>{if(a==='managed-migration-plan')return plan;tries++;throw err('MANAGED_LINK_REQUIRED');},()=>false,()=>{},async()=>{}),/MANAGED_LINK_REQUIRED/);assert.equal(tries,1);
});
