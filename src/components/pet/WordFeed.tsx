import { wordTaskResult } from '../../lib/wordTaskResult';
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { PetCharacter } from './PetCharacters';
import { PET_EXPEDITION, PET_WORD_FEED, STAGE_GAME_LABEL, petItem, petStage, stageGame, stageHasSound, towerGearFor, petGearView, wornAccessories } from '../../lib/petCatalog';
import { speechRecognitionClass } from '../../lib/sentenceGame';
import { QuietPrompt } from '../sentence/SentenceGame';
import { ListenButton, MatchBoard, OrderBoard, ReadBoard, SpellBoard, type StageAnswer } from './StageQuestion';
import type { PetResponse, PetState } from '../../lib/petService';

// 단어 먹이 주기: the pet holds a word, the student feeds it the right meaning. The server builds and grades every
// question (this screen only shows what it gets back), and the same screen becomes a 원정대 stage later.
export interface FeedQuestionView { type?: 'meaning' | 'listen' | 'spell' | 'match' | 'order' | 'read'; word: string; choices: string[]; retry: boolean; meaning?: string; hint?: string; letters?: string[]; pieces?: string[]; triesLeft?: number; words?: string[]; meanings?: string[]; matched?: number[]; mistakes?: number; answer?: number; choice?: number; correct?: boolean; points?: number }
export interface StageOutcome { stage: string; boss?: boolean; stars: number; best: number; cleared: boolean; bonus: number; bonuses: string[]; paid?: Record<string, number>; unlocked: string | null; chapterReward: string | null; setGear?: string | null }
export interface FeedRunView { id: string; stage?: string | null; /** 단어 과제 game */ task?: string | null; finished: boolean; total: number; index: number; questions: FeedQuestionView[]; summary?: { correct: number; total: number; points: number; stars: number } }

