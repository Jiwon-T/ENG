import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, ChevronDown, ChevronUp, Share, Smartphone } from 'lucide-react';
import { auth } from '../lib/firebase';
import { WEB_PUSH_KEY, disablePush, dismissPushCard, enablePush, homePushView, installedApp, iphoneDevice, pushCardDismissed, pushState, type PushState } from '../lib/pushNotifications';

/** 과제·보강 알림 (students): a line on home until it is turned on (나중에: 7 days), and a row in the menu to turn it on
 *  or off (a browser tab too). Nothing shows while the web push key is not set. */
const idToken = () => auth.currentUser ? auth.currentUser.getIdToken() : Promise.reject(new Error('다시 로그인해 주세요.'));
function usePush(uid: string, pushKey: string, browser = false) {
  const [state, setState] = useState<PushState>(() => pushState(uid, pushKey, browser)), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const run = async (f: () => Promise<PushState>) => { setBusy(true); setError(''); try { setState(await f()); } catch (e: any) { setError(e?.message || '알림을 켜지 못했어요. 잠시 후 다시 해 주세요.'); } finally { setBusy(false); } };
  return { state, busy, error, on: () => run(() => enablePush(uid, idToken, pushKey, browser)), off: () => run(() => disablePush(uid, idToken, pushKey)) };
}
const blockedText = '휴대폰 설정에서 이 앱의 알림을 허용하면 켤 수 있어요.';

/** 과제·보강 알림 on home: one line over the 과제 — a switch while it is off (it folds 2 seconds after it is turned on),
 *  how to add the app to the home screen on an iPhone (web push only works there), or the phone's settings when it is
 *  blocked. 나중에 / 닫기 (on each of them) hides it for 7 days. Turned off again only in 내 메뉴. */
export function PushHomeToggle({ uid, pushKey = WEB_PUSH_KEY }: { uid: string; pushKey?: string }) {
  const push = usePush(uid, pushKey, true), [hidden, setHidden] = useState(() => pushCardDismissed(uid)), [asked, setAsked] = useState(false), [done, setDone] = useState(false), [howto, setHowto] = useState(false);
  useEffect(() => { if (!asked || push.state !== 'on') return; const t = setTimeout(() => setDone(true), 2000); return () => clearTimeout(t); }, [asked, push.state]);
  const later = () => { dismissPushCard(uid); setHidden(true); };
  if (done) return null;
  if (asked && push.state === 'on') return <div role="status" className="mb-1.5 flex items-center gap-2 rounded-xl border border-[#9fe1cb] bg-[#e1f5ee] px-3 py-2 text-xs text-[#085041]"><BellRing size={15} aria-hidden="true" /><span className="min-w-0 flex-1">알림을 켰어요. 새 과제와 보강을 알려 줄게요</span><span className="flex h-[22px] w-[38px] flex-none items-center justify-end rounded-full bg-[#1d9e75] p-0.5"><span className="h-[18px] w-[18px] rounded-full bg-white" /></span></div>;
  const view = homePushView(push.state, iphoneDevice(), installedApp(), hidden);
  if (!view) return null;
  if (view === 'install') return <div className="mb-1.5 rounded-xl border border-[#f4c0d1] bg-[#fbeaf0] px-3 py-2 text-xs text-[#72243e]">
    <div className="flex items-center gap-2"><Smartphone size={15} aria-hidden="true" /><span className="min-w-0 flex-1">홈 화면에 추가하면 과제 알림을 받을 수 있어요</span><button type="button" aria-expanded={howto} onClick={() => setHowto(o => !o)} className="flex flex-none items-center gap-0.5 font-bold text-[#993556]">방법{howto ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}</button><button type="button" onClick={later} className="flex-none text-[11px] text-[#993556]/70">나중에</button></div>
    {howto && <p className="mt-1.5 text-[#993556]">Safari 아래 <Share size={12} className="inline align-[-2px]" aria-label="공유" /> 공유 → ‘홈 화면에 추가’ → 추가한 앱으로 열기</p>}
  </div>;
  if (view === 'blocked') return <div className="mb-1.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"><BellOff size={15} aria-hidden="true" /><span className="min-w-0 flex-1">{blockedText}</span><button type="button" onClick={later} className="flex-none text-slate-400">닫기</button></div>;
  return <div className="mb-1.5 rounded-xl border border-[#f4c0d1] bg-[#fbeaf0] px-3 py-2 text-xs text-[#72243e]">
    <div className="flex items-center gap-2"><Bell size={15} className="text-[#993556]" aria-hidden="true" /><span className="min-w-0 flex-1">새 과제가 생기면 알려 줄까요?</span>
      <button type="button" disabled={push.busy} onClick={later} className="flex-none text-[11px] text-[#993556]/70">나중에</button>
      <button type="button" role="switch" aria-checked="false" aria-label="과제·보강 알림 켜기" disabled={push.busy} onClick={() => { setAsked(true); void push.on(); }} className="flex h-[22px] w-[38px] flex-none items-center rounded-full bg-[#d3d1c7] p-0.5 disabled:opacity-50"><span className="h-[18px] w-[18px] rounded-full bg-white" /></button></div>
    {push.error && <p role="alert" className="mt-1 text-rose-600">{push.error}</p>}
  </div>;
}

/** 내 메뉴 › 과제·보강 알림: like the teacher's 학생 학습 알림 — what it sends, the switch, and whether this device gets it.
 *  Shown in a browser tab too (a computer or an Android phone can turn it on there); an iPhone is told to use the app
 *  added to the home screen. */
export function PushMenuRow({ uid, pushKey = WEB_PUSH_KEY }: { uid: string; pushKey?: string }) {
  const push = usePush(uid, pushKey, true);
  if (!pushKey) return null;
  const on = push.state === 'on', iphone = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  return <div className="px-6 pb-2">
    <div className="rounded-2xl border border-slate-100 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-700"><Bell size={16} aria-hidden="true" />과제·보강 알림</span>
        <button type="button" role="switch" aria-checked={on} aria-label="과제·보강 알림" disabled={push.busy || push.state === 'blocked' || push.state === 'unsupported'} onClick={() => void (on ? push.off() : push.on())}
          className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-50 ${on ? 'bg-[#d4537e] text-white' : 'bg-slate-100 text-slate-500'}`}>{on ? '켜짐' : '꺼짐'}</button>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">선생님이 새 과제를 내거나 보강 일정이 생기면 알려 줘요. 과제 알림을 누르면 그 과제가 열려요.</p>
      <p className={`mt-2 text-[11px] ${on ? 'text-[#27500a]' : 'text-slate-500'}`}>
        {on ? '✓ 이 기기 알림 켜짐 · 다른 기기에서도 켜면 둘 다 와요'
          : push.state === 'blocked' ? '이 기기는 알림이 막혀 있어요. 브라우저(휴대폰) 설정에서 이 앱의 알림을 허용하면 켤 수 있어요.'
          : push.state === 'unsupported' ? (iphone ? '아이폰은 홈 화면에 추가한 앱에서 켤 수 있어요.' : '이 기기에서는 받을 수 없어요.')
          : '켜면 이 기기로 알림이 와요.'}
      </p>
      {push.error && <p role="alert" className="mt-1 text-[11px] text-rose-600">{push.error}</p>}
    </div>
  </div>;
}
