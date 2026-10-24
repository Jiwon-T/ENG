import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.ts';
import {alertTeachers, gameAlertText, readStudyAlert, saveStudyAlert, studyAlertText, studyDoneAlert, taskAlertText} from '../api/_lib/studyAlerts.ts';
import {recordTaskGame} from '../api/_lib/petWordTasks.ts';
import {studyDevice} from '../src/lib/studyDonePing.ts';

const K = '11111111-1111-4111-8111-111111111111';
function world() {
  const f = registrationFirestore(), s = (p: string, v: any) => f.rows.set(p, v);
  s('users/kid', {role: 'student', notionStudentKey: K});
  s('teacherWorkspaceAccess/t1', {scopes: [{studentKey: K, subject: '영어'}]});
  s('teacherWorkspaceAccess/t2', {scopes: [{studentKey: K, subject: '수학'}]});
  s('teacherWorkspaceAccess/t3', {scopes: [{studentKey: 'other', subject: '영어'}]});
  s('teacherWorkspaceAccess/t4', {disabled: true, scopes: [{studentKey: K, subject: '영어'}]});
  for (const t of ['t1', 't2', 't3', 't4']) s(`pushTokens/${t}`, {uid: t, token: `token-of-${t}`});
  s('studySessions/s1', {uid: 'kid', type: 'test', wordbookTitle: '수능 필수 2000', dayStart: 3, dayEnd: 4, score: 18, totalItems: 20, duration: 370, createdAt: 10_000});
  const sent: any[] = [];
  const messaging = {sendEachForMulticast: async (m: any) => { sent.push(m); return {successCount: m.tokens.length, responses: m.tokens.map(() => ({success: true}))}; }};
  return {f, sent, messaging};
}

test('the alert text: who, what, range, score, minutes (📱 from a phone)', () => {
  assert.deepEqual(studyAlertText('김연우 (평여중2)', {type: 'test', wordbookTitle: '수능 필수 2000', dayStart: 3, dayEnd: 4, score: 18, totalItems: 20, duration: 370}, true),
    {title: '📱 김연우 · 단어 테스트', body: '수능 필수 2000 · Day 3–4 · 18/20 (90점) · 6분'});
  assert.equal(studyAlertText('박서윤', {type: 'flashcard', category: 'grammar', wordbookTitle: '중등 문법', dayStart: 7, totalItems: 30, duration: 540}, false).title, '💻 박서윤 · 문법 단어 암기');
});

test('setting: off by default (모바일만, 펫 게임 기록 빼고), saved per teacher', async () => {
  const {f} = world(), t1 = {uid: 't1', scopes: []};
  assert.deepEqual(await readStudyAlert(f.db, t1), {on: false, mobileOnly: true, games: false});
  await saveStudyAlert(f.db, t1, {on: true, mobileOnly: false, games: true});
  assert.deepEqual(await readStudyAlert(f.db, t1), {on: true, mobileOnly: false, games: true});
});

