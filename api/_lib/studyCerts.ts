// 선생님 인증 (studyCerts/{id}): a linked student asks their teacher to check their own study — a 워크북 they made and
// did (printed), a 지문 분석지 read again (회독, one a day, up to 3 a passage), a 변형 문제 set they made and solved — with
// a photo or without. The teacher (the same reach as the 학습 리포트) gives a grade; the points are paid then, outside
// the daily study cap (the teacher checked it), at most CERT_RULES.dailyPaid a day. 다시 해 오기 pays nothing and may be
// asked again. A photo (studyCertPhotos/{id}) is kept only until the teacher decides.
import { createHash } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { CERT_GRADES, CERT_RULES, workbookSig, type CertGrade, type CertKind, type CertView } from '../../src/lib/studyCert.js';
import { PET_STATES, addXP, earnPoints, initialPetState, petSummary, rollDay, seoulDay, type ServerPetState } from './pet.js';
import { QUESTION_ATTEMPTS, attemptId, questionReward } from './questionAttempts.js';
import { PASSAGES, canSeePassage } from './passage.js';
import { WORKBOOK_HISTORY } from './teacherWorkbook.js';
import { linkedStudentAccount } from './teacherOnlineLearning.js';
import { readStudentMapping } from './studentIdentity.js';
import { normalizeNotionPageId as uuid } from './notionPageId.js';

/** Who checks a student's requests: the admin, and the teachers who have the student in any subject (a principal has every
 *  student of the academy). The student's account must still be linked, and only requests made for that student count
 *  (`studentKey` saved with each: an account linked to another student later never brings its old requests along). */
const sees = (actor: any, key: string) => Boolean(actor?.admin || (actor?.scopes || []).some((s: any) => s?.studentKey === key));
async function reachableUid(db: any, actor: any, keyInput: unknown) {
  let key: string; try { key = uuid(String(keyInput || '')); } catch { throw Error('INVALID_INPUT'); }
  if (!sees(actor, key)) throw Error('FORBIDDEN');
  const link = await linkedStudentAccount(db, key, { readStudentMapping });
  if ('reason' in link) throw Error('FORBIDDEN');
  return { uid: link.uid as string, key };
}
/** The request is this student's (their account, and made while linked to them). */
const ofStudent = (x: any, who: { uid: string; key: string }) => Boolean(x && x.uid === who.uid && x.studentKey === who.key);

export const STUDY_CERTS = 'studyCerts', CERT_PHOTOS = 'studyCertPhotos';
const KINDS: CertKind[] = ['workbook', 'reading', 'questions'];
/** One request: the account, the student it was linked to then (a later link to another student starts afresh), the
 *  thing and the 회독 round. */
export const certId = (uid: string, kind: CertKind, ref: string, round = 0, studentKey = '') => createHash('sha256').update(`${kind}:${uid}:${studentKey}:${ref}:${round}`).digest('hex').slice(0, 32);
const view = (x: any): CertView => ({ id: x.id, kind: x.kind, ref: x.ref, round: x.round || 0, title: x.title || '', status: x.status, grade: x.grade ?? null, points: x.points || 0, photo: Boolean(x.photo), requestedAt: x.requestedAt, decidedAt: x.decidedAt ?? null });
const order = (a: any, b: any) => Number(b.status === 'pending') - Number(a.status === 'pending') || (b.requestedAt || 0) - (a.requestedAt || 0);

/** What the request is about (it must be the student's own) and its title; for 회독, which round comes next. */
async function subject(db: any, uid: string, studentKey: string, kind: CertKind, ref: string, now: number) {
  if (kind === 'workbook') {
    // ref = passage key + the blanks' code: one of the versions this account saved (other blanks = another workbook)
    const cut = ref.lastIndexOf('-'), key = ref.slice(0, cut), sig = ref.slice(cut + 1);
    const h = cut > 0 ? (await db.collection(WORKBOOK_HISTORY).doc(`${uid}:${key}`).get()).data() : null;
    const decode = (rows: unknown) => (Array.isArray(rows) ? rows : []).map(r => String(r || '').split(',').filter(Boolean).map(Number));
    const v = (Array.isArray(h?.versions) ? h.versions : []).find((x: any) => workbookSig(decode(x.blanks)) === sig);
    if (!v) throw Error('CERT_NOT_FOUND');
    return { title: `${v.title || h.title || '워크북'} (${v.version}판)`, round: 0 };
  }
  if (kind === 'questions') {
    const a = (await db.collection(QUESTION_ATTEMPTS).doc(attemptId(uid, ref)).get()).data();
    if (!a || a.uid !== uid || a.kind !== 'self' || a.status !== 'submitted') throw Error('CERT_NOT_FOUND');
    return { title: a.title || '변형 문제', round: 0 };
  }
  const p = (await db.collection(PASSAGES).doc(ref).get()).data();
  if (!p || !(await canSeePassage(db, { uid, staff: false } as any, { ...p, id: ref }))) throw Error('CERT_NOT_FOUND');
  const read = (id: string) => db.collection(STUDY_CERTS).doc(id).get().then((s: any) => s.data());
  const rounds = await Promise.all(Array.from({ length: CERT_RULES.reading.rounds }, (_, i) => read(certId(uid, 'reading', ref, i + 1, studentKey))));
  const next = rounds.findIndex(d => d?.status !== 'approved');
  if (next < 0) throw Error('CERT_DONE');
  // one 회독 a day: the round before was checked (or asked) today → tomorrow
  const before = rounds[next - 1];
  if (before && seoulDay(before.decidedAt || before.requestedAt) === seoulDay(now)) throw Error('CERT_ONE_A_DAY');
  return { title: p.title || String(p.sentences?.[0] || '지문').slice(0, 40), round: next + 1 };
}

