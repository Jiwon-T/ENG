import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from '../http.js';
import { getFirebaseAdmin } from '../firebaseAdmin.js';
import { verifyFirebaseSession } from '../firebaseSession.js';
import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import { readStudentMapping } from '../studentIdentity.js';
import { lessonReportId } from '../reportAudienceDTO.js';
import { isPaperDay, studyReports } from '../lessonRewardRows.js';
export { isPaperDay };
import type { StoredLessonReport } from '../reportSchemas.js';
import { aiErrorCode, generateAi, planOf, readPetTalk, refundPetTalkQuota, takePetTalkQuota } from '../aiModel.js';
import { AI_PLANS, PASS_NOTE, PET_TALK_DAILY_GUARD, activePlan } from '../../../src/lib/aiPlans.js';
import {
  PET_STATES, addXP, adoptPet, awardStudy, buyItem, chatRequest, museRequest, chooseCharacter, claimStudyRewards, currentPet, earnPoints, equipItem, evolveRequest, importLocalPet,
  homeworkGrades, initialPetState, noteInbox, parseAi, pendingStudyRewards, settleLessons, petSummary, petThePet, publicPetState, renamePet, setGearShow, rollDay, seoulDay, switchPet, teachRequest, wearItem, type ServerPetState,
} from '../pet.js';
import { cleanPetSpeech, petEmojiLimit, PET_ACTIONS, PET_REWARD_WINDOW_DAYS, PET_TEST_REWARD, PET_STUDY_RATES, PET_WORD_FEED, stageGame, stageQuestions, stageWithSentences, passAllows, petItem } from '../../../src/lib/petCatalog.js';
import { loadSentencesFor } from '../petSentences.js';
import { PET_GAMES, answerRun, buildRun, initialGameState, loadFeedSource, publicRun, rollGameDay, runSummary, type FeedSentence, type FeedSource, type PetGameState } from '../petWordFeed.js';
import { PET_GUILD, PET_NAMES, PET_PARTIES, addContribution, nameDocId, partyName, boardCard, checkNickname, createParty, initialGuild, joinParty, leaveParty, norm, normalizeGuild, petLook, publicParty, rankingRow, setAlias, setGuildName, settleParty, shownAlias, shownGuild, updateMemberNames, voteKick, weekOf, type GuildProfile, type Party } from '../petParty.js';
import { readTowerHall, recordTowerHall } from '../petTowerHall.js';
import { PET_RANKINGS, myPetRank, readRankProfile, readRankings, refreshRankings } from '../petRanking.js';
import { MONTH_RANK_DOC, keepsNameHidden, monthRankingSnapshot, readMonthRanking, studentRealName } from '../petMonthRanking.js';
import { PET_TOWERS, syncTowerDecor, syncGearLooks, syncGearInbox, gearLookFor, takeJob3, equipTowerGear, initialTower, loadTowerPool, openEntranceChest, openTowerDoor, publicTower, towerWrongsSessions, towerAct, towerAnswer, towerEvent, towerPet, type TowerState } from '../petTower.js';
import { couponStudentKey, couponView, placeDecor, readCoupon, readCouponView, requestCoupon, syncOfflineMedals } from '../petCoupon.js';
import { PET_EXPEDITIONS, chooseJob, chooseJob2, finishStage, initialExpedition, levelOk, petProgress, publicExpedition, stageInfo, stageUnlocked, type ExpeditionState } from '../petExpedition.js';

