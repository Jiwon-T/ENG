// 채움의 탑: turn-based battles, one floor each, kept per pet in petTowers/{uid} (server only). The server holds the
// monster, both HPs, the question and its answer; the browser only sees the question and its choices. Attack: answer the
// word (right = hit). The monster's turn: answer the meaning before the deadline to block. Clearing a floor saves it;
// a fallen pet tries the same floor again; running away empties 기운 (탈진).
import {FieldPath} from 'firebase-admin/firestore';
import {readStudentMapping} from './studentIdentity.js';
import {DIRECTORY_ROWS, directoryRowKey} from './academyDirectorySource.js';
import {awardCapped, currentPet, type ServerPet, type ServerPetState} from './pet.js';
import {meaningsOverlap, randomDocId} from './petWordFeed.js';
import {PET_TOWER, TOWER_CHESTS, TOWER_ENHANCE, TOWER_EVENTS, towerGear, towerHit, towerMonster, towerStats, towerTaken, type TowerEvent, type TowerGear, type TowerGearSlot, type TowerMonsterKind} from '../../src/lib/petCatalog.js';
import {gradeOf} from '../../src/lib/schoolGrade.js';

export const PET_TOWERS = 'petTowers';
export const PET_TOWER_SETTINGS = 'petTowerSettings';
interface PoolWord { w: string; m: string }
interface TowerPool { words: PoolWord[]; wordbookId: string; wordbookTitle: string }
interface TowerQuestion { kind: 'attack' | 'defend' | 'riddle' | 'trap'; word: string; meaning: string; choices: string[]; answer: number; issuedAt: number; deadline: number | null }
interface TowerWrong { word: string; meaning: string; userChoice: string; correctAnswer: string; choices: string[]; quizSentence: string }
export interface TowerRun {
  id: string; floor: number; monster: {kind: TowerMonsterKind; name: string; boss: boolean; hp: number; max: number; atk: number; def: number; color?: number};
  hp: number; maxHp: number; mp: number; maxMp: number; phase: 'act' | 'attack' | 'defend'; q: TowerQuestion | null; attacks: number;
  right: number; asked: number; wrongs: TowerWrong[]; pool: PoolWord[]; next: number; wordbookId: string; wordbookTitle: string; startedAt: number;
  /** Extra prize for winning (길 잃은 요정 fought: two potions). */ bonus?: {potions?: number};
}
/** A door's event that isn't a battle (yet): the 상인's stock, a riddle or trap question, the fairy's choice. */
export interface TowerEventState { id: string; floor: number; door: number; type: Exclude<TowerEvent, 'monster' | 'mirror' | 'treasure'>; q: TowerQuestion | null; stock: {stone: number; potion: number}; pool: TowerPool; wrongs: TowerWrong[]; startedAt: number; /** 잠든 드래곤's look */ color?: number }
/** One pet's climb: `floor` is the next floor to play (saved on every clear), `best` the highest cleared. `levels`: 강화 by gear. */
export interface TowerPet { floor: number; best: number; gear: string[]; equip: Partial<Record<TowerGearSlot, string>>; chests: number[]; potions: number; stones?: number; levels?: Record<string, number>; run: TowerRun | null; event?: TowerEventState | null; /** the last door opened (a resent request gets the same answer) */ lastOpen?: {id: string; result: any} | null }
export interface TowerState { version: 1; pets: Record<string, TowerPet>; updatedAt: number }
export const initialTower = (now = Date.now()): TowerState => ({version: 1, pets: {}, updatedAt: now});
export function towerPet(t: TowerState, slot: number): TowerPet {
  t.pets ||= {};
  const tp = t.pets[String(slot)] ||= {floor: 1, best: 0, gear: [], equip: {}, chests: [], potions: 0, run: null};
  tp.stones ??= 0; tp.levels ??= {}; tp.event ??= null;
  return tp;
}
const worn = (tp: TowerPet) => Object.values(tp.equip).map(id => towerGear(String(id)));
export const petTowerStats = (pet: ServerPet, tp: TowerPet) => towerStats(pet.level, worn(tp), tp.levels || {});
const shuffle = <T,>(list: T[], rand: () => number) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** A repeatable random series from a text (the door layout of one pet's floor). */
export function seeded(text: string) {
  let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let x = h; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
/** The three doors of a floor for this pet: fixed (a retry finds the same doors), different for every student. */
export function towerLayout(uid: string, slot: number, floor: number): TowerEvent[] {
  const rand = seeded(`${uid}:${slot}:${floor}`), all = Object.entries(TOWER_EVENTS) as [TowerEvent, {weight: number}][], total = all.reduce((n, [, e]) => n + e.weight, 0);
  return Array.from({length: PET_TOWER.doors}, () => { let r = rand() * total; for (const [k, e] of all) { r -= e.weight; if (r < 0) return k; } return 'monster' as TowerEvent; });
}

/** A treasure chest: its gear (worn at once when that place is empty) and potions, once per pet. */
function openChestFor(tp: TowerPet, floor: number) {
  const chest = TOWER_CHESTS[floor]; if (!chest || tp.chests.includes(floor)) return null;
  tp.chests.push(floor); tp.potions += chest.potions;
  const gear = chest.gear.filter(id => towerGear(id) && !tp.gear.includes(id));
  for (const id of gear) { tp.gear.push(id); const g = towerGear(id)!; if (!tp.equip[g.slot]) tp.equip[g.slot] = id; }
  return {floor, gear, potions: chest.potions};
}
/** The chest at the entrance (floor 1): the 견습 몽둥이 and the first potions. */
export function openEntranceChest(t: TowerState, s: ServerPetState) {
  const out = openChestFor(towerPet(t, currentPet(s).slot), 1); if (!out) throw Error('TOWER_CHEST_OPENED');
  return {chest: out};
}
/** Wear a piece of tower gear the pet has (or take it off when it is already worn). */
export function equipTowerGear(t: TowerState, s: ServerPetState, idInput: unknown) {
  const pet = currentPet(s), tp = towerPet(t, pet.slot), id = String(idInput || ''), g = towerGear(id);
  if (!g || !tp.gear.includes(id)) throw Error('PET_ITEM_NOT_OWNED');
  if (tp.run || tp.event) throw Error('TOWER_IN_BATTLE');
  if (g.job && pet.job !== g.job) throw Error('TOWER_GEAR_JOB');
  if (tp.equip[g.slot] === id) delete tp.equip[g.slot]; else tp.equip[g.slot] = id;
  return {equip: tp.equip};
}

const otherChoices = (pool: PoolWord[], target: PoolWord, k: 'w' | 'm', rand: () => number) => {
  const others = shuffle(pool.filter(p => p.w.toLowerCase() !== target.w.toLowerCase() && !meaningsOverlap(p.m, target.m)), rand), out: string[] = [];
  for (const o of others) { if (out.length === PET_TOWER.choices - 1) break; if (!out.includes(o[k]) && !(k === 'm' && out.some(x => meaningsOverlap(x, o.m)))) out.push(o[k]); }
  return out;
};
/** Three near-miss spellings (letters swapped, dropped, doubled, a vowel changed); fewer when the word is too short. */
export function misspellings(word: string, rand: () => number) {
  const w = word.trim(); if (!/^[A-Za-z]{4,}$/.test(w)) return [];
  const out = new Set<string>(), vowels = 'aeiou';
  for (let tries = 0; out.size < PET_TOWER.choices - 1 && tries < 40; tries++) {
    const i = 1 + Math.floor(rand() * (w.length - 2)), kind = tries % 4; let v = w;
    if (kind === 0) v = w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
    else if (kind === 1) v = w.slice(0, i) + w.slice(i + 1);
    else if (kind === 2) v = w.slice(0, i) + w[i] + w.slice(i);
    else { const j = [...w].findIndex((c, x) => x >= i && vowels.includes(c.toLowerCase())); if (j >= 0) { const nv = vowels.replace(w[j].toLowerCase(), '')[Math.floor(rand() * 4)]; v = w.slice(0, j) + nv + w.slice(j + 1); } }
    if (v.toLowerCase() !== w.toLowerCase()) out.add(v);
  }
  return [...out];
}
function question(pool: PoolWord[], index: number, kind: TowerQuestion['kind'], now: number, rand: () => number): TowerQuestion {
  const target = pool[index % pool.length];
  // Attack: the meaning → the word. Defence and trap: the word → the meaning. Riddle: the meaning → the right spelling.
  if (kind === 'riddle') {
    const wrong = misspellings(target.w, rand);
    if (wrong.length === PET_TOWER.choices - 1) { const choices = shuffle([target.w, ...wrong], rand); return {kind, word: target.w, meaning: target.m, choices, answer: choices.indexOf(target.w), issuedAt: now, deadline: null}; }
  }
  const byWord = kind === 'attack' || kind === 'riddle', right = byWord ? target.w : target.m, choices = shuffle([right, ...otherChoices(pool, target, byWord ? 'w' : 'm', rand)], rand);
  const seconds = kind === 'defend' ? PET_TOWER.defendSeconds : kind === 'trap' ? PET_TOWER.trapSeconds : 0;
  return {kind, word: target.w, meaning: target.m, choices, answer: choices.indexOf(right), issuedAt: now, deadline: seconds ? now + seconds * 1000 : null};
}
function ask(run: TowerRun, kind: 'attack' | 'defend', now: number, rand: () => number) {
  run.q = question(run.pool, run.next, kind, now, rand); run.next += 1; run.asked += 1; run.phase = kind;
}

type Foe = {kind: TowerMonsterKind; name: string; boss: boolean; hp: number; atk: number; def: number; color?: number};
function battle(tp: TowerPet, pet: ServerPet, pool: TowerPool, m: Foe, floor: number, now: number, rand: () => number, hpShare = 1) {
  const st = petTowerStats(pet, tp);
  tp.run = {id: randomDocId(rand), floor, monster: {kind: m.kind, name: m.name, boss: m.boss, hp: m.hp, max: m.hp, atk: m.atk, def: m.def, ...(m.color !== undefined ? {color: m.color} : {})},
    hp: Math.max(1, Math.round(st.hp * hpShare)), maxHp: st.hp, mp: st.mp, maxMp: st.mp, phase: 'act', q: null, attacks: 0, right: 0, asked: 0, wrongs: [],
    pool: shuffle(pool.words, rand), next: 0, wordbookId: pool.wordbookId, wordbookTitle: pool.wordbookTitle, startedAt: now};
  return tp.run;
}
/** 거울방: the pet's own shadow, a little weaker than the pet. */
const shadowOf = (pet: ServerPet, tp: TowerPet): Foe => { const st = petTowerStats(pet, tp); return {kind: 'shadow', name: `${pet.name}의 그림자`, boss: false, hp: Math.round(st.hp * 0.85), atk: Math.round(st.atk * 0.85), def: Math.round(st.def * 0.85)}; };
/** 깨어난 드래곤: end-game strength, whatever the floor. */
const dragonOf = (color = 0): Foe => ({kind: 'dragon', name: '깨어난 드래곤', boss: false, ...PET_TOWER.dragon, color});
const fairyOf = (floor: number): Foe => { const m = towerMonster(floor); return {kind: 'fairy', name: '수상한 요정', boss: false, hp: Math.round(m.hp * 0.9), atk: Math.round(m.atk * 0.9), def: m.def}; };

/** Open one of the floor's doors (costs 기운): a battle, an instant treasure, or an event to play. `pool`: words from the
 *  tower wordbook, loaded before the transaction. */
export function openTowerDoor(t: TowerState, s: ServerPetState, uid: string, pool: TowerPool, now: number, rand: () => number = Math.random, doorInput: unknown = 0, layout?: TowerEvent[], requestId?: unknown) {
  const pet = currentPet(s), tp = towerPet(t, pet.slot), rid = typeof requestId === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(requestId) ? requestId : null;
  // A resent request (the answer got lost on the way) gets the same answer instead of opening the next floor's door.
  if (rid && tp.lastOpen?.id === rid) return {...tp.lastOpen.result, replayed: true};
  const out = openDoor(tp, pet, s, uid, pool, now, rand, doorInput, layout);
  if (rid && !out.resumed) tp.lastOpen = {id: rid, result: out};
  return out;
}
function openDoor(tp: TowerPet, pet: ServerPet, s: ServerPetState, uid: string, pool: TowerPool, now: number, rand: () => number, doorInput: unknown, layout?: TowerEvent[]): any {
  if (tp.run || tp.event) return {resumed: true};
  if (!tp.chests.includes(1)) throw Error('TOWER_CHEST_FIRST');
  if (tp.floor > PET_TOWER.floors) throw Error('TOWER_TOP');
  if (pet.energy <= 0) throw Error('PET_EXHAUSTED');
  if (pet.energy < PET_TOWER.energy) throw Error('PET_TIRED');
  pet.energy -= PET_TOWER.energy;
  const floor = tp.floor, door = Math.max(0, Math.min(PET_TOWER.doors - 1, Math.floor(Number(doorInput)) || 0));
  if (towerMonster(floor).boss) { battle(tp, pet, pool, towerMonster(floor), floor, now, rand); return {opened: 'boss', energy: PET_TOWER.energy}; }
  const type = (layout || towerLayout(uid, pet.slot, floor))[door];
  if (type === 'monster') { battle(tp, pet, pool, towerMonster(floor, door), floor, now, rand); return {opened: type}; }
  if (type === 'mirror') { battle(tp, pet, pool, shadowOf(pet, tp), floor, now, rand); return {opened: type}; }
  if (type === 'treasure') {
    const r = rand(), loot: {stones?: number; potions?: number; points?: number} = r < 0.45 ? {stones: 1 + Math.floor(rand() * 2)} : r < 0.8 ? {potions: 1} : {points: 30};
    tp.stones = (tp.stones || 0) + (loot.stones || 0); tp.potions += loot.potions || 0;
    if (loot.points) loot.points = awardCapped(s, loot.points, 0).points;
    return {opened: type, loot, ...clearFloor(tp, s, floor, false)};
  }
  const words = shuffle(pool.words, rand);
  tp.event = {id: randomDocId(rand), floor, door, type, q: null, stock: {stone: 1 + Math.floor(rand() * 3), potion: PET_TOWER.merchantPotions}, pool: {...pool, words}, wrongs: [], startedAt: now};
  if (type === 'riddle' || type === 'trap') tp.event.q = question(words, 0, type, now, rand);
  if (type === 'sleeping') tp.event.color = Math.floor(seeded(`${uid}:${pet.slot}:${floor}:dragon`)() * PET_TOWER.dragonColors);
  return {opened: type};
}
/** A battle behind the chosen door, whatever the layout (tests and tools). */
export const startTowerRun = (t: TowerState, s: ServerPetState, pool: TowerPool, now: number, rand: () => number = Math.random, doorInput: unknown = 0) => openTowerDoor(t, s, 'test', pool, now, rand, doorInput, ['monster', 'monster', 'monster']);

/** Floor cleared: saved, the first clear pays points and XP (inside the daily cap), a boss floor opens its chest. */
function clearFloor(tp: TowerPet, s: ServerPetState, floor: number, boss: boolean) {
  const first = floor > tp.best;
  tp.best = Math.max(tp.best, floor); tp.floor = Math.max(tp.floor, floor + 1);
  let points = 0, xp = 0;
  if (first) { const r = PET_TOWER.reward, want = boss ? r.boss : r.base + r.perFloor * floor, got = awardCapped(s, want, want * 2); points = got.points; xp = got.xp; }
  return {cleared: true, floor, first, points, xp, chest: boss ? openChestFor(tp, floor) : null};
}
const ended = (tp: TowerPet, run: TowerRun) => { tp.run = null; return {runId: run.id, wrongs: run.wrongs, right: run.right, asked: run.asked, wordbookId: run.wordbookId, wordbookTitle: run.wordbookTitle, startedAt: run.startedAt}; };
const eventEnded = (tp: TowerPet, ev: TowerEventState, right: number, asked: number) => { tp.event = null; return {runId: ev.id, wrongs: ev.wrongs, right, asked, wordbookId: ev.pool.wordbookId, wordbookTitle: ev.pool.wordbookTitle, startedAt: ev.startedAt}; };

/** The pet's turn: attack (a word question follows), drink a potion (the monster then attacks), or run away (탈진). */
export function towerAct(t: TowerState, s: ServerPetState, action: unknown, now: number, rand: () => number = Math.random) {
  const pet = currentPet(s), tp = towerPet(t, pet.slot), run = tp.run;
  if (!run) throw Error('TOWER_NO_RUN');
  if (run.phase !== 'act') throw Error('TOWER_WAIT');
  if (action === 'attack') { ask(run, 'attack', now, rand); return {phase: run.phase}; }
  if (action === 'skill') throw Error('TOWER_SKILL_LOCKED');
  if (action === 'potion') {
    if (tp.potions <= 0) throw Error('TOWER_NO_POTION');
    tp.potions -= 1; const heal = Math.round(run.maxHp * PET_TOWER.potionHeal); run.hp = Math.min(run.maxHp, run.hp + heal);
    ask(run, 'defend', now, rand); return {phase: run.phase, healed: heal};
  }
  if (action === 'flee') { pet.energy = 0; return {fled: true, floor: run.floor, end: ended(tp, run)}; }
  throw Error('PET_BAD_ACTION');
}

const wrongOf = (q: TowerQuestion, choice: number, late: boolean): TowerWrong => ({word: q.word, meaning: q.meaning, userChoice: late ? '시간 초과' : String(q.choices[choice] ?? ''), correctAnswer: q.choices[q.answer], choices: q.choices, quizSentence: ''});

/** An answer: on the attack, right = hit; on the monster's turn, right in time = blocked. The end of the battle settles
 *  the floor here (saved, first-clear points, the boss chest, maybe a 강화석). */
export function towerAnswer(t: TowerState, s: ServerPetState, runId: unknown, choiceInput: unknown, now: number, rand: () => number = Math.random) {
  const pet = currentPet(s), tp = towerPet(t, pet.slot), run = tp.run;
  if (!run || run.id !== runId || !run.q) throw Error('TOWER_NO_RUN');
  const q = run.q, choice = Number(choiceInput), late = q.deadline !== null && now > q.deadline + 1500;
  const correct = !late && choice === q.answer;
  const out: any = {kind: q.kind, correct, late, answer: q.answer, word: q.word, meaning: q.meaning};
  if (correct) { run.right += 1; run.mp = Math.min(run.maxMp, run.mp + 2); }
  else run.wrongs.push(wrongOf(q, choice, late));
  run.q = null;
  const st = petTowerStats(pet, tp);
  if (q.kind === 'attack') {
    run.attacks += 1;
    if (correct) { out.damage = Math.max(1, Math.round(towerHit(st.atk, run.monster.def) * (0.9 + rand() * 0.2))); run.monster.hp = Math.max(0, run.monster.hp - out.damage); }
    if (run.monster.hp <= 0) return {...out, ...win(tp, s, run, rand)};
    ask(run, 'defend', now, rand); return out;
  }
  out.taken = towerTaken(run.monster.atk, st.def, correct); run.hp = Math.max(0, run.hp - out.taken);
  if (run.hp <= 0) return {...out, lost: true, floor: run.floor, end: ended(tp, run)};
  run.phase = 'act'; return out;
}
function win(tp: TowerPet, s: ServerPetState, run: TowerRun, rand: () => number) {
  const potions = run.bonus?.potions || 0; tp.potions += potions;
  const stone = !run.monster.boss && rand() < PET_TOWER.stoneDrop ? 1 : 0; tp.stones = (tp.stones || 0) + stone;
  return {won: true, attacks: run.attacks, potions, stone, ...clearFloor(tp, s, run.floor, run.monster.boss), end: ended(tp, run)};
}

/** Playing an event behind a door. 요정: save it (a potion) or fight it (two potions for winning). 상인: buy, enhance,
 *  leave. 석상 / 함정: one answer. 잠든 몬스터: sneaking past (the mini-game is played in the browser) or waking it. */
export function towerEvent(t: TowerState, s: ServerPetState, move: unknown, input: any, now: number, rand: () => number = Math.random) {
  const pet = currentPet(s), tp = towerPet(t, pet.slot), ev = tp.event;
  if (!ev) throw Error('TOWER_NO_RUN');
  const stone = (n = 1) => { tp.stones = (tp.stones || 0) + n; return n; };
  if (ev.type === 'fairy') {
    if (move === 'save') { tp.potions += 1; return {saved: true, potions: 1, ...clearFloor(tp, s, ev.floor, false), end: eventEnded(tp, ev, 0, 0)}; }
    if (move === 'fight') { const run = battle(tp, pet, ev.pool, fairyOf(ev.floor), ev.floor, now, rand); run.bonus = {potions: 2}; tp.event = null; return {fight: true}; }
  }
  if (ev.type === 'merchant') {
    if (move === 'buy') {
      const item = input?.item === 'potion' ? 'potion' : input?.item === 'stone' ? 'stone' : null; if (!item) throw Error('PET_BAD_ACTION');
      if (ev.stock[item] <= 0) throw Error('TOWER_SOLD_OUT');
      const price = item === 'stone' ? PET_TOWER.stonePrice : PET_TOWER.potionPrice; if (s.points < price) throw Error('PET_NOT_ENOUGH_POINTS');
      s.points -= price; ev.stock[item] -= 1; if (item === 'stone') stone(); else tp.potions += 1;
      return {bought: item, price};
    }
    if (move === 'enhance') {
      const id = String(input?.gearId || ''); if (!tp.gear.includes(id)) throw Error('PET_ITEM_NOT_OWNED');
      const level = tp.levels![id] || 0, step = TOWER_ENHANCE[level]; if (!step) throw Error('TOWER_MAX_ENHANCE');
      if ((tp.stones || 0) < step.stones) throw Error('TOWER_NO_STONES');
      tp.stones = (tp.stones || 0) - step.stones;
      const ok = rand() < step.rate; if (ok) tp.levels![id] = step.to;
      return {enhanced: ok, gearId: id, level: tp.levels![id] || 0, stones: step.stones};
    }
    if (move === 'leave') return {left: true, ...clearFloor(tp, s, ev.floor, false), end: eventEnded(tp, ev, 0, 0)};
  }
  if ((ev.type === 'riddle' || ev.type === 'trap') && move === 'answer' && ev.q) {
    const q = ev.q, choice = Number(input?.choice), late = q.deadline !== null && now > q.deadline + 1500, correct = !late && choice === q.answer;
    const out = {correct, late, answer: q.answer, word: q.word, meaning: q.meaning};
    if (!correct) ev.wrongs.push(wrongOf(q, choice, late));
    ev.q = null;
    if (correct) return {...out, stone: stone(), ...clearFloor(tp, s, ev.floor, false), end: eventEnded(tp, ev, 1, 1)};
    if (ev.type === 'riddle') return {...out, stone: 0, ...clearFloor(tp, s, ev.floor, false), end: eventEnded(tp, ev, 0, 1)};
    // 함정에 빠짐: a monster jumps in while the pet is hurt (70% HP); the missed word goes with that battle.
    const missed = ev.wrongs; tp.event = null;
    const run = battle(tp, pet, ev.pool, towerMonster(ev.floor, ev.door), ev.floor, now, rand, 0.7); run.wrongs.push(...missed); run.asked += 1;
    return {...out, trapped: true};
  }
  if (ev.type === 'sleeping' && move === 'sneak') {
    if (input?.ok === true) {
      // The mini-game runs in the browser; the server checks its time and the path it reports before letting the pet past.
      if (!sneakLooksPlayed(input.samples, now - ev.startedAt)) throw Error('TOWER_SNEAK_INVALID');
      return {sneaked: true, stone: stone(), ...clearFloor(tp, s, ev.floor, false), end: eventEnded(tp, ev, 0, 0)};
    }
    tp.event = null; battle(tp, pet, ev.pool, dragonOf(ev.color), ev.floor, now, rand); return {woke: true};
  }
  throw Error('PET_BAD_ACTION');
}

/** The sneak path the browser reports: [ms, progress 0–1] samples, at least `sneakMinMs` long on the server's clock and in
 *  the samples, ending at the exit, never faster than a slow walk (a little looser than the browser's own limit). */
export function sneakLooksPlayed(samples: unknown, serverMs: number) {
  if (serverMs < PET_TOWER.sneakMinMs || !Array.isArray(samples) || samples.length < 10 || samples.length > 600) return false;
  const list = samples.map((x: any) => Array.isArray(x) ? [Number(x[0]), Number(x[1])] : [NaN, NaN]);
  if (list.some(([t, p]) => !Number.isFinite(t) || !Number.isFinite(p) || p < 0 || p > 1)) return false;
  for (let i = 1; i < list.length; i++) if (list[i][0] < list[i - 1][0]) return false;
  const [t0, p0] = list[0], [tn, pn] = list[list.length - 1];
  // The walk has to start at the entrance, end at the exit and get there in small steps (no jumps, hardly any going back).
  if (p0 > 0.08 || pn < 0.9 || tn - t0 < PET_TOWER.sneakMinMs) return false;
  for (let i = 1; i < list.length; i++) { const dp = list[i][1] - list[i - 1][1]; if (dp > 0.15 || dp < -0.05) return false; }
  for (let i = 0, j = 0; i < list.length; i++) { while (j < list.length && list[j][0] - list[i][0] < 250) j++; if (j < list.length && (list[j][1] - list[i][1]) / ((list[j][0] - list[i][0]) / 1000) > 0.45) return false; }
  return true;
}

/** What the browser sees: the current pet's climb, its stats, the battle or event — without answers, word pools or what
 *  is behind the doors not yet opened. */
export function publicTower(t: TowerState, s: ServerPetState, now: number) {
  const pet = currentPet(s), tp = towerPet(t, pet.slot), run = tp.run, ev = tp.event;
  const pq = (q: TowerQuestion | null) => q && {kind: q.kind, prompt: q.kind === 'defend' || q.kind === 'trap' ? q.word : q.meaning, choices: q.choices, msLeft: q.deadline === null ? null : Math.max(0, q.deadline - now)};
  return {
    floor: tp.floor, best: tp.best, top: PET_TOWER.floors, gear: tp.gear, equip: tp.equip, levels: tp.levels || {}, chests: tp.chests, potions: tp.potions, stones: tp.stones || 0, stats: petTowerStats(pet, tp),
    run: run && {id: run.id, floor: run.floor, monster: {kind: run.monster.kind, name: run.monster.name, boss: run.monster.boss, hp: run.monster.hp, max: run.monster.max, color: run.monster.color ?? null},
      hp: run.hp, maxHp: run.maxHp, mp: run.mp, maxMp: run.maxMp, phase: run.phase, attacks: run.attacks, q: pq(run.q)},
    event: ev && {id: ev.id, floor: ev.floor, type: ev.type, stock: ev.type === 'merchant' ? ev.stock : null, q: pq(ev.q), color: ev.color ?? null},
  };
}

// ---- words: the hard wordbook the admin set for the student's school level ----
async function studentName(db: any, uid: string) {
  const key = (await db.collection('users').doc(uid).get()).data()?.notionStudentKey;
  if (typeof key !== 'string' || !key) return '';
  const row = (await db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students', key)).get()).data();
  return String(row?.kind === 'students' ? row.fields?.summaryOverride?.studentDisplayName || '' : '') || String((await readStudentMapping(db, key))?.studentDisplayName || '');
}
/** 고등 students get the 고등 book; 중등, 초등 and anyone whose grade isn't known get the 중등 book. */
export const towerLevelFor = (displayName: string) => gradeOf(displayName)?.startsWith('고') ? 'high' : 'middle';
/** The book for this student: the admin's setting for their school level. */
export async function towerBookFor(db: any, uid: string) {
  const settings = (await db.collection(PET_TOWER_SETTINGS).doc('main').get()).data() || {};
  const bookId = settings[towerLevelFor(await studentName(db, uid))];
  if (typeof bookId !== 'string' || !bookId) throw Error('TOWER_NOT_READY');
  const book = (await db.collection('wordbooks').doc(bookId).get()).data(); if (!book) throw Error('TOWER_NOT_READY');
  return {wordbookId: bookId, wordbookTitle: String(book.title || '탑 단어장').slice(0, 60)};
}
/** A window of that book's words from a random place (not the whole book, to keep reads small). */
export async function loadTowerPool(db: any, uid: string, rand: () => number = Math.random) {
  const {wordbookId: bookId, wordbookTitle} = await towerBookFor(db, uid);
  const words = db.collection(`wordbooks/${bookId}/words`), size = PET_TOWER.poolSize;
  const first = await words.orderBy(FieldPath.documentId()).startAt(randomDocId(rand)).limit(size).get();
  const rest = first.size < size ? await words.orderBy(FieldPath.documentId()).limit(size - first.size).get() : {docs: []};
  const seen = new Set<string>(), list: PoolWord[] = [];
  for (const d of [...first.docs, ...rest.docs]) {
    if (seen.has(d.id)) continue; seen.add(d.id); const x = d.data();
    if (typeof x?.word === 'string' && typeof x?.meaning === 'string' && x.word.trim() && x.meaning.trim()) list.push({w: x.word.trim().slice(0, 60), m: x.meaning.trim().slice(0, 80)});
  }
  if (list.length < 8) throw Error('TOWER_NOT_READY');
  return {words: list, wordbookId: bookId, wordbookTitle};
}
/** The study session for a finished battle's missed words (null when none). Written in the same transaction that ends
 *  the battle, so the words can't be lost; the id is per battle (its run id), so two pets never share one. */
export function towerWrongsSession(uid: string, end: {runId: string; wrongs: TowerWrong[]; right: number; asked: number; wordbookId: string; wordbookTitle: string; startedAt: number}, now: number) {
  if (!end.wrongs.length) return null;
  return {id: `tower_${uid}_${end.runId}`, data: {uid, wordbookId: end.wordbookId, wordbookTitle: `${PET_TOWER.name} · ${end.wordbookTitle}`, type: 'quiz', category: 'word',
    duration: Math.max(1, Math.round((now - end.startedAt) / 1000)), score: end.right, totalItems: Math.max(1, end.asked), incorrectAnswers: end.wrongs, createdAt: new Date(now)}};
}

// ---- 관리자 설정 › 탑 단어장 ----
function admin(actor: any) { if (!actor.admin || actor.academyId !== 'main') throw Error('FORBIDDEN'); }
export async function readTowerSettings(db: any, actor: any) {
  admin(actor);
  const [settings, books] = await Promise.all([db.collection(PET_TOWER_SETTINGS).doc('main').get(), db.collection('wordbooks').get()]);
  const list = books.docs.map((d: any) => ({id: d.id, ...d.data()})).filter((b: any) => (b.category || 'word') === 'word' && (!b.type || b.type === 'standard'))
    .map((b: any) => ({id: b.id, title: String(b.title || '제목 없음')})).sort((a: any, b: any) => a.title.localeCompare(b.title, 'ko'));
  const s = settings.data() || {};
  return {middle: s.middle || '', high: s.high || '', books: list};
}
export async function saveTowerSettings(db: any, actor: any, input: any) {
  admin(actor);
  const clean = async (v: unknown) => { const id = typeof v === 'string' ? v.trim() : ''; if (!id) return ''; if (!(await db.collection('wordbooks').doc(id).get()).exists) throw Error('BAD_REQUEST'); return id; };
  const next = {middle: await clean(input?.middle), high: await clean(input?.high), updatedAt: Date.now(), updatedBy: actor.uid || 'admin'};
  await db.collection(PET_TOWER_SETTINGS).doc('main').set(next);
  return {middle: next.middle, high: next.high};
}
export type {TowerGear};
