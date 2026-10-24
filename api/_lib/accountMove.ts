import { z } from 'zod';
import { createHash } from 'node:crypto';
import { forgetFirebaseSessions } from './firebaseSession.js';
import { certId } from './studyCerts.js';
import { PET_RANKINGS } from './petRanking.js';
import { MONTH_RANK_DOC } from './petMonthRanking.js';

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

/** What is under each account (미리 세어 보기). */
export async function previewAccountMove(db: any, actor: any, raw: unknown) {
  const { fromUid, toUid, from, to } = await accounts(db, actor, raw);
  const count = async (uid: string) => {
    const field = (name: string, f: string) => db.collection(name).where(f, '==', uid).get().then((q: any) => q.docs.length);
    const [sessions, words, attendance, attempts, certs, coupons, done, pet, tower] = await Promise.all([field('studySessions', 'uid'), field('wordProgress', 'uid'), field('attendance', 'studentId'),
      field('questionAttempts', 'uid'), field('studyCerts', 'uid'), field('petCoupons', 'uid'), db.collection('users').doc(uid).collection('assignmentCompletions').get().then((q: any) => q.docs.length),
      db.collection('petStates').doc(uid).get(), db.collection('petTowers').doc(uid).get()]);
    const p = pet.data(), best = Math.max(0, ...Object.values(tower.data()?.pets || {}).map((t: any) => Number(t?.best) || 0));
    return { sessions, words, attendance, attempts, certs, coupons, done, points: p ? Number(p.points) || 0 : null, pets: p ? (p.pets || []).length : 0, floor: best || null };
  };
  const [old, fresh] = await Promise.all([count(fromUid), count(toUid)]);
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
