import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {answerRun, buildRun, initialGameState, meaningParts, meaningsOverlap, publicRun, runSummary, type FeedSource} from '../api/_lib/petWordFeed.js';
import {currentPet, initialPetState} from '../api/_lib/pet.js';
import {handlePet} from '../api/_lib/student/pet.js';
import {PET_DAILY_STUDY_POINTS, PET_WORD_FEED} from '../src/lib/petCatalog.js';

const NOW = Date.parse('2026-10-14T03:00:00Z');
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const book = (id: string, n: number) => ({id, words: Array.from({length: n}, (_, i) => ({wordbookId: id, wordId: `${id}${i}`, word: `word${i}`, meaning: `뜻${i}, 의미${i}`}))});

test('word feed: meanings are compared part by part (comma, slash, dot, brackets, new line)', () => {
  assert.deepEqual(meaningParts('밝은, 빛나는 (빛이)'), ['밝은', '빛나는', '빛이']);
  assert.equal(meaningsOverlap('밝은, 빛나는', '빛나는'), true);
  assert.equal(meaningsOverlap('빌리다/꾸다', '꾸다·차용하다'), true);
  assert.equal(meaningsOverlap('조용한', '무거운'), false);
});

test('word feed: 10 questions, 3 different cards each, up to 3 from wrong answers, no card shares a meaning with the answer', () => {
  const source: FeedSource = {books: [book('a', 30), book('b', 30)], wrongs: [0, 1, 2, 3, 4].map(i => ({wordbookId: 'a', wordId: `a${i}`, word: `word${i}`, meaning: `뜻${i}, 의미${i}`}))};
  source.books[0].words.push({wordbookId: 'a', wordId: 'dup', word: 'twin', meaning: '의미1'}); // overlaps word1
  const run = buildRun(source, [], NOW, seeded())!;
  assert.equal(run.questions.length, PET_WORD_FEED.questions);
  assert.equal(run.questions.filter(q => q.fromWrong).length, 3);
  for (const q of run.questions) {
    assert.equal(new Set(q.choices).size, 3);
    const answer = q.choices[q.answer];
    for (const [i, c] of q.choices.entries()) if (i !== q.answer) assert.equal(meaningsOverlap(c, answer), false, `${q.word}: ${c} vs ${answer}`);
  }
  assert.equal(buildRun({books: [book('c', 3)], wrongs: []}, [], NOW, seeded()), null, 'too few words for 3 cards: no game');
  assert.ok(!JSON.stringify(publicRun(run)).includes('"answer"'), 'the browser never gets an unanswered answer');
});

test('word feed: grading is on the server, a repeated answer pays once, an old index is refused, a miss comes back once for 0P', () => {
  const g = initialGameState(NOW), pet = initialPetState(NOW);
  g.run = buildRun({books: [book('a', 40)], wrongs: []}, [], NOW, seeded(3))!;
  const run = g.run, q0 = run.questions[0];
  const first = answerRun(g, pet, run.id, 0, q0.answer);
  assert.deepEqual([first.correct, first.points], [true, 5]);
  assert.deepEqual([answerRun(g, pet, run.id, 0, q0.answer).repeat, pet.points], [true, 5], 'the same answer again: stored result, no second payment');
  assert.throws(() => answerRun(g, pet, 'other-run', 1, 0), /FEED_STALE/);
  assert.throws(() => answerRun(g, pet, run.id, 5, 0), /FEED_STALE/, 'skipping ahead (another device) is refused');
  const q1 = run.questions[1], wrong = (q1.answer + 1) % 3, before = run.questions.length;
  assert.equal(answerRun(g, pet, run.id, 1, wrong).correct, false);
  assert.equal(run.questions.length, before + 1); assert.equal(run.questions[1 + 1 + PET_WORD_FEED.retryAfter].retry, true);
  while (!run.finished) { const i = run.results.length; answerRun(g, pet, run.id, i, run.questions[i].answer); }
  const retryResult = run.results[run.questions.findIndex(q => q.retry)];
  assert.deepEqual([retryResult.correct, retryResult.points], [true, 0], 'the retried word is right now but pays nothing');
  const sum = runSummary(run);
  assert.deepEqual([sum.total, sum.correct, sum.stars], [10, 9, 3]);
  const replay = buildRun({books: [book('a', 40)], wrongs: []}, g.rewardedToday, NOW, seeded(9))!;
  assert.ok(replay.questions.every(q => !g.rewardedToday.includes(q.key)), 'a replay picks words not rewarded today');
});

test('word feed: points stay inside the daily 300P study cap and nothing is carried over', () => {
  const g = initialGameState(NOW), pet = initialPetState(NOW);
  pet.today.studyPoints = PET_DAILY_STUDY_POINTS - 5;
  g.run = buildRun({books: [book('a', 40)], wrongs: []}, [], NOW, seeded(5))!;
  const r1 = answerRun(g, pet, g.run.id, 0, g.run.questions[0].answer), r2 = answerRun(g, pet, g.run.id, 1, g.run.questions[1].answer);
  assert.deepEqual([r1.points, r2.points, pet.today.studyPoints], [5, 0, PET_DAILY_STUDY_POINTS]);
  assert.equal(g.rewardedToday.length, 1, 'a capped word is not marked, so it can pay on another day');
});

