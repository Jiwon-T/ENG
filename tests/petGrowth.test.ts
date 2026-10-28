import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {initialPetState} from '../api/_lib/pet.js';
import {growthBoard, settleMonthlyGrowth, seenGrowthNotice} from '../api/_lib/petGrowth.js';

const OCT = Date.parse('2026-10-20T03:00:00Z'), NOV1 = Date.parse('2026-10-31T18:30:00Z'); // 11/1 03:30 KST
/** An account with pets [tower best, stars][]. */
function pets(f: any, uid: string, list: [number, number][], role = 'student') {
  const s: any = initialPetState(OCT); s.pets = list.map((_, i) => ({...s.pets[0], slot: i + 1, chosen: true}));
  f.rows.set(`petStates/${uid}`, s);
  f.rows.set(`petTowers/${uid}`, {version: 1, pets: Object.fromEntries(list.map(([best], i) => [String(i + 1), {floor: best + 1, best}])), updatedAt: OCT});
  f.rows.set(`petExpeditions/${uid}`, {version: 1, pets: Object.fromEntries(list.map(([, stars], i) => [String(i + 1), {stars: {a: stars}, bonuses: {}}])), chapterRewards: [], updatedAt: OCT});
  f.rows.set(`users/${uid}`, {role});
}

test('이달의 성장 board: equal gains share a place; 1st–3rd, up to 10th, then anyone who grew enough (which every reward needs)', () => {
  const now: any = {}, start: any = {};
  [30, 18, 18, 12, 11, 10, 9, 8, 7, 6, 5, 3, 2].forEach((f, i) => { now['u' + i] = {floor: f, star: 0}; });
  now.old = {floor: 40, star: 0}; start.old = {floor: 40, star: 0}; // no growth: not placed
  const b = growthBoard(now, start, 'floor');
  assert.deepEqual(b.slice(0, 4).map(r => [r.gain, r.rank, r.points]), [[30, 1, 1000], [18, 2, 700], [18, 2, 700], [12, 4, 200]]);
  assert.deepEqual(b.slice(9).map(r => [r.gain, r.rank, r.points]), [[6, 10, 200], [5, 11, 100], [3, 12, 100], [2, 13, 0]], 'below 3 floors: no participation reward');
  const few = growthBoard({x: {floor: 9, star: 0}, y: {floor: 1, star: 0}}, {}, 'floor');
  assert.deepEqual(few.map(r => [r.rank, r.points]), [[1, 1000], [2, 0]], 'a place without the participation growth gets nothing');
  assert.ok(!b.some(r => r.uid === 'old'));
});

test('이달의 성장 settle: October from 0, paid once on 11/1 for October\'s coupon, November starts where October ended; teachers left out', async () => {
  const f = registrationFirestore();
  pets(f, 'a', [[20, 4], [10, 2]]);    // floors 30, stars 6
  pets(f, 'b', [[18, 12]]);            // floors 18, stars 12
  pets(f, 'c', [[2, 1]]);              // a little: no reward
  pets(f, 'free', [[5, 30]]); f.rows.set('users/free', {role: 'student', name: '앱유저'}); // an app user not linked: paid too
  pets(f, 't', [[50, 99]], 'teacher');
  assert.equal((await settleMonthlyGrowth(f.db, OCT)).skipped, 'before-start', 'in October, September is before the start');
  const r = await settleMonthlyGrowth(f.db, NOV1);
  assert.deepEqual([r.month, r.paid], ['2026-10', 3]);
  const a = f.rows.get('petStates/a');
  assert.deepEqual(a.growthPaid['2026-10'], {floor: {gain: 30, rank: 1, points: 1000}, star: {gain: 6, rank: 3, points: 500}});
  assert.equal(a.earnedBy['2026-10'], 1500, 'counted for October\'s 장학 쿠폰');
  assert.deepEqual(a.growthNotices.map((n: any) => n.month), ['2026-10']);
  assert.deepEqual(f.rows.get('petStates/free').growthPaid['2026-10'].star, {gain: 30, rank: 1, points: 1000}, 'an app user not linked is paid too');
  assert.equal(f.rows.get('petStates/c').growthPaid, undefined, 'too little growth: nothing');
  assert.equal(f.rows.get('petStates/t').growthPaid, undefined, 'teachers left out');
  assert.deepEqual(f.rows.get('petGrowth/2026-11').start.a, {floor: 30, star: 6}, 'November starts where October ended');
  const before = f.rows.get('petStates/a').points;
  assert.equal((await settleMonthlyGrowth(f.db, NOV1 + 3600_000)).skipped, 'done');
  assert.equal(f.rows.get('petStates/a').points, before, 'paid once');
  await seenGrowthNotice(f.db, 'a');
  assert.deepEqual(f.rows.get('petStates/a').growthNotices, []);
});

