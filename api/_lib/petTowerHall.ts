// 채움의 탑 명예의 전당: for every boss floor, the first student to beat it and the win with the fewest attacks — shared by
// every academy. Students are shown by their 원정대 nickname (read fresh, so a renamed or warned nickname changes too) and
// the pet as it looked at the win (character, outfit, room background, tower gear); never a real name or a uid.
// Teachers' wins go only into a second set of records (`all`, students and teachers), which teachers can switch on.
import {currentPet, type ServerPetState} from './pet.js';
import {PET_GUILD, adventurerLabel, shownAlias, shownGuild, shownNickname, type GuildProfile} from './petParty.js';
import {PET_TOWERS, climber, towerPet, type TowerState} from './petTower.js';
import {TOWER_GEAR_SLOTS, TOWER_ZONES, towerMonster, wornAccessories, type PetJob, type TowerGearSlot} from '../../src/lib/petCatalog.js';

export const PET_TOWER_HALL = 'petTowerHall';
export const NO_NICKNAME = '이름 없는 모험가';
export interface HallPet { /** which of the student's pets (for its 모험가 별칭) */ slot?: number; name: string; character: string; level: number; clothing: string | null; accessories: string[]; background: string; job: PetJob | null; gear: {slot: TowerGearSlot; id: string; level: number}[] }
export interface HallEntry { uid: string; pet: HallPet; attacks: number; at: number; teacher?: boolean }
export interface HallRecords { first: HallEntry | null; fewest: HallEntry | null }
export interface HallFloor extends HallRecords { floor: number; /** with the teachers' wins too */ all?: HallRecords }
export const HALL_FLOORS = TOWER_ZONES.map(z => z.to);

/** The pet as it won: outfit and room from the pet, gear (with its 강화) from the tower. */
export function hallPet(s: ServerPetState, t: TowerState): HallPet {
  const pet = currentPet(s), tp = towerPet(t, pet.slot);
  const gear = TOWER_GEAR_SLOTS.flatMap(g => { const id = tp.equip[g.id]; return id ? [{slot: g.id, id, level: tp.levels?.[id] || 0}] : []; });
  return {slot: pet.slot, name: pet.name, character: pet.character, level: pet.level, clothing: pet.clothing ?? null, accessories: wornAccessories(pet), background: s.background || 'default', job: pet.job || null, gear};
}

/** A boss win against a set of records: the first clear is kept forever; fewest attacks needs strictly fewer (ties keep the
 *  earlier). `null` = nothing changed. */
export function hallUpdate(cur: HallRecords | null | undefined, entry: HallEntry): {records: HallRecords; first: boolean; fewest: boolean} | null {
  const first = !cur?.first, fewest = !cur?.fewest || entry.attacks < cur.fewest.attacks;
  if (!first && !fewest) return null;
  return {records: {first: first ? entry : cur!.first, fewest: fewest ? entry : cur!.fewest}, first, fewest};
}

/** After a won battle on a boss floor (its own transaction, after the battle's). A teacher's win counts only in `all`.
 *  Returns what the climber now holds in the hall they see (students: the students' records; teachers: `all`). */
export async function recordTowerHall(db: any, uid: string, floor: number, attacks: number, s: ServerPetState, t: TowerState, now: number) {
  if (!HALL_FLOORS.includes(floor) || !towerMonster(floor).boss) return null;
  const teacher = (await climber(db, uid)).teacher, ref = db.collection(PET_TOWER_HALL).doc(`f${floor}`);
  const entry: HallEntry = {uid, pet: hallPet(s, t), attacks, at: now, ...(teacher ? {teacher: true} : {})};
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref), h: HallFloor = snap.exists ? snap.data() : {floor, first: null, fewest: null};
    const students = teacher ? null : hallUpdate(h, entry), all = hallUpdate(h.all || {first: h.first, fewest: h.fewest}, entry);
    if (!students && !all) return null;
    tx.set(ref, {...h, floor, ...(students ? students.records : {}), all: all ? all.records : h.all || {first: h.first, fewest: h.fewest}});
    const mine = teacher ? all : students;
    return mine ? {first: mine.first, fewest: mine.fewest} : null;
  });
}

/** What every student sees: each boss floor with its two records (nickname + pet, no uids); `me` marks the viewer's own.
 *  A boss's name stays '???' until one of the viewer's own pets has beaten that floor (the 도감 keeps monsters a mystery).
 *  A teacher may ask for the records with the teachers' wins (`withTeachers`); students always get the students' records. */
export async function readTowerHall(db: any, viewer: string, withTeachers = false) {
  const teacherView = (await climber(db, viewer)).teacher, both = withTeachers && teacherView;
  const [docs, mine] = await Promise.all([Promise.all(HALL_FLOORS.map(f => db.collection(PET_TOWER_HALL).doc(`f${f}`).get())), db.collection(PET_TOWERS).doc(viewer).get()]);
  const t: TowerState | null = mine.exists ? mine.data() : null, best = Math.max(0, ...Object.values(t?.pets || {}).map(p => Number(p?.best) || 0));
  const floors: HallRecords[] = docs.map((d: any) => { const h: HallFloor | null = d.exists ? d.data() : null; return !h ? {first: null, fewest: null} : both ? h.all || {first: h.first, fewest: h.fewest} : {first: h.first, fewest: h.fewest}; });
  const uids = [...new Set(floors.flatMap(f => [f.first?.uid, f.fewest?.uid]).filter((x): x is string => Boolean(x)))];
  const guilds = await Promise.all(uids.map(u => db.collection(PET_GUILD).doc(u).get()));
  // '원정대 이름 · 모험가 별칭' read fresh (a warned name stays hidden); records from before carry the old nickname.
  const guildOf = new Map(uids.map((u, i) => [u, guilds[i].exists ? guilds[i].data() as GuildProfile : null]));
  const label = (e: HallEntry) => { const g = guildOf.get(e.uid); return !g ? '' : adventurerLabel(shownGuild(g), e.pet.slot ? shownAlias(g, e.pet.slot) : '') || (g.nickname ? shownNickname(g) : ''); };
  const view = (e: HallEntry | null) => e && {nickname: label(e) || (e.teacher ? '선생님' : NO_NICKNAME), teacher: Boolean(e.teacher), pet: e.pet, attacks: e.attacks, at: e.at, me: e.uid === viewer};
  return {teacherView, withTeachers: both, floors: floors.map((f, i) => ({floor: HALL_FLOORS[i], boss: best >= HALL_FLOORS[i] ? towerMonster(HALL_FLOORS[i]).name : null, first: view(f.first), fewest: view(f.fewest)}))};
}
