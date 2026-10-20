// 채움의 탑: turn-based battles, one floor each, kept per pet in petTowers/{uid} (server only). The server holds the
// monster, both HPs, the question and its answer; the browser only sees the question and its choices. Attack: answer the
// word (right = hit). The monster's turn: answer the meaning before the deadline to block. Clearing a floor saves it;
// a fallen pet tries the same floor again; running away empties 기운 (탈진).
import {FieldPath} from 'firebase-admin/firestore';
import { orderPieces, shuffledOrder } from '../../src/lib/sentenceGame.js';
import {readStudentMapping} from './studentIdentity.js';
import {DIRECTORY_ROWS, directoryRowKey} from './academyDirectorySource.js';
import {awardCapped, awardFirstClear, currentPet, type ServerPet, type ServerPetState} from './pet.js';
import {meaningsOverlap, randomDocId} from './petWordFeed.js';
import { TOWER_DECOR, PET_JOB3, PET_JOB3_RULE, job3For, TOWER_ZONES, BRANCH_PASSIVE, TOWER_GEAR, TOWER_SKILL_RULES, TOWER_WEAKNESS, critChance, jobSkills, skillLevel, towerSkill,PET_TOWER, TOWER_CHESTS, TOWER_ENHANCE, TOWER_EVENTS, towerGear, towerGearFor, towerHit, towerMonster, towerStats, towerTaken, TOWER_DEBUFFS, TOWER_DEBUFF_RULES, debuffEffect, type TowerDebuff, FOE_RAGE, FOE_RULES, foeQuiet, foeSkill, foeSkillsFor, gearLookOf, petGearView, type PetGearLook, GEAR_DROP, TOWER_GEAR_SLOTS, floorGearTier, setGearId, type TowerEvent, type TowerGear, type TowerGearSlot, type TowerMonsterKind} from '../../src/lib/petCatalog.js';
import {gradeOf} from '../../src/lib/schoolGrade.js';
import {initGame, isMiniGame, playGame, publicGame, type GameResult} from './towerGames.js';

export const PET_TOWERS = 'petTowers';
export const PET_TOWER_SETTINGS = 'petTowerSettings';
/** A word in play; `b`: the wordbook it came from (the tower mixes up to three books). */
interface PoolWord { w: string; m: string; b?: string }
/** A sentence for the skills' 문장 배열 (the grade's 문장 세트, as in 원정대). */
export interface TowerSentence { wordbookId: string; text: string; chunked: string; meaning: string }
interface TowerPool { words: PoolWord[]; wordbookId: string; wordbookTitle: string; books?: {id: string; title: string}[]; sentences?: TowerSentence[] }
interface TowerQuestion { kind: 'attack' | 'defend' | 'riddle' | 'trap'; word: string; meaning: string; choices: string[]; answer: number; issuedAt: number; deadline: number | null; book?: string; /** a skill's 문장 배열: the pieces, shuffled (`word` is the sentence) */ order?: string[] }
interface TowerWrong { word: string; meaning: string; userChoice: string; correctAnswer: string; choices: string[]; quizSentence: string; wordbookId?: string }
export interface TowerRun {
  id: string; floor: number; monster: {kind: TowerMonsterKind; name: string; boss: boolean; hp: number; max: number; atk: number; def: number; color?: number};
  hp: number; maxHp: number; mp: number; maxMp: number; phase: 'act' | 'attack' | 'defend'; q: TowerQuestion | null; attacks: number;
  right: number; asked: number; wrongs: TowerWrong[]; pool: PoolWord[]; next: number; wordbookId: string; wordbookTitle: string; startedAt: number; books?: {id: string; title: string}[];
  /** Extra prize for winning (길 잃은 요정 fought: two potions). */ bonus?: {potions?: number};
  /** The skill the pending attack question casts; 방패 막기 up for the monster's next attack. */ skill?: string | null; shield?: boolean;
  /** 그믐 저주 has cut the monster's 공격 (once a battle). */ weakened?: boolean;
  /** Skills ask 문장 배열 from these (none: a word question as before); `ns` the next one. */ sentences?: TowerSentence[]; ns?: number;
  /** 몬스터 스킬 (battles from before have none). */ foe?: TowerFoe;
  /** what this battle started with (쉬어 가기 놀이 lost; `debuff`: one, before they piled up); `blocksUsed`: block questions 귀가 멍멍 has shortened (`deafUsed`: the first, before they piled up) */ debuffs?: TowerDebuff[]; debuff?: TowerDebuff; deafUsed?: boolean; blocksUsed?: number;
}
/** A monster's skills in a battle: the one it warned of (`next`, used on its next turn), and what lasts: 방어 태세 (pet attacks
 *  left), 봉인 and 지속 피해 on the pet (rounds left), 분노. `hit`: the pet hit it this round (cancels 재생); `hits`: the first
 *  of a 연속 공격 is done; `last`: it just used a skill (the next turn is a plain attack). */
export interface TowerFoe { skills: string[]; next: string | null; last: boolean; guard: number; sealed: number; sealNew?: boolean; dot: {name: '화상' | '독' | '저주'; turns: number} | null; hit: boolean; hits: number; rage: boolean; raged: boolean }
/** A door's event that isn't a battle (yet): the 상인's stock, a riddle or trap question, the fairy's choice. */
export interface TowerEventState { id: string; floor: number; door: number; type: Exclude<TowerEvent, 'monster' | 'mirror' | 'treasure'>; q: TowerQuestion | null; stock: {stone: number; potion: number}; pool: TowerPool; wrongs: TowerWrong[]; startedAt: number; /** 잠든 드래곤's look */ color?: number;
  /** a 쉬어 가기 놀이's own state (secrets stay on the server) */ game?: any }
/** One pet's climb: `floor` is the next floor to play (saved on every clear), `best` the highest cleared. `levels`: 강화 by gear. */
export interface TowerPet { /** 쉬어 가기 놀이 lost: the next battle starts with these (TOWER_DEBUFFS); `debuff`, `curse`: older single ones */ debuffs?: TowerDebuff[]; debuff?: TowerDebuff; curse?: boolean; floor: number; best: number; gear: string[]; equip: Partial<Record<TowerGearSlot, string>>; chests: number[]; potions: number; stones?: number; levels?: Record<string, number>; run: TowerRun | null; event?: TowerEventState | null; /** the last door opened (a resent request gets the same answer) */ lastOpen?: {id: string; result: any} | null }
/** 도감 entry: the floor where the student first met the monster, how often it was beaten, when it was first met (the order). */
export interface TowerCodexEntry { name: string; boss: boolean; first: number; wins: number; at: number }
export interface TowerState { version: 1; pets: Record<string, TowerPet>; updatedAt: number; /** monster kinds whose weakness a crit has revealed (도감) */ weakFound?: string[]; /** 도감: every monster kind met, for all the student's pets */ codex?: Record<string, TowerCodexEntry> }
export const initialTower = (now = Date.now()): TowerState => ({version: 1, pets: {}, updatedAt: now});
export function towerPet(t: TowerState, slot: number): TowerPet {
  t.pets ||= {};
  const tp = t.pets[String(slot)] ||= {floor: 1, best: 0, gear: [], equip: {}, chests: [], potions: 0, run: null};
  tp.stones ??= 0; tp.levels ??= {}; tp.event ??= null;
  return tp;
}
/** Worn gear as this pet wears it (boss treasures take the job's name and stats). */
const worn = (tp: TowerPet, pet: ServerPet) => Object.values(tp.equip).map(id => towerGearFor(String(id), pet.job));
/** 원정대 job weapons the student owns, for this pet's job (and branch), count as this pet's tower gear. */
function syncJobWeapons(tp: TowerPet, pet: ServerPet, s: ServerPetState) {
  for (const g of TOWER_GEAR) if (g.expedition && s.inventory.includes(g.id) && g.job === pet.job && (!g.job2 || g.job2 === pet.job2) && (!g.job3 || g.job3 === pet.job3) && !tp.gear.includes(g.id)) tp.gear.push(g.id);
}
/** Each pet keeps how its worn gear looks (the home, the ranking and the party draw it without the tower). */
export function syncGearLooks(t: TowerState, s: ServerPetState) {
  for (const pet of s.pets) { const tp = t.pets?.[String(pet.slot)]; if (tp) pet.gear = gearLookOf(usableEquip(pet, tp)); }
}
/** Worn gear this pet can use (a job weapon of another job is left out). */
const usableEquip = (pet: ServerPet, tp: TowerPet) => Object.fromEntries(Object.entries(tp.equip || {}).filter(([, id]) => { const g = towerGear(String(id)); return g && (!g.job || g.job === pet.job) && (!g.job2 || g.job2 === pet.job2) && (!g.job3 || g.job3 === pet.job3); }));
/** How the pet's gear looks: what it keeps, or (before its first tower visit since the gear came) worked out from the tower
 *  for this answer only, never saved. */
