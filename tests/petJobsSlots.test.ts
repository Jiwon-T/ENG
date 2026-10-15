import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseJob, finishStage, initialExpedition, publicExpedition} from '../api/_lib/petExpedition.js';
import {currentPet, equipItem, initialPetState, normalizePets, publicPetState, wearItem} from '../api/_lib/pet.js';
import {buildRun} from '../api/_lib/petWordFeed.js';
import {STAGE_IDS} from '../api/_lib/petExpedition.js';
import {stageQuestions, wornAccessories} from '../src/lib/petCatalog.js';

const NOW = Date.parse('2026-10-15T03:00:00Z');
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const book = (id: string, n: number) => ({id, words: Array.from({length: n}, (_, i) => ({wordbookId: id, wordId: `${id}${i}`, word: `word${i}`, meaning: `뜻${i}, 의미${i}`}))});

test('accessories: one per place (머리·눈·목·손), all worn together; the same place swaps, tapping again takes it off', () => {
  const s = initialPetState(NOW); s.inventory.push('crown', 'beret', 'round_glasses', 'sunglasses', 'scarf', 'wood_sword');
  for (const id of ['crown', 'round_glasses', 'scarf', 'wood_sword']) equipItem(s, id);
  assert.deepEqual(currentPet(s).accessories, {head: 'crown', eyes: 'round_glasses', neck: 'scarf', hand: 'wood_sword'});
  equipItem(s, 'sunglasses'); equipItem(s, 'beret');
  assert.deepEqual(wornAccessories(currentPet(s)), ['beret', 'sunglasses', 'scarf', 'wood_sword'], 'drawing order: head, eyes, neck, hand');
  equipItem(s, 'scarf'); assert.equal(currentPet(s).accessories.neck, undefined);
  wearItem(s, 'crown'); assert.equal(currentPet(s).accessories.head, 'crown', 'wearing after a try-on puts it on (no toggle)');
  assert.deepEqual(publicPetState(s).accessories, currentPet(s).accessories);
});

test('accessories: a pet saved with one `accessory` gets it in the right place', () => {
  const s: any = initialPetState(NOW); delete s.pets[0].accessories; s.pets[0].accessory = 'scarf';
  normalizePets(s); assert.deepEqual([s.pets[0].accessories, 'accessory' in s.pets[0]], [{neck: 'scarf'}, false]);
  assert.deepEqual(wornAccessories({accessory: 'crown'}), ['crown'], 'party snapshots saved before still draw');
  // Mixed save: pet 1 has `accessory: null` (or an unknown id) while the old top-level item is still there.
  for (const own of [null, 'hacked']) {
    const m: any = initialPetState(NOW); delete m.pets[0].accessories; m.pets[0].accessory = own; m.accessory = 'crown';
    m.pets.push({...m.pets[0], slot: 2, accessory: null}); delete m.pets[1].accessories;
    normalizePets(m);
    assert.deepEqual([m.pets[0].accessories, m.pets[1].accessories, 'accessory' in m], [{head: 'crown'}, {}, false], `pet 1 keeps the top-level crown (own: ${own})`);
  }
});

test('chapters 4–6: the crown stage gives the background and both a sword and a staff, once', () => {
  const e = initialExpedition(NOW), s = initialPetState(NOW);
  const out = finishStage(e, s, 'desert-5', 3);
  assert.deepEqual([out.chapterReward, out.gear], ['oasis', ['wood_sword', 'wood_staff']]);
  assert.deepEqual(finishStage(e, s, 'desert-5', 3).gear, [], 'replaying gives nothing again');
  assert.equal(s.inventory.filter(id => id === 'wood_sword').length, 1);
});

test('꿈의 정원: clearing its crown stage lets the main pet choose 검사 or 마법사, once per pet; replays stay playable', () => {
  const e = initialExpedition(NOW), s = initialPetState(NOW);
  assert.equal(finishStage(e, s, 'dream-5', 1).jobChoice, false, 'one star does not clear a crown stage');
  assert.equal(finishStage(e, s, 'dream-5', 2).jobChoice, true);
  assert.deepEqual(publicExpedition(e, 70).jobReady, [currentPet(s).slot]);
  assert.throws(() => chooseJob(e, s, 'king'), /PET_JOB_BAD/);
  assert.deepEqual(chooseJob(e, s, 'wizard'), {job: 'wizard', weapon: 'dream_staff'});
  assert.deepEqual([currentPet(s).job, currentPet(s).accessories.hand, s.inventory.includes('dream_staff'), e.jobReady], ['wizard', 'dream_staff', true, []]);
  assert.throws(() => chooseJob(e, s, 'swordsman'), /PET_JOB_TAKEN/);
  assert.equal(finishStage(e, s, 'dream-5', 3).jobChoice, false, 'a pet with a job just replays');
  // A second pet (from Lv.100) has to clear 꿈의 정원 itself before it can choose (it may pick the other job).
  s.pets.push({...s.pets[0], slot: 2, character: 'hodu', job: null, accessories: {}}); s.currentPetSlot = 2;
  assert.throws(() => chooseJob(e, s, 'swordsman'), /PET_JOB_LOCKED/);
  finishStage(e, s, 'dream-5', 2);
  assert.equal(chooseJob(e, s, 'swordsman').weapon, 'dream_sword');
  assert.deepEqual(s.pets.map(p => p.job), ['wizard', 'swordsman']);
});

test('later chapters ask more questions: 1–3장 10, 4·5장 12, 6·7장 15', () => {
  assert.deepEqual(['forest-1', 'castle-5', 'desert-1', 'snow-5', 'night-1', 'dream-5', null].map(stageQuestions), [10, 10, 12, 12, 15, 15, 10]);
  assert.equal(STAGE_IDS.length, 35);
  const run = buildRun({books: [book('a', 40)], wrongs: []}, [], NOW, seeded(), 'night-1', stageQuestions('night-1'))!;
  assert.equal(run.questions.length, 15);
});
