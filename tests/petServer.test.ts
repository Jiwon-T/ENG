import { STAGE_IDS } from '../api/_lib/petExpedition.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {
  addXP, awardStudy, buyItem, claimStudyRewards, currentPet, equipItem, homeworkGrades, importLocalPet, initialPetState, pendingStudyRewards, petSummary, publicPetState, rollDay,
} from '../api/_lib/pet.js';
import {handlePet} from '../api/_lib/student/pet.js';
import {PET_DAILY_STUDY_POINTS, PET_MAX_LEVEL, xpNeeded} from '../src/lib/petCatalog.js';

const NOW = Date.parse('2026-10-14T03:00:00Z'); // 12:00 in Seoul
const DAY = 86_400_000;

test('pet: study points stop at the daily cap (XP cut by the same share) and a new Seoul day starts fresh', () => {
  const s = initialPetState(NOW);
  const first = awardStudy(s, 'vocab-test', 25); // 250P
  assert.deepEqual([first.points, first.capped], [250, false]);
  const second = awardStudy(s, 'vocab-test', 10); // only 50P room left
  assert.deepEqual([second.points, second.xp, second.capped], [50, 100, true]); // 200 XP wanted, half the points fit
  assert.equal(awardStudy(s, 'wordbook-quiz', 5).points, 0);
  assert.equal(s.today.studyPoints, PET_DAILY_STUDY_POINTS);
  assert.equal(awardStudy(s, 'vocab-test', 100000).points, 0, 'huge counts change nothing past the cap');
  currentPet(s).energy = 3;
  rollDay(s, NOW + DAY);
  assert.equal(s.today.studyPoints, 0); assert.equal(currentPet(s).energy, 100);
  assert.throws(() => awardStudy(s, 'made-up' as any, 1), /PET_BAD_SOURCE/);
});

test('pet: Lv.100 opens a place for a new friend and keeps growing; Lv.200 is the top and the XP bar never runs past full', async () => {
  const {PET_FRIEND_LEVEL, petStageLabel} = await import('../src/lib/petCatalog.js');
  assert.deepEqual([PET_FRIEND_LEVEL, PET_MAX_LEVEL], [100, 200]);
  const s = initialPetState(NOW), pet = currentPet(s);
  pet.level = PET_FRIEND_LEVEL - 1; pet.xp = 0;
  addXP(s, xpNeeded(PET_FRIEND_LEVEL - 1));
  assert.deepEqual([pet.level, s.unlockedSlots], [100, 2], 'Lv.100: one more place');
  assert.equal(xpNeeded(100), 15000, 'after Lv.100 each level takes longer');
  pet.level = PET_MAX_LEVEL - 1; pet.xp = 0;
  assert.equal(addXP(s, xpNeeded(PET_MAX_LEVEL - 1) + 5000).leveledUp, true);
  assert.deepEqual([pet.level, pet.xp, s.unlockedSlots], [PET_MAX_LEVEL, 0, 2], 'reaching 200 opens no extra place');
  assert.equal(addXP(s, 999).leveledUp, false); assert.equal(pet.xp, 0);
  assert.deepEqual([petStageLabel(99), petStageLabel(120), petStageLabel(150)], ['어른', '마스터', '전설']);
});

test('pet: 탈진 (0 기운) — only 몬스터 wakes the pet, once a day; 커피·에너지드링크 wait until then', () => {
  const s = initialPetState(NOW), pet = currentPet(s); s.points = 1000;
  assert.throws(() => buyItem(s, 'monster'), /PET_NOT_EXHAUSTED/, 'not while the pet has 기운');
  pet.energy = 0;
  assert.throws(() => buyItem(s, 'coffee'), /PET_EXHAUSTED/);
  buyItem(s, 'monster');
  assert.deepEqual([pet.energy, s.points, s.today.revives], [50, 850, 1]);
  buyItem(s, 'coffee'); buyItem(s, 'energy_drink');
  assert.equal(pet.energy, 100, 'the two snacks still work after waking (capped at 100)');
  pet.energy = 0;
  assert.throws(() => buyItem(s, 'monster'), /PET_REVIVE_USED/, 'once a day');
  const tomorrow = rollDay(s, NOW + 86_400_000);
  assert.equal(tomorrow.pets[0].energy, 100, 'a new day fills 기운 again');
});