export const gearLookFor = (pet: ServerPet, tp?: TowerPet | null): PetGearLook | null => pet.gear ?? (tp ? gearLookOf(usableEquip(pet, tp)) : null);
/** What other screens draw (ranking, party, 명예의 전당): the pet's 👁 setting already applied. */
export const gearViewFor = (pet: ServerPet, tp?: TowerPet | null) => petGearView({...pet, gear: gearLookFor(pet, tp)});
export const petTowerStats = (pet: ServerPet, tp: TowerPet) => towerStats(pet.level, worn(tp, pet), tp.levels || {});
const shuffle = <T,>(list: T[], rand: () => number) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** A repeatable random series from a text (the door layout of one pet's floor). */
export function seeded(text: string) {
  let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let x = h; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
/** The three doors of a floor for this pet: fixed (a retry finds the same doors), different for every student. */
export function towerLayout(uid: string, slot: number, floor: number): TowerEvent[] {
  // only what has opened by this floor (쉬어 가기 놀이 open zone by zone)
  const rand = seeded(`${uid}:${slot}:${floor}`), all = (Object.entries(TOWER_EVENTS) as [TowerEvent, {weight: number; from?: number}][]).filter(([, e]) => (e.from || 1) <= floor), total = all.reduce((n, [, e]) => n + e.weight, 0);
  return Array.from({length: PET_TOWER.doors}, () => { let r = rand() * total; for (const [k, e] of all) { r -= e.weight; if (r < 0) return k; } return 'monster' as TowerEvent; });
}

/** A treasure chest: its gear (worn at once when that place is empty) and potions, once per pet. */
function openChestFor(tp: TowerPet, floor: number, pet?: ServerPet) {
  const chest = TOWER_CHESTS[floor]; if (!chest || tp.chests.includes(floor)) return null;
  tp.chests.push(floor); tp.potions += chest.potions; tp.stones = (tp.stones || 0) + (chest.stones || 0);
  // A job weapon treasure: the one for this pet's job (a pet without a job finds a 강화석 instead).
  const jobWeapon = chest.jobWeapon ? (pet?.job ? chest.jobWeapon[pet.job] : null) : null;
  if (chest.jobWeapon && !jobWeapon) tp.stones = (tp.stones || 0) + 1;
  const gear = [...chest.gear, ...(jobWeapon ? [jobWeapon] : [])].filter(id => towerGear(id) && !tp.gear.includes(id));
  for (const id of gear) { tp.gear.push(id); const g = towerGear(id)!; if (!tp.equip[g.slot]) tp.equip[g.slot] = id; }
  return {floor, gear, potions: chest.potions, ...(chest.stones ? {stones: chest.stones} : {})};
}
/** The chest at the entrance (floor 1): the 견습 몽둥이 and the first potions. */
export function openEntranceChest(t: TowerState, s: ServerPetState) {
  const out = openChestFor(towerPet(t, currentPet(s).slot), 1, currentPet(s)); if (!out) throw Error('TOWER_CHEST_OPENED');
  return {chest: out};
}
/** Wear a piece of tower gear the pet has (or take it off when it is already worn). */
export function equipTowerGear(t: TowerState, s: ServerPetState, idInput: unknown) {
  const pet = currentPet(s), tp = towerPet(t, pet.slot), id = String(idInput || ''), g = towerGear(id);
  syncJobWeapons(tp, pet, s);
  if (!g || !tp.gear.includes(id)) throw Error('PET_ITEM_NOT_OWNED');
  if (tp.run || tp.event) throw Error('TOWER_IN_BATTLE');
  if ((g.job && pet.job !== g.job) || (g.job2 && pet.job2 !== g.job2) || (g.job3 && pet.job3 !== g.job3)) throw Error('TOWER_GEAR_JOB');
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
    if (wrong.length === PET_TOWER.choices - 1) { const choices = shuffle([target.w, ...wrong], rand); return {kind, word: target.w, meaning: target.m, choices, answer: choices.indexOf(target.w), issuedAt: now, deadline: null, ...(target.b ? {book: target.b} : {})}; }
  }
  const byWord = kind === 'attack' || kind === 'riddle', right = byWord ? target.w : target.m, choices = shuffle([right, ...otherChoices(pool, target, byWord ? 'w' : 'm', rand)], rand);
  const seconds = kind === 'defend' ? PET_TOWER.defendSeconds : kind === 'trap' ? PET_TOWER.trapSeconds : 0;
  return {kind, word: target.w, meaning: target.m, choices, answer: choices.indexOf(right), issuedAt: now, deadline: seconds ? now + seconds * 1000 : null, ...(target.b ? {book: target.b} : {})};
}
/** A skill's question: put the sentence's pieces in order (its meaning shown); false when there is no sentence to ask. */
function askSentence(run: TowerRun, now: number, rand: () => number) {
  const list = run.sentences || [];
  for (let tries = 0; tries < list.length; tries++) {
    const x = list[(run.ns || 0) % list.length]; run.ns = (run.ns || 0) + 1;
    const pieces = orderPieces({word: x.text, chunked: x.chunked, meaning: x.meaning});
    if (pieces.length < 3) continue;
    run.q = {kind: 'attack', word: x.text, meaning: x.meaning, choices: [], answer: -1, issuedAt: now, deadline: null, order: shuffledOrder(pieces, rand).map(i => pieces[i])};
    run.asked += 1; run.phase = 'attack'; return true;
  }
  return false;
}
const sameSentence = (a: string, b: string) => { const n = (t: string) => t.toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim(); return n(a) === n(b); };
function ask(run: TowerRun, kind: 'attack' | 'defend', now: number, rand: () => number) {
  run.q = question(run.pool, run.next, kind, now, rand); run.next += 1; run.asked += 1; run.phase = kind;
}
/** After a plain attack the monster may warn of a skill for its next turn (never two skills in a row). */
function planFoe(run: TowerRun, rand: () => number) {
  const f = run.foe; if (!f?.skills.length) return;
  if (f.last) { f.last = false; f.next = null; return; }
  f.next = rand() < (run.monster.boss ? FOE_RULES.bossChance : FOE_RULES.chance) ? f.skills[Math.min(f.skills.length - 1, Math.floor(rand() * f.skills.length))] : null;
}
/** The end of a round: 봉인 counts down (not the round it came), 지속 피해 hurts and counts down. */
function endRound(run: TowerRun, out: any) {
  const f = run.foe; if (!f) return;
  if (f.sealed > 0 && !f.sealNew) f.sealed -= 1; f.sealNew = false;
  if (f.dot) { const d = Math.max(1, Math.round(run.maxHp * FOE_RULES.dotPct)); run.hp = Math.max(0, run.hp - d); out.dot = {name: f.dot.name, damage: d}; f.dot.turns -= 1; if (f.dot.turns <= 0) f.dot = null; }
  f.hit = false;
}
/** The monster's turn after the pet acted: a quiet skill (방어 태세, 재생) is its whole turn; otherwise it attacks (a block
 *  question; 묶기 makes it shorter). 'lost': 지속 피해 ended the battle. */
function monsterTurn(run: TowerRun, now: number, rand: () => number, out: any): 'defend' | 'quiet' | 'lost' {
  const f = run.foe, k = f?.next ? foeSkill(f.next) : null;
  if (f && k && foeQuiet(k)) {
    out.foe = {skill: k.id, name: k.name};
    if (k.fx.includes('guard')) { f.guard = FOE_RULES.guardTurns; out.foe.guard = f.guard; }
    if (k.fx.includes('regen')) {
      if (f.hit) out.foe.canceled = true;
      else { const heal = Math.max(1, Math.round(run.monster.max * FOE_RULES.regen)); run.monster.hp = Math.min(run.monster.max, run.monster.hp + heal); out.foe.healed = heal; }
    }
    f.next = null; f.last = true; endRound(run, out);
    if (run.hp <= 0) return 'lost';
    run.phase = 'act'; planFoe(run, rand); return 'quiet';
  }
  ask(run, 'defend', now, rand);
  if (k?.fx.includes('bind') && run.q) run.q.deadline = now + FOE_RULES.bindSeconds * 1000;
  // 귀가 멍멍: each one piled up shortens one block question
  const blocks = runDebuffs(run).filter(d => debuffEffect(d) === 'block').length, used = run.blocksUsed ?? (run.deafUsed ? 1 : 0);
  if (used < blocks && run.q) { run.q.deadline = Math.min(run.q.deadline ?? Infinity, now + TOWER_DEBUFF_RULES.blockSeconds * 1000); run.blocksUsed = used + 1; }
  return 'defend';
}

type Foe = {kind: TowerMonsterKind; name: string; boss: boolean; hp: number; atk: number; def: number; color?: number};
function battle(tp: TowerPet, pet: ServerPet, pool: TowerPool, m: Foe, floor: number, now: number, rand: () => number, hpShare = 1) {
  const st = petTowerStats(pet, tp), debuffs = pendingDebuffs(tp);
  delete tp.debuffs; delete tp.debuff; delete tp.curse; // only the next battle
  for (const d of debuffs) if (debuffEffect(d) === 'hp') hpShare *= TOWER_DEBUFF_RULES.hp;
  tp.run = {id: randomDocId(rand), floor, monster: {kind: m.kind, name: m.name, boss: m.boss, hp: m.hp, max: m.hp, atk: m.atk, def: m.def, ...(m.color !== undefined ? {color: m.color} : {})},
    hp: Math.max(1, Math.round(st.hp * hpShare)), maxHp: st.hp, mp: st.mp, maxMp: st.mp, phase: 'act', q: null, attacks: 0, right: 0, asked: 0, wrongs: [],
    pool: shuffle(pool.words, rand), next: 0, wordbookId: pool.wordbookId, wordbookTitle: pool.wordbookTitle, startedAt: now, ...(pool.books ? {books: pool.books} : {}),
    ...(pool.sentences?.length ? {sentences: shuffle(pool.sentences, rand).slice(0, 12), ns: 0} : {})};
  const skills = foeSkillsFor(m.kind, floor);
  if (skills.length) tp.run.foe = {skills: skills.map(k => k.id), next: null, last: false, guard: 0, sealed: 0, dot: null, hit: false, hits: 0, rage: FOE_RAGE.has(m.kind), raged: false};
  if (debuffs.length) {
    tp.run.debuffs = debuffs;
    for (const id of debuffs) {
      const d: {effect: string; dot?: '화상' | '독'} = TOWER_DEBUFFS[id];
      if (d.effect === 'mp') tp.run.mp = Math.round(tp.run.mp * TOWER_DEBUFF_RULES.mp);
      // one 지속 피해 at a time (two of them: the longer)
      if (d.effect === 'dot') { const foe = tp.run.foe ||= {skills: [], next: null, last: false, guard: 0, sealed: 0, dot: null, hit: false, hits: 0, rage: false, raged: false}; foe.dot = {name: d.dot || '독', turns: foe.dot ? foe.dot.turns + 1 : TOWER_DEBUFF_RULES.dotTurns}; }
    }
  }
  return tp.run;
}
/** 거울방: the pet's own shadow, a little weaker than the pet. */
const shadowOf = (pet: ServerPet, tp: TowerPet): Foe => { const st = petTowerStats(pet, tp); return {kind: 'shadow', name: `${pet.name}의 그림자`, boss: false, hp: Math.round(st.hp * 0.85), atk: Math.round(st.atk * 0.85), def: Math.round(st.def * 0.85)}; };
/** 깨어난 드래곤: end-game strength, whatever the floor. */
const dragonOf = (color = 0): Foe => ({kind: 'dragon', name: '깨어난 드래곤', boss: false, ...PET_TOWER.dragon, color});
const fairyOf = (floor: number): Foe => { const m = towerMonster(floor); return {kind: 'fairy', name: '수상한 요정', boss: false, hp: Math.round(m.hp * 0.9), atk: Math.round(m.atk * 0.9), def: m.def}; };

/** 도감: a monster is written down the first time any of the student's pets meets it (the shadow under one name). */
function meet(t: TowerState, tp: TowerPet, now: number) {
  const m = tp.run?.monster; if (!m || t.codex?.[m.kind]) return;
  (t.codex ||= {})[m.kind] = {name: m.kind === 'shadow' ? '그림자' : m.name, boss: m.boss, first: tp.run!.floor, wins: 0, at: now};
}

/** Open one of the floor's doors (costs 기운): a battle, an instant treasure, or an event to play. `pool`: words from the
 *  tower wordbook, loaded before the transaction. */
export function openTowerDoor(t: TowerState, s: ServerPetState, uid: string, pool: TowerPool, now: number, rand: () => number = Math.random, doorInput: unknown = 0, layout?: TowerEvent[], requestId?: unknown) {
  const pet = currentPet(s), tp = towerPet(t, pet.slot), rid = typeof requestId === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(requestId) ? requestId : null;
  // A resent request (the answer got lost on the way) gets the same answer instead of opening the next floor's door.
  if (rid && tp.lastOpen?.id === rid) return {...tp.lastOpen.result, replayed: true};
  const out = openDoor(t, tp, pet, s, uid, pool, now, rand, doorInput, layout);
  meet(t, tp, now);
  if (rid && !out.resumed) tp.lastOpen = {id: rid, result: out};
  return out;
}
function openDoor(t: TowerState, tp: TowerPet, pet: ServerPet, s: ServerPetState, uid: string, pool: TowerPool, now: number, rand: () => number, doorInput: unknown, layout?: TowerEvent[]): any {
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
    if (loot.points) loot.points = awardCapped(s, loot.points, 0, 'adventure', '탑 보물').points;
    return {opened: type, loot, ...clearFloor(t, tp, s, floor, false, rand)};
  }
  const words = shuffle(pool.words, rand);
  tp.event = {id: randomDocId(rand), floor, door, type, q: null, stock: {stone: 1 + Math.floor(rand() * 3), potion: PET_TOWER.merchantPotions}, pool: {...pool, words}, wrongs: [], startedAt: now};
  if (type === 'riddle' || type === 'trap') tp.event.q = question(words, 0, type, now, rand);
  if (isMiniGame(type)) {
    let i = 0; const lines = shuffle(pool.sentences || [], rand);
    // a sentence in pieces (the same as a skill's 문장 배열), or null when the wordbook has none
    const sentence = () => { for (const x of lines) { const pieces = orderPieces({word: x.text, chunked: x.chunked, meaning: x.meaning}); if (pieces.length >= 3 && pieces.length <= 8) return {text: x.text, meaning: x.meaning, pieces}; } return null; };
    tp.event.game = initGame(type, rand, {ask: kind => question(words, i++, kind, now, rand), sentence});
  }
  if (type === 'sleeping') tp.event.color = Math.floor(seeded(`${uid}:${pet.slot}:${floor}:dragon`)() * PET_TOWER.dragonColors);
  return {opened: type};
}
/** A battle behind the chosen door, whatever the layout (tests and tools). */
export const startTowerRun = (t: TowerState, s: ServerPetState, pool: TowerPool, now: number, rand: () => number = Math.random, doorInput: unknown = 0) => openTowerDoor(t, s, 'test', pool, now, rand, doorInput, ['monster', 'monster', 'monster']);

