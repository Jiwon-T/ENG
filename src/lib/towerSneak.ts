// 잠든 드래곤: the pet follows the finger along the path, but never faster than a sneak, so a hand that wobbles or moves a
// bit quickly no longer wakes the dragon at once. It wakes only when the finger runs far ahead of the pet (yanking it).
// Every step stays inside what the server checks (sneakLooksPlayed: ≤0.45/s over 250ms, steps ≤0.15, ≥3s, ≤600 samples).
export const SNEAK = { speed: 0.3, step: 0.08, sampleMs: 60, warnAhead: 0.12, wakeAhead: 0.3, exit: 0.94 };

export type SneakPoint = { p: number; t: number };
/** One finger position `finger` (0–1 along the path) at `now` ms, given the pet's last step `last`.
 *  `wake`: the finger got too far ahead; `next`: where the pet moves (a new sample), or null when it stays. */
export function sneakStep(last: SneakPoint, finger: number, now: number): { ahead: number; wake: boolean; next: SneakPoint | null } {
  const ahead = Math.max(0, finger - last.p);
  if (ahead > SNEAK.wakeAhead) return { ahead, wake: true, next: null };
  if (finger <= last.p || now - last.t < SNEAK.sampleMs) return { ahead, wake: false, next: null };
  const p = Math.min(finger, last.p + SNEAK.speed * (now - last.t) / 1000, last.p + SNEAK.step, 1);
  return { ahead, wake: false, next: p > last.p ? { p, t: now } : null };
}
