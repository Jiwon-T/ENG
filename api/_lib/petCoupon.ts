// 이달의 장학 쿠폰: one coupon a month for any 채움 학원 student (linked, an active member) whose points earned this month (Korea time) reached the
// goal. Asking for it takes no points and gives that month's 금메달 (a room decoration). petCoupons/{uid}_{YYYY-MM}
// (server only) is the record the admin hands out from; the document id keeps it to one per student per month.
import {normalizeNotionPageId as uuid, isNotionPageId} from './notionPageId.js';
import {readStudentMapping} from './studentIdentity.js';
import {DIRECTORY_ROWS, directoryRowKey} from './academyDirectorySource.js';
import {PET_STATES, earnedIn, monthEarned, prevMonth, rollDay, seoulDay, type ServerPetState} from './pet.js';
import {PET_COUPON, medalLabel, passAllows, petItem, type CouponTier} from '../../src/lib/petCatalog.js';

export const PET_COUPONS = 'petCoupons';
export interface PetCoupon { uid: string; studentKey: string; month: string; requestedAt: number; earned: number; paidAt: number | null; paidBy: string | null;
  /** 단계 쿠폰: which one, its won and the points it used (none = the one coupon before 단계 쿠폰: full, 1만 원, the goal) */ tier?: CouponTier; won?: number; points?: number }

/** The student's academy key when this account is the one linked to them (the server's mapping says so) and they are an
 *  active member of this academy (any subject, any teacher); otherwise null. */
export async function couponStudentKey(db: any, uid: string) {
  const key = (await db.collection('users').doc(uid).get()).data()?.notionStudentKey;
  if (typeof key !== 'string' || !isNotionPageId(key)) return null;
  const [m, mapping] = await Promise.all([db.collection('academyStudentMemberships').doc(uuid(key)).get().then((s: any) => s.data()), readStudentMapping(db, key)]);
  return m && !m.disabled && m.academyId === 'main' && mapping?.firebaseUid === uid ? uuid(key) : null;
}

/** What the pet screen shows: the goal gauge, and whether this month's coupon was asked for or handed out. */
/** The first days of a month: last month's coupon can still be asked for (its lessons' points may come in late). */
export const inGrace = (day: string) => Number(day.slice(8, 10)) <= PET_COUPON.graceDays;
const tiered = (month: string) => month >= PET_COUPON.tiersFrom;
const tierOf = (id: CouponTier) => PET_COUPON.tiers.find(t => t.id === id)!;
/** A month's coupons: the 1만 원 one (or the one coupon before 단계 쿠폰) and up to two 5천 원 ones. */
const couponIds = (uid: string, month: string) => [`${uid}_${month}`, `${uid}_${month}_h1`, `${uid}_${month}_h2`];
export async function readMonthCoupons(db: any, uid: string, month: string): Promise<PetCoupon[]> {
  const snaps = await Promise.all(couponIds(uid, month).map(id => db.collection(PET_COUPONS).doc(id).get()));
  return snaps.filter((x: any) => x.exists).map((x: any) => x.data() as PetCoupon);
}
/** Points used and won given by a month's coupons (one before 단계 쿠폰 = the goal and 1만 원). */
const used = (list: PetCoupon[]) => ({points: list.reduce((n, c) => n + (c.points ?? PET_COUPON.goal), 0), won: list.reduce((n, c) => n + (c.won ?? PET_COUPON.monthWon), 0)});
/** One month's coupon state: earned, used, left to use, and which coupons can be asked for now. */
function monthState(month: string, earned: number, list: PetCoupon[]) {
  const u = used(list), left = Math.max(0, earned - u.points), hasFull = list.some(c => (c.tier ?? 'full') === 'full');
  const options = (tiered(month) ? PET_COUPON.tiers : [tierOf('full')]).map(t => ({id: t.id as CouponTier, points: t.points, won: t.won,
    ready: left >= t.points && u.won + t.won <= PET_COUPON.monthWon && !(t.id === 'full' && hasFull)}));
  return {earned, spent: u.points, left, won: u.won, tiered: tiered(month), options, requested: list.length > 0, paid: list.length > 0 && list.every(c => Boolean(c.paidAt)),
    coupons: list.map(c => ({tier: (c.tier ?? 'full') as CouponTier, won: c.won ?? PET_COUPON.monthWon, paid: Boolean(c.paidAt)}))};
}
export function couponView(s: ServerPetState, eligible: boolean, list: PetCoupon[] = [], last?: PetCoupon[]) {
  const month = s.day.slice(0, 7), pm = prevMonth(month);
  return {eligible, month, label: medalLabel(month), goal: PET_COUPON.goal, ...monthState(month, monthEarned(s), list),
    // `last`: last month's, while it may still be asked for
    ...(inGrace(s.day) && last !== undefined ? {last: {month: pm, label: medalLabel(pm), until: `${s.day.slice(0, 8)}${String(PET_COUPON.graceDays).padStart(2, '0')}`, ...monthState(pm, earnedIn(s, pm), last)}} : {})};
}
/** couponView with this month's coupons (and last month's during the grace days). */
export async function readCouponView(db: any, uid: string, s: ServerPetState, eligible: boolean) {
  const month = s.day.slice(0, 7);
  if (!eligible) return couponView(s, false);
  const [now, last] = await Promise.all([readMonthCoupons(db, uid, month), inGrace(s.day) ? readMonthCoupons(db, uid, prevMonth(month)) : Promise.resolve(undefined)]);
  return couponView(s, true, now, last);
}
/** The month's coupons as one (the 1만 원 or first one): for the screens that only ask whether one was taken. */
export async function readCoupon(db: any, uid: string, month: string) {
  const list = await readMonthCoupons(db, uid, month);
  return list[0] || null;
}

