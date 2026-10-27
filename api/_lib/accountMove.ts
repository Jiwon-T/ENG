import { z } from 'zod';
import { createHash } from 'node:crypto';
import { forgetFirebaseSessions } from './firebaseSession.js';
import { certId } from './studyCerts.js';
import { PET_RANKINGS } from './petRanking.js';
import { MONTH_RANK_DOC } from './petMonthRanking.js';
import { displayName } from './petCoupon.js';
import { activePlan } from '../../src/lib/aiPlans.js';
import { petSummary } from './pet.js';

/**
 * 앱 계정 옮기기 (관리자 설정 › 앱 사용자): a student who could not sign in and made a new account. Everything the app keeps
 * under the old account (A) moves to the new one (B): 학습 기록 are merged with what B already has (B's own copy wins
 * where both have one), 펫·포인트·탑·원정대·방 are A's (B's starting pet goes), names other students' records keep for A
 * (원정대 파티, 명예의 전당, 이웃 방, 펫 이름) are rewritten, the student link moves to B, and A is unlinked and its
 * sign-in blocked. 수업 일지·리포트·성적 are keyed by the student, not the account, and stay as they are.
 *
 * Order matters: the pet (with its 이미 받은 수업 보상) reaches B before the link does, so no lesson is paid twice; A's own
 * docs are deleted last. A failed run can be run again: it starts from what is still under A.
 */
function admin(actor: any) { if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN'); }
const input = z.object({ fromUid: z.string().min(1).max(128), toUid: z.string().min(1).max(128) }).strict();

// whole docs whose id is the account: A's replace B's
const OWN_DOCS = ['petStates', 'petTowers', 'petExpeditions', 'petGames', 'petGuild', 'petRooms', 'aiPasses', 'evaluations'] as const;
// docs found by a field: only the field changes
const BY_FIELD: [string, string][] = [['studySessions', 'uid'], ['assignments', 'studentUid'], ['matchLeaderboard', 'uid'], ['questionSets', 'uid'], ['petRoomCodes', 'uid']];
// docs whose id starts with the account: made again under B (keepOld: A's wins over one B already has)
const PREFIXED: { name: string; field: string; sep: string; keepOld?: boolean }[] = [
  { name: 'wordProgress', field: 'uid', sep: '_' }, { name: 'attendance', field: 'studentId', sep: '_' }, { name: 'passageViews', field: 'uid', sep: '_' },
  { name: 'workbookHistory', field: 'ownerUid', sep: ':' }, { name: 'petCoupons', field: 'uid', sep: '_', keepOld: true },
];
const attemptKeyId = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 32);

/** Every string equal to A (or 'A:…', the 펫 이름 owner slots) and every key equal to A, rewritten to B; Timestamps and other
 *  non-plain values are left as they are. */
export function swapUid(value: any, from: string, to: string): any {
  if (typeof value === 'string') return value === from ? to : value.startsWith(from + ':') ? to + value.slice(from.length) : value;
  if (Array.isArray(value)) return value.map(v => swapUid(v, from, to));
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype)
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k === from ? to : k, swapUid(v, from, to)]));
  return value;
}
const mentions = (value: any, uid: string): boolean => JSON.stringify(swapUid(value, uid, '\u0000')) !== JSON.stringify(value);

/** Writes in chunks (one transaction each, under Firestore's 500). */
function writer(db: any) {
  let ops: [string, any, any?][] = [];
  const flush = async () => { const chunk = ops; ops = []; if (!chunk.length) return; await db.runTransaction(async (tx: any) => { for (const [kind, ref, data] of chunk) kind === 'set' ? tx.set(ref, data) : tx.delete(ref); }); };
  return {
    set: async (ref: any, data: any) => { ops.push(['set', ref, data]); if (ops.length >= 400) await flush(); },
    delete: async (ref: any) => { ops.push(['delete', ref]); if (ops.length >= 400) await flush(); },
    flush,
  };
}

