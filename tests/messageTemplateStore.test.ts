import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {templateFirestore} from './helpers/templateFirestore.js';
import {TEMPLATE_DATABASE,TEMPLATE_SOURCE,TEMPLATE_COLLECTION,TEMPLATE_STATE,TEMPLATE_HISTORY,templateKey,saveTemplate,templateHistory,restoreTemplate,storedMessageTemplates} from '../api/_lib/messageTemplateStore.js';
import {templateAppActive} from '../api/_lib/messageTemplateAuthority.js';
import {templateAction} from '../api/_lib/messageTemplateActions.js';

/* Templates are app-only: they were imported once from Notion and now live in messageTemplateSources. */
const actor={uid:'admin',admin:true,academyId:'main'},id='11111111-1111-4111-8111-000000000001';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function fixture(appOnly=true){
 const f=templateFirestore(),data={title:'안내 1',body:'{{학생명}} 본문',target:'보호자',archived:false};
 f.rows.set(TEMPLATE_COLLECTION+'/'+templateKey(id),{sourceKey:TEMPLATE_SOURCE,academyId:'main',databaseId:TEMPLATE_DATABASE,notionPageId:id,data,dataHash:hash(data),syncedHash:hash(data),revision:1,status:'synced',pendingJobId:null,conflict:null,error:null,updatedAt:1});
 f.rows.set(TEMPLATE_STATE+'/'+TEMPLATE_SOURCE,{ready:true});
 if(appOnly){f.rows.set('messageTemplateVerificationRuns/run-1',{verified:true,hash:'verified'});f.rows.set('messageTemplateAuthority/main',{active:true,schemaVersion:1,verifiedRunId:'run-1',verificationHash:'verified'});}
 const get=()=>f.rows.get(TEMPLATE_COLLECTION+'/'+templateKey(id));
 return {...f,get,save:(data:any,operationId=randomUUID(),revision=get().revision)=>saveTemplate(f.db,actor,{id,revision,operationId,data})};
}
function noNetwork(){const original=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>{calls++;throw Error('NETWORK');}) as any;return {restore:()=>{globalThis.fetch=original;},get calls(){return calls;}};}

test('saving is final in one transaction with history; the same operation is idempotent; stale revisions fail',async()=>{
 const f=fixture(),net=noNetwork();
 try{
  const op=randomUUID(),saved=await f.save({title:'앱 제목',body:'앱 본문'},op);
  assert.equal(saved.status,'app');assert.equal(f.get().revision,2);assert.equal(f.get().data.title,'앱 제목');assert.equal(f.get().data.target,'보호자');
  assert.ok(f.rows.has(TEMPLATE_HISTORY+'/'+templateKey(id)+':2'));
  assert.equal((await f.save({title:'앱 제목',body:'앱 본문'},op,1)).revision,2,'replay of the same operation');
  await assert.rejects(f.save({title:'다른 값',body:'x'},op,1),/TEMPLATE_REQUEST_CONFLICT/);
  await assert.rejects(f.save({title:'오래된 화면',body:'x'},randomUUID(),1),/TEMPLATE_REVISION_CONFLICT/);
  const listed:any=await templateAction(f.db,actor,{action:'template-list'});assert.equal(listed.records[0].title,'앱 제목');assert.equal(listed.appOnly,true);
  assert.deepEqual((await storedMessageTemplates(f.db,actor)).map((t:any)=>t.title),['앱 제목']);
  assert.equal(net.calls,0);
 }finally{net.restore();}
});
test('history restore makes a new final revision and rejects stale requests',async()=>{
 const f=fixture();
 await f.save({title:'두 번째',body:'본문 2'});await f.save({title:'세 번째',body:'본문 3'});
 const history=await templateHistory(f.db,actor,id);assert.deepEqual(history.records.map((r:any)=>r.revision),[3,2]);
 await restoreTemplate(f.db,actor,{id,revision:3,historyRevision:2,operationId:randomUUID()});
 assert.equal(f.get().revision,4);assert.equal(f.get().data.title,'두 번째');assert.equal(f.get().status,'app');
 await assert.rejects(restoreTemplate(f.db,actor,{id,revision:3,historyRevision:2,operationId:randomUUID()}),/TEMPLATE_REVISION_CONFLICT/);
});
test('without the app switch nothing is queued for Notion; the save is refused and nothing changes',async()=>{
 const f=fixture(false),before=JSON.stringify([...f.rows]);
 await assert.rejects(f.save({title:'앱 제목',body:'앱 본문'}),/TEMPLATE_APP_REQUIRED/);
 assert.equal(JSON.stringify([...f.rows]),before);
});
test('only admins of the academy write; the removed import/sync actions are rejected; a hand-made switch is ignored',async()=>{
 const f=fixture();
 for(const a of [{...actor,admin:false},{...actor,academyId:'other'}])await assert.rejects(saveTemplate(f.db,a,{id,revision:1,operationId:randomUUID(),data:{title:'x',body:'y'}}),/FORBIDDEN/);
 for(const action of ['template-dry-run','template-import-step','template-reconcile-step','template-retry','template-resolve','template-cutover','template-cutover-status','template-cutover-deactivate'])
  await assert.rejects(templateAction(f.db,actor,{action,confirmed:true}),/INVALID_INPUT/);
 assert.equal(await templateAppActive(f.db),true);
 f.rows.set('messageTemplateAuthority/main',{active:true,schemaVersion:1,verifiedRunId:'forged',verificationHash:'x'});
 assert.equal(await templateAppActive(f.db),false);
});