test('pet: shop — points checked, one energy snack per day, clothes only once and only wearable when owned', () => {
  const s = initialPetState(NOW);
  assert.throws(() => buyItem(s, 'crown'), /PET_NOT_ENOUGH_POINTS/);
  s.points = 500;
  buyItem(s, 'crown'); assert.equal(s.points, 300); assert.ok(s.inventory.includes('crown'));
  assert.equal(buyItem(s, 'crown').message, '이미 가지고 있어요.'); assert.equal(s.points, 300, 'no second charge');
  currentPet(s).energy = 10;
  buyItem(s, 'coffee'); assert.equal(currentPet(s).energy, 40);
  buyItem(s, 'energy_drink'); assert.equal(currentPet(s).energy, 100, 'a second energy snack the same day');
  assert.throws(() => buyItem(s, 'coffee'), /PET_ENERGY_ITEM_USED/, 'two a day');
  assert.throws(() => buyItem(s, 'forest_cabin'), /PET_ITEM_NOT_FOUND/, '원정대 rewards are not sold');
  s.points += 500;
  assert.throws(() => equipItem(s, 'uniform'), /PET_ITEM_NOT_OWNED/);
  equipItem(s, 'crown'); assert.equal(currentPet(s).accessories.head, 'crown');
  equipItem(s, 'crown'); assert.equal(currentPet(s).accessories.head, undefined, 'tapping again takes it off');
  assert.throws(() => equipItem(s, 'cookie'), /PET_ITEM_NOT_FOUND/);
  assert.throws(() => buyItem(s, 'gold_bar'), /PET_ITEM_NOT_FOUND/);
});

test('pet: the one-time device import keeps only sane, owned things', () => {
  const s = importLocalPet(initialPetState(NOW), {
    points: 99_999_999, inventory: ['crown', 'cookie', 'hacked', 'crown'], accessory: 'crown', clothing: 'uniform', background: 'star_room', currentPetSlot: 1,
    pets: [{slot: 1, character: 'unicorn', name: '다롱이', level: 400, xp: -5, learnedPhrases: [{original: 'hi', remembered: 'hi', learnedAtLevel: 3, evolvedVersions: {'10': 'hello', evil: 'x'}}]}],
  });
  assert.equal(s.points, 50_000);
  assert.deepEqual(s.inventory, ['crown']);
  assert.deepEqual([currentPet(s).accessories, currentPet(s).clothing, s.background], [{head: 'crown'}, null, 'default']);
  const pet = currentPet(s);
  assert.deepEqual([pet.character, pet.name, pet.chosen, pet.level, pet.xp], ['unicorn', '다롱이', true, 100, 0]);
  assert.deepEqual(pet.learnedPhrases[0].evolvedVersions, {'10': 'hello'});
});

test('pet: 공부 보상 — attended lessons, and 숙제 by the next lesson 숙제 평가 (중 and above), last 30 days, each once', () => {
  const s = initialPetState(NOW);
  const reports = [
    {id: 'a', date: '2026-10-13', attendance: '출석', homeworkGrade: '최상', gradedAt: '2026-10-14'},
    {id: 'b', date: '2026-10-10', attendance: '지각', homeworkGrade: '중하', gradedAt: '2026-10-13'}, // 중하: no points
    {id: 'c', date: '2026-10-09', attendance: '결석', homeworkGrade: '미제출', gradedAt: '2026-10-10'},
    {id: 'd', date: '2026-08-01', attendance: '출석', homeworkGrade: '상', gradedAt: '2026-08-03'}, // too old
    {id: 'e', date: '2026-12-01', attendance: '출석'}, // future
    {id: 'f', date: '2026-10-08', attendance: '출석', homeworkGrade: '중', gradedAt: '2026-10-09'},
  ];
  const pending = pendingStudyRewards(s, reports, NOW);
  assert.deepEqual(pending.map(({day, ...p}) => p), [{id: 'a', kind: 'attendance'}, {id: 'a', kind: 'assignment', grade: '최상'}, {id: 'b', kind: 'attendance', grade: '지각'}, {id: 'f', kind: 'attendance'}, {id: 'f', kind: 'assignment', grade: '중'}]);
  const got = claimStudyRewards(s, pending);
  assert.deepEqual([got.points, got.xp, got.count], [30 * 2 + 15 + 40 + 10, 50 * 2 + 25 + 60 + 15, 5], '지각: 15P');
  assert.equal(s.today.studyPoints, 0, 'outside the daily study cap');
  assert.deepEqual(pendingStudyRewards(s, reports, NOW), [], 'never twice');
});

