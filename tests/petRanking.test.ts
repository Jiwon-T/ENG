import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {initialPetState} from '../api/_lib/pet.js';
import {initialGuild, setAlias, setGuildName} from '../api/_lib/petParty.js';
import {handlePet} from '../api/_lib/student/pet.js';

const NOW = Date.parse('2026-10-16T03:00:00Z');
const call = async (uid: string, body: any, f: any, now = NOW) => { let out: any; const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, statusCode: 0};
  await handlePet({method: 'POST', headers: {authorization: 'Bearer t'}, body} as any, res, {verify: async () => ({uid}), db: () => f.db, generate: async () => '{}', now: () => now} as any); return out; };
/** A student with pets [level, tower best, stars][] and names. */
function student(f: any, uid: string, pets: [number, number, number][], guild?: string, aliases: string[] = [], role?: string) {
  const s = initialPetState(NOW); s.pets = pets.map(([level], i) => ({...s.pets[0], slot: i + 1, name: `${uid}펫${i + 1}`, chosen: true, level}));
  s.background = 'forest_cabin'; s.medals = ['2026-10']; s.decor = {forest_cabin: [{id: '2026-10', x: 30, y: 40}]};
  f.rows.set(`petStates/${uid}`, s);
  f.rows.set(`petTowers/${uid}`, {version: 1, pets: Object.fromEntries(pets.map(([, best], i) => [String(i + 1), {floor: best + 1, best}])), updatedAt: NOW});
  f.rows.set(`petExpeditions/${uid}`, {version: 1, pets: Object.fromEntries(pets.map(([, , stars], i) => [String(i + 1), {stars: {a: stars}, bonuses: {}}])), chapterRewards: [], updatedAt: NOW});
  const g = initialGuild(NOW); if (guild) setGuildName(g, guild); aliases.forEach((a, i) => setAlias(g, i + 1, a)); f.rows.set(`petGuild/${uid}`, g);
  f.rows.set(`users/${uid}`, role ? {role} : {});
}

