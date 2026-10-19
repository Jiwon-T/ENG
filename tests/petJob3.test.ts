import test from 'node:test';
import assert from 'node:assert/strict';
import {currentPet, initialPetState} from '../api/_lib/pet.js';
import {initialTower, openEntranceChest, publicTower, startTowerRun, takeJob3, towerAct, towerAnswer, towerPet} from '../api/_lib/petTower.js';
import {PET_JOB3, job3For, jobSkills, petAura, petJobLabel} from '../src/lib/petCatalog.js';

const NOW = Date.parse('2026-10-19T03:00:00Z');
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const words = Array.from({length: 20}, (_, i) => ({w: `word${i}`, m: `뜻${i}`}));
const pool = {words, wordbookId: 'hard', wordbookTitle: '중등 어려운 단어'};
function ready(job: 'swordsman' | 'wizard', job2: any, level = 150, best = 50) {
  const s = initialPetState(NOW), t = initialTower(NOW), pet = currentPet(s);
  pet.level = level; pet.chosen = true; pet.job = job; pet.job2 = job2;
  openEntranceChest(t, s); towerPet(t, pet.slot).best = best; towerPet(t, pet.slot).floor = Math.min(best + 1, 45); // battles below the top (50 floors so far)
  return {s, t, pet};
}
const right = (t: any, s: any) => towerPet(t, currentPet(s).slot).run!.q!.answer;

test('3차 전직 「별의 시험」: a 2차 pet at Lv.150 that cleared floor 50 takes its branch\'s job, weapon, title and aura', () => {
  assert.deepEqual(['paladin', 'dark_knight', 'white_mage', 'dark_mage'].map(j => job3For(j as any)), ['sky_knight', 'abyss_knight', 'dawn_sage', 'dusk_mage']);
  const {s, t, pet} = ready('swordsman', 'paladin');
  assert.equal(publicTower(t, s, NOW).job3Ready, true);
  const r = takeJob3(t, s);
  assert.deepEqual([r.job3, r.weapon, pet.job3, pet.accessories.hand], ['sky_knight', 'sky_spear', 'sky_knight', 'sky_spear']);
  assert.ok(s.inventory.includes('sky_spear') && towerPet(t, pet.slot).gear.includes('sky_spear'), 'owned and tower gear');
  assert.equal(petJobLabel(pet), '천공의 기사');
  assert.equal(petAura(pet), 'light');
  assert.equal(PET_JOB3.sky_knight.title, '하늘을 가르는 자');
  assert.equal(publicTower(t, s, NOW).job3Ready, false);
  assert.throws(() => takeJob3(t, s), /PET_JOB_TAKEN/);
  assert.equal(petAura({job3: 'dusk_mage'}), 'dark');
});

test('3차 전직: locked below Lv.150, before floor 50, or without a 2차 job', () => {
  assert.throws(() => { const {s, t} = ready('swordsman', 'paladin', 149); takeJob3(t, s); }, /PET_JOB3_LOCKED/);
  assert.throws(() => { const {s, t} = ready('swordsman', 'paladin', 150, 49); takeJob3(t, s); }, /PET_JOB3_LOCKED/);
  assert.throws(() => { const {s, t} = ready('swordsman', null, 200); takeJob3(t, s); }, /PET_JOB3_LOCKED/);
});

test('3차 skills: only for the 3차 job; 하늘 가르기 also blocks, 그림자 베기 hits twice, 그믐 저주 weakens once, 새벽빛 치유 heals big', () => {
  const before = ready('swordsman', 'paladin');
  assert.ok(!jobSkills(before.pet).some(k => k.id === 'sky_cleave'), 'not before the 3차 job');
  takeJob3(before.t, before.s);
  assert.ok(jobSkills(before.pet).some(k => k.id === 'sky_cleave'));

  // 하늘 가르기: right → damage and the next monster attack blocked
  { const {s, t} = before; startTowerRun(t, s, pool, NOW, seeded()); const run = towerPet(t, 1).run!; run.mp = 99;
    towerAct(t, s, 'skill', NOW, seeded(), 'sky_cleave'); const r: any = towerAnswer(t, s, run.id, right(t, s), NOW, seeded());
    if (!r.won) { assert.equal(r.shieldUp, true); assert.equal(towerPet(t, 1).run!.shield, true); } }

  // 그림자 베기: two hits
  { const {s, t} = ready('swordsman', 'dark_knight'); takeJob3(t, s); startTowerRun(t, s, pool, NOW, seeded()); const run = towerPet(t, 1).run!; run.mp = 99; run.monster.hp = 100_000; run.monster.max = 100_000;
    towerAct(t, s, 'skill', NOW, seeded(), 'shadow_cut'); const r: any = towerAnswer(t, s, run.id, right(t, s), NOW, seeded());
    assert.equal(r.hits, 2); assert.ok(r.damage > 0); }

  // 그믐 저주: the monster's 공격 ×0.8, once
  { const {s, t} = ready('wizard', 'dark_mage'); takeJob3(t, s); startTowerRun(t, s, pool, NOW, seeded()); const run = towerPet(t, 1).run!; run.mp = 99; run.monster.hp = 100_000; run.monster.max = 100_000;
    const atk = run.monster.atk;
    towerAct(t, s, 'skill', NOW, seeded(), 'dusk_curse'); const r: any = towerAnswer(t, s, run.id, right(t, s), NOW, seeded());
    assert.equal(r.weakened, true); assert.equal(towerPet(t, 1).run!.monster.atk, Math.round(atk * 0.8));
    towerAnswer(t, s, run.id, right(t, s), NOW, seeded()); // the monster's turn
    towerAct(t, s, 'skill', NOW, seeded(), 'dusk_curse'); const again: any = towerAnswer(t, s, run.id, right(t, s), NOW, seeded());
    assert.ok(!again.weakened); assert.equal(towerPet(t, 1).run!.monster.atk, Math.round(atk * 0.8), 'not twice'); }

  // 새벽빛 치유: 30% × 2 × 축복 1.5
  { const {s, t} = ready('wizard', 'white_mage'); takeJob3(t, s); startTowerRun(t, s, pool, NOW, seeded()); const run = towerPet(t, 1).run!; run.mp = 99; run.hp = 1;
    const out: any = towerAct(t, s, 'skill', NOW, seeded(), 'dawn_heal');
    assert.equal(out.healed, Math.round(run.maxHp * 0.3 * 2 * 1.5)); }
});