/** 쿠폰 교환 신청: this month's (or, in the grace days, last month's) earned points reach the coupon; 단계 쿠폰 use their points
 *  (what is left keeps counting) and give at most 1만 원 a month. The first one of a month adds its 금메달. */
export async function requestCoupon(db: any, uid: string, studentKey: string, now: number, monthInput?: unknown, tierInput?: unknown) {
  const ref = db.collection(PET_STATES).doc(uid);
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref); if (!snap.exists) throw Error('COUPON_NOT_YET');
    const s: ServerPetState = rollDay(snap.data(), now), cur = s.day.slice(0, 7);
    // last month's only during the grace days
    const month = monthInput === prevMonth(cur) && inGrace(s.day) ? prevMonth(cur) : cur;
    const refs = couponIds(uid, month).map(id => db.collection(PET_COUPONS).doc(id)), snaps = await Promise.all(refs.map(r => tx.get(r)));
    const list = snaps.filter((x: any) => x.exists).map((x: any) => x.data() as PetCoupon);
    const tier: CouponTier = tiered(month) && tierInput === 'half' ? 'half' : 'full', t = tierOf(tier);
    const state = monthState(month, earnedIn(s, month), list), option = state.options.find(o => o.id === tier);
    if (!option) throw Error('COUPON_NOT_YET');
    if (tier === 'full' && snaps[0].exists || state.won + t.won > PET_COUPON.monthWon) throw Error('COUPON_TAKEN');
    if (!option.ready) throw Error('COUPON_NOT_YET');
    const slot = tier === 'full' ? 0 : snaps.findIndex((x: any, k: number) => k > 0 && !x.exists);
    if (slot < 0) throw Error('COUPON_TAKEN');
    const coupon: PetCoupon = {uid, studentKey, month, requestedAt: now, earned: state.earned, paidAt: null, paidBy: null, tier, won: t.won, points: t.points};
    s.medals = [...new Set([...(s.medals || []), month])]; s.updatedAt = now;
    tx.set(refs[slot], coupon); tx.set(ref, s);
    return {state: s, coupon};
  });
}