/** The student asks (again, after 다시 해 오기). */
export async function requestStudyCert(db: any, uid: string, input: any, now = Date.now()) {
  const kind = input?.kind as CertKind, ref = String(input?.ref || '');
  if (!KINDS.includes(kind) || !/^[A-Za-z0-9_-]{4,64}$/.test(ref)) throw Error('INVALID_INPUT');
  const photo = input?.photo == null || input.photo === '' ? null : String(input.photo);
  if (photo && (photo.length > CERT_RULES.photoChars || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photo))) throw Error('CERT_PHOTO_BAD');
  const user = (await db.collection('users').doc(uid).get()).data();
  if (!user?.notionStudentKey) throw Error('CERT_NOT_LINKED');
  let studentKey: string; try { studentKey = uuid(user.notionStudentKey); } catch { throw Error('CERT_NOT_LINKED'); }
  const { title, round } = await subject(db, uid, studentKey, kind, ref, now);
  const id = certId(uid, kind, ref, round, studentKey), ref_ = db.collection(STUDY_CERTS).doc(id), photoRef = db.collection(CERT_PHOTOS).doc(id);
  return db.runTransaction(async (tx: any) => {
    const [old, waiting] = await Promise.all([tx.get(ref_).then((s: any) => s.data()), tx.get(db.collection(STUDY_CERTS).where('uid', '==', uid).where('status', '==', 'pending').limit(CERT_RULES.maxPending))]);
    if (old?.status === 'pending') throw Error('CERT_PENDING');
    if (old?.status === 'approved') throw Error('CERT_DONE');
    if (waiting.docs.length >= CERT_RULES.maxPending) throw Error('CERT_TOO_MANY');
    const doc = { id, uid, studentKey, kind, ref, round, title: title.slice(0, 80), status: 'pending', grade: null, points: 0, photo: Boolean(photo), requestedAt: now, decidedAt: null, decidedBy: null, tries: (old?.tries || 0) + 1 };
    tx.set(ref_, doc);
    if (photo) tx.set(photoRef, { uid, data: photo, at: now }); else if (old?.photo) tx.delete(photoRef);
    return { cert: view(doc) };
  });
}

/** The student's own requests (for the buttons): all, or those about one thing; `linked`: may ask (a student linked to
 *  the academy), `student`: a student account (one not linked yet is told how). */
export async function myStudyCerts(db: any, uid: string, input: any = {}) {
  const [snap, user] = await Promise.all([db.collection(STUDY_CERTS).where('uid', '==', uid).limit(300).get(), db.collection('users').doc(uid).get().then((s: any) => s.data())]);
  const kind = input?.kind ? String(input.kind) : '', ref = input?.ref ? String(input.ref) : '';
  let current = ''; try { current = user?.notionStudentKey ? uuid(user.notionStudentKey) : ''; } catch { /* not linked */ }
  // only the requests made for the student this account is linked to now
  return { linked: Boolean(current), student: user?.role === 'student', certs: snap.docs.map((d: any) => d.data()).filter((x: any) => x.uid === uid && x.studentKey === current && (!kind || x.kind === kind) && (!ref || x.ref === ref)).sort(order).map(view) };
}

/** 학습 리포트 › 인증 요청 (선생님): waiting ones first, then the latest decided. */
export async function loadStudentCerts(db: any, actor: any, key: unknown) {
  let who: { uid: string; key: string }; try { who = await reachableUid(db, actor, key); } catch { return { certs: [], reason: 'not-reachable' }; }
  const uid = who.uid;
  const snap = await db.collection(STUDY_CERTS).where('uid', '==', uid).limit(300).get();
  return { certs: snap.docs.map((d: any) => d.data()).filter((x: any) => ofStudent(x, who)).sort(order).slice(0, 30).map(view) };
}

/** 인증 요청 모아 보기: every waiting request of the students this teacher sees (oldest first), with the student's name.
 *  A request whose student is not this teacher's, or whose account is no longer linked, is left out. */
