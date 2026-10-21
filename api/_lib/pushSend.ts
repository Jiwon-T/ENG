// 과제·보강 알림 2단계: sending. Data-only messages (sw.js shows them, with one tag per lesson so a later alert replaces the
// earlier one). Tokens FCM no longer knows are removed. A failed send never fails the 반영 or the morning job.
import { getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirebaseAdmin } from './firebaseAdmin.js';
import { readStudentMapping } from './studentIdentity.js';
import { PUSH_TOKENS, pushTokenId, pushTokensOf } from './pushTokens.js';
import { LESSON_PUSH_TITLE, lessonPushBody, type LessonPushKind } from '../../src/lib/lessonPush.js';

export interface PushMessage { title: string; body: string; tag: string; link?: string }
type Multicast = { sendEachForMulticast: (m: any) => Promise<{ successCount: number; responses: { success: boolean; error?: { code?: string } }[] }> };
const GONE = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);
function defaultMessaging(): Multicast | null {
  getFirebaseAdmin();
  const app = getApps().find(a => a.name.startsWith('jiwont-admin-'));
  return app ? getMessaging(app) as any : null;
}

/** Sends to these devices; returns how many got it. */
export async function sendToTokens(db: any, tokens: string[], msg: PushMessage, messaging: Multicast | null = defaultMessaging()): Promise<number> {
  if (!tokens.length || !messaging) return 0;
  const r = await messaging.sendEachForMulticast({ tokens, data: { title: msg.title, body: msg.body, tag: msg.tag, link: msg.link || '/' }, webpush: { headers: { Urgency: 'high', TTL: '86400' } } });
  await Promise.all(r.responses.map((x, i) => !x.success && GONE.has(String(x.error?.code)) ? db.collection(PUSH_TOKENS).doc(pushTokenId(tokens[i])).delete().catch(() => undefined) : null));
  return r.successCount;
}
/** The student's account for a studentKey (the linked app account), or ''. */
export async function studentUidOf(db: any, studentKey: string): Promise<string> {
  const mapping: any = await readStudentMapping(db, studentKey).catch(() => null);
  return String(mapping?.firebaseUid || '');
}
/** After a 반영 with '학생에게 알림 보내기': the student's devices get "새 과제가 있어요" (or 바뀌었어요 / 다시 확인해 주세요). */
export async function sendLessonPush(db: any, data: any, lessonId: string, kind: LessonPushKind, messaging?: Multicast | null): Promise<number> {
  if (!String(data?.assignment || '').trim()) return 0;
  const uid = await studentUidOf(db, data.studentKey);
  if (!uid) return 0;
  const tokens = await pushTokensOf(db, uid);
  return sendToTokens(db, tokens, { title: LESSON_PUSH_TITLE[kind], body: lessonPushBody(data), tag: `lesson-${lessonId}`, link: '/' }, messaging === undefined ? defaultMessaging() : messaging);
}

/** Every morning at 8 (KST): "오늘 보강이 있어요" to each student with a 보강 today that was published to them and not
 *  cancelled (studentSchedules). One alert per 보강 (its tag), to the student's linked account's devices. */
export async function sendMakeupMorning(db: any, today: string, messaging?: Multicast | null): Promise<{makeups: number; sent: number}> {
  const snap = await db.collection('studentSchedules').where('scheduleType', '==', '보강').get();
  const rows = snap.docs.map((d: any) => ({id: d.id, ...d.data()})).filter((r: any) => r.status === '예정' && String(r.startAt || '').slice(0, 10) === today && r.studentKey);
  const m = messaging === undefined ? defaultMessaging() : messaging;
  let sent = 0;
  for (const r of rows) {
    const uid = await studentUidOf(db, r.studentKey);
    if (!uid) continue;
    const time = `${String(r.startAt).slice(11, 16)}–${String(r.endAt || '').slice(11, 16)}`;
    sent += await sendToTokens(db, await pushTokensOf(db, uid), {title: '오늘 보강이 있어요', body: `${r.subject ? r.subject + ' · ' : ''}오늘 ${time}`, tag: `makeup-${r.id}`, link: '/'}, m).catch(() => 0);
  }
  return {makeups: rows.length, sent};
}
