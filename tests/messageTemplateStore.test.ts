import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {templateFirestore} from './helpers/templateFirestore.js';
import {TEMPLATE_DATABASE,TEMPLATE_SOURCE,TEMPLATE_COLLECTION,TEMPLATE_STATE,TEMPLATE_JOBS,TEMPLATE_HISTORY,templateKey,templatePage,
 dryRunTemplates,importTemplateStep,saveTemplate,retryTemplate,processTemplateJob,processDueTemplates,resolveTemplate,reconcileTemplateStep,storedMessageTemplates,storedMessageTemplatePage,templateManagementList,templateHistory,restoreTemplate} from '../api/_lib/messageTemplateStore.js';
import {authorizeTemplateWorker,runTemplateWorker} from '../api/_lib/messageTemplateWorker.js';
import {templateAction} from '../api/_lib/messageTemplateActions.js';
const actor={uid:'admin',admin:true,academyId:'main'},clockStart=Date.parse('2026-10-08T00:00:00Z');
export function fixture(count=1){
 const f=templateFirestore(),remote=new Map<string,any>();let at=clockStart,queries=0,patches=0,gets=0,failMode='',onQuery:undefined|(()=>void);
 for(let i=1;i<=count;i++){const id=`11111111-1111-4111-8111-${String(i).padStart(12,'0')}`;remote.set(id,{id,parent:{database_id:TEMPLATE_DATABASE},last_edited_time:'2026-10-07T00:00:00Z',properties:{'유형':{title:[{plain_text:'안내 '+i}]},'내용(문자본문)':{rich_text:[{plain_text:'{{학생 호칭}} 안내입니다.'}]},'대상':{type:'select',select:{name:'보호자'}},'다른 속성':{rich_text:[{plain_text:'보존'}]}}});}
 const notion:any=async(path:string,method='GET',body:any={})=>{
  if(path.endsWith('/query')){queries++;onQuery?.();const since=Date.parse(body.filter?.last_edited_time?.on_or_after||'1970-01-01');const pages=[...remote.values()].filter(p=>!p.archived&&Date.parse(p.last_edited_time)>=since);const start=Number(body.start_cursor?.slice(1)||0),end=start+body.page_size;return {results:structuredClone(pages.slice(start,end)),has_more:end<pages.length,next_cursor:end<pages.length?'c'+end:null};}
  const id=path.slice(6),p=remote.get(id);if(!p||failMode==='404')throw Error('NOTION_404');
  if(method==='PATCH'){patches++;if(failMode==='502'){failMode='';throw Error('NOTION_502');}Object.assign(p.properties,body.properties);p.last_edited_time=new Date(at).toISOString();if(failMode==='lost-response'){failMode='';throw Error('timeout');}if(failMode==='lost-commit'){failMode='';f.failNextCommit();}}
  else gets++;
  return structuredClone(p);
 };
 const id=[...remote.keys()][0],clock=()=>at,get=()=>f.rows.get(TEMPLATE_COLLECTION+'/'+templateKey(id));
 const setup=async()=>{let r:any;do{r=await importTemplateStep(f.db,actor,notion,clock);}while(r.continue);};
 const save=(data={title:'앱 제목',body:'앱 본문'})=>saveTemplate(f.db,actor,{id,revision:get().revision,operationId:randomUUID(),data},clock);
 return {...f,remote,id,clock,get,notion,setup,save,advance:(n=100000)=>{at+=n;},fail:(mode:string)=>{failMode=mode;},duringQuery:(fn:()=>void)=>{onQuery=fn;},get queries(){return queries;},get patches(){return patches;},get gets(){return gets;}};
}
test('dry-run has zero writes and canonical IDs cannot duplicate across readers',async()=>{
 const f=fixture();const before=f.metrics.writes;const r=await dryRunTemplates(f.db,actor,undefined,f.notion);assert.equal(r.counts.new,1);assert.equal(f.metrics.writes,before);assert.equal(f.rows.size,0);
 assert.equal(templateKey(f.id),templateKey(f.id.toUpperCase().replace(/-/g,'')));await f.setup();assert.equal((await dryRunTemplates(f.db,actor,undefined,f.notion)).counts.unchanged,1);
});
test('initial pagination resumes, catches T0 edits, and readiness is not granted on the first page',async()=>{
 const f=fixture(25);const first=await importTemplateStep(f.db,actor,f.notion,f.clock);assert.equal(first.ready,false);assert.equal(first.counts.created,20);
 await assert.rejects(storedMessageTemplates(f.db,actor),/TEMPLATE_STORE_NOT_READY/);
 const p=f.remote.get(f.id);p.properties['유형'].title=[{plain_text:'이전 중 수정'}];p.last_edited_time=new Date(clockStart+1).toISOString();
 const second=await importTemplateStep(f.db,actor,f.notion,f.clock);assert.equal(second.phase,'catchup');assert.equal(second.ready,false);
 const third=await importTemplateStep(f.db,actor,f.notion,f.clock);assert.equal(third.ready,true);assert.equal(f.get().data.title,'이전 중 수정');assert.equal([...f.rows.keys()].filter(k=>k.startsWith(TEMPLATE_COLLECTION+'/')).length,25);
 const list=await templateManagementList(f.db,actor);assert.equal(list.records.length,20);assert.ok(list.cursor);assert.equal((await templateManagementList(f.db,actor,list.cursor)).records.length,5);
});
test('delta compares returned IDs only, does not rewrite unchanged template/history, and list never queries Notion',async()=>{
 const f=fixture(25);await f.setup();f.advance();f.resetMetrics();const queries=f.queries;
 await storedMessageTemplates(f.db,actor);await storedMessageTemplatePage(f.db,actor,f.id);assert.equal(f.queries,queries);
 f.resetMetrics();await importTemplateStep(f.db,actor,f.notion,f.clock);assert.equal(f.metrics.queries,0);assert.equal(f.metrics.writes,2);assert.equal(f.metrics.readDocuments,2); // Shared lease/checkpoint only: old remote timestamps excluded.
});
test('shared pull lease rejects concurrent runs and resumes after expiry',async()=>{
 const f=fixture();const all=await Promise.allSettled([importTemplateStep(f.db,actor,f.notion,f.clock),importTemplateStep(f.db,actor,f.notion,f.clock)]);assert.equal(all.filter(r=>r.status==='fulfilled').length,1);assert.match(String((all.find(r=>r.status==='rejected') as any).reason),/TEMPLATE_BUSY/);
 const state=f.rows.get(TEMPLATE_STATE+'/'+TEMPLATE_SOURCE);state.pullOwner='dead-worker';state.pullOwnerUntil=f.clock()+90000;await assert.rejects(importTemplateStep(f.db,actor,f.notion,f.clock),/TEMPLATE_BUSY/);f.advance();await importTemplateStep(f.db,actor,f.notion,f.clock);
});
test('failed commit does not advance checkpoint, replay neither loses nor duplicates imported rows',async()=>{
 const f=fixture();f.duringQuery(()=>{f.failNextCommit();f.duringQuery(()=>{});});await assert.rejects(importTemplateStep(f.db,actor,f.notion,f.clock),/FIRESTORE_UNAVAILABLE/);
 assert.equal(f.rows.has(TEMPLATE_COLLECTION+'/'+templateKey(f.id)),false);assert.equal(f.rows.get(TEMPLATE_STATE+'/'+TEMPLATE_SOURCE).phase,'initial');await f.setup();assert.equal(f.get().revision,1);
});
test('save atomically registers immutable job and history; duplicate intent is idempotent; stale/changed requests fail',async()=>{
 const f=fixture();await f.setup();const v={id:f.id,revision:1,operationId:randomUUID(),data:{title:'수정',body:'본문'}};
 await Promise.all([saveTemplate(f.db,actor,v,f.clock),saveTemplate(f.db,actor,v,f.clock)]);assert.equal(f.get().revision,2);assert.equal([...f.rows.keys()].filter(k=>k.startsWith(TEMPLATE_JOBS+'/')).length,1);
 await assert.rejects(saveTemplate(f.db,actor,{...v,data:{...v.data,body:'다름'}},f.clock),/TEMPLATE_REQUEST_CONFLICT/);
 await assert.rejects(saveTemplate(f.db,actor,{...v,operationId:randomUUID()},f.clock),/TEMPLATE_REVISION_CONFLICT/);
 assert.equal(f.patches,0);assert.equal([...f.rows.keys()].filter(k=>k.startsWith(TEMPLATE_HISTORY+'/')).length,2);
});
test('atomic save failure leaves old data and no job',async()=>{
 const f=fixture();await f.setup();f.failNextCommit();await assert.rejects(f.save(),/FIRESTORE_UNAVAILABLE/);assert.equal(f.get().revision,1);assert.equal([...f.rows.keys()].filter(k=>k.startsWith(TEMPLATE_JOBS+'/')).length,0);
});
for(const mode of ['lost-response','lost-commit'])test(`${mode}: app data stays and retry observes committed Notion value without a second PATCH`,async()=>{
 const f=fixture();await f.setup();await f.save();const job=f.get().pendingJobId;f.fail(mode);assert.equal(await processTemplateJob(f.db,job,f.notion,f.clock),'failed');assert.equal(f.get().data.title,'앱 제목');assert.equal(f.get().status,'failed');
 f.advance();assert.equal(await processTemplateJob(f.db,job,f.notion,f.clock),'done');assert.equal(f.patches,1);assert.equal(f.get().status,'synced');assert.equal(f.remote.get(f.id).properties['다른 속성'].rich_text[0].plain_text,'보존');
});
test('remote edit conflicts instead of last-arrival overwrite, and explicit app resolution is checked again',async()=>{
 const f=fixture();await f.setup();await f.save();const p=f.remote.get(f.id);p.properties['유형'].title=[{plain_text:'Notion 수정'}];p.last_edited_time=new Date(f.clock()).toISOString();
 assert.equal(await processTemplateJob(f.db,f.get().pendingJobId,f.notion,f.clock),'conflict');assert.equal(f.patches,0);assert.equal(f.get().data.title,'앱 제목');assert.equal(f.get().conflict.data.title,'Notion 수정');
 const row=f.get();await resolveTemplate(f.db,actor,{id:f.id,revision:row.revision,remoteHash:row.conflict.hash,choice:'app',operationId:randomUUID()},f.clock);
 p.properties['유형'].title=[{plain_text:'또 수정'}];assert.equal(await processTemplateJob(f.db,f.get().pendingJobId,f.notion,f.clock),'conflict');assert.equal(f.patches,0);
});
test('explicit Notion resolution imports captured value, cancels old job and is replay-safe',async()=>{
 const f=fixture();await f.setup();await f.save();const oldJob=f.get().pendingJobId;const p=f.remote.get(f.id);p.properties['유형'].title=[{plain_text:'외부 수정'}];p.last_edited_time=new Date(f.clock()).toISOString();await importTemplateStep(f.db,actor,f.notion,f.clock);
 const row=f.get(),input={id:f.id,revision:row.revision,remoteHash:row.conflict.hash,choice:'notion',operationId:randomUUID()};await resolveTemplate(f.db,actor,input,f.clock);await resolveTemplate(f.db,actor,input,f.clock);
 assert.equal(f.get().data.title,'외부 수정');assert.equal(f.get().status,'synced');assert.equal(await processTemplateJob(f.db,oldJob,f.notion,f.clock),'skipped');assert.equal(f.patches,0);
});
test('worker double execution, failed remote request and manual retry preserve app value',async()=>{
 const f=fixture();await f.setup();await f.save();const job=f.get().pendingJobId;f.fail('502');const results=await Promise.all([processTemplateJob(f.db,job,f.notion,f.clock),processTemplateJob(f.db,job,f.notion,f.clock)]);assert.ok(results.includes('skipped'));assert.ok(results.includes('failed'));assert.equal(f.patches,1);
 await retryTemplate(f.db,actor,f.id,f.clock);assert.equal((await processDueTemplates(f.db,f.notion,f.clock)).done,1);assert.equal(f.get().status,'synced');
});
test('expired running job is recovered; superseded revisions never patch',async()=>{
 const f=fixture();await f.setup();await f.save();const job=f.get().pendingJobId,r=f.rows.get(TEMPLATE_JOBS+'/'+job);Object.assign(r,{status:'running',leaseOwner:'stopped',leaseUntil:f.clock()+90000,nextAttemptAt:f.clock()+90000});
 assert.equal(await processTemplateJob(f.db,job,f.notion,f.clock),'skipped');f.advance();assert.equal(await processTemplateJob(f.db,job,f.notion,f.clock),'done');assert.equal(f.patches,1);
 await f.save({title:'2차',body:'내용'});const stale=f.get().pendingJobId;f.get().revision++;assert.equal(await processTemplateJob(f.db,stale,f.notion,f.clock),'skipped');assert.equal(f.patches,1);
});
test('reconciliation preserves inaccessible rows, detects explicit archive, and never hard-deletes',async()=>{
 const f=fixture();await f.setup();f.fail('404');const unknown=await reconcileTemplateStep(f.db,actor,f.notion,f.clock);assert.equal(unknown.counts.unknown,1);assert.equal(f.get().data.archived,false);assert.equal(f.get().sourceWarning,'NOTION_404');
 f.fail('');f.remote.get(f.id).archived=true;await reconcileTemplateStep(f.db,actor,f.notion,f.clock);assert.equal(f.get().data.archived,true);assert.equal((await storedMessageTemplates(f.db,actor)).length,0);assert.ok(f.get());
});
test('history selective restore makes a new revision/job and rejects stale/cross-source history',async()=>{
 const f=fixture();await f.setup();await f.save();await processTemplateJob(f.db,f.get().pendingJobId,f.notion,f.clock);const history=await templateHistory(f.db,actor,f.id);assert.equal(history.records.length,2);
 const before=f.get().revision;await restoreTemplate(f.db,actor,{id:f.id,revision:before,historyRevision:1,operationId:randomUUID()});assert.equal(f.get().revision,before+1);assert.equal(f.get().data.title,'안내 1');assert.equal(f.get().status,'pending');assert.equal(f.patches,1);
 await assert.rejects(restoreTemplate(f.db,actor,{id:f.id,revision:before,historyRevision:1,operationId:randomUUID()}),/TEMPLATE_REVISION_CONFLICT/);
});
test('permissions and source schema checks precede reads/writes, action injection is rejected',async()=>{
 const f=fixture();for(const a of [{...actor,admin:false},{...actor,academyId:'other'}]){await assert.rejects(dryRunTemplates(f.db,a,undefined,f.notion),/FORBIDDEN/);await assert.rejects(importTemplateStep(f.db,a,f.notion,f.clock),/FORBIDDEN/);}assert.equal(f.queries,0);assert.equal(f.rows.size,0);
 await assert.rejects(templateAction(f.db,actor,{action:'template-import-step',confirmed:true,databaseId:TEMPLATE_DATABASE}));
 const p=structuredClone(f.remote.get(f.id));p.parent.database_id=f.id;assert.throws(()=>templatePage(p),/TEMPLATE_SOURCE_MISMATCH/);p.parent.database_id=TEMPLATE_DATABASE;p.properties['내용(문자본문)'].has_more=true;assert.throws(()=>templatePage(p),/TEMPLATE_SCHEMA_REQUIRED/);
});
test('worker requires explicit enable and long secret; pilot sources/journals are denied to clients and indexed selectively',()=>{
 const enabled=process.env.MESSAGE_TEMPLATE_SYNC_ENABLED,secret=process.env.MESSAGE_TEMPLATE_WORKER_SECRET;
 try{delete process.env.MESSAGE_TEMPLATE_SYNC_ENABLED;assert.throws(()=>authorizeTemplateWorker('x'),/TEMPLATE_WORKER_DISABLED/);process.env.MESSAGE_TEMPLATE_SYNC_ENABLED='true';process.env.MESSAGE_TEMPLATE_WORKER_SECRET='x'.repeat(40);assert.throws(()=>authorizeTemplateWorker('y'.repeat(40)),/FORBIDDEN/);authorizeTemplateWorker('x'.repeat(40));}finally{enabled===undefined?delete process.env.MESSAGE_TEMPLATE_SYNC_ENABLED:process.env.MESSAGE_TEMPLATE_SYNC_ENABLED=enabled;secret===undefined?delete process.env.MESSAGE_TEMPLATE_WORKER_SECRET:process.env.MESSAGE_TEMPLATE_WORKER_SECRET=secret;}
 const rules=readFileSync('firestore.rules','utf8');for(const collection of [TEMPLATE_COLLECTION,TEMPLATE_JOBS,TEMPLATE_STATE,TEMPLATE_HISTORY])assert.ok(rules.includes(`match /${collection}/{id} { allow read, write: if false; }`));
 const indexes=JSON.parse(readFileSync('firestore.indexes.json','utf8'));assert.ok(indexes.indexes.some((i:any)=>i.collectionGroup===TEMPLATE_JOBS));assert.ok(indexes.fieldOverrides.some((i:any)=>i.collectionGroup===TEMPLATE_COLLECTION&&i.fieldPath==='data'&&i.indexes.length===0));
});
test('minute worker drains only unfinished daily/manual imports; idle recovery makes zero Notion requests',async()=>{
 const f=fixture(105);const first=await runTemplateWorker(f.db,{mode:'pull'},f.notion,f.clock);assert.equal(first.pull.continue,true);assert.equal(f.rows.get(TEMPLATE_STATE+'/'+TEMPLATE_SOURCE).ready,undefined);
 const second=await runTemplateWorker(f.db,{mode:'push'},f.notion,f.clock);assert.equal(second.pull.ready,true);const before=f.queries;const idle=await runTemplateWorker(f.db,{mode:'push'},f.notion,f.clock);assert.equal(idle.pull,null);assert.equal(f.queries,before);
});
test('changing/reverting remote conflict updates its captured value and keeps both sides in history',async()=>{
 const f=fixture();await f.setup();await f.save();const p=f.remote.get(f.id);p.properties['유형'].title=[{plain_text:'원본 수정'}];p.last_edited_time=new Date(f.clock()).toISOString();await importTemplateStep(f.db,actor,f.notion,f.clock);
 const revision=f.get().revision;p.properties['유형'].title=[{plain_text:'안내 1'}];await importTemplateStep(f.db,actor,f.notion,f.clock);assert.equal(f.get().revision,revision+1);assert.equal(f.get().status,'conflict');assert.equal(f.get().conflict.data.title,'안내 1');
 assert.ok([...f.rows.entries()].filter(([key])=>key.startsWith(TEMPLATE_HISTORY+'/')).some(([,row])=>row.remote?.data?.title==='원본 수정'));
});
test('Notion failure does not prevent another app edit; new revision supersedes queued old intent',async()=>{
 const f=fixture();await f.setup();await f.save();const oldJob=f.get().pendingJobId;f.fail('502');await processTemplateJob(f.db,oldJob,f.notion,f.clock);
 await f.save({title:'최신 앱 제목',body:'새 본문'});assert.equal(f.rows.get(TEMPLATE_JOBS+'/'+oldJob).status,'superseded');assert.equal(f.get().data.title,'최신 앱 제목');
 assert.equal(await processTemplateJob(f.db,oldJob,f.notion,f.clock),'skipped');await processTemplateJob(f.db,f.get().pendingJobId,f.notion,f.clock);assert.equal(f.get().status,'synced');assert.equal(f.get().data.title,'최신 앱 제목');
});