/** 「별의 시험」: a pet with its 2차 job, at Lv.150, that has cleared floor 50 may take its branch's 3차 job. */
export const job3Ready = (pet: ServerPet, tp: TowerPet) => Boolean(pet.job2 && !pet.job3 && pet.level >= PET_JOB3_RULE.level && tp.best >= PET_JOB3_RULE.floor);
/** 3차 전직: the job of the pet's branch, its weapon (owned, in hand and as tower gear). */
export function takeJob3(t: TowerState, s: ServerPetState) {
  const pet = currentPet(s), tp = towerPet(t, pet.slot);
  if (pet.job3) throw Error('PET_JOB_TAKEN');
  if (!job3Ready(pet, tp)) throw Error('PET_JOB3_LOCKED');
  const job3 = job3For(pet.job2)!, weapon = PET_JOB3[job3].weapon;
  pet.job3 = job3; if (!s.inventory.includes(weapon)) s.inventory.push(weapon); pet.accessories.hand = weapon;
  if (!tp.gear.includes(weapon)) tp.gear.push(weapon);
  return {job3, weapon};
}
/** 탑 장식 for a boss floor cleared (once a student): the new one's id, or null when already owned. */
function giveTowerDecor(s: ServerPetState, floor: number) {
  const d = TOWER_DECOR.find(x => x.floor === floor);
  if (!d || (s.towerDecor || []).includes(d.id)) return null;
  s.towerDecor = [...(s.towerDecor || []), d.id];
  return d.id;
}
/** Boss floors any pet already cleared before 탑 장식 existed give theirs too (on the next tower action). */
export function syncTowerDecor(t: TowerState, s: ServerPetState) {
  const best = Math.max(0, ...Object.values(t.pets || {}).map(tp => Number(tp?.best) || 0));
  for (const d of TOWER_DECOR) if (d.floor <= best) giveTowerDecor(s, d.floor);
}
/** Floor cleared: saved, the first clear pays points and XP (inside the daily cap), a boss floor opens its chest. */
/** A set piece found: kept (and worn at once when that place is empty), or a 강화석 when the pet already has it. */
function giveSetPiece(tp: TowerPet, id: string) {
  if (tp.gear.includes(id)) { tp.stones = (tp.stones || 0) + 1; return {id, stone: true}; }
  tp.gear.push(id); const g = towerGear(id)!; if (!tp.equip[g.slot]) tp.equip[g.slot] = id;
  return {id, stone: false};
}
/** 원정대 ★3 pieces wait on the pet until its next tower visit (then kept, or a 강화석 when it has it). */
export function syncGearInbox(t: TowerState, s: ServerPetState) {
  for (const pet of s.pets) { if (!pet.gearInbox?.length) continue; const tp = towerPet(t, pet.slot); for (const id of pet.gearInbox) if (towerGear(id)) giveSetPiece(tp, id); delete pet.gearInbox; }
}
/** 장비 세트 drop on a first clear: a boss floor always, other floors 15%; a random place of the floor's set. */
export function dropSetPiece(tp: TowerPet, floor: number, boss: boolean, rand: () => number) {
  if (!boss && rand() >= GEAR_DROP.floorChance) return null;
  const slot = TOWER_GEAR_SLOTS[Math.min(TOWER_GEAR_SLOTS.length - 1, Math.floor(rand() * TOWER_GEAR_SLOTS.length))].id;
  return giveSetPiece(tp, setGearId(floorGearTier(floor), slot));
}
function clearFloor(t: TowerState, tp: TowerPet, s: ServerPetState, floor: number, boss: boolean, rand: () => number = Math.random) {
  // a floor no pet of the student had cleared is paid outside the daily cap; another pet's first clear stays inside it
  const first = floor > tp.best, studentFirst = first && Object.values(t.pets).every(p => p === tp || (p.best || 0) < floor);
  tp.best = Math.max(tp.best, floor); tp.floor = Math.max(tp.floor, floor + 1);
  let points = 0, xp = 0;
  if (first) { const r = PET_TOWER.reward, want = boss ? r.boss : r.base + r.perFloor * floor, got = studentFirst ? awardFirstClear(s, want, want * 2, '채움의 탑') : awardCapped(s, want, want * 2, 'adventure', '채움의 탑'); points = got.points; xp = got.xp; }
  return {cleared: true, floor, first, points, xp, chest: boss ? openChestFor(tp, floor, currentPet(s)) : null, decor: boss ? giveTowerDecor(s, floor) : null, drop: first ? dropSetPiece(tp, floor, boss, rand) : null};
}
const ended = (tp: TowerPet, run: TowerRun) => { tp.run = null; return {runId: run.id, wrongs: run.wrongs, right: run.right, asked: run.asked, wordbookId: run.wordbookId, wordbookTitle: run.wordbookTitle, startedAt: run.startedAt, books: run.books}; };
const eventEnded = (tp: TowerPet, ev: TowerEventState, right: number, asked: number) => { tp.event = null; return {runId: ev.id, wrongs: ev.wrongs, right, asked, wordbookId: ev.pool.wordbookId, wordbookTitle: ev.pool.wordbookTitle, startedAt: ev.startedAt, books: ev.pool.books}; };