async function accounts(db: any, actor: any, raw: unknown) {
  admin(actor);
  const { fromUid, toUid } = input.parse(raw);
  if (fromUid === toUid) throw Error('ACCOUNT_MOVE_SAME');
  const [a, b, bAccess] = await Promise.all([db.collection('users').doc(fromUid).get(), db.collection('users').doc(toUid).get(), db.collection('teacherWorkspaceAccess').doc(toUid).get()]);
  const from = a.data(), to = b.data();
  if (!from || !to) throw Error('USER_NOT_FOUND');
  if (from.role !== 'student' || to.role !== 'student' || toUid === process.env.ADMIN_UID || (bAccess.exists && !bAccess.data()?.disabled)) throw Error('INVALID_ROLE');
  if (!from.notionStudentKey) throw Error('ACCOUNT_MOVE_NOT_LINKED');
  if (to.notionStudentKey) throw Error('ACCOUNT_MOVE_TARGET_LINKED');
  return { fromUid, toUid, from, to, studentKey: String(from.notionStudentKey) };
}

/** What is under one account, counted (미리 세어 보기). */
async function countUnder(db: any, uid: string) {
  const field = (name: string, f: string) => db.collection(name).where(f, '==', uid).get().then((q: any) => q.docs.length);
  const [sessions, words, attendance, attempts, certs, coupons, done, pet, tower] = await Promise.all([field('studySessions', 'uid'), field('wordProgress', 'uid'), field('attendance', 'studentId'),
    field('questionAttempts', 'uid'), field('studyCerts', 'uid'), field('petCoupons', 'uid'), db.collection('users').doc(uid).collection('assignmentCompletions').get().then((q: any) => q.docs.length),
    db.collection('petStates').doc(uid).get(), db.collection('petTowers').doc(uid).get()]);
  const [passages, workbooks] = await Promise.all([field('passageViews', 'uid'), field('workbookHistory', 'ownerUid')]);
  const p = pet.data(), best = Math.max(0, ...Object.values(tower.data()?.pets || {}).map((t: any) => Number(t?.best) || 0));
  return { sessions, words, attendance, attempts, certs, coupons, done, passages, workbooks, points: p ? Number(p.points) || 0 : null, pets: p ? (p.pets || []).length : 0, floor: best || null };
}

/** What is under each account (미리 세어 보기). */
export async function previewAccountMove(db: any, actor: any, raw: unknown) {
  const { fromUid, toUid, from, to } = await accounts(db, actor, raw);
  const [old, fresh] = await Promise.all([countUnder(db, fromUid), countUnder(db, toUid)]);
  const who = (u: any) => ({ name: String(u.alias || u.name || '').slice(0, 80), email: String(u.email || '').slice(0, 120) });
  return { from: { uid: fromUid, ...who(from), ...old }, to: { uid: toUid, ...who(to), ...fresh } };
}

