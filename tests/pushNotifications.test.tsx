import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {PUSH_TOKENS, pushTokenId, pushTokensOf, savePushToken} from '../api/_lib/pushTokens';
import {homePushView, pushCardDismissed, dismissPushCard, pushState, WEB_PUSH_KEY} from '../src/lib/pushNotifications';
import {PushHomeToggle, PushMenuRow} from '../src/components/PushOptIn';

function memoryDb() {
  const rows = new Map<string, any>();
  const doc = (path: string) => ({get: async () => ({exists: rows.has(path), data: () => rows.get(path)}), set: async (v: any) => { rows.set(path, structuredClone(v)); }, delete: async () => { rows.delete(path); }});
  const db = {collection: (name: string) => ({doc: (id: string) => doc(`${name}/${id}`),
    where: (key: string, _op: string, value: any) => ({limit: () => ({get: async () => ({docs: [...rows].filter(([p, v]) => p.startsWith(`${name}/`) && v[key] === value).map(([, v]) => ({data: () => v}))})})})})};
  return {rows, db};
}
const TOKEN = 'fcm-token-'.padEnd(60, 'x');

test('과제·보강 알림 1단계: a device token is saved for the account (by its hash), moves to another account on a shared phone, and off removes only your own', async () => {
  const {rows, db} = memoryDb();
  rows.set('users/s1', {role: 'student'}); rows.set('users/s2', {role: 'student'});
  assert.deepEqual(await savePushToken(db, 's1', {token: TOKEN, on: true}, 5), {on: true});
  const path = `${PUSH_TOKENS}/${pushTokenId(TOKEN)}`;
  assert.deepEqual(rows.get(path), {uid: 's1', token: TOKEN, role: 'student', updatedAt: 5});
  assert.ok(!path.includes(TOKEN), 'the token is not the document id');
  assert.deepEqual(await pushTokensOf(db, 's1'), [TOKEN]);
  await savePushToken(db, 's2', {token: TOKEN, on: true}, 6);
  assert.deepEqual([await pushTokensOf(db, 's1'), await pushTokensOf(db, 's2')], [[], [TOKEN]], 'a shared phone: the last account');
  await savePushToken(db, 's1', {token: TOKEN, on: false});
  assert.equal(rows.has(path), true, 'another account cannot turn it off');
  await savePushToken(db, 's2', {token: TOKEN, on: false});
  assert.equal(rows.has(path), false);
  await assert.rejects(() => savePushToken(db, 's1', {token: 'short', on: true}));
  await assert.rejects(() => savePushToken(db, 'nobody', {token: TOKEN, on: true}), /USER_NOT_FOUND/);
});

test('과제·보강 알림: the home line where this device can turn it on, the menu row everywhere; the service worker shows pushes and opens the app', () => {
  assert.match(WEB_PUSH_KEY, /^B[A-Za-z0-9_-]{80,}$/, 'the public web push key');
  assert.equal(pushState('s1'), 'unsupported');
  assert.equal(pushState('s1', 'key'), 'unsupported', 'not the installed app');
  assert.equal(renderToStaticMarkup(<PushHomeToggle uid="s1" pushKey="key" />), '', 'the home line: nothing where push cannot work')
  // 내 메뉴: shown in a browser tab too (like the teacher's 학생 학습 알림), saying when this device cannot get alerts
  const row = renderToStaticMarkup(<PushMenuRow uid="s1" pushKey="key" />);
  assert.match(row, /과제·보강 알림/); assert.match(row, /이 기기에서는 받을 수 없어요|홈 화면에 추가한 앱/); assert.match(row, /aria-checked="false"[^>]*disabled/);
  assert.equal(renderToStaticMarkup(<PushMenuRow uid="s1" pushKey="" />), '', 'no web push key: nothing');
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /self\.addEventListener\('push'/);
  assert.match(sw, /tag: data\.tag \|\| undefined, renotify: Boolean\(data\.tag\)/, 'one alert per lesson: a change replaces it');
  assert.match(sw, /self\.addEventListener\('notificationclick'/);
  const api = readFileSync(new URL('../api/student.ts', import.meta.url), 'utf8');
  assert.match(api, /'push-token': h7/);
});

test('과제·보강 알림 › home line: a switch while off, the home-screen tip on an iPhone browser, the settings when blocked; 나중에 for 7 days', () => {
  assert.equal(homePushView('off', false, false, false), 'off', 'an Android browser can turn it on');
  assert.equal(homePushView('unsupported', true, false, false), 'install', 'an iPhone not added to the home screen');
  assert.equal(homePushView('off', true, true, false), 'off', 'the iPhone app on the home screen');
  assert.equal(homePushView('blocked', false, true, false), 'blocked');
  assert.equal(homePushView('on', false, true, false), null);
  assert.equal(homePushView('off', false, true, true), null, '나중에');
  assert.equal(homePushView('unsupported', false, false, false), null);
  const store = new Map<string, string>(); (globalThis as any).localStorage = {getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k)};
  const day = 86_400_000, t = Date.parse('2026-10-31T00:00:00Z');
  assert.equal(pushCardDismissed('s1', t), false);
  dismissPushCard('s1', t);
  assert.equal(pushCardDismissed('s1', t + 6 * day), true); assert.equal(pushCardDismissed('s1', t + 7 * day), false, 'asked again after 7 days');
  store.set('push-card-dismissed:s2', '1'); assert.equal(pushCardDismissed('s2', t), false, 'a mark from before (no time) has run out');
  delete (globalThis as any).localStorage;
  const src = readFileSync(new URL('../src/components/PushOptIn.tsx', import.meta.url), 'utf8');
  // every line can be put off: each view's block (install, blocked, off) has 나중에 or 닫기
  for (const start of ["if (view === 'install')", "if (view === 'blocked')", "<Bell size={15}"]) { const at = src.indexOf(start), end = src.indexOf('</div>;', at); assert.ok(at > 0 && src.slice(at, end).includes('onClick={later}'), start); }
  const home = readFileSync(new URL('../src/components/Home.tsx', import.meta.url), 'utf8');
  const at = home.indexOf('<PushHomeToggle uid={userUid} />'), task = home.indexOf("onClick={() => onNavigate('report')} className={row}><span className={rowIcon}><CheckCircle2");
  assert.ok(at > 0 && task > at && task - at < 200, 'just over the 과제 row');
  assert.ok(home.includes("studentLinked && userRole === 'student' && userUid && <PushHomeToggle"), 'academy students only');
});
