import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {addContribution, checkNickname, createParty, initialGuild, joinParty, leaveParty, publicParty, settleParty, voteKick, warnNickname, weekOf, setNickname, type PetLook} from '../api/_lib/petParty.js';
import {initialPetState} from '../api/_lib/pet.js';
import {handlePet} from '../api/_lib/student/pet.js';
import {buildRun} from '../api/_lib/petWordFeed.js';
import {warnGuildNickname} from '../api/_lib/teacherPetParty.js';

const MON = Date.parse('2026-10-12T03:00:00Z'); // Monday noon in Seoul
const DAY = 86_400_000;
const look: PetLook = {character: 'hodu', name: '호두', level: 3, clothing: null, accessory: null};
const input = {nameA: '반짝', nameB: '별빛', boss: 'forest', size: 4, phrases: ['매일 조금씩 해요']};
const guild = (nick: string) => { const g = initialGuild(MON); setNickname(g, nick); return g; };

test('party: weeks start on Monday in Seoul; nicknames are free text without contact details; a warned nickname cannot come back', () => {
  assert.equal(weekOf(MON), '2026-10-12'); assert.equal(weekOf(MON + 6 * DAY), '2026-10-12'); assert.equal(weekOf(MON + 7 * DAY), '2026-10-19');
  assert.equal(checkNickname('  별 사탕 ', []), '별 사탕');
  for (const bad of ['a', '열한글자가넘는별칭이에요', '01000001234', 'me@mail', 'insta_kim']) assert.throws(() => checkNickname(bad, []), /PARTY_NICK_/, bad);
  const g = guild('바보멍청이'); warnNickname(g);
  assert.equal(g.warned, true);
  assert.throws(() => setNickname(g, '바보 멍청이'), /PARTY_NICK_BANNED/, 'the same nickname (spaces ignored) is refused');
  setNickname(g, '별사탕'); assert.equal(g.warned, false);
});

test('party: create and join (one team a week, a nickname first, no joining a full team); students only see nicknames and pets', () => {
  const a = guild('별사탕'), p = createParty(a, 'ua', look, input, MON, 'p1');
  assert.deepEqual([p.name, p.hpMax, a.parties['2026-10-12']], ['반짝 별빛 원정대', 400, 'p1']);
  assert.throws(() => createParty(a, 'ua', look, input, MON, 'p2'), /PARTY_ONE_A_WEEK/);
  assert.throws(() => createParty(guild('곰돌'), 'ub', look, {...input, nameA: '나쁜'}, MON, 'p3'), /PARTY_BAD_INPUT/, 'only the fixed name words');
  assert.throws(() => joinParty(p, initialGuild(MON), 'ux', look, MON), /PARTY_NEED_NICK/);
  for (const [uid, nick] of [['ub', '곰돌'], ['uc', '찹쌀'], ['ud', '토끼']]) joinParty(p, guild(nick), uid, look, MON);
  assert.throws(() => joinParty(p, guild('여우'), 'ue', look, MON), /PARTY_FULL/);
  const view = publicParty(p, 'ub', MON);
  assert.ok(!JSON.stringify(view).includes('"uid"') && !JSON.stringify(view).includes('ua'), 'no account ids for students');
  assert.deepEqual(view.members.map(m => m.nickname), ['별사탕', '곰돌', '찹쌀', '토끼']);
});

test('party: first-time words of the week take 1 off the boss; kick vote needs half of the others (2-person teams only after 3 idle days); leaving gives up the reward', () => {
  const p = createParty(guild('별사탕'), 'ua', look, {...input, size: 3}, MON, 'p1');
  joinParty(p, guild('곰돌'), 'ub', look, MON); joinParty(p, guild('찹쌀'), 'uc', look, MON);
  assert.equal(addContribution(p, 'ua', 'b:apple', look, MON), true);
  assert.equal(addContribution(p, 'ua', 'b:apple', look, MON + DAY), false, 'the same word again this week counts once');
  assert.equal(p.hp, 1);
  assert.deepEqual(voteKick(p, 'ua', 'uc', MON), {kicked: true}, '1 of 2 others is 50%');
  assert.throws(() => voteKick(p, 'ub', 'ua', MON), /PARTY_VOTE_TOO_SOON/, 'now 2 people: only after 3 idle days');
  assert.deepEqual(voteKick(p, 'ua', 'ub', MON + 3 * DAY), {kicked: true}, 'ub never played: 3 days after joining');
  const q = createParty(guild('여우'), 'ux', look, {...input, size: 2}, MON, 'p2'); joinParty(q, guild('바람'), 'uy', look, MON);
  leaveParty(q, 'uy'); assert.equal(q.members[1].status, 'left');
  assert.throws(() => joinParty(q, Object.assign(guild('바람'), {parties: {'2026-10-12': 'p2'}}), 'uy', look, MON), /PARTY_ONE_A_WEEK/, 'still one team a week after leaving');
});

