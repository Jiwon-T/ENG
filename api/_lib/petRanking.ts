// 순위: 모험가 (each pet: 채움의 탑 best floor → 원정대 stars → level) and 원정대 (each student: their pets' best floors added
// up → stars → levels), every academy together. Built from every student's documents at most every 10 minutes into one
// snapshot (petRankings/current); students only get 원정대 이름·모험가 별칭, pet looks and numbers (no uids, no real names).
// Teachers' pets are left out; a teacher may switch them on for their own view. ⭐ 원정대 별순 (kind 'pet-stars' / 'guild-stars')
// puts the 원정대 stars first, then the floors and levels; the home chip stays by floors.
import {FieldPath} from 'firebase-admin/firestore';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {PET_STATES, rollDay, type ServerPet, type ServerPetState} from './pet.js';
import {PET_GUILD, norm, shownAlias, shownGuild, type GuildProfile} from './petParty.js';
import {shownName, studentRealName} from './realNames.js';
import {maskedName} from '../../src/lib/rankNames.js';
import {PET_TOWERS, climber, gearViewFor, type TowerState} from './petTower.js';
import {PET_EXPEDITIONS, type ExpeditionState} from './petExpedition.js';
import {neighborsOf, normCode, roomOwner, setNeighbor, stuckToday, todaysVisits, visitRoom, weeklyStickers} from './petRoom.js';
import {matchesKoreanSearch} from '../../src/lib/koreanSearch.js';
import {PET_ROOM} from '../../src/lib/petCatalog.js';
import {petAura, wornAccessories, type PetGearView, type PetJob} from '../../src/lib/petCatalog.js';
import {activePlan} from '../../src/lib/aiPlans.js';
import {seoulDay} from './pet.js';

export const PET_RANKINGS = 'petRankings';
export const RANKING_TTL = 10 * 60_000, RANKING_TOP = 50;
/** The home chip takes an older snapshot rather than wait for a rebuild (the ranking sheet keeps it fresh), up to this. */
export const RANKING_STALE_OK = 6 * 3_600_000;
export const NO_GUILD = '이름 없는 원정대';
export interface RankPet { uid: string; slot: number; alias: string; guild: string; name: string; character: string; level: number; clothing: string | null; accessories: string[]; job: PetJob | null; best: number; stars: number; teacher: boolean;
  /** looks only: the 3차 전직 aura, and the pass in force when the snapshot was built */ aura?: 'light' | 'dark' | null; pass?: 'pet' | 'premium' | null;
  /** 장비 as shown (👁 applied); null: none or hidden */ gear?: PetGearView | null }
export interface RankSnapshot { builtAt: number; pets: RankPet[]; /** a rebuild in progress until then (others keep the last snapshot) */ buildingUntil?: number }

/** Every document of a collection, 500 at a time (nothing is cut off however many students there are). */
export async function docsOf(db: any, name: string) {
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
  // a 별칭, 원정대 이름 or pet name holding the student's real name shows only when they said yes to it (else the next name,
  // the pet's family-name-only label, or no 원정대 이름)
  const reals = new Map<string, string>(await Promise.all([...states.keys()].filter(uid => !teachers.has(uid)).map(async uid => [uid, await studentRealName(db, uid).catch(() => '')] as [string, string])));
  for (const [uid, raw] of states) pets.push(...rankPetsOf(uid, raw, towers.get(uid), guilds.get(uid), expeditions.get(uid), activePlan(passes.get(uid) as any, today), reals.get(uid) || '', teachers.has(uid), now));
  return {builtAt: now, pets};
}
/** One student's chosen pets as the 순위 shows them (names as agreed: a real name only when said yes to). */
function rankPetsOf(uid: string, raw: any, t: TowerState | undefined, g: GuildProfile | undefined, e: ExpeditionState | undefined, plan: string, real: string, teacher: boolean, now: number): RankPet[] {
  const s = rollDay(raw, now) as ServerPetState, agreed = g?.realNameOk || [];
  return s.pets.filter((x: ServerPet) => x.chosen).map((p: ServerPet) => ({
    uid, slot: p.slot, alias: shownName(shownAlias(g, p.slot) || (g?.nickname && !g.aliases && p.slot === s.currentPetSlot ? g.nickname : ''), real, agreed), guild: shownName(shownGuild(g), real, agreed),
    name: shownName(p.name, real, p.realNameOk ? [norm(p.name)] : []) || maskedName(real), character: p.character, level: p.level,
    clothing: p.clothing ?? null, accessories: wornAccessories(p), job: p.job || null, best: Number(t?.pets?.[String(p.slot)]?.best) || 0, stars: petStars(e, p.slot), teacher,
    aura: petAura(p), pass: plan === 'free' ? null : plan as 'pet' | 'premium', gear: gearViewFor(p, t?.pets?.[String(p.slot)]),
  }));
}
/** One student's pets read now (a 방 코드 of someone who joined after the last snapshot). */
async function liveRankPets(db: any, uid: string, now: number) {
  const doc = (c: string) => db.collection(c).doc(uid).get().then((d: any) => d.data());
  const [raw, t, g, e, pass, {teacher}] = await Promise.all([doc(PET_STATES), doc(PET_TOWERS), doc(PET_GUILD), doc(PET_EXPEDITIONS), doc('aiPasses'), climber(db, uid)]);
  if (!raw) return [];
  const real = teacher ? '' : await studentRealName(db, uid).catch(() => '');
  return rankPetsOf(uid, raw, t, g, e, activePlan(pass, seoulDay(now)), real, teacher, now);
}
/** The snapshot, rebuilt when older than 10 minutes. One request rebuilds (a short lock taken in a transaction); others
 *  meanwhile get the last snapshot instead of reading everything again. */