/** The pet's turn: attack or an attack skill (a word question follows), 방패 막기 or 치유 (the monster then attacks), drink
 *  a potion, or run away (탈진). Skills need the 1차 전직, the level and the MP (paid when the word is answered). */
/** A potion or 치유 ends 화상·독·저주. */
const cure = (run: TowerRun) => { if (!run.foe?.dot) return {}; const name = run.foe.dot.name; run.foe.dot = null; return {cured: name}; };
/** The pet acted without attacking: the monster's turn follows. */
function foeAfter(tp: TowerPet, run: TowerRun, out: any, now: number, rand: () => number) {
  if (monsterTurn(run, now, rand, out) === 'lost') return {...out, lost: true, floor: run.floor, end: ended(tp, run)};
  return {...out, phase: run.phase};
}
export function towerAct(t: TowerState, s: ServerPetState, action: unknown, now: number, rand: () => number = Math.random, skillInput?: unknown) {
  const pet = currentPet(s), tp = towerPet(t, pet.slot), run = tp.run;
  if (!run) throw Error('TOWER_NO_RUN');
  if (run.phase !== 'act') throw Error('TOWER_WAIT');
  if (action === 'attack') { run.skill = null; ask(run, 'attack', now, rand); return {phase: run.phase}; }
  if (action === 'skill') {
    if (!pet.job) throw Error('TOWER_SKILL_LOCKED');
    const k = towerSkill(String(skillInput || ''));
    if (!k || !jobSkills(pet).some(x => x.id === k.id) || pet.level < k.level) throw Error('TOWER_SKILL_NOT_LEARNED');
    if (run.foe?.sealed) throw Error('TOWER_SEALED');
    if (run.mp < k.mp) throw Error('TOWER_NO_MP');
    // an attack skill asks 문장 배열 (a word question when there is no sentence)
    if (k.kind === 'attack') { run.skill = k.id; if (!askSentence(run, now, rand)) ask(run, 'attack', now, rand); return {phase: run.phase, skill: k.id}; }
    run.mp -= k.mp; run.skill = null;
    if (k.kind === 'block') { run.shield = true; return foeAfter(tp, run, {skill: k.id, shield: true}, now, rand); }
    const heal = Math.round(run.maxHp * TOWER_SKILL_RULES.heal * (k.power || 1) * (pet.job2 === 'white_mage' ? TOWER_SKILL_RULES.blessing : 1));
    run.hp = Math.min(run.maxHp, run.hp + heal); return foeAfter(tp, run, {skill: k.id, healed: heal, ...cure(run)}, now, rand);
  }
  if (action === 'potion') {
    if (tp.potions <= 0) throw Error('TOWER_NO_POTION');
    tp.potions -= 1; const heal = Math.round(run.maxHp * PET_TOWER.potionHeal); run.hp = Math.min(run.maxHp, run.hp + heal);
    return foeAfter(tp, run, {healed: heal, ...cure(run)}, now, rand);
  }
  if (action === 'flee') { pet.energy = 0; return {fled: true, floor: run.floor, end: ended(tp, run)}; }
  throw Error('PET_BAD_ACTION');
}

