import test from 'node:test';
import assert from 'node:assert/strict';
import {currentPet, initialPetState} from '../api/_lib/pet.js';
import {initialTower, openEntranceChest, publicTower, startTowerRun, towerAct, towerAnswer, towerPet} from '../api/_lib/petTower.js';
import {jobSkills} from '../src/lib/petCatalog.js';

const NOW = Date.parse('2026-10-19T03:00:00Z');
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const words = Array.from({length: 20}, (_, i) => ({w: `word${i}`, m: `뜻${i}`}));
const sentences = [{wordbookId: 's', text: 'I go to school every day.', chunked: 'I go / to school / every day.', meaning: '나는 매일 학교에 간다.'}];
function ready(withSentences = true) {
  const s = initialPetState(NOW), t = initialTower(NOW), pet = currentPet(s);
  pet.level = 60; pet.chosen = true; pet.job = 'wizard';
  openEntranceChest(t, s); towerPet(t, pet.slot).floor = 5;
  startTowerRun(t, s, {words, wordbookId: 'hard', wordbookTitle: '어려운 단어', ...(withSentences ? {sentences} : {})}, NOW, seeded(), 0);
  const run = towerPet(t, pet.slot).run!; run.mp = 99; run.monster.hp = 100_000; run.monster.max = 100_000;
  const skill = jobSkills(pet).find(k => k.kind === 'attack' && pet.level >= k.level)!;
  return {s, t, run, skill};
}

test('탑 스킬: an attack skill asks 문장 배열 (the meaning shown, the pieces shuffled); the sentence in order hits', () => {
  const {s, t, run, skill} = ready();
  towerAct(t, s, 'skill', NOW, seeded(), skill.id);
  const q: any = publicTower(t, s, NOW).run!.q;
  assert.equal(q.prompt, '나는 매일 학교에 간다.');
  assert.deepEqual([...q.order].sort(), ['I go', 'every day.', 'to school'].sort());
  assert.equal('word' in q, false, 'the sentence itself is not sent');
  const hit: any = towerAnswer(t, s, run.id, 'I go to school every day', NOW, seeded());
  assert.deepEqual([hit.correct, hit.sentence, hit.damage > 0], [true, 'I go to school every day.', true]);
});

test('탑 스킬: a wrong order glances and is not put in the word 오답; a plain attack and no sentences stay word questions', () => {
  const {s, t, run, skill} = ready();
  towerAct(t, s, 'skill', NOW, seeded(), skill.id);
  const miss: any = towerAnswer(t, s, run.id, 'school to I go every day', NOW, seeded());
  assert.deepEqual([miss.correct, miss.glancing], [false, true]);
  assert.equal(run.wrongs.length, 0);
  towerAnswer(t, s, run.id, 0, NOW, seeded()); // the monster's turn
  towerAct(t, s, 'attack', NOW, seeded());
  assert.equal(publicTower(t, s, NOW).run!.q!.choices.length, 4, 'a plain attack: words');
  const plain = ready(false);
  towerAct(plain.t, plain.s, 'skill', NOW, seeded(), plain.skill.id);
  assert.equal((publicTower(plain.t, plain.s, NOW).run!.q as any).order, undefined, 'no sentence set: a word question');
});