test('순위 › 이달의 성장: this month so far (October from 0), the points each place would get, and how far my next reward is', async () => {
  const {readGrowthBoard} = await import('../api/_lib/petGrowth.js');
  const f = registrationFirestore();
  pets(f, 'a', [[20, 4]]); pets(f, 'b', [[12, 9]]); pets(f, 'me', [[2, 1]]); pets(f, 't', [[50, 50]], 'teacher');
  const g: any = await readGrowthBoard(f.db, 'me', 'floor', OCT);
  assert.deepEqual([g.kind, g.board, g.month, g.pending], ['growth', 'floor', '2026-10', false]);
  assert.deepEqual(g.rows.map((r: any) => [r.rank, r.gain, r.points, r.me]), [[1, 20, 1000, false], [2, 12, 700, false], [3, 2, 0, true]], 'teachers left out; +2 floors is not yet a reward');
  assert.deepEqual(g.mine, {rank: 3, gain: 2, points: 0, next: {more: 1, points: 100, what: 'join'}}, '1 floor more for 100P');
  const s: any = await readGrowthBoard(f.db, 'me', 'star', OCT);
  assert.deepEqual(s.rows.map((r: any) => r.gain), [9, 4, 1]);
  const t: any = await readGrowthBoard(f.db, 't', 'floor', OCT);
  assert.equal(t.mine, null, 'a teacher has no place');
  assert.equal((await readGrowthBoard(f.db, 'me', 'floor', Date.parse('2026-11-05T03:00:00Z'))).pending, true, 'November before its start is kept: waiting');
});

test('이달의 성장: a payment that runs late counts October only — the first pet request of November kept October’s end', async () => {
  const {keepMonthEnd} = await import('../api/_lib/petGrowth.js');
  const f = registrationFirestore();
  pets(f, 'a', [[10, 6]]); pets(f, 'b', [[5, 5]]);
  await keepMonthEnd(f.db, NOV1); // the first request of November, before it changes anything
  assert.deepEqual(f.rows.get('petGrowth/2026-10').end.a, {floor: 10, star: 6});
  // November goes on before the job pays (it failed on the 1st): b climbs far
  f.rows.set('petTowers/b', {version: 1, pets: {'1': {floor: 41, best: 40}}, updatedAt: NOV1});
  const r = await settleMonthlyGrowth(f.db, NOV1 + 86_400_000);
  assert.deepEqual([r.month, f.rows.get('petStates/b').growthPaid['2026-10'].floor.gain], ['2026-10', 5], 'October’s 5 floors, not November’s');
  assert.deepEqual(f.rows.get('petGrowth/2026-11').start.b, {floor: 5, star: 5}, 'November starts at October’s end');
});

test('이달의 성장: a pop-up not seen yet is kept with the next month’s', async () => {
  const f = registrationFirestore();
  pets(f, 'a', [[10, 6]]);
  const s: any = f.rows.get('petStates/a'); s.growthNotices = [{month: '2026-09', floor: {gain: 3, rank: 1, points: 1000}}]; s.growthPaid = {'2026-09': {}};
  await settleMonthlyGrowth(f.db, NOV1);
  assert.deepEqual(f.rows.get('petStates/a').growthNotices.map((n: any) => n.month), ['2026-09', '2026-10']);
});

test('이달의 성장: an end kept between the payment’s read and its write is the end (never written over)', async () => {
  const f = registrationFirestore();
  pets(f, 'a', [[30, 9]]); // November already climbed: live totals are 30 floors
  const original = f.db.runTransaction.bind(f.db); let once = false;
  f.db.runTransaction = (fn: any) => { if (!once) { once = true; f.rows.set('petGrowth/2026-10', {month: '2026-10', end: {a: {floor: 8, star: 4}}, endAt: NOV1}); } return original(fn); };
  await settleMonthlyGrowth(f.db, NOV1 + 86_400_000);
  const doc = f.rows.get('petGrowth/2026-10');
  assert.deepEqual(doc.end.a, {floor: 8, star: 4}, 'the kept end stays');
  assert.equal(doc.results.a.floor.gain, 8, 'results from the kept end');
  assert.deepEqual(f.rows.get('petGrowth/2026-11').start.a, {floor: 8, star: 4});
});

test('쿠폰 › 월말 예상: this month’s growth as each student’s place and points now (nothing saved); none before the start is kept', async () => {
  const {growthForecast} = await import('../api/_lib/petGrowth.js');
  const f = registrationFirestore();
  pets(f, 'a', [[20, 4]]); pets(f, 'b', [[2, 9]]); pets(f, 't', [[50, 50]], 'teacher');
  const g: any = await growthForecast(f.db, OCT);
  assert.deepEqual(g.byUid.get('a'), {floor: {gain: 20, rank: 1, points: 1000}, star: {gain: 4, rank: 2, points: 0}});
  assert.deepEqual(g.byUid.get('b').floor, {gain: 2, rank: 2, points: 0}, 'below +3 floors: a place, no points yet');
  assert.equal(g.byUid.has('t'), false, 'teachers left out');
  assert.equal(g.at, OCT, 'the ranking’s time');
  assert.equal(f.rows.get('petGrowth/2026-10'), undefined, 'nothing saved');
  assert.equal(await growthForecast(f.db, Date.parse('2026-11-05T03:00:00Z')), null, 'November before its start is kept');
});

test('쿠폰 › 월말 예상: a ranking over 10 minutes old is made again first (not the 6-hour one the rooms may use)', async () => {
  const {growthForecast} = await import('../api/_lib/petGrowth.js');
  const f = registrationFirestore();
  pets(f, 'a', [[20, 4]]);
  f.rows.set('petRankings/current', {builtAt: OCT - 3 * 3_600_000, pets: []}); // 3 hours old: nobody had grown
  const g: any = await growthForecast(f.db, OCT);
  assert.equal(g.at, OCT, 'made again now');
  assert.equal(g.byUid.get('a').floor.gain, 20);
  f.rows.set('petRankings/current', {builtAt: OCT - 5 * 60_000, pets: []}); // 5 minutes old: used as it is, with its time
  assert.equal((await growthForecast(f.db, OCT) as any).at, OCT - 5 * 60_000);
});
