// 과제·보강 알림 1단계: only in the installed app (home-screen PWA) — iPhones deliver web push only there, and the
// browser tab is not where students get them. 알림 켜기 asks the phone, gets this device's FCM token with the academy's
// web push key and saves it (/api/student/push-token); 끄기 removes it. Nothing shows while the key is not set yet.
import { getApp } from 'firebase/app';
import { safeFetchJson } from './safeFetchJson';

/** Firebase console › 프로젝트 설정 › 클라우드 메시징 › 웹 푸시 인증서: the public key pair's key (public, not a secret). */
export const WEB_PUSH_KEY = 'BJgko73uYjm_Sf5haJKJC9cKbSVSDxrNKOJRKbWrEk1DAUqXIH0gSABukU1RVV9QQn-u1DzExzLxZVhvLXzbtHE';

export type PushState = 'on' | 'off' | 'blocked' | 'unsupported';
const savedKey = (uid: string) => `push-on:${uid}`;
const dismissedKey = (uid: string) => `push-card-dismissed:${uid}`;
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string | null) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private mode: asked again next time */ } };

export function installedApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any).standalone);
}
export function pushSupported(key = WEB_PUSH_KEY): boolean {
  return Boolean(key) && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
/** What this device shows for the signed-in account. */
export function pushState(uid: string, key = WEB_PUSH_KEY, browser = false): PushState {
  if ((!browser && !installedApp()) || !pushSupported(key)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && read(savedKey(uid)) ? 'on' : 'off';
}
export const pushCardDismissed = (uid: string) => Boolean(read(dismissedKey(uid)));
export const dismissPushCard = (uid: string) => write(dismissedKey(uid), '1');

async function deviceToken(key: string) {
  const { getMessaging, getToken } = await import('firebase/messaging');
  const registration = await navigator.serviceWorker.ready;
  return getToken(getMessaging(getApp()), { vapidKey: key, serviceWorkerRegistration: registration });
}
async function send(idToken: string, token: string, on: boolean) {
  const r = await safeFetchJson<any>('/api/student/push-token', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ token, on }) });
  if (!r.ok) throw new Error(r.data?.message || '알림 설정을 저장하지 못했어요. 잠시 후 다시 해 주세요.');
}
/** 알림 켜기: the phone's permission, then this device's token saved for this account. `browser`: a browser tab may turn
 *  it on too (선생님 학생 학습 알림: a computer works; students only in the installed app). */
export async function enablePush(uid: string, idToken: () => Promise<string>, key = WEB_PUSH_KEY, browser = false): Promise<PushState> {
  if ((!browser && !installedApp()) || !pushSupported(key)) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const token = await deviceToken(key);
  if (!token) throw new Error('알림을 켜지 못했어요. 잠시 후 다시 해 주세요.');
  await send(await idToken(), token, true);
  write(savedKey(uid), '1'); dismissPushCard(uid);
  return 'on';
}
/** 알림 끄기: this device's token removed (the phone's permission stays; it can be turned on again here). */
export async function disablePush(uid: string, idToken: () => Promise<string>, key = WEB_PUSH_KEY): Promise<PushState> {
  if (pushSupported(key) && Notification.permission === 'granted') {
    const token = await deviceToken(key).catch(() => '');
    if (token) await send(await idToken(), token, false);
  }
  write(savedKey(uid), null);
  return 'off';
}