test('party: settled once after the week, pool by progress (from 30%), split by contribution among members with 10+, at most 500P each', () => {
  const p = createParty(guild('별사탕'), 'ua', look, {...input, size: 4}, MON, 'p1');
  for (const [uid, nick] of [['ub', '곰돌'], ['uc', '찹쌀'], ['ud', '토끼']]) joinParty(p, guild(nick), uid, look, MON);
  const play = (uid: string, n: number) => { for (let i = 0; i < n; i++) addContribution(p, uid, `${uid}:${i}`, look, MON + DAY); };
  play('ua', 150); play('ub', 90); play('uc', 8); // 248 of 400 = 62%
  assert.equal(settleParty(p, MON + 3 * DAY), null, 'not before the week ends');
  const r = settleParty(p, MON + 7 * DAY)!;
  const pool = Math.floor(600 * 248 / 400); // 372
  assert.deepEqual(r, {ua: Math.floor(pool * 150 / 240), ub: Math.floor(pool * 90 / 240), uc: 0, ud: 0}, 'under 10 words: no share');
  assert.equal(settleParty(p, MON + 8 * DAY), null, 'only once');
  const low = createParty(guild('여우'), 'ux', look, {...input, size: 2}, MON, 'p2'); for (let i = 0; i < 50; i++) addContribution(low, 'ux', `w${i}`, look, MON);
  assert.deepEqual(settleParty(low, MON + 7 * DAY), {ux: 0}, '25% is under 30%: nothing');
  const full = createParty(guild('바람'), 'uz', look, {...input, size: 4}, MON, 'p3'); for (let i = 0; i < 400; i++) addContribution(full, 'uz', `w${i}`, look, MON);
  assert.deepEqual(settleParty(full, MON + 7 * DAY), {uz: 500}, 'success pool 600, capped at 500 for one student');
});

const book = (id: string, n: number) => ({id, words: Array.from({length: n}, (_, i) => ({wordbookId: id, wordId: `${id}${i}`, word: `word${i}`, meaning: `뜻${i}, 의미${i}`}))});
const call = async (uid: string, body: any, deps: any) => {
  let status = 0, out: any;
  const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, set statusCode(v: number) { status = v; }, get statusCode() { return status; }};
  await handlePet({method: 'POST', headers: {authorization: `Bearer ${uid}`}, body} as any, res, {...deps, verify: async (t: string) => ({uid: t})}); return {status, out};
};

test('party API: nickname, create, join; a right answer in a game adds to the team; next week the team is paid once into each pet', async () => {
  const f = registrationFirestore();
  for (const uid of ['ua', 'ub']) { const s = initialPetState(MON); s.pets[0].chosen = true; f.rows.set(`petStates/${uid}`, s); }
  let now = MON;
  const deps: any = {db: () => f.db, generate: async () => '{}', now: () => now, feedSource: async () => ({books: [book('a', 60)], wrongs: []})};
  assert.equal((await call('ua', {action: 'party-create', ...input, size: 2}, deps)).out.error, 'PARTY_NEED_NICK');
  assert.equal((await call('ua', {action: 'guild-nickname', nickname: '010-0000-1234'}, deps)).out.error, 'PARTY_NICK_CONTACT');
  await call('ua', {action: 'guild-nickname', nickname: '별사탕'}, deps); await call('ub', {action: 'guild-nickname', nickname: '곰돌'}, deps);
  const made = await call('ua', {action: 'party-create', ...input, size: 2}, deps);
  assert.equal(made.out.party.name, '반짝 별빛 원정대');
  const board = await call('ub', {action: 'guild-board'}, deps);
  assert.equal(board.out.notes.length, 1); assert.ok(!JSON.stringify(board.out).includes('ua'));
  const joined = await call('ub', {action: 'party-join', partyId: board.out.notes[0].id}, deps);
  assert.deepEqual(joined.out.party.members.map((m: any) => m.nickname).sort(), ['곰돌', '별사탕']);
  // ua plays: 12 right answers this week
  await call('ua', {action: 'feed-start'}, deps);
  for (let i = 0; i < 10; i++) { const run = f.rows.get('petGames/ua').run; await call('ua', {action: 'feed-answer', runId: run.id, index: i, choice: run.questions[i].answer}, deps); }
  const party = f.rows.get(`petParties/${made.out.party.id}`);
  assert.deepEqual([party.hp, party.members[0].count], [10, 10]);
  // an admin warning shows "별칭 바꾸는 중" until a new nickname is picked
  await warnGuildNickname(f.db, {admin: true, academyId: 'main'}, {uid: 'ub'}, now);
  const warned = await call('ub', {action: 'guild-state'}, deps);
  assert.deepEqual([warned.out.guild.warned, warned.out.party.members.find((m: any) => m.me).nickname], [true, '별칭 바꾸는 중']);
  assert.equal((await call('ub', {action: 'guild-nickname', nickname: '곰돌'}, deps)).out.error, 'PARTY_NICK_BANNED');
  // next Monday: paid once (10 of 200 = 5% → under 30%, so 0P; checks the settle path and the result note)
  now = MON + 7 * DAY;
  const next = await call('ua', {action: 'guild-state'}, deps);
  assert.deepEqual([next.out.party, next.out.guild.lastResult.progress, next.out.guild.lastResult.reward], [null, 5, 0]);
  assert.equal(f.rows.get(`petParties/${made.out.party.id}`).settled, true);
  assert.equal(f.rows.get('petGuild/ub').lastResult.party, '반짝 별빛 원정대', 'every member gets the result note');
});