export const rankingSnapshot = (db: any, now: number, maxAge = RANKING_TTL, stale = false) => cachedSnapshot<RankSnapshot>(db, 'current', now, maxAge,
  stale ? Math.max(maxAge, RANKING_STALE_OK) : maxAge, s => Boolean(s && Array.isArray(s.pets)), () => buildRankings(db, now));
/** One snapshot document of petRankings, rebuilt when older than `maxAge` (or not `usable`). A fresh one is a plain read
 *  (`staleMax`: an older one is shown at once, and the screen asks for the rebuild separately with rank-refresh); the
 *  transaction (the rebuild lock) only when it is old or missing, so others meanwhile get the last snapshot. */
export async function cachedSnapshot<T extends {builtAt: number; buildingUntil?: number}>(db: any, id: string, now: number, maxAge: number, staleMax: number, usable: (s: any) => boolean, build: () => Promise<T>): Promise<T> {
  const ref = db.collection(PET_RANKINGS).doc(id);
  const plain = await ref.get(), seen = plain.exists ? plain.data() as T : null;
  if (seen && usable(seen) && now - seen.builtAt < staleMax) return seen;
  const {cur, again} = await db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref), cur = snap.exists ? snap.data() as T : null, ok = usable(cur);
    if (ok && now - cur!.builtAt < maxAge) return {cur, again: false};
    // Someone is rebuilding: the last snapshot meanwhile, or (none yet, a cold start) "being made" instead of a second build.
    if ((cur?.buildingUntil || 0) > now) { if (ok) return {cur, again: false}; throw Error('RANK_BUILDING'); }
    tx.set(ref, {buildingUntil: now + 60_000}, {merge: true});
    return {cur, again: true};
  });
  if (!again) return cur as T;
  const next = await build();
  await ref.set({...next, buildingUntil: 0});
  return next;
}

type Row = {key: number[]; index: number; uid: string};
/** 1, 2, 2, 4: equal keys share a place. */
const placed = <T extends Row>(rows: T[]) => { rows.sort((a, b) => { for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return b.key[i] - a.key[i]; return a.index - b.index; }); let rank = 0; return rows.map((r, i) => ({...r, rank: i && r.key.every((k, j) => k === rows[i - 1].key[j]) ? rank : (rank = i + 1)})); };
const look = (p: RankPet) => ({character: p.character, level: p.level, clothing: p.clothing, accessories: p.accessories, aura: p.aura ?? null, gear: p.gear ?? null});

