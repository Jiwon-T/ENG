// 이달 포인트 순위: every active student of the academy (app or not) by the points this month gives them — a linked
// student's pet plus what is still waiting, a student without the app from their 수업 일지 the same way (owedPoints).
// Built at most every 10 minutes into one snapshot (petRankings/month). Students only see the top 10 and their own place,
// under a name that is not the real one: a pet's 별칭, the 순위 닉네임 a teacher wrote down for the student, the pet's name,
// or else the family name only (류**). A name (or 원정대 이름) that holds the student's real name is used only when the
// student said yes to showing it (asked when they set it), or for a 닉네임, when the teacher who wrote it down did.
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {monthEarned, seoulDay} from './pet.js';
import {PET_GUILD, checkNickname, norm, shownAlias, shownGuild, type GuildProfile} from './petParty.js';
import {PET_TOWERS, climber, gearViewFor, type TowerState} from './petTower.js';
import {displayName, owedPoints} from './petCoupon.js';
import {RANKING_STALE_OK, RANKING_TTL, cachedSnapshot, docsOf} from './petRanking.js';
import {PET_COUPON, petAura, wornAccessories, type PetGearView} from '../../src/lib/petCatalog.js';
import {keepsNameHidden, maskedName} from '../../src/lib/rankNames.js';
import {shownName, studentRealName} from './realNames.js';
export {keepsNameHidden, maskedName, studentRealName};

/** 순위 닉네임 by student key: {nickname, realNameOk, by, at}, written by the admin, the principal or the student's teacher. */
export const PET_RANK_NAMES = 'petRankNames';
export const MONTH_RANK_DOC = 'month', MONTH_RANK_TOP = 10;
export type MonthRankBy = 'alias' | 'pet' | 'nick' | 'name';
export interface MonthRankLook { character: string; level: number; clothing: string | null; accessories: string[]; aura: 'light' | 'dark' | null; gear: PetGearView | null }
export interface MonthRankRow { /** student key: for the teacher's list (never sent to students) */ key?: string; uid: string | null; earned: number; label: string; by: MonthRankBy; guild: string; look: MonthRankLook | null }
export interface MonthRankSnapshot { builtAt: number; month: string; rows: MonthRankRow[]; buildingUntil?: number }

/** Every active student with their name for the ranking and this month's points (nothing else is kept). */
export async function buildMonthRanking(db: any, now: number): Promise<MonthRankSnapshot> {
  const [members, nicks] = await Promise.all([db.collection('academyStudentMemberships').where('academyId', '==', 'main').get(), docsOf(db, PET_RANK_NAMES)]);
  const keys = members.docs.filter((d: any) => !d.data().disabled).map((d: any) => { try { return uuid(d.id); } catch { return ''; } }).filter(Boolean) as string[];
  const rows = await Promise.all(keys.map(async (key): Promise<MonthRankRow | null> => {
    const o = await owedPoints(db, key, now).catch(() => null); if (!o) return null;
    const real = await displayName(db, key), entry = nicks.get(key);
    const earned = monthEarned(o.all), nick = shownName(entry?.nickname, real, entry?.realNameOk ? [norm(String(entry.nickname || ''))] : []);
    const pet = o.hadPet ? o.all.pets.find(p => p.slot === o.all.currentPetSlot && p.chosen) || null : null;
    if (pet && o.uid) {
      const [g, t] = await Promise.all([db.collection(PET_GUILD).doc(o.uid).get().then((d: any) => d.data() as GuildProfile | undefined), db.collection(PET_TOWERS).doc(o.uid).get().then((d: any) => d.data() as TowerState | undefined)]);
      const agreed = g?.realNameOk || [], alias = shownName(shownAlias(g, pet.slot), real, agreed), petName = shownName(pet.name, real, pet.realNameOk ? [norm(pet.name)] : []), guild = shownName(shownGuild(g), real, agreed);
      return {key, uid: o.uid, earned, label: alias || nick || petName || maskedName(real), by: alias ? 'alias' : nick ? 'nick' : petName ? 'pet' : 'name', guild,
        look: {character: pet.character, level: pet.level, clothing: pet.clothing ?? null, accessories: wornAccessories(pet), aura: petAura(pet), gear: gearViewFor(pet, t?.pets?.[String(pet.slot)]) ?? null}};
    }
    return {key, uid: o.uid, earned, label: nick || maskedName(real), by: nick ? 'nick' : 'name', guild: '', look: null};
  }));
  return {builtAt: now, month: seoulDay(now).slice(0, 7), rows: rows.filter(Boolean) as MonthRankRow[]};
}
/** 학생 목록 쿠폰 % reads the snapshot as it is only when it is this month's, keeps student keys and is under 10 minutes old
 *  (a stale one, or one marked stale by a name change, is made again through monthRankingSnapshot). */