test('party for teachers: the whole team of their own student, our academy by name and others by nickname only; others are refused', async () => {
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const {readStudentParty, listGuildNicknames} = await import('../api/_lib/teacherPetParty.js');
  const f = registrationFirestore(), k1 = '11111111-1111-4111-8111-111111111111', k2 = '22222222-2222-4222-8222-222222222222';
  const map = (key: string, uid: string, name: string) => f.rows.set(`notionStudentMappings/${hashStudentKey(key)}`, {sourceMode: 'firestore', studentKey: key, firebaseUid: uid, studentDisplayName: name});
  map(k1, 'ua', '김하늘'); map(k2, 'ub', '이바다');
  f.rows.set('users/ua', {notionStudentKey: k1}); f.rows.set('users/ub', {notionStudentKey: k2});
  f.rows.set(`academyStudentMemberships/${k1}`, {academyId: 'main'}); f.rows.set(`academyStudentMemberships/${k2}`, {academyId: 'other'});
  const p = createParty(guild('별사탕'), 'ua', look, input, MON, 'p1'); const gb = guild('곰돌'); joinParty(p, gb, 'ub', look, MON);
  f.rows.set('petParties/p1', p); f.rows.set('petGuild/ua', {...initialGuild(MON), nickname: '별사탕', parties: {'2026-10-12': 'p1'}});
  const actor = {academyId: 'main', scopes: [{studentKey: k1}], teachingScopes: []};
  const view: any = await readStudentParty(f.db, actor, k1, MON);
  assert.deepEqual(view.party.members.map((m: any) => [m.name, m.nickname, m.ourAcademy]), [['김하늘', '별사탕', true], [null, '곰돌', false]]);
  await assert.rejects(() => readStudentParty(f.db, {academyId: 'main', scopes: [], teachingScopes: []}, k1, MON), /FORBIDDEN/);
  await assert.rejects(() => listGuildNicknames(f.db, {admin: false, academyId: 'main'}), /FORBIDDEN/, 'nicknames list is for the admin only');
});

test('party: address-like nicknames are refused, ordinary words with 구/길/동 are not', async () => {
  const {looksLikeAddress} = await import('../api/_lib/petParty.js');
  for (const bad of ['강남구 역삼동', '서울시 강남구', '역삼1동', '테헤란로12길', '래미안아파트', '해피빌라', '101호']) {
    assert.equal(looksLikeAddress(bad), true, bad); assert.throws(() => checkNickname(bad, []), /PARTY_NICK_CONTACT/, bad);
  }
  for (const ok of ['구름', '꽃길', '별동', '호두대장', '동글이', '시원한 바람', '구름빵']) assert.equal(checkNickname(ok, []), ok, ok);
});

test('펫 보기 for teachers: the student pet as the student sees it, read only; others refused, no account → no pet', async () => {
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const {readStudentPet} = await import('../api/_lib/teacherPetParty.js');
  const f = registrationFirestore(), k1 = '11111111-1111-4111-8111-111111111111', k2 = '22222222-2222-4222-8222-222222222222';
  f.rows.set(`notionStudentMappings/${hashStudentKey(k1)}`, {sourceMode: 'firestore', studentKey: k1, firebaseUid: 'ua', studentDisplayName: '김하늘'});
  const state = initialPetState(MON, {character: 'hodu', petName: '호두'}); state.points = 1234; state.rewarded = {l1: ['attendance'], a1: ['assignment'], l2: ['attendance']};
  f.rows.set('petStates/ua', state); f.rows.set('petGuild/ua', {...initialGuild(MON), nickname: '별사탕'});
  const before = JSON.stringify([...f.rows.entries()]);
  const actor = {academyId: 'main', scopes: [{studentKey: k1}], teachingScopes: []};
  const {pet}: any = await readStudentPet(f.db, actor, k1, MON);
  assert.deepEqual([pet.points, pet.pets[0].name, pet.nickname, pet.rewards], [1234, '호두', '별사탕', {attendance: 2, assignment: 1}]);
  assert.equal(pet.expeditions[1].current, 'forest-1');
  assert.ok(!JSON.stringify(pet).includes('"uid"') && !JSON.stringify(pet).includes('ua"'), 'no account id');
  assert.equal(JSON.stringify([...f.rows.entries()]), before, 'nothing written');
  await assert.rejects(() => readStudentPet(f.db, {academyId: 'main', scopes: [{studentKey: k2}], teachingScopes: []}, k1, MON), /FORBIDDEN/, 'not their student');
  assert.deepEqual(await readStudentPet(f.db, {academyId: 'main', admin: true}, k2, MON), {pet: null}, 'no app account: no pet');
});
