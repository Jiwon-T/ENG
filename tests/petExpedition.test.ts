import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {STAGE_IDS, finishStage, initialExpedition, publicExpedition, stageCleared, stageUnlocked} from '../api/_lib/petExpedition.js';
import {initialPetState} from '../api/_lib/pet.js';
import {handlePet} from '../api/_lib/student/pet.js';
import {PET_DAILY_STUDY_POINTS} from '../src/lib/petCatalog.js';

const NOW = Date.parse('2026-10-14T03:00:00Z');

test('expedition: 15 stages in order; each opens when the one before is cleared; a crown stage needs 2 stars', () => {
  const e = initialExpedition(NOW), s = initialPetState(NOW);
  assert.equal(STAGE_IDS.length, 15); assert.deepEqual([STAGE_IDS[0], STAGE_IDS[4], STAGE_IDS[5]], ['forest-1', 'forest-5', 'sea-1']);
  assert.deepEqual([stageUnlocked(e, 'forest-1'), stageUnlocked(e, 'forest-2')], [true, false]);
  for (const id of ['forest-1', 'forest-2', 'forest-3', 'forest-4']) finishStage(e, s, id, 1);
  assert.equal(stageUnlocked(e, 'forest-5'), true);
  const crown1 = finishStage(e, s, 'forest-5', 1);
  assert.deepEqual([crown1.cleared, crown1.unlocked, crown1.chapterReward, stageUnlocked(e, 'sea-1')], [false, null, null, false], '★1 on a crown stage is not enough');
  const crown2 = finishStage(e, s, 'forest-5', 2);
  assert.deepEqual([crown2.cleared, crown2.unlocked, crown2.chapterReward], [true, 'sea-1', 'forest_cabin']);
  assert.ok(s.inventory.includes('forest_cabin'), 'the chapter background goes to the closet');
  assert.equal(finishStage(e, s, 'forest-5', 3).chapterReward, null, 'the chapter reward is given once');
  assert.equal(publicExpedition(e).current, 'sea-1');
});

test('expedition: bonuses once per stage (clear 20, ★2 10, ★3 10), best stars kept, inside the daily cap and never carried over', () => {
  const e = initialExpedition(NOW), s = initialPetState(NOW);
  const a = finishStage(e, s, 'forest-1', 2);
  assert.deepEqual([a.bonus, a.bonuses], [30, ['clear', 'star2']]);
  const b = finishStage(e, s, 'forest-1', 1);
  assert.deepEqual([b.bonus, b.best, e.stars['forest-1']], [0, 2, 2], 'a worse replay keeps the best stars and pays nothing');
  const c = finishStage(e, s, 'forest-1', 3);
  assert.deepEqual([c.bonus, c.bonuses], [10, ['star3']]);
  assert.equal(finishStage(e, s, 'forest-1', 3).bonus, 0);
  s.today.studyPoints = PET_DAILY_STUDY_POINTS;
  const capped = finishStage(e, s, 'forest-2', 3);
  assert.deepEqual([capped.bonus, e.bonuses['forest-2']], [0, ['clear', 'star2', 'star3']], 'capped: counted as paid, nothing later');
  assert.equal(stageCleared(e, 'forest-2'), true);
});

const book = (id: string, n: number) => ({id, words: Array.from({length: n}, (_, i) => ({wordbookId: id, wordId: `${id}${i}`, word: `word${i}`, meaning: `뜻${i}, 의미${i}`}))});
const call = async (body: any, deps: any) => {
  let status = 0, out: any;
  const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, set statusCode(v: number) { status = v; }, get statusCode() { return status; }};
  await handlePet({method: 'POST', headers: {authorization: 'Bearer kid'}, body} as any, res, deps); return {status, out};
};