const call = async (body: any, deps: any) => {
  let status = 0, out: any;
  const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, set statusCode(v: number) { status = v; }, get statusCode() { return status; }};
  await handlePet({method: 'POST', headers: {authorization: 'Bearer kid'}, body} as any, res, deps); return {status, out};
};

test('word feed API: entering costs 10 energy once, resuming is free, a tired pet cannot enter, no study means a clear message', async () => {
  const f = registrationFirestore();
  const pet = initialPetState(NOW); pet.pets[0].chosen = true; f.rows.set('petStates/kid', pet);
  const deps: any = {verify: async () => ({uid: 'kid'}), db: () => f.db, generate: async () => '{}', now: () => NOW, feedSource: async () => ({books: [book('a', 40)], wrongs: []})};
  const start = await call({action: 'feed-start'}, deps);
  assert.equal(start.status, 200); assert.equal(start.out.state.pets[0].energy, 90); assert.equal(start.out.run.total, 10);
  assert.ok(!JSON.stringify(start.out).includes('"answer"'));
  const again = await call({action: 'feed-start'}, deps);
  assert.deepEqual([again.out.result.resumed, again.out.state.pets[0].energy, again.out.run.id], [true, 90, start.out.run.id], 'another device resumes the same game for free');
  const stored = f.rows.get('petGames/kid').run;
  const answered = await call({action: 'feed-answer', runId: stored.id, index: 0, choice: stored.questions[0].answer}, deps);
  assert.deepEqual([answered.out.result.correct, answered.out.state.points, answered.out.run.questions[0].answer], [true, 5, stored.questions[0].answer]);
  const twice = await call({action: 'feed-answer', runId: stored.id, index: 0, choice: stored.questions[0].answer}, deps);
  assert.equal(twice.out.state.points, 5, 'a resent answer pays nothing');
  const stale = await call({action: 'feed-answer', runId: stored.id, index: 4, choice: 0}, deps);
  assert.equal(stale.out.error, 'FEED_STALE');
  const restart = await call({action: 'feed-start', restart: true}, deps);
  assert.deepEqual([restart.out.state.pets[0].energy, restart.out.run.id !== stored.id], [80, true], 'starting over is a new entry');
  const tired = initialPetState(NOW); currentPet(tired).energy = 5; f.rows.set('petStates/kid', tired); f.rows.delete('petGames/kid');
  assert.equal((await call({action: 'feed-start'}, deps)).out.error, 'PET_TIRED');
  const none = await call({action: 'feed-start'}, {...deps, feedSource: async () => ({books: [], wrongs: []})});
  assert.equal(none.out.error, 'FEED_NO_BOOKS'); assert.match(none.out.message, /단어장을 한 번 공부하면/);
});

test('word feed: the sampling start uses the same characters as Firestore auto ids, so upper-case ids are not left out', async () => {
  const {randomDocId} = await import('../api/_lib/petWordFeed.js');
  const counts = {digit: 0, upper: 0, lower: 0}, rand = seeded(11);
  for (let i = 0; i < 6200; i++) { const id = randomDocId(rand); assert.match(id, /^[0-9A-Za-z]{20}$/); const c = id[0]; counts[/[0-9]/.test(c) ? 'digit' : /[A-Z]/.test(c) ? 'upper' : 'lower']++; }
  assert.ok(Math.abs(counts.upper - 2600) < 300 && Math.abs(counts.lower - 2600) < 300 && Math.abs(counts.digit - 1000) < 200, JSON.stringify(counts));
});

test('word feed: no star below half right (so a normal stage is not cleared by guessing wrong)', () => {
  const run: any = {questions: Array.from({length: 10}, () => ({})), results: Array.from({length: 10}, (_, i) => ({correct: i < 4, points: 0}))};
  assert.equal(runSummary(run).stars, 0);
  run.results = run.results.map((r: any, i: number) => ({...r, correct: i < 5}));
  assert.equal(runSummary(run).stars, 1);
});

test('word feed source: wrong answers are looked up until six still in the book are found, past ones that are gone', async () => {
  const {loadFeedSource} = await import('../api/_lib/petWordFeed.js');
  const f = registrationFirestore();
  f.rows.set('wordbooks/b1', {category: 'word', type: 'standard'});
  for (let i = 0; i < 20; i++) f.rows.set(`wordbooks/b1/words/w${String(i).padStart(2, '0')}`, {word: `word${i}`, meaning: `뜻${i}`});
  // 8 gone words first, then 10 that exist
  const incorrectAnswers = [...Array.from({length: 8}, (_, i) => ({word: `gone${i}`})), ...Array.from({length: 10}, (_, i) => ({word: `word${i}`}))];
  f.rows.set('studySessions/s1', {uid: 'kid', wordbookId: 'b1', createdAt: NOW, incorrectAnswers});
  const source = await loadFeedSource(f.db, 'kid', () => 0.5);
  assert.deepEqual(source.wrongs.map(w => w.word), ['word0', 'word1', 'word2', 'word3', 'word4', 'word5']);
});
