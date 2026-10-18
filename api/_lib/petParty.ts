// 파티 원정대: teams of 2–4 students for one week (Monday–Sunday, Seoul). A team picks a boss; every word a member answers
// right for the first time that week takes 1 off it. After the week the team is settled once: a pool by progress (30%
// and up), shared by contribution among members who answered 10+ words, at most 500P each. Students only ever see
// 원정대 names, 모험가 별칭 and pets (never real names, even from the same academy); teachers see more on their own screens.
// Names: one 원정대 이름 per student and one 모험가 별칭 per pet, free text an admin can warn (then it must change).
import {seoulDay, type ServerPetState, currentPet} from './pet.js';
import {PET_PARTY, wornAccessories} from '../../src/lib/petCatalog.js';

export const PET_GUILD = 'petGuild', PET_PARTIES = 'petParties';
/** One document per name in use (by its normalized form) listing who uses it: `uid` for a 원정대 이름, `uid:slot` for a 별칭.
 *  Read and written in the same transaction as the name, so 'another student already uses it' is never missed. */
export const PET_NAMES = 'petNames';
export const nameDocId = (kind: 'guild' | 'alias', name: string) => `${kind}_${encodeURIComponent(norm(name))}`;
export interface GuildProfile {
  version: 1; /** before 원정대 이름·별칭: one nickname per student (moved to the main pet's 별칭 on first use) */ nickname: string; warned: boolean; banned: string[];
  parties: Record<string, string>; lastResult?: PartyResult | null; updatedAt: number;
  guildName?: string; guildWarned?: boolean; aliases?: Record<string, string>; aliasWarned?: Record<string, boolean>;
  /** parties of past weeks known to be settled (not checked again) */ settledParties?: string[];
  /** normalized names, for the 'someone already uses this name' check */ guildKey?: string; aliasKeys?: string[]; /** the old nickname was moved: ask the student to look at it */ movedNickname?: boolean;
}
export interface PartyResult { week: string; party: string; progress: number; reward: number; counted: boolean }
/** Party snapshots: `accessories` (each place); snapshots saved before carry a single `accessory`. */
export interface PetLook { character: string; name: string; level: number; clothing: string | null; accessories?: string[]; accessory?: string | null; slot?: number }
/** `nickname`: what members saved before 원정대 이름·별칭 kept; now `guild` and the 별칭 of each pet (shown for the pet in `pet`). */
export interface PartyMember { uid: string; nickname: string; guild?: string; aliases?: Record<string, string>; pet: PetLook; joinedDay: string; lastActiveDay: string | null; count: number; words: string[]; status: 'active' | 'left' | 'kicked' }
export interface Party { id: string; week: string; name: string; boss: string; size: number; phrases: string[]; createdAt: number; hp: number; hpMax: number; members: PartyMember[]; votes: Record<string, string[]>; settled: boolean; results?: Record<string, number> }

