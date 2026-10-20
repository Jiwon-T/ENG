// 이달의 장학 쿠폰: one coupon a month for any 채움 학원 student (linked, an active member) whose points earned this month (Korea time) reached the
// goal. Asking for it takes no points and gives that month's 금메달 (a room decoration). petCoupons/{uid}_{YYYY-MM}
// (server only) is the record the admin hands out from; the document id keeps it to one per student per month.
import {normalizeNotionPageId as uuid, isNotionPageId} from './notionPageId.js';
import {readStudentMapping} from './studentIdentity.js';
import {DIRECTORY_ROWS, directoryRowKey} from './academyDirectorySource.js';
import {PET_STATES, claimStudyRewards, earnedIn, initialPetState, monthEarned, noteInbox, pendingStudyRewards, petSummary, prevMonth, rollDay, seoulDay, settleLessons, type ServerPetState} from './pet.js';
import {lessonRows} from './lessonRewardRows.js';
import {PET_COUPON, medalLabel, passAllows, petItem, silverMedal, type CouponTier} from '../../src/lib/petCatalog.js';

export const PET_COUPONS = 'petCoupons';
export interface PetCoupon { uid: string; studentKey: string; month: string; requestedAt: number; earned: number; paidAt: number | null; paidBy: string | null;
  /** 단계 쿠폰: which one, its won and the points it used (none = the one coupon before 단계 쿠폰: full, 1만 원, the goal) */ tier?: CouponTier; won?: number; points?: number;
  /** 오프라인 신청: asked for by the admin for the student (who may have no app account: `uid` null), and by whom */ offline?: boolean; requestedBy?: string }

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

/** The month's medal: 금 once the month's coupons reach 1만 원 (a 은메달 turns gold, keeping its place in the room), else 은
 *  (the first 5천 원). Before 단계 쿠폰 every coupon is 1만 원, so gold as before. */
export function grantMonthMedal(s: ServerPetState, month: string, wonThisMonth: number) {
  const silver = silverMedal(month), medals = new Set(s.medals || []);
  if (wonThisMonth >= PET_COUPON.monthWon) {
    if (medals.has(month) && !medals.has(silver)) return;
    medals.delete(silver); medals.add(month);
    s.decor = Object.fromEntries(Object.entries(s.decor || {}).map(([bg, items]) => [bg, items.map(it => it.id === silver ? {...it, id: month} : it)]));
  } else if (!medals.has(month)) medals.add(silver);
  s.medals = [...medals];
}
/** 쿠폰 교환 신청: this month's (or, in the grace days, last month's) earned points reach the coupon; 단계 쿠폰 use their points
 *  (what is left keeps counting) and give at most 1만 원 a month. The first one of a month adds its 금메달. */
export async function requestCoupon(db: any, uid: string, studentKey: string, now: number, monthInput?: unknown, tierInput?: unknown, extra: Partial<PetCoupon> = {}) {
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
    const coupon: PetCoupon = {uid, studentKey, month, requestedAt: now, earned: state.earned, paidAt: null, paidBy: null, tier, won: t.won, points: t.points, ...extra};
    grantMonthMedal(s, month, state.won + t.won); s.updatedAt = now;
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
export async function displayName(db: any, key: string) {
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
    name: await displayName(db, c.studentKey), points: c.uid ? (await db.collection(PET_STATES).doc(c.uid).get()).data()?.points ?? 0 : 0, ...(c.offline ? {offline: true} : {})})));
  return {coupons: coupons.sort((a, b) => b.month.localeCompare(a.month) || b.requestedAt - a.requestedAt)};
}
/** 이번 달 포인트 (관리자 설정 › 쿠폰, 학생 관리 › 장학 쿠폰): the admin and the principal see every active student of the
 *  academy, a teacher the students they have — with or without the app. Each shows the points the 수업 일지 give them, as
 *  if every lesson were already paid: the linked student's pet plus what is still waiting, and for a student without the app
 *  the same lessons counted the same way (nothing is saved). So the list is fair to students who study without the app,
 *  and a coupon can be asked for offline. `app`: 'linked' (has a pet), 'no-pet' (account, no pet yet), 'none' (no account). */
