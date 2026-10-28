// 이달의 성장 (monthly growth reward): each student's 탑 floors (the best floor of every pet added up) and 원정대 stars
// (added up) are kept as the month's start (petGrowth/{YYYY-MM}.start); what they gain by the month's end is ranked —
// 탑 and 원정대 apart — and paid on the 1st (Korea time) by the daily job: 1st–3rd, up to 10th, then anyone who grew
// enough (PET_GROWTH). The points count for that month's 장학 쿠폰 (the grace days let it still be claimed). Everyone with
// a pet takes part — students of the academy and app users not linked alike — teachers' pets aside. October 2026 starts
// at 0 (the tower and the 원정대 began that month). Paying is once per student and month (petStates.growthPaid).
// The month's end is kept by the first pet request of the next month, before that request does anything
// (keepMonthEnd): floors and stars only grow through those requests, so a late payment never counts the new month.
import {PET_GROWTH} from '../../src/lib/petCatalog.js';
import {PET_STATES, earnPoints, petSummary, prevMonth, rollDay, seoulDay, type GrowthLine, type GrowthPaid, type ServerPetState} from './pet.js';
import {buildRankings, rankingSnapshot, roomSnapshot, type RankPet, type RankSnapshot} from './petRanking.js';
import {climber} from './petTower.js';

export const PET_GROWTH_DOCS = 'petGrowth';
type Totals = Record<string, {floor: number; star: number}>;

/** Every student's 탑 floors and 원정대 stars now (teachers' pets left out). */
export function totalsOf(snap: RankSnapshot): Totals {
  const out: Totals = {};
  for (const p of snap.pets) { if (p.teacher) continue; const t = out[p.uid] ||= {floor: 0, star: 0}; t.floor += p.best; t.star += p.stars; }
  return out;
}

/** One board: each student's gain since `start`, the places (equal gains share one; no gain, no place) and the points
 *  (any reward needs at least the participation growth: +3 floors / +5 stars). */
export function growthBoard(now: Totals, start: Totals, kind: 'floor' | 'star') {
  const rows = Object.entries(now).map(([uid, t]) => ({uid, gain: Math.max(0, t[kind] - (start[uid]?.[kind] || 0))})).filter(r => r.gain > 0).sort((a, b) => b.gain - a.gain);
  let rank = 0;
  return rows.map((r, i): {uid: string} & GrowthLine => {
    if (!i || r.gain !== rows[i - 1].gain) rank = i + 1;
    // every reward needs the participation growth first (a place alone, in a small month, is not enough)
    const points = r.gain < PET_GROWTH.join[kind] ? 0 : rank <= PET_GROWTH.top.length ? PET_GROWTH.top[rank - 1] : rank <= PET_GROWTH.next.upTo ? PET_GROWTH.next.points : PET_GROWTH.join.points;
    return {uid: r.uid, gain: r.gain, rank, points};
  });
}

