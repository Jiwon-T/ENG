import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Gift } from 'lucide-react';
import { petItem, PET_QUESTS } from '../../lib/petCatalog';
import { PetService, type QuestView } from '../../lib/petService';

// 오늘 할 일 (home, students): today's three with where to do each; all three done opens a 간식 상자 (snacks into the
// pet's 가방, no points), a 특별 상자 every 5 days in a row.
const itemNames = (ids: string[]) => {
  const count = new Map<string, number>(); for (const id of ids) count.set(id, (count.get(id) || 0) + 1);
  return [...count].map(([id, n]) => `${petItem(id)?.name || id}${n > 1 ? ` ${n}개` : ''}`).join(' · ');
};

export default function TodayQuests({ quests, onGo }: { quests: QuestView; onGo: (view: 'vocab' | 'report' | 'pet') => void }) {
  const [view, setView] = useState(quests), [busy, setBusy] = useState(false), [opened, setOpened] = useState<{ items: string[]; special: boolean } | null>(null), [error, setError] = useState('');
  useEffect(() => setView(quests), [quests]); // a newer summary (back from studying)
  const doneCount = view.items.filter(i => i.done >= i.need).length;
  const open = async () => {
    setBusy(true); setError('');
    try { const r = await PetService.act('quest-claim'); if (r.quests) setView(r.quests); setOpened({ items: r.result?.items || [], special: Boolean(r.result?.special) }); }
    catch (e: any) { setError(e?.message || '잠시 후 다시 해 주세요.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="오늘 할 일" className="mt-3 rounded-2xl border border-[#f6e3e6] bg-white px-4 py-3 md:rounded-3xl md:px-6 md:py-4">
    <div className="flex items-center justify-between"><h2 className="text-sm font-black text-[#5e1e2a] md:text-base">오늘 할 일</h2>
      <span className="flex items-center gap-1.5">{view.streak > 1 && <span className="text-[11px] font-bold text-[#993556]">{view.streak}일 연속</span>}<span className="rounded-full bg-[#fbeaf0] px-2 py-0.5 text-[11px] font-bold text-[#72243e]">{doneCount} / {view.items.length}</span></span></div>
    <div className="mt-2 h-1.5 rounded-full bg-[#fdf2f4]" aria-hidden="true"><div className="h-1.5 rounded-full bg-[#d4537e] transition-all" style={{ width: `${Math.round(doneCount / view.items.length * 100)}%` }} /></div>
    <ul className="mt-1.5">{view.items.map(i => { const done = i.done >= i.need; return <li key={i.id} className="flex min-h-[40px] items-center gap-2.5 border-b border-[#fbeef0] py-1.5 last:border-0">
      {done ? <CheckCircle2 size={19} className="flex-none text-emerald-600" aria-hidden="true" /> : <Circle size={19} className="flex-none text-slate-300" aria-hidden="true" />}
      <span className={`min-w-0 flex-1 text-sm ${done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{i.label}{!done && i.need > 1 && i.done > 0 && <span className="ml-1 text-xs text-slate-400">{i.done}/{i.need}</span>}</span>
      {done ? <span className="text-xs text-slate-400">완료</span> : <button type="button" onClick={() => onGo(i.go)} className="rounded-full border border-[#f3d5da] px-2.5 py-1 text-xs font-bold text-[#8b2f40] hover:bg-[#fff7f8]">하러 가기</button>}
    </li>; })}</ul>
    {opened ? <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#eef6ea] px-3 py-2 text-xs text-[#27500a]"><Gift size={16} className="flex-none" aria-hidden="true" />
      <span className="flex-1"><b className="font-bold">{opened.special ? '특별 상자' : '간식 상자'}를 열었어요!</b> 펫 가방에 넣었어요: {itemNames(opened.items)}</span>
      <button type="button" onClick={() => onGo('pet')} className="flex-none rounded-lg bg-white px-2 py-1 font-bold text-[#3b6d11]">주러 가기</button></div>
    : view.ready ? <button type="button" disabled={busy} onClick={() => void open()} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#d26272] py-2.5 text-sm font-bold text-white disabled:opacity-60"><Gift size={16} aria-hidden="true" />{view.special ? '특별 상자 열기' : '간식 상자 열기'}</button>
    : view.claimed ? <p className="mt-2 rounded-xl bg-[#fdf6f8] px-3 py-2 text-xs text-[#8b2f40]">오늘 상자는 열었어요. 내일 또 만나요!</p>
    : <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-[#faeeda] px-3 py-2 text-xs text-[#633806]"><Gift size={15} className="flex-none" aria-hidden="true" />3개 다 하면 간식 상자 · {PET_QUESTS.streakDays}일 연속 특별 상자</p>}
    {error && <p role="alert" className="mt-1 text-xs text-rose-600">{error}</p>}
  </section>;
}