const wrongOf = (q: TowerQuestion, choice: number, late: boolean): TowerWrong => ({word: q.word, meaning: q.meaning, userChoice: late ? '시간 초과' : String(q.choices[choice] ?? ''), correctAnswer: q.choices[q.answer], choices: q.choices, quizSentence: '', ...(q.book ? {wordbookId: q.book} : {})});

/** An answer: on the attack, right = hit; on the monster's turn, right in time = blocked. The end of the battle settles
 *  the floor here (saved, first-clear points, the boss chest, maybe a 강화석). */
export function towerAnswer(t: TowerState, s: ServerPetState, runId: unknown, choiceInput: unknown, now: number, rand: () => number = Math.random) {
  const pet = currentPet(s), tp = towerPet(t, pet.slot), run = tp.run;
  if (!run || run.id !== runId || !run.q) throw Error('TOWER_NO_RUN');
  const q = run.q, choice = Number(choiceInput), late = q.deadline !== null && now > q.deadline + 1500;
  // 문장 배열: the pieces in order, sent as the sentence (one try in a battle)
  const correct = !late && (q.order ? typeof choiceInput === 'string' && sameSentence(choiceInput, q.word) : choice === q.answer);
  const out: any = {kind: q.kind, correct, late, answer: q.answer, word: q.word, meaning: q.meaning, ...(q.order ? {sentence: q.word} : {})};
  if (correct) { run.right += 1; run.mp = Math.min(run.maxMp, run.mp + 2); }
  else if (!q.order) run.wrongs.push(wrongOf(q, choice, late)); // missed words go to 오답 복습 (sentences are not words)
  run.q = null;
  // 물에 젖음 −방어, 눈이 침침 −공격 (a lost 쉬어 가기 놀이)
  const base = petTowerStats(pet, tp), fx = runDebuffs(run).map(debuffEffect), times = (e: string) => fx.filter(x => x === e).length;
  const st = {...base, atk: base.atk * TOWER_DEBUFF_RULES.atk ** times('atk'), def: base.def * TOWER_DEBUFF_RULES.def ** times('def')};
  if (q.kind === 'attack') {
    run.attacks += 1;
    const k = run.skill ? towerSkill(run.skill) : null; run.skill = null;
    const def = run.monster.def * (pet.job2 === 'dark_mage' ? TOWER_SKILL_RULES.curse : 1) * (run.foe?.guard ? FOE_RULES.guard : 1), roll = 0.9 + rand() * 0.2;
    const weakHit = Boolean(k && correct && k.element && TOWER_WEAKNESS[run.monster.kind] === k.element);
    if (k) {
      // A skill: right = power × 공격 (a weak-element skill may crit ×2); wrong = a glancing 30% and half the MP.
      out.skill = k.id; out.element = k.element || null;
      run.mp = Math.max(0, run.mp - (correct ? k.mp : Math.ceil(k.mp * TOWER_SKILL_RULES.missMp)));
      if (correct) {
        let dmg = towerHit(st.atk * (k.power || 1), def) * roll;
        const weak = k.element && TOWER_WEAKNESS[run.monster.kind] === k.element;
        const chance = weak ? critChance(pet.level, skillLevel(k, pet.level), worn(tp, pet), tp.levels || {}) : 0;
        if (weak && rand() * 100 < chance) {
          dmg *= TOWER_SKILL_RULES.crit; out.crit = true;
          t.weakFound ||= [];
          if (!t.weakFound.includes(run.monster.kind)) { t.weakFound.push(run.monster.kind); out.weakFound = {kind: run.monster.kind, name: shownMonsterName(t, run.monster.kind, run.monster.name), element: k.element}; }
        }
        // 3차 skills: 그림자 베기 hits twice (a second roll), 하늘 가르기 also blocks the next attack, 그믐 저주 weakens once
        if (k.effect === 'double') { const second = towerHit(st.atk * (k.power || 1), def) * (0.9 + rand() * 0.2) * (out.crit ? TOWER_SKILL_RULES.crit : 1); dmg += second; out.hits = 2; }
        if (k.effect === 'shield') { run.shield = true; out.shieldUp = true; }
        if (k.effect === 'weaken' && !run.weakened) { run.weakened = true; run.monster.atk = Math.max(1, Math.round(run.monster.atk * TOWER_SKILL_RULES.weaken)); out.weakened = true; }
        out.damage = Math.max(1, Math.round(dmg));
      } else { out.damage = Math.max(1, Math.round(towerHit(st.atk, def) * TOWER_SKILL_RULES.missDamage * roll)); out.glancing = true; }
    } else if (correct) out.damage = Math.max(1, Math.round(towerHit(st.atk, def) * roll));
    if (out.damage) {
      run.monster.hp = Math.max(0, run.monster.hp - out.damage);
      if (pet.job2 === 'dark_knight') { out.drained = Math.max(1, Math.round(out.damage * TOWER_SKILL_RULES.drain)); run.hp = Math.min(run.maxHp, run.hp + out.drained); }
    }
    const f = run.foe;
    if (f) {
      if (correct) f.hit = true;
      if (f.guard > 0) { if (weakHit) { f.guard = 0; out.guardBroken = true; } else f.guard -= 1; }
      if (f.rage && !f.raged && run.monster.hp > 0 && run.monster.hp <= run.monster.max * FOE_RULES.rageAt) { f.raged = true; out.enraged = true; }
    }
    if (run.monster.hp <= 0) { const entry = t.codex?.[run.monster.kind]; if (entry) entry.wins += 1; return {...out, ...win(t, tp, s, run, rand)}; }
    if (monsterTurn(run, now, rand, out) === 'lost') return {...out, lost: true, floor: run.floor, end: ended(tp, run)};
    return out;
  }
  // The monster's turn: 방패 막기 blocks it whatever the answer (the word still counts for learning); 수호 takes 10% less.
  const blocked = correct || Boolean(run.shield); if (run.shield) { out.shield = true; run.shield = false; }
  const f = run.foe, k = f?.next ? foeSkill(f.next) : null;
  const mult = (pet.job2 === 'paladin' ? TOWER_SKILL_RULES.guard : 1) * (k?.fx.includes('smash') ? FOE_RULES.smash : 1) * (k?.fx.includes('multi') ? FOE_RULES.multi : 1) * (f?.raged ? FOE_RULES.rage : 1);
  out.taken = Math.max(1, Math.round(towerTaken(run.monster.atk, st.def, blocked) * mult)); out.blocked = blocked;
  run.hp = Math.max(0, run.hp - out.taken);
  if (f && k) {
    // a warned skill: 흡혈 heals it; blocking keeps off 지속 피해 and 봉인; 연속 공격 asks a second block question
    out.foe = {skill: k.id, name: k.name};
    if (k.fx.includes('drain')) { const heal = Math.max(1, Math.round(out.taken * FOE_RULES.drain)); run.monster.hp = Math.min(run.monster.max, run.monster.hp + heal); out.foe.drained = heal; }
    if (blocked && (k.fx.includes('dot') || k.fx.includes('seal'))) out.foe.avoided = true;
    else {
      if (k.fx.includes('dot')) { f.dot = {name: k.dot || '화상', turns: FOE_RULES.dotTurns}; out.foe.dot = f.dot.name; }
      if (k.fx.includes('seal')) { f.sealed = FOE_RULES.sealTurns; f.sealNew = true; out.foe.sealed = f.sealed; }
    }
    if (k.fx.includes('multi') && f.hits === 0 && run.hp > 0) { f.hits = 1; out.foe.again = true; ask(run, 'defend', now, rand); return out; }
    f.hits = 0; f.next = null; f.last = true;
  }
  if (run.hp <= 0) return {...out, lost: true, floor: run.floor, end: ended(tp, run)};
  endRound(run, out);
  if (run.hp <= 0) return {...out, lost: true, floor: run.floor, end: ended(tp, run)};
  run.phase = 'act'; planFoe(run, rand); return out;
}
function win(t: TowerState, tp: TowerPet, s: ServerPetState, run: TowerRun, rand: () => number) {
  const potions = run.bonus?.potions || 0; tp.potions += potions;
  const stone = !run.monster.boss && rand() < PET_TOWER.stoneDrop ? 1 : 0; tp.stones = (tp.stones || 0) + stone;
  return {won: true, attacks: run.attacks, potions, stone, ...clearFloor(t, tp, s, run.floor, run.monster.boss, rand), end: ended(tp, run)};
}

