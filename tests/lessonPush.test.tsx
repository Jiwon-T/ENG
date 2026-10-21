import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lessonPushBody, lessonPushChoice} from '../src/lib/lessonPush';
import {sendLessonPush, sendMakeupMorning, sendToTokens} from '../api/_lib/pushSend';
import {pushTokenId} from '../api/_lib/pushTokens';
import {hashStudentKey} from '../api/_lib/security';

const K = '11111111-1111-4111-8111-111111111111', T1 = 'device-one-'.padEnd(40, 'a'), T2 = 'device-two-'.padEnd(40, 'b');
function memoryDb() {
  const rows = new Map<string, any>();
  const doc = (path: string) => ({get: async () => ({exists: rows.has(path), data: () => rows.get(path)}), delete: async () => { rows.delete(path); }});
  const docsOf = (name: string, pred: (v: any) => boolean) => [...rows].filter(([p, v]) => p.split('/')[0] === name && pred(v)).map(([p, v]) => ({id: p.split('/')[1], data: () => v}));
  const db = {collection: (name: string) => ({doc: (id: string) => doc(`${name}/${id}`),
    where: (key: string, _op: string, value: any) => { const q = {get: async () => ({docs: docsOf(name, v => v[key] === value)}), limit: () => q}; return q; }})};
  rows.set(`notionStudentMappings/${hashStudentKey(K)}`, {sourceMode: 'firestore', studentKey: K, firebaseUid: 's1'});
  for (const t of [T1, T2]) rows.set(`pushTokens/${pushTokenId(t)}`, {uid: 's1', token: t});
  return {rows, db};
}
const fakeMessaging = (gone: string[] = []) => { const sent: any[] = []; return {sent, sendEachForMulticast: async (m: any) => { sent.push(m); return {successCount: m.tokens.filter((t: string) => !gone.includes(t)).length, responses: m.tokens.map((t: string) => gone.includes(t) ? {success: false, error: {code: 'messaging/registration-token-not-registered'}} : {success: true})}; }}; };

test('과제 알림 체크: only with a 과제; on for a first 반영 or a changed 과제, off when it is the same (or unknown from before)', () => {
  assert.equal(lessonPushChoice({assignment: '  '}), null, 'no 과제: no checkbox');
  assert.deepEqual(lessonPushChoice({assignment: 'p.12'}), {kind: 'new', on: true, hint: '"새 과제가 있어요"'});
  assert.deepEqual(lessonPushChoice({assignment: 'p.12'}, {stage: 'draft'}), {kind: 'new', on: true, hint: '"새 과제가 있어요"'}, 'saved, never published');
  const changed = lessonPushChoice({assignment: 'p.13'}, {stage: 'published', appPublishedRevision: 3, publishedAssignment: 'p.12'})!;
  assert.deepEqual([changed.kind, changed.on], ['changed', true]);
  const same = lessonPushChoice({assignment: ' p.12 '}, {stage: 'draft', appPublishedRevision: 3, publishedAssignment: 'p.12'})!;
  assert.deepEqual([same.kind, same.on, same.hint], ['again', false, '과제가 그대로라 꺼 두었어요']);
  const before = lessonPushChoice({assignment: 'p.12'}, {stage: 'published', appPublishedRevision: 3})!;
  assert.deepEqual([before.kind, before.on], ['changed', false], 'published before 2단계: off until the teacher says');
  assert.equal(lessonPushBody({subject: '영어', date: '2026-10-21'}), '영어 10/21 수업 · 눌러서 확인');
});

test('과제 알림 보내기: data-only to the student\'s devices, one tag per lesson; a token FCM no longer knows is removed', async () => {
  const {rows, db} = memoryDb(), m = fakeMessaging([T2]);
  assert.equal(await sendLessonPush(db, {studentKey: K, subject: '영어', date: '2026-10-21', assignment: 'p.12'}, 'L1', 'changed', m), 1);
  assert.deepEqual(m.sent[0].data, {title: '과제가 바뀌었어요', body: '영어 10/21 수업 · 눌러서 확인', tag: 'lesson-L1', link: '/'});
  assert.deepEqual(m.sent[0].tokens.sort(), [T1, T2].sort());
  assert.equal(rows.has(`pushTokens/${pushTokenId(T2)}`), false, 'the gone token');
  assert.equal(rows.has(`pushTokens/${pushTokenId(T1)}`), true);
  assert.equal(await sendLessonPush(db, {studentKey: K, assignment: ''}, 'L1', 'new', m), 0, 'no 과제: nothing');
  assert.equal(await sendToTokens(db, [], {title: 'x', body: 'y', tag: 'z'}, m), 0);
  const src = readFileSync(new URL('../api/teacher/workspace.ts', import.meta.url), 'utf8');
  assert.match(src, /isLessonPushKind\(body\.notify\)&&!result\.alreadyPublished\?await .*sendLessonPush\(db,current\.data,id,body\.notify\)\.catch\(\(\)=>0\):0/, 'sent with the 반영, never failing it');
});

test('보강 아침 알림: today\'s published, not cancelled 보강 only, at 08:00 KST (23:00 UTC)', async () => {
  const {rows, db} = memoryDb(), m = fakeMessaging();
  rows.set('studentSchedules/a', {scheduleType: '보강', status: '예정', studentKey: K, subject: '영어', startAt: '2026-10-22T17:00:00+09:00', endAt: '2026-10-22T18:20:00+09:00'});
  rows.set('studentSchedules/b', {scheduleType: '보강', status: '취소', studentKey: K, startAt: '2026-10-22T19:00:00+09:00'});
  rows.set('studentSchedules/c', {scheduleType: '보강', status: '예정', studentKey: K, startAt: '2026-10-23T17:00:00+09:00'});
  rows.set('studentSchedules/d', {scheduleType: '정규', status: '예정', studentKey: K, startAt: '2026-10-22T15:00:00+09:00'});
  assert.deepEqual(await sendMakeupMorning(db, '2026-10-22', m), {makeups: 1, sent: 2});
  assert.deepEqual(m.sent[0].data, {title: '오늘 보강이 있어요', body: '영어 · 오늘 17:00–18:20', tag: 'makeup-a', link: '/'});
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(vercel.crons.some((c: any) => c.path === '/api/cron/makeup-push' && c.schedule === '0 23 * * *'));
  assert.ok(vercel.rewrites.some((r: any) => r.source === '/api/cron/makeup-push' && r.destination === '/api/teacher/workspace?__cron=makeup-push'));
});
