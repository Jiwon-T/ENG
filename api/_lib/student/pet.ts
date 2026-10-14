import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from '../http.js';
import { getFirebaseAdmin } from '../firebaseAdmin.js';
import { verifyFirebaseSession } from '../firebaseSession.js';
import { readStudentMapping } from '../studentIdentity.js';
import { lessonReportId } from '../reportAudienceDTO.js';
import type { StoredLessonReport } from '../reportSchemas.js';
import { generateAi, takeAiQuota } from '../../gemini.js';
import {
  PET_STATES, addXP, adoptPet, awardStudy, buyItem, chatRequest, chooseCharacter, claimStudyRewards, currentPet, equipItem, evolveRequest, importLocalPet,
  initialPetState, parseAi, pendingStudyRewards, petSummary, petThePet, publicPetState, renamePet, rollDay, seoulDay, switchPet, teachRequest, wearItem, type ServerPetState,
} from '../pet.js';
import { cleanPetSpeech, petEmojiLimit, PET_ACTIONS, PET_STUDY_RATES, PET_WORD_FEED } from '../../../src/lib/petCatalog.js';
import { PET_GAMES, answerRun, buildRun, initialGameState, loadFeedSource, publicRun, rollGameDay, runSummary, type FeedSource, type PetGameState } from '../petWordFeed.js';
import { PET_GUILD, PET_PARTIES, addContribution, boardCard, createParty, initialGuild, joinParty, leaveParty, petLook, publicParty, rankingRow, setNickname, settleParty, shownNickname, voteKick, weekOf, type GuildProfile, type Party } from '../petParty.js';
import { PET_EXPEDITIONS, finishStage, initialExpedition, levelOk, publicExpedition, stageInfo, stageUnlocked, type ExpeditionState } from '../petExpedition.js';

// GET /api/student/pet → the pet state (+ 공부 보상 waiting). POST {action,...} → one change, decided here.
type Deps = { verify: (token: string) => Promise<{uid: string}>; db: () => any; generate: (request: any) => Promise<string>; now: () => number; feedSource?: (db: any, uid: string) => Promise<FeedSource> };
const defaults = (): Deps => ({
  verify: token => { const {auth} = getFirebaseAdmin(); return verifyFirebaseSession(auth, token) as any; },
  db: () => getFirebaseAdmin().db,
  generate: generateAi,
  now: () => Date.now(),
});
const MESSAGES: Record<string, string> = {
  PET_NOT_ENOUGH_POINTS: '포인트가 부족해요!', PET_ENERGY_ITEM_USED: '기운 회복 간식은 하루에 두 번까지 먹을 수 있어요!', PET_TIRED: '펫이 너무 지쳤어요. 기운을 회복시켜 주세요!',
  PET_ITEM_NOT_FOUND: '없는 물건이에요.', PET_ITEM_NOT_OWNED: '먼저 상점에서 사 주세요.', PET_ALREADY_CHOSEN: '이미 친구를 골랐어요.', PET_BAD_NAME: '이름을 입력해 주세요.',
  FEED_NO_BOOKS: '단어장을 한 번 공부하면 시작할 수 있어요. 학습 세트에서 단어장을 공부해 보세요!', FEED_STALE: '다른 화면에서 진행이 바뀌었어요. 최신 상태로 불러올게요.', FEED_BAD_CHOICE: '카드를 다시 골라 주세요.', FEED_NO_RUN: '진행 중인 게임이 없어요.', FEED_OTHER_RUN: '하던 판이 있어요. 먼저 끝내거나 그만둬 주세요.', EXPEDITION_BAD_STAGE: '없는 스테이지예요.', EXPEDITION_LOCKED: '앞 스테이지를 먼저 통과해 주세요.', EXPEDITION_LEVEL: '대표 펫 레벨이 더 높아야 갈 수 있어요.',
  PARTY_NICK_LENGTH: '별칭은 2~10자로 정해 주세요.', PARTY_NICK_CONTACT: '별칭에 연락처나 주소는 쓸 수 없어요.', PARTY_NICK_BANNED: '이 별칭은 다시 쓸 수 없어요. 다른 별칭을 정해 주세요.', PARTY_NEED_NICK: '먼저 길드에서 쓸 별칭을 정해 주세요.', PARTY_NICK_WARNED: '관리자가 별칭을 바꿔 달라고 했어요. 새 별칭을 정해 주세요.',
  PARTY_ONE_A_WEEK: '파티는 한 주에 한 팀만 들어갈 수 있어요.', PARTY_BAD_INPUT: '모집글을 다시 골라 주세요.', PARTY_CLOSED: '이번 주 모집이 끝난 팀이에요.', PARTY_FULL: '자리가 다 찼어요.', PARTY_NOT_MEMBER: '이 팀의 팀원이 아니에요.', PARTY_BAD_VOTE: '투표할 수 없어요.', PARTY_VOTE_TOO_SOON: '2명 팀은 상대가 3일 이상 쉬었을 때만 내보낼 수 있어요.', PARTY_NOT_FOUND: '팀을 찾을 수 없어요.',
  PET_BAD_CHARACTER: '친구를 다시 골라 주세요.', PET_NO_SLOT: '펫을 Lv.100까지 키우면 새 친구를 데려올 수 있어요.', PET_ALREADY_OWNED: '이미 함께 사는 친구예요.', PET_BAD_SLOT: '없는 펫이에요.', PET_BAD_SOURCE: '알 수 없는 학습이에요.', PET_IMPORT_CLOSED: '이미 서버에 펫이 있어요.', AI_DAILY_LIMIT: '오늘 펫과 이야기할 수 있는 횟수를 다 썼어요. 내일 또 만나요!',
  AI_BUSY: '지금은 펫이 조금 바빠요. 잠시 후 다시 해 주세요!', AI_FAILED: '펫이 잘 못 알아들었어요. 다시 말해 줄래요?', PET_BAD_ACTION: '알 수 없는 동작이에요.',
};