/** Playing an event behind a door. 요정: save it (a potion) or fight it (two potions for winning). 상인: buy, enhance,
 *  leave. 석상 / 함정: one answer. 잠든 몬스터: sneaking past (the mini-game is played in the browser) or waking it. */
export function towerEvent(t: TowerState, s: ServerPetState, move: unknown, input: any, now: number, rand: () => number = Math.random) {
  const out = playEvent(t, s, move, input, now, rand);
  meet(t, towerPet(t, currentPet(s).slot), now); // a trap, a woken monster or the fairy fought begins a battle
  return out;
}
function playEvent(t: TowerState, s: ServerPetState, move: unknown, input: any, now: number, rand: () => number) {
  const pet = currentPet(s), tp = towerPet(t, pet.slot), ev = tp.event;
  if (!ev) throw Error('TOWER_NO_RUN');
  const stone = (n = 1) => { tp.stones = (tp.stones || 0) + n; return n; };
  if (ev.type === 'fairy') {
    if (move === 'save') { tp.potions += 1; return {saved: true, potions: 1, ...clearFloor(t, tp, s, ev.floor, false, rand), end: eventEnded(tp, ev, 0, 0)}; }
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
      syncJobWeapons(tp, pet, s);
      const id = String(input?.gearId || ''); if (!tp.gear.includes(id)) throw Error('PET_ITEM_NOT_OWNED');
      const level = tp.levels![id] || 0, step = TOWER_ENHANCE[level]; if (!step) throw Error('TOWER_MAX_ENHANCE');
      if ((tp.stones || 0) < step.stones) throw Error('TOWER_NO_STONES');
      tp.stones = (tp.stones || 0) - step.stones;
      const ok = rand() < step.rate; if (ok) tp.levels![id] = step.to;
      return {enhanced: ok, gearId: id, level: tp.levels![id] || 0, stones: step.stones};
    }
    if (move === 'leave') return {left: true, ...clearFloor(t, tp, s, ev.floor, false, rand), end: eventEnded(tp, ev, 0, 0)};
  }
  if ((ev.type === 'riddle' || ev.type === 'trap') && move === 'answer' && ev.q) {
    const q = ev.q, choice = Number(input?.choice), late = q.deadline !== null && now > q.deadline + 1500, correct = !late && choice === q.answer;
    const out = {correct, late, answer: q.answer, word: q.word, meaning: q.meaning};
    if (!correct) ev.wrongs.push(wrongOf(q, choice, late));
    ev.q = null;
    if (correct) return {...out, stone: stone(), ...clearFloor(t, tp, s, ev.floor, false, rand), end: eventEnded(tp, ev, 1, 1)};
    if (ev.type === 'riddle') return {...out, stone: 0, ...clearFloor(t, tp, s, ev.floor, false, rand), end: eventEnded(tp, ev, 0, 1)};
    // 함정에 빠짐: a monster jumps in while the pet is hurt (70% HP); the missed word goes with that battle.
    const missed = ev.wrongs; tp.event = null;
    const run = battle(tp, pet, ev.pool, towerMonster(ev.floor, ev.door), ev.floor, now, rand, 0.7); run.wrongs.push(...missed); run.asked += 1;
    return {...out, trapped: true};
  }
  if (isMiniGame(ev.type)) {
    const r = playGame(ev.type, ev.game, move, input, now - ev.startedAt, now);
    if (r.missed) ev.wrongs.push(wrongOf(r.missed.q, r.missed.choice, false)); // 오답 복습
    if ('next' in r) return {game: r.next, correct: true};
    return gameOver(t, tp, s, ev, r.over, rand);
  }
  if (ev.type === 'sleeping' && move === 'sneak') {
    if (input?.ok === true) {
      // The mini-game runs in the browser; the server checks its time and the path it reports before letting the pet past.
      if (!sneakLooksPlayed(input.samples, now - ev.startedAt)) throw Error('TOWER_SNEAK_INVALID');
      return {sneaked: true, stone: stone(), ...clearFloor(t, tp, s, ev.floor, false, rand), end: eventEnded(tp, ev, 0, 0)};
    }
    tp.event = null; battle(tp, pet, ev.pool, dragonOf(ev.color), ev.floor, now, rand); return {woke: true};
  }
  throw Error('PET_BAD_ACTION');
}

