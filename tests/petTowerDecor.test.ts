import test from 'node:test';
import assert from 'node:assert/strict';
import {currentPet, initialPetState, publicPetState} from '../api/_lib/pet.js';
import {initialTower, openEntranceChest, startTowerRun, syncTowerDecor, towerAct, towerAnswer, towerPet} from '../api/_lib/petTower.js';
import {placeDecor} from '../api/_lib/petCoupon.js';
import {TOWER_DECOR} from '../src/lib/petCatalog.js';

const NOW = Date.parse('2026-10-19T03:00:00Z');
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const words = Array.from({length: 20}, (_, i) => ({w: `word${i}`, m: `뜻${i}`}));
const pool = {words, wordbookId: 'hard', wordbookTitle: '중등 어려운 단어'};
/** Win the battle on `floor` (a boss floor when it is a multiple of 10) with one right hit. */
function winFloor(s: any, t: any, floor: number) {
  const tp = towerPet(t, currentPet(s).slot); tp.floor = floor; tp.best = Math.max(tp.best, floor - 1); currentPet(s).energy = 100;
  startTowerRun(t, s, pool, NOW, seeded(), 0);
  const run = tp.run!; run.monster.hp = 1;
  towerAct(t, s, 'attack', NOW, seeded());
  return towerAnswer(t, s, run.id, tp.run!.q!.answer, NOW, seeded()) as any;
}

test('탑 장식: the first clear of each zone boss gives its decoration, once a student (not again for another pet)', () => {
  const s = initialPetState(NOW), t = initialTower(NOW); currentPet(s).level = 200; openEntranceChest(t, s);
  const r = winFloor(s, t, 10);
  assert.equal(r.won, true);
  assert.equal(r.decor, 'moss_pot');
  assert.deepEqual(s.towerDecor, ['moss_pot']);
  assert.equal(winFloor(s, t, 11).decor, null, 'a floor that is not a boss: none');
  assert.equal(winFloor(s, t, 10).decor, null, 'already owned: none again');
  assert.deepEqual(publicPetState(s).towerDecor, ['moss_pot']);
});

test('탑 장식: boss floors cleared before it existed give theirs on the next tower action', () => {
  const s = initialPetState(NOW), t = initialTower(NOW); openEntranceChest(t, s);
  towerPet(t, currentPet(s).slot).best = 34;
  syncTowerDecor(t, s);
  assert.deepEqual(s.towerDecor, ['moss_pot', 'crystal_lamp', 'hourglass']);
  syncTowerDecor(t, s);
  assert.equal(s.towerDecor!.length, 3, 'never twice');
  assert.equal(TOWER_DECOR.length, 10);
  towerPet(t, currentPet(s).slot).best = 72; syncTowerDecor(t, s);
  assert.deepEqual(s.towerDecor!.slice(3), ['ice_statue', 'spellbook_shelf', 'lava_brazier', 'pearl_bed'], '51~100층 bosses too');
});

test('꾸미기: 탑 장식 can be placed with the medals; only ones owned, each once', () => {
  const s: any = initialPetState(NOW); s.medals = ['2026-10']; s.towerDecor = ['moss_pot'];
  placeDecor(s, 'default', [{id: '2026-10', x: 20, y: 30}, {id: 'moss_pot', x: 60, y: 70}]);
  assert.deepEqual(s.decor.default.map((d: any) => d.id), ['2026-10', 'moss_pot']);
  assert.throws(() => placeDecor(s, 'default', [{id: 'crystal_lamp', x: 1, y: 1}]), /PET_BAD_ACTION/, 'not owned');
  assert.throws(() => placeDecor(s, 'default', [{id: 'moss_pot', x: 1, y: 1}, {id: 'moss_pot', x: 2, y: 2}]), /PET_BAD_ACTION/, 'twice');
});