/** The linked student's lessons for 공부 보상: id, date, attendance, and whether the student checked the assignment done. */
async function studyReports(db: any, uid: string, preloadedUser?: any) {
  const user = preloadedUser ?? (await db.collection('users').doc(uid).get()).data();
  if (!user?.notionStudentKey) return [];
  const mapping = await readStudentMapping(db, user.notionStudentKey);
  if (!mapping?.firebaseUid || mapping.firebaseUid !== uid || !mapping.internalStudentId) return [];
  const [reports, completions] = await Promise.all([db.collection('lessonReports').where('internalStudentId', '==', mapping.internalStudentId).get(), db.collection('users').doc(uid).collection('assignmentCompletions').get()]);
  const done = new Map<string, string>(completions.docs.map((d: any) => [d.id, d.data().contentHash]));
  return reports.docs.map((d: any) => d.data() as StoredLessonReport).filter((r: StoredLessonReport) => r.reportIdentity || r.notionPageId).map((r: StoredLessonReport) => {
    const id = lessonReportId(r), hash = crypto.createHash('sha256').update(r.derivedAssignment || '').digest('hex');
    return {id, date: r.lessonDateStart, attendance: r.attendance || '', assignmentCompleted: Boolean(r.derivedAssignment?.trim()) && done.get(id) === hash};
  });
}

/** Read → change → save in one transaction (users.petStats follows). The change throws a PET_* code to refuse. */
async function change(db: any, uid: string, now: number, apply: (s: ServerPetState, exists: boolean) => any) {
  const ref = db.collection(PET_STATES).doc(uid), userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref), user = (await tx.get(userRef)).data();
    const s: ServerPetState = rollDay(snap.exists ? snap.data() : initialPetState(now, user?.petStats), now);
    const result = apply(s, snap.exists);
    s.updatedAt = now;
    tx.set(ref, s);
    if (user) tx.set(userRef, {petStats: petSummary(s)}, {merge: true});
    return {state: s, result};
  });
}

/** Same as change(), with the game (petGames/{uid}) and 원정대 (petExpeditions/{uid}) documents in the same transaction. */
async function changeGame(db: any, uid: string, now: number, apply: (s: ServerPetState, g: PetGameState, e: ExpeditionState, party: Party | null) => any) {
  const ref = db.collection(PET_STATES).doc(uid), gameRef = db.collection(PET_GAMES).doc(uid), expRef = db.collection(PET_EXPEDITIONS).doc(uid), userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref), gameSnap = await tx.get(gameRef), expSnap = await tx.get(expRef), user = (await tx.get(userRef)).data();
    const s: ServerPetState = rollDay(snap.exists ? snap.data() : initialPetState(now, user?.petStats), now);
    const g: PetGameState = rollGameDay(gameSnap.exists ? gameSnap.data() : initialGameState(now), now);
    const e: ExpeditionState = expSnap.exists ? expSnap.data() : initialExpedition(now);
    // This week's party (if any) gets the first-time words.
    const guild = (await tx.get(db.collection(PET_GUILD).doc(uid))).data() as GuildProfile | undefined, partyId = guild?.parties?.[weekOf(now)];
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
      if (reward > 0) { const st: ServerPetState = rollDay(pets[i].exists ? pets[i].data() : initialPetState(now), now); st.points += reward; st.updatedAt = now; tx.set(db.collection(PET_STATES).doc(m.uid), st); }
      const g: GuildProfile = guilds[i].exists ? guilds[i].data() : initialGuild(now);
      g.lastResult = {week: p.week, party: p.name, progress: Math.round(Math.min(1, p.hp / p.hpMax) * 100), reward, counted: m.status === 'active' && m.count >= 10}; g.updatedAt = now;
      tx.set(db.collection(PET_GUILD).doc(m.uid), g);
    });
    tx.set(ref, p);
    return results;
  });
}

