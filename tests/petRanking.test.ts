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

test('방 구경: a friend\'s first look today counts (never your own); one 응원 스티커 a day per room, +5 pet XP, no points; a closed room shows the pet only', async () => {
  const f = registrationFirestore();
  student(f, 'a', [[30, 12, 20]], '반짝별', ['용감한 검객']);
  student(f, 'b', [[40, 10, 20]], '구름빵');
  student(f, 'c', [[20, 8, 20]]);
  const r = (await call('b', {action: 'rank-board', kind: 'pet'}, f)).ranking, aRow = r.rows.find((x: any) => x.label === '용감한 검객');
  const open = async (uid: string, now = NOW, at = r.at) => (await call(uid, {action: 'rank-profile', at, id: aRow.id}, f, now)).profile;
  assert.deepEqual((await open('b')).room, {today: 1, total: 1, stickers: {}, sticker: null, gift: null});
  assert.deepEqual((await open('b')).room.today, 1, 'the same friend again today: once');
  assert.deepEqual((await open('a')).room.today, 1, 'my own room: not a visit');
  const before = f.rows.get('petStates/b'), xp = before.pets[0].xp, points = before.points;
  const stuck = await call('b', {action: 'room-sticker', at: r.at, id: aRow.id, sticker: 'best'}, f);
  assert.deepEqual([stuck.result.room.stickers, stuck.result.room.sticker, stuck.result.xp], [{best: 1}, 'best', 5]);
  assert.equal(f.rows.get('petStates/b').pets[0].xp, xp + 5); assert.equal(f.rows.get('petStates/b').points, points, 'no points');
  assert.equal((await call('b', {action: 'room-sticker', at: r.at, id: aRow.id, sticker: 'cheer'}, f)).error, 'ROOM_STICKER_USED');
  assert.equal((await call('b', {action: 'room-sticker', at: r.at, id: aRow.id, sticker: '바보'}, f)).error, 'ROOM_BAD_STICKER', 'fixed phrases only');
  assert.equal((await call('a', {action: 'room-sticker', at: r.at, id: aRow.id, sticker: 'best'}, f)).error, 'ROOM_OWN');
  const c = await call('c', {action: 'room-sticker', at: r.at, id: aRow.id, sticker: 'cute'}, f);
  assert.deepEqual([c.result.room.today, c.result.room.total, c.result.room.stickers], [2, 2, {best: 1, cute: 1}], 'a sticker without opening first is a visit too');
  const DAY2 = NOW + 86_400_000, r2 = (await call('b', {action: 'rank-board', kind: 'pet'}, f, DAY2)).ranking; // the ranking is rebuilt by then
  assert.equal((await open('b', DAY2, r2.at)).room.today, 1, 'a new day');
  // closing: friends see the pet only, nothing counted, no stickers
  assert.equal((await call('a', {action: 'room-hide', hidden: true}, f)).result.roomHidden, true);
  const closed = await open('c', DAY2, r2.at);
  assert.deepEqual([closed.hidden, closed.room, closed.background, closed.decor], [true, null, 'default', []]);
  assert.equal((await call('c', {action: 'room-sticker', at: r2.at, id: aRow.id, sticker: 'best'}, f, DAY2)).error, 'ROOM_HIDDEN');
  const mine = await open('a', DAY2, r2.at);
  assert.deepEqual([mine.hidden, mine.roomHidden, mine.background], [false, true, 'forest_cabin'], 'the owner still sees the room, closed');
});