test('pet: 숙제 평가 comes from the next lesson of the same subject that has it decided (미확인 waits)', () => {
  const row = (id: string, date: string, homework: string, hasAssignment = true, subject = '영어') => ({id, date, subject, homework, hasAssignment});
  const grades = homeworkGrades([
    row('m1', '2026-10-06T14:00:00+09:00', '미확인'),
    row('x1', '2026-10-07T14:00:00+09:00', '없는 날', true, '수학'), // another subject: not for 영어
    row('m2', '2026-10-08T14:00:00+09:00', '상'),
    row('m3', '2026-10-10T14:00:00+09:00', '미확인'), // the teacher hasn't checked m2's 숙제 here yet
    row('m4', '2026-10-13T14:00:00+09:00', '미제출', false),
  ]);
  assert.deepEqual(grades.get('m1'), {grade: '상', gradedAt: '2026-10-08T14:00:00+09:00', by: 'm2'});
  assert.deepEqual(grades.get('m2'), {grade: '미제출', gradedAt: '2026-10-13T14:00:00+09:00', by: 'm4'}, '미확인 in between is skipped');
  assert.deepEqual(grades.get('m3'), {grade: '미제출', gradedAt: '2026-10-13T14:00:00+09:00', by: 'm4'});
  assert.equal(grades.has('m4'), false, 'no 숙제 given, or nothing after it yet');
  assert.equal(grades.has('x1'), false);
});

const call = async (method: string, body: any, deps: any, token = 'kid') => {
  let status = 0, out: any;
  const req: any = {method, headers: token ? {authorization: `Bearer ${token}`} : {}, body};
  const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, set statusCode(v: number) { status = v; }, get statusCode() { return status; }};
  await handlePet(req, res, deps); return {status, out};
};

test('pet API: login required; the state lives on the server and users.petStats only gets the summary', async () => {
  const f = registrationFirestore();
  f.rows.set('users/kid', {uid: 'kid', email: 'kid@example.com', role: 'student', name: '학생', petStats: {points: 40, totalXP: 0, highestLevel: 3, petName: '친구가 필요해요', character: 'molang'}});
  const deps: any = {verify: async (t: string) => { if (t !== 'kid') throw Error('bad'); return {uid: 'kid'}; }, db: () => f.db, generate: async () => '{"response":"냥!","remembered":"안녕"}', now: () => NOW};
  assert.equal((await call('GET', null, deps, '')).status, 401);
  assert.equal((await call('GET', null, deps, 'other')).status, 401);
  const first = await call('GET', null, deps);
  assert.equal(first.status, 200); assert.equal(first.out.saved, false); assert.equal(first.out.state.points, 40, 'starts from the old summary');
  assert.equal(first.out.pendingRewards, 0, 'not linked: no lesson rewards');
  assert.equal(first.out.run, null, 'no unfinished game yet'); assert.equal(first.out.expedition.current, STAGE_IDS[0], 'the expedition map comes with the first load');

  const imported = await call('POST', {action: 'import-local', local: {points: 120}}, deps);
  assert.equal(imported.out.state.points, 120);
  assert.equal((await call('POST', {action: 'import-local', local: {points: 9999}}, deps)).out.error, 'PET_IMPORT_CLOSED');

  assert.equal((await call('POST', {action: 'choose', character: 'unicorn'}, deps)).out.state.pets[0].name, '다롱');
  assert.equal((await call('POST', {action: 'choose', character: 'molang'}, deps)).out.error, 'PET_ALREADY_CHOSEN');
  for (const retired of ['kuromi', 'cinnamoroll']) assert.equal((await call('POST', {action: 'choose', character: retired}, deps)).out.error, 'PET_BAD_CHARACTER', 'retired looks are gone from the list');
  const bought = await call('POST', {action: 'buy', itemId: 'pink_ribbon'}, deps);
  assert.equal(bought.out.state.points, 70);
  const award = await call('POST', {action: 'award', source: 'vocab-test', count: 50}, deps);
  assert.equal(award.out.result.points, PET_DAILY_STUDY_POINTS);
  assert.equal((await call('POST', {action: 'quest-claim'}, deps)).out.error, 'QUEST_NOT_DONE', '오늘 할 일: a test alone does not open the 간식 상자');
  const poor = await call('POST', {action: 'buy', itemId: 'mori_girl'}, deps);
  assert.equal(poor.status, 400); assert.equal(poor.out.message, '포인트가 부족해요!');

  const taught = await call('POST', {action: 'teach', text: '오늘도 화이팅'}, deps);
  assert.equal(taught.out.result.reply, '냥!'); assert.equal(taught.out.state.pets[0].learnedPhrases[0].remembered, '안녕');
  assert.equal(taught.out.state.pets[0].energy, 80);

  const stored = f.rows.get('petStates/kid');
  assert.equal(stored.points, 370); assert.ok(stored.rewarded, 'bookkeeping stays on the server');
  assert.equal(publicPetState(stored).today.studyCap, PET_DAILY_STUDY_POINTS);
  const user = f.rows.get('users/kid');
  assert.deepEqual(user.petStats, petSummary(stored)); assert.equal(user.name, '학생', 'other profile fields untouched');
  assert.equal((await call('POST', {action: 'fly'}, deps)).out.error, 'PET_BAD_ACTION');
});

