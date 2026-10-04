import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadCache,teacherReadKey,pageRows,pageNumber,teacherReadCache,invalidateTeacherMutation} from '../api/_lib/teacherReadCache.ts';
import {teacherCachedRead,teacherCacheRead,clearTeacherReads} from '../src/lib/teacherReadCache.ts';
test('private snapshot cache deduplicates concurrent loads, supports refresh and retries failures',async()=>{
 const cache=createReadCache();let calls=0;
 const load=async()=>++calls;
 assert.deepEqual(await Promise.all([cache.get('a',load),cache.get('a',load)]),[1,1]);
 assert.equal(await cache.get('a',load,true),2);
 await assert.rejects(cache.get('failed',async()=>{throw Error('offline');}));
 assert.equal(await cache.get('failed',async()=>3),3);
});
test('clearing while a read is pending prevents it from repopulating the cache',async()=>{
 const cache=createReadCache();let resolve!:(n:number)=>void;
 const pending=cache.get('a',()=>new Promise<number>(r=>resolve=r));await Promise.resolve();
 cache.clear();resolve(1);await pending;
 assert.equal(await cache.get('a',async()=>2),2);
});
test('cache keys isolate users, academies, role and current subject permissions',()=>{
 const actor={uid:'teacher',academyId:'main',admin:false,principal:false,scopes:[{studentKey:'student',subject:'영어'}]};
 const key=teacherReadKey(actor,'academic');
 for(const patch of [{uid:'other'},{academyId:'other'},{admin:true},{principal:true},{scopes:[]},{readAccessKey:'new-notion-teacher'}])assert.notEqual(teacherReadKey({...actor,...patch},'academic'),key);
});
test('snapshot expiry and memory capacity bound reuse',async()=>{
 const expired=createReadCache(-1);assert.equal(await expired.get('x',async()=>1),1);assert.equal(await expired.get('x',async()=>2),2);
 const cache=createReadCache(60000,1);await cache.get('a',async()=>1);await cache.get('b',async()=>2);assert.equal(await cache.get('a',async()=>3),3);
});
test('draft saves invalidate only changed local lists, leaving remote grade sources cached',async()=>{
 teacherReadCache.clear();const actor={uid:'teacher',scopes:[]};
 await teacherReadCache.get(teacherReadKey(actor,'academic-source'),async()=>1);
 await teacherReadCache.get(teacherReadKey(actor,'draft-summaries'),async()=>1);
 invalidateTeacherMutation('save-draft');
 assert.equal(await teacherReadCache.get(teacherReadKey(actor,'academic-source'),async()=>2),1);
 assert.equal(await teacherReadCache.get(teacherReadKey(actor,'draft-summaries'),async()=>2),2);
 invalidateTeacherMutation('publish');assert.equal(await teacherReadCache.get(teacherReadKey(actor,'academic-source'),async()=>3),3);teacherReadCache.clear();
});
test('server paging clamps stale pages, respects fixed page size and rejects malformed page numbers',()=>{
 const rows=Array.from({length:25},(_,i)=>i);
 assert.deepEqual(pageRows(rows,2,10),{records:[10,11,12,13,14,15,16,17,18,19],total:25,page:2,pages:3});
 assert.equal(pageRows(rows,99,12).page,3);assert.deepEqual(pageRows([],1,5),{records:[],total:0,page:1,pages:1});
 for(const input of ['-1','0','1.2','NaN','100001'])assert.throws(()=>pageNumber(input),/INVALID_INPUT/);
});
test('browser cache clears on account changes and never crosses resource keys',()=>{
 clearTeacherReads();teacherCacheRead('one','lessons:1',{records:['private']});assert.deepEqual(teacherCachedRead('one','lessons:1'),{records:['private']});
 assert.equal(teacherCachedRead('one','lessons:2'),undefined);assert.equal(teacherCachedRead('two','lessons:1'),undefined);assert.equal(teacherCachedRead('one','lessons:1'),undefined);clearTeacherReads();
});

test('late browser responses cannot refill invalidated caches and unrelated lists survive draft saves',async()=>{
 const {teacherReadGeneration,invalidateTeacherReads}=await import('../src/lib/teacherReadCache.ts');
 clearTeacherReads();teacherCacheRead('one','academic-records:1',{records:['grade']});const generation=teacherReadGeneration();
 invalidateTeacherReads('save-draft');teacherCacheRead('one','drafts-page:1',{records:['stale']},generation);
 assert.equal(teacherCachedRead('one','drafts-page:1'),undefined);assert.deepEqual(teacherCachedRead('one','academic-records:1'),{records:['grade']});clearTeacherReads();
});