/** 옮기기. `auth`: Firebase Admin auth, to block A's sign-in (a failure there is reported, the move still stands). */
export async function moveStudentAccount(db: any, actor: any, raw: unknown, auth: any, now = Date.now()) {
  const { fromUid: A, toUid: B, from, studentKey } = await accounts(db, actor, raw);
  const w = writer(db), moved: Record<string, number> = {};
  const add = (k: string, n = 1) => { moved[k] = (moved[k] || 0) + n; };

  // 1) 펫·포인트·탑·원정대·방 (with the lessons already paid) first: A's whole docs over B's
  for (const name of OWN_DOCS) { const doc = (await db.collection(name).doc(A).get()).data(); if (doc) { await w.set(db.collection(name).doc(B), swapUid(doc, A, B)); add(name); } }
  // 2) 학습 기록 found by a field
  for (const [name, field] of BY_FIELD) for (const d of (await db.collection(name).where(field, '==', A).get()).docs) { await w.set(d.ref, { ...d.data(), [field]: B }); add(name); }
  // 3) ids that start with the account
  for (const p of PREFIXED) for (const d of (await db.collection(p.name).where(p.field, '==', A).get()).docs) {
    if (!d.id.startsWith(A + p.sep)) continue;
    const target = db.collection(p.name).doc(B + d.id.slice(A.length));
    if (p.keepOld || !(await target.get()).exists) await w.set(target, { ...d.data(), [p.field]: B });
    await w.delete(d.ref); add(p.name);
  }
  // 4) ids made from the account (문제 풀이, 공부 인증): worked out again for B
  for (const d of (await db.collection('questionAttempts').where('uid', '==', A).get()).docs) {
    const x = d.data(), id = attemptKeyId(x.kind === 'assigned' ? `asg:${B}:${x.assignmentId}` : `set:${B}:${x.setId}`);
    if (!(await db.collection('questionAttempts').doc(id).get()).exists) await w.set(db.collection('questionAttempts').doc(id), { ...x, id, uid: B });
    await w.delete(d.ref); add('questionAttempts');
  }
  const certIds = new Map<string, string>();
  for (const d of (await db.collection('studyCerts').where('uid', '==', A).get()).docs) {
    const x = d.data(), id = certId(B, x.kind, x.ref, x.round || 0, x.studentKey || ''); certIds.set(d.id, id);
    await w.set(db.collection('studyCerts').doc(id), { ...x, id, uid: B }); await w.delete(d.ref); add('studyCerts');
  }
  for (const d of (await db.collection('studyCertPhotos').where('uid', '==', A).get()).docs) {
    const id = certIds.get(d.id); if (id) await w.set(db.collection('studyCertPhotos').doc(id), { ...d.data(), uid: B });
    await w.delete(d.ref);
  }
  // 5) 숙제 완료 표시 (under the account's own doc)
  for (const d of (await db.collection('users').doc(A).collection('assignmentCompletions').get()).docs) {
    const target = db.collection('users').doc(B).collection('assignmentCompletions').doc(d.id);
    if (!(await target.get()).exists) await w.set(target, d.data());
    await w.delete(d.ref); add('assignmentCompletions');
  }
  // 6) what other students' records keep for A
  const guild = (await db.collection('petGuild').doc(A).get()).data();
  const partyIds = [...new Set(Object.values(guild?.parties || {}).map(String))];
  for (const id of partyIds) { const doc = (await db.collection('petParties').doc(id).get()).data(); if (doc && mentions(doc, A)) { await w.set(db.collection('petParties').doc(id), swapUid(doc, A, B)); add('petParties'); } }
  for (const [name, query] of [['petRooms', db.collection('petRooms').where('neighbors', 'array-contains', A)], ['questionAssignments', db.collection('questionAssignments').where('uids', 'array-contains', A)], ['petNames', db.collection('petNames')], ['petTowerHall', db.collection('petTowerHall')]] as const)
    for (const d of (await query.get()).docs) { if (d.id === A) continue; const doc = d.data(); if (mentions(doc, A)) { await w.set(d.ref, swapUid(doc, A, B)); add(name); } }
  await w.flush();

  // 7) the link: every mapping of A now B; B named on the student, A let go
  const at = new Date(now).toISOString();
  for (const d of (await db.collection('notionStudentMappings').where('firebaseUid', '==', A).get()).docs) await w.set(d.ref, { ...d.data(), firebaseUid: B, linkedByAdminUid: actor.uid, linkedAt: at, updatedAt: at });
  const fresh = (await db.collection('users').doc(B).get()).data();
  await w.set(db.collection('users').doc(B), { ...fresh, notionStudentKey: studentKey, ...(from.petStats ? { petStats: from.petStats } : {}), updatedAt: at });
  await w.set(db.collection('users').doc(A), { ...from, notionStudentKey: null, movedTo: B, movedAt: now, updatedAt: at });
  for (const id of ['current', MONTH_RANK_DOC]) { const old = (await db.collection(PET_RANKINGS).doc(id).get()).data(); if (old) await w.set(db.collection(PET_RANKINGS).doc(id), { ...old, builtAt: 0 }); }
  await w.set(db.collection('accountMoves').doc(`${now}_${A.slice(0, 8)}`), { fromUid: A, toUid: B, studentKey, by: actor.uid, at: now, moved });
  await w.flush();
  // 8) A's own copies go last (they were copied in 1)
  for (const name of OWN_DOCS) { const ref = db.collection(name).doc(A); if ((await ref.get()).exists) await w.delete(ref); }
  await w.flush();

  // 9) A cannot sign in any more
  let signInBlocked = false;
  try { await auth.updateUser(A, { disabled: true }); await auth.revokeRefreshTokens(A); forgetFirebaseSessions(A); signInBlocked = true; } catch { /* reported */ }
  if (signInBlocked) { const u = (await db.collection('users').doc(A).get()).data(); if (u) await db.runTransaction(async (tx: any) => { tx.set(db.collection('users').doc(A), { ...u, signInBlocked: true }); }); }
  return { moved, signInBlocked, toUid: B };
}