/** 꾸미기: where the medals and 탑 장식 sit in one room (only ones the student has, each once, inside the room). */
export function placeDecor(s: ServerPetState, backgroundInput: unknown, itemsInput: unknown, plan: string = 'free') {
  const background = String(backgroundInput || '');
  // a room the student has, or a 패스 room while that pass is on
  if (background !== 'default' && !s.inventory.includes(background) && !passAllows(petItem(background), plan)) throw Error('PET_BAD_ACTION');
  if (!Array.isArray(itemsInput) || itemsInput.length > PET_COUPON.maxDecor) throw Error('PET_BAD_ACTION');
  const owned = new Set([...(s.medals || []), ...(s.towerDecor || [])]), seen = new Set<string>();
  const clamp = (v: unknown) => { const n = Number(v); if (!Number.isFinite(n)) throw Error('PET_BAD_ACTION'); return Math.round(Math.max(0, Math.min(100, n)) * 10) / 10; };
  const items = itemsInput.map((it: any) => {
    const id = String(it?.id || ''); if (!owned.has(id) || seen.has(id)) throw Error('PET_BAD_ACTION'); seen.add(id);
    return {id, x: clamp(it.x), y: clamp(it.y)};
  });
  s.decor = {...(s.decor || {}), [background]: items};
  return {placed: items.length};
}

