import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMigrationArgs,setupErrorCode} from '../scripts/offline-migrate.js';
test('setup failures name their cause without exposing configuration values',()=>{
 assert.equal(setupErrorCode(Object.assign(Error('Credential ... client@example.iam.gserviceaccount.com'),{errorInfo:{code:'auth/insufficient-permission'}})),'AUTH_INSUFFICIENT_PERMISSION');
 assert.equal(setupErrorCode(Error('CONFIG_ERROR: Required Firebase Admin configuration is incomplete.')),'CONFIG_ERROR');
 assert.equal(setupErrorCode(Error('MIGRATION_CONFIG_REQUIRED')),'MIGRATION_CONFIG_REQUIRED');
 assert.equal(setupErrorCode(Error('something with a secret ntn_abc')),'MIGRATION_FAILED');
});
import {configureMigrationBatch,migrationBatchSize,migrationReadOnlyTransport} from '../api/_lib/migrationTransport.js';
import {runOfflineMigration} from '../api/_lib/offlineMigration.js';
import {dryRunLessonPage,lessonMigrationCutoff} from '../api/_lib/lessonMigration.js';
import {templateFirestore} from './helpers/templateFirestore.js';
import {fixture,fakeNotion,page,admin} from './helpers/lessonMigrationFixture.js';
test('offline tool is read-only by default and apply requires explicit target confirmation',()=>{
 assert.equal(parseMigrationArgs([]).apply,false);assert.throws(()=>parseMigrationArgs(['--apply']),/APPLY_CONFIRM_REQUIRED/);
 assert.throws(()=>parseMigrationArgs(['--batch','101']),/INVALID_BATCH_SIZE/);
 assert.equal(parseMigrationArgs(['--apply','--confirm','--project','p','--database','d']).apply,true);
});
test('batch size is scoped to one transport, never a global server change',()=>{
 const a=async()=>{},b=async()=>{};configureMigrationBatch(a,100);
 assert.equal(migrationBatchSize(a,20),100);assert.equal(migrationBatchSize(b,20),20);
});
test('read-only transport blocks every source mutation and serializes independent calls',async()=>{
 let active=0,max=0,calls=0;const base=async()=>{calls++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,2));active--;return {};};
 const n=migrationReadOnlyTransport(base,0);await Promise.all([n('databases/db/query','POST',{}),n('pages/id')]);
 assert.equal(max,1);await assert.rejects(n('pages/id','PATCH',{}),/NOTION_WRITE_DISABLED/);assert.equal(calls,2);
});
test('template offline dry-run performs zero writes and accepts a larger opt-in query',async()=>{
 const f=templateFirestore();let size=0;const n=configureMigrationBatch(async(path:string,method?:string,body?:any)=>{size=body.page_size;return {results:[],has_more:false};},100);
 const result=await runOfflineMigration(f.db,admin,{apply:false,kinds:['templates'],notion:n});
 assert.equal(size,100);assert.equal(f.metrics.writes,0);assert.equal(result.activation,false);assert.equal(result.results[0].status,'checked');
});
test('lesson offline preview excludes pre-September-20 rows and never creates jobs or holds',async()=>{
 const f=fixture([]),n=fakeNotion([page(1,{date:'2026-09-19T14:00:00+09:00'}),page(2,{date:'2026-09-20T14:00:00+09:00',sent:false})]);
 const before=lessonMigrationCutoff.since;lessonMigrationCutoff.since='2026-09-20';
 try{f.resetMetrics();const r=await dryRunLessonPage(f.db,admin,{},n.notion);
 assert.equal(r.counts.excluded,1);assert.equal(f.metrics.writes,0);assert.equal(r.since,'2026-09-20');}finally{lessonMigrationCutoff.since=before;}
});

import {startLessonMigration,acknowledgeLessonMigrationHoldGroup} from '../api/_lib/lessonMigration.js';
import {drain} from './helpers/lessonMigrationFixture.js';
test('lesson offline preview honours decisions already made (keep in Notion only), still with zero writes',async()=>{
 const f=fixture([page(1,{students:[],sent:false})]);
 await startLessonMigration(f.db,admin,{confirmed:true,mode:'full'});await drain(f);
 const first=await dryRunLessonPage(f.db,admin,{},f.notion);assert.equal(first.counts.STUDENT_LINK_MISSING,1);
 await acknowledgeLessonMigrationHoldGroup(f.db,admin,{code:'STUDENT_LINK_MISSING',confirmed:true});
 f.resetMetrics();const after=await dryRunLessonPage(f.db,admin,{},f.notion);
 assert.equal(after.counts.STUDENT_LINK_MISSING,undefined);assert.equal(after.counts.excluded,1);assert.equal(f.metrics.writes,0);
});

test('offline driver retries temporary failures with bounded backoff without exposing error details',async()=>{
 const f=templateFirestore();let attempts=0;const waits:number[]=[];
 const n=async()=>{if(attempts++<2)throw Error('NOTION_503');return {results:[],has_more:false};};
 const r=await runOfflineMigration(f.db,admin,{apply:false,kinds:['templates'],notion:n,wait:async(ms)=>{waits.push(ms);}});
 assert.equal(r.results[0].status,'checked');assert.deepEqual(waits,[1000,3000]);assert.equal(f.metrics.writes,0);
});