test('one study finished: the student’s teachers who turned it on (모바일만 skips a computer), once per record', async () => {
  const {f, sent, messaging} = world();
  f.rows.set('teacherStudyAlerts/t1', {on: true, mobileOnly: true}); f.rows.set('teacherStudyAlerts/t2', {on: true, mobileOnly: false});
  f.rows.set('teacherStudyAlerts/t3', {on: true, mobileOnly: false}); f.rows.set('teacherStudyAlerts/t4', {on: true, mobileOnly: false});
  assert.deepEqual(await studyDoneAlert(f.db, 'kid', {id: 's1', device: 'pc'}, 20_000, messaging), {sent: 1});
  assert.deepEqual(sent.map(m => m.tokens), [['token-of-t2']], 'not t1 (모바일만), not t3 (another student), not t4 (disabled)');
  assert.equal(sent[0].data.link, `/?study=${K}`);
  assert.deepEqual(await studyDoneAlert(f.db, 'kid', {id: 's1', device: 'mobile'}, 21_000, messaging), {sent: 0}, 'the same record twice: once');
  f.rows.set('studySessions/s2', {uid: 'kid', type: 'quiz', totalItems: 10, score: 9, duration: 60, createdAt: 30_000});
  assert.deepEqual(await studyDoneAlert(f.db, 'kid', {id: 's2', device: 'mobile'}, 31_000, messaging), {sent: 2});
  assert.deepEqual(await studyDoneAlert(f.db, 'other', {id: 's2', device: 'mobile'}, 31_000, messaging), {sent: 0}, 'someone else’s record');
  f.rows.set('studySessions/old', {uid: 'kid', type: 'quiz', createdAt: 0});
  assert.deepEqual(await studyDoneAlert(f.db, 'kid', {id: 'old', device: 'mobile'}, 60 * 60_000, messaging), {sent: 0}, 'an old record');
});

test('device: phones and iPads are mobile', () => {
  assert.equal(studyDevice({userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'}), 'mobile');
  assert.equal(studyDevice({userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5}), 'mobile');
  assert.equal(studyDevice({userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 0}), 'pc');
});

test('원정대 과제: each game kept as a study record (once per game); alert text for a game and for the task done', async () => {
  const {f} = world();
  f.rows.set('petWordTasks/task1', {studentKey: K, wordbookId: 'wm', bookTitle: '수능 필수 2000', startDay: 1, endDay: 2, words: Array.from({length: 12}, (_, i) => ({w: 'w' + i, m: 'm' + i})), mastered: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], createdAt: 1, completedAt: null});
  const view: any = await recordTaskGame(f.db, 'kid', 'task1', {runId: 'run9', right: 5, asked: 6, ms: 180_000}, 50_000);
  const rec = f.rows.get('studySessions/task_kid_run9');
  assert.deepEqual([rec.uid, rec.type, rec.score, rec.totalItems, rec.duration, rec.dayStart, rec.dayEnd, rec.wordbookTitle, rec.source], ['kid', 'quiz', 5, 6, 180, 1, 2, '원정대 과제 · 수능 필수 2000', 'word-task']);
  assert.deepEqual(taskAlertText('김연우', view, {right: 5, asked: 6, ms: 180_000}, false, 'mobile'), {title: '📱 김연우 · 원정대 단어 과제', body: '수능 필수 2000 · Day 1–2 · 이번 판 5/6 · 과제 8/12 맞힘 · 3분'});
  assert.deepEqual(taskAlertText('김연우', {...view, mastered: 12}, null, true, 'mobile'), {title: '✅ 김연우 · 원정대 단어 과제 완료', body: '수능 필수 2000 · Day 1–2 · 12단어 다 맞힘'});
  assert.deepEqual(gameAlertText('김연우', {kind: '채움의 탑', detail: '23층 · 수능 필수', right: 9, asked: 10, ms: 240_000}, 'pc'), {title: '💻 김연우 · 채움의 탑', body: '23층 · 수능 필수 · 9/10 · 4분'});
});

test('펫 게임 alerts only to teachers who ticked 펫 게임 기록도; 원정대 과제 to everyone who turned it on', async () => {
  const {f, sent, messaging} = world();
  f.rows.set('teacherStudyAlerts/t1', {on: true, mobileOnly: false, games: true}); f.rows.set('teacherStudyAlerts/t2', {on: true, mobileOnly: false});
  const text = () => ({title: 't', body: 'b'});
  assert.equal(await alertTeachers(f.db, 'kid', text, {device: 'mobile', tag: 'tower-1', game: true, messaging}), 1);
  assert.deepEqual(sent.map(m => m.tokens), [['token-of-t1']]);
  assert.equal(await alertTeachers(f.db, 'kid', text, {device: 'mobile', tag: 'task-1', messaging}), 2);
});
