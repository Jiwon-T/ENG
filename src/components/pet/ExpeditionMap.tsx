import React, { useEffect, useState } from 'react';
import { ChevronLeft, Lock, Check } from 'lucide-react';
import { PetCharacter } from './PetCharacters';
import WordFeed, { type FeedRunView } from './WordFeed';
import { askConfirm } from '../teacher/ConfirmDialog';
import { PET_EXPEDITION, PET_JOB2, PET_JOB_GUIDE, PET_JOBS, PET_WORD_FEED, STAGE_GAME_LABEL, petItem, petStage, stageGame, stageHasSound, wornAccessories, type PetJob, type PetJob2, petAura } from '../../lib/petCatalog';
import { speechRecognitionClass } from '../../lib/sentenceGame';
import { QuietPrompt } from '../sentence/SentenceGame';
import type { PetResponse, PetState } from '../../lib/petService';

// 개인 원정대: a map per chapter with 5 stages along a path; each stage is one 단어 먹이 주기 game. Everything shown
// here (stars, bonuses, what is open) comes from the server.
interface StageView { id: string; name: string; boss: boolean; stars: number; unlocked: boolean; cleared: boolean; bonuses: string[] }
interface ChapterView { id: string; title: string; name: string; reward: string; gear?: string[]; questions?: number; rewarded: boolean; minLevel: number; levelOk: boolean; unlocked: boolean; stages: StageView[] }
export interface ExpeditionView { current: string; allCleared?: boolean; currentNeedsLevel?: number | null; jobReady?: number[]; job2Ready?: number[]; totalStars: number; maxStars: number; chapters: ChapterView[] }
type Send = (action: string, payload?: Record<string, unknown>) => Promise<PetResponse & { run?: FeedRunView; expedition?: ExpeditionView }>;

const LOOK: Record<string, { bg: string; path: string; deco: [string, number, number][] }> = {
  forest: { bg: '#eef6ea', path: '#d6e5cf', deco: [['🌲', 6, 4], ['🌳', 82, 48], ['🍄', 8, 50], ['🌲', 84, 88]] },
  sea: { bg: '#e8f3fb', path: '#cfe2f1', deco: [['🐚', 6, 6], ['🌊', 80, 46], ['🐠', 10, 52], ['🪸', 82, 88]] },
  castle: { bg: '#f3f0fb', path: '#e1dbf3', deco: [['☁️', 6, 6], ['⭐', 84, 46], ['☁️', 8, 54], ['🌙', 84, 88]] },
  desert: { bg: '#fdf3e1', path: '#f1dcb4', deco: [['🌵', 6, 6], ['☀️', 82, 46], ['🐪', 8, 52], ['🌴', 84, 88]] },
  snow: { bg: '#eef4fb', path: '#d8e4f3', deco: [['❄️', 6, 6], ['🏔️', 80, 46], ['⛄', 8, 52], ['🌲', 84, 88]] },
  night: { bg: '#e9e7f6', path: '#cfcaee', deco: [['🌙', 6, 6], ['✨', 84, 46], ['🌠', 8, 52], ['⭐', 84, 88]] },
  dream: { bg: '#fdf0f5', path: '#f6d5e2', deco: [['🌈', 6, 6], ['🦋', 84, 46], ['🌸', 8, 52], ['🍭', 84, 88]] },
};
/** Chapter rewards as names: the background, plus the gear (검·지팡이) from 4장. */
const rewardText = (c: ChapterView) => [c.reward, ...(c.gear || [])].map(id => petItem(id)?.name).filter(Boolean).join(' · ');
// Stage spots along the path (percent of the map box, 23:30).
const SPOTS = [[17, 91], [52, 69], [74, 45], [48, 24], [70, 8]];
const PATH = 'M40 275 C 100 265, 60 215, 120 205 S 205 175, 170 135 S 80 105, 110 70 S 190 40, 160 22';
const BONUS_LABEL: Record<string, string> = { clear: '처음 통과 보너스', star2: '★★ 처음 달성', star3: '★★★ 처음 달성' };

