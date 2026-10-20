import test from 'node:test';
import assert from 'node:assert/strict';
import {currentPet, initialPetState} from '../api/_lib/pet.js';
import {initialTower, openEntranceChest, petTowerStats, publicTower, startTowerRun, towerAct, towerAnswer, towerPet} from '../api/_lib/petTower.js';
import {FOE_RULES, TOWER_FOE_SKILLS, TOWER_ZONES, foeSkillsFor, jobSkills, towerTaken} from '../src/lib/petCatalog.js';

const NOW = Date.parse('2026-10-20T03:00:00Z');
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const words = Array.from({length: 20}, (_, i) => ({w: `word${i}`, m: `뜻${i}`}));
const pool = {words, wordbookId: 'hard', wordbookTitle: '중등 어려운 단어'};
/** A battle on `floor` (Lv.60, lots of HP), the monster's next skill set by hand. */
function fight(floor = 12, next: string | null = null) {
  const s = initialPetState(NOW), t = initialTower(NOW); currentPet(s).level = 60; s.pets[0].chosen = true; openEntranceChest(t, s);
  const tp = towerPet(t, 1); tp.floor = floor; tp.best = floor - 1; tp.potions = 3;
  startTowerRun(t, s, pool, NOW, seeded());
  const run = tp.run!; run.monster.hp = run.monster.max = 100000; // it doesn't fall in these tests
  if (run.foe) run.foe.next = next;
  return {s, t, tp, run, rand: seeded(3)};
}
const say = (f: ReturnType<typeof fight>, right: boolean, at = NOW) => { const q = f.run.q!; return towerAnswer(f.t, f.s, f.run.id, right ? q.answer : (q.answer + 1) % q.choices.length, at, f.rand); };
/** One round: attack (answered), then the monster's turn (answered) — returns the monster's turn. */
const round = (f: ReturnType<typeof fight>, hit: boolean, block: boolean) => { towerAct(f.t, f.s, 'attack', NOW, f.rand); const a: any = say(f, hit); return f.run.phase === 'defend' ? {...a, ...say(f, block) as any} : a; };

test('몬스터 스킬: every monster from the floor-10 boss on has its own skills (none in 1구역); 51층+ bosses can grow angry', () => {
  for (const z of TOWER_ZONES.slice(1)) for (const m of [...z.monsters, z.boss]) assert.ok((TOWER_FOE_SKILLS[m.kind] || []).length >= 1, `${m.name} has a skill`);
  for (const m of TOWER_ZONES[0].monsters) assert.equal(foeSkillsFor(m.kind, 9).length, 0);
  assert.equal(foeSkillsFor('gatekeeper', 10)[0].name, '대지 내려찍기');
  for (const z of TOWER_ZONES.slice(5)) { for (const m of z.monsters) assert.equal(TOWER_FOE_SKILLS[m.kind]!.length, 2); assert.equal(TOWER_FOE_SKILLS[z.boss.kind]!.length, 3); }
  assert.equal(fight(5).run.foe, undefined, 'a 1구역 battle has no monster skills');
  const f = fight(12); assert.ok(f.run.foe && f.run.foe.skills.length > 0 && !f.run.foe.rage);
  assert.equal(fight(60).run.foe!.rage, true);
});

test('몬스터 스킬: the warning shows one turn before; 강타 hits twice as hard; never two skills in a row', () => {
  const f = fight(12, 'golem.0'), st = petTowerStats(currentPet(f.s), f.tp);
  assert.deepEqual((publicTower(f.t, f.s, NOW).run as any).foe.next, {name: '바위 던지기', fx: ['smash'], dot: null, warn: '바위를 집어 들었어요'});
  const r: any = round(f, true, false);
  assert.equal(r.foe.name, '바위 던지기');
  assert.equal(r.taken, Math.max(1, Math.round(towerTaken(f.run.monster.atk, st.def, false) * FOE_RULES.smash)));
  assert.equal(f.run.foe!.next, null, 'the turn after a skill is a plain attack');
});

test('몬스터 스킬: 묶기 gives a 4-second block question; 연속 공격 asks two', () => {
  const f = fight(12, 'cave_spider.0');
  towerAct(f.t, f.s, 'attack', NOW, f.rand); say(f, true);
  assert.equal(f.run.q!.deadline! - NOW, FOE_RULES.bindSeconds * 1000);
  const g = fight(25, 'temple_cat.0');
  towerAct(g.t, g.s, 'attack', NOW, g.rand); say(g, true);
  const first: any = say(g, false);
  assert.deepEqual([first.foe.again, g.run.phase], [true, 'defend']);
  const second: any = say(g, true);
  assert.deepEqual([second.foe.again, g.run.phase, g.run.foe!.hits], [undefined, 'act', 0]);
});

