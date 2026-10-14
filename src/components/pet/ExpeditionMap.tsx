import React, { useEffect, useState } from 'react';
import { ChevronLeft, Lock, Check } from 'lucide-react';
import { PetCharacter } from './PetCharacters';
import WordFeed, { type FeedRunView } from './WordFeed';
import { askConfirm } from '../teacher/ConfirmDialog';
import { PET_EXPEDITION, PET_WORD_FEED, petItem, petStage } from '../../lib/petCatalog';
import type { PetResponse, PetState } from '../../lib/petService';

// 개인 원정대: a map per chapter with 5 stages along a path; each stage is one 단어 먹이 주기 game. Everything shown
// here (stars, bonuses, what is open) comes from the server.
interface StageView { id: string; name: string; boss: boolean; stars: number; unlocked: boolean; cleared: boolean; bonuses: string[] }
interface ChapterView { id: string; title: string; name: string; reward: string; rewarded: boolean; minLevel: number; levelOk: boolean; unlocked: boolean; stages: StageView[] }
export interface ExpeditionView { current: string; allCleared?: boolean; currentNeedsLevel?: number | null; totalStars: number; maxStars: number; chapters: ChapterView[] }
type Send = (action: string, payload?: Record<string, unknown>) => Promise<PetResponse & { run?: FeedRunView; expedition?: ExpeditionView }>;

const LOOK: Record<string, { bg: string; path: string; deco: [string, number, number][] }> = {
  forest: { bg: '#eef6ea', path: '#d6e5cf', deco: [['🌲', 6, 4], ['🌳', 82, 48], ['🍄', 8, 50], ['🌲', 84, 88]] },
  sea: { bg: '#e8f3fb', path: '#cfe2f1', deco: [['🐚', 6, 6], ['🌊', 80, 46], ['🐠', 10, 52], ['🪸', 82, 88]] },
  castle: { bg: '#f3f0fb', path: '#e1dbf3', deco: [['☁️', 6, 6], ['⭐', 84, 46], ['☁️', 8, 54], ['🌙', 84, 88]] },
};
// Stage spots along the path (percent of the map box, 23:30).
const SPOTS = [[17, 91], [52, 69], [74, 45], [48, 24], [70, 8]];
const PATH = 'M40 275 C 100 265, 60 215, 120 205 S 205 175, 170 135 S 80 105, 110 70 S 190 40, 160 22';
const BONUS_LABEL: Record<string, string> = { clear: '처음 통과 보너스', star2: '★★ 처음 달성', star3: '★★★ 처음 달성' };