// GET /api/student/pet → the pet state (+ 공부 보상 waiting). POST {action,...} → one change, decided here.
type Deps = { verify: (token: string) => Promise<{uid: string}>; db: () => any; generate: (request: any) => Promise<string>; now: () => number; feedSource?: (db: any, uid: string) => Promise<FeedSource>; sentences?: (db: any, uid: string) => Promise<FeedSentence[]>; towerPool?: (db: any, uid: string) => Promise<{words: {w: string; m: string}[]; wordbookId: string; wordbookTitle: string}> };
const defaults = (): Deps => ({
  verify: token => { const {auth} = getFirebaseAdmin(); return verifyFirebaseSession(auth, token) as any; },
  db: () => getFirebaseAdmin().db,
  generate: request => generateAi(request, 'pet'),
  now: () => Date.now(),
});
const MESSAGES: Record<string, string> = {
  TOWER_NOT_READY: '선생님이 탑 단어장을 아직 정하지 않았어요.', TOWER_CHEST_FIRST: '먼저 1층 보물상자를 열어 보세요!', TOWER_CHEST_OPENED: '이미 연 보물상자예요.', TOWER_TOP: '지금은 여기가 꼭대기예요. 더 높은 층은 곧 열려요!',
  TOWER_NO_RUN: '전투가 끝났어요. 다시 들어가 주세요.', TOWER_WAIT: '지금은 문제에 답할 차례예요.', TOWER_SKILL_LOCKED: '스킬은 전직 후에 쓸 수 있어요. 1차 전직은 원정대 5장 설산의 왕관 스테이지에서 해요.', TOWER_SKILL_NOT_LEARNED: '아직 배우지 않은 스킬이에요.', TOWER_NO_MP: 'MP가 모자라요. 단어를 맞히면 MP가 2씩 차요.', TOWER_SEALED: '봉인되어 지금은 스킬을 쓸 수 없어요. 봉인이 풀릴 때까지 버텨요.', TOWER_NO_POTION: '물약이 없어요.', TOWER_IN_BATTLE: '전투 중에는 장비를 바꿀 수 없어요.', TOWER_GEAR_JOB: '이 장비는 그 직업으로 전직한 펫만 낄 수 있어요.', TOWER_SOLD_OUT: '다 팔렸어요.', TOWER_MAX_ENHANCE: '이미 최고 강화(+5)예요.', TOWER_NO_STONES: '강화석이 모자라요.', TOWER_SNEAK_INVALID: '조금 더 천천히, 길을 따라 지나가 보세요.',
  COUPON_NOT_ELIGIBLE: '이달의 장학 쿠폰은 학원에 연결된 채움 학원 학생이 받을 수 있어요.', COUPON_TAKEN: '이번 달 쿠폰은 이미 신청했어요.', COUPON_NOT_YET: '이번 달에 모은 포인트가 아직 10,000P가 안 됐어요.',
  PET_PASS_ITEM: '펫 패스·프리미엄 패스로 쓸 수 있는 방이에요.',
  PET_JOB3_LOCKED: '3차 전직은 2차 전직한 Lv.150 친구가 채움의 탑 50층을 깨면 할 수 있어요.',
  PET_JOB_BAD: '검사나 마법사 중에서 골라 주세요.', PET_JOB_TAKEN: '이 친구는 이미 전직했어요.', PET_JOB_LOCKED: '5장 설산의 왕관 스테이지를 이 친구와 통과하면 1차 전직할 수 있어요.', PET_JOB2_BAD: '이 친구의 직업에 맞는 갈래를 골라 주세요.', PET_JOB2_LOCKED: '1차 전직한 친구와 7장 꿈의 정원의 왕관 스테이지를 통과하면 2차 전직할 수 있어요.',
  PET_NOT_ENOUGH_POINTS: '포인트가 부족해요!', PET_ENERGY_ITEM_USED: '기운 회복 간식은 하루에 두 번까지 먹을 수 있어요!', PET_EXHAUSTED: '펫이 탈진했어요. 몬스터를 먹여야 깨어나요!', PET_NOT_EXHAUSTED: '몬스터는 기운을 다 써서 탈진했을 때만 먹일 수 있어요.', PET_REVIVE_USED: '몬스터는 하루에 한 번만 먹일 수 있어요.', PET_TIRED: '펫이 너무 지쳤어요. 기운을 회복시켜 주세요!',
  PET_ITEM_NOT_FOUND: '없는 물건이에요.', PET_ITEM_NOT_OWNED: '먼저 상점에서 사 주세요.', PET_ALREADY_CHOSEN: '이미 친구를 골랐어요.', PET_BAD_NAME: '이름을 입력해 주세요.',
  FEED_NO_BOOKS: '단어장을 한 번 공부하면 시작할 수 있어요. 학습 세트에서 단어장을 공부해 보세요!', FEED_STALE: '다른 화면에서 진행이 바뀌었어요. 최신 상태로 불러올게요.', FEED_BAD_CHOICE: '카드를 다시 골라 주세요.', FEED_NO_RUN: '진행 중인 게임이 없어요.', FEED_OTHER_RUN: '하던 판이 있어요. 먼저 끝내거나 그만둬 주세요.', EXPEDITION_BAD_STAGE: '없는 스테이지예요.', EXPEDITION_LOCKED: '앞 스테이지를 먼저 통과해 주세요.', EXPEDITION_LEVEL: '대표 펫 레벨이 더 높아야 갈 수 있어요.',
  RANK_STALE: '순위가 새로 바뀌었어요. 순위를 다시 열어 주세요.', NAME_REAL: '실명이 들어 있는 이름이에요.', RANK_BUILDING: '순위를 만드는 중이에요. 잠시 후 다시 열어 주세요.', PARTY_NICK_LENGTH: '이름은 2~10자로 정해 주세요.', PARTY_NICK_CONTACT: '이름에 연락처나 주소는 쓸 수 없어요.', PARTY_NICK_BANNED: '이 이름은 다시 쓸 수 없어요. 다른 이름을 정해 주세요.', PARTY_NEED_NICK: '먼저 원정대 이름과 이 펫의 모험가 별칭을 정해 주세요.', NAME_TAKEN: '이미 같은 이름을 쓰는 친구가 있어요. 그래도 이 이름으로 할까요?', PARTY_NICK_WARNED: '관리자가 이름을 바꿔 달라고 했어요. 새 이름을 정해 주세요.',
  PARTY_ONE_A_WEEK: '파티는 한 주에 한 팀만 들어갈 수 있어요.', PARTY_BAD_INPUT: '모집글을 다시 골라 주세요.', PARTY_CLOSED: '이번 주 모집이 끝난 팀이에요.', PARTY_FULL: '자리가 다 찼어요.', PARTY_NOT_MEMBER: '이 팀의 팀원이 아니에요.', PARTY_BAD_VOTE: '투표할 수 없어요.', PARTY_VOTE_TOO_SOON: '2명 팀은 상대가 3일 이상 쉬었을 때만 내보낼 수 있어요.', PARTY_NOT_FOUND: '팀을 찾을 수 없어요.',
  PET_BAD_CHARACTER: '친구를 다시 골라 주세요.', PET_NO_SLOT: '펫을 Lv.100까지 키우면 새 친구를 데려올 수 있어요.', PET_ALREADY_OWNED: '이미 함께 사는 친구예요.', PET_BAD_SLOT: '없는 펫이에요.', PET_BAD_SOURCE: '알 수 없는 학습이에요.', PET_IMPORT_CLOSED: '이미 서버에 펫이 있어요.',
  AI_BUSY: '지금은 펫이 조금 바빠요. 잠시 후 다시 해 주세요!', AI_QUOTA: '지금은 펫이 조금 바빠요. 잠시 후 다시 해 주세요!', AI_NOT_CONFIGURED: '펫이 지금은 말을 할 수 없어요. 선생님께 알려 주세요.', AI_REGION_UNSUPPORTED: '펫이 지금은 말을 할 수 없어요. 선생님께 알려 주세요.',
  PET_TALK_DAILY: `오늘은 펫이 ${PET_TALK_DAILY_GUARD}번이나 이야기했어요. 내일 또 해요!`, PET_AI_EVOLVE_LIMIT: '오늘은 펫이 충분히 혼잣말을 했어요.',
};

// The student's lessons for 수업 보상 are read in ../lessonRewardRows (shared with 반영, which settles them too).

/** The lessons' rewards waiting (출석·숙제·시험·태도), taken when the app or the pet screen opens: their points (0 when none). */
async function autoClaimStudy(db: any, uid: string, now: number, reportsIn?: any[]) {
  // no pet yet: the account is made with the points in it (the first pet is still chosen on the pet screen)
  const [snap, userSnap] = await Promise.all([db.collection(PET_STATES).doc(uid).get(), db.collection('users').doc(uid).get()]);
  const reports = reportsIn ?? await studyReports(db, uid, userSnap.data()); if (!reports.length) return 0;
  // Lessons before the switch day: the old rewards; from it on, each lesson settled to its 일지 (usually already done on
  // 반영; this catches a student linked later or a 반영 that could not reach the pet).
  const before = rollDay(snap.exists ? snap.data() : initialPetState(now, userSnap.data()?.petStats), now), dry = structuredClone(before);
  if (!pendingStudyRewards(before, reports, now).length && !settleLessons(dry, reports, now) && JSON.stringify(dry.lessonPaid || {}) === JSON.stringify(before.lessonPaid || {})) return 0;
  // the points that came in (shown as +N); a lowered 평가 shows in the 포인트 내역
  return Math.max(0, (await change(db, uid, now, s => { const ledger = structuredClone(s.ledger || []); const net = claimStudyRewards(s, pendingStudyRewards(s, reports, now)).points + settleLessons(s, reports, now); noteInbox(s, ledger); return net; })).result as number);
}
/** A name shown in the rankings changed (별칭, 원정대 이름, pet name): both snapshots are made again on their next look, so
 *  an old name (a real name no longer agreed to) is not shown to others. */
