// 이달 포인트 순위 names, the same on the server and on the teacher's screen: the family name only, and whether a name
// holds the real one.

/** '류지수' → '류**', '김하늘 (평촌고2)' → '김**': the first letter of the name and a star for each other one (1–3). */
export function maskedName(full: unknown) {
  const name = [...String(full ?? '').trim().split(/[\s(（]/)[0]];
  if (!name.length || name.join('') === '학생') return '학생';
  return name[0] + '*'.repeat(Math.max(1, Math.min(3, name.length - 1)));
}

/** False when `value` holds the real name: the whole of it, or its given name of 2+ letters ('류지수' → '지수'), spaces and
 *  case aside. */
export function keepsNameHidden(value: unknown, real: unknown) {
  const flat = (x: unknown) => String(x ?? '').replace(/\s+/g, '').toLowerCase();
  const v = flat(value), name = [...flat(String(real ?? '').trim().split(/[\s(（]/)[0])];
  if (!v || name.length < 2 || name.join('') === '학생') return Boolean(v);
  const given = name.slice(1).join('');
  return !v.includes(name.join('')) && !(given.length >= 2 && v.includes(given));
}
