/** A name with its middle hidden for lists other students see (김지원 → 김*원, 이현 → 이*). firestore.rules accepts only
 *  this shape for matchLeaderboard.name (or '익명'); keep the two in step. */
export const isMaskedName = (name: unknown) => name === '익명' || (typeof name === 'string' && /^[^*]?\*{1,3}[^*]?$/u.test(name));
export function maskName(raw: unknown) {
  const name = Array.from(String(raw ?? '').trim());
  if (!name.length) return '익명';
  if (name.length === 1) return '*';
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 3))}${name[name.length - 1]}`;
}