test('순위: 모험가 by tower floor → stars → level; 원정대 by summed floors; teachers left out unless a teacher asks; no uids', async () => {
  const f = registrationFirestore();
  student(f, 'a', [[30, 12, 20], [10, 3, 5]], '반짝별', ['용감한 검객']);
  student(f, 'b', [[40, 12, 20]], '구름빵', ['새벽 마법사']);   // same floor and stars as a's first pet: the level decides
  student(f, 'c', [[20, 12, 20]]);                                // no names yet
  student(f, 't', [[200, 50, 99]], '선생님단', ['교무실'], 'teacher');
  const r = (await call('c', {action: 'rank-board', kind: 'pet', teachers: true}, f)).ranking;
  assert.deepEqual([r.teacherView, r.withTeachers], [false, false], 'a student never gets teachers');
  assert.deepEqual(r.rows.map((x: any) => [x.rank, x.label, x.sub, x.value, x.me]), [[1, '새벽 마법사', '구름빵 · Lv.40', 12, false], [2, '용감한 검객', '반짝별 · Lv.30', 12, false], [3, 'c펫1', '이름 없는 원정대 · Lv.20', 12, true], [4, 'a펫2', '반짝별 · Lv.10', 3, false]]);
  assert.ok(!JSON.stringify(r).includes('"uid"'), 'no uids');
  const g = (await call('c', {action: 'rank-board', kind: 'guild'}, f)).ranking;
  assert.deepEqual(g.rows.map((x: any) => [x.rank, x.label, x.value, x.looks.length]), [[1, '반짝별', 15, 2], [2, '구름빵', 12, 1], [3, '이름 없는 원정대', 12, 1]]);
  const tv = (await call('t', {action: 'rank-board', kind: 'pet', teachers: true}, f)).ranking;
  assert.deepEqual([tv.teacherView, tv.withTeachers, tv.rows[0].label, tv.rows[0].teacher], [true, true, '교무실', true]);
  // a pet's room: outfit, background and medals; a stale id (rebuilt snapshot) asks to reopen
  const prof = (await call('c', {action: 'rank-profile', at: r.at, id: r.rows[1].id}, f)).profile;
  assert.deepEqual([prof.label, prof.guild, prof.background, prof.decor, prof.medals, prof.me], ['용감한 검객', '반짝별', 'forest_cabin', [{id: '2026-10', x: 30, y: 40}], 1, false]);
  assert.equal((await call('c', {action: 'rank-profile', at: r.at - 1, id: r.rows[1].id}, f)).error, 'RANK_STALE');
  const teacherRow = tv.rows[0];
  assert.equal((await call('c', {action: 'rank-profile', at: tv.at, id: teacherRow.id}, f)).error, 'RANK_STALE', 'a teacher pet is not opened by a student');
  // the home chip: my best 모험가 place (a teacher: in the ranking with the teachers; no pet yet: null = –위)
  const summary = async (uid: string, db = f.db) => { let out: any; const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, statusCode: 0};
    await handlePet({method: 'GET', url: '/api/student/pet?summary=1', headers: {authorization: 'Bearer t'}} as any, res, {verify: async () => ({uid}), db: () => db, generate: async () => '{}', now: () => NOW} as any); return out; };
  const [sa, sc, st, sn] = [await summary('a'), await summary('c'), await summary('t'), await summary('nobody')];
  assert.deepEqual([sa.rank, sc.rank, st.rank, st.rankTeacher, sa.rankTeacher, sn.rank], [2, 3, 1, true, undefined, null]);
  const noRanking: any = {...f.db, collection: (name: string) => { if (name === 'petRankings') throw Error('RANKING_READ'); return f.db.collection(name); }};
  assert.equal((await summary('nobody2', noRanking)).rank, null, 'no pet: –위 without reading the ranking');
  // only a pet on the rows this viewer was shown opens: a's second pet is not a 원정대 row
  assert.equal((await call('c', {action: 'rank-profile', at: g.at, id: r.rows[3].id, kind: 'guild'}, f)).error, 'RANK_STALE');
  assert.equal((await call('c', {action: 'rank-profile', at: g.at, id: g.rows[0].id, kind: 'guild'}, f)).profile.label, '용감한 검객');
  // the snapshot is reused for 10 minutes; after that the sheet shows it at once (stale) and asks for the rebuild
  student(f, 'd', [[5, 40, 0]], '새친구', ['번개']);
  assert.notEqual((await call('c', {action: 'rank-board', kind: 'pet'}, f, NOW + 60_000)).ranking.rows[0].label, '번개');
  assert.equal((await call('c', {action: 'rank-board', kind: 'pet'}, f, NOW + 11 * 60_000)).ranking.stale, true);
  await call('c', {action: 'rank-refresh'}, f, NOW + 11 * 60_000);
  assert.equal((await call('c', {action: 'rank-board', kind: 'pet'}, f, NOW + 11 * 60_000)).ranking.rows[0].label, '번개');
  // the home chip doesn't wait for a rebuild: an hour-old snapshot is used as it is (the sheet rebuilds after 10 minutes)
  const before = f.rows.get('petRankings/current').builtAt;
  const late = async (uid: string, now: number) => { let out: any; const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, statusCode: 0};
    await handlePet({method: 'GET', url: '/api/student/pet?summary=1', headers: {authorization: 'Bearer t'}} as any, res, {verify: async () => ({uid}), db: () => f.db, generate: async () => '{}', now: () => now} as any); return out; };
  await late('c', NOW + 71 * 60_000);
  assert.equal(f.rows.get('petRankings/current').builtAt, before, 'not rebuilt by the home screen');
  await late('c', NOW + 11 * 60_000 + 7 * 3_600_000);
  assert.equal(f.rows.get('petRankings/current').builtAt, NOW + 11 * 60_000 + 7 * 3_600_000, 'over 6 hours old: rebuilt');
});