const staleRankings = (db: any) => Promise.all(['current', MONTH_RANK_DOC].map(id => db.collection(PET_RANKINGS).doc(id).set({builtAt: 0}, {merge: true})));
/** Read → change → save in one transaction (users.petStats follows). The change throws a PET_* code to refuse. */
async function change(db: any, uid: string, now: number, apply: (s: ServerPetState, exists: boolean) => any) {
  const ref = db.collection(PET_STATES).doc(uid), userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx: any) => {
    const [snap, userSnap] = await Promise.all([tx.get(ref), tx.get(userRef)]), user = userSnap.data(); // read together (one round trip)
    const s: ServerPetState = rollDay(snap.exists ? snap.data() : initialPetState(now, user?.petStats), now);
    const result = apply(s, snap.exists);
    s.updatedAt = now;
    tx.set(ref, s);
    if (user) tx.set(userRef, {petStats: petSummary(s)}, {merge: true});
    return {state: s, result};
  });
}

/** Same as change(), with the tower (petTowers/{uid}) in the same transaction. */
async function changeTower(db: any, uid: string, now: number, apply: (s: ServerPetState, t: TowerState) => any) {
  const ref = db.collection(PET_STATES).doc(uid), towerRef = db.collection(PET_TOWERS).doc(uid), userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx: any) => {
    const [snap, towerSnap, userSnap] = await Promise.all([tx.get(ref), tx.get(towerRef), tx.get(userRef)]), user = userSnap.data();
    const s: ServerPetState = rollDay(snap.exists ? snap.data() : initialPetState(now, user?.petStats), now);
    const t: TowerState = towerSnap.exists ? towerSnap.data() : initialTower(now);
    syncTowerDecor(t, s); syncGearInbox(t, s);
    const result = apply(s, t);
    syncGearLooks(t, s);
    s.updatedAt = now; t.updatedAt = now;
    tx.set(ref, s); tx.set(towerRef, t);
    // A finished battle's missed words (오답 복습) are saved together with its end.
    for (const session of result?.end ? towerWrongsSessions(uid, result.end, now) : []) tx.set(db.collection('studySessions').doc(session.id), session.data);
    if (user) tx.set(userRef, {petStats: petSummary(s)}, {merge: true});
    return {state: s, tower: t, result};
  });
}

/** Same as change(), with the game (petGames/{uid}) and 원정대 (petExpeditions/{uid}) documents in the same transaction. */
async function changeGame(db: any, uid: string, now: number, apply: (s: ServerPetState, g: PetGameState, e: ExpeditionState, party: Party | null) => any) {
  const ref = db.collection(PET_STATES).doc(uid), gameRef = db.collection(PET_GAMES).doc(uid), expRef = db.collection(PET_EXPEDITIONS).doc(uid), userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx: any) => {
    const [snap, gameSnap, expSnap, userSnap, guildSnap] = await Promise.all([tx.get(ref), tx.get(gameRef), tx.get(expRef), tx.get(userRef), tx.get(db.collection(PET_GUILD).doc(uid))]), user = userSnap.data();
    const s: ServerPetState = rollDay(snap.exists ? snap.data() : initialPetState(now, user?.petStats), now);
    const g: PetGameState = rollGameDay(gameSnap.exists ? gameSnap.data() : initialGameState(now), now);
    const e: ExpeditionState = expSnap.exists ? expSnap.data() : initialExpedition(now);
    // This week's party (if any) gets the first-time words.
    const guild = guildSnap.data() as GuildProfile | undefined, partyId = guild?.parties?.[weekOf(now)];
    const partyRef = partyId ? db.collection(PET_PARTIES).doc(partyId) : null, partySnap = partyRef ? await tx.get(partyRef) : null;
    const party: Party | null = partySnap?.exists ? partySnap.data() : null;
    const result = apply(s, g, e, party);
    if (party && partyRef) tx.set(partyRef, party);
    s.updatedAt = now; g.updatedAt = now; e.updatedAt = now;
    tx.set(ref, s); tx.set(gameRef, g); tx.set(expRef, e);
    if (user) tx.set(userRef, {petStats: petSummary(s)}, {merge: true});
    return {state: s, game: g, exp: e, result};
  });
}

/** Settle a finished week's party once: rewards go straight to each member's points (outside the daily cap). */
async function settleIfDue(db: any, partyId: string, now: number) {
  const ref = db.collection(PET_PARTIES).doc(partyId);
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref); if (!snap.exists) return null;
    const p: Party = snap.data(); if (p.settled) return null;
    const pets = await Promise.all(p.members.map((m: any) => tx.get(db.collection(PET_STATES).doc(m.uid))));
    const guilds = await Promise.all(p.members.map((m: any) => tx.get(db.collection(PET_GUILD).doc(m.uid))));
    const results = settleParty(p, now); if (!results) return null;
    p.members.forEach((m, i) => {
      const reward = results[m.uid] || 0;
      if (reward > 0) { const st: ServerPetState = rollDay(pets[i].exists ? pets[i].data() : initialPetState(now), now); earnPoints(st, reward, 'adventure', '파티 원정대'); st.points += reward; st.updatedAt = now; tx.set(db.collection(PET_STATES).doc(m.uid), st); }
      const g: GuildProfile = guilds[i].exists ? guilds[i].data() : initialGuild(now);
      // The result note shows the newest week: an older week settled late never replaces a newer note.
      if (!g.lastResult || g.lastResult.week <= p.week) g.lastResult = {week: p.week, party: partyName(p.name), progress: Math.round(Math.min(1, p.hp / p.hpMax) * 100), reward, counted: m.status === 'active' && m.count >= 10};
      g.settledParties = [...new Set([...(g.settledParties || []), p.id])]; g.updatedAt = now;
      tx.set(db.collection(PET_GUILD).doc(m.uid), g);
    });
    tx.set(ref, p);
    return results;
  });
}

