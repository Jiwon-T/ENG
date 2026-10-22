import test from 'node:test';
import assert from 'node:assert/strict';
import {currentPet, initialPetState, setGearShow} from '../api/_lib/pet.js';
import {dropSetPiece, initialTower, openEntranceChest, petTowerStats, syncGearInbox, syncGearLooks, towerPet} from '../api/_lib/petTower.js';
import {finishStage, initialExpedition} from '../api/_lib/petExpedition.js';
import {TOWER_SET_GEAR, chapterGearTier, floorGearTier, gearLookOf, gearSetBonus, petGearView, towerGearFor, towerStats} from '../src/lib/petCatalog.js';
import {gearArt, gearBack, gearPiece} from '../src/components/pet/petGearArt.js';

const NOW = Date.parse('2026-10-20T03:00:00Z');

test('장비 모양: the worn tower gear is copied onto the pet, by tier (견습 0 … 마도사 5)', () => {
  const s = initialPetState(NOW), t = initialTower(NOW); s.pets[0].chosen = true;
  openEntranceChest(t, s);
  const tp = towerPet(t, 1); tp.gear.push('crystal_helm', 'star_armor'); tp.equip.helmet = 'crystal_helm'; tp.equip.armor = 'star_armor';
  syncGearLooks(t, s);
  assert.deepEqual(currentPet(s).gear, {look: {weapon: 0, helmet: 2, armor: 5}, full: null});
  // a job weapon the pet can't use any more is left out
  tp.equip.weapon = 'frost_greatsword'; syncGearLooks(t, s);
  assert.equal(currentPet(s).gear!.look.weapon, undefined);
});

test('👁 장비 보이기: off shows the outfit only; before the job the gear is 검사 모양 (the 견습 몽둥이 a club), an old 모양 choice aside', () => {
  const s = initialPetState(NOW), pet = currentPet(s);
  pet.gear = {look: {weapon: 0}, full: null};
  assert.equal(petGearView(pet)!.style, 'knight');
  assert.deepEqual(setGearShow(s, undefined, 'wizard'), {gearShow: true, gearStyle: 'wizard'});
  assert.equal(petGearView(pet)!.style, 'knight', 'a 모양 picked before the job no longer changes it');
  setGearShow(s, false, undefined); assert.equal(petGearView(pet), null);
  assert.throws(() => setGearShow(s, true, 'knight'), /PET_BAD_ACTION/);
  pet.job = 'swordsman';
  assert.throws(() => setGearShow(s, true, 'wizard'), /PET_JOB_TAKEN/);
  assert.equal(petGearView({...pet, gearShow: true})!.style, 'knight');
});

test('장비 그림: higher tiers move (수정 동굴 반짝임 → 모래 망토 → 마도사 룬 고리), 견습·이끼 stay still', () => {
  const all = (t: number) => ({weapon: t, helmet: t, armor: t, shoulder: t, gloves: t, boots: t});
  for (const style of ['knight', 'mage'] as const) {
    assert.doesNotMatch(gearArt(style, all(0)) + gearArt(style, all(1)), /class="pg-/);
    assert.match(gearArt(style, all(2)), /pg-(tw|pulse)/);
    assert.match(gearArt(style, all(3)), /pg-sway/);
    assert.match(gearArt(style, all(5)), /pg-spin/);
  }
  assert.equal(gearArt('knight', {}), '');
  assert.match(gearArt('knight', {helmet: 1}, -6), /^<g transform="translate\(0 -6\)">/);
});

test('장비 세트: 6 tiers × 6 places, 검사/마법사 names and stats, stronger each tier', () => {
  assert.equal(TOWER_SET_GEAR.length, 66);
  assert.deepEqual([towerGearFor('set_2_weapon', 'swordsman')!.name, towerGearFor('set_2_weapon', 'wizard')!.name, towerGearFor('set_2_weapon')!.name], ['수정 검', '수정 지팡이', '수정 무기']);
  assert.equal(towerGearFor('set_5_armor', 'wizard')!.name, '마도 로브');
  assert.ok(towerGearFor('set_5_armor')!.def! > towerGearFor('set_0_armor')!.def!);
  assert.ok(towerGearFor('set_3_helmet', 'swordsman')!.hp! > towerGearFor('set_3_helmet')!.hp!);
  assert.ok(towerGearFor('set_3_helmet', 'wizard')!.mp! > 0);
  assert.deepEqual([1, 5, 6, 10, 11, 20, 21, 30, 31, 40, 41, 50, 51, 60, 61, 70, 71, 80, 81, 90, 91, 100].map(floorGearTier), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10]);
  assert.deepEqual([towerGearFor('set_7_armor', 'swordsman')!.name, towerGearFor('set_10_weapon', 'wizard')!.name], ['심해 갑옷', '용왕 지팡이']);
  assert.ok(towerGearFor('set_10_armor')!.def! > towerGearFor('set_5_armor')!.def!);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(chapterGearTier), [0, 0, 1, 2, 3, 4, 5]);
});