test('순위: while one request rebuilds, others get the last snapshot (no second full read)', async () => {
  const f = registrationFirestore();
  student(f, 'a', [[30, 12, 20]], '반짝별', ['용감한 검객']);
  f.rows.set('petRankings/current', {builtAt: NOW - 20 * 60_000, buildingUntil: NOW + 30_000, pets: []});
  assert.equal((await call('a', {action: 'rank-board', kind: 'pet'}, f)).ranking.total, 0, 'the old (empty) snapshot while another rebuilds');
  await call('a', {action: 'rank-refresh'}, f, NOW + 60_000);
  assert.equal((await call('a', {action: 'rank-board', kind: 'pet'}, f, NOW + 60_000)).ranking.total, 1, 'the lock ran out: rebuilt');
  // a cold start (no snapshot yet) while another request builds: 'being made', not a second full read
  f.rows.set('petRankings/current', {buildingUntil: NOW + 30_000});
  assert.equal((await call('a', {action: 'rank-board', kind: 'pet'}, f)).error, 'RANK_BUILDING');
  const res: any = {setHeader() {}, end(v: string) { res.out = JSON.parse(v); }, statusCode: 0};
  await handlePet({method: 'GET', url: '/api/student/pet?summary=1', headers: {authorization: 'Bearer t'}} as any, res, {verify: async () => ({uid: 'a'}), db: () => f.db, generate: async () => '{}', now: () => NOW} as any);
  assert.equal('rank' in res.out, false, 'the home chip waits for the next visit');
  assert.deepEqual(f.rows.get('petRankings/current'), {buildingUntil: NOW + 30_000}, 'nothing rebuilt');
});

test('순위 꾸미기: the 3차 전직 aura on the pet and the pass badge (only a pass in force) on rows and the room', async () => {
  const f = registrationFirestore();
  student(f, 'a', [[160, 50, 20]], '반짝별', ['천공']); student(f, 'b', [[40, 12, 20]], '구름빵', ['새벽']); student(f, 'c', [[30, 5, 5]]);
  const s = f.rows.get('petStates/a'); s.pets[0].job = 'swordsman'; s.pets[0].job2 = 'paladin'; s.pets[0].job3 = 'sky_knight'; f.rows.set('petStates/a', s);
  f.rows.set('aiPasses/a', {plan: 'premium', until: '2026-12-31'}); f.rows.set('aiPasses/b', {plan: 'pet', until: '2026-10-01'}); // b's pass has ended
  const r = (await call('c', {action: 'rank-board', kind: 'pet'}, f)).ranking;
  assert.deepEqual(r.rows.map((x: any) => [x.label, x.pass, x.looks[0].aura]), [['천공', 'premium', 'light'], ['새벽', null, null], ['c펫1', null, null]]);
  const prof = (await call('c', {action: 'rank-profile', at: r.at, id: r.rows[0].id}, f)).profile;
  assert.deepEqual([prof.aura, prof.pass], ['light', 'premium']);
});

test('순위표 속도: an older snapshot (over 10 minutes) is shown at once with stale; rank-refresh rebuilds it', async () => {
  const f = registrationFirestore();
  student(f, 'a', [[30, 12, 20]], '반짝별', ['검객']); student(f, 'c', [[20, 5, 5]]);
  const first = (await call('c', {action: 'rank-board', kind: 'pet'}, f)).ranking;
  assert.equal(first.stale, false);
  student(f, 'b', [[40, 30, 20]], '구름빵', ['새벽']); // a new student after the snapshot
  const later = NOW + 11 * 60_000;
  const shown = (await call('c', {action: 'rank-board', kind: 'pet'}, f, later)).ranking;
  assert.deepEqual([shown.stale, shown.at, shown.rows.length], [true, first.at, 2], 'the old one, without waiting for a rebuild');
  const refreshed = await call('c', {action: 'rank-refresh'}, f, later);
  assert.equal(refreshed.at, later);
  const again = (await call('c', {action: 'rank-board', kind: 'pet'}, f, later)).ranking;
  assert.deepEqual([again.stale, again.rows.length, again.rows[0].label], [false, 3, '새벽']);
});