/** 길드·파티: nickname, board, ranking, create/join/leave/vote. Students only get nicknames and pets back. */
async function handleGuild(action: string, body: any, db: any, uid: string, now: number, res: ServerResponse, fail: (code: string, status?: number) => any) {
  const week = weekOf(now), guildRef = db.collection(PET_GUILD).doc(uid);
  const petsOf = (st: any) => st ? rollDay(st, now) as ServerPetState : null;
  // The old nickname moves to the main pet's 별칭 (in memory when only reading; saved with the next change).
  const readGuild = async () => { const [d, st] = await Promise.all([guildRef.get(), db.collection(PET_STATES).doc(uid).get()]); const g = (d.exists ? d.data() : initialGuild(now)) as GuildProfile, s = petsOf(st.data()); if (s) normalizeGuild(g, currentPet(s).slot); return {g, s}; };
  /** My names: the 원정대 이름 and each chosen pet's 별칭 (with warnings), and whether the playing pet may join a team. */
  const names = (g: GuildProfile, s: ServerPetState | null) => { const slot = s ? currentPet(s).slot : 1;
    return {guildName: g.guildName || '', guildWarned: Boolean(g.guildWarned), movedNickname: Boolean(g.movedNickname), currentSlot: slot,
      pets: (s?.pets || []).filter(p => p.chosen).map(p => ({slot: p.slot, name: p.name, alias: g.aliases?.[p.slot] || '', warned: Boolean(g.aliasWarned?.[p.slot])})),
      ready: Boolean(g.guildName && g.aliases?.[slot] && !g.guildWarned && !g.aliasWarned?.[slot])}; };
  const view = async () => {
    const {g, s} = await readGuild(), id = g.parties[week], p = id ? (await db.collection(PET_PARTIES).doc(id).get()).data() as Party | undefined : undefined, slot = s ? currentPet(s).slot : 1;
    return {ok: true, guild: {shown: [shownGuild(g), shownAlias(g, slot)].filter(Boolean).join(' · '), names: names(g, s), joinedThisWeek: Boolean(id), lastResult: g.lastResult ? {...g.lastResult, party: partyName(g.lastResult.party)} : null}, party: p ? publicParty(p, uid, now) : null, week};
  };
  const inTx = (work: (tx: any, g: GuildProfile, s: ServerPetState | null) => Promise<any>) => db.runTransaction(async (tx: any) => { const snap = await tx.get(guildRef), st = await tx.get(db.collection(PET_STATES).doc(uid)); const g: GuildProfile = snap.exists ? snap.data() : initialGuild(now), s = petsOf(st.data()); if (s) normalizeGuild(g, currentPet(s).slot); const r = await work(tx, g, s); g.updatedAt = now; tx.set(guildRef, g); return r; });
  try {
    if (action === 'guild-state') {
      const {g} = await readGuild();
      // A past week is paid when a member looks: each past party not yet known to be settled is checked, oldest first (so
      // the last result stays the newest week). Only the ones that went through are remembered; a failed one is tried again.
      const known = new Set(g.settledParties || []), done: string[] = [];
      for (const [, id] of Object.entries(g.parties).filter(([w, id]) => w < week && !known.has(id)).sort(([a], [b]) => a.localeCompare(b))) {
        try { await settleIfDue(db, id, now); done.push(id); } catch { console.warn('PET_PARTY_SETTLE_FAILED'); }
      }
      if (done.length) await inTx(async (_tx, fresh) => { fresh.settledParties = [...new Set([...(fresh.settledParties || []), ...done])]; });
      return sendJson(res, 200, await view());
    }
    // 원정대 이름 / 모험가 별칭: the same name as another student's is allowed once the student confirms (`confirm`); a name
    // holding their own real name once they say it may show on the rankings (`realName`, remembered for that name).
    if (action === 'guild-name' || action === 'guild-alias') {
      const name = checkNickname(body.name, []), slot = Math.floor(Number(body.slot)), kind = action === 'guild-name' ? 'guild' : 'alias', owner = kind === 'guild' ? uid : `${uid}:${slot}`;
      const exposes = !keepsNameHidden(name, await studentRealName(db, uid).catch(() => ''));
      if (exposes && body.realName !== true) throw Error('NAME_REAL');
      await inTx(async (tx, g, s) => {
        const id = g.parties[week], ref = id ? db.collection(PET_PARTIES).doc(id) : null, p = ref ? (await tx.get(ref)).data() as Party | undefined : undefined;
        if (kind === 'alias' && !s?.pets.some(x => x.slot === slot && x.chosen)) throw Error('PARTY_BAD_INPUT');
        // The name registry (petNames), read and written here: another student on it means asking first.
        const old = kind === 'guild' ? g.guildName : g.aliases?.[slot], newRef = db.collection(PET_NAMES).doc(nameDocId(kind, name));
        const oldRef = old && norm(old) !== norm(name) ? db.collection(PET_NAMES).doc(nameDocId(kind, old)) : null;
        const newSnap = await tx.get(newRef), oldSnap = oldRef ? await tx.get(oldRef) : null, owners: string[] = newSnap.exists ? newSnap.data()?.owners || [] : [];
        if (body.confirm !== true && owners.some(o => o.split(':')[0] !== uid)) throw Error('NAME_TAKEN');
        if (kind === 'guild') setGuildName(g, name); else setAlias(g, slot, name);
        if (exposes) g.realNameOk = [...new Set([...(g.realNameOk || []), norm(name)])].slice(-10);
        tx.set(newRef, {owners: [...new Set([...owners, owner])]});
        if (oldRef && oldSnap?.exists) tx.set(oldRef, {owners: (oldSnap.data()?.owners || []).filter((o: string) => o !== owner)});
        if (p && ref) { updateMemberNames(p, uid, g, s ? currentPet(s).slot : undefined); tx.set(ref, p); }
      });
      await staleRankings(db); // the rankings show the new name on their next look
      return sendJson(res, 200, await view());
    }
    if (action === 'guild-board' || action === 'guild-ranking') {
      const parties = (await db.collection(PET_PARTIES).where('week', '==', week).get()).docs.map((d: any) => d.data() as Party);
      if (action === 'guild-board') return sendJson(res, 200, {ok: true, notes: parties.filter(p => !p.settled && p.members.filter(m => m.status === 'active').length < p.size).sort((a, b) => b.createdAt - a.createdAt).slice(0, 30).map(boardCard)});
      return sendJson(res, 200, {ok: true, rows: parties.map(p => rankingRow(p, uid)).sort((a, b) => b.progress - a.progress).slice(0, 30)});
    }
    if (action === 'party-create') {
      const id = crypto.randomBytes(10).toString('hex');
      await inTx(async (tx, g, s) => { if (!s) throw Error('PARTY_BAD_INPUT'); tx.set(db.collection(PET_PARTIES).doc(id), createParty(g, uid, petLook(s), body, now, id)); });
      return sendJson(res, 200, await view());
    }
    if (action === 'party-join') {
      const ref = db.collection(PET_PARTIES).doc(String(body.partyId || '_'));
      await inTx(async (tx, g, s) => { const snap = await tx.get(ref); if (!snap.exists || !s) throw Error('PARTY_NOT_FOUND'); const p: Party = snap.data(); joinParty(p, g, uid, petLook(s), now); tx.set(ref, p); });
      return sendJson(res, 200, await view());
    }
    if (action === 'party-leave' || action === 'party-vote') {
      let result: any = null;
      await inTx(async (tx, g) => {
        const id = g.parties[week]; if (!id) throw Error('PARTY_NOT_MEMBER');
        const ref = db.collection(PET_PARTIES).doc(id), snap = await tx.get(ref); if (!snap.exists) throw Error('PARTY_NOT_FOUND');
        const p: Party = snap.data();
        if (action === 'party-leave') leaveParty(p, uid);
        else { const target = p.members[Number(body.index)]; if (!target) throw Error('PARTY_BAD_VOTE'); result = voteKick(p, uid, target.uid, now); }
        tx.set(ref, p);
      });
      return sendJson(res, 200, {...await view(), result});
    }
    return fail('PET_BAD_ACTION');
  } catch (e: any) {
    const code = String(e?.message || '');
    if (code.startsWith('PARTY_')) return fail(code);
    if (code === 'NAME_TAKEN' || code === 'NAME_REAL') return fail(code, 409);
    console.warn('PET_PARTY_FAILED', {code: 'unknown'});
    return sendJson(res, 500, {ok: false, error: 'SERVER_ERROR', message: '잠시 후 다시 해 주세요.'});
  }
}