test('pet API: a tired pet cannot talk, and AI failures say so without leaking the prompt', async () => {
  const f = registrationFirestore();
  const tired = initialPetState(NOW); currentPet(tired).energy = 5; f.rows.set('petStates/kid', tired);
  const deps: any = {verify: async () => ({uid: 'kid'}), db: () => f.db, generate: async () => { throw Error('503 overloaded: secret'); }, now: () => NOW};
  assert.equal((await call('POST', {action: 'chat', text: '안녕'}, deps)).out.error, 'PET_TIRED');
  currentPet(tired).energy = 100; f.rows.set('petStates/kid', tired);
  const busy = await call('POST', {action: 'chat', text: '안녕'}, deps);
  assert.equal(busy.status, 503); assert.equal(busy.out.error, 'AI_BUSY'); assert.ok(!JSON.stringify(busy.out).includes('secret'));
  assert.equal(f.rows.get('petStates/kid').pets[0].energy, 100, 'no energy spent when the AI fails');
});

test('pet speech: baby pets get plain words — no emoji or baby-talk sounds in prompts, saved lines or idle lines', async () => {
  const {cleanPetSpeech, PET_IDLE_LINES} = await import('../src/lib/petCatalog.js');
  const {chatRequest} = await import('../api/_lib/pet.js');
  assert.equal(cleanPetSpeech('좋아! 🐱✨ 공부 했어?~~♡♡'), '좋아! 공부 했어?~♡', 'baby: no emoji, no symbol runs');
  for (const tricky of ['🇰🇷', '👍🏽', '👨‍👩‍👧', '1️⃣', '❤️']) assert.equal(cleanPetSpeech(`안녕 ${tricky}`), '안녕', `whole emoji removed: ${tricky}`);
  assert.equal(cleanPetSpeech('잘했어 👍🏽🇰🇷✨', 1), '잘했어 👍🏽', 'older pets keep one whole emoji');
  assert.equal(cleanPetSpeech('파이팅 🇰🇷', 1), '파이팅 🇰🇷', 'a flag stays whole');
  const baby = chatRequest({...currentPet(initialPetState(NOW)), level: 3}, '안녕', []).config.systemInstruction;
  assert.match(baby, /이모지는 쓰지 마/); assert.match(baby, /옹알이·의성어/);
  const older = chatRequest({...currentPet(initialPetState(NOW)), level: 50}, '안녕', []).config.systemInstruction;
  assert.doesNotMatch(older, /이모지는 쓰지 마/);
  for (const band of PET_IDLE_LINES) for (const line of band.lines) assert.equal(cleanPetSpeech(line), line, line);
  assert.ok(!PET_IDLE_LINES[0].lines.some(l => /음냐|냐!|^\.+$/.test(l)));
});

test('pet API: 호두 can be chosen; buying from the try-on puts the item on, and trying costs nothing', async () => {
  const f = registrationFirestore();
  const s = initialPetState(NOW); s.points = 200; f.rows.set('petStates/kid', s);
  const deps: any = {verify: async () => ({uid: 'kid'}), db: () => f.db, generate: async () => '{}', now: () => NOW};
  assert.equal((await call('POST', {action: 'choose', character: 'hodu'}, deps)).out.state.pets[0].name, '호두');
  const bought = await call('POST', {action: 'buy', itemId: 'uniform', wear: true}, deps);
  assert.deepEqual([bought.out.state.points, bought.out.state.clothing], [50, 'uniform']);
  const again = await call('POST', {action: 'buy', itemId: 'uniform', wear: true}, deps);
  assert.deepEqual([again.out.state.points, again.out.state.clothing], [50, 'uniform'], 'owned: no charge, stays on (never toggled off)');
  const poor = await call('POST', {action: 'buy', itemId: 'mori_girl', wear: true}, deps);
  assert.equal(poor.out.error, 'PET_NOT_ENOUGH_POINTS'); assert.equal(f.rows.get('petStates/kid').pets[0].clothing, 'uniform');
});