export async function listPetPoints(db: any, actor: any, now = Date.now()) {
  // the admin and the principal: the whole academy; a teacher: the students they have (any subject)
  const whole = Boolean(actor?.admin && actor.academyId === 'main' || actor?.principal && actor.academyId === 'main');
  if (!whole && !(actor?.scopes || []).length) throw Error('FORBIDDEN');
  const mine = new Set((actor?.scopes || []).map((s: any) => { try { return uuid(String(s?.studentKey || '')); } catch { return ''; } }));
  const month = seoulDay(now).slice(0, 7);
  const [members, coupons] = await Promise.all([db.collection('academyStudentMemberships').where('academyId', '==', 'main').get(), db.collection(PET_COUPONS).where('month', '==', month).get()]);
  const asked = new Set(coupons.docs.map((d: any) => d.data().studentKey));
  const keys = members.docs.filter((d: any) => !d.data().disabled).map((d: any) => { try { return uuid(d.id); } catch { return ''; } }).filter((k: string) => k && (whole || mine.has(k)));
  const byKey = new Map<string, PetCoupon[]>();
  for (const c of coupons.docs.map((x: any) => x.data() as PetCoupon)) byKey.set(c.studentKey, [...(byKey.get(c.studentKey) || []), c]);
  const students = (await Promise.all(keys.map(async (key: string) => {
    const o = await owedPoints(db, key, now); if (!o) return null;
    const earned = monthEarned(o.all);
    return {key, name: await displayName(db, key), points: Number(o.all.points || 0), earned, requested: asked.has(key),
      app: !o.linked ? 'none' : o.hadPet ? 'linked' : 'no-pet', waiting: Math.max(0, Number(o.all.points || 0) - o.held),
      // the coupons the admin may ask for offline now (단계 쿠폰 from November)
      options: monthState(month, earned, byKey.get(key) || []).options.filter(x => x.ready).map(x => ({id: x.id, won: x.won})),
      // this month's 포인트 내역 (what the gauge is made of), with what is still waiting
      ledger: (o.all.ledger || []).filter(x => x.day.slice(0, 7) === month)};
  }))).filter(Boolean) as {key: string; name: string; points: number; earned: number; requested: boolean; app: string; waiting: number; options: {id: CouponTier; won: number}[]; ledger: any[]}[];
  return {month, goal: PET_COUPON.goal, students: students.sort((a, b) => b.earned - a.earned || a.name.localeCompare(b.name, 'ko'))};
}
/** One student's points as the 수업 일지 give them (nothing saved): the linked account's pet plus what is still waiting, or
 *  for a student without the app the same lessons counted the same way. Null when the student has no record. */
/** `strict`: a failed read of the student record or the lessons is thrown, not taken as 'no record' or 'no lessons' (대기
 *  포인트 모두 넣기 must tell the admin which students it could not check). */
export async function owedPoints(db: any, key: string, now: number, strict = false) {
  const mapping = strict ? await readStudentMapping(db, key) : await readStudentMapping(db, key).catch(() => null);
  if (!mapping?.internalStudentId) return null;
  // the account counts only when it is the one linked now (the mapping points to it and it points back)
  const uid: string | null = mapping.firebaseUid || null, user = uid ? (await db.collection('users').doc(uid).get()).data() : null;
  const linked = Boolean(uid && user?.role === 'student' && !user.disabled && typeof user.notionStudentKey === 'string' && isNotionPageId(user.notionStudentKey) && uuid(user.notionStudentKey) === key);
  const raw = linked ? (await db.collection(PET_STATES).doc(uid!).get()).data() : null;
  const held: ServerPetState = raw ? rollDay(raw, now) : {...initialPetState(now), points: 0};
  const read = lessonRows(db, mapping.internalStudentId, linked ? uid : null), rows = strict ? await read : await read.catch(() => []);
  const all = structuredClone(held);
  if (rows.length) { claimStudyRewards(all, pendingStudyRewards(all, rows, now)); settleLessons(all, rows, now); }
  return {linked, uid: linked ? uid : null, user, hadPet: Boolean(raw), held: Number(held.points || 0), all, rows};
}

/** A student who had coupons asked offline before joining the app: their medals go into the room once they have a pet (and the
 *  coupons now point at the account, so the list shows its points). Returns how many months got a medal. */
export async function syncOfflineMedals(db: any, uid: string, key: string, now = Date.now()) {
  const snap = await db.collection(PET_COUPONS).where('studentKey', '==', key).get();
  const offline = snap.docs.filter((d: any) => !d.data().uid);
  if (!offline.length) return 0;
  const ref = db.collection(PET_STATES).doc(uid);
  return db.runTransaction(async (tx: any) => {
    const pet = await tx.get(ref); if (!pet.exists) return 0;
    const s: ServerPetState = rollDay(pet.data(), now), before = JSON.stringify(s.medals || []);
    const won = new Map<string, number>();
    for (const d of snap.docs) { const c = d.data() as PetCoupon; won.set(c.month, (won.get(c.month) || 0) + (c.won ?? PET_COUPON.monthWon)); }
    for (const [month, total] of won) grantMonthMedal(s, month, total);
    for (const d of offline) tx.update(d.ref, {uid});
    if (JSON.stringify(s.medals || []) !== before) { s.updatedAt = now; tx.set(ref, s); }
    return won.size;
  });
}

/** 오프라인 신청 (admin): a coupon for a student who reached it but can't ask in the app. A linked student's waiting lesson
 *  rewards are first paid into their pet (the account made if needed), then the coupon is asked as in the app (the month's
 *  금메달 in their room). A student without an app account gets the coupon recorded from the points their lessons give
 *  (no room yet, so no medal); the same limits apply: one 1만 원 a month, 단계 쿠폰 from November. */