/** Debuffs waiting for the next battle (older saves kept one, or a 불운 flag). */
const pendingDebuffs = (tp: TowerPet): TowerDebuff[] => tp.debuffs ? [...tp.debuffs] : tp.debuff ? [tp.debuff] : tp.curse ? ['curse'] : [];
const runDebuffs = (run: TowerRun): TowerDebuff[] => run.debuffs || (run.debuff ? [run.debuff] : []);

/** A 쉬어 가기 놀이 is over: its prize (or the mimic's bite), the floor passed either way. */
function gameOver(t: TowerState, tp: TowerPet, s: ServerPetState, ev: TowerEventState, r: GameResult, rand: () => number) {
  const stone = r.stone || 0, potions = r.potions || 0, lost = r.losePotion && tp.potions > 0 ? 1 : 0;
  tp.stones = (tp.stones || 0) + stone; tp.potions = tp.potions + potions - lost;
  if (r.debuff) { tp.debuffs = [...pendingDebuffs(tp), r.debuff].slice(-TOWER_DEBUFF_RULES.stack); delete tp.debuff; delete tp.curse; }
  return {game: {type: ev.type, success: r.success, text: r.text, lostPotion: lost, ...(r.debuff ? {debuff: r.debuff} : {}), ...(r.reveal ? {reveal: r.reveal} : {})}, stone, potions, ...clearFloor(t, tp, s, ev.floor, false, rand), end: eventEnded(tp, ev, r.right || 0, r.asked || 0)};
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
  syncJobWeapons(tp, pet, s);
  const weakKnown = (kind: string) => (t.weakFound || []).includes(kind) ? TOWER_WEAKNESS[kind as TowerMonsterKind] || null : null;
  const skills = pet.job ? jobSkills(pet).map(k => ({id: k.id, name: k.name, kind: k.kind, element: k.element || null, mp: k.mp, power: k.power || null, learnAt: k.level, level: skillLevel(k, pet.level), text: k.text || null,
    crit: k.element ? critChance(pet.level, skillLevel(k, pet.level), worn(tp, pet), tp.levels || {}) : 0})) : [];
  const pq = (q: TowerQuestion | null) => q && {kind: q.kind, prompt: q.kind === 'defend' || q.kind === 'trap' ? q.word : q.meaning, choices: q.choices, msLeft: q.deadline === null ? null : Math.max(0, q.deadline - now), msTotal: q.deadline === null ? null : q.deadline - q.issuedAt, ...(q.order ? {order: q.order} : {})};
  return {
    skills, passive: pet.job2 ? BRANCH_PASSIVE[pet.job2] : null, job: pet.job || null, job2: pet.job2 || null, job3: pet.job3 || null, job3Ready: job3Ready(pet, tp),
    debuffs: pendingDebuffs(tp), floor: tp.floor, best: tp.best, top: PET_TOWER.floors, gear: tp.gear, equip: tp.equip, levels: tp.levels || {}, chests: tp.chests, potions: tp.potions, stones: tp.stones || 0, stats: petTowerStats(pet, tp),
    run: run && {id: run.id, floor: run.floor, monster: {kind: run.monster.kind, name: shownMonsterName(t, run.monster.kind, run.monster.name), boss: run.monster.boss, hp: run.monster.hp, max: run.monster.max, color: run.monster.color ?? null},
      hp: run.hp, maxHp: run.maxHp, mp: run.mp, maxMp: run.maxMp, phase: run.phase, attacks: run.attacks, q: pq(run.q), skill: run.skill || null, shield: Boolean(run.shield), weak: weakKnown(run.monster.kind), foe: publicFoe(run), debuffs: runDebuffs(run)},
    event: ev && {id: ev.id, floor: ev.floor, type: ev.type, stock: ev.type === 'merchant' ? ev.stock : null, q: pq(ev.q), color: ev.color ?? null, game: isMiniGame(ev.type) ? publicGame(ev.type, ev.game, now) : null},
    codex: towerCodex(t),
  };
}

/** 몬스터 스킬 as the browser sees it: the skill warned of, 방어 태세, 봉인, 지속 피해, 분노. */
function publicFoe(run: TowerRun) {
  const f = run.foe; if (!f) return null;
  const k = f.next ? foeSkill(f.next) : null;
  return {next: k && {name: k.name, fx: k.fx, dot: k.dot || null, warn: k.warn}, guard: f.guard, sealed: f.sealed, dot: f.dot, raged: f.raged, rage: f.rage, again: f.hits > 0};
}

/** A zone boss stays a mystery ('???') until one of the student's pets has beaten its floor. */
export function bossHidden(t: TowerState, kind: string) {
  const zone = TOWER_ZONES.find(z => z.boss.kind === kind); if (!zone) return false;
  return Math.max(0, ...Object.values(t.pets || {}).map(p => Number(p?.best) || 0)) < zone.to;
}
const shownMonsterName = (t: TowerState, kind: string, name: string) => bossHidden(t, kind) ? '???' : name;

/** 도감 as the browser sees it, in the order met. Weaknesses found before the 도감 existed show without a first floor. */
export function towerCodex(t: TowerState) {
  const weak = (kind: string) => (t.weakFound || []).includes(kind) ? TOWER_WEAKNESS[kind as TowerMonsterKind] || null : null;
  const met = Object.entries(t.codex || {}).sort(([, a], [, b]) => a.at - b.at).map(([kind, e]) => ({kind, name: bossHidden(t, kind) ? null : e.name, hidden: bossHidden(t, kind), boss: e.boss, first: e.first, wins: e.wins, weak: weak(kind)}));
  const older = (t.weakFound || []).filter(kind => !t.codex?.[kind]).map(kind => ({kind, name: null, hidden: bossHidden(t, kind), boss: TOWER_ZONES.some(z => z.boss.kind === kind), first: null, wins: null, weak: weak(kind)}));
  return [...met, ...older];
}

// ---- words: the hard wordbook the admin set for the student's school level ----
/** Who is climbing: a teacher (or the admin) plays with the 고등 books; a student by the school in their name. */
/** Who is climbing, remembered per server instance for a minute (like the teacher room's permission check), so a role
 *  or grade change shows within a minute. */
