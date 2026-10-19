// 이달의 장학 쿠폰: one coupon a month for 영어 이지원T's students whose points earned this month (Korea time) reached the
// goal. Asking for it takes no points and gives that month's 금메달 (a room decoration). petCoupons/{uid}_{YYYY-MM}
// (server only) is the record the admin hands out from; the document id keeps it to one per student per month.
import {normalizeNotionPageId as uuid, isNotionPageId} from './notionPageId.js';
import {readStudentMapping} from './studentIdentity.js';
import {DIRECTORY_ROWS, directoryRowKey} from './academyDirectorySource.js';
import {PET_STATES, monthEarned, rollDay, type ServerPetState} from './pet.js';
import {PET_COUPON, medalLabel, passAllows, petItem} from '../../src/lib/petCatalog.js';

export const PET_COUPONS = 'petCoupons';
export interface PetCoupon { uid: string; studentKey: string; month: string; requestedAt: number; earned: number; paidAt: number | null; paidBy: string | null }
const sameKey = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' && isNotionPageId(a) && isNotionPageId(b) && uuid(a) === uuid(b);

/** The student's academy key when the admin (영어 이지원T) teaches them 영어 in this academy; otherwise null. */
export async function couponStudentKey(db: any, uid: string, adminUid = process.env.ADMIN_UID) {
  if (!adminUid) return null;
  const key = (await db.collection('users').doc(uid).get()).data()?.notionStudentKey;
  if (typeof key !== 'string' || !isNotionPageId(key)) return null;
  const [profile, member] = await Promise.all([db.collection('teacherWorkspaceAccess').doc(adminUid).get(), db.collection('academyStudentMemberships').doc(uuid(key)).get()]);
  const p = profile.data(), m = member.data();
  if (!p || p.disabled || !m || m.disabled || m.academyId !== 'main') return null;
  return (p.scopes || []).some((s: any) => s?.subject === '영어' && sameKey(s.studentKey, key)) ? uuid(key) : null;
}

/** What the pet screen shows: the goal gauge, and whether this month's coupon was asked for or handed out. */
export function couponView(s: ServerPetState, eligible: boolean, coupon: PetCoupon | null) {
  const month = s.day.slice(0, 7);
  return {eligible, month, label: medalLabel(month), earned: monthEarned(s), goal: PET_COUPON.goal, requested: Boolean(coupon), paid: Boolean(coupon?.paidAt)};
}
export async function readCoupon(db: any, uid: string, month: string) {
  const snap = await db.collection(PET_COUPONS).doc(`${uid}_${month}`).get();
  return snap.exists ? snap.data() as PetCoupon : null;
}

/** 쿠폰 교환 신청: once a month, when this month's earned points reached the goal. Adds that month's 금메달. */
export async function requestCoupon(db: any, uid: string, studentKey: string, now: number) {
  const ref = db.collection(PET_STATES).doc(uid);
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref); if (!snap.exists) throw Error('COUPON_NOT_YET');
    const s: ServerPetState = rollDay(snap.data(), now), month = s.day.slice(0, 7), couponRef = db.collection(PET_COUPONS).doc(`${uid}_${month}`);
    if ((await tx.get(couponRef)).exists) throw Error('COUPON_TAKEN');
    const earned = monthEarned(s); if (earned < PET_COUPON.goal) throw Error('COUPON_NOT_YET');
    const coupon: PetCoupon = {uid, studentKey, month, requestedAt: now, earned, paidAt: null, paidBy: null};
    s.medals = [...new Set([...(s.medals || []), month])]; s.updatedAt = now;
    tx.set(couponRef, coupon); tx.set(ref, s);
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
  const coupons = await Promise.all(rows.map(async c => ({id: c.id, studentKey: c.studentKey, month: c.month, label: medalLabel(c.month), requestedAt: c.requestedAt, paidAt: c.paidAt,
    name: await displayName(db, c.studentKey), points: (await db.collection(PET_STATES).doc(c.uid).get()).data()?.points ?? 0})));
  return {coupons: coupons.sort((a, b) => b.month.localeCompare(a.month) || b.requestedAt - a.requestedAt)};
}
/** 지급 완료 (or undo it). */
export async function markCouponPaid(db: any, actor: any, input: any) {
  admin(actor);
  const id = String(input?.id || ''); if (!/^[A-Za-z0-9]{1,128}_\d{4}-\d{2}$/.test(id)) throw Error('BAD_REQUEST');
  const ref = db.collection(PET_COUPONS).doc(id), snap = await ref.get(); if (!snap.exists) throw Error('NOT_FOUND');
  const paid = input?.paid !== false, now = Date.now();
  await ref.update({paidAt: paid ? now : null, paidBy: paid ? actor.uid || 'admin' : null});
  return {id, paidAt: paid ? now : null};
}
