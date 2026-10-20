import { useState } from 'react';
import { X } from 'lucide-react';
import { askConfirm } from '../teacher/ConfirmDialog';
import { PET_PARTY } from '../../lib/petCatalog';

// 원정대 이름 (one per student) and 모험가 별칭 (one per pet): free text an admin can warn. Using a name another student
// already has is allowed, but the student is asked first.
export interface NamesView { guildName: string; guildWarned: boolean; movedNickname: boolean; currentSlot: number; pets: { slot: number; name: string; alias: string; warned: boolean }[]; ready: boolean }
type Send = (action: string, payload?: Record<string, unknown>) => Promise<any>;

function NameRow({ label, sub, value, warned, busy, onSave }: { label: string; sub?: string; value: string; warned: boolean; busy: boolean; onSave: (name: string) => Promise<void> }) {
  const [text, setText] = useState(warned ? '' : value), changed = text.trim() !== (warned ? '' : value) && text.trim().length >= PET_PARTY.nickname.min;
  return <form onSubmit={e => { e.preventDefault(); if (changed) void onSave(text.trim()); }} className="mt-3">
    <label className="text-xs font-bold text-[#5e1e2a]">{label}{sub && <span className="ml-1 font-normal text-slate-400">{sub}</span>}
      <span className="mt-1 flex gap-1.5"><input value={text} onChange={e => setText(e.target.value)} maxLength={PET_PARTY.nickname.max} placeholder={warned ? '새 이름을 정해 주세요' : '2~10자'} className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm font-normal outline-none focus:border-[#e0587a] ${warned ? 'border-amber-300 bg-amber-50' : 'border-[#f3d5da]'}`} />
        <button type="submit" disabled={busy || !changed} className="rounded-xl bg-[#e0587a] px-3 text-xs font-bold text-white disabled:opacity-40">{value && !warned ? '바꾸기' : '정하기'}</button></span></label>
    {warned && <p className="mt-1 text-[11px] font-bold text-amber-700">관리자가 바꿔 달라고 한 이름이에요 ('{value}'은 다시 쓸 수 없어요)</p>}
  </form>;
}

export default function AdventureNames({ names, send, onSaved, onClose }: { names: NamesView; send: Send; onSaved: (r: any) => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const save = (action: 'guild-name' | 'guild-alias', extra: Record<string, unknown>) => async (name: string) => {
    setBusy(true); setNotice('');
    try {
      // asked one at a time: a name holding the student's real name (it may show on the rankings), then another student's name
      const flags: { realName?: true; confirm?: true } = {};
      for (;;) {
        try { onSaved(await send(action, { ...extra, name, ...flags })); break; }
        catch (e: any) {
          if (e?.code === 'NAME_REAL' && !flags.realName) {
            if (!await askConfirm({ title: '실명을 입력하셨어요', message: '순위표에 드러날 수 있는데 그대로 진행하시겠어요?', confirmText: '그대로 하기' })) break;
            flags.realName = true; continue;
          }
          if (e?.code === 'NAME_TAKEN' && !flags.confirm) {
            if (!await askConfirm({ title: `'${name}' 같은 이름이 있어요`, message: '다른 친구가 이미 쓰고 있어요. 그래도 이 이름으로 할까요?', confirmText: '이 이름으로 하기' })) break;
            flags.confirm = true; continue;
          }
          throw e;
        }
      }
    } catch (e: any) { setNotice(e?.message || '잠시 후 다시 해 주세요.'); } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[86] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onClick={e => { e.stopPropagation(); onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="adventure-names-title" className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-white px-5 pb-6 pt-4 sm:rounded-3xl" onClick={e => e.stopPropagation()}>
      <header className="flex items-center justify-between"><h2 id="adventure-names-title" className="text-base font-black text-[#5e1e2a]">원정대 이름 · 모험가 별칭</h2><button type="button" onClick={onClose} aria-label="닫기" className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={18} aria-hidden="true" /></button></header>
      <p className="mt-1 text-[11px] text-slate-500">다른 친구들에게는 실명 대신 이 이름이 보여요 · 연락처·주소는 쓸 수 없어요</p>
      {names.movedNickname && <p className="mt-2 rounded-xl bg-[#fef2f3] px-3 py-2 text-xs text-[#5e1e2a]">예전 길드 별칭을 대표 펫의 모험가 별칭으로 옮겼어요. 바꿔도 돼요. 원정대 이름은 새로 정해 주세요.</p>}
      {notice && <p role="alert" className="mt-2 text-center text-xs font-bold text-[#b04a5a]">{notice}</p>}
      <NameRow label="원정대 이름" sub="나 하나에 하나" value={names.guildName} warned={names.guildWarned} busy={busy} onSave={save('guild-name', {})} />
      <p className="mt-4 text-xs font-bold text-[#5e1e2a]">모험가 별칭 <span className="font-normal text-slate-400">펫마다 하나</span></p>
      {names.pets.map(p => <div key={p.slot} className="-mt-1"><NameRow label={p.name} sub={p.slot === names.currentSlot ? '지금 함께하는 펫' : undefined} value={p.alias} warned={p.warned} busy={busy} onSave={save('guild-alias', { slot: p.slot })} /></div>)}
    </section>
  </div>;
}
