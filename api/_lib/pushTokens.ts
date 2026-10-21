// 과제·보강 알림 1단계: the devices that turned 알림 on. One document per device token (the id is its hash, so the
// token itself never shows in a path); turning 알림 off, or a token FCM later rejects, removes it.
import crypto from 'node:crypto';
import {z} from 'zod';

export const PUSH_TOKENS = 'pushTokens';
export const pushTokenId = (token: string) => crypto.createHash('sha256').update(`push:${token}`).digest('hex').slice(0, 40);
const input = z.object({token: z.string().trim().min(20).max(4096), on: z.boolean()}).strict();

/** Save (on) or remove (off) this device's token for the signed-in account. A token another account saved before (a
 *  shared phone) moves to this account. */
export async function savePushToken(db: any, uid: string, body: unknown, now = Date.now()) {
  const v = input.parse(body), ref = db.collection(PUSH_TOKENS).doc(pushTokenId(v.token));
  if (!v.on) {
    const old = (await ref.get()).data();
    if (old && old.uid === uid) await ref.delete();
    return {on: false};
  }
  const user = (await db.collection('users').doc(uid).get()).data();
  if (!user) throw Error('USER_NOT_FOUND');
  await ref.set({uid, token: v.token, role: String(user.role || 'student'), updatedAt: now});
  return {on: true};
}
/** The saved tokens of one account (2단계 sends to these). */
export async function pushTokensOf(db: any, uid: string): Promise<string[]> {
  const snap = await db.collection(PUSH_TOKENS).where('uid', '==', uid).limit(20).get();
  return snap.docs.map((d: any) => String(d.data()?.token || '')).filter(Boolean);
}