test('pets: each Lv.100 opens one more place (up to 6), a new kind starts at Lv.1, each wears its own outfit', async () => {
  const {adoptPet, switchPet, normalizePets} = await import('../api/_lib/pet.js');
  const s = initialPetState(NOW); chooseFirst(s);
  assert.throws(() => adoptPet(s, 'hodu'), /PET_NO_SLOT/, 'no place before Lv.100');
  currentPet(s).level = 99; addXP(s, xpNeeded(99));
  assert.equal(s.unlockedSlots, 2);
  assert.throws(() => adoptPet(s, 'molang'), /PET_ALREADY_OWNED/);
  s.inventory.push('crown'); equipItem(s, 'crown');
  adoptPet(s, 'hodu');
  assert.deepEqual([s.pets.length, currentPet(s).character, currentPet(s).level, currentPet(s).accessories], [2, 'hodu', 1, {}], 'the new friend is the main pet, from Lv.1, wearing nothing');
  assert.throws(() => adoptPet(s, 'haemi'), /PET_NO_SLOT/, 'one place per Lv.100');
  awardStudy(s, 'vocab-test', 3);
  assert.deepEqual([s.pets[0].xp, s.pets[1].xp > 0], [0, true], 'XP goes to the main pet');
  switchPet(s, s.pets[0].slot); assert.equal(currentPet(s).accessories.head, 'crown', 'pet 1 still wears its crown');
  assert.throws(() => switchPet(s, 99), /PET_BAD_SLOT/);
  const legacy: any = {...initialPetState(NOW), clothing: 'uniform', accessory: 'crown', unlockedSlots: 1};
  legacy.pets = [{...legacy.pets[0], level: PET_MAX_LEVEL}]; delete legacy.pets[0].clothing; delete legacy.pets[0].accessories;
  normalizePets(legacy);
  assert.deepEqual([legacy.pets[0].clothing, legacy.pets[0].accessories, legacy.clothing, legacy.unlockedSlots], ['uniform', {head: 'crown'}, undefined, 2], 'old saves: outfit moves onto pet 1, a Lv.100 pet already earned a place');
  const many = initialPetState(NOW); chooseFirst(many); many.unlockedSlots = 99;
  for (const c of ['unicorn', 'mymelody', 'haemi', 'mang_bear', 'hodu']) adoptPet(many, c);
  assert.equal(many.pets.length, 6); assert.throws(() => adoptPet(many, 'molang'), /PET_NO_SLOT|PET_ALREADY_OWNED/);
  assert.deepEqual([petSummary(many).petCount, petSummary(s).highestLevel], [6, 100], 'teacher summary: highest pet and the count');
});

function chooseFirst(s: any) { s.pets[0].chosen = true; s.pets[0].character = 'molang'; }

test('pet speech without Intl.Segmenter: no half emoji is left (all emoji dropped)', async () => {
  const {cleanPetSpeech} = await import('../src/lib/petCatalog.js');
  const saved = (Intl as any).Segmenter;
  try {
    delete (Intl as any).Segmenter;
    assert.equal(cleanPetSpeech('잘했어 👨‍👩‍👧 🇰🇷 👍🏽', 1), '잘했어');
  } finally { (Intl as any).Segmenter = saved; }
});