const climbers = new WeakMap<object, Map<string, {value: Promise<{teacher: boolean; name: string}>; until: number}>>();
export function climber(db: any, uid: string) {
  let byUid = climbers.get(db); if (!byUid) { byUid = new Map(); climbers.set(db, byUid); }
  const hit = byUid.get(uid); if (hit && hit.until > Date.now()) return hit.value;
  if (byUid.size >= 2000) byUid.delete(byUid.keys().next().value!);
  const value = readClimber(db, uid); byUid.set(uid, {value, until: Date.now() + 60_000}); value.catch(() => byUid!.delete(uid));
  return value;
}
async function readClimber(db: any, uid: string) {
  const user = (await db.collection('users').doc(uid).get()).data() || {};
  if (uid === process.env.ADMIN_UID || ['teacher', 'principal', 'admin'].includes(user.role)) return {teacher: true, name: ''};
  const key = user.notionStudentKey;
  if (typeof key !== 'string' || !key) return {teacher: false, name: ''};
  const row = (await db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students', key)).get()).data();
  return {teacher: false, name: String(row?.kind === 'students' ? row.fields?.summaryOverride?.studentDisplayName || '' : '') || String((await readStudentMapping(db, key))?.studentDisplayName || '')};
}
/** 고등 students (and teachers) get the 고등 books; 중등, 초등 and anyone whose grade isn't known get the 중등 books. */
/** 고등 students and teachers: high; 초등 students: elementary (its books, or the 중등 ones while it has none); everyone
 *  else (중등, grade unknown): middle. */
export const towerLevelFor = (displayName: string, teacher = false) => { const g = teacher ? '' : gradeOf(displayName) || ''; return teacher || g.startsWith('고') ? 'high' : g.startsWith('초') ? 'elementary' : 'middle'; };
/** A level's books in the settings (up to two; older settings kept one id as text). */
const booksOf = (v: unknown): string[] => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).filter((id): id is string => typeof id === 'string' && Boolean(id.trim())).slice(0, PET_TOWER_BOOKS);
export const PET_TOWER_BOOKS = 3;
/** The books for this player: the admin's setting for their level (all of them are used, up to three). */
export async function towerBookFor(db: any, uid: string) {
  const settings = (await db.collection(PET_TOWER_SETTINGS).doc('main').get()).data() || {}, who = await climber(db, uid);
  const level = towerLevelFor(who.name, who.teacher), own = booksOf(settings[level]);
  const ids = own.length || level !== 'elementary' ? own : booksOf(settings.middle);
  const books = (await Promise.all(ids.map(async id => { const b = (await db.collection('wordbooks').doc(id).get()).data(); return b ? {id, title: String(b.title || '탑 단어장').slice(0, 60)} : null; }))).filter(Boolean) as {id: string; title: string}[];
  if (!books.length) throw Error('TOWER_NOT_READY');
  return {wordbookId: books[0].id, wordbookTitle: books.map(b => b.title).join(' · ').slice(0, 80), books};
}
/** A window of each book's words from a random place (not the whole books, to keep reads small). */
export async function loadTowerPool(db: any, uid: string, rand: () => number = Math.random) {
  const pick = await towerBookFor(db, uid), size = Math.ceil(PET_TOWER.poolSize / pick.books.length), list: PoolWord[] = [];
  // The books' word windows are read together (each from its own random point), then kept in book order.
  const starts = pick.books.map(() => randomDocId(rand));
  const windows = await Promise.all(pick.books.map(async (book, i) => {
    const words = db.collection(`wordbooks/${book.id}/words`);
    const first = await words.orderBy(FieldPath.documentId()).startAt(starts[i]).limit(size).get();
    const rest = first.size < size ? await words.orderBy(FieldPath.documentId()).limit(size - first.size).get() : {docs: []};
    return [...first.docs, ...rest.docs];
  }));
  pick.books.forEach((book, i) => {
    const seen = new Set<string>();
    for (const d of windows[i]) {
      if (seen.has(d.id)) continue; seen.add(d.id); const x = d.data();
      if (typeof x?.word === 'string' && typeof x?.meaning === 'string' && x.word.trim() && x.meaning.trim()) list.push({w: x.word.trim().slice(0, 60), m: x.meaning.trim().slice(0, 80), b: book.id});
    }
  });
  if (list.length < 8) throw Error('TOWER_NOT_READY');
  return {words: list, ...pick};
}
/** The study sessions for a finished battle's missed words, one per wordbook the words came from (none when nothing was
 *  missed). Written in the same transaction that ends the battle, so the words can't be lost; the ids are per battle. */
export function towerWrongsSessions(uid: string, end: {runId: string; wrongs: TowerWrong[]; right: number; asked: number; wordbookId: string; wordbookTitle: string; startedAt: number; books?: {id: string; title: string}[]}, now: number) {
  if (!end.wrongs.length) return [];
  const byBook = new Map<string, TowerWrong[]>();
  for (const w of end.wrongs) { const id = w.wordbookId || end.wordbookId; byBook.set(id, [...(byBook.get(id) || []), w]); }
  return [...byBook.entries()].map(([bookId, wrongs], i) => {
    const title = end.books?.find(b => b.id === bookId)?.title || end.wordbookTitle;
    return {id: i ? `tower_${uid}_${end.runId}_${i}` : `tower_${uid}_${end.runId}`, data: {uid, wordbookId: bookId, wordbookTitle: `${PET_TOWER.name} · ${title}`, type: 'quiz', category: 'word',
      duration: Math.max(1, Math.round((now - end.startedAt) / 1000)), score: i ? 0 : end.right, totalItems: Math.max(1, i ? wrongs.length : end.asked), incorrectAnswers: wrongs.map(({wordbookId: _b, ...w}) => w), createdAt: new Date(now)}};
  });
}
/** Kept for one-book callers. */
export const towerWrongsSession = (uid: string, end: Parameters<typeof towerWrongsSessions>[1], now: number) => towerWrongsSessions(uid, end, now)[0] || null;

// ---- 관리자 설정 › 탑 단어장 (초등용·중등용·고등용, up to three books each) ----
function admin(actor: any) { if (!actor.admin || actor.academyId !== 'main') throw Error('FORBIDDEN'); }
export async function readTowerSettings(db: any, actor: any) {
  admin(actor);
  const [settings, books] = await Promise.all([db.collection(PET_TOWER_SETTINGS).doc('main').get(), db.collection('wordbooks').get()]);
  const list = books.docs.map((d: any) => ({id: d.id, ...d.data()})).filter((b: any) => (b.category || 'word') === 'word' && (!b.type || b.type === 'standard'))
    .map((b: any) => ({id: b.id, title: String(b.title || '제목 없음')})).sort((a: any, b: any) => a.title.localeCompare(b.title, 'ko'));
  const s = settings.data() || {};
  return {elementary: booksOf(s.elementary), middle: booksOf(s.middle), high: booksOf(s.high), books: list};
}
export async function saveTowerSettings(db: any, actor: any, input: any) {
  admin(actor);
  const clean = async (v: unknown) => { const ids = [...new Set(booksOf(v).map(id => id.trim()))]; for (const id of ids) if (!(await db.collection('wordbooks').doc(id).get()).exists) throw Error('BAD_REQUEST'); return ids; };
  // A level left out of the request (an older screen still open) keeps what it had; read and written in one transaction
  // so two screens saving at once never put back an older value.
  const keys = ['elementary', 'middle', 'high'] as const, sent: Partial<Record<typeof keys[number], string[]>> = {};
  for (const key of keys) if (input && Object.hasOwn(input, key)) sent[key] = await clean(input[key]);
  const ref = db.collection(PET_TOWER_SETTINGS).doc('main');
  const next = await db.runTransaction(async (tx: any) => {
    const old = (await tx.get(ref)).data() || {};
    const doc = {...Object.fromEntries(keys.map(k => [k, sent[k] ?? booksOf(old[k])])), updatedAt: Date.now(), updatedBy: actor.uid || 'admin'} as any;
    tx.set(ref, doc);
    return doc;
  });
  return {elementary: next.elementary, middle: next.middle, high: next.high};
}
export type {TowerGear};