test('친구 방: 방 코드 (a new one frees the old), 친구 찾기 by 별칭 · 원정대 이름 · 초성 · code (no closed room, no teacher), 방명록 with 답방, a sticker by the opened line', async () => {
  const f = registrationFirestore();
  student(f, 'a', [[30, 12, 20]], '반짝별', ['용감한 검객']);
  student(f, 'b', [[40, 10, 20]], '구름빵', ['새벽 마법사']);
  student(f, 'c', [[20, 8, 20]], '반짝이');
  student(f, 't', [[200, 50, 99]], '반짝 선생님', ['교무실'], 'teacher');
  const home = (await call('a', {action: 'room-home'}, f)).result;
  assert.match(home.code, /^[A-HJ-NP-Z2-9]{4}$/);
  assert.equal((await call('a', {action: 'room-home'}, f)).result.code, home.code, 'kept');
  // 친구 찾기: names (초성 too), never a teacher's pet for a student
  const names = (q: string) => call('b', {action: 'room-search', q}, f).then(r => r.result.rows.map((x: any) => x.label));
  assert.deepEqual(await names('반짝'), ['용감한 검객', 'c펫1']);
  assert.deepEqual(await names('ㅇㄱㅎ'), ['용감한 검객']);
  assert.deepEqual(await names(home.code.toLowerCase()), ['용감한 검객'], 'a 방 코드 (any case)');
  // open by code: a visit, then a sticker by the line it gave
  const room = (await call('b', {action: 'room-open', code: home.code}, f)).profile;
  assert.deepEqual([room.label, room.room.today, room.me], ['용감한 검객', 1, false]);
  const stuck = await call('b', {action: 'room-sticker', via: 'room', ...room.ref, sticker: 'together'}, f);
  assert.deepEqual(stuck.result.room.stickers, {together: 1});
  assert.equal((await call('c', {action: 'room-open', at: room.ref.at, id: room.ref.id}, f)).profile.room.today, 2, 'a 방명록 · 찾기 line opens it too');
  // 방명록: who came today, with the sticker and a line to visit back
  const book = (await call('a', {action: 'room-home'}, f)).result;
  assert.deepEqual(book.today, {visits: 2, stickers: 1, gifts: 0});
  assert.deepEqual(book.guestbook.map((g: any) => [g.label, g.sticker]).sort(), [['c펫1', null], ['새벽 마법사', 'together']]);
  assert.ok(book.guestbook.every((g: any) => typeof g.at === 'number' && typeof g.id === 'number'), 'each line visits back');
  // a new code: the old one stops working
  const renewed = (await call('a', {action: 'room-code-new'}, f)).result.code;
  assert.notEqual(renewed, home.code);
  assert.equal((await call('b', {action: 'room-open', code: home.code}, f)).error, 'ROOM_NOT_FOUND');
  assert.equal((await call('b', {action: 'room-open', code: renewed}, f)).profile.label, '용감한 검객');
  // a closed room is not found by name; a teacher's pet is not opened by a student
  await call('a', {action: 'room-hide', hidden: true}, f);
  assert.deepEqual(await names('반짝'), ['c펫1']);
  const tRef = (await call('t', {action: 'room-home'}, f)).result.code;
  assert.deepEqual((await call('b', {action: 'room-search', q: tRef}, f)).result.rows, [], "a teacher's 방 코드 finds nothing for a student");
  assert.equal((await call('b', {action: 'room-open', code: tRef}, f)).error, 'ROOM_NOT_FOUND');
});

test('방 구경: a room closed between reading the pet and counting the visit is neither counted nor shown', async () => {
  const f = registrationFirestore();
  student(f, 'a', [[30, 12, 20]], '반짝별', ['용감한 검객']);
  student(f, 'b', [[40, 10, 20]], '구름빵');
  const r = (await call('b', {action: 'rank-board', kind: 'pet'}, f)).ranking, aRow = r.rows.find((x: any) => x.label === '용감한 검객');
  // the owner closes it the moment after the pet was read: the visit's transaction sees it closed
  const db = f.db, closing: any = {...db, runTransaction: (fn: any) => { const s = f.rows.get('petStates/a'); f.rows.set('petStates/a', {...s, roomHidden: true}); return db.runTransaction(fn); }};
  let out: any; const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, statusCode: 0};
  await handlePet({method: 'POST', headers: {authorization: 'Bearer t'}, body: {action: 'rank-profile', at: r.at, id: aRow.id}} as any, res, {verify: async () => ({uid: 'b'}), db: () => closing, generate: async () => '{}', now: () => NOW} as any);
  assert.deepEqual([out.profile.hidden, out.profile.room, out.profile.background, out.profile.decor], [true, null, 'default', []]);
  assert.equal(f.rows.get('petRooms/a'), undefined, 'no visit counted');
});