/** 길드·파티: nickname, board, ranking, create/join/leave/vote. Students only get nicknames and pets back. */
async function handleGuild(action: string, body: any, db: any, uid: string, now: number, res: ServerResponse, fail: (code: string, status?: number) => any) {
  const week = weekOf(now), guildRef = db.collection(PET_GUILD).doc(uid);
  const readGuild = async () => { const d = await guildRef.get(); return (d.exists ? d.data() : initialGuild(now)) as GuildProfile; };
  const view = async () => {
    const g = await readGuild(), id = g.parties[week], p = id ? (await db.collection(PET_PARTIES).doc(id).get()).data() as Party | undefined : undefined;
    return {ok: true, guild: {nickname: g.nickname, shown: g.nickname ? shownNickname(g) : '', warned: g.warned, joinedThisWeek: Boolean(id), lastResult: g.lastResult || null}, party: p ? publicParty(p, uid, now) : null, week};
  };
  const inTx = (work: (tx: any, g: GuildProfile) => Promise<any>) => db.runTransaction(async (tx: any) => { const snap = await tx.get(guildRef); const g: GuildProfile = snap.exists ? snap.data() : initialGuild(now); const r = await work(tx, g); g.updatedAt = now; tx.set(guildRef, g); return r; });
  try {
    if (action === 'guild-state') {
      const g = await readGuild();
      for (const [w, id] of Object.entries(g.parties)) if (w < week) await settleIfDue(db, id, now); // a past week is paid when a member looks
      return sendJson(res, 200, await view());
    }
    if (action === 'guild-nickname') {
      await inTx(async (tx, g) => {
        const id = g.parties[week], ref = id ? db.collection(PET_PARTIES).doc(id) : null, p = ref ? (await tx.get(ref)).data() as Party | undefined : undefined;
        const nick = setNickname(g, body.nickname);
        if (p && ref) { for (const m of p.members) if (m.uid === uid) m.nickname = nick; tx.set(ref, p); }
      });
      return sendJson(res, 200, await view());
    }
    if (action === 'guild-board' || action === 'guild-ranking') {
      const parties = (await db.collection(PET_PARTIES).where('week', '==', week).get()).docs.map((d: any) => d.data() as Party);
      if (action === 'guild-board') return sendJson(res, 200, {ok: true, notes: parties.filter(p => !p.settled && p.members.filter(m => m.status === 'active').length < p.size).sort((a, b) => b.createdAt - a.createdAt).slice(0, 30).map(boardCard)});
      return sendJson(res, 200, {ok: true, rows: parties.map(p => rankingRow(p, uid)).sort((a, b) => b.progress - a.progress).slice(0, 30)});
    }
    if (action === 'party-create') {
      const id = crypto.randomBytes(10).toString('hex');
      await inTx(async (tx, g) => { const st = (await tx.get(db.collection(PET_STATES).doc(uid))).data(); if (!st) throw Error('PARTY_BAD_INPUT'); tx.set(db.collection(PET_PARTIES).doc(id), createParty(g, uid, petLook(rollDay(st, now)), body, now, id)); });
      return sendJson(res, 200, await view());
    }
    if (action === 'party-join') {
      const ref = db.collection(PET_PARTIES).doc(String(body.partyId || '_'));
      await inTx(async (tx, g) => { const snap = await tx.get(ref), st = (await tx.get(db.collection(PET_STATES).doc(uid))).data(); if (!snap.exists || !st) throw Error('PARTY_NOT_FOUND'); const p: Party = snap.data(); joinParty(p, g, uid, petLook(rollDay(st, now)), now); tx.set(ref, p); });
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
    if (req.method === 'GET') {
      // Opening the screen: every document is read at once, and the unfinished game comes along (no second request).
      const [snap, userSnap, g, e] = await Promise.all([db.collection(PET_STATES).doc(uid).get(), db.collection('users').doc(uid).get(), db.collection(PET_GAMES).doc(uid).get(), db.collection(PET_EXPEDITIONS).doc(uid).get()]);
      const user = userSnap.data() || {}, s = rollDay(snap.exists ? snap.data() : initialPetState(now, user.petStats), now);
      const pending = pendingStudyRewards(s, await studyReports(db, uid, user).catch(() => []), now);
      return sendJson(res, 200, {ok: true, state: publicPetState(s), saved: snap.exists, pendingRewards: pending.length,
        run: publicRun(g.data()?.run || null), expedition: publicExpedition(e.exists ? e.data() : initialExpedition(now), currentPet(s).level)});
    }
    if (req.method !== 'POST') return fail('PET_BAD_ACTION', 405);
    const body = await parseJsonBody(req).catch(() => ({}));
    const action = String(body?.action || '');
    const done = (out: {state: ServerPetState; result: any}, extra: any = {}) => sendJson(res, 200, {ok: true, state: publicPetState(out.state), result: out.result, ...extra});

    if (action === 'import-local') return done(await change(db, uid, now, (s, exists) => { if (exists) throw Error('PET_IMPORT_CLOSED'); importLocalPet(s, body.local); return {imported: true}; }));
    if (action === 'award') { const source = String(body.source || ''); if (!Object.hasOwn(PET_STUDY_RATES, source)) return fail('PET_BAD_SOURCE'); return done(await change(db, uid, now, s => awardStudy(s, source as any, body.count))); }
    if (action === 'claim-study') { const reports = await studyReports(db, uid); return done(await change(db, uid, now, s => claimStudyRewards(s, pendingStudyRewards(s, reports, now))), {pendingRewards: 0}); }
    if (action === 'buy') return done(await change(db, uid, now, s => { const id = String(body.itemId || ''), r = buyItem(s, id); if (body.wear === true) wearItem(s, id); return r; }));
    if (action === 'equip') return done(await change(db, uid, now, s => equipItem(s, String(body.itemId || ''))));
    if (action === 'choose') return done(await change(db, uid, now, s => chooseCharacter(s, String(body.character || ''))));
    if (action === 'adopt') return done(await change(db, uid, now, s => adoptPet(s, String(body.character || ''))));
    if (action === 'switch') return done(await change(db, uid, now, s => switchPet(s, Number(body.slot))));
    // 단어 먹이 주기 and 원정대. 'feed-state' never charges; 'feed-start' resumes the unfinished game for free (a game for
    // another stage, or a plain game, must be finished or restarted first: restart is a new entry and costs energy again).
    const feedDone = (out: {state: ServerPetState; game: PetGameState; exp: ExpeditionState; result: any}) => sendJson(res, 200, {ok: true, state: publicPetState(out.state), run: publicRun(out.game.run), expedition: publicExpedition(out.exp, currentPet(out.state).level), result: out.result});
    if (action === 'feed-state' || action === 'expedition-state') {
      const [g, e, p] = await Promise.all([db.collection(PET_GAMES).doc(uid).get(), db.collection(PET_EXPEDITIONS).doc(uid).get(), db.collection(PET_STATES).doc(uid).get()]);
      const level = p.exists ? currentPet(rollDay(p.data(), now)).level : 1;
      return sendJson(res, 200, {ok: true, run: publicRun(g.data()?.run || null), expedition: publicExpedition(e.exists ? e.data() : initialExpedition(now), level)});
    }
    if (action === 'feed-start') {
      const stage = typeof body.stage === 'string' && body.stage ? body.stage : null, restart = body.restart === true;
      if (stage && !stageInfo(stage)) return fail('EXPEDITION_BAD_STAGE');
      const [gameSnap, expSnap] = await Promise.all([db.collection(PET_GAMES).doc(uid).get(), db.collection(PET_EXPEDITIONS).doc(uid).get()]);
      const current = gameSnap.data() as PetGameState | undefined, active = current?.run && !current.run.finished ? current.run : null;
      if (stage && !stageUnlocked(expSnap.exists ? expSnap.data() : initialExpedition(now), stage)) return fail('EXPEDITION_LOCKED');
      if (active && !restart && (active.stage || null) !== stage) return fail('FEED_OTHER_RUN', 409);
      const fresh = active && !restart ? null : buildRun(await (deps.feedSource || loadFeedSource)(db, uid), current?.day === seoulDay(now) ? current.rewardedToday : [], now, Math.random, stage || undefined);
      if (!fresh && !(active && !restart)) return fail('FEED_NO_BOOKS');
      return feedDone(await changeGame(db, uid, now, (s, g, e) => {
        if (stage && !levelOk(stage, currentPet(s).level)) throw Error('EXPEDITION_LEVEL');
        if (stage && !stageUnlocked(e, stage)) throw Error('EXPEDITION_LOCKED');
        const live = g.run && !g.run.finished ? g.run : null;
        if (live && !restart) { if ((live.stage || null) !== stage) throw Error('FEED_OTHER_RUN'); return {resumed: true}; }
        if (!fresh) throw Error('FEED_STALE');
        const pet = currentPet(s); if (pet.energy < PET_WORD_FEED.energy) throw Error('PET_TIRED');
        pet.energy -= PET_WORD_FEED.energy; g.run = fresh;
        return {resumed: false, energy: PET_WORD_FEED.energy};
      }));
    }
    if (action === 'feed-answer') return feedDone(await changeGame(db, uid, now, (s, g, e, party) => {
      const index = Number(body.index), r: any = answerRun(g, s, String(body.runId || ''), index, Number(body.choice)), q = g.run?.questions[index];
      if (party && !r.repeat && r.correct && q && !q.retry) r.party = addContribution(party, uid, q.key, petLook(s), now);
      // The last answer of a stage game settles the stage here, once (a resent answer comes back as `repeat`).
      if (!r.repeat && g.run?.finished && g.run.stage) r.expedition = finishStage(e, s, g.run.stage, runSummary(g.run).stars);
      return r;
    }));
    if (action === 'feed-quit') return feedDone(await changeGame(db, uid, now, (_s, g) => { g.run = null; return {quit: true}; }));
    if (action.startsWith('guild-') || action.startsWith('party-')) return handleGuild(action, body, db, uid, now, res, fail);
    if (action === 'rename') return done(await change(db, uid, now, s => renamePet(s, String(body.name || ''))));
    if (action === 'pet') return done(await change(db, uid, now, s => petThePet(s)));

    if (action === 'teach' || action === 'chat' || action === 'evolve') {
      const text = String(body.text || '').trim();
      if (action !== 'evolve' && !text) return fail('PET_BAD_NAME');
      const snap = await db.collection(PET_STATES).doc(uid).get(), user = (await db.collection('users').doc(uid).get()).data();
      const before = rollDay(snap.exists ? snap.data() : initialPetState(now, user?.petStats), now), pet = currentPet(before);
      const cost = action === 'evolve' ? 0 : PET_ACTIONS[action].energy;
      if (pet.energy < cost) return fail('PET_TIRED');
      const phrase = action === 'evolve' ? pet.learnedPhrases.find(p => p.original === text) : null;
      if (action === 'evolve' && !phrase) return fail('PET_BAD_ACTION');
      if (!await takeAiQuota(db, uid, now)) return fail('AI_DAILY_LIMIT', 429);
      let reply: any;
      try { reply = parseAi(await deps.generate(action === 'teach' ? teachRequest(pet, text) : action === 'chat' ? chatRequest(pet, text, Array.isArray(body.history) ? body.history : []) : evolveRequest(pet, phrase!.remembered))); }
      catch (e: any) { return fail(/503|high demand|overloaded/i.test(String(e?.message || '')) ? 'AI_BUSY' : 'AI_FAILED', 503); }
      const say = cleanPetSpeech(String(reply.response || reply.monologue || ''), petEmojiLimit(pet.level)).slice(0, 200);
      if (!say) return fail('AI_FAILED', 502);
      return done(await change(db, uid, now, s => {
        const p = currentPet(s), key = String(Math.floor(p.level / 10) * 10);
        if (action === 'evolve') { const lp = p.learnedPhrases.find(x => x.original === text); if (lp) lp.evolvedVersions[key] = say; return {reply: say}; }
        if (p.energy < cost) throw Error('PET_TIRED');
        p.energy -= cost;
        if (action === 'teach') { p.learnedPhrases = [...p.learnedPhrases, {original: text.slice(0, 100), remembered: String(reply.remembered || text).slice(0, 100), learnedAtLevel: p.level, evolvedVersions: {[key]: say}}].slice(-50); }
        const {leveledUp} = addXP(s, PET_ACTIONS[action].xp);
        return {reply: say, leveledUp};
      }));
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