export default function ExpeditionMap({ state, send, onClose, onGuild }: { state: PetState; send: Send; onClose: () => void; onGuild?: () => void }) {
  const [exp, setExp] = useState<ExpeditionView | null>(null);
  const [run, setRun] = useState<FeedRunView | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const pet = state.pets.find(p => p.slot === state.currentPetSlot)!;

  const refresh = async () => { const r = await send('expedition-state'); if (r.expedition) { setExp(r.expedition); setChapterId(id => id || r.expedition!.current.split('-')[0]); } setRun(r.run || null); };
  useEffect(() => { void refresh().catch(e => setNotice(e?.message || '지도를 불러오지 못했어요.')); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!exp || !chapterId) return <div className="fixed inset-0 z-[80] bg-white" aria-busy="true">{notice && <p className="p-6 text-center text-sm text-slate-500">{notice}</p>}</div>;
  const chapter = exp.chapters.find(c => c.id === chapterId)!, look = LOOK[chapter.id];
  const stage = selected ? exp.chapters.flatMap(c => c.stages).find(s => s.id === selected) : undefined;
  const stageTitle = (id: string) => { const c = exp.chapters.find(x => id.startsWith(x.id + '-')), s = c?.stages.find(x => x.id === id); return c && s ? `${c.title} · ${s.name}` : '원정대'; };
  const resumable = run && !run.finished ? run.stage : null;
  const chapterStars = chapter.stages.reduce((a, s) => a + s.stars, 0), left = chapter.stages.filter(s => !s.cleared).length;

  const start = async (id: string, restart = false) => {
    setBusy(true); setNotice('');
    try {
      const r = await send('feed-start', { stage: id, ...(restart ? { restart: true } : {}) });
      if (r.expedition) setExp(r.expedition);
      if (r.run) { setRun(r.run); setPlaying(true); }
    } catch (e: any) {
      if (e?.code === 'FEED_OTHER_RUN' && await askConfirm({ title: '하던 판이 있어요', message: `${resumable ? stageTitle(resumable) : '단어 먹이 주기'} 판을 그만두고 출발할까요? 기운 ${PET_WORD_FEED.energy}을 써요.`, confirmText: '그만두고 출발' })) { setBusy(false); return start(id, true); }
      if (e?.code !== 'FEED_OTHER_RUN') setNotice(e?.message || '잠시 후 다시 해 주세요.');
    } finally { setBusy(false); }
  };

  if (playing && run) return <WordFeed run={run} state={state} send={async (a, p) => { const r: any = await send(a, p); if (r.run) setRun(r.run); if (r.expedition) setExp(r.expedition); return r; }}
    title={run.stage ? stageTitle(run.stage) : undefined}
    onClose={() => { setPlaying(false); void refresh().catch(() => undefined); }}
    onNext={next => { setPlaying(false); setChapterId(next.split('-')[0]); setSelected(next); }} />;

  return (
    <div role="dialog" aria-modal="true" aria-label="원정대" className="fixed inset-0 z-[80] overflow-y-auto bg-white">
      <div className="mx-auto max-w-md px-4 pb-8 pt-3">
        <header className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="flex items-center gap-0.5 text-sm font-bold text-[#8b2f40]"><ChevronLeft size={18} aria-hidden="true" />펫</button>
          <h1 className="text-base font-black text-[#5e1e2a]">원정대</h1>
          <span className="text-xs font-bold text-[#8b2f40]">기운 {pet.energy}</span>
        </header>
        <div role="tablist" aria-label="장" className="mt-3 flex gap-1.5">
          {exp.chapters.map(c => <button key={c.id} type="button" role="tab" aria-selected={c.id === chapterId} onClick={() => { setChapterId(c.id); setSelected(null); }} className={`flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-xs font-bold ${c.id === chapterId ? 'bg-[#e0587a] text-white' : c.unlocked ? 'bg-[#f8f1f2] text-[#8b2f40]' : 'bg-[#f8f1f2] text-slate-400'}`}>{c.title}{!c.levelOk ? <span className="text-[10px]">Lv.{c.minLevel}</span> : !c.unlocked && <Lock size={11} aria-label="잠김" />}{c.rewarded && <Check size={12} aria-label="완료" />}</button>)}
        </div>
        <p className="mt-2 text-center text-xs font-bold text-[#8b2f40]">{chapter.name}{!chapter.levelOk && <span className="ml-1 text-slate-500">· 대표 펫 Lv.{chapter.minLevel}부터 갈 수 있어요</span>}</p>

        <div className="relative mt-2 aspect-[23/30] w-full overflow-hidden rounded-3xl" style={{ background: look.bg }}>
          <svg viewBox="0 0 230 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true"><path d={PATH} fill="none" stroke={look.path} strokeWidth="12" strokeLinecap="round" /></svg>
          {look.deco.map(([d, x, y], i) => <span key={i} aria-hidden="true" className="absolute text-xl" style={{ left: `${x}%`, top: `${y}%` }}>{d}</span>)}
          {chapter.stages.map((s, i) => { const [x, y] = SPOTS[i], here = s.id === exp.current, size = s.boss ? 'h-12 w-12' : 'h-10 w-10';
            return <button key={s.id} type="button" onClick={() => setSelected(s.id)} aria-label={`${s.name}${s.unlocked ? `, 별 ${s.stars}개` : ', 잠김'}`} className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full text-sm font-black ${size} ${s.boss ? 'border-2 border-[#f2b84b] bg-[#fff7e6] text-[#b07a10]' : s.cleared ? 'bg-[#e0587a] text-white' : here ? 'border-[2.5px] border-[#e0587a] bg-white text-[#e0587a]' : s.unlocked ? 'bg-white text-[#8b2f40]' : 'bg-white/70 text-slate-300'}`} style={{ left: `${x}%`, top: `${y}%` }}>
              {s.boss ? '👑' : s.unlocked ? i + 1 : <Lock size={14} aria-hidden="true" />}
              {s.stars > 0 && <span className="absolute -bottom-3 text-[10px] tracking-tighter text-[#f2b84b]" aria-hidden="true">{'★'.repeat(s.stars)}</span>}
            </button>; })}
          {chapter.stages.some(s => s.id === exp.current) && (() => { const [x, y] = SPOTS[chapter.stages.findIndex(s => s.id === exp.current)]; return <span className="pointer-events-none absolute" style={{ left: `calc(${x}% + 18px)`, top: `calc(${y}% - 30px)` }}><PetCharacter character={pet.character} stage={petStage(pet.level)} clothing={pet.clothing} accessory={pet.accessory} size={44} /></span>; })()}
        </div>
        <div className="mt-2 flex justify-between text-xs font-bold text-[#8b2f40]"><span>★ {chapterStars} / {chapter.stages.length * 3}</span><span>{chapter.rewarded ? `${petItem(chapter.reward)?.name} 받음 ✓` : `${petItem(chapter.reward)?.icon} ${petItem(chapter.reward)?.name}까지 ${left}스테이지`}</span></div>
        {resumable && <button type="button" onClick={() => { setChapterId(resumable.split('-')[0]); setSelected(resumable); }} className="mt-3 w-full rounded-2xl bg-[#fef2f3] px-4 py-2.5 text-left text-xs text-[#5e1e2a]">하던 판이 저장돼 있어요 · <b className="font-bold">{stageTitle(resumable)}, {run!.index + 1}번째 문제부터</b></button>}
        {onGuild && <button type="button" onClick={onGuild} className="mt-3 flex w-full items-center gap-3 rounded-2xl border-2 border-[#d9bf96] bg-[#f7efe2] px-4 py-2.5 text-left"><span className="text-xl" aria-hidden="true">🏰</span><span className="flex-1 text-xs text-[#6b5a40]"><b className="block text-sm font-black text-[#5e1e2a]">모험가 길드</b>친구들과 파티를 꾸려 이번 주 보스를 물리쳐요</span></button>}
        {notice && <p role="alert" className="mt-3 text-center text-xs font-bold text-[#b04a5a]">{notice}</p>}
      </div>

      {stage && <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-900/30" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="stage-title" className="w-full max-w-md rounded-t-3xl bg-white px-5 pb-6 pt-4 text-center">
          <h2 id="stage-title" className="text-base font-black text-[#5e1e2a]">{stage.name}</h2>
          <p className="text-xs text-slate-500">{stage.boss ? `왕관 스테이지 · 별 ${PET_EXPEDITION.bossStars}개 이상이면 통과` : '단어 먹이 주기 · 절반 이상 맞히면 통과'} · {PET_WORD_FEED.questions}문제</p>
          <p className="my-2 text-2xl tracking-widest" aria-label={`최고 별 ${stage.stars}개`}><span className="text-[#f2b84b]">{'★'.repeat(stage.stars)}</span><span className="text-[#ece3e5]">{'★'.repeat(3 - stage.stars)}</span></p>
          <ul className="rounded-2xl bg-[#fdf6f7] px-4 py-2 text-left text-xs text-[#5e1e2a]">
            {(['clear', 'star2', 'star3'] as const).map(k => <li key={k} className="flex justify-between py-0.5"><span>{BONUS_LABEL[k]}</span><span className={stage.bonuses.includes(k) ? 'text-slate-400' : 'font-bold text-[#8b2f40]'}>{stage.bonuses.includes(k) ? '받음 ✓' : `+${PET_EXPEDITION.bonus[k]}P`}</span></li>)}
            <li className="flex justify-between py-0.5 text-slate-500"><span>맞힌 단어</span><span>문제당 5P</span></li>
            {stage.boss && <li className="flex justify-between py-0.5"><span>장 완료 보상</span><span className="font-bold text-[#8b2f40]">{petItem(chapter.reward)?.icon} {petItem(chapter.reward)?.name}</span></li>}
          </ul>
          <p className="mt-1.5 text-[11px] text-slate-400">보너스는 한 번씩만 · 포인트는 오늘 공부 {state.today.studyCap}P 안에서</p>
          {!stage.unlocked ? <p className="mt-4 rounded-2xl bg-[#f8f1f2] py-3 text-sm font-bold text-slate-500">{chapter.levelOk ? '앞 스테이지를 먼저 통과해 주세요' : `대표 펫이 Lv.${chapter.minLevel}이 되면 갈 수 있어요`}</p>
            : <button type="button" disabled={busy} onClick={() => void start(stage.id)} className="mt-4 w-full rounded-2xl bg-[#e0587a] py-3 text-sm font-bold text-white disabled:opacity-60">{resumable === stage.id ? '이어 하기' : `출발하기 · 기운 ${PET_WORD_FEED.energy}`}</button>}
          {resumable !== stage.id && stage.unlocked && <p className="mt-2 text-[11px] text-slate-400">하던 판은 기운 없이 이어 해요</p>}
          {notice && <p role="alert" className="mt-2 text-xs font-bold text-[#b04a5a]">{notice}</p>}
        </div>
      </div>}
    </div>
  );
}
