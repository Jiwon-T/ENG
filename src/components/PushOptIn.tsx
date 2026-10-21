import { useState } from 'react';
import { Bell } from 'lucide-react';
import { auth } from '../lib/firebase';
import { WEB_PUSH_KEY, disablePush, dismissPushCard, enablePush, pushCardDismissed, pushState, type PushState } from '../lib/pushNotifications';

/** 과제·보강 알림 (students, installed app only): a card on home until it is turned on or put off (나중에), and a row in
 *  the menu to turn it on or off. Nothing shows in a browser tab or while the web push key is not set. */
const idToken = () => auth.currentUser ? auth.currentUser.getIdToken() : Promise.reject(new Error('다시 로그인해 주세요.'));
function usePush(uid: string, pushKey: string) {
  const [state, setState] = useState<PushState>(() => pushState(uid, pushKey)), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const run = async (f: () => Promise<PushState>) => { setBusy(true); setError(''); try { setState(await f()); } catch (e: any) { setError(e?.message || '알림을 켜지 못했어요. 잠시 후 다시 해 주세요.'); } finally { setBusy(false); } };
  return { state, busy, error, on: () => run(() => enablePush(uid, idToken, pushKey)), off: () => run(() => disablePush(uid, idToken, pushKey)) };
}
const blockedText = '휴대폰 설정에서 이 앱의 알림을 허용하면 켤 수 있어요.';

export function PushHomeCard({ uid, pushKey = WEB_PUSH_KEY }: { uid: string; pushKey?: string }) {
  const push = usePush(uid, pushKey), [hidden, setHidden] = useState(() => pushCardDismissed(uid));
  if (push.state === 'unsupported' || push.state === 'on' || hidden) return null;
  return <section aria-label="과제·보강 알림" className="mt-3 flex items-start gap-3 rounded-2xl border border-[#f3e6e8] bg-white px-4 py-3">
    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-[#fef2f3] text-[#8b2f40]"><Bell size={16} aria-hidden="true" /></span>
    <div className="min-w-0 flex-1">
      <b className="text-sm font-bold text-[#5e1e2a]">과제·보강 알림 받기</b>
      <p className="mt-0.5 text-xs text-slate-500">{push.state === 'blocked' ? blockedText : '새 과제와 보강 일정이 생기면 알려 줘요.'}</p>
      {push.error && <p role="alert" className="mt-1 text-xs text-rose-600">{push.error}</p>}
      {push.state !== 'blocked' && <div className="mt-2 flex gap-1.5">
        <button type="button" disabled={push.busy} onClick={() => void push.on()} className="rounded-lg bg-[#8b2f40] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">알림 켜기</button>
        <button type="button" disabled={push.busy} onClick={() => { dismissPushCard(uid); setHidden(true); }} className="rounded-lg border border-[#f3e6e8] px-3 py-1.5 text-xs font-bold text-slate-500">나중에</button>
      </div>}
    </div>
  </section>;
}

export function PushMenuRow({ uid, pushKey = WEB_PUSH_KEY }: { uid: string; pushKey?: string }) {
  const push = usePush(uid, pushKey);
  if (push.state === 'unsupported') return null;
  const on = push.state === 'on';
  return <div className="px-6 pb-2">
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 px-4 py-3">
      <span className="flex items-center gap-2 text-sm font-bold text-slate-700"><Bell size={16} aria-hidden="true" />과제·보강 알림</span>
      {push.state === 'blocked' ? <span className="text-xs text-slate-400">휴대폰 설정에서 허용</span>
        : <button type="button" role="switch" aria-checked={on} disabled={push.busy} onClick={() => void (on ? push.off() : push.on())} className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-50 ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{on ? '켜짐' : '꺼짐'}</button>}
    </div>
    {push.state === 'blocked' && <p className="mt-1 text-xs text-slate-400">{blockedText}</p>}
    {push.error && <p role="alert" className="mt-1 text-xs text-rose-600">{push.error}</p>}
  </div>;
}