export async function requestCouponOffline(db: any, actor: any, input: any, now = Date.now()) {
  admin(actor);
  let key: string; try { key = uuid(String(input?.studentKey || '')); } catch { throw Error('BAD_REQUEST'); }
  const member = (await db.collection('academyStudentMemberships').doc(key).get()).data();
  if (!member || member.disabled || member.academyId !== 'main') throw Error('FORBIDDEN');
  const o = await owedPoints(db, key, now); if (!o) throw Error('COUPON_NOT_YET');
  const extra = {offline: true, requestedBy: String(actor.uid || 'admin')};
  if (o.linked && o.uid) {
    const ref = db.collection(PET_STATES).doc(o.uid), userRef = db.collection('users').doc(o.uid);
    await db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref), s: ServerPetState = rollDay(snap.exists ? snap.data() : initialPetState(now, o.user?.petStats), now);
      const before = JSON.stringify([s.points, s.rewarded, s.lessonPaid || {}]), ledger = structuredClone(s.ledger || []);
      claimStudyRewards(s, pendingStudyRewards(s, o.rows, now)); settleLessons(s, o.rows, now);
      if (JSON.stringify([s.points, s.rewarded, s.lessonPaid || {}]) === before && snap.exists) return;
      noteInbox(s, ledger); s.updatedAt = now; tx.set(ref, s); tx.set(userRef, {petStats: petSummary(s)}, {merge: true});
    });
    const out = await requestCoupon(db, o.uid, key, now, input?.month, input?.tier, extra);
    return {coupon: out.coupon};
  }
  // no app account: the coupon record only (ids by the student key)
  const day = seoulDay(now), cur = day.slice(0, 7), month = input?.month === prevMonth(cur) && inGrace(day) ? prevMonth(cur) : cur;
  const id = `k${key.replace(/-/g, '')}`, refs = [`${id}_${month}`, `${id}_${month}_h1`, `${id}_${month}_h2`].map(x => db.collection(PET_COUPONS).doc(x));
  const earned = earnedIn(o.all, month);
  return db.runTransaction(async (tx: any) => {
    const snaps = await Promise.all(refs.map(r => tx.get(r))), list = snaps.filter((x: any) => x.exists).map((x: any) => x.data() as PetCoupon);
    const tier: CouponTier = tiered(month) && input?.tier === 'half' ? 'half' : 'full', t = tierOf(tier);
    const state = monthState(month, earned, list), option = state.options.find(x => x.id === tier);
    if (!option) throw Error('COUPON_NOT_YET');
    if (tier === 'full' && snaps[0].exists || state.won + t.won > PET_COUPON.monthWon) throw Error('COUPON_TAKEN');
    if (!option.ready) throw Error('COUPON_NOT_YET');
    const slot = tier === 'full' ? 0 : snaps.findIndex((x: any, k: number) => k > 0 && !x.exists);
    if (slot < 0) throw Error('COUPON_TAKEN');
    const coupon: PetCoupon = {uid: null as any, studentKey: key, month, requestedAt: now, earned: state.earned, paidAt: null, paidBy: null, tier, won: t.won, points: t.points, ...extra};
    tx.set(refs[slot], coupon);
    return {coupon};
  });
}

/** 학습 리포트 › 장학 쿠폰 (선생님): one student's progress this month — earned, held, asked for, the 내역 — for the admin and
 *  the teachers who have the student (a principal: every student); the linked account only. */
export async function teacherStudentCoupon(db: any, actor: any, keyInput: unknown, now = Date.now()) {
  let key: string; try { key = uuid(String(keyInput || '')); } catch { throw Error('BAD_REQUEST'); }
  if (!actor?.admin && !(actor?.scopes || []).some((s: any) => s?.studentKey === key)) throw Error('FORBIDDEN');
  const mapping = await readStudentMapping(db, key), uid = mapping?.firebaseUid;
  const user = uid ? (await db.collection('users').doc(uid).get()).data() : null;
  const month = seoulDay(now).slice(0, 7);
  if (!uid || !user || user.notionStudentKey == null || uuid(String(user.notionStudentKey)) !== key) {
    // no app account: the same count from the 수업 일지 (nothing saved), and coupons asked offline for the student
    const o = await owedPoints(db, key, now); if (!o) return {linked: false};
    const list = (await db.collection(PET_COUPONS).where('studentKey', '==', key).get()).docs.map((d: any) => d.data() as PetCoupon).filter((c: PetCoupon) => c.month === month);
    return {linked: false, offline: true, month, goal: PET_COUPON.goal, earned: monthEarned(o.all), points: Number(o.all.points || 0), requested: list.length > 0, paid: list.length > 0 && list.every(c => Boolean(c.paidAt)),
      coupons: list.map(c => ({won: c.won ?? PET_COUPON.monthWon, paid: Boolean(c.paidAt)})), ledger: (o.all.ledger || []).filter(x => x.day.slice(0, 7) === month)};
  }
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