/** `title`: the 원정대 stage name; `onNext`: open the stage this one just unlocked. */
/** A 단어 과제 as the result screen shows it. */
export interface FeedTaskView { title: string; total: number; mastered: number; completedAt: number | null }
export default function WordFeed({ run: initial, state, send: sendRaw, onClose, title, onNext, task: taskStart }: { run: FeedRunView; state: PetState; send: (action: string, payload?: Record<string, unknown>) => Promise<PetResponse & { run?: FeedRunView }>; onClose: () => void; title?: string; onNext?: (stage: string) => void; /** 단어 과제 game: the task (kept up to date from each answer) */ task?: FeedTaskView | null }) {
  // 단어 과제: each answer brings the task back (맞힘 so far, done when every word is right)
  const [task, setTask] = useState<FeedTaskView | null>(taskStart || null);
  const taskEnd = wordTaskResult(task);
  const send: typeof sendRaw = async (action, payload) => { const r: any = await sendRaw(action, payload); if (r?.result?.task) setTask(r.result.task); return r; };
  const [run, setRun] = useState(initial);
  const [shown, setShown] = useState<number | null>(null); // question whose answer is on screen
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [outcome, setOutcome] = useState<StageOutcome | null>(null); // a finished 원정대 stage
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const pet = state.pets.find(p => p.slot === state.currentPetSlot)!;
  const at = shown ?? run.index, q = run.questions[at];

  const reload = async () => { const r = await send('feed-state'); if (r.run) setRun(r.run); setShown(null); };
  const type = q?.type || 'meaning';
  // A sound stage asks about a quiet place before every new game (never remembered).
  const [quietAsk, setQuietAsk] = useState(false);
  const pick = (choice: number) => answer({ choice });
  const answer = async (payload: { choice?: number } & StageAnswer): Promise<any> => {
    if (busy || shown !== null || !q || q.answer !== undefined) return null;
    setBusy(true); setNotice('');
    try {
      const r = await send('feed-answer', { runId: run.id, index: run.index, ...payload });
      // A try that isn't the answer yet (철자·문장 배열 wrong, or one 짝 맞추기 pick): the board goes on.
      if (r.result?.pending) { if (r.run) setRun(r.run); return r.result; }
      if (r.result?.expedition) setOutcome(r.result.expedition);
      if (r.run) { setRun(r.run); setShown(run.index); timer.current = window.setTimeout(() => setShown(null), r.result?.correct ? 900 : 1800); }
      return r.result;
    } catch (e: any) {
      if (e?.code === 'FEED_STALE') { setNotice(e.message); await reload().catch(() => undefined); } else setNotice(e?.message || '잠시 후 다시 해 주세요.');
    } finally { setBusy(false); }
  };
  const again = async (quiet?: boolean) => {
    if (quiet === undefined && (stageHasSound(run.stage) || run.task)) { setQuietAsk(true); return; }
    setQuietAsk(false); setBusy(true); setNotice('');
    try { const r = await send('feed-start', run.stage ? { stage: run.stage, quiet: quiet === true, noMic: !speechRecognitionClass() } : run.task ? { task: run.task, quiet: quiet === true } : {}); if (r.run) { setRun(r.run); setShown(null); setOutcome(null); } } catch (e: any) { setNotice(e?.message || '잠시 후 다시 해 주세요.'); } finally { setBusy(false); }
  };

  const answered = q?.answer !== undefined && shown !== null;
  const mood = answered ? (q!.correct ? 'yum' : 'huh') : 'wait';
  const done = run.finished && shown === null && run.summary;

  return (
    <div role="dialog" aria-modal="true" aria-label={title || '단어 먹이 주기'} className="fixed inset-0 z-[90] overflow-y-auto bg-white">
      {quietAsk && <QuietPrompt onLoud={() => void again(false)} onQuiet={() => void again(true)} quietLabel="조용히 해야 해요 → 소리 없는 게임으로" />}
      <div className="mx-auto max-w-md px-4 pb-8 pt-3">
        <div className="flex items-center justify-between text-xs font-bold text-[#8b2f40]">
          <span>{title || '단어 먹이 주기'}{run.stage && <span className="ml-1.5 rounded-full bg-[#fef2f3] px-2 py-0.5 text-[10px]">{STAGE_GAME_LABEL[stageGame(run.stage)]}</span>}</span>
          <span className="flex items-center gap-3">{!done && <span>{Math.min(at + 1, run.total)} / {run.total}</span>}<button type="button" onClick={onClose} aria-label="나가기 (하던 곳은 저장돼요)" className="text-slate-400 hover:text-slate-600"><X size={18} /></button></span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f6e3e6]"><div className="h-full rounded-full bg-[#e0587a] transition-all" style={{ width: `${(run.index / Math.max(1, run.total)) * 100}%` }} /></div>

        {done ? <div className="mt-6 text-center">
          <h2 className="text-lg font-black text-[#5e1e2a]">{run.task ? taskEnd.heading : outcome ? (outcome.cleared ? `${title || '스테이지'} 통과!` : outcome.boss ? '조금만 더! 별 2개면 통과예요' : '조금만 더! 절반 이상 맞히면 통과예요') : '다 먹었어요!'}</h2>
          <p className="mt-1 text-2xl tracking-widest text-[#f2b84b]" aria-label={`별 ${run.summary!.stars}개`}>{'★'.repeat(run.summary!.stars)}<span className="text-[#ece3e5]">{'★'.repeat(3 - run.summary!.stars)}</span></p>
          <div className="mt-2 flex justify-center"><PetCharacter character={pet.character} stage={petStage(pet.level)} clothing={pet.clothing} accessory={wornAccessories(pet)} gear={petGearView(pet)} size={110} /></div>
          <div className="mx-auto mt-3 max-w-xs rounded-2xl bg-[#fdf6f7] px-4 py-3 text-left text-xs leading-6 text-[#5e1e2a]">
            {run.task && task && <span className={`mb-2 block rounded-xl px-3 py-2 ${taskEnd.done ? 'bg-[#eaf3de] text-[#27500a]' : 'bg-[#e6f1fb] text-[#0c447c]'}`}><b className="block font-black">{taskEnd.line}</b>{task.title}
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/70"><span className="block h-full rounded-full bg-[#1d9e75]" style={{ width: `${taskEnd.percent}%` }} /></span></span>}
            처음 맞힌 문제 {run.summary!.correct} / {run.summary!.total}개 · <b className="font-bold">+{run.summary!.points}P</b><br />
            {outcome && outcome.bonuses.map(b => { const full = PET_EXPEDITION.bonus[b as keyof typeof PET_EXPEDITION.bonus], got = outcome.paid?.[b] ?? 0; return <span key={b} className="block">{b === 'clear' ? '처음 통과 보너스' : b === 'star2' ? '★★ 처음 달성' : '★★★ 처음 달성'} <b className="font-bold">+{got}P</b>{got < full && <span className="text-slate-400"> (오늘 공부 포인트가 가득 찼어요)</span>}</span>; })}
            {outcome?.unlocked && <span className="block font-bold text-[#b04a5a]">다음 스테이지가 열렸어요!</span>}
            {outcome?.setGear && <span className="block font-bold text-[#3c3489]">🎁 ★3 장비: {towerGearFor(outcome.setGear, pet.job)?.name} (채움의 탑에 들어가면 받아요)</span>}
            {outcome?.chapterReward && <span className="block font-bold text-[#b04a5a]">장 완료 보상: {petItem(outcome.chapterReward)?.icon} {petItem(outcome.chapterReward)?.name} (옷장의 배경)</span>}
            <span className="text-slate-500">오늘 공부 포인트 {state.today.studyPoints} / {state.today.studyCap}P · 기운 {pet.energy}</span>
          </div>
          {outcome?.unlocked && onNext ? <button type="button" onClick={() => onNext(outcome.unlocked!)} className="mt-4 w-full rounded-2xl bg-[#e0587a] py-3 text-sm font-bold text-white">다음 스테이지</button>
            : run.task ? (taskEnd.more && <button type="button" disabled={busy} onClick={() => void again(undefined)} className="mt-4 w-full rounded-2xl bg-[#185fa5] py-3 text-sm font-bold text-white disabled:opacity-60">다음 판 (기운 안 씀)</button>)
            : <button type="button" disabled={busy} onClick={() => void again(undefined)} className="mt-4 w-full rounded-2xl bg-[#e0587a] py-3 text-sm font-bold text-white disabled:opacity-60">{run.stage ? '다시 도전' : '한 판 더'} (기운 {PET_WORD_FEED.energy})</button>}
          {outcome?.unlocked && onNext && <button type="button" disabled={busy} onClick={() => void again(undefined)} className="mt-2 w-full rounded-2xl border border-[#f3d5da] py-2.5 text-sm font-bold text-[#8b2f40]">다시 도전 (기운 {PET_WORD_FEED.energy})</button>}
          <button type="button" onClick={onClose} className="mt-2 w-full rounded-2xl border border-[#f3d5da] py-2.5 text-sm font-bold text-[#8b2f40]">{run.stage || run.task ? '지도로 돌아가기' : '펫에게 돌아가기'}</button>
          <p className="mt-3 text-[11px] text-slate-400">오늘 이미 포인트를 받은 단어는 다시 맞혀도 포인트가 없어요.</p>
        </div> : q && <>
          <div className={`relative mt-4 flex items-end justify-center overflow-hidden rounded-3xl bg-[#fdf6f7] ${type === 'meaning' || type === 'listen' ? 'h-52' : 'h-36'}`}>
            {type === 'meaning' && <span className="absolute left-1/2 top-4 -translate-x-1/2 rounded-2xl border border-[#f3d5da] bg-white px-5 py-2 text-xl font-black text-[#1f1a24]" lang="en">{q.word}</span>}
            {type === 'listen' && <span key={at} className="absolute left-1/2 top-3 -translate-x-1/2"><ListenButton word={q.word} revealed={answered} /></span>}
            {type !== 'meaning' && type !== 'listen' && answered && <span className="absolute left-1/2 top-3 max-w-[90%] -translate-x-1/2 rounded-2xl border border-[#f3d5da] bg-white px-3 py-1.5 text-center text-sm font-black text-[#1f1a24]" lang="en">{type === 'match' ? (q.correct ? '짝 맞추기 성공!' : '실수가 많았어요') : q.word}</span>}
            {q.retry && <span className="absolute left-3 top-3 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[#b04a5a]">다시 나온 단어</span>}
            <motion.div key={`${at}-${mood}`} initial={{ rotate: 0, y: 0 }} animate={mood === 'yum' ? { y: [0, -14, 0] } : mood === 'huh' ? { rotate: [0, -10, -8] } : { rotate: 0 }} transition={{ duration: 0.5 }} className="mb-2">
              <PetCharacter character={pet.character} stage={petStage(pet.level)} clothing={pet.clothing} accessory={wornAccessories(pet)} gear={petGearView(pet)} size={120} />
            </motion.div>
            <AnimatePresence>{answered && <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-6 top-16 rounded-2xl border border-[#f3d5da] bg-white px-3 py-1 text-xs font-bold text-[#8b2f40]">{q.correct ? `냠냠!${q.points ? ` +${q.points}P` : ''}` : '음…?'}</motion.span>}</AnimatePresence>
          </div>
          {type === 'spell' && !answered && <div key={`${at}-${q.triesLeft}`} className="mt-3"><SpellBoard hint={q.hint || ''} letters={q.letters || []} meaning={q.meaning || ''} triesLeft={q.triesLeft ?? 3} busy={busy} onDone={a => void answer(a)} /></div>}
          {type === 'match' && !answered && <div key={at} className="mt-3"><MatchBoard words={q.words || []} meanings={q.meanings || []} matched={q.matched || []} mistakes={q.mistakes || 0} busy={busy} onPick={async (w, m) => { const x = await answer({ pick: [w, m] }); return Boolean(x?.correct); }} /></div>}
          {type === 'order' && !answered && <div key={`${at}-${q.triesLeft}`} className="mt-3"><OrderBoard pieces={q.pieces || []} meaning={q.meaning || ''} triesLeft={q.triesLeft ?? 3} busy={busy} onDone={a => void answer(a)} /></div>}
          {type === 'read' && !answered && <div key={at} className="mt-3"><ReadBoard text={q.word} meaning={q.meaning || ''} busy={busy} onDone={a => void answer(a)} /></div>}
          {(type === 'meaning' || type === 'listen') && <div className="mt-3 space-y-2" role="group" aria-label="뜻 고르기">
            {q.choices.map((c, i) => {
              const right = answered && i === q.answer, wrong = answered && i === q.choice && !q.correct;
              return <button key={i} type="button" disabled={busy || answered} onClick={() => void pick(i)} className={`block w-full whitespace-normal break-keep rounded-2xl border px-4 py-3 text-left text-sm font-bold leading-snug transition-colors ${right ? 'border-[#3f9e6a] bg-[#eef8f1] text-[#1f6b43]' : wrong ? 'border-[#e0587a] bg-[#fff2f4] text-[#b04a5a]' : 'border-[#f3e6e8] bg-white text-[#5e1e2a] hover:border-[#f5a3a8]'}`}>{c}{right && ' ✓'}</button>;
            })}
          </div>}
          <p role="status" aria-live="polite" className="mt-3 min-h-[18px] text-center text-xs font-bold text-[#8b2f40]">{notice || (answered && !q.correct ? (q.retry ? '정답을 기억해 두세요!' : type === 'meaning' || type === 'listen' || type === 'spell' ? `괜찮아요! 이 단어는 ${PET_WORD_FEED.retryAfter}문제 뒤에 한 번 더 나와요` : '괜찮아요! 다음 문제로 가요') : !answered ? (type === 'listen' ? '잘 듣고 뜻 카드를 골라요' : type === 'meaning' ? '뜻 카드를 눌러 간식을 줘요' : '') : '')}</p>
        </>}
      </div>
    </div>
  );
}
