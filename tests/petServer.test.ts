import { STAGE_IDS } from '../api/_lib/petExpedition.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {
  addXP, awardStudy, buyItem, claimStudyRewards, currentPet, equipItem, importLocalPet, initialPetState, pendingStudyRewards, petSummary, publicPetState, rollDay,
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

test('pet: level 100 is the top; the XP bar never runs past full', () => {
  const s = initialPetState(NOW), pet = currentPet(s);
  pet.level = PET_MAX_LEVEL - 1; pet.xp = 0;
  assert.equal(addXP(s, xpNeeded(PET_MAX_LEVEL - 1) + 5000).leveledUp, true);
  assert.deepEqual([pet.level, pet.xp, s.unlockedSlots], [PET_MAX_LEVEL, 0, 2]);
  assert.equal(addXP(s, 999).leveledUp, false); assert.equal(pet.xp, 0);
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
  equipItem(s, 'crown'); assert.equal(currentPet(s).accessory, 'crown');
  equipItem(s, 'crown'); assert.equal(currentPet(s).accessory, null, 'tapping again takes it off');
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
  assert.deepEqual([currentPet(s).accessory, currentPet(s).clothing, s.background], ['crown', null, 'default']);
  const pet = currentPet(s);
  assert.deepEqual([pet.character, pet.name, pet.chosen, pet.level, pet.xp], ['unicorn', '다롱이', true, PET_MAX_LEVEL, 0]);
  assert.deepEqual(pet.learnedPhrases[0].evolvedVersions, {'10': 'hello'});
});

test('pet: 공부 보상 — attended lessons and completed assignments of the last 30 days, each once', () => {
  const s = initialPetState(NOW);
  const reports = [
    {id: 'a', date: '2026-10-13', attendance: '출석', assignmentCompleted: true},
    {id: 'b', date: '2026-10-10', attendance: '지각', assignmentCompleted: false},
    {id: 'c', date: '2026-10-09', attendance: '결석', assignmentCompleted: false},
    {id: 'd', date: '2026-08-01', attendance: '출석', assignmentCompleted: true}, // too old
    {id: 'e', date: '2026-12-01', attendance: '출석', assignmentCompleted: false}, // future
  ];
  const pending = pendingStudyRewards(s, reports, NOW);
  assert.deepEqual(pending, [{id: 'a', kind: 'attendance'}, {id: 'a', kind: 'assignment'}, {id: 'b', kind: 'attendance'}]);
  const got = claimStudyRewards(s, pending);
  assert.deepEqual([got.points, got.xp, got.count], [80, 130, 3]);
  assert.equal(s.today.studyPoints, 0, 'outside the daily study cap');
  assert.deepEqual(pendingStudyRewards(s, reports, NOW), [], 'never twice');
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
  currentPet(s).level = PET_MAX_LEVEL - 1; addXP(s, xpNeeded(PET_MAX_LEVEL - 1));
  assert.equal(s.unlockedSlots, 2);
  assert.throws(() => adoptPet(s, 'molang'), /PET_ALREADY_OWNED/);
  s.inventory.push('crown'); equipItem(s, 'crown');
  adoptPet(s, 'hodu');
  assert.deepEqual([s.pets.length, currentPet(s).character, currentPet(s).level, currentPet(s).accessory], [2, 'hodu', 1, null], 'the new friend is the main pet, from Lv.1, wearing nothing');
  assert.throws(() => adoptPet(s, 'haemi'), /PET_NO_SLOT/, 'one place per Lv.100');
  awardStudy(s, 'vocab-test', 3);
  assert.deepEqual([s.pets[0].xp, s.pets[1].xp > 0], [0, true], 'XP goes to the main pet');
  switchPet(s, s.pets[0].slot); assert.equal(currentPet(s).accessory, 'crown', 'pet 1 still wears its crown');
  assert.throws(() => switchPet(s, 99), /PET_BAD_SLOT/);
  const legacy: any = {...initialPetState(NOW), clothing: 'uniform', accessory: 'crown', unlockedSlots: 1};
  legacy.pets = [{...legacy.pets[0], level: PET_MAX_LEVEL}]; delete legacy.pets[0].clothing; delete legacy.pets[0].accessory;
  normalizePets(legacy);
  assert.deepEqual([legacy.pets[0].clothing, legacy.pets[0].accessory, legacy.clothing, legacy.unlockedSlots], ['uniform', 'crown', undefined, 2], 'old saves: outfit moves onto pet 1, a Lv.100 pet already earned a place');
  const many = initialPetState(NOW); chooseFirst(many); many.unlockedSlots = 99;
  for (const c of ['unicorn', 'mymelody', 'haemi', 'mang_bear', 'hodu']) adoptPet(many, c);
  assert.equal(many.pets.length, 6); assert.throws(() => adoptPet(many, 'molang'), /PET_NO_SLOT|PET_ALREADY_OWNED/);
  assert.deepEqual([petSummary(many).petCount, petSummary(s).highestLevel], [6, PET_MAX_LEVEL], 'teacher summary: highest pet and the count');
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