const DAY = 86_400_000;
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY);
/** The Monday (Seoul) that starts the week of `now`. */
export function weekOf(now = Date.now()) { const day = seoulDay(now), d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
export const weekEndDay = (week: string) => { const d = new Date(`${week}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); };
export const weekOver = (week: string, now = Date.now()) => seoulDay(now) > weekEndDay(week);

export const initialGuild = (now = Date.now()): GuildProfile => ({version: 1, nickname: '', warned: false, banned: [], parties: {}, lastResult: null, updatedAt: now});
export const norm = (nick: string) => nick.replace(/\s+/g, '').toLowerCase();
/** Address-like text: two districts in a row (강남구 역삼동, 서울시 강남구), a numbered 동/로/길/가 (역삼1동, 테헤란로12길) or
 *  a building word (아파트, 빌라, 번지, 101호). A single word such as 구름, 꽃길 or 별동 stays allowed. */
export const looksLikeAddress = (text: string) => {
  const t = text.replace(/\s+/g, ' ');
  return /[가-힣]{1,5}(시|도|구|군)\s?[가-힣]{1,6}(구|군|동|읍|면|리|로|길)(\s|\d|$)/.test(t) || /[가-힣]\d+(동|가|로|길|번지|호)/.test(t) || /아파트|빌라|오피스텔|번지|\d+\s?(호|층|동)(\s|$)/.test(t);
};
/** Free-text nickname: 2–10 characters, nothing that looks like contact details or an address, never one an admin warned about. */
export function checkNickname(raw: unknown, banned: string[]) {
  const nick = String(raw ?? '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();
  if (/\d{4,}|@|https?:|www\.|\.(com|kr|net)\b|010|카톡|kakao|insta/i.test(nick) || looksLikeAddress(nick)) throw Error('PARTY_NICK_CONTACT');
  if (nick.length < PET_PARTY.nickname.min || nick.length > PET_PARTY.nickname.max) throw Error('PARTY_NICK_LENGTH');
  if (banned.includes(norm(nick))) throw Error('PARTY_NICK_BANNED');
  return nick;
}
export function setNickname(g: GuildProfile, raw: unknown) { g.nickname = checkNickname(raw, g.banned); g.warned = false; return g.nickname; }
/** Admin warning: the nickname must be changed and can never be used again by this student. */
export function warnNickname(g: GuildProfile) { if (g.nickname && !g.banned.includes(norm(g.nickname))) g.banned.push(norm(g.nickname)); g.warned = true; }
export const shownNickname = (g: GuildProfile | {nickname: string; warned: boolean}) => g.warned ? '별칭 바꾸는 중' : g.nickname;

// ---- 원정대 이름 (one per student) and 모험가 별칭 (one per pet) ----
export const WARNED_GUILD = '이름 바꾸는 중', WARNED_ALIAS = '별칭 바꾸는 중';
const rekey = (g: GuildProfile) => { g.guildKey = g.guildName ? norm(g.guildName) : ''; g.aliasKeys = [...new Set(Object.values(g.aliases || {}).filter(Boolean).map(norm))]; };
/** The old one-per-student nickname becomes the main pet's 별칭 (a warning carries over); the 원정대 이름 is the student's to pick. */
export function normalizeGuild(g: GuildProfile, mainSlot: number) {
  if (!g.nickname || g.aliases) return false;
  g.aliases = {[mainSlot]: g.nickname}; g.aliasWarned = g.warned ? {[mainSlot]: true} : {}; g.movedNickname = true; g.nickname = ''; g.warned = false; rekey(g);
  return true;
}
export function setGuildName(g: GuildProfile, raw: unknown) { g.guildName = checkNickname(raw, g.banned); g.guildWarned = false; g.movedNickname = false; rekey(g); return g.guildName; }
export function setAlias(g: GuildProfile, slot: number, raw: unknown) { const name = checkNickname(raw, g.banned); g.aliases = {...g.aliases, [slot]: name}; g.aliasWarned = {...g.aliasWarned, [slot]: false}; rekey(g); return name; }
/** Admin warning: shown as '…바꾸는 중' until the student picks a new name; this student can never use it again. */
export function warnName(g: GuildProfile, target: 'guild' | number) {
  const name = target === 'guild' ? g.guildName : g.aliases?.[target];
  if (!name) throw Error('NOT_FOUND');
  if (!g.banned.includes(norm(name))) g.banned.push(norm(name));
  if (target === 'guild') g.guildWarned = true; else g.aliasWarned = {...g.aliasWarned, [target]: true};
}
export const shownGuild = (g: GuildProfile | undefined | null) => !g?.guildName ? '' : g.guildWarned ? WARNED_GUILD : g.guildName;
export const shownAlias = (g: GuildProfile | undefined | null, slot: number) => !g?.aliases?.[slot] ? '' : g.aliasWarned?.[slot] ? WARNED_ALIAS : g.aliases[slot];
/** Every pet's 별칭 as others see it (warned ones hidden). */
export const shownAliases = (g: GuildProfile | undefined | null) => Object.fromEntries(Object.keys(g?.aliases || {}).map(slot => [slot, shownAlias(g, Number(slot))]));
/** '원정대 이름 · 모험가 별칭' (whichever is set). */
export const adventurerLabel = (guild: string, alias: string) => [guild, alias].filter(Boolean).join(' · ');

export const petLook = (s: ServerPetState): PetLook => { const p = currentPet(s); return {character: p.character, name: p.name, level: p.level, clothing: p.clothing ?? null, accessories: wornAccessories(p), slot: p.slot}; };
/** A weekly team is a '파티' (원정대 is the student's own name now); teams made before still say '원정대'. */
export const partyName = (name: string) => name.replace(/ 원정대$/, ' 파티');
export const activeMembers = (p: Party) => p.members.filter(m => m.status === 'active');
/** A team needs the 원정대 이름 and the playing pet's 별칭, neither under a warning. */
const ready = (g: GuildProfile, slot = 1) => { if (!g.guildName || !g.aliases?.[slot]) throw Error('PARTY_NEED_NICK'); if (g.guildWarned || g.aliasWarned?.[slot]) throw Error('PARTY_NICK_WARNED'); };
const member = (g: GuildProfile, uid: string, look: PetLook, now: number): PartyMember => ({uid, nickname: g.aliases?.[look.slot ?? 1] || '', guild: shownGuild(g), aliases: shownAliases(g), pet: look, joinedDay: seoulDay(now), lastActiveDay: null, count: 0, words: [], status: 'active'});

export function createParty(g: GuildProfile, uid: string, look: PetLook, input: any, now: number, id: string): Party {
  ready(g, look.slot);
  const week = weekOf(now); if (g.parties[week]) throw Error('PARTY_ONE_A_WEEK');
  const a = String(input?.nameA || ''), b = String(input?.nameB || ''), boss = String(input?.boss || ''), size = Number(input?.size);
  const phrases = Array.isArray(input?.phrases) ? [...new Set(input.phrases.map(String))] as string[] : [];
  if (!(PET_PARTY.nameA as readonly string[]).includes(a) || !(PET_PARTY.nameB as readonly string[]).includes(b) || !PET_PARTY.bosses.some(x => x.id === boss)
    || !(PET_PARTY.sizes as readonly number[]).includes(size) || phrases.length < 1 || phrases.length > 2 || phrases.some(p => !(PET_PARTY.phrases as readonly string[]).includes(p))) throw Error('PARTY_BAD_INPUT');
  g.parties[week] = id;
  return {id, week, name: `${a} ${b} 파티`, boss, size, phrases, createdAt: now, hp: 0, hpMax: size * PET_PARTY.hpPerMember, votes: {}, settled: false,
    members: [member(g, uid, look, now)]};
}
export function joinParty(p: Party, g: GuildProfile, uid: string, look: PetLook, now: number) {
  ready(g, look.slot);
  const week = weekOf(now);
  if (p.week !== week || p.settled) throw Error('PARTY_CLOSED');
  if (g.parties[week]) throw Error('PARTY_ONE_A_WEEK');
  if (activeMembers(p).length >= p.size) throw Error('PARTY_FULL');
  g.parties[week] = p.id;
  p.members.push(member(g, uid, look, now));
}
/** Leaving is free but gives up this week's team reward; the place opens again. Still one team a week. */
export function leaveParty(p: Party, uid: string) { const m = p.members.find(x => x.uid === uid && x.status === 'active'); if (!m) throw Error('PARTY_NOT_MEMBER'); m.status = 'left'; delete p.votes[uid]; for (const k of Object.keys(p.votes)) p.votes[k] = p.votes[k].filter(v => v !== uid); }
export const inactiveDays = (m: PartyMember, now: number) => dayNumber(seoulDay(now)) - dayNumber(m.lastActiveDay || m.joinedDay);
/** Kick vote: the target doesn't vote; 50% of the others is enough. In a 2-person team only after 3+ days without play. */
export function voteKick(p: Party, voter: string, target: string, now: number) {
  const active = activeMembers(p), t = active.find(m => m.uid === target);
  if (!active.some(m => m.uid === voter) || !t || voter === target) throw Error('PARTY_BAD_VOTE');
  const eligible = active.length - 1;
  if (eligible === 1 && inactiveDays(t, now) < PET_PARTY.inactiveDays) throw Error('PARTY_VOTE_TOO_SOON');
  const votes = [...new Set([...(p.votes[target] || []), voter])];
  if (votes.length * 2 >= eligible) { t.status = 'kicked'; delete p.votes[target]; return {kicked: true}; }
  p.votes[target] = votes; return {kicked: false};
}
/** A word answered right for the first time this week by an active member takes 1 off the boss. */
export function addContribution(p: Party, uid: string, wordKey: string, look: PetLook, now: number) {
  const m = p.members.find(x => x.uid === uid && x.status === 'active');
  if (!m || p.settled || p.week !== weekOf(now)) return false;
  m.pet = look; m.lastActiveDay = seoulDay(now);
  if (m.words.includes(wordKey)) return false;
  m.words.push(wordKey); m.count += 1; p.hp = Math.min(p.hpMax, p.hp + 1);
  return true;
}
export const progressOf = (p: Party) => p.hpMax ? Math.min(1, p.hp / p.hpMax) : 0;
/** After the week: pool by progress (full on success, by share from 30%), split by contribution among members with 10+. */
export function settleParty(p: Party, now: number) {
  if (p.settled || !weekOver(p.week, now)) return null;
  const progress = progressOf(p), pool = progress >= 1 ? p.size * PET_PARTY.poolPerMember : progress >= PET_PARTY.partialFrom ? Math.floor(p.size * PET_PARTY.poolPerMember * progress) : 0;
  const counted = activeMembers(p).filter(m => m.count >= PET_PARTY.participateMin), total = counted.reduce((a, m) => a + m.count, 0);
  const results: Record<string, number> = {};
  for (const m of p.members) results[m.uid] = counted.includes(m) && total ? Math.min(PET_PARTY.weeklyCap, Math.floor(pool * m.count / total)) : 0;
  p.settled = true; p.results = results;
  return results;
}

/** A member's names as shown now: the 별칭 of the pet they last played with. Members saved before 원정대 이름·별칭 have no
 *  pet slot and only the old nickname, which is shown until the student's names are refreshed (never once refreshed). */
export const memberNames = (m: PartyMember) => {
  const alias = m.pet.slot != null ? m.aliases?.[m.pet.slot] ?? '' : m.aliases ? '' : m.nickname ?? '';
  return {guild: m.guild || '', alias, nickname: adventurerLabel(m.guild || '', alias)};
};
/** Refresh one student's names in a party (after a rename or a warning). An old member without a pet slot gets
 *  `slot` (the pet playing now) and loses the old nickname, so a warned one can't show again. */
export const updateMemberNames = (p: Party, uid: string, g: GuildProfile, slot?: number) => {
  for (const m of p.members) if (m.uid === uid) { m.guild = shownGuild(g); m.aliases = shownAliases(g); m.nickname = ''; if (m.pet.slot == null && slot != null) m.pet = {...m.pet, slot}; }
};
/** What a member sees: 원정대 names, 별칭 and pets only (no uids, no real names); members are addressed by their position. */
export function publicParty(p: Party, viewer: string, now: number) {
  const ranked = [...p.members.keys()].sort((a, b) => p.members[b].count - p.members[a].count);
  const me = p.members.find(m => m.uid === viewer), eligible = activeMembers(p).length - 1;
  return {id: p.id, week: p.week, endDay: weekEndDay(p.week), name: partyName(p.name), boss: p.boss, size: p.size, phrases: p.phrases, hp: p.hp, hpMax: p.hpMax, progress: progressOf(p), settled: p.settled,
    members: ranked.map((i, r) => { const m = p.members[i]; return {index: i, rank: r + 1, ...memberNames(m), pet: m.pet, count: m.count, status: m.status, me: m.uid === viewer, idleDays: inactiveDays(m, now),
      votes: (p.votes[m.uid] || []).length, votedByMe: Boolean(me && (p.votes[m.uid] || []).includes(viewer)), needVotes: Math.max(1, Math.ceil(eligible / 2)),
      canVote: Boolean(me?.status === 'active' && m.status === 'active' && m.uid !== viewer && (eligible > 1 || inactiveDays(m, now) >= PET_PARTY.inactiveDays))}; }),
    reward: p.results?.[viewer] ?? null};
}
/** A note on the guild board: pets only. */
export const boardCard = (p: Party) => ({id: p.id, name: partyName(p.name), boss: p.boss, phrases: p.phrases, size: p.size, filled: activeMembers(p).length, pets: activeMembers(p).map(m => m.pet)});
export const rankingRow = (p: Party, viewer: string) => ({name: partyName(p.name), boss: p.boss, progress: progressOf(p), pets: activeMembers(p).map(m => m.pet), mine: p.members.some(m => m.uid === viewer)});
