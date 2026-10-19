import test from 'node:test';
import assert from 'node:assert/strict';
import {templateFirestore} from './helpers/templateFirestore.js';
import {AI_BURST,takeAiBurst} from '../api/_lib/aiModel.js';

test('/api/gemini has no open model proxy: only workbook, pet and passage tasks; anything else is 404', async () => {
 const {default: handler} = await import('../api/gemini.js');
 for (const url of ['/api/gemini', '/api/gemini?task=analyzer&stream=1', '/api/gemini?task=generator']) {
  let status = 0, out: any = null;
  const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, set statusCode(v: number) { status = v; }, get statusCode() { return status; }};
  await handler({method: 'POST', url, headers: {authorization: 'Bearer kid'}} as any, res);
  assert.deepEqual([status, out.error], [404, 'NOT_FOUND'], url);
 }
});

test('AI monthly count: used up at the limit, reset by the admin only, listed with names', async () => {
 const {AI_MONTHLY_LIMITS, readAiMonthly, resetAiMonthly, takeMonthlyQuota} = await import('../api/_lib/aiModel.js');
 const {registrationFirestore} = await import('./helpers/registrationFirestore.js');
 const f = registrationFirestore();
 assert.equal(await takeMonthlyQuota(f.db, 'kid', 'analyzer'), AI_MONTHLY_LIMITS.analyzer - 1);
 const month = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul'}).format(new Date()).slice(0, 7);
 f.rows.set(`aiMonthly/kid_${month}`, {uid: 'kid', month, analyzer: AI_MONTHLY_LIMITS.analyzer});
 assert.ok(await takeMonthlyQuota(f.db, 'kid', 'analyzer') < 0, 'used up');
 await assert.rejects(() => resetAiMonthly(f.db, {admin: false, academyId: 'main'}, {uid: 'kid'}), /FORBIDDEN/);
 await resetAiMonthly(f.db, {admin: true, academyId: 'main'}, {uid: 'kid'});
 assert.equal(await takeMonthlyQuota(f.db, 'kid', 'analyzer'), AI_MONTHLY_LIMITS.analyzer - 1, 'reset by the admin: usable again');
 f.rows.set('users/kid', {name: '김하늘', role: 'student'});
 const list = await readAiMonthly(f.db, {admin: true, academyId: 'main'});
 assert.deepEqual(list.rows.map((r: any) => [r.name, r.analyzer]), [['김하늘', 1]]);
});

test('AI short-time guard: 20 in 10 minutes for one account, atomic under parallel requests; a new window after 10 minutes; others unaffected',async()=>{
 const f=templateFirestore(),t0=Date.parse('2026-10-18T01:00:00Z');
 const results=await Promise.all(Array.from({length:AI_BURST.limit+5},()=>takeAiBurst(f.db,'kid',t0)));
 assert.equal(results.filter(r=>r.ok).length,AI_BURST.limit,'exactly the limit passes, however many come at once');
 const late=await takeAiBurst(f.db,'kid',t0+AI_BURST.windowMs-30_000);
 assert.deepEqual([late.ok,late.retryAfter],[false,30]);
 assert.equal((await takeAiBurst(f.db,'other',t0)).ok,true,'another account has its own');
 assert.equal((await takeAiBurst(f.db,'kid',t0+AI_BURST.windowMs)).ok,true,'a new window');
});

test('AI short-time guard: a transaction given up under contention is "try again shortly"; any other failure stays an error',async()=>{
 const at=Date.parse('2026-10-18T01:00:00Z'),aborted:any={collection:()=>({doc:()=>({})}),runTransaction:async()=>{throw Object.assign(Error('10 ABORTED: Too much contention'),{code:10});}};
 assert.deepEqual(await takeAiBurst(aborted,'kid',at),{ok:false,retryAfter:5});
 const f=templateFirestore();f.failNextCommit();
 await assert.rejects(takeAiBurst(f.db,'kid',at),/FIRESTORE_UNAVAILABLE/,'not shown as too fast');
});