test('pet AI: room for Gemini 3 thinking, the failure kind is told apart; talks count a month (free: each pet 150), 50 a day', async () => {
  const {teachRequest, chatRequest, evolveRequest} = await import('../api/_lib/pet.js');
  const {AI_PLANS, PET_TALK_DAILY_GUARD} = await import('../src/lib/aiPlans.js');
  const pet = currentPet(initialPetState(NOW));
  for (const r of [teachRequest(pet, '안녕'), chatRequest(pet, '안녕', []), evolveRequest(pet, '안녕')] as any[]) {
    assert.ok(r.config.maxOutputTokens >= 1024, 'a small cap cut the answer off'); assert.equal(r.config.thinkingConfig.thinkingLevel, 'LOW');
  }
  const f = registrationFirestore();
  const s = initialPetState(NOW); currentPet(s).energy = 100; f.rows.set('petStates/kid', s);
  const slot = currentPet(s).slot, fill = () => { const st = f.rows.get('petStates/kid'); currentPet(st).energy = 100; f.rows.set('petStates/kid', st); };
  const where = await call('POST', {action: 'chat', text: '안녕'}, {verify: async () => ({uid: 'kid'}), db: () => f.db, generate: async () => { throw Error('[400] User location is not supported for the API use.'); }, now: () => NOW});
  assert.equal(where.out.error, 'AI_REGION_UNSUPPORTED');
  const ok: any = {verify: async () => ({uid: 'kid'}), db: () => f.db, generate: async () => '{"response":"응!","remembered":"안녕"}', now: () => NOW};
  fill(); const first = await call('POST', {action: 'teach', text: '말'}, ok);
  assert.deepEqual(first.out.aiTalk, {plan: 'free', limit: AI_PLANS.free.petTalkPerPet, left: AI_PLANS.free.petTalkPerPet! - 1, perPet: true}, 'the talk tab learns what is left');
  assert.deepEqual((await call('GET', null, ok)).out.aiTalk.left, AI_PLANS.free.petTalkPerPet! - 1);
  f.rows.set('aiMonthly/kid_2026-10', {uid: 'kid', month: '2026-10', petTalk: AI_PLANS.free.petTalkPerPet, petTalkBySlot: {[slot]: AI_PLANS.free.petTalkPerPet}});
  fill(); const over = await call('POST', {action: 'chat', text: '안녕'}, ok);
  assert.deepEqual([over.status, over.out.error], [429, 'PET_TALK_LIMIT']);
  assert.match(over.out.message, /펫 패스/, 'the free plan is told about the 펫 패스');
  const {takePetTalkQuota} = await import('../api/_lib/aiModel.js');
  assert.equal((await takePetTalkQuota(f.db, 'kid', slot + 1, 'talk', NOW)).ok, true, 'another pet has its own 150');
  f.rows.set('aiPasses/kid', {plan: 'pet', until: '2026-10-14'});
  fill(); const passed = await call('POST', {action: 'chat', text: '안녕'}, ok);
  assert.deepEqual([passed.out.ok, passed.out.aiTalk.plan, passed.out.aiTalk.perPet, passed.out.aiTalk.left], [true, 'pet', false, AI_PLANS.pet.petTalk! - AI_PLANS.free.petTalkPerPet! - 2], 'a 펫 패스: 600 for all pets, through its last day');
  f.rows.set('aiPasses/kid', {plan: 'pet', until: '2026-10-13'});
  fill(); assert.equal((await call('POST', {action: 'chat', text: '안녕'}, ok)).out.error, 'PET_TALK_LIMIT', 'an ended pass is the free plan again');
  f.rows.set('aiPasses/kid', {plan: 'premium', until: '2026-12-31'});
  f.rows.set('aiUsage/kid:2026-10-14', {uid: 'kid', count: 0, pet: {talk: PET_TALK_DAILY_GUARD}});
  fill(); assert.equal((await call('POST', {action: 'chat', text: '안녕'}, ok)).out.error, 'PET_TALK_DAILY', 'at most 50 a day on any plan');
});

test('pet AI: the reply goes to the pet it was asked of, even if the main pet changes during the call', async () => {
  const f = registrationFirestore(), s = initialPetState(NOW), first = currentPet(s);
  first.energy = 100; s.pets.push({...structuredClone(first), slot: first.slot + 1, name: '둘째', xp: 0, learnedPhrases: []}); s.unlockedSlots = Math.max(s.unlockedSlots, 2);
  f.rows.set('petStates/kid', s);
  const deps: any = {verify: async () => ({uid: 'kid'}), db: () => f.db, now: () => NOW, generate: async () => {
    const st = f.rows.get('petStates/kid'); st.currentPetSlot = first.slot + 1; f.rows.set('petStates/kid', st); // another tab switches pets
    return '{"response":"응!","remembered":"안녕"}'; }};
  assert.equal((await call('POST', {action: 'teach', text: '안녕'}, deps)).out.ok, true);
  const after = f.rows.get('petStates/kid'), one = after.pets.find((p: any) => p.slot === first.slot), two = after.pets.find((p: any) => p.slot === first.slot + 1);
  assert.deepEqual([one.learnedPhrases.length, two.learnedPhrases.length, two.energy], [1, 0, 100], 'the second pet is untouched');
  assert.equal(f.rows.get('aiMonthly/kid_2026-10').petTalkBySlot[first.slot], 1);
});

test('pet AI limits: a failed reply gives the talk back', async () => {
  const f = registrationFirestore();
  const fill = () => { const st = f.rows.get('petStates/kid') || initialPetState(NOW); currentPet(st).energy = 100; f.rows.set('petStates/kid', st); };
  const ok: any = {verify: async () => ({uid: 'kid'}), db: () => f.db, generate: async () => '{"response":"응!","remembered":"안녕"}', now: () => NOW};
  for (let i = 0; i < 3; i++) { fill(); assert.equal((await call('POST', {action: 'teach', text: `말${i}`}, ok)).out.ok, true); }
  const broken: any = {...ok, generate: async () => { throw Error('503 overloaded'); }};
  fill(); assert.equal((await call('POST', {action: 'chat', text: '안녕'}, broken)).out.error, 'AI_BUSY');
  const usage = f.rows.get('aiUsage/kid:2026-10-14'), month = f.rows.get('aiMonthly/kid_2026-10');
  assert.deepEqual([usage.pet.talk, month.petTalk], [3, 3], 'the talk given back');
});