const lastDay = (month: string) => { const [y, m] = month.split('-').map(Number); return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`; };
/** A month's start: kept when the month before was paid; the first month starts at 0. */
async function startOf(db: any, month: string): Promise<Totals | null> {
  if (month <= PET_GROWTH.from) return {};
  const doc = (await db.collection(PET_GROWTH_DOCS).doc(month).get()).data();
  return doc?.start || null;
}

/** Last month's end, kept once (petGrowth/{month}.end) by the first pet request of this month, before it is handled.
 *  Each server remembers the month it has seen kept, so later requests do not read again. */
const endKept = new WeakMap<object, string>();
export async function keepMonthEnd(db: any, now = Date.now()) {
  const month = prevMonth(seoulDay(now).slice(0, 7));
  if (month < PET_GROWTH.from || endKept.get(db) === month) return;
  const ref = db.collection(PET_GROWTH_DOCS).doc(month), doc = (await ref.get()).data();
  if (!doc?.end && !doc?.results) {
    const end = totalsOf(await buildRankings(db, now));
    await db.runTransaction(async (tx: any) => { const cur = (await tx.get(ref)).data(); if (!cur?.end && !cur?.results) tx.set(ref, {...(cur || {}), month, end, endAt: now}); });
  }
  endKept.set(db, month);
}

/** The daily job: pay last month's 이달의 성장 once (kept results, so a run cut short is finished by the next), from the
 *  month's kept end (none kept: no pet request since, so nothing has changed and now is the end). */
export async function settleMonthlyGrowth(db: any, now = Date.now()) {
  const month = prevMonth(seoulDay(now).slice(0, 7));
  if (month < PET_GROWTH.from) return {month, paid: 0, skipped: 'before-start'};
  const ref = db.collection(PET_GROWTH_DOCS).doc(month);
  let doc = (await ref.get()).data();
  if (doc?.done) return {month, paid: 0, skipped: 'done'};
  if (!doc?.results) {
    const start = await startOf(db, month);
    if (!start) return {month, paid: 0, skipped: 'no-start'}; // the month began before this was kept: nothing fair to compare
    const resultsOf = (end: Totals) => {
      const results: Record<string, GrowthPaid> = {};
      for (const r of growthBoard(end, start, 'floor')) (results[r.uid] ||= {}).floor = {gain: r.gain, rank: r.rank, points: r.points};
      for (const r of growthBoard(end, start, 'star')) (results[r.uid] ||= {}).star = {gain: r.gain, rank: r.rank, points: r.points};
      return results;
    };
    const totals: Totals = doc?.end || totalsOf(await buildRankings(db, now));
    await db.runTransaction(async (tx: any) => {
      const [cur, next] = [(await tx.get(ref)).data(), (await tx.get(db.collection(PET_GROWTH_DOCS).doc(seoulDay(now).slice(0, 7)))).data()];
      if (cur?.results) { doc = cur; return; }
      // an end kept meanwhile (the month's first pet request, after the read above) is the end: never written over
      const end: Totals = cur?.end || totals;
      doc = {...(cur || {}), month, start, end, results: resultsOf(end), settledAt: now};
      tx.set(ref, doc);
      // this month starts where last month ended
      if (!next?.start) tx.set(db.collection(PET_GROWTH_DOCS).doc(seoulDay(now).slice(0, 7)), {...(next || {}), month: seoulDay(now).slice(0, 7), start: end});
    });
  }
  let paid = 0;
  for (const [uid, r] of Object.entries(doc.results as Record<string, GrowthPaid>)) {
    const total = (r.floor?.points || 0) + (r.star?.points || 0);
    if (total > 0 && await payGrowth(db, uid, month, r, total, now)) paid++;
  }
  await ref.set({...doc, done: true, paidAt: now});
  return {month, paid};
}

async function payGrowth(db: any, uid: string, month: string, r: GrowthPaid, total: number, now: number) {
  const ref = db.collection(PET_STATES).doc(uid), userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx: any) => {
    const [snap, user] = [await tx.get(ref), (await tx.get(userRef)).data()];
    if (!snap.exists) return false;
    const s: ServerPetState = rollDay(snap.data(), now);
    if (s.growthPaid?.[month]) return false;
    // counted for that month's 장학 쿠폰 (its last day in the 포인트 내역)
    earnPoints(s, total, 'adventure', `${Number(month.slice(5))}월 이달의 성장`, lastDay(month));
    // the pop-up: kept with any earlier month not seen yet (a student away for months sees each)
    s.points += total; s.growthPaid = {...(s.growthPaid || {}), [month]: r}; s.growthNotices = [...(s.growthNotices || []).filter(n => n.month !== month), {month, ...r}]; s.updatedAt = now;
    tx.set(ref, s);
    if (user) tx.set(userRef, {...user, petStats: petSummary(s)});
    return true;
  });
}

/** The 이달의 성장 pop-up seen: cleared. */
export async function seenGrowthNotice(db: any, uid: string) {
  const ref = db.collection(PET_STATES).doc(uid);
  await db.runTransaction(async (tx: any) => { const s = (await tx.get(ref)).data(); if (s?.growthNotices?.length) tx.set(ref, {...s, growthNotices: []}); });
  return {ok: true};
}

/** 쿠폰 › 월말 예상 (admin and teachers): this month's growth so far — each student's place and the points it would get
 *  if the month ended now (null while the month's start is not kept yet), and `at`, when the ranking it comes from was
 *  made: a snapshot over 10 minutes old is made again first (while another request is making it, the last one is used, so
 *  the screen shows the time). Nothing is saved or paid. */
export async function growthForecast(db: any, now = Date.now()) {
  const [start, snap] = await Promise.all([startOf(db, seoulDay(now).slice(0, 7)), rankingSnapshot(db, now)]);
  if (!start) return null;
  const byUid = new Map<string, GrowthPaid>(), totals = totalsOf(snap);
  for (const kind of ['floor', 'star'] as const) for (const r of growthBoard(totals, start, kind)) byUid.set(r.uid, {...byUid.get(r.uid), [kind]: {gain: r.gain, rank: r.rank, points: r.points}});
  return {at: snap.builtAt, byUid};
}

/** 순위 › 이달의 성장 (as `viewer` sees it): this month's growth so far — the top 10 and their own place — with the points
 *  each place would get, and how far the viewer is from the next reward. Names as the 순위 shows them (별칭 · 펫 이름). */
export async function readGrowthBoard(db: any, viewer: string, kindInput: unknown, now = Date.now()) {
  const board = kindInput === 'star' ? 'star' as const : 'floor' as const, month = seoulDay(now).slice(0, 7);
  const [start, snap, me] = await Promise.all([startOf(db, month), roomSnapshot(db, now), climber(db, viewer)]);
  if (!start) return {kind: 'growth' as const, board, month, pending: true, total: 0, rows: [], mine: null};
  const rows = growthBoard(totalsOf(snap), start, board);
  // each student's best pet stands for them (floor → level), as on the 원정대 ranking
  const pet = new Map<string, RankPet>();
  for (const p of snap.pets) { const cur = pet.get(p.uid); if (!p.teacher && (!cur || p.best > cur.best || p.best === cur.best && p.level > cur.level)) pet.set(p.uid, p); }
  const view = (r: {uid: string} & GrowthLine) => { const p = pet.get(r.uid)!; return {rank: r.rank, gain: r.gain, points: r.points, label: p.alias || p.name, sub: p.guild || '', me: r.uid === viewer,
    look: {character: p.character, level: p.level, clothing: p.clothing, accessories: p.accessories, aura: p.aura ?? null, gear: p.gear ?? null}}; };
  const top = rows.slice(0, PET_GROWTH.next.upTo).map(view), mineRow = rows.find(r => r.uid === viewer);
  // the next reward: the participation growth, then 10th place, then 3rd
  const need = (target: number | undefined) => target === undefined ? null : Math.max(1, target - (mineRow?.gain || 0) + 1);
  const gain = mineRow?.gain || 0, join = PET_GROWTH.join[board];
  const next = me.teacher ? null : gain < join ? {more: join - gain, points: PET_GROWTH.join.points, what: 'join'}
    : !mineRow || mineRow.rank! > PET_GROWTH.next.upTo ? (rows[PET_GROWTH.next.upTo - 1] ? {more: need(rows[PET_GROWTH.next.upTo - 1].gain), points: PET_GROWTH.next.points, what: 'top10'} : null)
    : mineRow.rank! > PET_GROWTH.top.length ? (rows[PET_GROWTH.top.length - 1] ? {more: need(rows[PET_GROWTH.top.length - 1].gain), points: PET_GROWTH.top[PET_GROWTH.top.length - 1], what: 'top3'} : null) : null;
  const mine = me.teacher ? null : {rank: mineRow?.rank ?? null, gain, points: mineRow?.points || 0, next};
  return {kind: 'growth' as const, board, month, pending: false, total: rows.length, rows: top, mine, ...(mineRow && mineRow.rank! > PET_GROWTH.next.upTo ? {mineRow: view(mineRow)} : {})};
}