export const listSnapshotFresh = (s: any, now: number) => Boolean(s && Array.isArray(s.rows) && s.month === seoulDay(now).slice(0, 7) && s.rows.some((r: any) => r.key) && now - (Number(s.builtAt) || 0) < RANKING_TTL);
/** The snapshot, rebuilt when older than 10 minutes or from last month. */
export const monthRankingSnapshot = (db: any, now: number, maxAge = RANKING_TTL, staleMax = maxAge) => cachedSnapshot<MonthRankSnapshot>(db, MONTH_RANK_DOC, now, maxAge, staleMax,
  s => Boolean(s && Array.isArray(s.rows) && s.month === seoulDay(now).slice(0, 7)), () => buildMonthRanking(db, now));

/** What `viewer` sees: the top 10 (equal points share a place; students without points this month are not placed) and
 *  their own place below when lower. No uids, keys or real names leave the server. */
export function monthRankRows(snap: MonthRankSnapshot, viewer: string) {
  const placed = snap.rows.filter(r => r.earned > 0).sort((a, b) => b.earned - a.earned);
  let rank = 0;
  const rows = placed.map((r, i) => ({rank: i && r.earned === placed[i - 1].earned ? rank : (rank = i + 1), label: r.label, by: r.by, sub: r.guild, earned: r.earned, look: r.look, me: Boolean(viewer) && r.uid === viewer}));
  const own = rows.find(r => r.me), listed = snap.rows.some(r => r.uid && r.uid === viewer);
  return {total: rows.length, rows: rows.slice(0, MONTH_RANK_TOP), mine: own ? {rank: own.rank, earned: own.earned} : listed ? {rank: null, earned: 0} : null};
}
export async function readMonthRanking(db: any, viewer: string, now: number) {
  const [{teacher}, snap] = await Promise.all([climber(db, viewer), monthRankingSnapshot(db, now, RANKING_TTL, RANKING_STALE_OK)]);
  // `stale`: older than 10 minutes (shown now; the screen asks for a rebuild and reads again)
  return {at: snap.builtAt, stale: now - snap.builtAt >= RANKING_TTL, kind: 'month' as const, teacherView: teacher, withTeachers: false, month: snap.month, goal: PET_COUPON.goal, ...monthRankRows(snap, viewer)};
}

// ---- 순위 닉네임 (학생 관리 › 장학 쿠폰): the admin and the principal for every student, a teacher for the students they have ----
function nickKeys(actor: any) {
  const whole = Boolean((actor?.admin || actor?.principal) && actor.academyId === 'main');
  if (!whole && !(actor?.scopes || []).length) throw Error('FORBIDDEN');
  const mine = new Set<string>((actor?.scopes || []).map((x: any) => { try { return uuid(String(x?.studentKey || '')); } catch { return ''; } }).filter(Boolean));
  return {whole, mine};
}
/** The 닉네임 written down for the students this teacher may see. */
export async function listRankNames(db: any, actor: any) {
  const {whole, mine} = nickKeys(actor), all = await docsOf(db, PET_RANK_NAMES), names: Record<string, {nickname: string; realNameOk: boolean}> = {};
  for (const [key, v] of all) if ((whole || mine.has(key)) && v?.nickname) names[key] = {nickname: String(v.nickname), realNameOk: Boolean(v.realNameOk)};
  return {names};
}
/** Write (or with '' clear) a student's 닉네임. One holding the student's real name is saved only with `realName: true`
 *  (asked on the screen first); without it nothing is saved and `needsConfirm` says why. The ranking shows it on its next
 *  look. */
export async function setRankNickname(db: any, actor: any, input: any, now = Date.now()) {
  let key: string; try { key = uuid(String(input?.studentKey || '')); } catch { throw Error('BAD_REQUEST'); }
  const {whole, mine} = nickKeys(actor); if (!whole && !mine.has(key)) throw Error('FORBIDDEN');
  const ref = db.collection(PET_RANK_NAMES).doc(key), raw = String(input?.nickname ?? '').trim();
  if (!raw) await ref.set({nickname: '', realNameOk: false, by: String(actor?.uid || ''), at: now}); // cleared (who and when kept)
  else {
    let nickname: string; try { nickname = checkNickname(raw, []); } catch { throw Error('RANK_NICK_BAD'); }
    const exposes = !keepsNameHidden(nickname, await displayName(db, key));
    if (exposes && input?.realName !== true) return {needsConfirm: 'real-name' as const, nickname};
    await ref.set({nickname, realNameOk: exposes, by: String(actor?.uid || ''), at: now});
  }
  await db.collection('petRankings').doc(MONTH_RANK_DOC).set({builtAt: 0}, {merge: true});
  return {nickname: raw ? (await ref.get()).data()?.nickname || '' : ''};
}