test('세트 효과: 3 places +5%, all 6 +12% (and the glow), two half sets +10%', () => {
  const set = (t: number, n: number) => ['weapon', 'helmet', 'armor', 'shoulder', 'gloves', 'boots'].slice(0, n).map(slot => towerGearFor(`set_${t}_${slot}`));
  assert.equal(gearSetBonus(set(1, 2)), 0);
  assert.equal(gearSetBonus(set(1, 3)), 0.05);
  assert.equal(gearSetBonus(set(1, 6)), 0.12);
  assert.equal(gearSetBonus([...set(1, 3), ...set(2, 6).slice(3)]), 0.1);
  const plain = towerStats(10, set(1, 2)), three = towerStats(10, set(1, 3));
  assert.equal(three.hp, Math.round((plain.hp + towerGearFor('set_1_armor')!.hp!) * 1.05));
  assert.equal(gearLookOf({weapon: 'set_4_weapon', helmet: 'set_4_helmet', armor: 'set_4_armor', shoulder: 'set_4_shoulder', gloves: 'set_4_gloves', boots: 'set_4_boots'}).full, 4);
  assert.equal(gearLookOf({weapon: 'set_4_weapon', helmet: 'set_4_helmet', armor: 'set_4_armor', shoulder: 'set_4_shoulder', gloves: 'set_4_gloves', boots: 'set_3_boots'}).full, null);
});

test('탑 드롭: a normal floor 15% on the first clear, a boss floor always; a piece it has turns into a 강화석', () => {
  const s = initialPetState(NOW), t = initialTower(NOW); s.pets[0].chosen = true; openEntranceChest(t, s);
  const tp = towerPet(t, 1), seq = (...xs: number[]) => () => xs.shift()!;
  assert.equal(dropSetPiece(tp, 3, false, seq(0.2)), null);
  assert.deepEqual(dropSetPiece(tp, 3, false, seq(0.1, 0.4)), {id: 'set_0_armor', stone: false});
  assert.equal(tp.equip.armor, 'set_0_armor'); // an empty place: worn at once
  assert.deepEqual(dropSetPiece(tp, 20, true, seq(0)), {id: 'set_2_weapon', stone: false});
  assert.equal(tp.equip.weapon, 'apprentice_club'); // a worn place stays as it was
  const stones = tp.stones || 0;
  assert.deepEqual(dropSetPiece(tp, 20, true, seq(0)), {id: 'set_2_weapon', stone: true});
  assert.equal(tp.stones, stones + 1);
  assert.ok(petTowerStats(currentPet(s), tp).def > 0);
});

test('원정대 ★3: the first ★3 on a stage gives its chapter set piece, kept until the next tower visit', () => {
  const s = initialPetState(NOW), e = initialExpedition(NOW), t = initialTower(NOW); s.pets[0].chosen = true;
  const first = finishStage(e, s, 'forest-2', 3);
  assert.equal(first.setGear, 'set_0_helmet');
  assert.equal(finishStage(e, s, 'forest-2', 3).setGear, null); // only the first time
  assert.deepEqual(currentPet(s).gearInbox, ['set_0_helmet']);
  syncGearInbox(t, s);
  assert.equal(currentPet(s).gearInbox, undefined);
  assert.deepEqual(towerPet(t, 1).gear, ['set_0_helmet']);
  assert.equal(towerPet(t, 1).equip.helmet, 'set_0_helmet');
  currentPet(s).gearInbox = ['set_0_helmet']; syncGearInbox(t, s);
  assert.equal(towerPet(t, 1).stones, 1);
});

test('다른 화면의 장비: worked out from the tower when the pet has none kept yet (never saved), with 👁 applied', async () => {
  const {gearLookFor, gearViewFor} = await import('../api/_lib/petTower.js');
  const s = initialPetState(NOW), t = initialTower(NOW), pet = currentPet(s); s.pets[0].chosen = true; openEntranceChest(t, s);
  assert.equal(pet.gear, undefined);
  assert.deepEqual(gearLookFor(pet, towerPet(t, 1)), {look: {weapon: 0}, full: null});
  assert.equal(pet.gear, undefined, 'not saved');
  assert.equal(gearLookFor(pet, null), null);
  assert.equal(gearViewFor(pet, towerPet(t, 1))!.style, 'knight');
  pet.gearShow = false;
  assert.equal(gearViewFor(pet, towerPet(t, 1)), null);
});

test("장비 6~10단계 그림: 화염·심해·천공·성운·용왕 move; wings and fins go behind the pet; clip ids are the picture's own", () => {
  const all = (t: number) => ({weapon: t, helmet: t, armor: t, shoulder: t, gloves: t, boots: t});
  for (const style of ['knight', 'mage'] as const) for (const t of [6, 7, 8, 9, 10]) {
    const front = gearArt(style, all(t), 0, 'p1');
    assert.ok(front.length > 800, `${style} ${t} drawn`);
    assert.match(front, /class="(pg|px)-/, `${style} ${t} moves`);
    assert.doesNotMatch(front, /__ID__/);
  }
  assert.deepEqual([6, 7, 8, 9, 10].map(t => gearBack({armor: t}, 'p1') !== ''), [false, true, true, false, true], '심해 fins, 천공 and 용왕 wings');
  assert.equal(gearBack({armor: 5}), '');
  const a = gearArt('knight', all(8), 0, 'pA'), b = gearArt('knight', all(8), 0, 'pB');
  assert.match(a, /id="pApxk1"/); assert.match(b, /id="pBpxk1"/);
  assert.ok(gearPiece('mage', 'weapon', 7).svg.length > 100);
});

test('51~100층 보스 보물상자: potions and 강화석', async () => {
  const {TOWER_CHESTS} = await import('../src/lib/petCatalog.js');
  assert.deepEqual([60, 70, 80, 90, 100].map(f => [TOWER_CHESTS[f].potions, TOWER_CHESTS[f].stones]), [[5, 2], [6, 2], [6, 3], [7, 3], [8, 5]]);
});