/** The rows of one ranking as `viewer` sees it: the top 50 and their own places (kept even when lower). */
function rankRows(snap: RankSnapshot, viewer: string, kind: 'pet' | 'guild', withTeachers: boolean, stars = false) {
  const order = (best: number, starCount: number, level: number) => stars ? [starCount, best, level] : [best, starCount, level];
  const pets = snap.pets.map((p, index) => ({p, index})).filter(({p}) => withTeachers || !p.teacher);
  let rows: any[];
  if (kind === 'pet') rows = placed(pets.map(({p, index}) => ({key: order(p.best, p.stars, p.level), index, uid: p.uid, p}))).map(r => ({rank: r.rank, id: r.index, label: r.p.alias || r.p.name, sub: [r.p.guild || NO_GUILD, `Lv.${r.p.level}`].join(' · '), job: r.p.job, pass: r.p.pass ?? null, value: r.p.best, stars: r.p.stars, looks: [look(r.p)], teacher: r.p.teacher, me: r.uid === viewer}));
  else {
    const byUid = new Map<string, {p: RankPet; index: number}[]>();
    for (const x of pets) byUid.set(x.p.uid, [...(byUid.get(x.p.uid) || []), x]);
    rows = placed([...byUid.entries()].map(([uid, list]) => { const sum = (f: (p: RankPet) => number) => list.reduce((a, x) => a + f(x.p), 0), top = [...list].sort((a, b) => b.p.best - a.p.best || b.p.level - a.p.level)[0];
      return {key: order(sum(p => p.best), sum(p => p.stars), sum(p => p.level)), floors: sum(p => p.best), starSum: sum(p => p.stars), index: top.index, uid, list, top}; }))
      .map(r => ({rank: r.rank, id: r.index, label: r.top.p.guild || NO_GUILD, sub: `펫 ${r.list.length}마리`, job: null, pass: r.top.p.pass ?? null, value: r.floors, stars: r.starSum, looks: r.list.slice(0, 4).map(x => look(x.p)), teacher: r.top.p.teacher, me: r.uid === viewer}));
  }
  return {total: rows.length, rows: rows.slice(0, RANKING_TOP), mine: rows.filter((r, i) => r.me && i >= RANKING_TOP)};
}
const options = async (db: any, viewer: string, kindInput: unknown, withTeachersInput: unknown) => {
  const teacherView = (await climber(db, viewer)).teacher;
  const k = String(kindInput || '');
  return {kind: k.startsWith('guild') ? 'guild' as const : 'pet' as const, stars: k.endsWith('-stars'), teacherView, withTeachers: teacherView && withTeachersInput === true};
};

/** What a student sees. `id` = the snapshot index of the pet (for 원정대: the student's best pet) used to open its room;
 *  it changes when the snapshot is rebuilt (`at`). */
