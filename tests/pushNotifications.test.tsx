import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {PUSH_TOKENS, pushTokenId, pushTokensOf, savePushToken} from '../api/_lib/pushTokens';
import {pushState, WEB_PUSH_KEY} from '../src/lib/pushNotifications';
import {PushHomeCard, PushMenuRow} from '../src/components/PushOptIn';

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

test('과제·보강 알림 1단계: nothing shows outside the installed app; the service worker shows pushes and opens the app', () => {
  assert.match(WEB_PUSH_KEY, /^B[A-Za-z0-9_-]{80,}$/, 'the public web push key');
  assert.equal(pushState('s1'), 'unsupported');
  assert.equal(pushState('s1', 'key'), 'unsupported', 'not the installed app');
  assert.equal(renderToStaticMarkup(<><PushHomeCard uid="s1" pushKey="key" /><PushMenuRow uid="s1" pushKey="key" /></>), '');
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /self\.addEventListener\('push'/);
  assert.match(sw, /tag: data\.tag \|\| undefined, renotify: Boolean\(data\.tag\)/, 'one alert per lesson: a change replaces it');
  assert.match(sw, /self\.addEventListener\('notificationclick'/);
  const api = readFileSync(new URL('../api/student.ts', import.meta.url), 'utf8');
  assert.match(api, /'push-token': h7/);
});
