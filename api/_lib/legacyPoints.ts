// 예전 포인트 조정 (하루 300P, 관리자 설정 › 쿠폰): points held from before the server kept a 내역 (the device era had no
// daily cap) are allowed up to the daily cap (PET_DAILY_STUDY_POINTS) for each day the app study records show the student
// active then; what is above that is taken back once — from the points held (never below 0) and this month's coupon count —
// with a line in the 내역. A student with no records from then is left alone (nothing shows they went over). Students only;
// a look first (who and how much), then applied, never twice (petStates.legacyCapped).
import {FieldPath} from 'firebase-admin/firestore';
import {PET_STATES, petSummary, rollDay, seoulDay, takePoints, type ServerPetState} from './pet.js';
import {PET_DAILY_STUDY_POINTS} from '../../src/lib/petCatalog.js';
import {studentRealName} from './realNames.js';

const at = (v: any) => typeof v?.toMillis === 'function' ? v.toMillis() : Date.parse(String(v));
export const LEGACY_LABEL = '예전 포인트 조정 (하루 300P)';
/** One student's app study records are read to the end, 500 at a time, up to this; a student with more is held back
 *  (not adjusted: a part read could miss days and take too much). */
export const LEGACY_SESSION_LIMIT = 10_000;
/** One student: `legacy` (held, not explained by the 내역), `days` (days with app study records before the 내역 began),
 *  `allowed` (the daily cap for each of those days), `take` (above it, never more than held; 0 without records or once done). */
export function legacyAdjust(s: ServerPetState, sessions: any[], today: string) {
  const ledger = s.ledger || [], lines = ledger.reduce((n, x) => n + x.points, 0), legacy = Math.max(0, Math.floor(Number(s.points || 0) - lines));
  const since = ledger.map(x => x.day).sort()[0] || today;
  const days = new Set(sessions.map(x => seoulDay(at(x.createdAt))).filter(day => day < since)).size, allowed = days * PET_DAILY_STUDY_POINTS;
  const take = (s as any).legacyCapped || !days ? 0 : Math.min(Math.max(0, legacy - allowed), Math.max(0, Number(s.points || 0)));
  return {legacy, days, allowed, take};
}
function admin(actor: any) { if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN'); }
/** All the app study records of one student before `since`, page by page; `complete` false past `limit` (held back). */
async function sessionsOf(db: any, uid: string, since: string, limit = LEGACY_SESSION_LIMIT) {
  const out: any[] = []; let last: any = null, read = 0;
  for (;;) {
    let q = db.collection('studySessions').where('uid', '==', uid).orderBy(FieldPath.documentId()).limit(500); if (last) q = q.startAfter(last);
    const page = await q.get(); read += page.docs.length;
    for (const d of page.docs) { const x = d.data(); if (seoulDay(at(x.createdAt)) < since) out.push(x); }
    if (page.docs.length < 500) return {list: out, complete: true};
    last = page.docs[page.docs.length - 1];
    // at the limit: held back only when there really is a record past it
    if (read >= limit) return {list: out, complete: (await db.collection('studySessions').where('uid', '==', uid).orderBy(FieldPath.documentId()).startAfter(last).limit(1).get()).docs.length === 0};
  }
}
/** Only students holding points the 내역 does not explain are looked at closer (their records read one by one). */
async function students(db: any, now: number, limit = LEGACY_SESSION_LIMIT) {
  const today = seoulDay(now), out: {uid: string; name: string; held: number; legacy: number; days: number; allowed: number; take: number}[] = [], heldBack: string[] = [];
  for (const d of (await db.collection(PET_STATES).get()).docs) {
    const s = rollDay(d.data(), now) as ServerPetState;
    if ((s as any).legacyCapped || legacyAdjust(s, [], today).legacy <= 0) continue;
    const name = await studentRealName(db, d.id).catch(() => ''); if (!name) continue; // students only
    const since = (s.ledger || []).map(x => x.day).sort()[0] || today, read = await sessionsOf(db, d.id, since, limit);
    if (!read.complete) { heldBack.push(name); continue; }
    const r = legacyAdjust(s, read.list, today);
    if (r.take > 0) out.push({uid: d.id, name, held: Number(s.points || 0), ...r});
  }
  return {list: out.sort((a, b) => b.take - a.take), heldBack};
}
/** Who would be adjusted and by how much (the admin sees the names). */
export async function readLegacyPoints(db: any, actor: any, now = Date.now(), limit = LEGACY_SESSION_LIMIT) {
  admin(actor);
  const {list, heldBack} = await students(db, now, limit);
  return {students: list.map(({uid, ...r}) => r), total: list.reduce((n, r) => n + r.take, 0), heldBack};
}
/** Apply it: one transaction a student, counted again on the state read there (a second run takes nothing). */
export async function applyLegacyPoints(db: any, actor: any, now = Date.now(), limit = LEGACY_SESSION_LIMIT) {
  admin(actor);
  let count = 0, total = 0, failed = 0;
  const {list, heldBack} = await students(db, now, limit);
  for (const st of list) {
    try {
      const ref = db.collection(PET_STATES).doc(st.uid);
      const took = await db.runTransaction(async (tx: any) => {
        const snap = await tx.get(ref); if (!snap.exists) return 0;
        const s = rollDay(snap.data(), now) as ServerPetState, since = (s.ledger || []).map(x => x.day).sort()[0] || seoulDay(now);
        const read = await sessionsOf(db, st.uid, since, limit); if (!read.complete) return 0;
        const r = legacyAdjust(s, read.list, seoulDay(now));
        if (!r.take) return 0;
        const taken = takePoints(s, r.take, 'etc', LEGACY_LABEL, s.day);
        (s as any).legacyCapped = {at: now, took: taken, legacy: r.legacy, days: r.days, allowed: r.allowed};
        s.updatedAt = now; tx.set(ref, s); tx.set(db.collection('users').doc(st.uid), {petStats: petSummary(s)}, {merge: true});
        return taken;
      });
      if (took) { count += 1; total += took; }
    } catch { failed += 1; console.warn('LEGACY_POINTS_FAILED'); }
  }
  // the rankings show the new points on their next look
  await Promise.all(['current', 'month'].map(id => db.collection('petRankings').doc(id).set({builtAt: 0}, {merge: true}))).catch(() => undefined);
  return {students: count, total, failed, heldBack: heldBack.length};
}