/** `initial`: what the pet screen already has, so the map opens at once and refreshes quietly. */
export default function ExpeditionMap({ state, send, onClose, onGuild, initial }: { state: PetState; send: Send; onClose: () => void; onGuild?: () => void; initial?: { expedition: ExpeditionView | null; run: FeedRunView | null } }) {
  const [exp, setExp] = useState<ExpeditionView | null>(initial?.expedition || null);
  const [run, setRun] = useState<FeedRunView | null>(initial?.run || null);
  const [chapterId, setChapterId] = useState<string | null>(initial?.expedition ? initial.expedition.current.split('-')[0] : null);
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [jobLater, setJobLater] = useState(false);
  const [quietFor, setQuietFor] = useState<{ id: string; restart: boolean } | null>(null); // before the early return (hook order)
  const pet = state.pets.find(p => p.slot === state.currentPetSlot)!;
  const chooseJob = async (job: PetJob) => { setBusy(true); setNotice(''); try { const r = await send('choose-job', { job }); if (r.expedition) setExp(r.expedition); } catch (e: any) { setNotice(e?.message || '잠시 후 다시 해 주세요.'); } finally { setBusy(false); } };
  const chooseJob2 = async (job2: PetJob2) => { setBusy(true); setNotice(''); try { const r = await send('choose-job2', { job2 }); if (r.expedition) setExp(r.expedition); } catch (e: any) { setNotice(e?.message || '잠시 후 다시 해 주세요.'); } finally { setBusy(false); } };

  const refresh = async () => { const r = await send('expedition-state'); if (r.expedition) { setExp(r.expedition); setChapterId(id => id || r.expedition!.current.split('-')[0]); } setRun(r.run || null); };
  useEffect(() => { void refresh().catch(e => setNotice(e?.message || '지도를 불러오지 못했어요.')); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Seven chapters don't fit in one row: keep the open chapter's tab in view.
  useEffect(() => { if (chapterId) document.querySelector(`[data-chapter-tab="${chapterId}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [chapterId, exp === null]);

  if (!exp || !chapterId) return <div className="fixed inset-0 z-[80] bg-white" aria-busy="true">{notice && <p className="p-6 text-center text-sm text-slate-500">{notice}</p>}</div>;
  const chapter = exp.chapters.find(c => c.id === chapterId)!, look = LOOK[chapter.id] || LOOK.forest;
  const stage = selected ? exp.chapters.flatMap(c => c.stages).find(s => s.id === selected) : undefined;
  const stageTitle = (id: string) => { const c = exp.chapters.find(x => id.startsWith(x.id + '-')), s = c?.stages.find(x => x.id === id); return c && s ? `${c.title} · ${s.name}` : '원정대'; };
  const resumable = run && !run.finished ? run.stage : null;
  const chapterStars = chapter.stages.reduce((a, s) => a + s.stars, 0), left = chapter.stages.filter(s => !s.cleared).length;

  // A new game on a sound stage (듣고 고르기, 👑) asks about a quiet place first, every time; resuming doesn't.
  const start = async (id: string, restart = false, quiet?: boolean) => {
    if (quiet === undefined && stageHasSound(id) && !(resumable === id && !restart)) { setQuietFor({ id, restart }); return; }
    setQuietFor(null); setBusy(true); setNotice('');
    try {
      const r = await send('feed-start', { stage: id, ...(restart ? { restart: true } : {}), quiet: quiet === true, noMic: !speechRecognitionClass() });
      if (r.expedition) setExp(r.expedition);
      if (r.run) { setRun(r.run); setPlaying(true); }
    } catch (e: any) {
      if (e?.code === 'FEED_OTHER_RUN' && await askConfirm({ title: '하던 판이 있어요', message: `${resumable ? stageTitle(resumable) : '단어 먹이 주기'} 판을 그만두고 출발할까요? 기운 ${PET_WORD_FEED.energy}을 써요.`, confirmText: '그만두고 출발' })) { setBusy(false); return start(id, true, quiet); }
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
          <h1 className="text-center text-base font-black leading-tight text-[#5e1e2a]">원정대<span className="block text-[11px] font-bold text-slate-500">{pet.name}의 지도</span></h1>
          <span className="text-xs font-bold text-[#8b2f40]">기운 {pet.energy}</span>
        </header>
        <div role="tablist" aria-label="장" className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {exp.chapters.map(c => <button key={c.id} type="button" role="tab" data-chapter-tab={c.id} aria-selected={c.id === chapterId} onClick={() => { setChapterId(c.id); setSelected(null); }} className={`flex flex-none items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${c.id === chapterId ? 'bg-[#e0587a] text-white' : c.unlocked ? 'bg-[#f8f1f2] text-[#8b2f40]' : 'bg-[#f8f1f2] text-slate-400'}`}>{c.title}{!c.levelOk ? <span className="text-[10px]">Lv.{c.minLevel}</span> : !c.unlocked && <Lock size={11} aria-label="잠김" />}{c.rewarded && <Check size={12} aria-label="완료" />}</button>)}
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
          {chapter.stages.some(s => s.id === exp.current) && (() => { const [x, y] = SPOTS[chapter.stages.findIndex(s => s.id === exp.current)]; return <span className="pointer-events-none absolute" style={{ left: `calc(${x}% + 18px)`, top: `calc(${y}% - 30px)` }}><PetCharacter aura={petAura(pet)} character={pet.character} stage={petStage(pet.level)} clothing={pet.clothing} accessory={wornAccessories(pet)} size={44} /></span>; })()}
        </div>
        <p className="mt-2 text-center text-[11px] font-bold text-[#8b2f40]">✨ {PET_JOB_GUIDE}</p>
        <div className="mt-1 flex justify-between text-xs font-bold text-[#8b2f40]"><span>★ {chapterStars} / {chapter.stages.length * 3}</span><span>{chapter.rewarded ? `${rewardText(chapter)} 받음 ✓` : `${petItem(chapter.reward)?.icon} ${rewardText(chapter)}까지 ${left}스테이지`}</span></div>
        {resumable && <button type="button" onClick={() => { setChapterId(resumable.split('-')[0]); setSelected(resumable); }} className="mt-3 w-full rounded-2xl bg-[#fef2f3] px-4 py-2.5 text-left text-xs text-[#5e1e2a]">하던 판이 저장돼 있어요 · <b className="font-bold">{stageTitle(resumable)}, {run!.index + 1}번째 문제부터</b></button>}
        {onGuild && <button type="button" onClick={onGuild} className="mt-3 flex w-full items-center gap-3 rounded-2xl border-2 border-[#d9bf96] bg-[#f7efe2] px-4 py-2.5 text-left"><span className="text-xl" aria-hidden="true">🏰</span><span className="flex-1 text-xs text-[#6b5a40]"><b className="block text-sm font-black text-[#5e1e2a]">모험가 길드</b>친구들과 파티를 꾸려 이번 주 보스를 물리쳐요</span></button>}
        {notice && <p role="alert" className="mt-3 text-center text-xs font-bold text-[#b04a5a]">{notice}</p>}
      </div>

      {/* 1차 전직: 5장 설산 crown cleared with this pet (once per pet). Shown until chosen, also on later visits. */}
      {!pet.job && (exp.jobReady || []).includes(pet.slot) && !jobLater && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="job-title" className="w-full max-w-sm rounded-3xl bg-white px-5 pb-5 pt-4 text-center">
          <h2 id="job-title" className="text-base font-black text-[#5e1e2a]">1차 전직할 시간이에요!</h2>
          <p className="mt-1 text-xs text-slate-500">{pet.name}은(는) 어떤 길을 갈까요? 펫마다 한 번만 고를 수 있어요. 직업 무기와 첫 스킬을 받아요.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">{(Object.keys(PET_JOBS) as PetJob[]).map(job => <button key={job} type="button" disabled={busy} onClick={() => void chooseJob(job)} className="flex flex-col items-center gap-1 rounded-2xl border border-[#f3e6e8] bg-[#fdf6f7] px-2 py-3 hover:border-[#f5a3a8] disabled:opacity-60">
            <PetCharacter aura={petAura(pet)} character={pet.character} stage={petStage(pet.level)} clothing={pet.clothing} accessory={[...wornAccessories(pet).filter(id => petItem(id)?.slot !== 'hand'), PET_JOBS[job].weapon]} size={72} />
            <b className="text-sm font-black text-[#5e1e2a]">{PET_JOBS[job].icon} {PET_JOBS[job].line}</b><span className="text-[11px] text-slate-500">{petItem(PET_JOBS[job].weapon)?.name}을(를) 받아요</span></button>)}</div>
          {state.pets.some(p => p.slot !== pet.slot && p.job) && <p className="mt-2 text-[11px] text-slate-400">다른 친구는 {state.pets.filter(p => p.slot !== pet.slot && p.job).map(p => `${p.name} ${PET_JOBS[p.job!].label}`).join(' · ')}예요</p>}
          <button type="button" onClick={() => setJobLater(true)} className="mt-3 text-xs text-slate-400">나중에 고를게요</button>
        </div>
      </div>}

      {/* 2차 전직: 7장 꿈의 정원 crown cleared with a pet that has a job: the light or dark branch of that job (once). */}
      {pet.job && !pet.job2 && (exp.job2Ready || []).includes(pet.slot) && !jobLater && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="job2-title" className="w-full max-w-sm rounded-3xl bg-white px-5 pb-5 pt-4 text-center">
          <h2 id="job2-title" className="text-base font-black text-[#5e1e2a]">2차 전직: 꿈을 이룰 시간이에요!</h2>
          <p className="mt-1 text-xs text-slate-500">{PET_JOBS[pet.job].label} {pet.name}은(는) 빛과 어둠 중 어느 길을 갈까요? 펫마다 한 번만 고를 수 있어요.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">{(Object.keys(PET_JOB2) as PetJob2[]).filter(b => PET_JOB2[b].base === pet.job).map(b => <button key={b} type="button" disabled={busy} onClick={() => void chooseJob2(b)} className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 disabled:opacity-60 ${PET_JOB2[b].element === '빛' ? 'border-[#f5e6a8] bg-[#fffbea] hover:border-[#e8c547]' : 'border-[#d9d4f0] bg-[#f5f3ff] hover:border-[#8b7fd6]'}`}>
            <PetCharacter aura={petAura(pet)} character={pet.character} stage={petStage(pet.level)} clothing={pet.clothing} accessory={[...wornAccessories(pet).filter(id => petItem(id)?.slot !== 'hand'), PET_JOB2[b].weapon]} size={72} />
            <b className="text-sm font-black text-[#5e1e2a]">{PET_JOB2[b].icon} {PET_JOB2[b].label} <span className="text-[11px] font-bold text-slate-500">({PET_JOB2[b].element})</span></b>
            <span className="text-[11px] text-slate-500">{petItem(PET_JOB2[b].weapon)?.name} · 칭호 '{PET_JOB2[b].title}'</span></button>)}</div>
          <button type="button" onClick={() => setJobLater(true)} className="mt-3 text-xs text-slate-400">나중에 고를게요</button>
        </div>
      </div>}

      {quietFor && <QuietPrompt onLoud={() => void start(quietFor.id, quietFor.restart, false)} onQuiet={() => void start(quietFor.id, quietFor.restart, true)} quietLabel="조용히 해야 해요 → 소리 없는 게임으로" />}
      {stage && <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-900/30" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="stage-title" className="w-full max-w-md rounded-t-3xl bg-white px-5 pb-6 pt-4 text-center">
          <h2 id="stage-title" className="text-base font-black text-[#5e1e2a]">{stage.name}</h2>
          <p className="text-xs text-slate-500">{STAGE_GAME_LABEL[stageGame(stage.id)]}{stageHasSound(stage.id) ? ' 🔊' : ''} · {stage.boss ? `왕관 스테이지 · 별 ${PET_EXPEDITION.bossStars}개 이상이면 통과` : '절반 이상 맞히면 통과'} · {chapter.questions || PET_WORD_FEED.questions}문제</p>
          <p className="my-2 text-2xl tracking-widest" aria-label={`최고 별 ${stage.stars}개`}><span className="text-[#f2b84b]">{'★'.repeat(stage.stars)}</span><span className="text-[#ece3e5]">{'★'.repeat(3 - stage.stars)}</span></p>
          <ul className="rounded-2xl bg-[#fdf6f7] px-4 py-2 text-left text-xs text-[#5e1e2a]">
            {(['clear', 'star2', 'star3'] as const).map(k => <li key={k} className="flex justify-between py-0.5"><span>{BONUS_LABEL[k]}</span><span className={stage.bonuses.includes(k) ? 'text-slate-400' : 'font-bold text-[#8b2f40]'}>{stage.bonuses.includes(k) ? '받음 ✓' : `+${PET_EXPEDITION.bonus[k]}P`}</span></li>)}
            <li className="flex justify-between py-0.5 text-slate-500"><span>맞힌 단어</span><span>문제당 5P</span></li>
            {stage.boss && <li className="flex justify-between py-0.5"><span>장 완료 보상</span><span className="font-bold text-[#8b2f40]">{petItem(chapter.reward)?.icon} {rewardText(chapter)}</span></li>}
            {stage.boss && chapter.id === PET_EXPEDITION.jobChapter && <li className="flex justify-between py-0.5"><span>1차 전직 (펫마다 한 번)</span><span className="font-bold text-[#8b2f40]">⚔️ 검사 · 🪄 마법사</span></li>}
            {stage.boss && chapter.id === PET_EXPEDITION.weaponChapter && <li className="flex justify-between py-0.5"><span>내 직업의 새 무기</span><span className="font-bold text-[#8b2f40]">{pet.job ? petItem(PET_JOBS[pet.job].nextWeapon)?.name : '별무리 대검 · 은하수 지팡이'}</span></li>}
            {stage.boss && chapter.id === PET_EXPEDITION.job2Chapter && <li className="flex justify-between py-0.5"><span>2차 전직 (펫마다 한 번)</span><span className="font-bold text-[#8b2f40]">빛 · 어둠</span></li>}
            {stage.boss && chapter.id === PET_EXPEDITION.job2Chapter && <li className="flex justify-between py-0.5"><span>★★★ 처음 달성</span><span className="font-bold text-[#8b2f40]">꿈의 검 · 꿈의 지팡이 (꾸미기)</span></li>}
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