test('AI passes: the admin turns a pass on until a day or off; others are refused; the month list shows the plan', async () => {
  const {readAiPasses, setAiPass, readAiMonthly, takeMonthlyQuota} = await import('../api/_lib/aiModel.js');
  const f = registrationFirestore(), admin = {admin: true, academyId: 'main', uid: 'admin'};
  f.rows.set('users/kid', {name: '김하늘', role: 'student'});
  await assert.rejects(() => setAiPass(f.db, {admin: false, academyId: 'main'}, {uid: 'kid', plan: 'premium', until: '2026-11-13'}), /FORBIDDEN/);
  await assert.rejects(() => setAiPass(f.db, admin, {uid: 'nobody', plan: 'pet', until: '2026-11-13'}), /BAD_REQUEST/);
  await assert.rejects(() => setAiPass(f.db, admin, {uid: 'kid', plan: 'gold', until: '2026-11-13'}), /BAD_REQUEST/);
  await setAiPass(f.db, admin, {uid: 'kid', plan: 'premium', until: '2026-11-13'}, NOW);
  assert.deepEqual([f.rows.get('aiPasses/kid').plan, f.rows.get('aiPasses/kid').until, f.rows.get('users/kid').aiPass], ['premium', '2026-11-13', undefined], 'the user doc is untouched');
  const list = await readAiPasses(f.db, admin, NOW);
  assert.deepEqual(list.rows.map((r: any) => [r.name, r.plan, r.active]), [['김하늘', 'premium', true]]);
  assert.equal(await takeMonthlyQuota(f.db, 'kid', 'analyzer', NOW), 79, '프리미엄: 지문 분석 80 a month');
  assert.deepEqual((await readAiMonthly(f.db, admin, NOW)).rows.map((r: any) => [r.plan, r.analyzer]), [['premium', 1]]);
  await setAiPass(f.db, admin, {uid: 'kid', plan: 'none'}, NOW);
  assert.equal(f.rows.has('aiPasses/kid'), false);
  assert.deepEqual((await readAiPasses(f.db, admin, NOW)).rows, []);
});

test('pet teaching grows with the pet: a baby catches a word or two, a teen copies exactly, an adult rephrases; 혼잣말 sees the original', async () => {
  const {teachGuide, teachRequest, evolveRequest} = await import('../api/_lib/pet.js');
  assert.match(teachGuide(5), /낱말 한두 개/); assert.match(teachGuide(30), /틀리거나 빼먹어/); assert.match(teachGuide(50), /그대로 정확하게/);
  assert.match(teachGuide(80), /다른 표현/); assert.match(teachGuide(150), /응용/);
  const pet = currentPet(initialPetState(NOW)); pet.level = 5;
  assert.match((teachRequest(pet, '지원이는 최고야') as any).config.systemInstruction, /낱말 한두 개/);
  pet.level = 70;
  assert.match(JSON.stringify((evolveRequest(pet, '최고', '지원이는 최고야') as any).contents), /지원이는 최고야/);
});

test('pet summary (home chip and pass badge): points and the pass in force, nothing written', async () => {
  const f = registrationFirestore(), deps: any = {verify: async () => ({uid: 'kid'}), db: () => f.db, now: () => NOW};
  const get = async () => { let out: any; const req: any = {method: 'GET', url: '/api/student?__endpoint=pet&summary=1', headers: {authorization: 'Bearer t'}};
    await handlePet(req, {setHeader() {}, end(v: string) { out = JSON.parse(v); }, statusCode: 0} as any, deps); return out; };
  const first = await get(), {quests, ...rest} = first;
  assert.deepEqual(rest, {ok: true, hasPet: false, points: 0, pass: null, coupon: null, rank: null});
  assert.deepEqual(quests.items.map((i: any) => i.id), ['test', 'study', 'feed'], '오늘 할 일 comes along (no wrong answers: 단어장 공부)');
  assert.equal(f.rows.has('petStates/kid'), false, 'no pet is made by looking');
  const s = initialPetState(NOW); s.points = 1240; f.rows.set('petStates/kid', s);
  f.rows.set('aiPasses/kid', {plan: 'premium', until: '2026-10-14'});
  assert.deepEqual((({quests: _q, ...r}) => r)(await get()), {ok: true, hasPet: true, points: 1240, pass: {plan: 'premium', until: '2026-10-14'}, coupon: null, rank: null}, 'not a 장학 쿠폰 student: no coupon; no chosen pet: no place');
  f.rows.set('aiPasses/kid', {plan: 'pet', until: '2026-10-13'});
  assert.equal((await get()).pass, null, 'an ended pass shows no badge');
});