test('expedition API: locked stages refused, a stage game settles the stage once on its last answer, another game must be finished or restarted', async () => {
  const f = registrationFirestore();
  const pet = initialPetState(NOW); pet.pets[0].chosen = true; f.rows.set('petStates/kid', pet);
  const deps: any = {verify: async () => ({uid: 'kid'}), db: () => f.db, generate: async () => '{}', now: () => NOW, feedSource: async () => ({books: [book('a', 60)], wrongs: []})};
  assert.equal((await call({action: 'feed-start', stage: 'forest-2'}, deps)).out.error, 'EXPEDITION_LOCKED');
  assert.equal((await call({action: 'feed-start', stage: 'moon-1'}, deps)).out.error, 'EXPEDITION_BAD_STAGE');
  const start = await call({action: 'feed-start', stage: 'forest-1'}, deps);
  assert.deepEqual([start.out.run.stage, start.out.state.pets[0].energy, start.out.expedition.current], ['forest-1', 90, 'forest-1']);
  const other = await call({action: 'feed-start'}, deps);
  assert.deepEqual([other.status, other.out.error], [409, 'FEED_OTHER_RUN'], 'a plain game cannot silently replace the stage game');
  let last: any;
  for (let i = 0; i < 10; i++) { const run = f.rows.get('petGames/kid').run; last = await call({action: 'feed-answer', runId: run.id, index: i, choice: run.questions[i].answer}, deps); }
  assert.deepEqual([last.out.result.expedition.stars, last.out.result.expedition.bonus, last.out.result.expedition.unlocked], [3, 40, 'forest-2']);
  assert.equal(last.out.state.points, 50 + 40, '10 words × 5P + clear 20 + ★2 10 + ★3 10');
  const run = f.rows.get('petGames/kid').run;
  const resent = await call({action: 'feed-answer', runId: run.id, index: 9, choice: run.questions[9].answer}, deps);
  assert.deepEqual([resent.out.result.repeat, resent.out.result.expedition, resent.out.state.points], [true, undefined, 90], 'a resent last answer does not settle the stage again');
  assert.equal(f.rows.get('petExpeditions/kid').stars['forest-1'], 3);
  const next = await call({action: 'feed-start', stage: 'forest-2'}, deps);
  assert.deepEqual([next.out.run.stage, next.out.state.pets[0].energy], ['forest-2', 80]);
  const restart = await call({action: 'feed-start', restart: true}, deps);
  assert.deepEqual([restart.out.run.stage, restart.out.state.pets[0].energy], [null, 70], 'restarting into another game costs energy again');
});

test('expedition: chapters need the main pet level (숲 1, 바다 5, 성 10); paid bonus amounts are reported after the cap', async () => {
  const {levelOk} = await import('../api/_lib/petExpedition.js');
  const e = initialExpedition(NOW), s = initialPetState(NOW);
  for (const id of STAGE_IDS.slice(0, 5)) finishStage(e, s, id, 3);
  assert.deepEqual([stageUnlocked(e, 'sea-1', 4), stageUnlocked(e, 'sea-1', 5), levelOk('castle-1', 9), levelOk('castle-1', 10)], [false, true, false, true]);
  const view = publicExpedition(e, 4);
  assert.deepEqual(view.chapters.map(c => [c.minLevel, c.levelOk, c.unlocked]), [[1, true, true], [5, false, false], [10, false, false]]);
  const t = initialPetState(NOW); t.today.studyPoints = PET_DAILY_STUDY_POINTS - 25;
  const out = finishStage(initialExpedition(NOW), t, 'forest-1', 3);
  assert.deepEqual([out.paid, out.bonus], [{clear: 20, star2: 5, star3: 0}, 25], 'the screen shows what was really paid');
});

test('expedition API: a chapter above the main pet level is refused', async () => {
  const f = registrationFirestore();
  const pet = initialPetState(NOW); pet.pets[0].chosen = true; f.rows.set('petStates/kid', pet);
  const done = initialExpedition(NOW); for (const id of STAGE_IDS.slice(0, 5)) finishStage(done, initialPetState(NOW), id, 3); f.rows.set('petExpeditions/kid', done);
  const deps: any = {verify: async () => ({uid: 'kid'}), db: () => f.db, generate: async () => '{}', now: () => NOW, feedSource: async () => ({books: [book('a', 60)], wrongs: []})};
  const r = await call({action: 'feed-start', stage: 'sea-1'}, deps);
  assert.equal(r.out.error, 'EXPEDITION_LEVEL'); assert.equal(f.rows.get('petStates/kid').pets[0].energy, 100, 'no energy spent');
  const map = await call({action: 'expedition-state'}, deps);
  assert.deepEqual([map.out.expedition.chapters[1].levelOk, map.out.expedition.chapters[1].minLevel], [false, 5]);
});

test('expedition: the next goal is the first unplayed stage by progress, marked when it waits for a level; all done at the end', () => {
  const e = initialExpedition(NOW), s = initialPetState(NOW);
  for (const id of STAGE_IDS.slice(0, 5)) finishStage(e, s, id, 3);
  const low = publicExpedition(e, 4);
  assert.deepEqual([low.current, low.currentNeedsLevel, low.allCleared], ['sea-1', 5, false], 'not castle-5: the sea chapter, waiting for Lv.5');
  assert.deepEqual([publicExpedition(e, 5).currentNeedsLevel], [null]);
  for (const id of STAGE_IDS.slice(5)) finishStage(e, s, id, 3);
  const all = publicExpedition(e, 10);
  assert.deepEqual([all.current, all.allCleared, all.currentNeedsLevel], ['castle-5', true, null]);
});