export async function loadCertInbox(db: any, actor: any, afterInput?: unknown) {
  // every waiting request, a page at a time (by id: no extra index), so none is missed however many are waiting
  // up to 6,000 from `after` (a request id); `next`: where to go on when there are more (the screen keeps reading)
  const docs: any[] = [], PAGE = 300, PAGES = 20; let next: string | null = null;
  let last: any = typeof afterInput === 'string' && /^[a-f0-9]{32}$/.test(afterInput) ? afterInput : null;
  for (let n = 0; ; n++) {
    if (n === PAGES) { next = docs[docs.length - 1].id; break; }
    let q = db.collection(STUDY_CERTS).where('status', '==', 'pending').orderBy(FieldPath.documentId()).limit(PAGE);
    if (last) q = q.startAfter(last);
    const page = await q.get(); docs.push(...page.docs);
    if (page.docs.length < PAGE) break; last = page.docs[page.docs.length - 1];
  }
  const mine = docs.map((d: any) => d.data()).filter((x: any) => x.status === 'pending' && typeof x.studentKey === 'string' && sees(actor, x.studentKey));
  const keys: string[] = [...new Set<string>(mine.map((x: any) => String(x.studentKey)))];
  // the same link check as one student's view (the mapping and the account pointing at each other)
  const links = new Map(await Promise.all(keys.map(async k => [k, await linkedStudentAccount(db, k, { readStudentMapping }).catch(() => ({ reason: 'error' }))] as const)));
  const maps = new Map(keys.map(k => { const l: any = links.get(k); return [k, 'reason' in l ? null : { firebaseUid: l.uid, studentDisplayName: l.mapping?.studentDisplayName }] as const; }));
  const linked = mine.filter((x: any) => maps.get(x.studentKey)?.firebaseUid === x.uid).sort((a: any, b: any) => a.requestedAt - b.requestedAt);
  return { next, certs: linked
    .map((x: any) => ({ ...view(x), studentKey: x.studentKey, studentName: String(maps.get(x.studentKey)?.studentDisplayName || '학생').slice(0, 40) })) };
}

/** The photo of a waiting request (the teacher opens it). */
export async function studyCertPhoto(db: any, actor: any, key: unknown, idInput: unknown) {
  const who = await reachableUid(db, actor, key), uid = who.uid, id = String(idInput || '').slice(0, 64);
  const [cert, photo] = await Promise.all([db.collection(STUDY_CERTS).doc(id).get(), db.collection(CERT_PHOTOS).doc(id).get()]);
  if (!ofStudent(cert.data(), who) || photo.data()?.uid !== uid) throw Error('CERT_NOT_FOUND');
  return { photo: String(photo.data().data) };
}

/** The teacher's grade: points (outside the study cap, a few a day) or 다시 해 오기. Once a request; the photo goes. */
export async function decideStudyCert(db: any, actor: any, input: any, now = Date.now()) {
  const who = await reachableUid(db, actor, input?.studentKey), uid = who.uid, id = String(input?.id || '').slice(0, 64), grade = input?.grade as CertGrade;
  const ref = db.collection(STUDY_CERTS).doc(id), photoRef = db.collection(CERT_PHOTOS).doc(id);
  const petRef = db.collection(PET_STATES).doc(uid), userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (tx: any) => {
    const [certSnap, petSnap, userSnap] = await Promise.all([tx.get(ref), tx.get(petRef), tx.get(userRef)]);
    const x = certSnap.data();
    if (!ofStudent(x, who)) throw Error('CERT_NOT_FOUND');
    if (x.status !== 'pending') throw Error('CERT_DECIDED');
    if (!CERT_GRADES[x.kind as CertKind]?.some(g => g.grade === grade)) throw Error('INVALID_INPUT');
    const decided = { ...x, grade, decidedAt: now, decidedBy: actor.uid, photo: false };
    if (grade === 'redo') {
      const out = { ...decided, status: 'redo', points: 0 };
      tx.set(ref, out); if (x.photo) tx.delete(photoRef);
      return { cert: view(out) };
    }
    let reward: { points: number; xp: number };
    if (x.kind === 'workbook') reward = CERT_RULES.workbook[grade as '최상' | '상' | '중'];
    else if (x.kind === 'reading') reward = CERT_RULES.reading;
    else {
      const a = (await tx.get(db.collection(QUESTION_ATTEMPTS).doc(attemptId(uid, x.ref)))).data();
      if (!a?.score) throw Error('CERT_NOT_FOUND');
      reward = questionReward(a.score.correct, a.score.total, false);
    }
    const s: ServerPetState = rollDay(petSnap.exists ? petSnap.data() : initialPetState(now, userSnap.data()?.petStats), now);
    if ((s.today.certs || 0) >= CERT_RULES.dailyPaid) throw Error('CERT_DAILY_LIMIT');
    earnPoints(s, reward.points); s.points += reward.points; addXP(s, reward.xp);
    s.today.certs = (s.today.certs || 0) + 1; s.updatedAt = now;
    const out = { ...decided, status: 'approved', points: reward.points };
    tx.set(petRef, s);
    if (userSnap.exists) tx.set(userRef, { petStats: petSummary(s) }, { merge: true });
    tx.set(ref, out); if (x.photo) tx.delete(photoRef);
    return { cert: view(out) };
  });
}