test('이웃: one-way, from the room a 순위 row or a line opened; listed newest first with who came today and where I cheered; 이번 주 인기 방 by this week\'s 응원', async () => {
  const f = registrationFirestore();
  student(f, 'a', [[30, 12, 20]], '반짝별', ['용감한 검객']);
  student(f, 'b', [[40, 10, 20]], '구름빵', ['새벽 마법사']);
  student(f, 'c', [[20, 8, 20]], '반짝이');
  student(f, 't', [[200, 50, 99]], '선생님단', ['교무실'], 'teacher');
  const r = (await call('c', {action: 'rank-board', kind: 'pet'}, f)).ranking, row = (label: string) => r.rows.find((x: any) => x.label === label);
  // c keeps a (from the 순위) and b (from a 찾기 line); not their own
  assert.equal((await call('c', {action: 'room-neighbor', at: r.at, id: row('용감한 검객').id, keep: true}, f)).result.neighbor, true);
  const bLine = (await call('c', {action: 'room-search', q: '새벽'}, f)).result.rows[0];
  await call('c', {action: 'room-neighbor', via: 'room', at: bLine.at, id: bLine.id, keep: true}, f);
  assert.equal((await call('c', {action: 'room-neighbor', at: r.at, id: row('c펫1').id, keep: true}, f)).error, 'ROOM_OWN');
  assert.equal((await call('c', {action: 'rank-profile', at: r.at, id: row('용감한 검객').id}, f)).profile.neighbor, true, 'the room says so');
  // a visits c; c cheers in a: the lists show it
  const cRow = (await call('a', {action: 'rank-board', kind: 'pet'}, f)).ranking.rows.find((x: any) => x.label === 'c펫1');
  await call('a', {action: 'rank-profile', at: r.at, id: cRow.id}, f);
  await call('c', {action: 'room-sticker', at: r.at, id: row('용감한 검객').id, sticker: 'best'}, f);
  await call('b', {action: 'room-sticker', at: r.at, id: row('용감한 검객').id, sticker: 'cute'}, f);
  await call('a', {action: 'room-sticker', at: r.at, id: row('새벽 마법사').id, sticker: 'cheer'}, f);
  const home = (await call('c', {action: 'room-home'}, f)).result;
  assert.deepEqual(home.neighbors.map((n: any) => [n.label, n.cameToday, n.stuckToday]), [['새벽 마법사', false, false], ['용감한 검객', true, true]]);
  assert.ok(!JSON.stringify(home).includes('"uid"'), 'no uids');
  assert.deepEqual(home.popular.map((p: any) => [p.label, p.stickers]), [['용감한 검객', 2], ['새벽 마법사', 1]]);
  // a closed room drops out of 인기 방; the 이웃 stays; taking it out
  await call('a', {action: 'room-hide', hidden: true}, f);
  assert.deepEqual((await call('c', {action: 'room-home'}, f)).result.popular.map((p: any) => p.label), ['새벽 마법사']);
  assert.equal((await call('c', {action: 'room-neighbor', at: r.at, id: row('용감한 검객').id, keep: false}, f)).result.neighbor, false);
  assert.deepEqual((await call('c', {action: 'room-home'}, f)).result.neighbors.map((n: any) => n.label), ['새벽 마법사']);
  // next week the 인기 방 start again
  assert.deepEqual((await call('c', {action: 'room-home'}, f, NOW + 7 * 86_400_000)).result.popular, []);
});

test('친구 방 fixes: 인기 방 skips closed rooms however many until 3 open ones; a 방 코드 of someone newer than the last snapshot still opens (and is found)', async () => {
  const f = registrationFirestore();
  for (let i = 0; i < 10; i++) student(f, `s${i}`, [[20 + i, i, 1]], `팀${i}`, [`펫${i}`]);
  student(f, 'v', [[10, 1, 1]]);
  const week = '2026-10-12'; // NOW (10/16) is in the week starting Monday 10/12
  for (let i = 0; i < 10; i++) f.rows.set(`petRooms/s${i}`, {week, weekStickers: 20 - i});
  for (let i = 0; i < 9; i++) f.rows.set(`petStates/s${i}`, {...f.rows.get(`petStates/s${i}`), roomHidden: true}); // the 9 most cheered are closed
  assert.deepEqual((await call('v', {action: 'room-home'}, f)).result.popular.map((p: any) => [p.label, p.stickers]), [['펫9', 11]]);
  // n joins after the snapshot: their code opens and is found, and a sticker by that code works
  student(f, 'n', [[5, 0, 0]], '새내기', ['새싹']);
  const code = (await call('n', {action: 'room-home'}, f)).result.code;
  const found = (await call('v', {action: 'room-search', q: code}, f)).result.rows;
  assert.deepEqual(found.map((x: any) => [x.label, x.code]), [['새싹', code]]);
  const room = (await call('v', {action: 'room-open', code}, f)).profile;
  assert.deepEqual([room.label, room.ref, room.room.today], ['새싹', {code}, 1]);
  assert.deepEqual((await call('v', {action: 'room-sticker', via: 'room', ...room.ref, sticker: 'cheer'}, f)).result.room.stickers, {cheer: 1});
});

