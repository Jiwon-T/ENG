// 새 가입자 알림 (Make): Make calls GET /api/hooks/new-signups every few minutes with "Authorization: Bearer
// MAKE_HOOK_SECRET" and mails the result to the admin. Only accounts created since the previous call are returned
// (the first call just starts the clock). Nothing here sends mail; Make does, and the app works the same without it.
import {FieldPath, Timestamp} from 'firebase-admin/firestore';

export const SIGNUP_HOOK_STATE = 'makeHookState';
const PAGE = 50;
const msOf = (v: any) => v?.toMillis?.() ?? (typeof v?.seconds === 'number' ? v.seconds * 1000 : typeof v === 'number' ? v : typeof v === 'string' ? Date.parse(v) : NaN);
const seoulTime = (ms: number) => new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(new Date(ms));

/** Accounts created since the last call: name, email and sign-up time (Seoul), oldest first, 50 per call.
 *  The Firestore cursor is (createdAt, document id), so any number of accounts sharing one sign-up time are paged
 *  through. The range filter on createdAt also keeps out older accounts whose createdAt is not a Timestamp. */
export async function newSignups(db: any, now = Date.now(), stamp: (ms: number) => any = ms => Timestamp.fromMillis(ms), docId: any = FieldPath.documentId()) {
    const ref = db.collection(SIGNUP_HOOK_STATE).doc('new-signups');
    const state = (await ref.get()).data(), last = state?.lastAt, lastId = typeof state?.lastId === 'string' && state.lastId ? state.lastId : null;
    if (typeof last !== 'number') {
        await db.runTransaction(async (tx: any) => { tx.set(ref, {lastAt: now, lastId: null, checkedAt: now}); });
        return {first: true, count: 0, users: [] as any[], more: false, text: ''};
    }
    const ordered = (q: any) => q.orderBy('createdAt').orderBy(docId);
    const q = lastId
        ? await ordered(db.collection('users').where('createdAt', '>=', stamp(last))).startAfter(stamp(last), lastId).limit(PAGE).get()
        : await ordered(db.collection('users').where('createdAt', '>', stamp(last))).limit(PAGE).get();
    const rows = q.docs.map((d: any) => { const u = d.data() || {}; return {id: String(d.id), ms: msOf(u.createdAt), name: String(u.alias || u.name || '이름 없음').slice(0, 80), email: String(u.email || '').slice(0, 120)}; });
    const end = rows[rows.length - 1];
    if (end && Number.isFinite(end.ms)) await db.runTransaction(async (tx: any) => { tx.set(ref, {lastAt: end.ms, lastId: end.id, checkedAt: now}); });
    else await db.runTransaction(async (tx: any) => { tx.set(ref, {lastAt: last, lastId, checkedAt: now}); });
    const users = rows.filter((r: any) => Number.isFinite(r.ms)).map((r: any) => ({name: r.name, email: r.email, joinedAt: seoulTime(r.ms)}));
    // A ready-made mail body, so the Make scenario needs no formatting step.
    const text = users.length ? [`새로 가입한 계정 ${users.length}개`, ...users.map((u: any) => `· ${u.name} (${u.email}) — ${u.joinedAt}`), '', '관리자 설정 → 앱 사용자에서 권한을 주거나 연결해 주세요.'].join('\n') : '';
    return {first: false, count: users.length, users, more: q.docs.length === PAGE, text};
}
