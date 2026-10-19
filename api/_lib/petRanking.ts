// 순위: 모험가 (each pet: 채움의 탑 best floor → 원정대 stars → level) and 원정대 (each student: their pets' best floors added
// up → stars → levels), every academy together. Built from every student's documents at most every 10 minutes into one
// snapshot (petRankings/current); students only get 원정대 이름·모험가 별칭, pet looks and numbers (no uids, no real names).
// Teachers' pets are left out; a teacher may switch them on for their own view.
import {FieldPath} from 'firebase-admin/firestore';
import {PET_STATES, rollDay, type ServerPet, type ServerPetState} from './pet.js';
import {PET_GUILD, shownAlias, shownGuild, type GuildProfile} from './petParty.js';
import {PET_TOWERS, climber, type TowerState} from './petTower.js';
import {PET_EXPEDITIONS, type ExpeditionState} from './petExpedition.js';
import {petAura, wornAccessories, type PetJob} from '../../src/lib/petCatalog.js';
import {activePlan} from '../../src/lib/aiPlans.js';
import {seoulDay} from './pet.js';

export const PET_RANKINGS = 'petRankings';
export const RANKING_TTL = 10 * 60_000, RANKING_TOP = 50;
/** The home chip takes an older snapshot rather than wait for a rebuild (the ranking sheet keeps it fresh), up to this. */
export const RANKING_STALE_OK = 6 * 3_600_000;
export const NO_GUILD = '이름 없는 원정대';
export interface RankPet { uid: string; slot: number; alias: string; guild: string; name: string; character: string; level: number; clothing: string | null; accessories: string[]; job: PetJob | null; best: number; stars: number; teacher: boolean;
  /** looks only: the 3차 전직 aura, and the pass in force when the snapshot was built */ aura?: 'light' | 'dark' | null; pass?: 'pet' | 'premium' | null }
export interface RankSnapshot { builtAt: number; pets: RankPet[]; /** a rebuild in progress until then (others keep the last snapshot) */ buildingUntil?: number }

/** Every document of a collection, 500 at a time (nothing is cut off however many students there are). */
async function docsOf(db: any, name: string) {
  const out = new Map<string, any>(); let last: any = null;
  for (;;) {
    let q = db.collection(name).orderBy(FieldPath.documentId()).limit(500); if (last) q = q.startAfter(last);
    const page = await q.get(); for (const d of page.docs) out.set(d.id, d.data());
    if (page.docs.length < 500) return out; last = page.docs[page.docs.length - 1];
  }
}
/** The stars a pet has on the 원정대 map (best per stage, added up); the old shared map counts for pet 1. */
export function petStars(e: ExpeditionState | undefined, slot: number) {
  const stars = e?.pets?.[String(slot)]?.stars || (slot === 1 && !e?.pets ? e?.stars : undefined) || {};
  return Object.values(stars).reduce((a: number, n) => a + (Number(n) || 0), 0);
}
async function teacherUids(db: any) {
  const ids = new Set<string>((await db.collection('users').where('role', 'in', ['teacher', 'principal', 'admin']).get()).docs.map((d: any) => d.id));
  if (process.env.ADMIN_UID) ids.add(process.env.ADMIN_UID);
  return ids;
}
/** Every chosen pet of every student, with its names and numbers. */
export async function buildRankings(db: any, now: number): Promise<RankSnapshot> {
  const [states, towers, expeditions, guilds, teachers, passes] = await Promise.all([docsOf(db, PET_STATES), docsOf(db, PET_TOWERS), docsOf(db, PET_EXPEDITIONS), docsOf(db, PET_GUILD), teacherUids(db), docsOf(db, 'aiPasses')]);
  const today = seoulDay(now);
  const pets: RankPet[] = [];
  for (const [uid, raw] of states) {
    const s = rollDay(raw, now) as ServerPetState, t = towers.get(uid) as TowerState | undefined, g = guilds.get(uid) as GuildProfile | undefined, plan = activePlan(passes.get(uid) as any, today);
    for (const p of s.pets.filter((x: ServerPet) => x.chosen)) pets.push({
      uid, slot: p.slot, alias: shownAlias(g, p.slot) || (g?.nickname && !g.aliases && p.slot === s.currentPetSlot ? g.nickname : ''), guild: shownGuild(g), name: p.name, character: p.character, level: p.level,
      clothing: p.clothing ?? null, accessories: wornAccessories(p), job: p.job || null, best: Number(t?.pets?.[String(p.slot)]?.best) || 0, stars: petStars(expeditions.get(uid), p.slot), teacher: teachers.has(uid),
      aura: petAura(p), pass: plan === 'free' ? null : plan,
    });
  }
  return {builtAt: now, pets};
}
/** The snapshot, rebuilt when older than 10 minutes. One request rebuilds (a short lock taken in a transaction); others
 *  meanwhile get the last snapshot instead of reading everything again. */