test('몬스터 스킬: 독 lasts 3 rounds unless blocked; a potion cures it', () => {
  const blocked = fight(22, 'sand_scorpion.0'), r1: any = round(blocked, true, true);
  assert.deepEqual([r1.foe.avoided, blocked.run.foe!.dot], [true, null]);
  const f = fight(22, 'sand_scorpion.0'), before = f.run.hp, r: any = round(f, true, false);
  assert.equal(r.foe.dot, '독');
  assert.deepEqual(r.dot, {name: '독', damage: Math.round(f.run.maxHp * FOE_RULES.dotPct)});
  assert.equal(f.run.hp, before - r.taken - r.dot.damage);
  assert.equal(f.run.foe!.dot!.turns, FOE_RULES.dotTurns - 1);
  const p: any = towerAct(f.t, f.s, 'potion', NOW, f.rand);
  assert.equal(p.cured, '독'); assert.equal(f.run.foe!.dot, null);
});

test('몬스터 스킬: 방어 태세 is the whole turn (no block question) and holds for 2 attacks; a weak-element skill breaks it', () => {
  const f = fight(12, 'crystal_slime.0');
  towerAct(f.t, f.s, 'attack', NOW, f.rand); const r: any = say(f, true);
  assert.deepEqual([r.foe.guard, f.run.phase, f.run.q], [FOE_RULES.guardTurns, 'act', null]);
  f.run.foe!.next = null;
  towerAct(f.t, f.s, 'attack', NOW, f.rand); const hit: any = say(f, true);
  assert.equal(f.run.foe!.guard, 1);
  assert.ok(hit.damage > 0);
});

test('몬스터 스킬: 재생 is stopped by a hit that turn; otherwise it heals 10%', () => {
  const f = fight(22, 'mummy.0');
  towerAct(f.t, f.s, 'attack', NOW, f.rand); const stopped: any = say(f, true);
  assert.equal(stopped.foe.canceled, true);
  const g = fight(22, 'mummy.0'); g.run.monster.hp = 50000;
  towerAct(g.t, g.s, 'attack', NOW, g.rand); const healed: any = say(g, false);
  assert.equal(healed.foe.healed, Math.round(100000 * FOE_RULES.regen)); assert.equal(g.run.monster.hp, 60000);
});

test('몬스터 스킬: 봉인 keeps skills off for 2 rounds unless blocked; 흡혈 heals the monster; 분노 below 30%', () => {
  const f = fight(42, 'magic_doll.0'), r: any = round(f, true, false);
  assert.equal(r.foe.sealed, FOE_RULES.sealTurns); assert.equal(f.run.foe!.sealed, 2);
  const pet = currentPet(f.s); pet.job = 'swordsman'; const k = jobSkills(pet).find(x => x.level <= pet.level)!;
  assert.throws(() => towerAct(f.t, f.s, 'skill', NOW, f.rand, k.id), /TOWER_SEALED/);
  f.run.foe!.next = null; round(f, true, true); assert.equal(f.run.foe!.sealed, 1);
  f.run.foe!.next = null; round(f, true, true); assert.equal(f.run.foe!.sealed, 0);
  const g = fight(12, 'vampire_bat.0'); g.run.monster.hp = 50000;
  const d: any = round(g, false, false); assert.equal(g.run.monster.hp, 50000 + d.foe.drained);
  const h = fight(60); h.run.foe!.next = null; h.run.monster.hp = Math.round(h.run.monster.max * 0.3) + 1;
  towerAct(h.t, h.s, 'attack', NOW, h.rand); const angry: any = say(h, true);
  assert.equal(angry.enraged, true); assert.equal(h.run.foe!.raged, true);
});

test('몬스터 스킬: a battle saved before monster skills keeps going without them', () => {
  const f = fight(30); delete f.run.foe;
  const r: any = round(f, true, false);
  assert.equal(r.foe, undefined); assert.equal(f.run.phase, 'act');
  assert.equal((publicTower(f.t, f.s, NOW).run as any).foe, null);
});

test('몬스터 스킬: event battles have their own too (거울 그림자 from floor 10, 수상한 요정·깨어난 드래곤 anywhere, the dragon angry); 묶기 tells the browser its shorter time', async () => {
  const {FOE_RAGE} = await import('../src/lib/petCatalog.js');
  assert.ok(foeSkillsFor('shadow', 12).length > 0); assert.deepEqual(foeSkillsFor('shadow', 5), []);
  assert.equal(foeSkillsFor('fairy', 3).length, 2);
  assert.equal(foeSkillsFor('dragon', 3).length, 3); assert.ok(FOE_RAGE.has('dragon'));
  const f = fight(14, 'cave_spider.0');
  towerAct(f.t, f.s, 'attack', NOW, f.rand); say(f, true);
  const q = (publicTower(f.t, f.s, NOW).run as any).q;
  assert.deepEqual([q.msLeft, q.msTotal], [FOE_RULES.bindSeconds * 1000, FOE_RULES.bindSeconds * 1000]);
});
