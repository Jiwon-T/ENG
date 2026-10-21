/**
 * 이전 포인트 회수 (decided 2026-10-21): October, the first season, counted every point a student held when counting began
 * (app study from before the server kept a 내역, already capped at 300P a day by 예전 포인트 조정). From now on the coupon
 * counts only what the 내역 shows (October's points and the 9월 수업 포인트) plus the 보완, so that part is taken back — from
 * the coupon count in full and from the points held (never below 0), with no line in the 내역 (students never saw that part
 * itemized). Students only; once each (petStates.priorTaken).
 *
 * Safety: a dry run by default (counts only, no names). `--apply` writes — run it only after the user approved it. A
 * student who asked for an October coupon is skipped (checked again inside each student's transaction).
 * `--drop-line --apply` removes from the 내역 the '이전 포인트 회수' line the first run (2026-10-21) left, and the
 * '예전 포인트 조정 (하루 300P)' lines (neither changes the points or the count; students never needed them).
 *
 *   node --env-file=<env> --import tsx scripts/take-prior-points.ts [--apply] [--drop-line]
 */
import { getFirebaseAdmin } from '../api/_lib/firebaseAdmin.ts';
import { PET_STATES, petSummary, rollDay, seoulDay, type ServerPetState } from '../api/_lib/pet.ts';
import { PRIOR_LABEL, priorOf, takePrior } from '../api/_lib/priorPoints.ts';
import { PET_COUPON } from '../src/lib/petCatalog.ts';

const apply = process.argv.includes('--apply'), dropLine = process.argv.includes('--drop-line');
const { db } = getFirebaseAdmin(), now = Date.now();
if (seoulDay(now).slice(0, 7) !== PET_COUPON.firstSeason) { console.error('only in the first season (October)'); process.exit(1); }
// a student's October coupons (the 1만 원 one and up to two 5천 원 ones)
const couponRefs = (uid: string) => ['', '_h1', '_h2'].map(x => db.collection('petCoupons').doc(`${uid}_${PET_COUPON.firstSeason}${x}`));
if (dropLine) {
  const drop = (x: any) => x.label === PRIOR_LABEL || /^예전 포인트 조정/.test(String(x.label || ''));
  let lines = 0, students = 0;
  for (const d of (await db.collection(PET_STATES).get()).docs) {
    const found = (d.data().ledger || []).filter(drop).length;
    if (!found) continue;
    students++; if (!apply) { lines += found; continue; } // the dry run counts the lines it would remove
    lines += await db.runTransaction(async (tx: any) => {
      const snap = await tx.get(d.ref), s = snap.data(), kept = (s.ledger || []).filter((x: any) => !drop(x));
      if (kept.length === (s.ledger || []).length) return 0;
      tx.update(d.ref, {ledger: kept, updatedAt: now}); return (s.ledger || []).length - kept.length;
    });
  }
  console.log(JSON.stringify({mode: apply ? 'drop-line apply' : 'drop-line dry-run', students, lines})); process.exit(0);
}
const asked = (await db.collection('petCoupons').where('month', '==', PET_COUPON.firstSeason).get()).size;
const plan: { uid: string; prior: number; take: number; balance: number }[] = [];
for (const d of (await db.collection(PET_STATES).get()).docs) {
  const user = (await db.collection('users').doc(d.id).get()).data(); if (user?.role !== 'student') continue;
  const s = rollDay(d.data() as ServerPetState, now) as ServerPetState; if ((s as any).priorTaken) continue;
  const prior = priorOf(s); if (prior > 0) plan.push({ uid: d.id, prior, take: Math.min(prior, Math.max(0, Number(s.points || 0))), balance: Number(s.points || 0) });
}
plan.sort((a, b) => b.prior - a.prior);
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', octoberCoupons: asked, students: plan.length, countTotal: plan.reduce((n, p) => n + p.prior, 0), heldTotal: plan.reduce((n, p) => n + p.take, 0), each: plan.map(p => ({ count: p.prior, balance: p.balance, take: p.take, balanceAfter: p.balance - p.take })) }));
if (apply) {
  let done = 0, skipped = 0;
  for (const p of plan) {
    const ref = db.collection(PET_STATES).doc(p.uid);
    const r = await db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref); if (!snap.exists) return null;
      // asked for an October coupon meanwhile: left alone (the coupon was asked on the count it had)
      if ((await Promise.all(couponRefs(p.uid).map(c => tx.get(c)))).some((c: any) => c.exists)) return 'asked';
      const s = rollDay(snap.data() as ServerPetState, now) as ServerPetState, out = takePrior(s, now); if (!out) return null;
      s.updatedAt = now; tx.set(ref, s); tx.set(db.collection('users').doc(p.uid), { petStats: petSummary(s) }, { merge: true });
      return out;
    });
    if (r === 'asked') skipped++; else if (r) done++;
  }
  // the rankings show the new points on their next look
  await Promise.all(['current', 'month'].map(id => db.collection('petRankings').doc(id).set({ builtAt: 0 }, { merge: true })));
  console.log(JSON.stringify({ done, skipped }));
}
process.exit(0);