test('AI usage page: admin only, newest day first, empty days left out', async () => {
  const {readAiUsage} = await import('../api/_lib/aiModel.js');
  const f = registrationFirestore();
  f.rows.set('aiUsageStats/2026-10-13', {pet: {calls: 3, input: 900, output: 120, thoughts: 300}, analyzer: {calls: 1, input: 4000, output: 3000, thoughts: 500}, generator: {calls: 2, input: 8000, output: 9000, thoughts: 4000}});
  f.rows.set('aiUsageStats/2026-10-12', {generator: {calls: 1, input: 100, output: 100, thoughts: 0}});
  await assert.rejects(() => readAiUsage(f.db, {admin: false, principal: true, academyId: 'main'}), /FORBIDDEN/);
  const {days} = await readAiUsage(f.db, {admin: true, academyId: 'main'}, 5, NOW);
  assert.deepEqual(days.map((d: any) => [d.day, d.pet.calls, d.analyzer.calls, d.workbook.calls, d.generator.calls]), [['2026-10-13', 3, 1, 0, 2], ['2026-10-12', 0, 0, 0, 1]], 'a day with only 변형문제 생성기 is kept');
});

test('펫 패스: 영어 회화 모드 only with a pass (answers in English); 상황 혼잣말 fits the day and counts 10 a day free, 30 with a pass', async () => {
  const {museRequest, chatRequest} = await import('../api/_lib/pet.js');
  const {AI_PLANS} = await import('../src/lib/aiPlans.js');
  const f = registrationFirestore(), s = initialPetState(NOW); f.rows.set('petStates/kid', s);
  let asked: any = null;
  const deps: any = {verify: async () => ({uid: 'kid'}), db: () => f.db, generate: async (r: any) => { asked = r; return '{"response":"Oh, you mean: I went to school!","monologue":"오늘도 힘내자!"}'; }, now: () => NOW};
  const locked = await call('POST', {action: 'english-talk', on: true}, deps);
  assert.deepEqual([locked.status, locked.out.error], [403, 'PET_PASS_ONLY']);
  f.rows.set('aiPasses/kid', {plan: 'pet', until: '2026-10-31'});
  assert.equal((await call('POST', {action: 'english-talk', on: true}, deps)).out.state.englishTalk, true);
  const st = f.rows.get('petStates/kid'); currentPet(st).energy = 100; f.rows.set('petStates/kid', st);
  await call('POST', {action: 'chat', text: 'I go to school yesterday'}, deps);
  assert.match(asked.config.systemInstruction, /ONLY in short, easy English/);
  // the pass ended: the mode stays saved but the pet talks Korean again
  f.rows.set('aiPasses/kid', {plan: 'pet', until: '2026-10-01'});
  const st2 = f.rows.get('petStates/kid'); currentPet(st2).energy = 100; f.rows.set('petStates/kid', st2);
  await call('POST', {action: 'chat', text: '안녕'}, deps);
  assert.doesNotMatch(asked.config.systemInstruction, /ONLY in short, easy English/);
  // 상황 혼잣말: the day's study goes in; 10 a day on the free plan
  const pet = currentPet(s), fresh = {...s, today: {...s.today, studyPoints: 0}};
  assert.match((museRequest(fresh as any, pet, 20) as any).contents[0].parts[0].text, /아직 공부를 안 했어/);
  assert.match((museRequest({...s, today: {...s.today, studyPoints: 300}} as any, pet, 9) as any).contents[0].parts[0].text, /다 채웠어/);
  assert.match((chatRequest(pet, 'hi', [], true) as any).config.systemInstruction, /English/);
  let said = 0;
  for (let i = 0; i < AI_PLANS.free.petMonologue + 2; i++) if ((await call('POST', {action: 'muse'}, deps)).out.ok) said++;
  assert.equal(said, AI_PLANS.free.petMonologue);
  f.rows.set('aiPasses/kid', {plan: 'premium', until: '2026-10-31'});
  for (let i = 0; i < 5; i++) assert.equal((await call('POST', {action: 'muse'}, deps)).out.ok, true, 'a pass: 30 a day');
});