export async function rankingSnapshot(db: any, now: number, maxAge = RANKING_TTL, stale = false): Promise<RankSnapshot> {
  const ref = db.collection(PET_RANKINGS).doc('current');
  // A fresh snapshot is a plain read; the transaction (the rebuild lock) only when it is old or missing. `stale`: an older
  // one (up to RANKING_STALE_OK) is shown at once, and the screen asks for the rebuild separately (rank-refresh).
  const plain = await ref.get(), seen = plain.exists ? plain.data() as RankSnapshot : null;
  if (seen && Array.isArray(seen.pets) && now - seen.builtAt < (stale ? Math.max(maxAge, RANKING_STALE_OK) : maxAge)) return seen;
  const {cur, build} = await db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref), cur = snap.exists ? snap.data() as RankSnapshot : null, usable = Boolean(cur && Array.isArray(cur.pets));
    if (usable && now - cur!.builtAt < maxAge) return {cur, build: false};
    // Someone is rebuilding: the last snapshot meanwhile, or (none yet, a cold start) "being made" instead of a second build.
    if ((cur?.buildingUntil || 0) > now) { if (usable) return {cur, build: false}; throw Error('RANK_BUILDING'); }
    tx.set(ref, {buildingUntil: now + 60_000}, {merge: true});
    return {cur, build: true};
  });
  if (!build) return cur as RankSnapshot;
  const next = await buildRankings(db, now);
  await ref.set({...next, buildingUntil: 0});
  return next;
}

type Row = {key: number[]; index: number; uid: string};
/** 1, 2, 2, 4: equal keys share a place. */
const placed = <T extends Row>(rows: T[]) => { rows.sort((a, b) => { for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return b.key[i] - a.key[i]; return a.index - b.index; }); let rank = 0; return rows.map((r, i) => ({...r, rank: i && r.key.every((k, j) => k === rows[i - 1].key[j]) ? rank : (rank = i + 1)})); };
const look = (p: RankPet) => ({character: p.character, level: p.level, clothing: p.clothing, accessories: p.accessories, aura: p.aura ?? null});

/** The rows of one ranking as `viewer` sees it: the top 50 and their own places (kept even when lower). */
function rankRows(snap: RankSnapshot, viewer: string, kind: 'pet' | 'guild', withTeachers: boolean) {
  const pets = snap.pets.map((p, index) => ({p, index})).filter(({p}) => withTeachers || !p.teacher);
  let rows: any[];
  if (kind === 'pet') rows = placed(pets.map(({p, index}) => ({key: [p.best, p.stars, p.level], index, uid: p.uid, p}))).map(r => ({rank: r.rank, id: r.index, label: r.p.alias || r.p.name, sub: [r.p.guild || NO_GUILD, `Lv.${r.p.level}`].join(' · '), job: r.p.job, pass: r.p.pass ?? null, value: r.p.best, stars: r.p.stars, looks: [look(r.p)], teacher: r.p.teacher, me: r.uid === viewer}));
  else {
    const byUid = new Map<string, {p: RankPet; index: number}[]>();
    for (const x of pets) byUid.set(x.p.uid, [...(byUid.get(x.p.uid) || []), x]);
    rows = placed([...byUid.entries()].map(([uid, list]) => { const sum = (f: (p: RankPet) => number) => list.reduce((a, x) => a + f(x.p), 0), top = [...list].sort((a, b) => b.p.best - a.p.best || b.p.level - a.p.level)[0];
      return {key: [sum(p => p.best), sum(p => p.stars), sum(p => p.level)], index: top.index, uid, list, top}; }))
      .map(r => ({rank: r.rank, id: r.index, label: r.top.p.guild || NO_GUILD, sub: `펫 ${r.list.length}마리`, job: null, pass: r.top.p.pass ?? null, value: r.key[0], stars: r.key[1], looks: r.list.slice(0, 4).map(x => look(x.p)), teacher: r.top.p.teacher, me: r.uid === viewer}));
  }
  return {total: rows.length, rows: rows.slice(0, RANKING_TOP), mine: rows.filter((r, i) => r.me && i >= RANKING_TOP)};
}
const options = async (db: any, viewer: string, kindInput: unknown, withTeachersInput: unknown) => {
  const teacherView = (await climber(db, viewer)).teacher;
  return {kind: kindInput === 'guild' ? 'guild' as const : 'pet' as const, teacherView, withTeachers: teacherView && withTeachersInput === true};
};

