// 이전 포인트 회수 (scripts/take-prior-points.ts): October's coupon count without what was held before the 내역 began.
import {earnedIn, type ServerPetState} from './pet.js';
import {PET_COUPON, countsForMonth} from '../../src/lib/petCatalog.js';

/** The 내역 line the first run left (removed again by scripts/take-prior-points.ts --drop-line). */
export const PRIOR_LABEL = '이전 포인트 회수 (10월 첫 시즌)';
const LEGACY = /^예전 포인트 조정/;
/** What October's count holds beyond the 내역 (Sept + Oct lines, the 예전 포인트 조정 left out as it already cut it). */
export function priorOf(s: ServerPetState, month = PET_COUPON.firstSeason) {
  const lines = (s.ledger || []).filter(x => countsForMonth(x.day, month) && !LEGACY.test(x.label));
  return Math.max(0, earnedIn(s, month) - lines.reduce((n, x) => n + x.points, 0));
}
/** Take it back: the count in full, the points held as far as they go (no 내역 line: that part was never itemized). */
export function takePrior(s: ServerPetState, now: number) {
  const month = PET_COUPON.firstSeason, prior = priorOf(s, month); if (!prior || (s as any).priorTaken) return null;
  // the count first: a state that never wrote its count reads it from the points held
  const count = Math.max(0, earnedIn(s, month) - prior), held = Math.min(prior, Math.max(0, Number(s.points || 0)));
  s.points = Number(s.points || 0) - held;
  s.earnedBy = {[month]: count}; s.earned = {month, points: count};
  (s as any).priorTaken = {at: now, count: prior, held};
  return {prior, held};
}
