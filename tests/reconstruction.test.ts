import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportCache } from '../src/lib/studentReportCache.ts';
import { lessonDraftSchema, continuation } from '../api/_lib/teacherWorkspacePolicy.ts';
import { newGridLesson } from '../src/lib/teacherLessonGrid.ts';

test('report cache deduplicates both views, isolates users, expires, and retries failures', async () => {
  let now=100, calls=0;
  const cache=createReportCache(()=>now,30);
  const fetcher=async()=>{calls++;return {count:calls};};
  const [a,b]=await Promise.all([cache.read('a','reports',fetcher),cache.read('a','reports',fetcher)]);
  assert.deepEqual(a,b); assert.equal(calls,1);
  await cache.read('b','reports',fetcher); assert.equal(calls,2);
  now=140;await cache.read('a','reports',fetcher);assert.equal(calls,3);
  await assert.rejects(cache.read('a','bad',async()=>{throw Error('offline');}));
  assert.equal(await cache.read('a','bad',async()=>42),42);
});
test('an invalidated in-flight response never repopulates the cache',async()=>{
  const cache=createReportCache();let resolve!:(n:number)=>void;
  const old=cache.read('a','reports',()=>new Promise<number>(r=>resolve=r));
  cache.invalidate('a');assert.equal(await cache.read('a','reports',async()=>2),2);
  resolve(1);await old;assert.equal(await cache.read('a','reports',async()=>3),2);
});



test('optional tests remain independent, distinguish zero, and reset on continuation',()=>{
  const base=newGridLesson('11111111-1111-4111-8111-111111111111','수학','2026-10-03','14:00','15:30');
  assert.ok(lessonDraftSchema.safeParse(base).success);
  const data=lessonDraftSchema.parse({...base,correct:0,total:20,examCorrect:18,examTotal:20});
  assert.equal(data.correct,0);assert.equal(data.total,20);assert.equal(data.examCorrect,18);assert.equal(data.examTotal,20);
  assert.equal(lessonDraftSchema.safeParse({...base,examCorrect:3}).success,false);
  assert.equal(lessonDraftSchema.safeParse({...base,examCorrect:21,examTotal:20}).success,false);
  assert.equal(continuation(data).examCorrect,null);
});