export async function handlePet(req: IncomingMessage, res: ServerResponse, deps: Deps = defaults()) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return sendJson(res, 401, {ok: false, error: 'UNAUTHORIZED'});
  let uid: string;
  try { uid = (await deps.verify(header.slice(7).trim())).uid; } catch { return sendJson(res, 401, {ok: false, error: 'INVALID_TOKEN'}); }
  const db = deps.db(), now = deps.now();
  const fail = (code: string, status = 400) => sendJson(res, status, {ok: false, error: code, message: MESSAGES[code] || '잠시 후 다시 해 주세요.'});
  try {
    if (req.method === 'GET' && new URL(req.url || '', 'http://localhost').searchParams.get('summary') === '1') {
      // The home screen and the top bar: points, the AI pass, the best 모험가 place and, for 장학 쿠폰 students, this month's
      // progress (reads only; the ranking snapshot is used as it is, rebuilt here only when over 6 hours old).
      // the lessons' points come in by themselves when the app opens (no button to press)
      const claimed = await autoClaimStudy(db, uid, now).catch(() => { console.warn('PET_AUTO_CLAIM_FAILED'); return 0; });
      const [st, pass, couponKey] = await Promise.all([db.collection(PET_STATES).doc(uid).get(), db.collection('aiPasses').doc(uid).get(), couponStudentKey(db, uid).catch(() => null)]);
      const plan = activePlan(pass.data(), seoulDay(now)), state = st.exists ? rollDay(st.data(), now) : null;
      const coupon = couponKey && state ? await readCouponView(db, uid, state, true) : null;
      // A failed ranking read leaves `rank` out (not null = 'no place yet', shown as –위), so the chip waits for the next
      // visit. rankTeacher: the place is in the ranking with the teachers (the chip opens that view).
      const rank = await myPetRank(db, uid, now, Boolean(state)).then(r => ({rank: r.rank, ...(r.teacher ? {rankTeacher: true} : {})}), () => { console.warn('PET_RANK_FAILED'); return {}; });
      return sendJson(res, 200, {ok: true, hasPet: st.exists, points: state ? Number(state.points || 0) : 0, pass: plan === 'free' ? null : {plan, until: String(pass.data()?.until || '')},
        coupon: coupon ? {earned: coupon.earned, goal: coupon.goal, requested: coupon.requested} : null, ...(claimed ? {claimed} : {}), ...rank,
        // 쌓인 포인트 알림 (shown once as a popup, then inbox-seen)
        ...(state?.inbox?.length ? {inbox: state.inbox} : {})});
    }
    // A pass-only room after the pass ended shows the plain room in every response (the choice is kept for when it is back).
    const shownState = async (st: ServerPetState) => {
      const room = petItem(st.background);
      return publicPetState(room?.pass && !passAllows(room, await planOf(db, uid, now)) ? {...st, background: 'default'} : st);
    };
    if (req.method === 'GET') {
      // Opening the screen: every document is read at once, and the unfinished game comes along (no second request).
      // the lessons read once: taken first, and the same list counts what is still waiting below
      const studied = await studyReports(db, uid).catch(() => []);
      await autoClaimStudy(db, uid, now, studied).catch(() => { console.warn('PET_AUTO_CLAIM_FAILED'); return 0; });
      // coupons asked offline before the student had the app: their medals go into the room now
      await couponStudentKey(db, uid).then(key => key ? syncOfflineMedals(db, uid, key, now) : 0).catch(() => { console.warn('PET_OFFLINE_MEDALS_FAILED'); return 0; });
      const [snap, userSnap, g, e] = await Promise.all([db.collection(PET_STATES).doc(uid).get(), db.collection('users').doc(uid).get(), db.collection(PET_GAMES).doc(uid).get(), db.collection(PET_EXPEDITIONS).doc(uid).get()]);
      const user = userSnap.data() || {}, s = rollDay(snap.exists ? snap.data() : initialPetState(now, user.petStats), now);
      // Study rewards, the 장학 쿠폰 and the talks left are independent: read together.
      const [reports, coupon, aiTalk] = await Promise.all([Promise.resolve(studied),
        couponStudentKey(db, uid).catch(() => null).then(key => readCouponView(db, uid, s, Boolean(key))),
        readPetTalk(db, uid, currentPet(s).slot, now).catch(() => null)]);
      const pending = pendingStudyRewards(s, reports, now);
      // 장비 모습 not kept yet (gear from before it was kept): worked out from the tower for this answer only
      if (s.pets.some(p => p.gear === undefined)) { const t = (await db.collection(PET_TOWERS).doc(uid).get()).data() as TowerState | undefined; for (const p of s.pets) if (p.gear === undefined) p.gear = gearLookFor(p, t?.pets?.[String(p.slot)]); }
      return sendJson(res, 200, {ok: true, state: await shownState(s), saved: snap.exists, pendingRewards: pending.length,
        run: publicRun(g.data()?.run || null), aiTalk, expedition: publicExpedition(e.exists ? e.data() : initialExpedition(now), currentPet(s).level, currentPet(s).slot), coupon});
    }
    if (req.method !== 'POST') return fail('PET_BAD_ACTION', 405);
    const body = await parseJsonBody(req).catch(() => ({}));
    const action = String(body?.action || '');
    const done = async (out: {state: ServerPetState; result: any}, extra: any = {}) => sendJson(res, 200, {ok: true, state: await shownState(out.state), result: out.result, ...extra});

    if (action === 'import-local') return done(await change(db, uid, now, (s, exists) => { if (exists) throw Error('PET_IMPORT_CLOSED'); importLocalPet(s, body.local); return {imported: true}; }));
    if (action === 'award') { const source = String(body.source || ''); if (!Object.hasOwn(PET_STUDY_RATES, source)) return fail('PET_BAD_SOURCE'); return done(await change(db, uid, now, s => awardStudy(s, source as any, body.count))); }
    if (action === 'inbox-seen') return done(await change(db, uid, now, s => { s.inbox = []; }));
    if (action === 'claim-study') { const reports = await studyReports(db, uid); return done(await change(db, uid, now, s => { const r = claimStudyRewards(s, pendingStudyRewards(s, reports, now)); return reports.length ? {...r, points: r.points + settleLessons(s, reports, now)} : r; }), {pendingRewards: 0}); }
    if (action === 'buy') return done(await change(db, uid, now, s => { const id = String(body.itemId || ''), r = buyItem(s, id); if (body.wear === true) wearItem(s, id); return r; }));
    // 이달의 장학 쿠폰 (no points are taken) and placing the 금메달 in a room.
    if (action === 'coupon-request') { const key = await couponStudentKey(db, uid); if (!key) return fail('COUPON_NOT_ELIGIBLE', 403); const out = await requestCoupon(db, uid, key, now, body.month, body.tier); return done({state: out.state, result: {month: out.coupon.month}}, {coupon: await readCouponView(db, uid, out.state, true)}); }
    if (action === 'decor-save') {
      const plan = petItem(String(body.background || ''))?.pass ? await planOf(db, uid, now) : 'free';
      return done(await change(db, uid, now, s => placeDecor(s, body.background, body.items, plan)));
    }
    if (action === 'equip') {
      const id = String(body.itemId || ''), plan = petItem(id)?.pass ? await planOf(db, uid, now) : 'free';
      return done(await change(db, uid, now, s => equipItem(s, id, plan)));
    }
    if (action === 'choose') return done(await change(db, uid, now, s => chooseCharacter(s, String(body.character || ''))));
    // Each pet has its own 원정대 map: the new main pet's map comes back with an adoption or a switch.
    const withMap = async (out: {state: ServerPetState; result: any}) => { const e = await db.collection(PET_EXPEDITIONS).doc(uid).get(), main = currentPet(out.state); return done(out, {expedition: publicExpedition(e.exists ? e.data() : initialExpedition(now), main.level, main.slot)}); };
    if (action === 'adopt') return withMap(await change(db, uid, now, s => adoptPet(s, String(body.character || ''))));
    if (action === 'switch') return withMap(await change(db, uid, now, s => switchPet(s, Number(body.slot))));
    // 단어 먹이 주기 and 원정대. 'feed-state' never charges; 'feed-start' resumes the unfinished game for free (a game for
    // another stage, or a plain game, must be finished or restarted first: restart is a new entry and costs energy again).
    const feedDone = (out: {state: ServerPetState; game: PetGameState; exp: ExpeditionState; result: any}) => sendJson(res, 200, {ok: true, state: publicPetState(out.state), run: publicRun(out.game.run), expedition: publicExpedition(out.exp, currentPet(out.state).level, currentPet(out.state).slot), result: out.result});
    if (action === 'feed-state' || action === 'expedition-state') {
      const [g, e, p] = await Promise.all([db.collection(PET_GAMES).doc(uid).get(), db.collection(PET_EXPEDITIONS).doc(uid).get(), db.collection(PET_STATES).doc(uid).get()]);
      const main = p.exists ? currentPet(rollDay(p.data(), now)) : {level: 1, slot: 1};
      return sendJson(res, 200, {ok: true, run: publicRun(g.data()?.run || null), expedition: publicExpedition(e.exists ? e.data() : initialExpedition(now), main.level, main.slot)});
    }
    if (action === 'feed-start') {
      const stage = typeof body.stage === 'string' && body.stage ? body.stage : null, restart = body.restart === true;
      if (stage && !stageInfo(stage)) return fail('EXPEDITION_BAD_STAGE');
      const [gameSnap, expSnap, petSnap] = await Promise.all([db.collection(PET_GAMES).doc(uid).get(), db.collection(PET_EXPEDITIONS).doc(uid).get(), db.collection(PET_STATES).doc(uid).get()]);
      const current = gameSnap.data() as PetGameState | undefined, active = current?.run && !current.run.finished ? current.run : null;
      const mainSlot = petSnap.exists ? currentPet(petSnap.data()).slot : 1;
      if (stage && !stageUnlocked(petProgress(expSnap.exists ? expSnap.data() : initialExpedition(now), mainSlot), stage)) return fail('EXPEDITION_LOCKED');
      if (active && !restart && (active.stage || null) !== stage) return fail('FEED_OTHER_RUN', 409);
      // The stage's game (원정대: 철자, 듣고 고르기, 짝 맞추기, 문장 배열, 섞어서); sentences from the grade's 문장 세트.
      // The stage's sentences and the words are independent: read together.
      const [sentences, source] = await Promise.all([!(active && !restart) && stage && stageWithSentences(stage) ? (deps.sentences || loadSentencesFor)(db, uid).catch(() => []) : Promise.resolve(undefined),
        active && !restart ? Promise.resolve(null) : (deps.feedSource || loadFeedSource)(db, uid)]);
      const fresh = !source ? null : buildRun(source, current?.day === seoulDay(now) ? current.rewardedToday : [], now, Math.random, stage || undefined, stageQuestions(stage),
        {game: stageGame(stage), sentences, quiet: body.quiet === true, noMic: body.noMic === true});
      if (!fresh && !(active && !restart)) return fail('FEED_NO_BOOKS');
      return feedDone(await changeGame(db, uid, now, (s, g, e) => {
        if (stage && !levelOk(stage, currentPet(s).level)) throw Error('EXPEDITION_LEVEL');
        if (stage && !stageUnlocked(petProgress(e, currentPet(s).slot), stage)) throw Error('EXPEDITION_LOCKED');
        const live = g.run && !g.run.finished ? g.run : null;
        if (live && !restart) { if ((live.stage || null) !== stage) throw Error('FEED_OTHER_RUN'); return {resumed: true}; }
        if (!fresh) throw Error('FEED_STALE');
        const pet = currentPet(s); if (pet.energy < PET_WORD_FEED.energy) throw Error('PET_TIRED');
        pet.energy -= PET_WORD_FEED.energy; g.run = stage ? {...fresh, slot: pet.slot} : fresh; // a stage counts for the pet that started it
        return {resumed: false, energy: PET_WORD_FEED.energy};
      }));
    }
    if (action === 'feed-answer') return feedDone(await changeGame(db, uid, now, (s, g, e, party) => {
      const index = Number(body.index), r: any = answerRun(g, s, String(body.runId || ''), index, {choice: body.choice === undefined ? undefined : Number(body.choice), text: typeof body.text === 'string' ? body.text.slice(0, 400) : undefined, correct: body.correct === true, pick: Array.isArray(body.pick) ? [Number(body.pick[0]), Number(body.pick[1])] : undefined}), q = g.run?.questions[index];
      // Party: a word answered right for the first time (sentences and boards don't count toward the boss).
      if (party && !r.repeat && !r.pending && r.correct && q && !q.retry && ['meaning', 'listen', 'spell', undefined].includes(q.type)) r.party = addContribution(party, uid, q.key, petLook(s), now);
      // The last answer of a stage game settles the stage here, once (a resent answer comes back as `repeat`).
      if (!r.repeat && g.run?.finished && g.run.stage) r.expedition = finishStage(e, s, g.run.stage, runSummary(g.run).stars, g.run.slot);
      return r;
    }));
    if (action === 'choose-job') return feedDone(await changeGame(db, uid, now, (s, _g, e) => chooseJob(e, s, body.job)));
    if (action === 'choose-job2') return feedDone(await changeGame(db, uid, now, (s, _g, e) => chooseJob2(e, s, body.job2)));
    if (action === 'feed-quit') return feedDone(await changeGame(db, uid, now, (_s, g) => { g.run = null; return {quit: true}; }));
    // 채움의 탑. The end of a battle (won, lost, ran away) sends its missed words to 오답 복습.
    if (action.startsWith('tower-')) {
      const towerDone = async (out: {state: ServerPetState; tower: TowerState; result: any}) => {
        const {end: _end, ...result} = out.result || {}; // the battle's internals stay on the server
        return sendJson(res, 200, {ok: true, state: publicPetState(out.state), tower: publicTower(out.tower, out.state, now), result});
      };
      if (action === 'tower-state') {
        const [p, t, u] = await Promise.all([db.collection(PET_STATES).doc(uid).get(), db.collection(PET_TOWERS).doc(uid).get(), db.collection('users').doc(uid).get()]);
        const s = rollDay(p.exists ? p.data() : initialPetState(now, u.data()?.petStats), now);
        return sendJson(res, 200, {ok: true, tower: publicTower(t.exists ? t.data() : initialTower(now), s, now)});
      }
      if (action === 'tower-chest') return towerDone(await changeTower(db, uid, now, (s, t) => openEntranceChest(t, s)));
      if (action === 'tower-equip') return towerDone(await changeTower(db, uid, now, (s, t) => equipTowerGear(t, s, body.gearId)));
      if (action === 'tower-job3') return towerDone(await changeTower(db, uid, now, (s, t) => takeJob3(t, s)));
      if (action === 'tower-start') {
        // The words are read before the transaction (only when a new battle starts).
        const [p, t] = await Promise.all([db.collection(PET_STATES).doc(uid).get(), db.collection(PET_TOWERS).doc(uid).get()]);
        const me = p.exists ? currentPet(rollDay(p.data(), now)) : null, slot = me ? me.slot : 1, tpNow = t.exists ? towerPet(t.data(), slot) : null, live = tpNow?.run || tpNow?.event;
        // a pet with a job (skills) also gets sentences: its skills ask 문장 배열
        const [words, sentences] = live ? [null, []] : await Promise.all([(deps.towerPool || loadTowerPool)(db, uid), me?.job ? (deps.sentences || loadSentencesFor)(db, uid).catch(() => []) : Promise.resolve([])]);
        const pool = words && {...words, sentences};
        return towerDone(await changeTower(db, uid, now, (s, tw) => { const tp = towerPet(tw, currentPet(s).slot); if (tp.run || tp.event) return {resumed: true}; if (!pool) throw Error('TOWER_NO_RUN'); return openTowerDoor(tw, s, uid, pool, now, Math.random, body.door, undefined, body.requestId); }));
      }
      if (action === 'tower-act') return towerDone(await changeTower(db, uid, now, (s, t) => towerAct(t, s, body.move, now, Math.random, body.skill)));
      if (action === 'tower-event') return towerDone(await changeTower(db, uid, now, (s, t) => towerEvent(t, s, body.move, body, now)));
      if (action === 'tower-answer') {
        const out = await changeTower(db, uid, now, (s, t) => towerAnswer(t, s, body.runId, body.choice, now));
        // A boss beaten: 명예의 전당 (its own small transaction; a failure there never undoes the win).
        if (out.result?.won) {
          try { const hall = await recordTowerHall(db, uid, out.result.floor, out.result.attacks, out.state, out.tower, now); if (hall) out.result.hall = hall; } catch { console.error('TOWER_HALL_FAILED'); }
        }
        return towerDone(out);
      }
      if (action === 'tower-hall') return sendJson(res, 200, {ok: true, hall: await readTowerHall(db, uid, body.teachers === true)});
      return fail('PET_BAD_ACTION');
    }
    // 순위 (모험가·원정대) and one pet's room from it.
    if (action === 'rank-board') return sendJson(res, 200, {ok: true, ranking: body.kind === 'month' ? await readMonthRanking(db, uid, now) : await readRankings(db, uid, body.kind, body.teachers, now)});
    if (action === 'rank-refresh') return sendJson(res, 200, {ok: true, ...(body.kind === 'month' ? {at: (await monthRankingSnapshot(db, now)).builtAt} : await refreshRankings(db, now))});
    if (action === 'rank-profile') return sendJson(res, 200, {ok: true, profile: await readRankProfile(db, uid, body.at, body.id, body.kind, body.teachers, now)});
    if (action.startsWith('guild-') || action.startsWith('party-')) return handleGuild(action, body, db, uid, now, res, fail);
    if (action === 'rename') {
      const real = await studentRealName(db, uid).catch(() => ''), out = await change(db, uid, now, s => renamePet(s, String(body.name || ''), real, body.realName === true));
      await staleRankings(db); // the old name (and a real name no longer agreed to) leaves the rankings
      return done(out);
    }
    if (action === 'pet') return done(await change(db, uid, now, s => petThePet(s)));
    if (action === 'gear-show') return done(await change(db, uid, now, s => setGearShow(s, body.show, body.style)));

    // 영어 회화 모드: on only with a pass (펫 패스·프리미엄); off any time.
    if (action === 'english-talk') {
      const on = body.on === true;
      if (on && !AI_PLANS[await planOf(db, uid, now)].englishTalk) return sendJson(res, 403, {ok: false, error: 'PET_PASS_ONLY', message: PASS_NOTE.englishTalk});
      return done(await change(db, uid, now, s => { s.englishTalk = on; return {englishTalk: on}; }));
    }
    if (action === 'teach' || action === 'chat' || action === 'evolve' || action === 'muse') {
      const text = String(body.text || '').trim();
      if ((action === 'teach' || action === 'chat') && !text) return fail('PET_BAD_NAME');
      const snap = await db.collection(PET_STATES).doc(uid).get(), user = (await db.collection('users').doc(uid).get()).data();
      const before = rollDay(snap.exists ? snap.data() : initialPetState(now, user?.petStats), now), pet = currentPet(before);
      const cost = action === 'evolve' || action === 'muse' ? 0 : PET_ACTIONS[action].energy;
      if (pet.energy < cost) return fail('PET_TIRED');
      const phrase = action === 'evolve' ? pet.learnedPhrases.find(p => p.original === text) : null;
      if (action === 'evolve' && !phrase) return fail('PET_BAD_ACTION');
      const kind = action === 'evolve' || action === 'muse' ? 'evolve' : 'talk', quota = await takePetTalkQuota(db, uid, pet.slot, kind, now);
      if ('code' in quota) return quota.code === 'PET_TALK_LIMIT' ? sendJson(res, 429, {ok: false, error: quota.code, message: quota.plan === 'free' ? `이번 달 이 펫과의 대화 ${AI_PLANS.free.petTalkPerPet}번을 다 썼어요. ${PASS_NOTE.pet}` : `이번 달 펫 대화 ${AI_PLANS[quota.plan].petTalk}번을 다 썼어요. 다음 달에 또 이야기해요!`}) : fail(quota.code, 429);
      let reply: any;
      // 영어 회화 모드 counts only while the pass is in force (the talk quota already knows the plan).
      const english = Boolean(before.englishTalk) && 'plan' in quota && AI_PLANS[quota.plan].englishTalk, hour = Number(new Intl.DateTimeFormat('en-US', {timeZone: 'Asia/Seoul', hour: 'numeric', hourCycle: 'h23'}).format(now));
      try { reply = parseAi(await deps.generate(action === 'teach' ? teachRequest(pet, text) : action === 'chat' ? chatRequest(pet, text, Array.isArray(body.history) ? body.history : [], english) : action === 'muse' ? museRequest(before, pet, hour, english) : evolveRequest(pet, phrase!.remembered, phrase!.original))); }
      catch (e: any) { const code = aiErrorCode(e); console.warn('PET_AI_FAILED', {action, code}); await refundPetTalkQuota(db, uid, pet.slot, kind, now).catch(() => undefined); return fail(code, 503); } // the code only, never the words
      const say = cleanPetSpeech(String(reply.response || reply.monologue || ''), petEmojiLimit(pet.level)).slice(0, 200);
      if (!say) { console.warn('PET_AI_FAILED', {action, code: 'AI_EMPTY_REPLY'}); await refundPetTalkQuota(db, uid, pet.slot, kind, now).catch(() => undefined); return fail('AI_FAILED', 502); }
      // 상황 혼잣말 is said and gone (nothing saved).
      if (action === 'muse') return sendJson(res, 200, {ok: true, state: publicPetState(before), result: {reply: say}});
      // The reply goes to the pet it was asked of (counted for that slot), even if the main pet changed meanwhile.
      const talked = await change(db, uid, now, s => {
        const p = s.pets.find(x => x.slot === pet.slot);
        if (!p) throw Error('PET_BAD_ACTION');
        const key = String(Math.floor(p.level / 10) * 10);
        if (action === 'evolve') { const lp = p.learnedPhrases.find(x => x.original === text); if (lp) lp.evolvedVersions[key] = say; return {reply: say}; }
        if (p.energy < cost) throw Error('PET_TIRED');
        p.energy -= cost;
        if (action === 'teach') { p.learnedPhrases = [...p.learnedPhrases, {original: text.slice(0, 100), remembered: String(reply.remembered || text).slice(0, 100), learnedAtLevel: p.level, evolvedVersions: {[key]: say}}].slice(-50); }
        const {leveledUp} = addXP(s, PET_ACTIONS[action].xp, p);
        return {reply: say, leveledUp};
      }).catch(async (e: any) => { await refundPetTalkQuota(db, uid, pet.slot, kind, now).catch(() => undefined); throw e; }); // not saved: the talk is given back
      // The talk tab shows how many talks are left this month.
      return done(talked, kind === 'talk' ? {aiTalk: await readPetTalk(db, uid, pet.slot, now).catch(() => null)} : {});
    }
    return fail('PET_BAD_ACTION');
  } catch (e: any) {
    const code = String(e?.message || '');
    if (MESSAGES[code]) return fail(code);
    console.warn('PET_FAILED', {code: code.startsWith('PET_') ? code : 'unknown'});
    return sendJson(res, 500, {ok: false, error: 'SERVER_ERROR', message: '잠시 후 다시 해 주세요.'});
  }
}
export default function handler(req: IncomingMessage, res: ServerResponse) { return handlePet(req, res); }