test('간식 선물: food bought with my points (or from my 가방) goes into the friend\'s 가방; one a day per room, 3 a day; +10 pet XP to the giver; no energy snacks', async () => {
  const f = registrationFirestore();
  for (const uid of ['a', 'b', 'c', 'd', 'e']) student(f, uid, [[20, 5, 1]], `팀${uid}`, [`펫${uid}`]);
  const set = (uid: string, x: any) => f.rows.set(`petStates/${uid}`, {...f.rows.get(`petStates/${uid}`), ...x});
  set('a', {points: 200, snacks: {cookie: 1}});
  const r = (await call('a', {action: 'rank-board', kind: 'pet'}, f)).ranking, id = (label: string) => r.rows.find((x: any) => x.label === label).id;
  const give = (to: string, item: string, fromBag = false) => call('a', {action: 'room-gift', at: r.at, id: id(`펫${to}`), item, fromBag}, f);
  const prof = (await call('a', {action: 'rank-profile', at: r.at, id: id('펫b')}, f)).profile;
  assert.deepEqual(prof.wallet, {points: 200, snacks: {cookie: 1}, giftsLeft: 3});
  const xp = f.rows.get('petStates/a').pets[0].xp;
  const g = (await give('b', 'macaron')).result;
  assert.deepEqual([g.gift, g.points, g.giftsLeft, g.xp], ['macaron', 150, 2, 10]);
  assert.equal(f.rows.get('petStates/a').pets[0].xp, xp + 10);
  assert.deepEqual(f.rows.get('petStates/b').snacks, {macaron: 1}, 'into the friend\'s 가방');
  assert.equal((await give('b', 'cookie')).error, 'ROOM_GIFT_USED');
  assert.equal((await give('c', 'monster')).error, 'ROOM_BAD_GIFT', 'no 몬스터');
  assert.deepEqual((await give('c', 'cookie', true)).result.snacks, {}, 'from my 가방, no points');
  assert.equal(f.rows.get('petStates/a').points, 150);
  set('d', {snacks: {candy: 99}});
  assert.equal((await give('d', 'candy')).error, 'ROOM_GIFT_BAG_FULL');
  assert.deepEqual([f.rows.get('petStates/a').points, f.rows.get('petStates/a').today.gifts], [150, 2], 'nothing spent on a full 가방');
  assert.equal((await give('d', 'cake')).result.giftsLeft, 0);
  assert.equal((await give('e', 'cookie')).error, 'ROOM_GIFTS_DONE');
  // the friend sees it: 방명록 line and today's count
  const home = (await call('b', {action: 'room-home'}, f)).result;
  assert.deepEqual([home.today.gifts, home.guestbook[0].gift], [1, 'macaron']);
  // a sticker afterwards keeps the gift on the visit
  await call('a', {action: 'room-sticker', at: r.at, id: id('펫b'), sticker: 'best'}, f);
  assert.deepEqual(((await call('b', {action: 'room-home'}, f)).result.guestbook[0]), {...home.guestbook[0], sticker: 'best', at: home.guestbook[0].at});
});

test("친구 선물 기운 간식: into the friend's 친구 선물 칸; one a day beyond the 2-a-day limit, waking a 탈진 pet too; the 오늘 할 일 box coffee can be given", async () => {
  const f = registrationFirestore();
  for (const uid of ['a', 'b']) student(f, uid, [[20, 5, 1]], `팀${uid}`, [`펫${uid}`]);
  f.rows.set('petStates/a', {...f.rows.get('petStates/a'), points: 0, snacks: {coffee: 1}});
  const r = (await call('a', {action: 'rank-board', kind: 'pet'}, f)).ranking, bRow = r.rows.find((x: any) => x.label === '펫b');
  const g = await call('a', {action: 'room-gift', at: r.at, id: bRow.id, item: 'coffee', fromBag: true}, f);
  assert.deepEqual(g.result.snacks, {}, 'the box coffee, given from my 가방');
  assert.deepEqual([f.rows.get('petStates/b').friendSnacks, f.rows.get('petStates/b').snacks], [{coffee: 1}, undefined]);
  // b has used both energy snacks today and is 탈진: the friend's coffee still wakes the pet, once
  const b = f.rows.get('petStates/b'); b.today = {...b.today, energyItems: 2}; b.pets[0].energy = 0; b.friendSnacks = {coffee: 2}; f.rows.set('petStates/b', b);
  const ate = await call('b', {action: 'friend-snack-use', itemId: 'coffee'}, f);
  assert.deepEqual([ate.result.message, ate.state.pets[0].energy, ate.state.today.friendEnergyLeft, ate.state.friendSnacks], ['친구가 준 간식으로 번쩍 깨어났어요!', 30, 0, {coffee: 1}]);
  assert.equal((await call('b', {action: 'friend-snack-use', itemId: 'coffee'}, f)).error, 'PET_FRIEND_SNACK_USED', 'one a day');
  assert.equal((await call('b', {action: 'friend-snack-use', itemId: 'cookie'}, f)).error, 'PET_ITEM_NOT_FOUND');
});