/**
 * 기존 계정으로 옮기기 (관리자 설정 › 앱 사용자): a student who used the app on an account of their own (U, not linked)
 * before being linked on another one (L). U's 학습 기록 join L's (L's own copy wins where both have one: L is the
 * academy's account); U's 펫·탑·원정대·방 go, and only U's points are added to L's pet (not as points earned: the 포인트
 * 내역 and this month's coupon stay as they were) — when L has no pet yet, U's pet comes over whole. A pet pass U bought
 * comes over when L has none in force. L keeps its link; U is marked moved (with L's email, masked, for the notice U
 *  gets when it signs in) and can still sign in. A failed run can be
 * run again (it starts from what is still under U; the points are added in the same write that deletes U's pet, so once).
 */
async function mergeAccounts(db: any, actor: any, raw: unknown) {
  admin(actor);
  const { fromUid, toUid } = input.parse(raw);
  if (fromUid === toUid) throw Error('ACCOUNT_MOVE_SAME');
  const [a, b, aAccess, bAccess] = await Promise.all([db.collection('users').doc(fromUid).get(), db.collection('users').doc(toUid).get(), db.collection('teacherWorkspaceAccess').doc(fromUid).get(), db.collection('teacherWorkspaceAccess').doc(toUid).get()]);
  const from = a.data(), to = b.data();
  if (!from || !to) throw Error('USER_NOT_FOUND');
  const staff = (x: any) => x.exists && !x.data()?.disabled;
  if (from.role !== 'student' || to.role !== 'student' || [fromUid, toUid].includes(String(process.env.ADMIN_UID)) || staff(aAccess) || staff(bAccess)) throw Error('INVALID_ROLE');
  if (from.notionStudentKey) throw Error('ACCOUNT_MERGE_FROM_LINKED');
  if (!to.notionStudentKey) throw Error('ACCOUNT_MERGE_TARGET_NOT_LINKED');
  return { fromUid, toUid, from, to, studentKey: String(to.notionStudentKey) };
}

/** 기존 계정으로 옮기기, 미리 세어 보기 (with the student the target is linked to). */
export async function previewAccountMerge(db: any, actor: any, raw: unknown) {
  const { fromUid, toUid, from, to, studentKey } = await mergeAccounts(db, actor, raw);
  const [old, fresh, student] = await Promise.all([countUnder(db, fromUid), countUnder(db, toUid), displayName(db, studentKey).catch(() => '')]);
  const who = (u: any) => ({ name: String(u.alias || u.name || '').slice(0, 80), email: String(u.email || '').slice(0, 120) });
  return { from: { uid: fromUid, ...who(from), ...old }, to: { uid: toUid, ...who(to), ...fresh, student: String(student || '').slice(0, 40) } };
}

