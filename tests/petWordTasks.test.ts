import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {buildTaskRun, createWordTask, listWordTasks, markTaskWords, removeWordTask, studentWordTask, teacherWordTasks} from '../api/_lib/petWordTasks.js';

const K = '11111111-1111-4111-8111-111111111111';
const teacher = {uid: 't1', admin: false, academyId: 'main', scopes: [{studentKey: K, subject: '영어'}]};
function book() {
  const f = registrationFirestore();
  f.rows.set('wordbooks/wm', {title: '워드마스터 중등 고난도'});
  // Day 1: 6 words (one without a Day), Day 2: 6 words, Day 3: 2 words
  const meanings = ['사과', '책', '물', '불', '바람', '나무', '하늘', '바다', '돌', '꽃', '새', '별', '달', '해'];
  meanings.forEach((m, i) => { const day = i < 6 ? (i === 0 ? undefined : 1) : i < 12 ? 2 : 3; f.rows.set(`wordbooks/wm/words/w${i}`, {word: `word${i}`, meaning: m, order: i, ...(day ? {day} : {})}); });
  return f;
}

test('원정대 과제로 내기: the Day range\'s words (a word without a Day is Day 1), kept with the task; only a teacher of the student', async () => {
  const f = book();
  const out: any = await createWordTask(f.db, teacher, {studentKey: K, wordbookId: 'wm', startDay: 1, endDay: 2}, 1000);
  assert.deepEqual([out.task.title, out.task.total, out.task.mastered, out.task.completedAt], ['워드마스터 중등 고난도 · Day 1~2', 12, 0, null]);
  assert.equal((await createWordTask(f.db, teacher, {studentKey: K, wordbookId: 'wm', startDay: 3, endDay: 3}, 2000) as any).task.total, 2);
  await assert.rejects(createWordTask(f.db, {...teacher, uid: 't2', scopes: []}, {studentKey: K, wordbookId: 'wm', startDay: 1, endDay: 1}), /FORBIDDEN/);
  await assert.rejects(createWordTask(f.db, teacher, {studentKey: K, wordbookId: 'wm', startDay: 9, endDay: 9}), /WORD_TASK_NO_WORDS/);
  assert.deepEqual((await teacherWordTasks(f.db, teacher, K)).tasks.map(t => t.title), ['워드마스터 중등 고난도 · Day 3', '워드마스터 중등 고난도 · Day 1~2']);
});

test('과제 판: only the words not yet right (10 at most, wrong meanings from the task); right the first time counts; all right → done', async () => {
  const f = book();
  const {task: view}: any = await createWordTask(f.db, teacher, {studentKey: K, wordbookId: 'wm', startDay: 1, endDay: 2}, 1000);
  const {id, task} = await studentWordTask(f.db, K, view.id);
  await assert.rejects(studentWordTask(f.db, '22222222-2222-4222-8222-222222222222', view.id), /WORD_TASK_NOT_FOUND/, 'another student');
  const run = buildTaskRun(id, task, 5000)!;
  assert.equal(run.task, id); assert.ok(run.questions.length <= 10);
  const types = new Set(run.questions.map(q => q.type || 'meaning'));
  assert.ok(types.has('match') && types.has('meaning') && types.has('listen'), `the 원정대 games mixed: ${[...types]}`);
  const asked = run.questions.flatMap(q => q.type === 'match' ? q.pairs!.map(p => p.key) : [q.key]);
  assert.equal(new Set(asked).size, asked.length, 'each word once');
  assert.ok(asked.every(k => /^wm:word\d+$/.test(k)), 'only the task words');
  assert.ok(run.questions.filter(q => !q.type || q.type === 'listen').every(q => q.choices.length === 3 && q.choices[q.answer]));
  assert.equal(buildTaskRun(id, task, 5000, Math.random, {quiet: true})!.questions.some(q => q.type === 'listen'), false, 'quiet: no 듣고 고르기');
  // 11 of 12 right
  const keys = Array.from({length: 12}, (_, i) => `wm:word${i}`);
  let after: any = await markTaskWords(f.db, id, keys.slice(0, 11), 6000);
  assert.deepEqual([after.mastered, after.completedAt], [11, null]);
  const last = buildTaskRun(id, (await studentWordTask(f.db, K, id)).task, 7000)!;
  assert.deepEqual(last.questions.map(q => q.key), ['wm:word11'], 'one word left still makes a game (wrong meanings from the rest)');
  after = await markTaskWords(f.db, id, ['wm:word11', 'wm:word11', 'other:x'], 8000);
  assert.deepEqual([after.mastered, after.completedAt], [12, 8000]);
  assert.equal(buildTaskRun(id, (await studentWordTask(f.db, K, id)).task, 9000), null, 'nothing left');
  assert.equal((await listWordTasks(f.db, K))[0].completedAt, 8000);
});

test('과제 빼기: the teacher who gave it (or 원장님); a removed task is gone for the student', async () => {
  const f = book();
  const {task}: any = await createWordTask(f.db, teacher, {studentKey: K, wordbookId: 'wm', startDay: 1, endDay: 1}, 1000);
  await assert.rejects(removeWordTask(f.db, {uid: 't2', admin: false}, task.id), /FORBIDDEN/);
  await removeWordTask(f.db, teacher, task.id);
  assert.deepEqual(await listWordTasks(f.db, K), []);
  await assert.rejects(studentWordTask(f.db, K, task.id), /WORD_TASK_NOT_FOUND/);
});