/** What a student sees. `id` = the snapshot index of the pet (for 원정대: the student's best pet) used to open its room;
 *  it changes when the snapshot is rebuilt (`at`). */
export async function readRankings(db: any, viewer: string, kindInput: unknown, withTeachersInput: unknown, now: number) {
  const [{kind, teacherView, withTeachers}, snap] = await Promise.all([options(db, viewer, kindInput, withTeachersInput), rankingSnapshot(db, now, RANKING_TTL, true)]);
  // `stale`: older than 10 minutes — shown now; the screen then asks for a rebuild and reads again
  return {at: snap.builtAt, stale: now - snap.builtAt >= RANKING_TTL, kind, teacherView, withTeachers, ...rankRows(snap, viewer, kind, withTeachers)};
}
/** rank-refresh: rebuild the snapshot when it is older than 10 minutes (one at a time); its time, to read again. */
export async function refreshRankings(db: any, now: number) {
  return {at: (await rankingSnapshot(db, now)).builtAt};
}

/** The home chip: the viewer's best place among the 모험가 — a student among the students, a teacher in the ranking with
 *  the teachers (선생님 포함); null when they have no pet on it yet (the chip shows –위). It uses the snapshot as it is
 *  (up to 6 hours old) so the home screen never waits for a rebuild. */
export async function myPetRank(db: any, uid: string, now: number, hasPet = true): Promise<{rank: number | null; teacher: boolean}> {
  if (!hasPet) return {rank: null, teacher: (await climber(db, uid)).teacher}; // –위 without reading (or rebuilding) the ranking
  const [{teacher}, snap] = await Promise.all([climber(db, uid), rankingSnapshot(db, now, RANKING_STALE_OK)]);
  const pets = snap.pets.map((p, index) => ({p, index})).filter(x => teacher || !x.p.teacher);
  if (!pets.some(x => x.p.uid === uid)) return {rank: null, teacher};
  return {rank: Math.min(...placed(pets.map(({p, index}) => ({key: [p.best, p.stars, p.level], index, uid: p.uid}))).filter(r => r.uid === uid).map(r => r.rank)), teacher};
}

/** One pet's room from the ranking, to look at: outfit, room background and the 금메달 placed there. Only a pet on the
 *  rows this viewer was shown (the same ranking: `kind`, `teachers`) can be opened. */
export async function readRankProfile(db: any, viewer: string, atInput: unknown, idInput: unknown, kindInput: unknown, withTeachersInput: unknown, now: number) {
  const [{kind, withTeachers}, snap] = await Promise.all([options(db, viewer, kindInput, withTeachersInput), rankingSnapshot(db, now)]), id = Math.floor(Number(idInput)), p = snap.pets[id];
  if (Number(atInput) !== snap.builtAt || !p) throw Error('RANK_STALE');
  const shown = rankRows(snap, viewer, kind, withTeachers);
  if (![...shown.rows, ...shown.mine].some(r => r.id === id)) throw Error('RANK_STALE');
  const raw = (await db.collection(PET_STATES).doc(p.uid).get()).data();
  const s = raw ? rollDay(raw, now) as ServerPetState : null, pet = s?.pets.find(x => x.slot === p.slot);
  const background = s?.background || 'default';
  return {label: p.alias || p.name, guild: p.guild || NO_GUILD, name: p.name, character: pet?.character || p.character, level: pet?.level || p.level, job: pet?.job || p.job,
    clothing: pet ? pet.clothing ?? null : p.clothing, accessories: pet ? wornAccessories(pet) : p.accessories, aura: pet ? petAura(pet) : p.aura ?? null, pass: p.pass ?? null, background, decor: s?.decor?.[background] || [], medals: (s?.medals || []).length, best: p.best, stars: p.stars, me: p.uid === viewer};
}