/** 'you***@gmail.com': enough for the student to know the account, not the whole address. */
export const maskedEmail = (email: unknown) => { const [local = '', domain = ''] = String(email || '').split('@'); return local && domain ? `${local.slice(0, 3)}***@${domain}` : ''; };
/** 기존 계정으로 옮기기. U can still sign in afterwards (it is told where its records went). */
export async function mergeIntoLinkedAccount(db: any, actor: any, raw: unknown, _auth?: any, now = Date.now()) {
  const { fromUid: U, toUid: L, from, to } = await mergeAccounts(db, actor, raw);
  const w = writer(db), moved: Record<string, number> = {};
  const add = (k: string, n = 1) => { moved[k] = (moved[k] || 0) + n; };

  // 1) 학습 기록 found by a field (U's room code goes with its room)
  for (const [name, field] of BY_FIELD) for (const d of (await db.collection(name).where(field, '==', U).get()).docs) {
    if (name === 'petRoomCodes') { await w.delete(d.ref); continue; }
    await w.set(d.ref, { ...d.data(), [field]: L }); add(name);
  }
  // 2) ids that start with the account: L's own copy wins
  for (const p of PREFIXED) for (const d of (await db.collection(p.name).where(p.field, '==', U).get()).docs) {
    if (!d.id.startsWith(U + p.sep)) continue;
    const target = db.collection(p.name).doc(L + d.id.slice(U.length));
    if (!(await target.get()).exists) await w.set(target, { ...d.data(), [p.field]: L });
    await w.delete(d.ref); add(p.name);
  }
  // 3) ids made from the account (문제 풀이, 공부 인증): worked out again for L
  for (const d of (await db.collection('questionAttempts').where('uid', '==', U).get()).docs) {
    const x = d.data(), id = attemptKeyId(x.kind === 'assigned' ? `asg:${L}:${x.assignmentId}` : `set:${L}:${x.setId}`);
    if (!(await db.collection('questionAttempts').doc(id).get()).exists) await w.set(db.collection('questionAttempts').doc(id), { ...x, id, uid: L });
    await w.delete(d.ref); add('questionAttempts');
  }
  const certIds = new Map<string, string>();
  for (const d of (await db.collection('studyCerts').where('uid', '==', U).get()).docs) {
    const x = d.data(), id = certId(L, x.kind, x.ref, x.round || 0, x.studentKey || ''); certIds.set(d.id, id);
    if (!(await db.collection('studyCerts').doc(id).get()).exists) await w.set(db.collection('studyCerts').doc(id), { ...x, id, uid: L });
    await w.delete(d.ref); add('studyCerts');
  }
  for (const d of (await db.collection('studyCertPhotos').where('uid', '==', U).get()).docs) {
    const id = certIds.get(d.id); if (id && !(await db.collection('studyCertPhotos').doc(id).get()).exists) await w.set(db.collection('studyCertPhotos').doc(id), { ...d.data(), uid: L });
    await w.delete(d.ref);
  }
  // 4) 숙제 완료 표시
  for (const d of (await db.collection('users').doc(U).collection('assignmentCompletions').get()).docs) {
    const target = db.collection('users').doc(L).collection('assignmentCompletions').doc(d.id);
    if (!(await target.get()).exists) await w.set(target, d.data());
    await w.delete(d.ref); add('assignmentCompletions');
  }
  // 5) a pet pass U bought, when L has none in force
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(now));
  const [uPass, lPass] = await Promise.all([db.collection('aiPasses').doc(U).get(), db.collection('aiPasses').doc(L).get()]).then(r => r.map((x: any) => x.data()));
  if (uPass && activePlan(uPass, today) && !(lPass && activePlan(lPass, today))) { await w.set(db.collection('aiPasses').doc(L), swapUid(uPass, U, L)); add('aiPasses'); }
  await w.flush();

  // 6) the pet: U's points onto L's pet, in one write with U's pet docs going (so the points are added once)
  let points = 0;
  await db.runTransaction(async (tx: any) => {
    const uPet = (await tx.get(db.collection('petStates').doc(U))).data(), lPet = (await tx.get(db.collection('petStates').doc(L))).data(), lUser = (await tx.get(db.collection('users').doc(L))).data();
    const own: [string, any, boolean][] = [];
    for (const n of OWN_DOCS) if (n !== 'petStates') own.push([n, (await tx.get(db.collection(n).doc(U))).data(), (await tx.get(db.collection(n).doc(L))).exists]);
    if (uPet && !lPet) {
      // L has no pet yet: U's comes over whole (its tower, map, room and name with it)
      tx.set(db.collection('petStates').doc(L), swapUid(uPet, U, L)); add('petStates');
      if (lUser) tx.set(db.collection('users').doc(L), { ...lUser, petStats: petSummary(uPet) });
      for (const [n, doc, there] of own) if (doc && !there && n !== 'aiPasses' && n !== 'evaluations') { tx.set(db.collection(n).doc(L), swapUid(doc, U, L)); add(n); }
    } else if (uPet && lPet) {
      points = Math.max(0, Math.floor(Number(uPet.points) || 0));
      if (points) { const next = { ...lPet, points: (Number(lPet.points) || 0) + points, updatedAt: now }; tx.set(db.collection('petStates').doc(L), next); if (lUser) tx.set(db.collection('users').doc(L), { ...lUser, petStats: petSummary(next) }); }
    }
    if (uPet) tx.delete(db.collection('petStates').doc(U));
    for (const [n, doc] of own) if (doc) tx.delete(db.collection(n).doc(U));
  });

  // 7) U let go: marked moved; L keeps its link; the rankings are made again
  const at = new Date(now).toISOString();
  const latest = (await db.collection('users').doc(U).get()).data() || from;
  await w.set(db.collection('users').doc(U), { ...latest, movedTo: L, movedToEmail: maskedEmail(to.email), movedAt: now, petStats: null, updatedAt: at });
  for (const id of ['current', MONTH_RANK_DOC]) { const old = (await db.collection(PET_RANKINGS).doc(id).get()).data(); if (old) await w.set(db.collection(PET_RANKINGS).doc(id), { ...old, builtAt: 0 }); }
  await w.set(db.collection('accountMoves').doc(`${now}_${U.slice(0, 8)}`), { kind: 'merge', fromUid: U, toUid: L, by: actor.uid, at: now, moved, points });
  await w.flush();
  return { moved, points, toUid: L };
}