// ---- 관리자 설정 › 쿠폰 and the badges in 학생 관리 (admin only) ----
function admin(actor: any) { if (!actor.admin || actor.academyId !== 'main') throw Error('FORBIDDEN'); }
async function displayName(db: any, key: string) {
  const row = (await db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students', key)).get()).data();
  const fromRow = row?.kind === 'students' && row.academyId === 'main' ? row.fields?.summaryOverride?.studentDisplayName : null;
  return String(fromRow || (await readStudentMapping(db, key))?.studentDisplayName || '학생').slice(0, 40);
}
/** Every coupon (newest month first) with the student's name and current points. */
export async function listCoupons(db: any, actor: any) {
  admin(actor);
  const snap = await db.collection(PET_COUPONS).get();
  const rows = snap.docs.map((d: any) => ({id: d.id, ...d.data()})) as (PetCoupon & {id: string})[];
  const coupons = await Promise.all(rows.map(async c => ({id: c.id, studentKey: c.studentKey, month: c.month, label: `${medalLabel(c.month)}${(c.won ?? PET_COUPON.monthWon) < PET_COUPON.monthWon ? ' 5천 원' : ''}`, requestedAt: c.requestedAt, paidAt: c.paidAt,
    name: await displayName(db, c.studentKey), points: (await db.collection(PET_STATES).doc(c.uid).get()).data()?.points ?? 0})));
  return {coupons: coupons.sort((a, b) => b.month.localeCompare(a.month) || b.requestedAt - a.requestedAt)};
}
/** 이번 달 포인트 (관리자 설정 › 쿠폰, 학생 관리 › 장학 쿠폰): the admin and the principal see every linked, active student of
 *  the academy, a teacher the students they have; each with the points they hold and this
 *  month's earned points (the coupon count), most earned first, and whether this month's coupon was asked for. */
export async function listPetPoints(db: any, actor: any, now = Date.now()) {
  // the admin and the principal: the whole academy; a teacher: the students they have (any subject)
  const whole = Boolean(actor?.admin && actor.academyId === 'main' || actor?.principal && actor.academyId === 'main');
  if (!whole && !(actor?.scopes || []).length) throw Error('FORBIDDEN');
  const mine = new Set((actor?.scopes || []).map((s: any) => String(s?.studentKey || '')));
  const month = seoulDay(now).slice(0, 7);
  const [users, members, coupons] = await Promise.all([db.collection('users').where('role', '==', 'student').get(), db.collection('academyStudentMemberships').where('academyId', '==', 'main').get(), db.collection(PET_COUPONS).where('month', '==', month).get()]);
  const active = new Set(members.docs.filter((d: any) => !d.data().disabled).map((d: any) => d.id)), asked = new Set(coupons.docs.map((d: any) => d.data().uid));
  const linked = users.docs.map((d: any) => ({uid: d.id, key: d.data().notionStudentKey})).filter((u: any) => typeof u.key === 'string' && isNotionPageId(u.key) && active.has(uuid(u.key)) && (whole || mine.has(uuid(u.key))));
  // only the account the student is linked to now (the mapping points back to it): an old account still holding the key
  // is left out, so a student is never listed twice nor shown another account's points
  const checked = await Promise.all(linked.map(async (u: any) => ((await readStudentMapping(db, u.key).catch(() => null))?.firebaseUid === u.uid ? u : null)));
  const students = await Promise.all(checked.filter(Boolean).map(async (u: any) => {
    const raw = (await db.collection(PET_STATES).doc(u.uid).get()).data(), s = raw ? rollDay(raw, now) as ServerPetState : null;
    return {name: await displayName(db, uuid(u.key)), points: s ? Number(s.points || 0) : 0, earned: s ? monthEarned(s) : 0, requested: asked.has(u.uid),
      // this month's 포인트 내역 (what the gauge is made of), as the student sees it
      ledger: (s?.ledger || []).filter(x => x.day.slice(0, 7) === month)};
  }));
  return {month, goal: PET_COUPON.goal, students: students.sort((a, b) => b.earned - a.earned || a.name.localeCompare(b.name, 'ko'))};
}
/** 학습 리포트 › 장학 쿠폰 (선생님): one student's progress this month — earned, held, asked for, the 내역 — for the admin and
 *  the teachers who have the student (a principal: every student); the linked account only. */
export async function teacherStudentCoupon(db: any, actor: any, keyInput: unknown, now = Date.now()) {
  let key: string; try { key = uuid(String(keyInput || '')); } catch { throw Error('BAD_REQUEST'); }
  if (!actor?.admin && !(actor?.scopes || []).some((s: any) => s?.studentKey === key)) throw Error('FORBIDDEN');
  const mapping = await readStudentMapping(db, key), uid = mapping?.firebaseUid;
  const user = uid ? (await db.collection('users').doc(uid).get()).data() : null;
  if (!uid || !user || user.notionStudentKey == null || uuid(String(user.notionStudentKey)) !== key) return {linked: false};
  const month = seoulDay(now).slice(0, 7);
  const [raw, list] = await Promise.all([db.collection(PET_STATES).doc(uid).get().then((s: any) => s.data()), readMonthCoupons(db, uid, month)]);
  const s = raw ? rollDay(raw, now) as ServerPetState : null;
  // every coupon of the month (단계 쿠폰: up to two 5천 원), each with its own 지급 state
  return {linked: true, month, goal: PET_COUPON.goal, earned: s ? monthEarned(s) : 0, points: s ? Number(s.points || 0) : 0, requested: list.length > 0, paid: list.length > 0 && list.every(c => Boolean(c.paidAt)),
    coupons: list.map(c => ({won: c.won ?? PET_COUPON.monthWon, paid: Boolean(c.paidAt)})),
    ledger: (s?.ledger || []).filter(x => x.day.slice(0, 7) === month)};
}
/** 지급 완료 (or undo it). */
export async function markCouponPaid(db: any, actor: any, input: any) {
  admin(actor);
  const id = String(input?.id || ''); if (!/^[A-Za-z0-9]{1,128}_\d{4}-\d{2}(_h[12])?$/.test(id)) throw Error('BAD_REQUEST');
  const ref = db.collection(PET_COUPONS).doc(id), snap = await ref.get(); if (!snap.exists) throw Error('NOT_FOUND');
  const paid = input?.paid !== false, now = Date.now();
  await ref.update({paidAt: paid ? now : null, paidBy: paid ? actor.uid || 'admin' : null});
  return {id, paidAt: paid ? now : null};
}
