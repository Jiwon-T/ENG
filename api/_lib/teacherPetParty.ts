import {z} from 'zod';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {readStudentMapping} from './studentIdentity.js';
import {DIRECTORY_ROWS, directoryRowKey} from './academyDirectorySource.js';
import {PET_GUILD, PET_PARTIES, inactiveDays, progressOf, shownNickname, warnNickname, weekOf, type GuildProfile, type Party} from './petParty.js';
import {PET_STATES, publicPetState, rollDay, type ServerPetState} from './pet.js';
import {PET_EXPEDITIONS, initialExpedition, publicExpedition} from './petExpedition.js';

// 원정대 파티 for teachers: a teacher sees the whole team of their own student (students of the same academy by name,
// others by nickname only); the admin sees every nickname and can warn one (the student must then pick a new one).
const allowedStudent = (actor: any, key: string) => actor.admin || actor.principal || [...(actor.scopes || []), ...(actor.teachingScopes || [])].some((s: any) => s.studentKey === key);
function admin(actor: any) { if (!actor.admin || actor.academyId !== 'main') throw Error('FORBIDDEN'); }

/** The academy's name for a student account, or null when the account isn't a student of this academy. */
async function nameInAcademy(db: any, uid: string, academyId: string) {
  const key = (await db.collection('users').doc(uid).get()).data()?.notionStudentKey;
  if (typeof key !== 'string' || !key) return null;
  const member = (await db.collection('academyStudentMemberships').doc(key).get()).data();
  if (!member || member.disabled || member.academyId !== academyId) return null;
  const row = (await db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students', key)).get()).data();
  const fromRow = row?.kind === 'students' && row.academyId === academyId ? row.fields?.summaryOverride?.studentDisplayName : null;
  return String(fromRow || (await readStudentMapping(db, key))?.studentDisplayName || '학생').slice(0, 40);
}

/** This week's party of one student (the teacher's own), for the student page in the teacher room. */
export async function readStudentParty(db: any, actor: any, id: unknown, now = Date.now()) {
  const key = uuid(z.string().uuid().parse(id));
  if (!allowedStudent(actor, key)) throw Error('FORBIDDEN');
  const uid = (await readStudentMapping(db, key))?.firebaseUid;
  if (!uid) return {party: null};
  const guild = (await db.collection(PET_GUILD).doc(uid).get()).data() as GuildProfile | undefined, partyId = guild?.parties?.[weekOf(now)];
  const party = partyId ? (await db.collection(PET_PARTIES).doc(partyId).get()).data() as Party | undefined : undefined;
  if (!party) return {party: null, nickname: guild?.nickname || ''};
  const members = await Promise.all([...party.members].sort((a, b) => b.count - a.count).map(async m => {
    const name = await nameInAcademy(db, m.uid, actor.academyId);
    return {name, ourAcademy: Boolean(name), nickname: m.nickname, pet: m.pet, count: m.count, status: m.status, idleDays: inactiveDays(m, now), isStudent: m.uid === uid};
  }));
  return {party: {name: party.name, boss: party.boss, size: party.size, progress: progressOf(party), hp: party.hp, hpMax: party.hpMax, week: party.week, members}, nickname: guild?.nickname || ''};
}

/** Admin: every guild nickname with the account name, newest first. */
export async function listGuildNicknames(db: any, actor: any) {
  admin(actor);
  const docs = (await db.collection(PET_GUILD).limit(1000).get()).docs.filter((d: any) => d.data()?.nickname);
  const rows = await Promise.all(docs.map(async (d: any) => { const g = d.data() as GuildProfile, u = (await db.collection('users').doc(d.id).get()).data() || {};
    return {uid: d.id, nickname: g.nickname, warned: Boolean(g.warned), banned: g.banned?.length || 0, account: String(u.alias || u.name || '').slice(0, 80), updatedAt: g.updatedAt || 0}; }));
  return {rows: rows.sort((a, b) => b.updatedAt - a.updatedAt)};
}

/** Admin warning: the nickname is shown as "별칭 바꾸는 중" until the student picks a new one, and can't be used again. */
export async function warnGuildNickname(db: any, actor: any, input: unknown, now = Date.now()) {
  admin(actor);
  const {uid} = z.object({uid: z.string().min(1).max(128)}).strict().parse(input);
  const ref = db.collection(PET_GUILD).doc(uid);
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref); if (!snap.exists || !snap.data()?.nickname) throw Error('NOT_FOUND');
    const g = snap.data() as GuildProfile, partyId = g.parties?.[weekOf(now)], partyRef = partyId ? db.collection(PET_PARTIES).doc(partyId) : null;
    const party = partyRef ? (await tx.get(partyRef)).data() as Party | undefined : undefined;
    warnNickname(g); g.updatedAt = now; tx.set(ref, g);
    if (party && partyRef) { for (const m of party.members) if (m.uid === uid) m.nickname = '별칭 바꾸는 중'; tx.set(partyRef, party); }
    return {warned: true};
  });
}

/** 펫 보기 (teacher room): one student's pets as the student sees them, read only. Own students for a teacher, the academy
 *  for a principal, everyone for the admin. Nothing here changes the student's pet. */
export async function readStudentPet(db: any, actor: any, id: unknown, now = Date.now()) {
  const key = uuid(z.string().uuid().parse(id));
  if (!allowedStudent(actor, key)) throw Error('FORBIDDEN');
  const uid = (await readStudentMapping(db, key))?.firebaseUid;
  if (!uid) return {pet: null};
  const [stateSnap, expSnap, guildSnap] = await Promise.all([db.collection(PET_STATES).doc(uid).get(), db.collection(PET_EXPEDITIONS).doc(uid).get(), db.collection(PET_GUILD).doc(uid).get()]);
  if (!stateSnap.exists) return {pet: null};
  const s: ServerPetState = rollDay(stateSnap.data(), now), view = publicPetState(s);
  const expState = expSnap.exists ? expSnap.data() : initialExpedition(now);
  const guild = guildSnap.data() as GuildProfile | undefined;
  // 공부 보상 already received: lesson attendance and completed assignments (counts only).
  const rewards = Object.values(s.rewarded || {}).flat();
  return {pet: {
    ...view, pets: view.pets.map(p => ({slot: p.slot, character: p.character, name: p.name, level: p.level, xp: p.xp, energy: p.energy, maxEnergy: p.maxEnergy, clothing: p.clothing, accessories: p.accessories, job: p.job || null})),
    nickname: guild?.nickname ? shownNickname(guild) : '',
    // Each pet has its own map (a new pet starts again from the first stage).
    expeditions: Object.fromEntries(s.pets.map(p => { const x = publicExpedition(expState, p.level, p.slot); return [p.slot, {current: x.current, allCleared: x.allCleared, currentNeedsLevel: x.currentNeedsLevel, totalStars: x.totalStars, maxStars: x.maxStars, chapters: x.chapters.map(c => ({id: c.id, title: c.title}))}]; })),
    rewards: {attendance: rewards.filter(r => r === 'attendance').length, assignment: rewards.filter(r => r === 'assignment').length},
  }};
}
