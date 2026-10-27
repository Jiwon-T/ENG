import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { googleProvider, logout, signIn } from '../lib/firebase';

/** 기존 계정으로 옮기기: this account's records went to another (linked) account. Signing in here shows a pop-up — 그 계정으로
 *  로그인하기 (sign out, then Google's account chooser) or 이 계정 계속 쓰기 (remembered on this device; then only a small line
 *  on home). The account still works either way. */
const okKey = (uid: string) => `moved-ok:${uid}`;
const remembered = (uid: string) => { try { return localStorage.getItem(okKey(uid)) === '1'; } catch { return false; } };

async function switchAccount() {
  await logout();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  try { await signIn(); } catch { /* closed: the sign-in screen stays */ } finally { googleProvider.setCustomParameters({}); }
}

export default function MovedAccountNotice({ uid, email, home }: { key?: string; uid: string; email: string; /** on the home screen: the small line once kept */ home?: boolean }) {
  const [kept, setKept] = useState(() => remembered(uid)), [busy, setBusy] = useState(false);
  const go = () => { setBusy(true); void switchAccount().finally(() => setBusy(false)); };
  if (kept) return home ? <p className="mx-auto mb-3 flex max-w-xl items-center gap-1.5 rounded-xl bg-[#eeedfe] px-3 py-2 text-xs text-[#3c3489]">
    <ArrowRightLeft size={13} aria-hidden="true" /><span className="min-w-0 flex-1">공부 기록은 <b>{email}</b> 계정에 있어요.</span>
    <button type="button" disabled={busy} onClick={go} className="flex-none font-bold underline disabled:opacity-50">계정 바꾸기</button></p> : null;
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="moved-title" className="w-full max-w-xs rounded-3xl bg-white px-5 pb-4 pt-5 text-center shadow-2xl">
      <span className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eeedfe] text-[#534ab7]"><ArrowRightLeft size={22} aria-hidden="true" /></span>
      <h2 id="moved-title" className="text-base font-black text-slate-800">옛 계정으로 로그인했어요</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">공부 기록과 포인트, 펫은<br /><b className="text-slate-800">{email}</b> 계정으로 옮겨졌어요.<br />그 계정으로 로그인하면 이어서 할 수 있어요.</p>
      <button type="button" disabled={busy} onClick={go} className="mt-4 w-full rounded-2xl bg-[#d4537e] py-2.5 text-sm font-bold text-white disabled:opacity-50">그 계정으로 로그인하기</button>
      <button type="button" disabled={busy} onClick={() => { try { localStorage.setItem(okKey(uid), '1'); } catch { /* asked again next time */ } setKept(true); }} className="mt-1.5 w-full py-1.5 text-xs font-bold text-slate-500">이 계정 계속 쓰기</button>
    </section>
  </div>;
}
