import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { auth } from '../lib/firebase';
import { teacherAuthenticatedRequest } from '../lib/teacherAuthenticatedRequest';
import { WEB_PUSH_KEY, enablePush, pushState, type PushState } from '../lib/pushNotifications';

/** 내 메뉴 (선생님): 학생 학습 알림 — on for this account (모바일만 / 모든 기기), and whether this device gets it. A teacher
 *  can turn it on in a browser tab too (a computer, or an Android phone); an iPhone needs the app added to the home screen. */
const idToken = () => auth.currentUser ? auth.currentUser.getIdToken() : Promise.reject(new Error('다시 로그인해 주세요.'));
export default function TeacherStudyAlert({ uid, pushKey = WEB_PUSH_KEY }: { uid: string; pushKey?: string }) {
  const [setting, setSetting] = useState<{ on: boolean; mobileOnly: boolean; games: boolean } | null>(null), [device, setDevice] = useState<PushState>(() => pushState(uid, pushKey, true));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { let live = true; teacherAuthenticatedRequest<any>(auth, '/api/teacher/workspace?action=study-alert').then(r => { if (live && r.ok && r.data?.ok) setSetting({ on: r.data.on, mobileOnly: r.data.mobileOnly, games: r.data.games === true }); }).catch(() => undefined); return () => { live = false; }; }, []);
  const save = async (next: { on: boolean; mobileOnly: boolean; games: boolean }) => {
    setBusy(true); setError('');
    try {
      if (next.on && device !== 'on') { const state = await enablePush(uid, idToken, pushKey, true); setDevice(state); if (state !== 'on') { if (state === 'off') setError('알림을 허용해야 받을 수 있어요.'); return; } }
      const r = await teacherAuthenticatedRequest<any>(auth, '/api/teacher/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-study-alert', ...next }) });
      if (!r.ok || !r.data?.ok) throw Error(r.data?.message || '저장하지 못했어요. 잠시 후 다시 해 주세요.');
      setSetting(next);
    } catch (e: any) { setError(e?.message || '저장하지 못했어요. 잠시 후 다시 해 주세요.'); } finally { setBusy(false); }
  };
  if (!setting) return null;
  const chip = (mobileOnly: boolean, label: string) => <button type="button" aria-pressed={setting.mobileOnly === mobileOnly} disabled={busy || !setting.on} onClick={() => void save({ ...setting, mobileOnly })}
    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold disabled:opacity-50 ${setting.mobileOnly === mobileOnly ? 'border-[#ed93b1] bg-[#fbeaf0] text-[#72243e]' : 'border-slate-200 text-slate-500'}`}>{label}</button>;
  return <div className="px-6 pb-2">
    <div className="rounded-2xl border border-slate-100 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-700"><Bell size={16} aria-hidden="true" />학생 학습 알림</span>
        <button type="button" role="switch" aria-checked={setting.on} aria-label="학생 학습 알림" disabled={busy || device === 'unsupported' && !setting.on} onClick={() => void save({ ...setting, on: !setting.on })}
          className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-50 ${setting.on ? 'bg-[#d4537e] text-white' : 'bg-slate-100 text-slate-500'}`}>{setting.on ? '켜짐' : '꺼짐'}</button>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">담당 학생이 앱에서 학습을 하나 끝낼 때마다 알려 드려요(원정대 과제 포함). 누르면 그 학생의 온라인 학습이 열려요.</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="text-[11px] text-slate-500">어떤 기기로 공부할 때</span>{chip(true, '모바일만')}{chip(false, '모든 기기')}</div>
      <label className={`mt-2 flex items-center gap-1.5 text-[11px] ${setting.on ? 'text-slate-600' : 'text-slate-400'}`}><input type="checkbox" checked={setting.games} disabled={busy || !setting.on} onChange={e => void save({ ...setting, games: e.target.checked })} />탑·먹이 주기 등 펫 게임 기록도 알림</label>
      {setting.on && <p className={`mt-2 text-[11px] ${device === 'on' ? 'text-[#27500a]' : 'text-slate-500'}`}>
        {device === 'on' ? '✓ 이 기기 알림 켜짐 · 다른 기기에서도 켜면 둘 다 와요'
          : device === 'blocked' ? '이 기기는 알림이 막혀 있어요. 브라우저(휴대폰) 설정에서 이 사이트의 알림을 허용해 주세요.'
          : device === 'unsupported' ? '이 기기에서는 받을 수 없어요. 아이폰은 홈 화면에 추가한 앱에서 켜 주세요.'
          : <>이 기기에서는 아직 안 와요. <button type="button" className="font-bold text-[#993556] underline" disabled={busy} onClick={() => void save(setting)}>이 기기에서도 받기</button></>}
      </p>}
      {error && <p role="alert" className="mt-1 text-[11px] text-rose-600">{error}</p>}
    </div>
  </div>;
}