export async function readRankings(db: any, viewer: string, kindInput: unknown, withTeachersInput: unknown, now: number) {
  const [{kind, stars, teacherView, withTeachers}, snap] = await Promise.all([options(db, viewer, kindInput, withTeachersInput), rankingSnapshot(db, now, RANKING_TTL, true)]);
  // `stale`: older than 10 minutes — shown now; the screen then asks for a rebuild and reads again
  return {at: snap.builtAt, stale: now - snap.builtAt >= RANKING_TTL, kind, sort: stars ? 'stars' as const : 'floor' as const, teacherView, withTeachers, ...rankRows(snap, viewer, kind, withTeachers, stars)};
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

/** The pet behind a 순위 row this viewer was shown (the same ranking: `kind`, `teachers`); RANK_STALE otherwise. */
export async function rankTarget(db: any, viewer: string, atInput: unknown, idInput: unknown, kindInput: unknown, withTeachersInput: unknown, now: number) {
  const [{kind, stars, withTeachers}, snap] = await Promise.all([options(db, viewer, kindInput, withTeachersInput), rankingSnapshot(db, now)]), id = Math.floor(Number(idInput)), p = snap.pets[id];
  if (Number(atInput) !== snap.builtAt || !p) throw Error('RANK_STALE');
  const shown = rankRows(snap, viewer, kind, withTeachers, stars);
  if (![...shown.rows, ...shown.mine].some(r => r.id === id)) throw Error('RANK_STALE');
  return p;
}
/** One pet's room from the ranking, to look at: outfit, room background and the 금메달 placed there. Only a pet on the
 *  rows this viewer was shown (the same ranking: `kind`, `teachers`) can be opened. */
export async function readRankProfile(db: any, viewer: string, atInput: unknown, idInput: unknown, kindInput: unknown, withTeachersInput: unknown, now: number) {
  return profileOf(db, viewer, await rankTarget(db, viewer, atInput, idInput, kindInput, withTeachersInput, now), now);
}
/** A pet's room as a visitor sees it (and the visit counted). */
/** Whose pet this is, for a teacher looking at a room: a student of the teacher's own academy by their real name, an app
 *  account not linked to a student by its app name, or a teacher. A student or teacher of another academy shows as just
 *  that (no name); the admin sees every name, an account not linked by its real (Google) name too. Students never get this. */
async function ownerOf(db: any, uid: string, viewer: string) {
  const [user, me, myAccess, access] = await Promise.all([db.collection('users').doc(uid).get(), db.collection('users').doc(viewer).get(), db.collection('teacherWorkspaceAccess').doc(viewer).get(), db.collection('teacherWorkspaceAccess').doc(uid).get()])
    .then(r => r.map((d: any) => d.data() || {}));
  const app = String(user.alias || user.name || '').slice(0, 40), admin = viewer === process.env.ADMIN_UID || me.role === 'admin';
  const mine = String(myAccess.academyId || 'main'), same = (academy: unknown) => admin || String(academy || '') === mine;
  if (uid === process.env.ADMIN_UID || ['teacher', 'principal', 'admin'].includes(user.role)) return same(access.academyId || 'main') ? {kind: 'teacher' as const, name: app} : {kind: 'other-academy' as const, name: ''};
  if (typeof user.notionStudentKey === 'string' && user.notionStudentKey) {
    let key = ''; try { key = uuid(user.notionStudentKey); } catch { /* not a student key */ }
    const member = key ? (await db.collection('academyStudentMemberships').doc(key).get()).data() : null;
    if (!member || !same(member.academyId)) return {kind: 'other-academy' as const, name: ''};
    const real = await studentRealName(db, uid);
    if (real) return {kind: 'student' as const, name: real};
  }
  // an app account not linked: the admin sees the account's real name (the Google name it signed up with) and the app name
  // it chose when that differs; a teacher the app name
  // (an account may have no real name: '사용자' is what sign-up stores then, and the app name is shown)
  const real = user.name && user.name !== '사용자' ? String(user.name).slice(0, 40) : '', alias = String(user.alias || '').slice(0, 40);
  return admin && real ? {kind: 'app' as const, name: real, ...(alias && alias !== real ? {alias} : {})} : {kind: 'app' as const, name: app};
}
async function profileOf(db: any, viewer: string, p: RankPet, now: number) {
  const [raw, tower, kept, mine] = await Promise.all([db.collection(PET_STATES).doc(p.uid).get().then((d: any) => d.data()), db.collection(PET_TOWERS).doc(p.uid).get().then((d: any) => d.data() as TowerState | undefined),
    p.uid === viewer ? [] : neighborsOf(db, viewer).catch(() => [] as string[]), p.uid === viewer ? null : db.collection(PET_STATES).doc(viewer).get().then((d: any) => d.data()).catch(() => null)]);
  // 간식 선물: what I can give from here (my points, the food in my 가방, gifts left today)
  const me = mine ? rollDay(mine, now) as ServerPetState : null;
  const wallet = me ? {points: Number(me.points || 0), snacks: Object.fromEntries(PET_ROOM.gifts.map(id => [id, me.snacks?.[id] || 0]).filter(([, n]) => n)), giftsLeft: Math.max(0, PET_ROOM.giftsPerDay - (me.today.gifts || 0))} : null;
  const s = raw ? rollDay(raw, now) as ServerPetState : null, pet = s?.pets.find(x => x.slot === p.slot);
  // 방 구경: a friend's room closed by its owner shows the pet only (no room, no visit); an open one counts the visit
  // (closed or not is what the visit's own transaction read; a failed visit shows the pet only too)
  const room = await visitRoom(db, p.uid, viewer, now).catch(() => { console.warn('PET_ROOM_VISIT_FAILED'); return null; });
  const owner = p.uid !== viewer && (await climber(db, viewer)).teacher ? await ownerOf(db, p.uid, viewer).catch(() => null) : null;
  const hidden = p.uid !== viewer && !room, background = hidden ? 'default' : s?.background || 'default';
  return {hidden, room, ...(owner ? {owner} : {}), ...(p.uid === viewer ? {roomHidden: Boolean(s?.roomHidden)} : {neighbor: kept.includes(p.uid), wallet}), label: p.alias || p.name, guild: p.guild || NO_GUILD, name: p.name, character: pet?.character || p.character, level: pet?.level || p.level, job: pet?.job || p.job,
    clothing: pet ? pet.clothing ?? null : p.clothing, accessories: pet ? wornAccessories(pet) : p.accessories, aura: pet ? petAura(pet) : p.aura ?? null, gear: pet ? gearViewFor(pet, tower?.pets?.[String(pet.slot)]) : p.gear ?? null, pass: p.pass ?? null, background, decor: hidden ? [] : s?.decor?.[background] || [], medals: (s?.medals || []).filter(m => !/-s$/.test(m)).length, silver: (s?.medals || []).filter(m => /-s$/.test(m)).length, best: p.best, stars: p.stars, me: p.uid === viewer};
}

// ---- 방 구경 outside the 순위: 방명록 답방, 친구 찾기, 방 코드 ----
/** The snapshot the 친구 방 screens read: the last one as it is (up to 6 hours; the 순위 rebuilds it), read once a request. */
export const roomSnapshot = (db: any, now: number) => rankingSnapshot(db, now, RANKING_TTL, true);
/** A student's pet to show for them (their best on the snapshot: floor → level). */
const bestOf = (snap: RankSnapshot, uid: string) => snap.pets.map((p, index) => ({p, index})).filter(x => x.p.uid === uid).sort((a, b) => b.p.best - a.p.best || b.p.level - a.p.level)[0] || null;
/** A room to open from a 방 코드 or from a 방명록 · 친구 찾기 line (`at` + `id` of the snapshot; any pet but a teacher's for a
 *  student). RANK_STALE when the line is from an older snapshot; ROOM_NOT_FOUND for a code nobody has. */
export async function roomTarget(db: any, viewer: string, body: any, now: number) {
  const [snap, {teacher}] = await Promise.all([roomSnapshot(db, now), climber(db, viewer)]);
  let hit: {p: RankPet; index: number} | null;
  if (body?.code !== undefined) {
    const owner = await roomOwner(db, body.code); if (!owner) throw Error('ROOM_NOT_FOUND');
    // joined (or chose a pet) after the last snapshot: their pets read now, and the code itself names the room after
    hit = bestOf(snap, owner);
    if (!hit) { const live = (await liveRankPets(db, owner, now)).sort((a, b) => b.best - a.best || b.level - a.level)[0]; if (!live || (live.teacher && !teacher && live.uid !== viewer)) throw Error('ROOM_NOT_FOUND'); return {p: live, ref: {code: normCode(body.code)} as Record<string, unknown>}; }
  } else { if (Number(body?.at) !== snap.builtAt) throw Error('RANK_STALE'); const id = Math.floor(Number(body?.id)); hit = snap.pets[id] ? {p: snap.pets[id], index: id} : null; }
  if (!hit || (hit.p.teacher && !teacher && hit.p.uid !== viewer)) throw Error('ROOM_NOT_FOUND');
  return {p: hit.p, ref: {at: snap.builtAt, id: hit.index} as Record<string, unknown>};
}
/** Open a room from a code or a 방명록 · 친구 찾기 line: the visitor's view, with the `ref` to leave a sticker by. */
export async function openRoom(db: any, viewer: string, body: any, now: number) {
  const {p, ref} = await roomTarget(db, viewer, body, now);
  return {...await profileOf(db, viewer, p, now), ref};
}
const lineOf = (snap: RankSnapshot, x: {p: RankPet; index: number}, viewer: string) => ({at: snap.builtAt, id: x.index, label: x.p.alias || x.p.name, guild: x.p.guild || NO_GUILD, level: x.p.level, best: x.p.best, look: look(x.p), me: x.p.uid === viewer});
/** 친구 찾기: pets whose 모험가 별칭 or 원정대 이름 matches (초성 too), or the room of a 방 코드 — not a teacher's for a student, not a
 *  closed room. Up to 10. */
export async function searchRooms(db: any, viewer: string, qInput: unknown, now: number) {
  const q = String(qInput ?? '').trim().slice(0, 20); if (!q) return [];
  const [snap, {teacher}] = await Promise.all([roomSnapshot(db, now), climber(db, viewer)]);
  const owner = await roomOwner(db, q).catch(() => null), coded = owner ? bestOf(snap, owner) : null, byCode = coded && (teacher || !coded.p.teacher) ? coded : null;
  const named = snap.pets.map((p, index) => ({p, index})).filter(x => (teacher || !x.p.teacher) && [x.p.alias, x.p.guild].some(n => n && matchesKoreanSearch(n, q)));
  const list = [...(byCode ? [byCode] : []), ...named.filter(x => x.index !== byCode?.index)].slice(0, 15);
  const states = await Promise.all([...new Set(list.map(x => x.p.uid))].map(async uid => [uid, (await db.collection(PET_STATES).doc(uid).get()).data()?.roomHidden === true] as const));
  const closed = new Set(states.filter(([, h]) => h).map(([uid]) => uid));
  const lines: any[] = list.filter(x => !closed.has(x.p.uid) || x.p.uid === viewer).slice(0, 10).map(x => lineOf(snap, x, viewer));
  // a 방 코드 of someone not on the last snapshot yet: their pet read now, opened by the code
  if (owner && !coded) {
    const live = (await liveRankPets(db, owner, now)).sort((a, b) => b.best - a.best || b.level - a.level)[0];
    const shut = live && (await db.collection(PET_STATES).doc(owner).get()).data()?.roomHidden === true && owner !== viewer;
    if (live && (teacher || !live.teacher) && !shut) lines.unshift({code: normCode(q), label: live.alias || live.name, guild: live.guild || NO_GUILD, level: live.level, best: live.best, look: look(live), me: owner === viewer});
  }
  return lines;
}
/** 방명록: today's friends in my room, as their best pet's 별칭 · 원정대 이름 (a line to visit back), and the sticker. */
export async function readGuestbook(db: any, owner: string, now: number, snapIn?: RankSnapshot) {
  const [visits, snap] = await Promise.all([todaysVisits(db, owner, now), snapIn ?? roomSnapshot(db, now)]);
  return visits.map(v => { const x = bestOf(snap, v.viewer); return {sticker: v.sticker || null, gift: v.gift || null, at: Math.max(v.stuckAt || 0, v.giftAt || 0, v.at || 0), ...(x ? lineOf(snap, x, owner) : {label: '이름 없는 모험가', guild: NO_GUILD})}; });
}
/** 이웃 on or off for the room a 순위 row or a 방명록 · 찾기 line opened (`via` 'room'). */
export async function keepNeighbor(db: any, viewer: string, body: any, now: number) {
  const p = body?.via === 'room' ? (await roomTarget(db, viewer, body, now)).p : await rankTarget(db, viewer, body?.at, body?.id, body?.kind, body?.teachers, now);
  return {neighbor: await setNeighbor(db, viewer, p.uid, body?.keep === true)};
}
/** 친구 방 lists: my 이웃 (newest first; came to my room today, I left a sticker today) and 이번 주 인기 방 (응원 most this week;
 *  no closed room, no teacher's pet for a student). */
export async function readRoomLists(db: any, viewer: string, now: number, snapIn?: RankSnapshot) {
  const [snap, {teacher}, kept, visits, weekly] = await Promise.all([snapIn ?? roomSnapshot(db, now), climber(db, viewer), neighborsOf(db, viewer), todaysVisits(db, viewer, now), weeklyStickers(db, now)]);
  const came = new Set(visits.map(v => v.viewer)), stuck = await stuckToday(db, viewer, kept, now);
  const neighbors = [...kept].reverse().map(uid => ({uid, x: bestOf(snap, uid)})).filter(n => n.x).map(n => ({...lineOf(snap, n.x!, viewer), cameToday: came.has(n.uid), stuckToday: stuck.has(n.uid)}));
  // the most 응원 first, closed rooms skipped until 3 open ones are found (read a few at a time)
  const ranked = weekly.map(w => ({...w, x: bestOf(snap, w.uid)})).filter(w => w.x && (teacher || !w.x.p.teacher)), popular: any[] = [];
  for (let i = 0; i < ranked.length && popular.length < PET_ROOM.popular; i += 5) {
    const batch = ranked.slice(i, i + 5), hidden = await Promise.all(batch.map(async w => (await db.collection(PET_STATES).doc(w.uid).get()).data()?.roomHidden === true));
    batch.forEach((w, k) => { if (!hidden[k] && popular.length < PET_ROOM.popular) popular.push({...lineOf(snap, w.x!, viewer), stickers: w.n}); });
  }
  return {neighbors, popular};
}
